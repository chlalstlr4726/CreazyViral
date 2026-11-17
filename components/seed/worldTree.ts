// 씨앗 → 새싹 → 작은 나무 → 매화나무 3D 장면. 땅이 씨앗을 축으로 돌고(카메라 고정), 그림 전체는 asciiPass로 글자가 된다.
// 매화: 꼬이고 마디진 줄기와 가지, 잎보다 먼저 맨가지에 바로 붙어 피는 다섯 꽃잎(흰색·분홍). 둘레에 나비, 떨어지는 꽃잎, 뒤쪽 안개와 옅은 달.
// three는 이 파일을 부를 때만 불러온다(다른 탭을 느리게 하지 않음).
import { CLS, GLYPHS, asciiFrag, asciiVert, makeAtlas, tagMaterial } from "./asciiPass";
import type { SeedSettings } from "./settings";

export type Phase = "seed" | "sprout" | "sapling" | "bloom" | "done";
type Opts = { reduced: boolean; delayMs: number; bg: [number, number, number]; onPhase?: (p: Phase) => void; onLayout?: (groundTop: number) => void; jumpT?: number;
  /** 나무 꼭대기가 넘지 않을 선(장면 위에서부터 0~1, 소개 카드 아래). */ topLimit?: () => number;
  /** 사람이 고칠 수 있는 값(편집 모드). 돌아가는 동안 apply()로 바꿀 수 있다. */ settings: SeedSettings;
  /** 소개 카드 오른쪽 끝(왼쪽에서부터 0~1): 나무가 이 선 왼쪽으로 넘지 않는다. */ cardRight?: () => number };

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
// 시간표(초)
const TL = { crack: 0.2, sprout: [0.6, 2.6], tree: [1.4, 7.6], sapLeaf: [2.2, 6.8], bloom: [7.6, 10.4], fly: 9.0, done: 10.8 };

export async function startWorldTree(host: HTMLElement, o: Opts) {
  const THREE = await import("three");
  if (!document.createElement("canvas").getContext("webgl2")) throw new Error("no_webgl2");
  type V3 = InstanceType<typeof THREE.Vector3>;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-8, 18, 14);
  scene.add(sun);
  // 거리감: 먼 쪽은 바탕색 쪽으로 옅어지고 가까운 쪽은 짙게(앞뒤 구분). 거리는 카메라를 맞출 때 정한다.
  const fog = new THREE.Fog(0xf3f4f6, 30, 60);
  scene.fog = fog;
  const world = new THREE.Group(); // 땅과 나무가 함께 돈다
  scene.add(world);
  const R = rng(20261117);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const mat = (color: number, cls: number, extra: Record<string, unknown> = {}) => {
    const m = new THREE.MeshLambertMaterial({ color, ...extra });
    tagMaterial(m, cls);
    return m;
  };

  // 땅: 화면 아래를 가로로 꽉 채우는 넓은 둥근 땅(무늬가 있어 도는 게 보인다)
  let S = o.settings;
  const tc = document.createElement("canvas");
  tc.width = tc.height = 512;
  const tg = tc.getContext("2d")!;
  const paintGround = (base: string) => {
    const r2 = rng(77);
    tg.fillStyle = base;
    tg.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const k = r2();
      tg.fillStyle = k < 0.45 ? `rgba(40,70,30,${0.18 + r2() * 0.3})` : k < 0.8 ? `rgba(255,255,230,${0.12 + r2() * 0.25})` : `rgba(120,95,70,${0.3 + r2() * 0.4})`;
      tg.beginPath();
      tg.arc(r2() * 512, r2() * 512, 2 + r2() * 14, 0, 6.283);
      tg.fill();
    }
  };
  paintGround(S.color.ground);
  const groundTex = new THREE.CanvasTexture(tc);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(5, 5);
  const GROUND_R = 70;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 128), mat(0xffffff, CLS.ground, { map: groundTex, fog: false }));
  ground.rotation.x = -Math.PI / 2;
  world.add(ground);

  // 뒤쪽 안개(카메라 기준으로 고정, 천천히 흐르는 글자)와 옅은 달
  const mist = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 3.2, 64, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat(0xb9c4cf, CLS.mist, { side: THREE.DoubleSide, fog: false }));
  mist.position.y = 1.2;
  scene.add(mist);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xd9d2bb, fog: false });
  tagMaterial(moonMat, CLS.moon);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 48), moonMat);
  moon.position.set(11, 16.5, -34);
  scene.add(moon);

  // 씨앗과 떡잎
  const seed = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xc8892e, CLS.seed));
  seed.position.y = 0.3;
  world.add(seed);
  const cotylMat = mat(0x5aa84a, CLS.leaf);
  const cotyl = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), cotylMat);
    m.position.set(s * 0.55, 1.2, 0);
    m.scale.setScalar(0);
    world.add(m);
    return m;
  });

  // 매화 줄기와 가지: 짧은 마디를 이어 꼬이고 꺾이게 만든다
  type Seg = { a: V3; b: V3; r: number; t0: number; t1: number };
  const segs: Seg[] = [];
  const blossoms: { p: V3; n: V3; t: number; s: number; pink: boolean }[] = [];
  const sapLeaves: { p: V3; t: number; ph: number }[] = [];
  const tPer = (TL.tree[1] - TL.tree[0]) / 14; // 길이 1당 걸리는 시간
  function bend(dir: V3, amt: number) {
    const ax = V(R() - 0.5, R() * 0.3 - 0.15, R() - 0.5).normalize();
    return dir.clone().applyAxisAngle(ax, (R() - 0.5) * 2 * amt).normalize();
  }
  function bloomAt(p: V3, t: number) {
    p.add(V((R() - 0.5) * 0.35, (R() - 0.5) * 0.25, (R() - 0.5) * 0.35));
    blossoms.push({ p, n: V(R() - 0.5, R() * 0.8, R() - 0.5).normalize(), t: Math.max(TL.bloom[0], t + 2) + R() * 1.6, s: 0.22 + R() * 0.14, pink: R() < 0.55 });
  }
  function spur(a: V3, d: V3, t0: number) {
    const sd = bend(d, 1.1), b = a.clone().addScaledVector(sd, 0.7 + R() * 0.8);
    segs.push({ a, b, r: 0.07, t0, t1: t0 + 0.4 });
    for (let k = 0; k < 2; k++) bloomAt(a.clone().lerp(b, 0.4 + R() * 0.6), t0 + 0.4);
  }
  function limb(a: V3, dir: V3, len: number, r: number, depth: number, t0: number) {
    const n = 3 + Math.floor(R() * 3);
    let p = a, d = dir, t = t0;
    for (let i = 0; i < n; i++) {
      d = bend(d, depth >= 3 ? 0.3 : 0.42);
      if (d.y < 0.1) d.y = 0.1 + R() * 0.15;
      d.normalize();
      const sl = (len / n) * (0.8 + R() * 0.4), q = p.clone().addScaledVector(d, sl), t1 = t + sl * tPer;
      const rr = r * (1 - (i / n) * 0.35) * (R() < 0.18 ? 1.25 : 1); // 마디가 굵어지는 곳
      segs.push({ a: p, b: q, r: rr, t0: t, t1 });
      if (depth <= 2) for (let k = 0; k < Math.round(sl * 2.6); k++) bloomAt(p.clone().lerp(q, R()), t1);
      if (depth >= 1 && R() < 0.5) spur(p.clone().lerp(q, 0.3 + R() * 0.6), d, t1);
      p = q;
      t = t1;
    }
    if (depth === 0) { for (let k = 0; k < 3; k++) bloomAt(p.clone(), t); return; }
    const kids = depth >= 4 ? 3 : R() < 0.4 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const yaw = (k / kids) * Math.PI * 2 + R() * 1.3, pitch = 0.3 + R() * 0.75;
      const nd = d.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(V(Math.cos(yaw), 0, Math.sin(yaw)), Math.sin(pitch)).normalize();
      limb(p, nd, len * (0.55 + R() * 0.32), r * 0.6, depth - 1, t);
    }
  }
  // 줄기: 굵고 살짝 기울어 꼬이며 올라가다 셋으로 갈라진다
  limb(V(0, 0, 0), V(0.12, 1, 0.05).normalize(), 4.4, 1.25, 5, TL.tree[0]);
  // 작은 나무 때의 잎: 이미 자란 가지에만 붙는다(꽃이 피면 진다)
  const early = segs.filter((s) => s.t1 < TL.sapLeaf[1] - 0.6);
  for (let i = 0; i < 26 && early.length; i++) {
    const s = early[Math.floor(R() * early.length)], f = R();
    sapLeaves.push({ p: s.a.clone().lerp(s.b, f).add(V((R() - 0.5) * 0.7, R() * 0.4, (R() - 0.5) * 0.7)), t: Math.max(TL.sapLeaf[0] + R() * 1.2, s.t0 + (s.t1 - s.t0) * f + 0.2), ph: R() * 6.283 });
  }

  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  cyl.translate(0, 0.5, 0);
  const woodMat = mat(0x7d6a5c, CLS.wood);
  woodMat.color.set(S.color.wood);
  const woodIM = new THREE.InstancedMesh(cyl, woodMat, segs.length);
  const PET = 6; // 꽃잎 다섯 + 가운데 꽃술
  const petalGeo = new THREE.CircleGeometry(1, 10);
  const flowerIM = new THREE.InstancedMesh(petalGeo, mat(0xffffff, CLS.flower, { side: THREE.DoubleSide }), blossoms.length * PET);
  // 꽃 색: 기준 분홍 하나에서 밝기만 조금씩 다르게(흰 꽃은 기준색을 아주 옅게)
  const shade = blossoms.map(() => [R(), R(), R(), R(), R()]);
  const paintFlowers = (base: string) => {
    const b = new THREE.Color(base), c = new THREE.Color(), white = new THREE.Color(0xffffff), stamen = new THREE.Color(0xe2b84c);
    blossoms.forEach((bl, i) => {
      for (let k = 0; k < 5; k++) flowerIM.setColorAt(i * PET + k, c.copy(b).lerp(white, bl.pink ? shade[i][k] * 0.45 : 0.72 + shade[i][k] * 0.25));
      flowerIM.setColorAt(i * PET + 5, stamen);
    });
    if (flowerIM.instanceColor) flowerIM.instanceColor.needsUpdate = true;
  };
  paintFlowers(S.color.blossom);
  const leafIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0x5aa84a, CLS.leaf), sapLeaves.length);
  // 떨어지는 꽃잎
  const FALL = 60;
  const fallIM = new THREE.InstancedMesh(petalGeo, mat(0xf3b9ca, CLS.petal, { side: THREE.DoubleSide }), FALL);
  const falls = Array.from({ length: FALL }, () => ({ x: 0, y: -1, z: 0, vy: 0.5 + R() * 0.6, ph: R() * 6.283, wait: R() * 6 }));
  [woodIM, flowerIM, leafIM, fallIM].forEach((m) => { m.frustumCulled = false; world.add(m); });

  // 나비(디자인 저장소의 나비 방식): 나무 둘레를 저마다 다른 반지름·방향으로 돌고, 날갯짓은 느리고 우아하게
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.5, 0.9, 1.4, 0.8, 1.2, 0.1);
  wingShape.bezierCurveTo(1.1, -0.4, 0.5, -0.7, 0, -0.1);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 6);
  wingGeo.rotateX(-Math.PI / 2);
  const flyMat = mat(0x5b77e6, CLS.butterfly, { side: THREE.DoubleSide });
  flyMat.color.set(S.color.butterfly);
  const flies = Array.from({ length: 8 }, (_, i) => {
    const g = new THREE.Group(), L = new THREE.Mesh(wingGeo, flyMat), Rw = new THREE.Mesh(wingGeo, flyMat);
    Rw.scale.x = -1;
    g.add(L, Rw);
    g.scale.setScalar(0.95 + R() * 0.3);
    g.visible = false;
    scene.add(g);
    return { g, L, Rw, r: 6.5 + i * 1.6 + R(), h: 6 + R() * 6, w: (0.28 + R() * 0.16) * (i % 2 ? -1 : 1), a: R() * 6.283, ph: R() * 6.283 };
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0), tmp = V(), sc = V(), e3 = new THREE.Euler(), zAxis = V(0, 0, 1);
  function placeWood(T: number) {
    segs.forEach((s, i) => {
      const p = ease((T - s.t0) / Math.max(0.05, s.t1 - s.t0));
      tmp.subVectors(s.b, s.a);
      const len = tmp.length();
      q.setFromUnitVectors(up, tmp.normalize());
      const g = 0.45 + 0.55 * ease((T - s.t0) / 3); // 시간이 지나며 굵어진다
      sc.set(p > 0 ? s.r * g : 0, Math.max(0.0001, len * p), p > 0 ? s.r * g : 0);
      woodIM.setMatrixAt(i, m4.compose(s.a, q, sc));
    });
    woodIM.instanceMatrix.needsUpdate = true;
  }
  function placeFlowers(T: number, time: number) {
    blossoms.forEach((b, i) => {
      const bud = ease((T - (b.t - 1.6)) / 1.2), open = ease((T - b.t) / 1.1);
      q.setFromUnitVectors(zAxis, b.n);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + i, rad = b.s * (0.15 + 0.85 * open);
        tmp.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0).applyQuaternion(q).add(b.p);
        const s = b.s * (0.35 * bud + 0.65 * open) * (1 + 0.04 * Math.sin(time * 2 + i));
        flowerIM.setMatrixAt(i * PET + k, m4.compose(tmp, q, sc.set(s, s * 0.8, s)));
      }
      tmp.copy(b.n).multiplyScalar(0.06).add(b.p);
      flowerIM.setMatrixAt(i * PET + 5, m4.compose(tmp, q, sc.setScalar(b.s * 0.35 * open)));
    });
    flowerIM.instanceMatrix.needsUpdate = true;
  }
  function placeLeaves(T: number, time: number) {
    sapLeaves.forEach((l, i) => {
      const p = ease((T - l.t) / 0.8) * (1 - ease((T - TL.sapLeaf[1]) / 1.4)), sw = 0.08;
      tmp.set(l.p.x + Math.sin(time * 1.7 + l.ph) * sw, l.p.y + Math.sin(time * 2.3 + l.ph) * sw, l.p.z + Math.cos(time * 1.3 + l.ph) * sw);
      q.setFromAxisAngle(up, l.ph + Math.sin(time + l.ph) * 0.35);
      leafIM.setMatrixAt(i, m4.compose(tmp, q, sc.set(0.32 * p, 0.12 * p, 0.22 * p)));
    });
    leafIM.instanceMatrix.needsUpdate = true;
  }
  function placeFalls(T: number, dt: number, time: number) {
    const on = T > TL.bloom[0] + 1.5 && blossoms.length > 0;
    falls.forEach((f, i) => {
      if (!on) { fallIM.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
      if (f.y < 0) {
        f.wait -= dt;
        if (f.wait > 0) { fallIM.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
        const b = blossoms[Math.floor(R() * blossoms.length)];
        f.x = b.p.x; f.y = b.p.y; f.z = b.p.z; f.wait = 1 + R() * 5;
      }
      f.y -= f.vy * dt;
      f.x += Math.sin(time * 1.1 + f.ph) * dt * 0.9;
      f.z += Math.cos(time * 0.9 + f.ph) * dt * 0.6;
      e3.set(time * 1.7 + f.ph, time * 1.1, f.ph);
      q.setFromEuler(e3);
      fallIM.setMatrixAt(i, m4.compose(tmp.set(f.x, Math.max(0.02, f.y), f.z), q, sc.set(0.16, 0.12, 0.16)));
    });
    fallIM.instanceMatrix.needsUpdate = true;
  }
  function placeFlies(T: number, dt: number, time: number) {
    const on = T > TL.fly;
    flies.forEach((f, i) => {
      f.g.visible = on && i < S.flies;
      if (!on) return;
      const arrive = ease((T - TL.fly - i * 0.6) / 3); // 멀리서 날아와 제 궤도로
      f.a += f.w * dt;
      const r = f.r + (1 - arrive) * 18, y = f.h + Math.sin(time * 0.7 + f.ph) * 0.8 + (1 - arrive) * 4;
      f.g.position.set(Math.cos(f.a) * r, y, Math.sin(f.a) * r);
      f.g.rotation.set(0, -f.a + (f.w > 0 ? 0 : Math.PI), Math.sign(f.w) * 0.25);
      // 날갯짓: 1초에 약 1.7번, 가끔 미끄러지듯 쉰다
      const beat = Math.sin(time * Math.PI * 2 * 1.7 + f.ph), glide = Math.sin(time * 0.6 + f.ph) > 0.75 ? 0.25 : 1;
      const flap = 0.15 + 0.95 * (0.5 + 0.5 * beat) * glide;
      f.L.rotation.z = flap;
      f.Rw.rotation.z = -flap;
    });
  }

  // 글자판 단계
  const atlas = makeAtlas(THREE);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  const pass = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: asciiVert, fragmentShader: asciiFrag, depthTest: false, depthWrite: false,
    uniforms: { uScene: { value: rt.texture }, uAtlas: { value: atlas }, uGrid: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uBg: { value: new THREE.Vector3(...o.bg) }, uN: { value: GLYPHS.length } },
  });
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pass));

  const treeTop = Math.max(...segs.map((x) => x.b.y), ...blossoms.map((x) => x.p.y)) + 0.6;
  const treeHalfW = Math.max(...segs.map((x) => Math.hypot(x.b.x, x.b.z)), ...blossoms.map((x) => Math.hypot(x.p.x, x.p.z))) + 0.6;
  /** 밑동(씨앗)은 땅 띠의 세로 한가운데·가로 baseX, 나무 꼭대기는 소개 카드 바로 아래에 오게 카메라를 맞춘다. 땅 띠 윗선(0~1)을 알려 준다. */
  function frameCamera(portrait: boolean) {
    const h0 = portrait ? 7 : 5, topNdc = 1 - 2 * Math.min(0.6, Math.max(S.tree.top, o.topLimit?.() ?? S.tree.top));
    const wantX = 2 * S.tree.x - 1, cardX = 2 * (o.cardRight?.() ?? 0) - 1;
    const halfAllowed = Math.max(0.2, Math.min(wantX - cardX - 0.02, 0.96 - wantX)); // 카드와 오른쪽 끝 사이에 들어갈 나무 반폭(NDC)
    let top = 0;
    const aim = (dist: number) => {
      camera.position.set(0, h0, dist);
      let lo = -10, hi = 40;
      for (let k = 0; k < 26; k++) {
        const mid = (lo + hi) / 2;
        camera.lookAt(0, mid, 0);
        camera.updateMatrixWorld();
        const far = V(0, 0, -GROUND_R).project(camera).y, base = V(0, 0, 0).project(camera).y;
        top = far;
        if (base > (far - 1) / 2) lo = mid; else hi = mid;
      }
      const tY = V(0, treeTop, 0).project(camera).y, side = Math.abs(V(treeHalfW, treeTop * 0.6, 0).project(camera).x);
      return tY > topNdc || side > halfAllowed ? 1 : -1; // 1이면 너무 커서 더 멀리
    };
    let lo = 14, hi = 140;
    for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (aim(mid) > 0) lo = mid; else hi = mid; }
    aim(hi);
    // 나무를 왼쪽으로: 카메라를 옆으로 옮겨(볼 방향은 그대로) 밑동이 baseX에 오게 한다
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    let pl = -40, ph = 40;
    for (let k = 0; k < 24; k++) {
      const mid = (pl + ph) / 2;
      camera.position.x = mid;
      camera.lookAt(mid + look.x * 10, camera.position.y + look.y * 10, camera.position.z + look.z * 10);
      camera.updateMatrixWorld();
      if (V(0, 0, 0).project(camera).x > wantX) pl = mid; else ph = mid;
    }
    scene.fog = S.depth.fog > 0.01 ? fog : null;
    fog.near = hi - treeHalfW * 0.2;
    fog.far = hi + (treeHalfW * 2.6) / Math.max(0.05, S.depth.fog); // 클수록 먼 쪽이 더 옅다
    o.onLayout?.((1 - top) / 2);
    // 달은 화면 오른쪽 위, 나무 뒤 먼 곳에
    const dir = V(S.moon.x, S.moon.y, 0.5).unproject(camera).sub(camera.position).normalize();
    moon.position.copy(camera.position).addScaledVector(dir, hi * 2.2);
    moon.lookAt(camera.position);
    moon.scale.setScalar((hi / 40) * S.moon.size);
    moon.visible = S.moon.show;
  }

  let cols = 1, rows = 1, quality = 0; // quality가 오르면 글자 칸을 키워 그릴 양을 줄인다(느린 컴퓨터 대비)
  function resize() {
    const w = Math.max(200, host.clientWidth), hgt = Math.max(200, host.clientHeight);
    renderer.setSize(w, hgt, false);
    const cell = (w < 640 ? S.tree.glyph * 0.9 : S.tree.glyph) + quality * 1.2; // 글자 칸 너비(px). 높이는 너비의 1.75배
    cols = Math.floor(w / cell);
    rows = Math.floor(hgt / (cell * 1.75));
    pass.uniforms.uGrid.value.set(cols, rows);
    rt.setSize(cols * (quality ? 2 : 3), rows * (quality ? 2 : 3));
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    frameCamera(w / hgt < 1);
  }
  resize();

  let T = o.jumpT ?? (o.reduced ? TL.done + 1 : -o.delayMs / 1000), angle = 0.6, turnClock = 0, last = performance.now(), raf = 0, running = true, phase: Phase | null = null;
  const setPhase = (p: Phase) => { if (p !== phase) { phase = p; o.onPhase?.(p); } };
  let ema = 16, frames = 0;
  function frame(now: number) {
    const ms = now - last, dt = Math.min(0.05, ms / 1000);
    last = now;
    // 한 장면에 평균 28ms(초당 약 35장)보다 오래 걸리면 글자 칸을 키운다(최대 두 번)
    if (!o.reduced && ms > 0 && ms < 250) { ema = ema * 0.95 + ms * 0.05; if (++frames > 90 && ema > 28 && quality < 2) { quality++; frames = 0; ema = 16; resize(); } }
    if (!o.reduced) {
      T += dt;
      // 90도 돌고(약 2.4초, 부드럽게 출발·정지) 잠깐 멈춘다(1.6초). 다 자란 뒤에는 더 천천히, 더 오래 멈춘다.
      turnClock += dt;
      const k = T < TL.done ? 0.7 : 1, move = S.turn.moveSec * k, hold = S.turn.holdSec * k, cyc = move + hold;
      const n = Math.floor(turnClock / cyc), u = Math.min(1, (turnClock - n * cyc) / move);
      angle = 0.6 + (n + u * u * (3 - 2 * u)) * ((S.turn.stepDeg * Math.PI) / 180);
    }
    const time = now / 1000;
    world.rotation.y = angle;
    seed.rotation.z = T > TL.crack && T < TL.sprout[0] + 0.6 ? Math.sin(T * 40) * 0.08 : 0;
    const sv = 1 - ease((T - TL.sprout[0]) / 1.2);
    seed.scale.set(0.55 * sv, 0.38 * sv, 0.45 * sv);
    seed.visible = sv > 0.01;
    const cp = ease((T - TL.sprout[0]) / 0.8) * (1 - ease((T - TL.sprout[1]) / 1.2));
    cotyl.forEach((m, i) => { m.scale.set(0.55 * cp, 0.16 * cp, 0.32 * cp); m.rotation.z = (i ? -1 : 1) * (0.35 + Math.sin(time * 2 + i) * 0.08); });
    if (T < TL.done + 3.5 || o.reduced) { placeWood(T); placeLeaves(T, time); }
    placeFlowers(T, time);
    placeFalls(T, dt, time);
    placeFlies(T, dt, time);
    pass.uniforms.uTime.value = time;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
    setPhase(T < TL.sprout[0] ? "seed" : T < TL.sapLeaf[0] + 0.6 ? "sprout" : T < TL.bloom[0] ? "sapling" : T < TL.done ? "bloom" : "done");
    if (running && !o.reduced) raf = requestAnimationFrame(frame);
  }
  const startLoop = () => { if (!running) { running = true; last = performance.now(); frames = 0; raf = requestAnimationFrame(frame); } };
  const stopLoop = () => { running = false; cancelAnimationFrame(raf); };
  raf = requestAnimationFrame(frame);
  // 화면 밖이거나 탭이 숨으면 멈춘다
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? startLoop() : stopLoop()), { threshold: 0.02 });
  io.observe(host);
  const onVis = () => (document.hidden ? stopLoop() : startLoop());
  document.addEventListener("visibilitychange", onVis);
  let rz = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rz); rz = window.setTimeout(() => { resize(); if (!running || o.reduced) requestAnimationFrame(frame); }, 120); });
  ro.observe(host);

  return {
    /** 편집 모드에서 바뀐 값을 바로 반영한다 */
    apply(next: SeedSettings) {
      const prev = S;
      S = next;
      if (next.color.ground !== prev.color.ground) { paintGround(next.color.ground); groundTex.needsUpdate = true; }
      if (next.color.blossom !== prev.color.blossom) paintFlowers(next.color.blossom);
      woodMat.color.set(next.color.wood);
      flyMat.color.set(next.color.butterfly);
      resize();
      if (!running || o.reduced) requestAnimationFrame(frame);
    },
    dispose() {
      stopLoop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      renderer.dispose();
      rt.dispose();
      atlas.dispose();
      groundTex.dispose();
      renderer.domElement.remove();
    },
  };
}
