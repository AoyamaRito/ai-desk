// prefabLoader.js — name.asset.js を three.js Mesh 化、scene に add する境界 layer。
//
// 入力: prefab module(transform / mesh / state / transition を export)
// 出力: { mesh: THREE.Object3D, getState, dispatch(event) } の handle
//
// A10 境界の実装位置:
//  - asset.transform(world coord)→ mesh.position / rotation / scale に反映
//  - asset.mesh.* (local coord)→ THREE.Geometry に変換、Mesh の local space に住む
//  - asset.state(畳込み遷移)→ 内部 state、tick 時に transition で更新

import * as THREE from 'three';

const geometryFactories = {
  BoxGeometry:    (a) => new THREE.BoxGeometry(...a),
  SphereGeometry: (a) => new THREE.SphereGeometry(...a),
  PlaneGeometry:  (a) => new THREE.PlaneGeometry(...a),
  ConeGeometry:   (a) => new THREE.ConeGeometry(...a),
};

const materialFactories = {
  MeshNormalMaterial: (p) => new THREE.MeshNormalMaterial(p || {}),
  MeshBasicMaterial:  (p) => new THREE.MeshBasicMaterial(p || {}),
};

export function loadPrefab(asset, scene) {
  let mesh;
  if (asset.mesh.kind && geometryFactories[asset.mesh.kind]) {
    const geom = geometryFactories[asset.mesh.kind](asset.mesh.args || []);
    const matKind = asset.mesh.material?.kind || 'MeshNormalMaterial';
    const matFactory = materialFactories[matKind] || materialFactories.MeshNormalMaterial;
    const matParams = { ...asset.mesh.material };
    delete matParams.kind;
    const mat = matFactory(matParams);
    mesh = new THREE.Mesh(geom, mat);
  } else {
    throw new Error(`prefab "${asset.id}": unsupported mesh.kind "${asset.mesh.kind}"`);
  }

  // asset.transform(world coord)→ mesh の world placement
  applyTransform(mesh, asset.transform);
  mesh.userData = { prefabId: asset.id };
  scene.add(mesh);

  // mutable per-instance state
  let state = asset.state ?? {};

  return {
    mesh,
    getState: () => state,
    dispatch: (event) => {
      if (typeof asset.transition === 'function') {
        state = asset.transition(state, event);
      }
    },
    // 必要に応じて他 Block 共有用に world position を取り出す
    worldPosition: () => mesh.position.toArray(),
  };
}

function applyTransform(obj, t) {
  if (!t) return;
  if (t.position) obj.position.fromArray(t.position);
  if (t.rotation) obj.rotation.fromArray(t.rotation);
  if (t.scale != null) {
    if (typeof t.scale === 'number') obj.scale.setScalar(t.scale);
    else obj.scale.fromArray(t.scale);
  }
}
