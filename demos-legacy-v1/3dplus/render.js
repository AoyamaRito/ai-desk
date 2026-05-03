// [ai_s_emblem:#mid#draw Render3D-Init]
// 汎用WebGL2レンダラー初期化。cpu3d.js と同じ scene JSON を受け取る。
// @twin: cpu3d.js (Cpu3D.projectScene が Twin として並走)
// @scene-format: { objects:[{id,vertices,triangles,transform,parent,alpha,visible,material?}],
//                  camera:{position,rotation/lookAt,fov,aspect,near,far}, viewport:{width,height} }

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Cpu3D   = require('./cpu3d.js');
    const shaders = require('./render.shaders.js');
    module.exports = factory(Cpu3D, shaders);
  } else {
    root.Render3D = factory(root.Cpu3D, root.Render3DShaders);
  }
})(typeof self !== 'undefined' ? self : this, function (Cpu3D, Shaders) {

  let gl, prog, uLoc, aLoc;

  function _createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
    return s;
  }

  function _createProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, _createShader(gl.VERTEX_SHADER,   vs));
    gl.attachShader(p, _createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('Program link: ' + gl.getProgramInfoLog(p));
    return p;
  }

  function init(canvas) {
    gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    prog = _createProgram(Shaders.VS_MESH, Shaders.FS_MESH);
    uLoc = {
      world:        gl.getUniformLocation(prog, 'u_world'),
      normalMatrix: gl.getUniformLocation(prog, 'u_normalMatrix'),
      view:         gl.getUniformLocation(prog, 'u_view'),
      projection:   gl.getUniformLocation(prog, 'u_projection'),
      color:        gl.getUniformLocation(prog, 'u_color'),
      lightDir:     gl.getUniformLocation(prog, 'u_lightDir'),
      alpha:        gl.getUniformLocation(prog, 'u_alpha'),
    };
    aLoc = {
      position: gl.getAttribLocation(prog, 'a_position'),
      normal:   gl.getAttribLocation(prog, 'a_normal'),
    };
  }
// [/ai_s_emblem: Render3D-Init]

// [ai_s_emblem:#high#draw Render3D-Frame]
// Heavy Function: 1回の scene JSON → CPU Twin → GPU描画。
// inFrustum false のオブジェクトはスキップ（Twin カリング）。
// Twin 結果を返すので呼び出し側でアサーション可能。

  function frame(scene) {
    if (!gl) throw new Error('Render3D.init(canvas) must be called first');

    // 1. CPU Twin — scene JSON をそのまま投影（GPU と同じ行列を共有）
    const twin = Cpu3D.projectScene(scene);

    // 2. Viewport + clear
    const vp = scene.viewport || { width: gl.canvas.width, height: gl.canvas.height };
    if (gl.canvas.width !== vp.width || gl.canvas.height !== vp.height) {
      gl.canvas.width  = vp.width;
      gl.canvas.height = vp.height;
    }
    gl.viewport(0, 0, vp.width, vp.height);
    gl.clearColor(0.05, 0.05, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(prog);

    // 3. Camera uniforms from Twin (GPU と同じ行列)
    gl.uniformMatrix4fv(uLoc.view,       false, new Float32Array(twin.view));
    gl.uniformMatrix4fv(uLoc.projection, false, new Float32Array(twin.projection));
    gl.uniform3fv(uLoc.lightDir, new Float32Array([0.5, 1.0, 0.8]));

    // 4. Draw each object
    for (const twinObj of twin.objects) {
      // Skip invisible or completely outside frustum
      if (!twinObj.effective.visible) continue;
      const anyInFrustum = twinObj.triangles.some(t => t.allInFrustum || !t.allInFrustum);
      if (twinObj.vertices.length > 0 && twinObj.vertices.every(v => !v.inFrustum)) continue;

      // Find source object for geometry + material
      const src = scene.objects.find(o => o.id === twinObj.id);
      if (!src || !src.vertices || !src.triangles) continue;

      // Build interleaved VBO: [x,y,z, nx,ny,nz] per vertex
      // Face normals computed inline from triangle world positions
      const vtxCount  = src.vertices.length;
      const buffer    = new Float32Array(vtxCount * 6);

      // Accumulate per-vertex normals from face normals
      const normals = new Array(vtxCount).fill(null).map(() => [0, 0, 0]);
      for (const tri of src.triangles) {
        const [i0, i1, i2] = tri;
        const w0 = twinObj.vertices[i0].world;
        const w1 = twinObj.vertices[i1].world;
        const w2 = twinObj.vertices[i2].world;
        const ax = w1[0]-w0[0], ay = w1[1]-w0[1], az = w1[2]-w0[2];
        const bx = w2[0]-w0[0], by = w2[1]-w0[1], bz = w2[2]-w0[2];
        const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        for (const idx of [i0, i1, i2]) {
          normals[idx][0] += nx/len;
          normals[idx][1] += ny/len;
          normals[idx][2] += nz/len;
        }
      }
      for (let i = 0; i < vtxCount; i++) {
        const pos  = src.vertices[i];
        const nl   = Math.sqrt(normals[i][0]**2 + normals[i][1]**2 + normals[i][2]**2) || 1;
        buffer[i*6+0] = pos[0];
        buffer[i*6+1] = pos[1];
        buffer[i*6+2] = pos[2];
        buffer[i*6+3] = normals[i][0]/nl;
        buffer[i*6+4] = normals[i][1]/nl;
        buffer[i*6+5] = normals[i][2]/nl;
      }

      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);

      const stride = 24; // 6 floats * 4 bytes
      gl.enableVertexAttribArray(aLoc.position);
      gl.vertexAttribPointer(aLoc.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aLoc.normal);
      gl.vertexAttribPointer(aLoc.normal,   3, gl.FLOAT, false, stride, 12);

      // Index buffer
      const indices = new Uint16Array(src.triangles.flat());
      const ibo     = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

      // Uniforms: world matrix from Twin, normalMatrix = transpose(inverse(world))
      gl.uniformMatrix4fv(uLoc.world,        false, new Float32Array(twinObj.worldMatrix));
      const nm = _normalMatrix(twinObj.worldMatrix);
      gl.uniformMatrix4fv(uLoc.normalMatrix, false, new Float32Array(nm));

      const col = src.material && src.material.color ? src.material.color : [0.8, 0.8, 0.8];
      gl.uniform3fv(uLoc.color, new Float32Array(col));
      gl.uniform1f(uLoc.alpha, twinObj.effective.alpha);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
    }

    return twin;
  }

  // 3x3 normal matrix from 4x4 world matrix (upper-left inverse-transpose, column-major)
  function _normalMatrix(m) {
    // Extract upper-left 3x3, compute inverse-transpose
    const a00=m[0],a01=m[1],a02=m[2], a10=m[4],a11=m[5],a12=m[6], a20=m[8],a21=m[9],a22=m[10];
    const det = a00*(a11*a22-a12*a21) - a01*(a10*a22-a12*a20) + a02*(a10*a21-a11*a20);
    const inv = det ? 1/det : 1;
    const n = new Array(16).fill(0);
    // Inverse-transpose of 3x3, stored in 4x4 (column-major, w=0 rows/cols)
    n[0]  = (a11*a22-a12*a21)*inv; n[1]  = -(a10*a22-a12*a20)*inv; n[2]  = (a10*a21-a11*a20)*inv;
    n[4]  = -(a01*a22-a02*a21)*inv; n[5]  = (a00*a22-a02*a20)*inv; n[6]  = -(a00*a21-a01*a20)*inv;
    n[8]  = (a01*a12-a02*a11)*inv; n[9]  = -(a00*a12-a02*a10)*inv; n[10] = (a00*a11-a01*a10)*inv;
    n[15] = 1;
    return n;
  }

  return { init, frame };
});
// [/ai_s_emblem: Render3D-Frame]
