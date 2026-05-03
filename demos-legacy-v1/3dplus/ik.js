// [ai_s_emblem:#high#logic Cpu3D-IK]
// L4 Twin (Bible §4.5): Inverse Kinematics (IK) ソルバ。純粋関数のみ。
// 「接地（Grounding）」や腕のリーチ計算を検算するための算数。
// 2ボーンIK（大腿-脛-足首、上腕-前腕-手首）に特化した高速・軽量実装。

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cpu3DIK = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ===== ベクトル基礎演算 (内部インライン用) =====
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
  }
  function normalize(a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    return len > 1e-8 ? [a[0]/len, a[1]/len, a[2]/len] : [0,0,1];
  }

  /**
   * 2ボーンIKソルバ (Analytical Two-Bone IK)
   * 余弦定理を用いて、3点（Root, Joint, End）のなす三角形の頂点座標を算出する。
   * 
   * @param {number[]} root   - 親骨の付け根（大腿など）のワールド座標 [x,y,z]
   * @param {number[]} target - 目標地点（足首を置きたい場所）のワールド座標 [x,y,z]
   * @param {number}   len1   - 1番目の骨の長さ（rootからjointまで）
   * @param {number}   len2   - 2番目の骨の長さ（jointからendまで）
   * @param {number[]} pole   - 膝を曲げる方向のヒント（ポールベクトル）のワールド座標
   * 
   * @returns {Object} - { joint: [x,y,z], end: [x,y,z], ok: boolean }
   */
  function solveTwoBoneIK(root, target, len1, len2, pole) {
    const toTarget = sub(target, root);
    const dist = Math.hypot(toTarget[0], toTarget[1], toTarget[2]);
    
    // 最大リーチ制限（届かない場合は直線上に伸ばす）
    const maxLen = len1 + len2;
    const minLen = Math.abs(len1 - len2);
    
    // 実際に計算に使用する距離（端点付近の数値不安定を避けるため微調整）
    const d = Math.max(minLen, Math.min(dist, maxLen));
    
    // 余弦定理: len2^2 = len1^2 + d^2 - 2*len1*d * cos(alpha)
    // d が 0 や極小の場合の除算を避ける
    let alpha = 0;
    if (d > 1e-8) {
      const cosAlpha = (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d);
      alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
    }

    // 法線平面の構築
    const fwd = normalize(toTarget);
    
    // ポールベクトルがターゲット方向と重なっている場合のフォールバック
    let poleDir = normalize(sub(pole, root));
    let side = cross(poleDir, fwd);
    if (dot(side, side) < 1e-8) {
      // 軸が平行なら別のベクトルを使う
      const ortho = (Math.abs(fwd[0]) < 0.9) ? [1,0,0] : [0,1,0];
      side = normalize(cross(ortho, fwd));
    } else {
      side = normalize(side);
    }
    
    const up = cross(fwd, side);

    // Joint（膝）の位置算出
    const jointPos = (alpha < 1e-7) 
      ? add(root, mul(fwd, len1)) // 伸び切っている場合は直線上に配置
      : add(root, mul(add(mul(fwd, Math.cos(alpha)), mul(up, Math.sin(alpha))), len1));

    // End（足首）の位置は、届く範囲なら target そのもの。
    // 届かない場合は直線状に伸ばした点。
    let endPos = target;
    if (dist > maxLen) {
      endPos = add(root, mul(fwd, maxLen));
    } else if (dist < minLen) {
      endPos = add(root, mul(fwd, minLen));
    }

    return {
      joint: jointPos,
      end: endPos,
      ok: dist <= maxLen && dist >= minLen
    };
  }

  return {
    solveTwoBoneIK
  };
});
// [/ai_s_emblem: Cpu3D-IK]
