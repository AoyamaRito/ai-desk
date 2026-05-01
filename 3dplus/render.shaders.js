// [ai_s_emblem:#mid#draw Render3D-Shaders]
// 汎用WebGL2シェーダー。cpu3d.js の scene JSON 形式に対応。
// VS_MESH: worldMatrix + normalMatrix でメッシュ変換、フェイス法線ライティング
// FS_MESH: diffuse + ambient ランバート反射

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Render3DShaders = factory();
})(typeof self !== 'undefined' ? self : this, function () {

const VS_MESH = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;

uniform mat4 u_world;
uniform mat4 u_normalMatrix;
uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_normal;
out vec3 v_worldPos;

void main() {
  vec4 worldPos = u_world * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal   = mat3(u_normalMatrix) * a_normal;
  gl_Position = u_projection * u_view * worldPos;
}
`;

const FS_MESH = `#version 300 es
precision mediump float;

in vec3 v_normal;
in vec3 v_worldPos;

uniform vec3 u_color;
uniform vec3 u_lightDir;
uniform float u_alpha;

out vec4 outColor;

void main() {
  vec3 n    = normalize(v_normal);
  float diff = max(dot(n, normalize(u_lightDir)), 0.0);
  vec3 ambient = u_color * 0.3;
  vec3 lit     = u_color * diff;
  outColor = vec4(ambient + lit, u_alpha);
}
`;

  return { VS_MESH, FS_MESH };
});
// [/ai_s_emblem: Render3D-Shaders]
