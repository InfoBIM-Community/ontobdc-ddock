

export type PanelResizePayload = {
  panel: string;
  dimension: 'width' | 'height';
  value: number;
  previousValue: number;
};

/** Identifies the tab removed from a Dockview container. */
export type PanelClosedPayload = {
  container: string;
  id: string;
  title: string | undefined;
};
