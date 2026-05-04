// input.js — input adapter(A10 境界実装)。
//
// A10 境界の本物の住人:
//  - DOM PointerEvent から screen coord を読むのは **この module のみ許可**(adapter 境界)
//  - 内部で NDC → ray → world hit に変換、prefab.dispatch には world coord のみ渡す
//  - prefab 側 / state / event payload には screen coord は侵入させない(Taboo 14)
//
// 関心の境界:
//  - canvas + camera + handles[] を受け取り、click を world coord event に翻訳
//  - prefab handle に dispatch({ kind:'click', worldPos:[x,y,z] }) を流す

import * as THREE from 'three';

// router(clickedHandle, worldPos) を渡せば inter-Block routing を委譲できる。
// 省略時は clickedHandle に直接 click event を dispatch するだけ。
export function setupInput(canvas, camera, handles, router = null) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pickAt(ev) {
    const rect = canvas.getBoundingClientRect();
    // NDC: x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    //      y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1)
    const xCss = ev.clientX - rect.left;
    const yCss = ev.clientY - rect.top;
    const ndcX = (xCss / rect.width) * 2 - 1;
    const ndcY = -((yCss / rect.height) * 2 - 1);
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);

    const meshes = handles.map(h => h.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;

    // 子孫まで含めて hit するので、prefab root に遡る
    let target = hits[0].object;
    while (target && !target.userData?.prefabId) {
      target = target.parent;
    }
    if (!target) return null;
    const handle = handles.find(h => h.mesh === target);
    if (!handle) return null;
    return { handle, point: hits[0].point };   // point は world Vector3
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const hit = pickAt(ev);
    if (!hit) return;
    const wp = hit.point.toArray();
    if (router) {
      router(hit.handle, wp);
    } else {
      hit.handle.dispatch({ kind: 'click', worldPos: wp });
    }
  });

  // hover 時のカーソル変化(視覚フィードバック、screen-coord は内部の adapter 操作のみ)
  canvas.addEventListener('pointermove', (ev) => {
    const hit = pickAt(ev);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });
}
