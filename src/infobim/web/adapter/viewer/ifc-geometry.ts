import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
} from 'three';
import type { IfcConvertResponse, IfcElementInfo, IfcMeshData } from '@/infobim/shared/domain/model/ifc-mesh';

/** Meshes built per slice on the UI thread before yielding, so building a large model does not freeze it. */
const MESHES_PER_SLICE = 500;
const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Converted = { meshes: IfcMeshData[]; elements: IfcElementInfo[] };
type Pending = { resolve: (converted: Converted) => void; reject: (error: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

/** If the worker dies, pending conversions fail (no endless loading) and the next one starts a fresh worker. */
function discardWorker(reason: string): void {
  worker?.terminate();
  worker = null;
  for (const call of pending.values()) call.reject(new Error(reason));
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./ifc-worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = (event) => {
    event.preventDefault();
    discardWorker(event.message || 'The IFC worker failed.');
  };
  worker.onmessageerror = () => discardWorker('The IFC worker sent an unreadable message.');
  worker.onmessage = ({ data }: MessageEvent<IfcConvertResponse>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if ('error' in data) call.reject(new Error(data.error));
    else call.resolve({ meshes: data.meshes, elements: data.elements });
  };
  return worker;
}

/** Converts the IFC file in the IFC worker; the file's buffer is transferred to it. */
function convertInWorker(bytes: Uint8Array): Promise<Converted> {
  const id = nextId++;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, bytes: buffer }, [buffer]);
  });
}

/**
 * Converts an IFC file into a three.js group: one mesh per placed geometry,
 * already transformed (web-ifc places geometry Y-up, as three.js expects) and
 * coloured by the IFC surface styles. The conversion runs in a Web Worker;
 * only the three.js objects are built on the UI thread, in slices.
 */
export async function loadIfcModel(bytes: Uint8Array): Promise<{ group: Group; elements: IfcElementInfo[] }> {
  const { meshes, elements } = await convertInWorker(bytes);
  const group = new Group();
  const materials = new Map<string, MeshLambertMaterial>();
  for (const [index, data] of meshes.entries()) {
    if (index > 0 && index % MESHES_PER_SLICE === 0) await yieldToUi();
    const interleaved = new InterleavedBuffer(data.vertices, 6);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3));
    geometry.setIndex(new BufferAttribute(data.indices, 1));

    const [r, g, b, a] = data.color;
    const key = data.color.join(',');
    let material = materials.get(key);
    if (!material) {
      material = new MeshLambertMaterial({ color: new Color(r, g, b), transparent: a < 1, opacity: a, side: DoubleSide });
      materials.set(key, material);
    }

    const mesh = new Mesh(geometry, material);
    mesh.applyMatrix4(new Matrix4().fromArray(data.matrix));
    mesh.userData.expressID = data.expressID;
    group.add(mesh);
  }
  return { group, elements };
}
