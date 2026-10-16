/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide';
import { planSync, type FolderListing } from './python-sync';
import type { PythonWorkerRequest, PythonWorkerResponse } from '@/infobim/shared/domain/model/python-message';

const pythonBase = new URL(`${import.meta.env.BASE_URL}python/`, self.location.origin).href;
let runtime: Promise<PyodideAPI> | null = null;
let queue: Promise<void> = Promise.resolve();

async function readFileList(file: string): Promise<string[]> {
  const url = `${pythonBase}${file}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load ${file}: HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`Unable to load ${url}: expected JSON, received ${response.headers.get('content-type') ?? 'no content type'}. Restart the server after regenerating the Python runtime.`);
  }
  const files: unknown = await response.json();
  if (!Array.isArray(files) || !files.every((entry) => typeof entry === 'string')) {
    throw new Error(`${file} must contain a list of strings.`);
  }
  return files;
}

/** Load only the vendored runtime and packages, without blocking the UI thread. */
async function startPython(): Promise<PyodideAPI> {
  const { loadPyodide } = await import(/* @vite-ignore */ `${pythonBase}pyodide/pyodide.mjs`) as typeof import('pyodide');
  const python = await loadPyodide({ indexURL: `${pythonBase}pyodide/` });
  await python.loadPackage(await readFileList('packages.json'));

  const wheelUrls = (await readFileList('wheels.json')).map((file) => `${pythonBase}wheels/${file}`);
  const wheels = python.toPy(wheelUrls);
  try {
    python.globals.set('WHEELS', wheels);
    await python.runPythonAsync('import micropip\nawait micropip.install(WHEELS, deps=False)');
  } finally {
    python.globals.delete('WHEELS');
    wheels.destroy();
  }

  const infobimVersion: unknown = await python.runPythonAsync('from importlib.metadata import version\nversion("infobim")');
  if (typeof infobimVersion !== 'string' || !infobimVersion.trim()) {
    throw new Error('The installed InfoBIM package has no version metadata.');
  }
  const message: PythonWorkerResponse = { type: 'ready', infobimVersion };
  self.postMessage(message);
  return python;
}

/** Capture each command separately, restoring interpreter state even on failure. */
const RUN_CLI = `
import os, sys, json, io, contextlib
from infobim.cli import main
previous_cwd, previous_argv = os.getcwd(), sys.argv
output, errors = io.StringIO(), io.StringIO()
exit_code = 0
try:
    os.chdir(CWD)
    sys.argv = list(ARGV)
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
        try:
            main()
        except SystemExit as result:
            exit_code = result.code if isinstance(result.code, int) else (0 if result.code is None else 1)
finally:
    os.chdir(previous_cwd)
    sys.argv = previous_argv
json.dumps({"code": exit_code, "stdout": output.getvalue(), "stderr": errors.getvalue()})
`;

async function run(request: Extract<PythonWorkerRequest, { type: 'run' }>): Promise<void> {
  const { requestId, argv, mount } = request;
  try {
    if (!runtime) throw new Error('Python has not been started by the layout.');
    const python = await runtime;
    if (!mount.path.startsWith('/') || mount.path === '/' || mount.path.split('/').some((part) => part === '..' || part === '.')) {
      throw new Error('The project mount must be an absolute directory path.');
    }
    python.FS.mkdirTree(mount.path);
    if ((python.FS.readdir(mount.path) as string[]).some((name) => name !== '.' && name !== '..')) {
      throw new Error('The registered project location conflicts with the runtime filesystem.');
    }
    let before: FolderListing | null = null;
    let mounted = false;
    const args = python.toPy(argv);
    let result: { code: number; stdout: string; stderr: string };
    try {
      if (mount.handle) {
        await python.mountNativeFS(mount.path, mount.handle);
        mounted = true;
        before = listFolder(python, mount.path);
      } else {
        for (const file of mount.files ?? []) {
          if (file.path.startsWith('/') || file.path.split('/').includes('..')) throw new Error('Invalid metadata path.');
          const path = `${mount.path}/${file.path}`;
          python.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
          python.FS.writeFile(path, new Uint8Array(file.data));
        }
      }
      python.globals.set('CWD', mount.path);
      python.globals.set('ARGV', args);
      result = JSON.parse(String(await python.runPythonAsync(RUN_CLI))) as {
        code: number; stdout: string; stderr: string;
      };
      if (mounted && before && mount.handle) await writeBack(python, mount.path, mount.handle, before);
    } finally {
      args.destroy();
      python.globals.delete('CWD');
      python.globals.delete('ARGV');
      if (mounted) python.FS.unmount(mount.path);
      // Discard copied metadata so another project never inherits stale files.
      python.globals.set('MOUNT_PATH', mount.path);
      try {
        await python.runPythonAsync('import shutil\nshutil.rmtree(MOUNT_PATH, ignore_errors=True)');
      } finally {
        python.globals.delete('MOUNT_PATH');
      }
    }
    const message: PythonWorkerResponse = { type: 'result', requestId, ...result };
    self.postMessage(message);
  } catch (error) {
    const message: PythonWorkerResponse = {
      type: 'command-failed', requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
}

/** Looks up the feature ontology directly: no project mount, no CWD/argv. */
const RUN_FEATURE_MESSAGE = `
import json
from brasidatacenter.tool.adapter.feature_message import first_message
json.dumps({"text": first_message(IDENTIFIER, DEVICE, ENVIRONMENT, LANGUAGE, PARAMETERS)})
`;

async function runFeatureMessage(request: Extract<PythonWorkerRequest, { type: 'feature-message' }>): Promise<void> {
  const { requestId, identifier, device, environment, language, parameters } = request;
  try {
    if (!runtime) throw new Error('Python has not been started by the layout.');
    const python = await runtime;
    python.globals.set('IDENTIFIER', identifier);
    python.globals.set('DEVICE', device);
    python.globals.set('ENVIRONMENT', environment);
    python.globals.set('LANGUAGE', language);
    const pyParameters = python.toPy(parameters ?? {});
    python.globals.set('PARAMETERS', pyParameters);
    try {
      const result = JSON.parse(String(await python.runPythonAsync(RUN_FEATURE_MESSAGE))) as { text: string | null };
      const message: PythonWorkerResponse = { type: 'feature-message-result', requestId, text: result.text };
      self.postMessage(message);
    } finally {
      python.globals.delete('IDENTIFIER');
      python.globals.delete('DEVICE');
      python.globals.delete('ENVIRONMENT');
      python.globals.delete('LANGUAGE');
      python.globals.delete('PARAMETERS');
      pyParameters.destroy();
    }
  } catch (error) {
    const message: PythonWorkerResponse = {
      type: 'command-failed', requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
}

/** What the installer of the runtime (micropip, the `pip` of Pyodide) holds, for the packages asked about. */
const RUN_PACKAGE_VERSIONS = `
import json
import micropip
installed = micropip.list()
json.dumps({name: (installed[name].version if name in installed else None) for name in PACKAGES})
`;

async function runPackageVersions(request: Extract<PythonWorkerRequest, { type: 'package-versions' }>): Promise<void> {
  const { requestId, packages } = request;
  try {
    if (!runtime) throw new Error('Python has not been started by the layout.');
    const python = await runtime;
    const names = python.toPy(packages);
    python.globals.set('PACKAGES', names);
    try {
      const versions = JSON.parse(String(await python.runPythonAsync(RUN_PACKAGE_VERSIONS))) as Record<string, string | null>;
      const message: PythonWorkerResponse = { type: 'package-versions-result', requestId, versions };
      self.postMessage(message);
    } finally {
      python.globals.delete('PACKAGES');
      names.destroy();
    }
  } catch (error) {
    const message: PythonWorkerResponse = {
      type: 'command-failed', requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
}

/** Every entry under `root` in Python's file system, by path relative to it. */
function listFolder(py: PyodideAPI, root: string): FolderListing {
  const listing: FolderListing = new Map();
  const walk = (relative: string): void => {
    const absolute = relative ? `${root}/${relative}` : root;
    for (const name of py.FS.readdir(absolute) as string[]) {
      if (name === '.' || name === '..') continue;
      const path = relative ? `${relative}/${name}` : name;
      const stat = py.FS.stat(`${root}/${path}`);
      const isDir = py.FS.isDir(stat.mode);
      listing.set(path, { kind: isDir ? 'dir' : 'file', mtime: new Date(stat.mtime).getTime(), size: isDir ? 0 : stat.size });
      if (isDir) walk(path);
    }
  };
  walk('');
  return listing;
}

async function directoryAt(top: FileSystemDirectoryHandle, segments: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let dir = top;
  for (const segment of segments) dir = await dir.getDirectoryHandle(segment, { create });
  return dir;
}

/**
 * Carries back to the folder on disk what the command did — and only that
 * (see `planSync`). Replaces Pyodide's `syncfs()`, which mirrors the mounted
 * copy and would delete anything written on disk while the command ran.
 */
async function writeBack(py: PyodideAPI, root: string, top: FileSystemDirectoryHandle, atMount: FolderListing): Promise<void> {
  const plan = planSync(atMount, listFolder(py, root));
  for (const path of plan.remove) {
    const segments = path.split('/');
    try {
      const parent = await directoryAt(top, segments.slice(0, -1), false);
      // Not recursive: the entries the command removed inside it come first in the plan.
      await parent.removeEntry(segments[segments.length - 1]);
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      // Already gone from disk (removed there while the command ran): nothing left to do.
      if (error.name === 'NotFoundError') continue;
      // A directory that got new entries on disk while the command ran keeps them.
      if (error.name === 'InvalidModificationError') continue;
      throw error;
    }
  }
  for (const path of plan.createDirs) await directoryAt(top, path.split('/'), true);
  for (const path of plan.writeFiles) {
    const segments = path.split('/');
    const parent = await directoryAt(top, segments.slice(0, -1), true);
    const writable = await (await parent.getFileHandle(segments[segments.length - 1], { create: true })).createWritable();
    await writable.write(py.FS.readFile(`${root}/${path}`));
    await writable.close();
  }
}

self.onmessage = ({ data }: MessageEvent<PythonWorkerRequest>) => {
  if (data.type === 'start' && !runtime) {
    runtime = startPython();
    void runtime.catch((error: unknown) => {
      const message: PythonWorkerResponse = {
        type: 'failed', message: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(message);
    });
  } else if (data.type === 'run') {
    // cwd, argv and mounts are shared by the interpreter: serialize commands.
    queue = queue.then(() => run(data));
  } else if (data.type === 'feature-message') {
    // Shares the same single interpreter, so it is serialized too.
    queue = queue.then(() => runFeatureMessage(data));
  } else if (data.type === 'package-versions') {
    queue = queue.then(() => runPackageVersions(data));
  }
};
