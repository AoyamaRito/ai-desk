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
import { prefabs, transitionForEvent } from './prefabs.js';
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

  // floor 上下シフト用の handle(円錐、world で住む UI、A10 整合)
  const halfP = planeSize / 2;
  const cornerX = halfP - 0.3;
  const cornerZ = -halfP + 0.3;

  const handleUp = makeFloorHandle('floor-up', 0x44ff66, +1);
  handleUp.position.set(cornerX, 0.55, cornerZ);
  group.add(handleUp);

  const handleDown = makeFloorHandle('floor-down', 0xff4466, -1);
  handleDown.position.set(cornerX, 0.15, cornerZ);
  group.add(handleDown);

  // 色 swatch(8 色のかわいい palette、plane の手前外側に並べる)
  // 世界 y = 0.5 固定(floor とは独立、UI として常時アクセス可)
  const cuteColors = [
    0xffb6c1,  // light pink
    0xc8a2c8,  // lilac
    0x98d8c8,  // mint
    0xffd7be,  // peach
    0x87ceeb,  // sky blue
    0xfff3a3,  // butter
    0xff8c8c,  // coral
    0xb8a9ff,  // periwinkle
  ];
  const swatchY = 0.45;
  const swatchZ = halfP + 0.4;
  const swatchSpacing = 0.4;
  const swatchStartX = -((cuteColors.length - 1) * swatchSpacing) / 2;
  for (let i = 0; i < cuteColors.length; i++) {
    const c = cuteColors[i];
    const sw = makeColorSwatch(c);
    sw.position.set(swatchStartX + i * swatchSpacing, swatchY, swatchZ);
    group.add(sw);
  }


  // sync 状態用の cache
  group.userData.voxelInst = inst;
  group.userData.voxelCellSize = cs;
  group.userData.voxelMaxCount = max;
  group.userData.voxelLastSig = null;
  group.userData.voxelCursor = cursorMesh;
  group.userData.voxelCursorMat = cursorMat;
  group.userData.voxelPlane = plane;          // floor を shift する時に位置同期する対象
  group.userData.voxelGrid = grid;            // 同上
  group.userData.voxelHandleUp = handleUp;
  group.userData.voxelHandleDown = handleDown;

  return group;
}

// floor 上下 handle(円錐 mesh、role を userData に埋めて pickAt 経由で識別)
function makeFloorHandle(role, color, dirY) {
  const geom = new THREE.ConeGeometry(0.18, 0.32, 16);
  if (dirY < 0) geom.rotateX(Math.PI);   // 下向きに反転
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.handleRole = role;
  return mesh;
}

// color swatch(現在色を選ぶ UI、click で 'set-color' event 発火)
function makeColorSwatch(colorInt) {
  const geom = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const mat = new THREE.MeshStandardMaterial({ color: colorInt, roughness: 0.5 });
  const mesh = new THREE.Mesh(geom, mat);
  const hex = 'hex:' + colorInt.toString(16).padStart(6, '0');
  mesh.userData.handleRole = 'color-pick';
  mesh.userData.handleColor = hex;
  return mesh;
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
  // Shadow_for_Flow + frame deltas(heartbeat が frame 単位で setup / commit)
  let shadowForFlow = state;
  let frameMerged = null;     // null なら frame 内変化なし

  return {
    mesh,
    id: prefab.id,
    prefab,
    getState: () => state,
    // heartbeat が frame 頭で呼ぶ: REAL → 凍結 shadow を作る
    beginFrame: () => {
      shadowForFlow = Object.freeze({ ...state });
      frameMerged = null;
    },
    // dispatch は shadow を読んで delta を frameMerged に accumulate
    // 同 frame 内の 2 回目以降 dispatch も同 shadow を読む(順序非依存 across events)
    dispatch: (event) => {
      const t = transitionForEvent(prefab, event);
      const next = t(shadowForFlow, event);
      if (next === shadowForFlow) return;   // 変化なし
      if (frameMerged === null) frameMerged = { ...shadowForFlow };
      for (const k of Object.keys(next)) {
        if (next[k] !== shadowForFlow[k]) {
          frameMerged[k] = next[k];
        }
      }
    },
    // heartbeat が frame 末に呼ぶ: 累積 delta を REAL に commit
    endFrame: () => {
      if (frameMerged !== null) state = frameMerged;
    },
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
    const raw = hits[0].object;   // handleRole 検出のため保持
    let target = raw;
    while (target && !target.userData?.prefabId) target = target.parent;
    if (!target) return null;
    const handle = handles.find(h => h.mesh === target);
    if (!handle) return null;
    return { handle, point: hits[0].point, raw };
  }

  // raw 起点で handleRole を上方向に探す(floor-up / floor-down 等の UI handle 識別)
  function findHandleRole(raw, prefabRootMesh) {
    let h = raw;
    while (h && h !== prefabRootMesh) {
      if (h.userData?.handleRole) return h.userData.handleRole;
      h = h.parent;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const hit = pickAt(ev);
    if (!hit) return;
    // floor handle 識別: ヒットしてたら floor-shift event を queue に流して終了
    const role = findHandleRole(hit.raw, hit.handle.mesh);
    if (role === 'floor-up') {
      pushEvent({ kind: 'floor-shift', targetId: hit.handle.id, delta: +1 });
      return;
    }
    if (role === 'floor-down') {
      pushEvent({ kind: 'floor-shift', targetId: hit.handle.id, delta: -1 });
      return;
    }
    if (role === 'color-pick') {
      // raw mesh から userData.handleColor を取り出して set-color event 発火
      let walk = hit.raw;
      while (walk && !walk.userData?.handleColor) walk = walk.parent;
      const color = walk?.userData?.handleColor;
      if (color) pushEvent({ kind: 'set-color', targetId: hit.handle.id, color });
      return;
    }
    // それ以外 → 通常の click(voxel 配置等)、world coord は A11 tagged で
    const wp = `world:${hit.point.x},${hit.point.y},${hit.point.z}`;
    if (router) router(hit.handle, wp);
    else hit.handle.dispatch({ kind: 'click', worldPos: wp });
  });

  canvas.addEventListener('pointermove', (ev) => {
    const hit = pickAt(ev);
    canvas.style.cursor = hit ? 'pointer' : 'default';
    updateVoxelCursors(handles, hit);
  });

  // キーボード: voxel canvas の floor を上下シフト([ / ] / PageUp / PageDown)
  // adapter 境界 — DOM KeyboardEvent を world tagged event に翻訳して queue に流す
  window.addEventListener('keydown', (ev) => {
    let delta = 0;
    if (ev.key === 'PageUp' || ev.key === ']') delta = +1;
    else if (ev.key === 'PageDown' || ev.key === '[') delta = -1;
    if (!delta) return;
    // voxel canvas に floor-shift event を発火
    for (const h of handles) {
      if (h.id === 'voxel-canvas') {
        pushEvent({ kind: 'floor-shift', targetId: h.id, delta });
      }
    }
    ev.preventDefault();
  });
}

// hover 中の voxel-canvas に cursor preview を表示。snap 位置に置く + 色を state.currentColor 反映。
// floor handle hover 時は cursor を隠す(handle と voxel preview が重なって紛らわしいため)。
function updateVoxelCursors(handles, hit) {
  for (const h of handles) {
    if (h.id !== 'voxel-canvas') continue;
    const cursor = h.mesh.userData.voxelCursor;
    if (!cursor) continue;
    // hit が handle なら cursor を隠す
    let isHandle = false;
    if (hit?.raw) {
      let walk = hit.raw;
      while (walk && walk !== h.mesh) {
        if (walk.userData?.handleRole) { isHandle = true; break; }
        walk = walk.parent;
      }
    }
    if (!hit || hit.handle !== h || isHandle) {
      cursor.visible = false;
      continue;
    }
    // hit.point は world、prefab の挙動と同じ floor-aware cell-center snap で local 配置に変換
    const cs = h.mesh.userData.voxelCellSize;
    const s = h.getState();
    const floor = s.floorIndex ?? 0;
    const minCy = floor * cs + cs / 2;
    const cx = Math.floor(hit.point.x / cs) * cs + cs / 2;
    const cy = Math.max(minCy, Math.floor(hit.point.y / cs) * cs + cs / 2);
    const cz = Math.floor(hit.point.z / cs) * cs + cs / 2;
    const gp = h.mesh.position;
    cursor.position.set(cx - gp.x, cy - gp.y, cz - gp.z);
    cursor.visible = true;
    // 色を state.currentColor に追従(s は上で取得済み)
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
  cameraPosition: [2.5, 2.5, 3.2],
  cameraLookAt: [0, 0.25, 0],
});
const hud = createHud(renderer);

// OrbitControls: 右ドラッグ=回転、中ドラッグ=パン、ホイール=ズーム、左クリックは voxel placement に残す
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.25, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 20;
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

// ============================================================
// heartbeat — Single Time Pump(全 mutation はここを通る)
// ============================================================
//
// 構造:
//   eventQueue     : FIFO 外部 event(click / async resolve)、heartbeat 内で drain
//   scheduledQueue : { ...event, fireAt } 配列、fireAt 昇順、drain 条件 fireAt <= currentTick
//   currentTick    : 単調増加 frame index、heartbeat 1 回ごとに +1
//
// flow ベース dispatch(prefab.flow.<event.kind> を引いて behavior 列を順次適用)。

let currentTick = 0;
const eventQueue = [];
const scheduledQueue = [];

export function pushEvent(event) {
  eventQueue.push(event);
}

export function schedule(event, fireAt) {
  scheduledQueue.push({ ...event, fireAt });
  scheduledQueue.sort((a, b) => a.fireAt - b.fireAt);
}

function routeEvent(ev) {
  // event に targetId が指定されてれば該当 handle、無ければ全 handle に流す
  if (ev.targetId) {
    const target = handles.find(h => h.id === ev.targetId);
    if (target) target.dispatch(ev);
  } else {
    for (const h of handles) h.dispatch(ev);
  }
  // click は他 handle に peer-clicked を broadcast(inter-Block 通信)
  if (ev.kind === 'click' && ev.targetId) {
    for (const h of handles) {
      if (h.id === ev.targetId) continue;
      h.dispatch({ kind: 'peer-clicked', worldPos: ev.worldPos, sourceId: ev.targetId });
    }
  }
}

setupInput(canvas, camera, handles, (clickedHandle, worldPos) => {
  // heartbeat 経由で次 tick で処理
  pushEvent({ kind: 'click', targetId: clickedHandle.id, worldPos });
});

function reportToAiEyes() {
  if (typeof window.aiEyes?.sendStructure !== 'function') return;
  const snapshot = handles.map(h => ({
    id: h.id,
    worldPos: `world:${h.mesh.position.x.toFixed(3)},${h.mesh.position.y.toFixed(3)},${h.mesh.position.z.toFixed(3)}`,
    state: pickReportable(h.getState()),
  }));
  window.aiEyes.sendStructure({ kind: 'prefab-state', tick: currentTick, prefabs: snapshot });
}

// voxel-canvas: state.floorIndex を plane / grid / handles の世界 y に反映
function syncVoxelFloor(group, state) {
  const cs = group.userData.voxelCellSize;
  const floor = state.floorIndex ?? 0;
  const targetY = floor * cs;
  const plane = group.userData.voxelPlane;
  const grid = group.userData.voxelGrid;
  const hUp = group.userData.voxelHandleUp;
  const hDown = group.userData.voxelHandleDown;
  if (plane) plane.position.y = targetY - 0.001;   // grid との z-fighting 回避
  if (grid)  grid.position.y  = targetY;
  if (hUp)   hUp.position.y   = targetY + 0.55;
  if (hDown) hDown.position.y = targetY + 0.15;
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
    `tick: ${currentTick}`,
    vs ? `tool: ${vs.tool ?? 'add'}  color: ${vs.currentColor ?? '-'}` : '',
    vs ? `floor: ${vs.floorIndex ?? 0}  ([ / ] or PageUp/Down)` : '',
    vs ? `voxels: ${Object.keys(vs.voxels ?? {}).length}` : '',
    vs?.lastEditWorldPos ? `last: ${vs.lastEditWorldPos}` : '',
  ].filter(Boolean);
  hud.setInfo(lines);
}

function heartbeat() {
  currentTick++;

  // 0. Frame begin: 全 handle の REAL state を Shadow_for_Flow に snapshot(凍結)。
  //    frame 中の全 dispatch はこの shadow を読む = 順序非依存 across events。
  for (const h of handles) h.beginFrame();

  // 1. scheduled queue から fireAt <= currentTick の event を eventQueue に流す
  while (scheduledQueue.length && scheduledQueue[0].fireAt <= currentTick) {
    eventQueue.push(scheduledQueue.shift());
  }

  // 2. eventQueue を drain(順次 routeEvent、peer-clicked broadcast 含む)
  while (eventQueue.length) {
    routeEvent(eventQueue.shift());
  }

  // 3. 全 handle に tick event 発火
  for (const h of handles) {
    h.dispatch({ kind: 'tick', tick: currentTick });
  }

  // 3.5 Frame end: 累積 delta を REAL に commit
  for (const h of handles) h.endFrame();

  // 4. adapter 副作用(mesh の位置 / 回転 / scale を state から反映)
  for (const h of handles) {
    const s = h.getState();
    if (h.id === 'pointer' && s.currentWorldPos) {
      const [x, y, z] = requireDomain(s.currentWorldPos, 'world');
      h.mesh.position.set(x, y, z);
    } else if (h.id === 'voxel-canvas') {
      syncVoxelInstances(h.mesh, s);
      syncVoxelFloor(h.mesh, s);
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
  if (currentTick % 6 === 0) updateHud();
  hud.render();

  if (currentTick % 60 === 0) reportToAiEyes();
  requestAnimationFrame(heartbeat);
}
heartbeat();
