import {
  Box3,
  Raycaster,
  MeshLambertMaterial,
  Vector2,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Group,
  type Material,
  type Mesh,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IfcViewPoint, IfcViewPort } from '@/infobim/shared/domain/model/ifc-view';
import type { IfcElementInfo } from '@/infobim/shared/domain/model/ifc-mesh';
import { loadIfcModel } from './ifc-geometry';
import { getTheme, onThemeChange } from '@/infobim/shared/adapter/theme';

/** One IFC model in a 3D view. */
export type ModelHandle = { meshes: number; setVisible(show: boolean): void };

/** The mouse may move this far (in pixels) between pressing and releasing and still be a click, not a drag. */
const CLICK_TOLERANCE_PX = 4;
const HIGHLIGHT_COLOR = 0xffb000;

export type ModelViewOptions = {
  /** Called when the user clicks in the view (a press and release without dragging). */
  onClick?: (point: IfcViewPoint) => void;
};

export type ModelView = IfcViewPort & {
  /** Converts an IFC file and adds it to the scene, shown. */
  add(bytes: Uint8Array): Promise<ModelHandle>;
  dispose(): void;
};

function disposeGroup(group: Group): void {
  const materials = new Set<Material>();
  group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material as Material);
  });
  materials.forEach((material) => material.dispose());
}

/**
 * A three.js scene in `container` that holds any number of IFC models: lights,
 * orbit controls (left drag orbits, right drag pans, wheel zooms) and, once the
 * first model arrives, a grid under it and the camera framing it. Every model
 * keeps the coordinates web-ifc gives it (the IFC's own, not re-centred), so
 * models of the same project line up. Frames are drawn only on change.
 * This module (three.js + web-ifc) is loaded on demand, the first time a model opens.
 */
export function createModelView(container: HTMLElement, options: ModelViewOptions = {}): ModelView {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x444444, 2.2));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 2, 1.5);
  scene.add(sun);

  const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const clearColor = getTheme() === 'light' ? 0xf5f5f5 : 0x1e1e1e;
  renderer.setClearColor(clearColor);
  renderer.domElement.className = 'ifc-viewer-canvas';
  container.appendChild(renderer.domElement);

  const render = (): void => renderer.render(scene, camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', render);

  const models = new Set<Group>();
  const elements = new Map<number, IfcElementInfo>();
  const highlightMaterial = new MeshLambertMaterial({ color: HIGHLIGHT_COLOR, emissive: HIGHLIGHT_COLOR, emissiveIntensity: 0.35 });
  const raycaster = new Raycaster();
  /** The meshes of the highlighted element, with the material each one had. */
  let highlighted: Array<{ mesh: Mesh; material: Material | Material[] }> = [];
  let framed = false;
  let disposed = false;

  const frame = (model: Group): void => {
    const box = new Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3()).length() || 1;
    const center = box.getCenter(new Vector3());
    camera.near = size / 1000;
    camera.far = size * 100;
    camera.updateProjectionMatrix();
    camera.position.copy(center).add(new Vector3(1, 0.8, 1).normalize().multiplyScalar(size * 1.2));
    controls.target.copy(center);
    controls.update();
    const isLight = getTheme() === 'light';
    const gridColor = isLight ? 0xcccccc : 0x3a3a3a;
    const gridColorSecondary = isLight ? 0xdddddd : 0x2a2a2a;
    const grid = new GridHelper(size * 2, 20, gridColor, gridColorSecondary);
    grid.position.set(center.x, box.min.y, center.z);
    scene.add(grid);
    framed = true;
  };

  // A click is a press and release in the same place; moving between them is the camera being dragged.
  let pressed: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent): void => {
    pressed = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event: PointerEvent): void => {
    const start = pressed;
    pressed = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_TOLERANCE_PX) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    options.onClick?.({
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    });
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  const clearHighlight = (): void => {
    for (const { mesh, material } of highlighted) mesh.material = material;
    highlighted = [];
  };

  const resize = (): void => {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const unsubscribeTheme = onThemeChange((theme) => {
    renderer.setClearColor(theme === 'light' ? 0xf5f5f5 : 0x1e1e1e);
    render();
  });

  return {
    pick: (point) => {
      raycaster.setFromCamera(new Vector2(point.x, point.y), camera);
      const meshes = [...models].filter((model) => model.visible).flatMap((model) => model.children);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      const expressID = hit?.object.userData.expressID;
      return typeof expressID === 'number' ? expressID : null;
    },
    describe: (expressID) => elements.get(expressID),
    highlight: (expressID) => {
      clearHighlight();
      if (expressID !== null) {
        for (const model of models) {
          for (const child of model.children) {
            const mesh = child as Mesh;
            if (mesh.userData.expressID !== expressID) continue;
            highlighted.push({ mesh, material: mesh.material });
            mesh.material = highlightMaterial;
          }
        }
      }
      render();
    },
    add: async (bytes) => {
      const { group: model, elements: table } = await loadIfcModel(bytes);
      for (const element of table) elements.set(element.expressID, element);
      if (disposed) {
        disposeGroup(model);
        throw new Error('The view was closed.');
      }
      models.add(model);
      scene.add(model);
      // Only the first model frames the view; later ones must not move the camera.
      if (!framed) frame(model);
      render();
      return {
        meshes: model.children.length,
        setVisible: (show) => {
          model.visible = show;
          render();
        },
      };
    },
    dispose: () => {
      disposed = true;
      clearHighlight();
      highlightMaterial.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      resizeObserver.disconnect();
      unsubscribeTheme();
      controls.dispose();
      models.forEach(disposeGroup);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
