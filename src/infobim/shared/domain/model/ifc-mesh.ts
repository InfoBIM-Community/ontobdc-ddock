/** One placed piece of geometry, ready for three.js (buffers are transferred, not copied). */
export type IfcMeshData = {
  expressID: number;
  /** Interleaved x, y, z, nx, ny, nz. */
  vertices: Float32Array;
  indices: Uint32Array;
  /** Column-major 4×4 placement, as three.js `Matrix4.fromArray` reads it. */
  matrix: number[];
  /** r, g, b, a in 0..1. */
  color: [number, number, number, number];
};

/** What the IFC says about one element: the table the 3D view keeps to answer a click. */
export type IfcElementInfo = {
  expressID: number;
  globalId: string;
  /** The IFC class, such as `IfcWall`. */
  type: string;
  name: string;
};

export type IfcConvertRequest = { id: number; bytes: ArrayBuffer };

export type IfcConvertResponse =
  | { id: number; meshes: IfcMeshData[]; elements: IfcElementInfo[] }
  | { id: number; error: string };
