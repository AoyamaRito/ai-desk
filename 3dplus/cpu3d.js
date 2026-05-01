// [ai_s_emblem:#high#verify Cpu3D-Projection]
// L4 Twin (Bible §4.5): GPU描画層と並走する検証双子。純粋関数のみ。
//   DOM/WebGL/Canvas/物理エンジン/I/O/乱数/時刻に依存しない。
// 複式数学（Bible §7）の Twin 実装。GPU出力と突合してロジックバグを断定する装置。
// 3Dplus（Bible §4）に従い、空間(x,y,z)・時間(t)・透明度(α)・生存(visibility)を同じ投影パイプラインに乗せる。
//
// @effective: ../my_webgl/render.js (and any WebGL/Three.js renderer)
// @twin:      this file
//
// 走らせ方:
//   node 3dplus/cpu3d.js                          # 自己診断デモ
//   const { projectScene } = require('./cpu3d.js');

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cpu3D = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ===== 行列基礎 (column-major 4x4, flat 16要素) =====
  // WebGLと同じ規約。列優先で格納し、ベクトルは列ベクトルとして m * v で変換する。

  function multiply(a, b) {
    const out = new Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[r + k * 4] * b[k + c * 4];
        out[r + c * 4] = s;
      }
    }
    return out;
  }

  function translation(x, y, z) {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
  }
  function rotationX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
  }
  function rotationY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  }
  function rotationZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
  }
  function scaleM(sx, sy, sz) {
    return [sx,0,0,0, 0,sy,0,0, 0,0,sz,0, 0,0,0,1];
  }

  // M = T * Rz * Ry * Rx * S （適用順は S → Rx → Ry → Rz → T）
  function buildModelMatrix(t) {
    return multiply(
      translation(t.position[0], t.position[1], t.position[2]),
      multiply(
        rotationZ(t.rotation[2]),
        multiply(
          rotationY(t.rotation[1]),
          multiply(
            rotationX(t.rotation[0]),
            scaleM(t.scale[0], t.scale[1], t.scale[2])
          )
        )
      )
    );
  }

  // View行列はカメラのワールド変換の逆行列。R^T * T(-pos) と等価で、
  // 軸ごとに「角度の符号反転 + 順序反転」で組み立てれば逆になる。
  function buildViewMatrix(cam) {
    return multiply(
      rotationX(-cam.rotation[0]),
      multiply(
        rotationY(-cam.rotation[1]),
        multiply(
          rotationZ(-cam.rotation[2]),
          translation(-cam.position[0], -cam.position[1], -cam.position[2])
        )
      )
    );
  }

  // 透視投影行列（OpenGL右手系・Z=-1〜+1のNDC）。WebGLと同じ規約で、
  // GPU側がglMatrix/gl-matrix-perspectiveを使った場合と数値一致する。
  function buildPerspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  }

  function transformVec4(m, v) {
    const out = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) {
      out[r] = m[r] * v[0] + m[r + 4] * v[1] + m[r + 8] * v[2] + m[r + 12] * v[3];
    }
    return out;
  }

  // ===== メイン: projectScene =====
  // 入力 scene:
  //   {
  //     objects: [
  //       {
  //         id: 'cube',
  //         vertices: [[x,y,z], ...],            // ローカル座標
  //         transform: { position, rotation, scale },  // 各 [x,y,z]
  //         parent: null | 'parentId' | parentIndex,
  //         time?:    { offset: 0 },              // 親時刻 + offset
  //         alpha?:   1.0,                        // 親α × self
  //         visible?: true                        // 親 AND self
  //       }
  //     ],
  //     camera: { position, rotation, fov, aspect, near, far },
  //     viewport: { width, height },
  //     worldTime?: 0
  //   }
  //
  // 出力 result:
  //   {
  //     objects: [
  //       {
  //         id, worldMatrix,
  //         vertices: [{ local, world, view, clip, ndc, screen, inFrustum }],
  //         effective: { time, alpha, visible }
  //       }
  //     ]
  //   }
  function projectScene(scene) {
    const N = scene.objects.length;

    // (1) ローカル変換行列を全オブジェクトについて先に作る
    const local = scene.objects.map(o => buildModelMatrix(o.transform));

    // (2) 親参照の正規化（id文字列 or 数値index → 数値index | null）
    const idToIdx = {};
    scene.objects.forEach((o, i) => { if (o.id != null) idToIdx[o.id] = i; });
    const parentIdx = scene.objects.map(o => {
      if (o.parent == null) return null;
      if (typeof o.parent === 'number') return o.parent;
      const pi = idToIdx[o.parent];
      if (pi == null) throw new Error(`unknown parent: ${o.parent}`);
      return pi;
    });

    // (3) Level-based 階層投影（Bible §4: 再帰禁止、深さ順ループ）
    //     深さを単一パスで決定し、深さ昇順でワールド状態を確定する。
    const depth = new Array(N).fill(-1);
    let pending = N;
    while (pending > 0) {
      let progressed = false;
      for (let i = 0; i < N; i++) {
        if (depth[i] !== -1) continue;
        const p = parentIdx[i];
        if (p == null) { depth[i] = 0; pending--; progressed = true; continue; }
        if (depth[p] !== -1) { depth[i] = depth[p] + 1; pending--; progressed = true; }
      }
      if (!progressed) throw new Error('cycle in scene hierarchy');
    }

    // 投影軸: ワールド行列・時刻・透明度・生存
    const worldM = new Array(N);
    const worldT = new Array(N);
    const worldA = new Array(N);
    const worldV = new Array(N);
    const baseTime = scene.worldTime ?? 0;

    let maxDepth = 0;
    for (let i = 0; i < N; i++) if (depth[i] > maxDepth) maxDepth = depth[i];

    for (let d = 0; d <= maxDepth; d++) {
      for (let i = 0; i < N; i++) {
        if (depth[i] !== d) continue;
        const o = scene.objects[i];
        const p = parentIdx[i];
        const localTime = (o.time && typeof o.time.offset === 'number') ? o.time.offset : 0;
        const localAlpha = (typeof o.alpha === 'number') ? o.alpha : 1;
        const localVis = (typeof o.visible === 'boolean') ? o.visible : true;
        if (p == null) {
          worldM[i] = local[i];
          worldT[i] = baseTime + localTime;
          worldA[i] = localAlpha;
          worldV[i] = localVis;
        } else {
          worldM[i] = multiply(worldM[p], local[i]);
          worldT[i] = worldT[p] + localTime;
          worldA[i] = worldA[p] * localAlpha;
          worldV[i] = worldV[p] && localVis;
        }
      }
    }

    // (4) ビュー・プロジェクション行列
    const view = buildViewMatrix(scene.camera);
    const proj = buildPerspective(
      scene.camera.fov, scene.camera.aspect, scene.camera.near, scene.camera.far
    );

    // (5) 頂点ごとの段階別出力
    const vw = scene.viewport.width;
    const vh = scene.viewport.height;
    const objects = new Array(N);
    for (let i = 0; i < N; i++) {
      const o = scene.objects[i];
      const verts = (o.vertices || []).map(v => {
        const localV = [v[0], v[1], v[2], 1];
        const worldV = transformVec4(worldM[i], localV);
        const viewV  = transformVec4(view,    worldV);
        const clipV  = transformVec4(proj,    viewV);
        const w = clipV[3];
        // w<=0 は同次除算の結果が無意味（カメラ平面/背後）なので別経路
        const safeW = (w === 0) ? 1e-30 : w;
        const ndc = [clipV[0] / safeW, clipV[1] / safeW, clipV[2] / safeW];
        // NDC y=+1 が上、screen y=0 が上。Y反転が必要。
        const screen = [
          (ndc[0] * 0.5 + 0.5) * vw,
          (1 - (ndc[1] * 0.5 + 0.5)) * vh
        ];
        const inFrustum = (
          w > 0 &&
          clipV[0] >= -w && clipV[0] <= w &&
          clipV[1] >= -w && clipV[1] <= w &&
          clipV[2] >= -w && clipV[2] <= w
        );
        return {
          local: [v[0], v[1], v[2]],
          world: [worldV[0], worldV[1], worldV[2]],
          view:  [viewV[0],  viewV[1],  viewV[2]],
          clip:  [clipV[0],  clipV[1],  clipV[2], clipV[3]],
          ndc,
          screen,
          inFrustum
        };
      });
      objects[i] = {
        id: o.id ?? i,
        worldMatrix: worldM[i],
        vertices: verts,
        effective: { time: worldT[i], alpha: worldA[i], visible: worldV[i] }
      };
    }

    return {
      view,
      projection: proj,
      objects
    };
  }

  return {
    projectScene,
    // 検証・テスト用に行列基礎も公開する（鉱脈採掘の入口）
    _math: {
      multiply, translation,
      rotationX, rotationY, rotationZ,
      scaleM, buildModelMatrix, buildViewMatrix, buildPerspective,
      transformVec4
    }
  };
});
// [/ai_s_emblem: Cpu3D-Projection]

// [ai_s_emblem:#low#draw Cpu3D-SelfDemo]
// node 3dplus/cpu3d.js で自己診断。GPUなしで頂点位置の正気を確認する。
if (typeof require !== 'undefined' && require.main === module) {
  const { projectScene } = module.exports;
  const scene = {
    objects: [
      {
        id: 'origin', vertices: [[0,0,0]],
        transform: { position:[0,0,-5], rotation:[0,0,0], scale:[1,1,1] },
        parent: null
      },
      {
        id: 'child', vertices: [[1,0,0]],
        transform: { position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] },
        parent: 'origin'
      }
    ],
    camera: { position:[0,0,0], rotation:[0,0,0], fov: Math.PI/2, aspect: 1, near: 0.1, far: 100 },
    viewport: { width: 800, height: 600 }
  };
  const r = projectScene(scene);
  console.log(JSON.stringify(r, null, 2));
}
// [/ai_s_emblem: Cpu3D-SelfDemo]
