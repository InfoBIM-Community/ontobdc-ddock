/** The states of selecting an element in the 3D view of an IFC tab. Only states worth going on from. */
export const IfcElementSelectionState = {
  UNDEFINED: 'undefined',
  IFC_VIEW_FOUND: 'ifc_view_found',
  IFC_MESH_PICKED: 'ifc_mesh_picked',
  IFC_ELEMENT_IDENTIFIED: 'ifc_element_identified',
  IFC_ELEMENT_HIGHLIGHTED: 'ifc_element_highlighted',
  IFC_ELEMENT_SELECTED: 'ifc_element_selected',
} as const;

export type IfcElementSelectionStateValue =
  (typeof IfcElementSelectionState)[keyof typeof IfcElementSelectionState];
