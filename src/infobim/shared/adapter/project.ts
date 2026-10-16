import { eventBus } from '@/infobim/shared/adapter/event-bus';
import type { AppEventMap } from '@/infobim/shared/domain/model/event';
import type { PythonCommandResult, PythonMount } from '@/infobim/shared/domain/model/python-command';
import type { ProjectInspection, ProjectOpened } from '@/infobim/shared/domain/model/project';
import {
  containerLocation, crateFilePaths, InvalidCrateError, parseCliResponse,
  pathsToTree, unwrapCliText, CONTAINER_FILE_PATH,
} from './project-format';

type DirectoryPicker = (options: { mode: 'readwrite'; id: string }) => Promise<FileSystemDirectoryHandle>;
type ProjectSource = {
  name: string;
  access: 'readwrite' | 'read';
  read(path: string): Promise<File | null>;
  mount(path: string): Promise<PythonMount>;
};

const CRATE_PATH = '.__ontobdc__/ro-crate-metadata.json';
const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const isDomError = (error: unknown, name: string): boolean => error instanceof DOMException && error.name === name;

/** Filesystem and CLI operations are private here; all communication uses events. */
export function initProjects(): () => void {
  let currentProject: ProjectOpened | null = null;
  let busy = false;
  let disposed = false;
  const pending = new Map<string, { resolve(result: PythonCommandResult): void; reject(error: Error): void }>();
  const pickerInputs = new Set<HTMLInputElement>();

  const command = (argv: string[], mount: PythonMount): Promise<PythonCommandResult> => {
    if (disposed) return Promise.reject(new Error('The project adapter was stopped.'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      eventBus.publish('presentation.python.command.requested', 'project', { requestId, argv, mount });
    });
  };

  const openFailed = (reason: AppEventMap['presentation.project.open.failed']['reason'], name: string | null, error?: unknown): void => {
    if (!disposed) eventBus.publish('presentation.project.open.failed', 'project', { reason, name, ...(error === undefined ? {} : { message: messageOf(error) }) });
  };
  const createFailed = (reason: AppEventMap['presentation.project.create.failed']['reason'], error?: unknown): void => {
    if (!disposed) eventBus.publish('presentation.project.create.failed', 'project', { reason, ...(error === undefined ? {} : { message: messageOf(error) }) });
  };

  const directorySource = (handle: FileSystemDirectoryHandle): ProjectSource => ({
    name: handle.name,
    access: 'readwrite',
    read: async (path) => {
      try {
        const segments = path.split('/');
        let directory = handle;
        for (const segment of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(segment);
        return await (await directory.getFileHandle(segments.at(-1)!)).getFile();
      } catch (error) {
        if (isDomError(error, 'NotFoundError') || isDomError(error, 'TypeMismatchError')) return null;
        throw error;
      }
    },
    mount: async (path) => ({ path, handle }),
  });

  const open = async (source: ProjectSource): Promise<void> => {
    let paths: string[];
    let location: string | null;
    try {
      const crate = await source.read(CRATE_PATH);
      if (!crate) return openFailed('crate-not-found', source.name);
      paths = crateFilePaths(await crate.text());
      const metadata = await source.read(CONTAINER_FILE_PATH);
      location = metadata ? containerLocation(await metadata.text()) : null;
    } catch (error) {
      return openFailed(error instanceof InvalidCrateError ? 'crate-invalid' : isDomError(error, 'NotAllowedError') ? 'permission-denied' : 'read-error', source.name, error);
    }
    if (!location) return openFailed('location-not-found', source.name);
    if (disposed) return;
    eventBus.publish('presentation.project.inspect.started', 'project', { name: source.name });
    try {
      const mount = await source.mount(location);
      const result = await command(['infobim', 'project', '--inspect', '--json'], mount);
      const inspect = parseCliResponse<ProjectInspection['content']>(result.stdout);
      if (result.code !== 0 || !inspect?.content?.tree) {
        throw new Error(inspect?.content?.error ? unwrapCliText(inspect.content.error) : result.stderr.trim() || `Inspection failed (exit ${result.code}).`);
      }
      if (disposed) return;
      currentProject = { name: source.name, access: source.access, parts: paths.length, inspect, folder: mount.handle };
      eventBus.publish('presentation.project.files.found', 'project', { nodes: pathsToTree(paths) });
      eventBus.publish('presentation.project.local.opened', 'project', currentProject);
    } catch (error) {
      openFailed('inspect-failed', source.name, error);
    }
  };

  const create = async (picker: DirectoryPicker, name: string): Promise<void> => {
    let storage: FileSystemDirectoryHandle;
    try {
      // Called before any await to preserve the submit's user activation.
      storage = await picker({ mode: 'readwrite', id: 'infobim-storage' });
    } catch (error) {
      if (disposed) return;
      if (isDomError(error, 'AbortError')) eventBus.publish('presentation.project.create.cancelled', 'project');
      else createFailed(isDomError(error, 'NotAllowedError') || isDomError(error, 'SecurityError') ? 'permission-denied' : 'unsupported', error);
      return;
    }
    if (disposed) return;
    eventBus.publish('presentation.project.create.started', 'project', { name });
    const mount = { path: `/storage/${storage.name}`, handle: storage };
    let stage: 'init-failed' | 'create-failed' = 'init-failed';
    try {
      const init = await command(['infobim', 'init', '--json'], mount);
      if (init.code !== 0) throw new Error(cliError(init));
      stage = 'create-failed';
      const created = await command(['infobim', 'project', '--create', name, '--json'], mount);
      const content = parseCliResponse<{ path?: string; error?: string }>(created.stdout)?.content;
      if (created.code !== 0 || !content?.path) throw new Error(cliError(created));
      const folder = unwrapCliText(content.path).replace(/\/+$/, '').split('/').pop();
      if (!folder || folder === '.' || folder === '..') throw new Error('The CLI returned an invalid project folder.');
      await open(directorySource(await storage.getDirectoryHandle(folder)));
    } catch (error) {
      createFailed(stage, error);
    }
  };

  const chooseProject = async (picker: DirectoryPicker): Promise<void> => {
    try {
      const handle = await picker({ mode: 'readwrite', id: 'infobim-project' });
      if (!disposed) await open(directorySource(handle));
    } catch (error) {
      if (disposed) return;
      if (isDomError(error, 'AbortError')) eventBus.publish('presentation.project.open.cancelled', 'project');
      else openFailed(isDomError(error, 'NotAllowedError') || isDomError(error, 'SecurityError') ? 'permission-denied' : 'read-error', null, error);
    }
  };

  const chooseReadOnly = (): Promise<void> => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.hidden = true;
    pickerInputs.add(input);
    document.body.append(input);
    const cleanup = (): void => { input.remove(); pickerInputs.delete(input); };
    input.addEventListener('cancel', () => {
      cleanup();
      if (!disposed) eventBus.publish('presentation.project.open.cancelled', 'project');
      resolve();
    }, { once: true });
    input.addEventListener('change', () => {
      const picked = Array.from(input.files ?? []);
      cleanup();
      if (!picked.length) {
        if (!disposed) eventBus.publish('presentation.project.open.cancelled', 'project');
        resolve();
        return;
      }
      const name = picked[0].webkitRelativePath.split('/')[0];
      const files = new Map(picked.map((file) => [file.webkitRelativePath.slice(name.length + 1), file]));
      void open({
        name, access: 'read',
        read: async (path) => files.get(path) ?? null,
        mount: async (path) => ({ path, files: await Promise.all([...files]
          .filter(([relative]) => relative.startsWith('.__ontobdc__/') || relative.startsWith('.__infobim__/'))
          .map(async ([relative, file]) => ({ path: relative, data: await file.arrayBuffer() }))) }),
      }).finally(resolve);
    }, { once: true });
    input.click();
  });

  const unsubscribe = [
    eventBus.subscribe('presentation.python.command.completed', ({ payload }) => {
      if (!payload) return;
      const call = pending.get(payload.requestId);
      pending.delete(payload.requestId);
      call?.resolve(payload);
    }),
    eventBus.subscribe('presentation.python.command.failed', ({ payload }) => {
      if (!payload) return;
      const call = pending.get(payload.requestId);
      pending.delete(payload.requestId);
      call?.reject(new Error(payload.message));
    }),
    eventBus.subscribe('presentation.project.state.requested', () => {
      eventBus.publish('presentation.project.state.reported', 'project', { project: currentProject });
    }),
    eventBus.subscribe('presentation.project.new.requested', ({ payload }) => {
      const name = payload?.name.trim();
      if (!name || busy) return;
      // Restrict the requested name to one new directory, never a parent or absolute path.
      if (name === '.' || name === '..' || /[/\\\x00]/.test(name)) return createFailed('create-failed', new Error('Use a single directory name without slashes.'));
      const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
      if (!picker) return createFailed('unsupported');
      busy = true;
      void create(picker.bind(window), name).finally(() => { busy = false; });
    }),
    eventBus.subscribe('presentation.project.open.requested', () => {
      if (busy) return;
      busy = true;
      const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
      void (picker ? chooseProject(picker.bind(window)) : chooseReadOnly()).finally(() => { busy = false; });
    }),
  ];

  return () => {
    disposed = true;
    unsubscribe.forEach((dispose) => dispose());
    pickerInputs.forEach((input) => input.remove());
    pickerInputs.clear();
    pending.forEach((call) => call.reject(new Error('The project adapter was stopped.')));
    pending.clear();
  };
}

function cliError(result: PythonCommandResult): string {
  const error = parseCliResponse<{ error?: string }>(result.stdout)?.content?.error;
  return error ? unwrapCliText(error) : result.stderr.trim() || `Command failed (exit ${result.code}).`;
}
