/** The states of a connection to a remote project. Only states worth going on from. */
export const RemoteProjectConnectionState = {
  UNDEFINED: 'undefined',
  ACCESS_TOKEN_RECOVERED: 'access_token_recovered',
  TEMPORARY_FOLDER_AVAILABLE: 'temporary_folder_available',
  CONTEXT_INITIALIZED: 'context_initialized',
  CONTEXT_PARAMETERS_SET: 'context_parameters_set',
  REMOTE_PROJECT_CONNECTED: 'remote_project_connected',
  ACCESS_TOKEN_REMEMBERED: 'access_token_remembered',
} as const;

export type RemoteProjectConnectionStateValue =
  (typeof RemoteProjectConnectionState)[keyof typeof RemoteProjectConnectionState];
