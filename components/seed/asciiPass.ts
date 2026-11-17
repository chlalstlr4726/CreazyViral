// 3D 장면을 글자판으로 바꾸는 단계(아스키 디오라마 방식): 장면 그림을 칸으로 나눠, 칸마다 재질과 밝기에 맞는 글자를 고른다.
import type * as T from "three";

/** 재질 번호: 장면을 그릴 때 알파 칸에 적어 두고, 글자판에서 읽는다 */
export const CLS = { ground: 1, soil: 2, wood: 3, leaf: 4, seed: 5, root: 6, flower: 7, petal: 8, butterfly: 9, mist: 10, moon: 11 } as const;
export const GLYPHS = " .'`,:;-~=+*oO$%&#@/\\|_^xvw";

export function tagMaterial(mat: T.Material, cls: number) {
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <dithering_fragment>", `#include <dithering_fragment>\n  gl_FragColor.a = ${(cls / 16).toFixed(5)};`);
  };
  mat.customProgramCacheKey = () => "cls" + cls;
}

export function makeAtlas(THREE: typeof T) {
  const tw = 48, th = 80, cv = document.createElement("canvas");
  cv.width = tw * GLYPHS.length;
  cv.height = th;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#fff";
  g.font = "bold 62px Menlo, 'JetBrains Mono', ui-monospace, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < GLYPHS.length; i++) g.fillText(GLYPHS[i], i * tw + tw / 2, th / 2 + 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

const idx = (c: string) => GLYPHS.indexOf(c);
const I = Object.fromEntries([...GLYPHS].map((c) => [c, idx(c)]));

export const asciiFrag = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform float uTime;
uniform vec3 uBg;
uniform float uN;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
int ramp(float L, int a, int b, int c, int d, int e) {
  if (L > 0.80) return a; if (L > 0.62) return b; if (L > 0.46) return c; if (L > 0.30) return d; return e;
}
void main() {
  vec2 cf = vUv * uGrid, cell = floor(cf), f = fract(cf), uvc = (cell + 0.5) / uGrid;
  ivec2 ts = textureSize(uScene, 0);
  vec4 s0 = texelFetch(uScene, ivec2(uvc * vec2(ts)), 0);
  int cls = int(floor(s0.a * 16.0 + 0.5));
  if (cls == 0) { outColor = vec4(uBg, 1.0); return; }
  float lod = max(0.0, log2(float(ts.x) / uGrid.x));
  vec3 c = textureLod(uScene, uvc, lod).rgb;
  float L = dot(c, vec3(0.25, 0.6, 0.15));
  vec2 px = 1.0 / uGrid;
  float gx = dot(textureLod(uScene, uvc + vec2(px.x, 0.0), lod).rgb - textureLod(uScene, uvc - vec2(px.x, 0.0), lod).rgb, vec3(0.33));
  float gy = dot(textureLod(uScene, uvc + vec2(0.0, px.y), lod).rgb - textureLod(uScene, uvc - vec2(0.0, px.y), lod).rgb, vec3(0.33));
  float h = hash(cell);
  int gi = ${I["."]};
  vec3 ink = c;
  float gm = length(vec2(gx, gy));
  // edge glyph by gradient direction
  int edge = abs(gx) > abs(gy) * 2.0 ? ${I["|"]} : abs(gy) > abs(gx) * 2.0 ? ${I["_"]} : (gx * gy > 0.0 ? ${I["\\"]} : ${I["/"]});
  if (cls == 1) { gi = h > 0.86 ? ${I["'"]} : ramp(L * 1.5 + (h - 0.5) * 0.3, ${I["."]}, ${I[","]}, ${I[":"]}, ${I[";"]}, ${I["~"]}); ink = c * 0.82; }
  else if (cls == 2) { gi = ramp(L, ${I[":"]}, ${I["="]}, ${I["="]}, ${I["%"]}, ${I["#"]}); ink = c * 0.7; }
  else if (cls == 3) { gi = gm > 0.05 ? edge : ramp(L * 1.2, ${I["|"]}, ${I["|"]}, ${I["#"]}, ${I["#"]}, ${I["%"]}); ink = c * 0.78; }
  else if (cls == 4) {
    gi = ramp(L * 2.6 + (h - 0.5) * 0.3, ${I["."]}, ${I["+"]}, ${I["*"]}, ${I["%"]}, ${I["&"]});
    if (h > 0.93) gi = ${I["o"]};
    ink = c * 0.86;
    // leaves slide a little inside the cell (the skeleton stays snapped)
    f.x += 0.14 * sin(uTime * 2.1 + h * 6.283);
    f.y += 0.06 * sin(uTime * 1.6 + h * 9.1);
  }
  else if (cls == 5) { gi = ramp(L, ${I["o"]}, ${I["O"]}, ${I["O"]}, ${I["@"]}, ${I["@"]}); ink = c * 0.9; }
  else if (cls == 6) { gi = gm > 0.04 ? edge : (h > 0.5 ? ${I["~"]} : ${I[":"]}); ink = c * 0.8; }
  else if (cls == 7) { gi = ramp(L * 1.1 + (h - 0.5) * 0.25, ${I["."]}, ${I["*"]}, ${I["o"]}, ${I["*"]}, ${I["@"]}); if (h > 0.9) gi = ${I["%"]}; ink = mix(c, vec3(0.80, 0.22, 0.45), 0.55); }
  else if (cls == 8) { gi = h > 0.6 ? ${I["*"]} : h > 0.3 ? ${I["`"]} : ${I[","]}; ink = mix(c, vec3(0.82, 0.30, 0.50), 0.5); f.x += 0.2 * sin(uTime * 1.3 + h * 6.283); }
  else if (cls == 9) { gi = h > 0.66 ? ${I["v"]} : h > 0.33 ? ${I["w"]} : ${I["^"]}; ink = mix(c, vec3(0.20, 0.32, 0.85), 0.5); }
  else if (cls == 10) { gi = h > 0.7 ? ${I["~"]} : h > 0.35 ? ${I["-"]} : ${I["."]}; ink = c; f.x += fract(uTime * 0.07 + h) * 0.6 - 0.3; }
  else if (cls == 11) { gi = h > 0.75 ? ${I[":"]} : ${I["."]}; ink = c; }
  vec2 g = clamp(f, 0.04, 0.96);
  float a = texture(uAtlas, vec2((float(gi) + g.x) / uN, g.y)).r;
  a = smoothstep(0.12, 0.78, a);
  vec3 col = pow(clamp(ink, 0.0, 1.0), vec3(1.0 / 2.2));
  outColor = vec4(mix(uBg, col, a), 1.0);
}`;

export const asciiVert = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
