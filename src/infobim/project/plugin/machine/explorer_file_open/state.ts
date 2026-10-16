/** The states of opening a file selected in the explorer. Only states worth going on from. */
export const ExplorerFileOpenState = {
  UNDEFINED: 'undefined',
  FILE_METADATA_EXTRACTED: 'file_metadata_extracted',
  FILE_OPENING_STRATEGY_FOUND: 'file_opening_strategy_found',
} as const;

export type ExplorerFileOpenStateValue =
  (typeof ExplorerFileOpenState)[keyof typeof ExplorerFileOpenState];
