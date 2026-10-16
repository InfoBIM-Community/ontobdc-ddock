import type {
  PythonCommandRequest,
  PythonCommandResult,
  PythonFeatureMessageRequest,
  PythonFeatureMessageResult,
  PythonPackageVersionsRequest,
  PythonPackageVersionsResult,
} from './python-command';

/** Internal transport messages. Application modules communicate through events. */
export type PythonWorkerRequest =
  | { type: 'start' }
  | ({ type: 'run' } & PythonCommandRequest)
  | ({ type: 'feature-message' } & PythonFeatureMessageRequest)
  | ({ type: 'package-versions' } & PythonPackageVersionsRequest);

export type PythonWorkerResponse =
  | { type: 'ready'; infobimVersion: string }
  | { type: 'failed'; message: string }
  | ({ type: 'result' } & PythonCommandResult)
  | ({ type: 'feature-message-result' } & PythonFeatureMessageResult)
  | ({ type: 'package-versions-result' } & PythonPackageVersionsResult)
  | { type: 'command-failed'; requestId: string; message: string };
