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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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

// voxel-canvas: base plane(click receiver) + GridHelper + InstancedMesh + cursor preview を Group で
function buildVoxelCanvas(meshSpec) {
  const cs = meshSpec.cellSize ?? 0.5;
  const planeSize = meshSpec.planeSize ?? 6;
  const max = meshSpec.maxVoxels ?? 4096;

  const group = new THREE.Group();

  // base plane: 半透明、click receiver
  const planeGeom = new THREE.PlaneGeometry(planeSize, planeSize);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x445566, side: THREE.DoubleSide, transparent: true, opacity: 0.45,
  });
  const plane = new THREE.Mesh(planeGeom, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.001;
  plane.userData.voxelCanvasRole = 'plane';
  group.add(plane);

  // grid lines(視認用、raycast は plane 側で受ける)
  const grid = new THREE.GridHelper(planeSize, planeSize / cs, 0xaaccff, 0x556677);
  grid.userData.voxelCanvasRole = 'grid';
  grid.raycast = () => {};
  group.add(grid);

  // voxel InstancedMesh
  const vGeom = new THREE.BoxGeometry(cs, cs, cs);
  const vMat = new THREE.MeshStandardMaterial({ vertexColors: false });
  const inst = new THREE.InstancedMesh(vGeom, vMat, max);
  inst.count = 0;
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.userData.voxelCanvasRole = 'instance';
  group.add(inst);

  // cursor preview: 1 cell の edge だけを光らせる(fill 無し)
  const cursorEdgesGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(cs, cs, cs));
  const cursorMat = new THREE.LineBasicMaterial({
    color: 0xff8844, transparent: true, opacity: 0.95, depthTest: true,
  });
  const cursorMesh = new THREE.LineSegments(cursorEdgesGeom, cursorMat);
  cursorMesh.visible = false;
  cursorMesh.userData.voxelCanvasRole = 'cursor';
  cursorMesh.raycast = () => {};
  group.add(cursorMesh);


  // sync 状態用の cache
  group.userData.voxelInst = inst;
  group.userData.voxelCellSize = cs;
  group.userData.voxelMaxCount = max;
  group.userData.voxelLastSig = null;
  group.userData.voxelCursor = cursorMesh;
  group.userData.voxelCursorMat = cursorMat;

  return group;
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
  } else if (prefab.mesh.kind === 'voxel-canvas') {
    mesh = buildVoxelCanvas(prefab.mesh);
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
    const hit = pickAt(ev);
    canvas.style.cursor = hit ? 'pointer' : 'default';
    updateVoxelCursors(handles, hit);
  });
}

// hover 中の voxel-canvas に cursor preview を表示。snap 位置に置く + 色を state.currentColor 反映。
function updateVoxelCursors(handles, hit) {
  for (const h of handles) {
    if (h.id !== 'voxel-canvas') continue;
    const cursor = h.mesh.userData.voxelCursor;
    if (!cursor) continue;
    if (!hit || hit.handle !== h) {
      cursor.visible = false;
      continue;
    }
    // hit.point は world、prefab の挙動と同じ cell-center snap で local 配置に変換
    const cs = h.mesh.userData.voxelCellSize;
    const cx = Math.floor(hit.point.x / cs) * cs + cs / 2;
    const cy = Math.max(cs / 2, Math.floor(hit.point.y / cs) * cs + cs / 2);
    const cz = Math.floor(hit.point.z / cs) * cs + cs / 2;
    const gp = h.mesh.position;
    cursor.position.set(cx - gp.x, cy - gp.y, cz - gp.z);
    cursor.visible = true;
    // 色を state.currentColor に追従
    const s = h.getState();
    const hex = (s.currentColor ?? 'hex:ff8844').replace(/^hex:/, '#');
    h.mesh.userData.voxelCursorMat.color.set(hex);
  }
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
const { renderer, scene, camera } = createScene(canvas, {
  cameraPosition: [4, 4, 5],
  cameraLookAt: [0, 0.25, 0],
});
const hud = createHud(renderer);

// OrbitControls: 右ドラッグ=回転、中ドラッグ=パン、ホイール=ズーム、左クリックは voxel placement に残す
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.25, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.95;   // 真下まで行かせない(地面の裏に行かない)
controls.mouseButtons = {
  LEFT: null,                       // 左は voxel placement 用に解放
  MIDDLE: THREE.MOUSE.DOLLY,        // 中ドラッグ = ズーム
  RIGHT: THREE.MOUSE.ROTATE,        // 右ドラッグ = 回転
};
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.update();

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

// voxel-canvas: state.voxels(tagged dict)→ InstancedMesh 同期(boundary で parse)
const _voxelMatrix = new THREE.Matrix4();
const _voxelColor = new THREE.Color();
function syncVoxelInstances(group, state) {
  const inst = group.userData.voxelInst;
  if (!inst) return;
  const voxels = state.voxels ?? {};
  const keys = Object.keys(voxels);
  // signature で skip(無駄な GPU 更新避ける)
  const sig = keys.length + ':' + (keys[0] ?? '') + ':' + (keys[keys.length - 1] ?? '');
  if (sig === group.userData.voxelLastSig) return;
  group.userData.voxelLastSig = sig;

  const max = group.userData.voxelMaxCount;
  const count = Math.min(keys.length, max);
  inst.count = count;
  // group.position が world (-3, 0, 2) など、key は world coord、Three.js の InstancedMesh は parent 座標系(group local)で配置
  // group の world 位置を引いて instance の local position に
  const gp = group.position;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = requireDomain(keys[i], 'world');
    _voxelMatrix.makeTranslation(x - gp.x, y - gp.y, z - gp.z);
    inst.setMatrixAt(i, _voxelMatrix);
    const v = voxels[keys[i]];
    const hexStr = (v?.color ?? 'hex:ff8844').replace(/^hex:/, '#');
    _voxelColor.set(hexStr);
    if (inst.setColorAt) inst.setColorAt(i, _voxelColor);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
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
  const vc = handles.find(h => h.id === 'voxel-canvas');
  const vs = vc?.getState();
  const lines = [
    `frame: ${frameCount}`,
    vs ? `tool: ${vs.tool ?? 'add'}  color: ${vs.currentColor ?? '-'}` : '',
    vs ? `voxels: ${Object.keys(vs.voxels ?? {}).length}` : '',
    vs?.lastEditWorldPos ? `last: ${vs.lastEditWorldPos}` : '',
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
    } else if (h.id === 'voxel-canvas') {
      syncVoxelInstances(h.mesh, s);
    } else {
      h.mesh.rotation.y = (s.age ?? 0) * (s.rotSpeed ?? 0);
    }

    if (h.id !== 'voxel-canvas') {
      const baseScale = h.mesh.userData.baseScale ?? h.mesh.scale.x;
      h.mesh.userData.baseScale = baseScale;
      h.mesh.scale.setScalar(baseScale * (1 + (s.pulse ?? 0) * 0.3));
    }
  }

  controls.update();
  renderer.render(scene, camera);
  if (frameCount % 6 === 0) updateHud();
  hud.render();

  frameCount++;
  if (frameCount % 60 === 0) reportToAiEyes();
  requestAnimationFrame(tick);
}
tick();
