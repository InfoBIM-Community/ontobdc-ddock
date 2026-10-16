/** The states of setting up the table of a group of the database. Only states worth going on from. */
export const SetUpGroupTableState = {
  UNDEFINED: 'undefined',
  TABLE_PANEL_MOUNTED: 'table_panel_mounted',
  TABLE_FACADE_FOUND: 'table_facade_found',
  TABLE_COLUMNS_ORDERED: 'table_columns_ordered',
  TABLE_LABELS_RESOLVED: 'table_labels_resolved',
  TABLE_RESOURCE_FIELDS_RESOLVED: 'table_resource_fields_resolved',
  TABLE_MASKS_RESOLVED: 'table_masks_resolved',
  TABLE_SUBCLASSES_RESOLVED: 'table_subclasses_resolved',
} as const;

export type SetUpGroupTableStateValue =
  (typeof SetUpGroupTableState)[keyof typeof SetUpGroupTableState];
