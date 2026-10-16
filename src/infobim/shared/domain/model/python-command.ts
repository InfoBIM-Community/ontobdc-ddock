/** A directory mounted at its registered location in the worker filesystem. */
export type PythonMount = {
  path: string;
  handle?: FileSystemDirectoryHandle;
  /** Read-only fallback: metadata copied into memory, never written back. */
  files?: { path: string; data: ArrayBuffer }[];
};

export type PythonCommandRequest = {
  requestId: string;
  argv: string[];
  mount: PythonMount;
};

export type PythonCommandResult = {
  requestId: string;
  code: number;
  stdout: string;
  stderr: string;
};

/** A presentation device/environment pair, as the feature ontology names them. */
export type PythonFeatureDevice = 'Desktop' | 'Mobile';
export type PythonFeatureEnvironment = 'Browser' | 'NativeApp';

/**
 * Asks the ontology for the first message of the conversation `identifier`
 * triggers, for the given device, runtime environment and language. Needs
 * no project mount: it reads only brasidatacenter's own feature ontology.
 */
export type PythonFeatureMessageRequest = {
  requestId: string;
  identifier: string;
  device: PythonFeatureDevice;
  environment: PythonFeatureEnvironment;
  language: string;
  /** Placeholder values to fill the message template with (e.g. project name). */
  parameters?: Record<string, string>;
};

export type PythonFeatureMessageResult = {
  requestId: string;
  /** `null` when the event, or this device/environment/language, has no message. */
  text: string | null;
};

/**
 * Asks the runtime which version of each package is installed in it. Needs no
 * project mount: it asks the installer of the runtime (micropip) what it holds.
 */
export type PythonPackageVersionsRequest = {
  requestId: string;
  /** Names of the packages, as they are installed (`ontobdc`). */
  packages: string[];
};

export type PythonPackageVersionsResult = {
  requestId: string;
  /** The installed version of each package asked for; `null` for one that is not installed. */
  versions: Record<string, string | null>;
};
