/** The states of setting up the entity facade. Only states worth going on from. */
export const SetUpEntityFacadeState = {
  UNDEFINED: 'undefined',
  ENTITY_PANEL_MOUNTED: 'entity_panel_mounted',
  ENTITY_FACADE_FOUND: 'entity_facade_found',
  ENTITY_LABELS_RESOLVED: 'entity_labels_resolved',
  ENTITY_HEADER_RESOLVED: 'entity_header_resolved',
  ENTITY_FIELDS_ORDERED: 'entity_fields_ordered',
  ENTITY_EDITABILITY_RESOLVED: 'entity_editability_resolved',
  ENTITY_RESOURCE_FIELDS_RESOLVED: 'entity_resource_fields_resolved',
  ENTITY_MASKS_RESOLVED: 'entity_masks_resolved',
  ENTITY_VISUALIZATIONS_RESOLVED: 'entity_visualizations_resolved',
  ENTITY_DELETABILITY_RESOLVED: 'entity_deletability_resolved',
  ENTITY_SUBCLASSES_RESOLVED: 'entity_subclasses_resolved',
} as const;

export type SetUpEntityFacadeStateValue =
  (typeof SetUpEntityFacadeState)[keyof typeof SetUpEntityFacadeState];
