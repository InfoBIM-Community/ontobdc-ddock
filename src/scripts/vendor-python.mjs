#!/usr/bin/env node
/**
 * Vendors the in-browser Python runtime into public/python/ so the app never
 * loads Python from a CDN:
 *
 *   public/python/pyodide/   Pyodide core + the Pyodide-built packages listed in
 *                            python/manifest.json (and their dependencies)
 *   public/python/wheels/    the manifest's wheels: pure-Python pins from PyPI,
 *                            `urlWheels` (downloaded, sha256-checked) and
 *                            `localWheels` (copied from this repository)
 *   public/python/wheels.json  the wheel file names, installed in this order
 *
 * The Pyodide distribution comes from its GitHub release tarball (cached in
 * .cache/). Re-running is a no-op while the manifest is unchanged.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLocalWheels } from './local-wheels.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'python', 'manifest.json');
const OUT = join(ROOT, 'public', 'python');
const CACHE = join(ROOT, '.cache');
const STAMP = join(OUT, '.stamp');
// The loader's files; which of the asm wrappers exists depends on the Pyodide version.
const CORE_FILES = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];

const manifestText = readFileSync(MANIFEST_PATH, 'utf8');
const manifest = JSON.parse(manifestText);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
// The wheels of this project's own packages are built from their source when it is found.
const built = buildLocalWheels(manifest);
// The committed local wheels are pinned by sha256 in the manifest; the built ones, by the hash of their source.
const stamp = sha256(manifestText + JSON.stringify([...built].map(([name, { hash }]) => [name, hash])));

if (existsSync(STAMP) && readFileSync(STAMP, 'utf8') === stamp) {
  console.log('[python] runtime already vendored');
  process.exit(0);
}

const normalize = (name) => name.toLowerCase().replace(/[-_.]+/g, '-');

async function fetchComplete(url, decode) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { Connection: 'close' },
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const error = new Error(`GET ${url} → ${response.status}`);
        error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
        throw error;
      }
      return await decode(response);
    } catch (error) {
      if (error.permanent || attempt === 5) throw new Error(`Failed to download ${url}: ${error.message}`, { cause: error });
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(`[python] download failed (${attempt}/5): ${url}; retrying in ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function download(url, dest, expected) {
  if (existsSync(dest) && (!expected || sha256(readFileSync(dest)) === expected)) return;
  const data = await fetchComplete(url, async (response) => Buffer.from(await response.arrayBuffer()));
  if (expected && sha256(data) !== expected) throw new Error(`${basename(dest)}: sha256 does not match the manifest`);
  writeFileSync(dest, data);
}

async function vendorPyodide() {
  const version = manifest.pyodide;
  const tarball = join(CACHE, `pyodide-${version}.tar.bz2`);
  if (!existsSync(tarball)) {
    mkdirSync(CACHE, { recursive: true });
    console.log(`[python] downloading Pyodide ${version} (~320 MB, one time)…`);
    await download(`https://github.com/pyodide/pyodide/releases/download/${version}/pyodide-${version}.tar.bz2`, tarball);
  }

  const staging = join(CACHE, `pyodide-${version}`);
  if (!existsSync(join(staging, 'pyodide', 'pyodide-lock.json'))) {
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    console.log('[python] extracting Pyodide…');
    execFileSync('tar', ['-xjf', tarball, '-C', staging], { stdio: 'inherit' });
  }
  const dist = join(staging, 'pyodide');

  // Every requested package plus its transitive dependencies, as the lock file names them.
  const lock = JSON.parse(readFileSync(join(dist, 'pyodide-lock.json'), 'utf8')).packages;
  const byName = new Map(Object.entries(lock).map(([name, info]) => [normalize(name), info]));
  const wanted = new Set();
  const visit = (name) => {
    const key = normalize(name);
    if (wanted.has(key)) return;
    const info = byName.get(key);
    if (!info) throw new Error(`Pyodide ${version} has no package "${name}"`);
    wanted.add(key);
    (info.depends ?? []).forEach(visit);
  };
  manifest.pyodidePackages.forEach(visit);

  const target = join(OUT, 'pyodide');
  mkdirSync(target, { recursive: true });
  for (const file of CORE_FILES) if (existsSync(join(dist, file))) copyFileSync(join(dist, file), join(target, file));
  for (const key of wanted) copyFileSync(join(dist, byName.get(key).file_name), join(target, byName.get(key).file_name));
  console.log(`[python] Pyodide core + ${wanted.size} packages`);
}

/** Downloads the pure-Python wheel of `name==version` from PyPI, checks its hash, and puts it in `target`; returns its file name. */
async function vendorFromPypi(spec, target) {
  const [name, version] = spec.split('==');
  const metadata = join(CACHE, `pypi-${normalize(name)}-${version}.json`);
  const release = existsSync(metadata)
    ? JSON.parse(readFileSync(metadata, 'utf8'))
    : await fetchComplete(`https://pypi.org/pypi/${name}/${version}/json`, (response) => response.json());
  writeFileSync(metadata, JSON.stringify(release));
  const wheel = release.urls.find((u) => u.packagetype === 'bdist_wheel' && u.filename.endsWith('-none-any.whl'));
  if (!wheel) throw new Error(`PyPI has no pure-Python wheel for ${spec}`);
  const cached = join(CACHE, wheel.filename);
  await download(wheel.url, cached, wheel.digests.sha256);
  copyFileSync(cached, join(target, wheel.filename));
  return wheel.filename;
}

async function vendorWheels() {
  const target = join(OUT, 'wheels');
  mkdirSync(target, { recursive: true });
  const files = [];
  for (const spec of manifest.wheels) files.push(await vendorFromPypi(spec, target));
  for (const { url, sha256: expected } of manifest.urlWheels ?? []) {
    const file = basename(new URL(url).pathname);
    const cached = join(CACHE, file);
    await download(url, cached, expected);
    copyFileSync(cached, join(target, file));
    const actual = sha256(readFileSync(join(target, file)));
    if (actual !== expected) throw new Error(`${file}: sha256 ${actual} does not match the manifest`);
    files.push(file);
  }
  // Each package of this project comes from the first of: its source on disk (built above),
  // the release pinned in `pypi` (`name==version`, when it is published), the wheel committed here.
  for (const { file: source, sha256: expected, pypi } of manifest.localWheels ?? []) {
    const name = basename(source).split('-')[0];
    if (built.has(name)) {
      // Built from the source on disk, so it has no pinned hash.
      const wheel = built.get(name).path;
      copyFileSync(wheel, join(target, basename(wheel)));
      files.push(basename(wheel));
      continue;
    }
    if (pypi) {
      files.push(await vendorFromPypi(pypi, target));
      continue;
    }
    const file = basename(source);
    copyFileSync(join(ROOT, source), join(target, file));
    if (sha256(readFileSync(join(target, file))) !== expected) throw new Error(`${file}: sha256 does not match the manifest`);
    files.push(file);
  }
  writeFileSync(join(OUT, 'wheels.json'), JSON.stringify(files, null, 2));
  console.log(`[python] ${files.length} wheels`);
}

// Keep the public directory and its watched files in place. Removing the tree
// while Vite runs can leave its public-file index stale (JSON URLs then serve
// index.html). Only invalidate the completion stamp while refreshing assets.
rmSync(STAMP, { force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });
if (process.argv.includes('--wheels-only')) {
  // Refreshes only the wheels (not Pyodide, which is large); leaves the stamp cleared so the next full run completes.
  await vendorWheels();
  process.exit(0);
}
await vendorPyodide();
await vendorWheels();
writeFileSync(join(OUT, 'packages.json'), JSON.stringify(manifest.pyodidePackages, null, 2));
writeFileSync(STAMP, stamp);
console.log(`[python] vendored into ${OUT} (${readdirSync(join(OUT, 'pyodide')).length} runtime files)`);
