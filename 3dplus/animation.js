// [ai_s_emblem:#high#logic Cpu3D-Animation]
// L4 Twin (Bible §4.5): キーフレームアニメーション評価の検証双子。純粋関数のみ。Zero-Dep。
//
// 用途: GPUアニメーションドライバ（Three.js AnimationMixer等）と同じタイムラインを
//       CPUで評価し、ボーン姿勢やオブジェクト変換が正しいかを断定する。
//
// キーフレーム形式: [{ time: number, value: scalar|[x,y,z]|[x,y,z,w] }, ...]
//   ※ timeは昇順でソート済みであること。

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cpu3DAnimation = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // 二分探索: keyframes[k].time <= t < keyframes[k+1].time となる k を返す。
  // t がレンジ外の場合は端点インデックスを返す（クランプ）。
  function findInterval(keyframes, t) {
    if (keyframes.length === 0) return -1;
    if (t <= keyframes[0].time) return 0;
    if (t >= keyframes[keyframes.length - 1].time) return keyframes.length - 1;
    let lo = 0, hi = keyframes.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (keyframes[mid].time <= t) lo = mid; else hi = mid;
    }
    return lo;
  }

  // スカラーキーフレームを線形補間で評価する。
  // 戻り値: number
  function evaluateScalar(keyframes, t) {
    if (!keyframes || keyframes.length === 0) return 0;
    if (t <= keyframes[0].time) return keyframes[0].value;
    const k = findInterval(keyframes, t);
    if (k >= keyframes.length - 1) return keyframes[keyframes.length - 1].value;
    const a = keyframes[k], b = keyframes[k + 1];
    const alpha = (t - a.time) / (b.time - a.time);
    return a.value + (b.value - a.value) * alpha;
  }

  // Vec3 キーフレームを線形補間で評価する。
  // 戻り値: [x, y, z]
  function evaluateVec3(keyframes, t) {
    if (!keyframes || keyframes.length === 0) return [0, 0, 0];
    if (t <= keyframes[0].time) { const v = keyframes[0].value; return [v[0], v[1], v[2]]; }
    const k = findInterval(keyframes, t);
    if (k >= keyframes.length - 1) {
      const v = keyframes[keyframes.length - 1].value;
      return [v[0], v[1], v[2]];
    }
    const a = keyframes[k], b = keyframes[k + 1];
    const alpha = (t - a.time) / (b.time - a.time);
    return [
      a.value[0] + (b.value[0] - a.value[0]) * alpha,
      a.value[1] + (b.value[1] - a.value[1]) * alpha,
      a.value[2] + (b.value[2] - a.value[2]) * alpha,
    ];
  }

  // クォータニオンキーフレームを Slerp で評価する。
  // 戻り値: [x, y, z, w] (正規化済み)
  // 入力クォータニオンは正規化済みであること。
  function evaluateQuat(keyframes, t) {
    if (!keyframes || keyframes.length === 0) return [0, 0, 0, 1];
    if (t <= keyframes[0].time) { const v = keyframes[0].value; return [v[0], v[1], v[2], v[3]]; }
    const k = findInterval(keyframes, t);
    if (k >= keyframes.length - 1) {
      const v = keyframes[keyframes.length - 1].value;
      return [v[0], v[1], v[2], v[3]];
    }
    const a = keyframes[k], b = keyframes[k + 1];
    const alpha = (t - a.time) / (b.time - a.time);
    return _slerp(a.value, b.value, alpha);
  }

  // Slerp のインライン実装（cpu3d.js への依存を避けるため複製）
  function _slerp(a, b, t) {
    let dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
    // 最短経路: dot < 0 なら b を反転
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    if (dot < 0) { bx=-bx; by=-by; bz=-bz; bw=-bw; dot=-dot; }
    if (dot > 0.9995) {
      // ほぼ同じ → 線形補間で十分
      const len = Math.hypot(a[0]+bx*(1-t) - a[0]*t + a[0], 1); // avoid NaN
      const rx = a[0] + (bx - a[0]) * t;
      const ry = a[1] + (by - a[1]) * t;
      const rz = a[2] + (bz - a[2]) * t;
      const rw = a[3] + (bw - a[3]) * t;
      const l = Math.hypot(rx, ry, rz, rw) || 1;
      return [rx/l, ry/l, rz/l, rw/l];
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return [
      a[0]*s0 + bx*s1,
      a[1]*s0 + by*s1,
      a[2]*s0 + bz*s1,
      a[3]*s0 + bw*s1,
    ];
  }

  return { evaluateScalar, evaluateVec3, evaluateQuat };
});
// [/ai_s_emblem: Cpu3D-Animation]
