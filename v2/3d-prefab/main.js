// main.js — 3d-prefab demo の adapter 層 + entry。
//
// 単一 file に集約された adapter 群:
//   - createScene  : three.js renderer / camera / scene setup(world coord)
//   - loadPrefab   : prefab data → THREE.Object3D 境界(coord は coord.js で parse)
//   - setupInput   : pointer adapter(screen → world ray、A10 境界)
//   - createHud    : ortho camera HUD(OffscreenCanvas + CanvasTexture)
//   - 起動 + tick loop + ai-eyes 観測
//
// Block 層は prefabs.js(crystallize 整合)、Adapter 層がここ(Three.js / DOM)。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prefabs, makeTransition } from './prefabs.js';
import { requireDomain, parseCoord } from './coord.js';

// ============================================================
// scene setup
// ============================================================

function createScene(canvas, opts = {}) {
  const {
    background = 0x1a1a1a,
    fov = 50, near = 0.1, far = 1000,
    cameraPosition = [4, 3, 7],
    cameraLookAt = [0, 0, 0],
  } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  camera.position.fromArray(cameraPosition);
  camera.lookAt(...cameraLookAt);

  const onResize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  return { renderer, scene, camera };
}

// ============================================================
// prefab loader(boundary: tagged string → THREE.Object3D)
// ============================================================

const geometryFactories = {
  BoxGeometry:    (a) => new THREE.BoxGeometry(...a),
  SphereGeometry: (a) => new THREE.SphereGeometry(...a),
  PlaneGeometry:  (a) => new THREE.PlaneGeometry(...a),
  ConeGeometry:   (a) => new THREE.ConeGeometry(...a),
};
const materialFactories = {
  MeshNormalMaterial: (p) => new THREE.MeshNormalMaterial(p || {}),
  MeshBasicMaterial:  (p) => new THREE.MeshBasicMaterial(p || {}),
  MeshStandardMaterial: (p) => new THREE.MeshStandardMaterial(p || {}),
};
const _gltfLoader = new GLTFLoader();

async function probeExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch { return false; }
}

async function loadPrefab(prefab, scene) {
  if (prefab.disabled) return null;
  if (prefab.optional && prefab.mesh.kind === 'glb') {
    if (!(await probeExists(prefab.mesh.glbPath))) {
      console.info(`[prefab] "${prefab.id}": ${prefab.mesh.glbPath} not found, skipping`);
      return null;
    }
  }

  let mesh;
  if (prefab.mesh.kind === 'glb') {
    const gltf = await _gltfLoader.loadAsync(prefab.mesh.glbPath);
    mesh = gltf.scene;
    if (gltf.animations?.length) mesh.userData.animations = gltf.animations;
  } else if (geometryFactories[prefab.mesh.kind]) {
    const geom = geometryFactories[prefab.mesh.kind](prefab.mesh.args || []);
    const matKind = prefab.mesh.material?.kind || 'MeshNormalMaterial';
    const matFactory = materialFactories[matKind] || materialFactories.MeshNormalMaterial;
    const matParams = { ...prefab.mesh.material };
    delete matParams.kind;
    mesh = new THREE.Mesh(geom, matFactory(matParams));
  } else {
    throw new Error(`prefab "${prefab.id}": unsupported mesh.kind "${prefab.mesh.kind}"`);
  }

  // boundary: world-tagged string → THREE.Vector3
  const [px, py, pz] = requireDomain(prefab.transform.position, 'world');
  mesh.position.set(px, py, pz);
  if (prefab.transform.rotation) mesh.rotation.fromArray(prefab.transform.rotation);
  if (prefab.transform.scale != null) {
    if (typeof prefab.transform.scale === 'number') mesh.scale.setScalar(prefab.transform.scale);
    else mesh.scale.fromArray(prefab.transform.scale);
  }
  mesh.userData.prefabId = prefab.id;
  scene.add(mesh);

  let state = prefab.state ?? {};
  const transition = makeTransition(prefab);

  return {
    mesh,
    id: prefab.id,
    getState: () => state,
    dispatch: (event) => { state = transition(state, event); },
  };
}

// ============================================================
// input adapter(A10 境界: PointerEvent → world ray → tagged worldPos)
// ============================================================

function setupInput(canvas, camera, handles, router) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pickAt(ev) {
    const rect = canvas.getBoundingClientRect();
    const xCss = ev.clientX - rect.left;
    const yCss = ev.clientY - rect.top;
    ndc.set((xCss / rect.width) * 2 - 1, -((yCss / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(handles.map(h => h.mesh), true);
    if (!hits.length) return null;
    let target = hits[0].object;
    while (target && !target.userData?.prefabId) target = target.parent;
    if (!target) return null;
    const handle = handles.find(h => h.mesh === target);
    if (!handle) return null;
    return { handle, point: hits[0].point };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const hit = pickAt(ev);
    if (!hit) return;
    // world coord として A11 tagged で渡す
    const wp = `world:${hit.point.x},${hit.point.y},${hit.point.z}`;
    if (router) router(hit.handle, wp);
    else hit.handle.dispatch({ kind: 'click', worldPos: wp });
  });

  canvas.addEventListener('pointermove', (ev) => {
    canvas.style.cursor = pickAt(ev) ? 'pointer' : 'default';
  });
}

// ============================================================
// HUD layer(ortho camera world、OffscreenCanvas → CanvasTexture)
// ============================================================

function createHud(renderer) {
  const hudScene = new THREE.Scene();
  const hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  hudCamera.position.z = 1;

  const off = new OffscreenCanvas(512, 160);
  const ctx = off.getContext('2d');
  const tex = new THREE.CanvasTexture(off);
  tex.minFilter = THREE.LinearFilter;
  const geom = new THREE.PlaneGeometry(0.5, 0.16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const infoMesh = new THREE.Mesh(geom, mat);
  hudScene.add(infoMesh);

  const onResize = () => {
    const c = renderer.domElement;
    const aspect = c.clientWidth / c.clientHeight;
    hudCamera.left = -aspect;
    hudCamera.right = aspect;
    hudCamera.updateProjectionMatrix();
    infoMesh.position.set(aspect - 0.3, 0.85, 0);
  };
  window.addEventListener('resize', onResize);
  onResize();

  return {
    setInfo(lines) {
      ctx.clearRect(0, 0, 512, 160);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = '#ddd';
      ctx.font = '20px monospace';
      let y = 28;
      for (const ln of lines) { ctx.fillText(ln, 12, y); y += 26; }
      tex.needsUpdate = true;
    },
    render() {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(hudScene, hudCamera);
      renderer.autoClear = true;
    },
  };
}

// ============================================================
// 起動 + tick loop + ai-eyes 観測
// ============================================================

const canvas = document.getElementById('canvas');
const { renderer, scene, camera } = createScene(canvas);
const hud = createHud(renderer);

const handles = (await Promise.all(
  Object.values(prefabs).map(p => loadPrefab(p, scene).catch(err => {
    console.warn(`prefab "${p.id}" load failed:`, err.message);
    return null;
  }))
)).filter(Boolean);

function router(clicked, worldPos) {
  const sourceId = clicked.id;
  clicked.dispatch({ kind: 'click', worldPos });
  for (const h of handles) {
    if (h !== clicked) h.dispatch({ kind: 'peer-clicked', worldPos, sourceId });
  }
}
setupInput(canvas, camera, handles, router);

let frameCount = 0;

function reportToAiEyes() {
  if (typeof window.aiEyes?.sendStructure !== 'function') return;
  const snapshot = handles.map(h => ({
    id: h.id,
    worldPos: `world:${h.mesh.position.x.toFixed(3)},${h.mesh.position.y.toFixed(3)},${h.mesh.position.z.toFixed(3)}`,
    state: pickReportable(h.getState()),
  }));
  window.aiEyes.sendStructure({ kind: 'prefab-state', frame: frameCount, prefabs: snapshot });
}

function pickReportable(s) {
  const out = {};
  for (const k of Object.keys(s)) {
    const v = s[k];
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
      out[k] = typeof v === 'number' ? +v.toFixed(3) : v;
    }
  }
  return out;
}

function updateHud() {
  const ptr = handles.find(h => h.id === 'pointer');
  const ps = ptr?.getState();
  const lines = [
    `frame: ${frameCount}`,
    `prefabs: ${handles.length}`,
    `last click: ${ps?.lastSourceId ?? '(none)'}`,
    ps?.targetWorldPos ?? '',
  ].filter(Boolean);
  hud.setInfo(lines);
}

function tick() {
  for (const h of handles) {
    h.dispatch({ kind: 'tick' });
    const s = h.getState();

    if (h.id === 'pointer' && s.currentWorldPos) {
      const [x, y, z] = requireDomain(s.currentWorldPos, 'world');
      h.mesh.position.set(x, y, z);
    } else {
      h.mesh.rotation.y = (s.age ?? 0) * (s.rotSpeed ?? 0);
    }

    const baseScale = h.mesh.userData.baseScale ?? h.mesh.scale.x;
    h.mesh.userData.baseScale = baseScale;
    h.mesh.scale.setScalar(baseScale * (1 + (s.pulse ?? 0) * 0.3));
  }

  renderer.render(scene, camera);
  if (frameCount % 6 === 0) updateHud();
  hud.render();

  frameCount++;
  if (frameCount % 60 === 0) reportToAiEyes();
  requestAnimationFrame(tick);
}
tick();
