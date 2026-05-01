// [ai_s_emblem:#high#logic Cpu3D-Collision]
// L4 Twin (Bible §4.5): 物理・衝突判定の検証双子。純粋関数のみ。
// GPUや物理エンジン(Cannon.js, Ammo.js等)が出した結果を検算するための算数。

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cpu3DCollision = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ===== ベクトル基礎演算 (インライン展開を推奨するが、可読性のためヘルパー化) =====
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) {
    return [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
  }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function normalize(a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    return len > 0 ? [a[0]/len, a[1]/len, a[2]/len] : [0,0,0];
  }

  // ===== AABB (Axis-Aligned Bounding Box) =====
  // 表現: { min: [x,y,z], max: [x,y,z] }
  
  // 頂点群からAABBを計算
  function computeAABB(vertices) {
    if (!vertices || vertices.length === 0) return { min: [0,0,0], max: [0,0,0] };
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      if (v[0] < min[0]) min[0] = v[0];
      if (v[1] < min[1]) min[1] = v[1];
      if (v[2] < min[2]) min[2] = v[2];
      if (v[0] > max[0]) max[0] = v[0];
      if (v[1] > max[1]) max[1] = v[1];
      if (v[2] > max[2]) max[2] = v[2];
    }
    return { min, max };
  }

  // AABB vs AABB の交差判定
  function intersectAABB(a, b) {
    return (
      a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
      a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
      a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
    );
  }

  // ===== Sphere (球) =====
  // 表現: { center: [x,y,z], radius: number }

  // 頂点群と中心座標から包含球(Bounding Sphere)を計算
  function computeBoundingSphere(vertices, center) {
    if (!vertices || vertices.length === 0) return { center: center || [0,0,0], radius: 0 };
    let maxDistSq = 0;
    const cx = center[0], cy = center[1], cz = center[2];
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const dx = v[0] - cx;
      const dy = v[1] - cy;
      const dz = v[2] - cz;
      const distSq = dx*dx + dy*dy + dz*dz;
      if (distSq > maxDistSq) maxDistSq = distSq;
    }
    return { center, radius: Math.sqrt(maxDistSq) };
  }

  // 球 vs 球 の交差判定
  function intersectSphere(a, b) {
    const dx = a.center[0] - b.center[0];
    const dy = a.center[1] - b.center[1];
    const dz = a.center[2] - b.center[2];
    const distSq = dx*dx + dy*dy + dz*dz;
    const rSum = a.radius + b.radius;
    return distSq <= rSum * rSum;
  }

  // 球 vs AABB の交差判定
  // AABB内の球中心に最も近い点を求め、その距離が半径以内かチェック
  function intersectSphereAABB(sphere, aabb) {
    let closestX = Math.max(aabb.min[0], Math.min(sphere.center[0], aabb.max[0]));
    let closestY = Math.max(aabb.min[1], Math.min(sphere.center[1], aabb.max[1]));
    let closestZ = Math.max(aabb.min[2], Math.min(sphere.center[2], aabb.max[2]));

    const dx = closestX - sphere.center[0];
    const dy = closestY - sphere.center[1];
    const dz = closestZ - sphere.center[2];
    return (dx*dx + dy*dy + dz*dz) <= (sphere.radius * sphere.radius);
  }

  // ===== Ray (光線) =====
  // 表現: { origin: [x,y,z], direction: [x,y,z] } ※directionは正規化済みであること

  // Ray vs AABB
  // Slab method (Liang-Barsky / Smits)
  function intersectRayAABB(ray, aabb) {
    let tmin = -Infinity, tmax = Infinity;
    
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ray.direction[i]) < 1e-8) {
        // レイが軸に平行な場合
        if (ray.origin[i] < aabb.min[i] || ray.origin[i] > aabb.max[i]) return null;
      } else {
        const invD = 1.0 / ray.direction[i];
        let t0 = (aabb.min[i] - ray.origin[i]) * invD;
        let t1 = (aabb.max[i] - ray.origin[i]) * invD;
        if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
        
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmax < tmin) return null;
      }
    }
    
    if (tmax < 0) return null; // AABBがレイの後方にある
    
    const t = tmin < 0 ? tmax : tmin; // レイの起点がAABB内部ならtmaxを返す
    return {
      t,
      point: [
        ray.origin[0] + ray.direction[0] * t,
        ray.origin[1] + ray.direction[1] * t,
        ray.origin[2] + ray.direction[2] * t
      ]
    };
  }

  // Ray vs Sphere
  // 解析的二次方程式法。d·d=1 を仮定（方向は正規化済み）。
  // 判別式 disc = (d·oc)^2 - (oc·oc - r^2)。disc < 0 → 交差なし。
  function intersectRaySphere(ray, sphere) {
    const EPSILON = 1e-8;
    const ocx = ray.origin[0] - sphere.center[0];
    const ocy = ray.origin[1] - sphere.center[1];
    const ocz = ray.origin[2] - sphere.center[2];
    const b = ocx * ray.direction[0] + ocy * ray.direction[1] + ocz * ray.direction[2];
    const c = ocx*ocx + ocy*ocy + ocz*ocz - sphere.radius * sphere.radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    let t = -b - sqrtDisc; // 近点
    if (t < EPSILON) t = -b + sqrtDisc; // 球の内部から: 遠点を採用
    if (t < EPSILON) return null; // 球がレイの後方
    return {
      t,
      point: [
        ray.origin[0] + ray.direction[0] * t,
        ray.origin[1] + ray.direction[1] * t,
        ray.origin[2] + ray.direction[2] * t
      ]
    };
  }

  // Ray vs Triangle
  // Möller–Trumbore intersection algorithm
  function intersectRayTriangle(ray, v0, v1, v2) {
    const EPSILON = 1e-8;
    const edge1 = sub(v1, v0);
    const edge2 = sub(v2, v0);
    const h = cross(ray.direction, edge2);
    const a = dot(edge1, h);

    if (a > -EPSILON && a < EPSILON) return null; // レイが三角形と平行

    const f = 1.0 / a;
    const s = sub(ray.origin, v0);
    const u = f * dot(s, h);

    if (u < 0.0 || u > 1.0) return null;

    const q = cross(s, edge1);
    const v = f * dot(ray.direction, q);

    if (v < 0.0 || u + v > 1.0) return null;

    const t = f * dot(edge2, q);

    if (t > EPSILON) {
      // 交差あり
      return {
        t,
        u,
        v,
        point: [
          ray.origin[0] + ray.direction[0] * t,
          ray.origin[1] + ray.direction[1] * t,
          ray.origin[2] + ray.direction[2] * t
        ]
      };
    }
    
    // 線分交差だが、t < 0 つまりカメラの後ろ
    return null;
  }

  // ===== 視錐台 (Frustum) =====
  // Gribb-Hartmann 法: 結合行列 VP (column-major) の行から6平面を抽出する。
  // 各平面は { normal:[a,b,c], d } で、a*x+b*y+c*z+d >= 0 が「視錐台の内側」を意味する。
  // normalは正規化済み。
  function extractFrustumPlanes(vp) {
    // column-majorの行: row[i] = [vp[i], vp[i+4], vp[i+8], vp[i+12]]
    function plane(a, b, c, d) {
      const len = Math.hypot(a, b, c);
      return len > 0 ? { normal: [a/len, b/len, c/len], d: d/len } : { normal: [0,0,0], d: 0 };
    }
    return [
      plane(vp[3]+vp[0], vp[7]+vp[4], vp[11]+vp[8],  vp[15]+vp[12]), // Left:   row3+row0
      plane(vp[3]-vp[0], vp[7]-vp[4], vp[11]-vp[8],  vp[15]-vp[12]), // Right:  row3-row0
      plane(vp[3]+vp[1], vp[7]+vp[5], vp[11]+vp[9],  vp[15]+vp[13]), // Bottom: row3+row1
      plane(vp[3]-vp[1], vp[7]-vp[5], vp[11]-vp[9],  vp[15]-vp[13]), // Top:    row3-row1
      plane(vp[3]+vp[2], vp[7]+vp[6], vp[11]+vp[10], vp[15]+vp[14]), // Near:   row3+row2
      plane(vp[3]-vp[2], vp[7]-vp[6], vp[11]-vp[10], vp[15]-vp[14]), // Far:    row3-row2
    ];
  }

  // AABB vs 視錐台: false なら完全に視錐台の外（カリング可）。true なら交差または内部。
  // "positive vertex" 法: 各平面の法線方向で最遠の頂点が外側にあれば確定カリング。
  function isAABBInFrustum(aabb, planes) {
    for (let i = 0; i < planes.length; i++) {
      const { normal, d } = planes[i];
      const px = normal[0] >= 0 ? aabb.max[0] : aabb.min[0];
      const py = normal[1] >= 0 ? aabb.max[1] : aabb.min[1];
      const pz = normal[2] >= 0 ? aabb.max[2] : aabb.min[2];
      if (normal[0]*px + normal[1]*py + normal[2]*pz + d < 0) return false;
    }
    return true;
  }

  // 球 vs 視錐台: false なら完全に視錐台の外。true なら交差または内部。
  function isSphereInFrustum(sphere, planes) {
    const [cx, cy, cz] = sphere.center;
    for (let i = 0; i < planes.length; i++) {
      const { normal, d } = planes[i];
      if (normal[0]*cx + normal[1]*cy + normal[2]*cz + d < -sphere.radius) return false;
    }
    return true;
  }

  return {
    computeAABB,
    intersectAABB,
    computeBoundingSphere,
    intersectSphere,
    intersectSphereAABB,
    intersectRayAABB,
    intersectRaySphere,
    intersectRayTriangle,
    extractFrustumPlanes,
    isAABBInFrustum,
    isSphereInFrustum
  };
});
// [/ai_s_emblem: Cpu3D-Collision]