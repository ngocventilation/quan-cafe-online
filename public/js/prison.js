// Khu "Nhà Tù" – Trại Cải Tạo Bình Minh.
// Trong nhà: dãy 8 phòng giam (song sắt, cửa song tự mở khi có người lại gần, sạp gỗ trải chiếu, giường tầng, cửa sổ nhỏ có song),
// góc trực ban của nữ cán bộ, phòng sinh hoạt chung. Ngoài sân (dựng ở exterior.js → VIEWS.nhatu): tường rào, dây thép gai,
// chòi canh, cổng sắt xanh, 4 trạm lao động. File này thêm phần động: cổng mở/đóng, cửa phòng giam, lợn, cá, cán bộ & phạm nhân NPC,
// pháo giấy mừng ra trại. Trả về đúng giao ước như buildTemple (temple.js) + `prison` (bảng điều khiển cho world.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorTex, labelTex, canvasTex, rand } from './textures.js';
import { buildSurroundings } from './exterior.js';
import * as Pets from './pets.js';
import { makeAvatar, animateAvatar, setSeated, disposeAvatar } from './avatar.js';

const V3 = THREE.Vector3, PI = Math.PI, TAU = PI * 2;
const AV = 0.82; // cùng cỡ nhân vật với world.js
const SEAT = 0.17; // ngồi xếp bằng: gốc nhân vật thấp hơn mặt chỗ ngồi chừng này (seatY = mặt ngồi − SEAT)
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const faceTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z)); // góc quay để nhân vật (mặt hướng -z) nhìn về (tx,tz)
const UPV = new V3(0, 1, 0);

/* ---------- hình khối nhỏ (đã đặt vào toạ độ thế giới) ---------- */
const bx = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); return g.translate(x, y, z); };
const cy = (rt, rb, h, seg, x, y, z) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);
const sp = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
function rod(a, b, r = 0.03, seg = 6) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = Math.max(0.001, d.length());
  return new THREE.CylinderGeometry(r, r, len, seg).applyMatrix4(new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UPV, d.normalize()), new V3(1, 1, 1)));
}
function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/* ---------- họa tiết vẽ canvas ---------- */
function paintTex(H) {
  // tường quét vôi vàng kem, chân tường sơn dầu xanh rêu cao 1,25 m (kiểu nhà công vụ)
  const t = canvasTex(256, 512, (g, w, h) => {
    const dado = h * (1.25 / H);
    g.fillStyle = '#efe2b6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) { g.fillStyle = `rgba(${rand(120, 170) | 0},${rand(100, 140) | 0},${rand(60, 90) | 0},${rand(0.015, 0.05)})`; g.beginPath(); g.arc(rand(0, w), rand(0, h - dado), rand(4, 26), 0, TAU); g.fill(); }
    for (let i = 0; i < 7; i++) { const x = rand(0, w), len = rand(40, 160), gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(90,70,40,.12)'); gr.addColorStop(1, 'rgba(90,70,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, rand(2, 7), len); }
    g.fillStyle = '#5c7b63'; g.fillRect(0, h - dado, w, dado);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,40,25' : '200,220,200'},${rand(0.03, 0.09)})`; g.fillRect(rand(0, w), h - dado + rand(0, dado), rand(1, 4), rand(1, 4)); }
    g.fillStyle = '#34463a'; g.fillRect(0, h - dado - 5, w, 5);
    const gr = g.createLinearGradient(0, h - 22, 0, h); gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(40,30,20,.4)'); g.fillStyle = gr; g.fillRect(0, h - 22, w, 22);
  });
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(0.25, 1 / H);
  return t;
}
const plankTex = (base) => canvasTex(256, 256, (g, w, h) => {
  const n = 6, ph = h / n;
  for (let i = 0; i < n; i++) {
    const k = rand(0.86, 1.08), c = new THREE.Color(base).multiplyScalar(k);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, i * ph, w, ph);
    g.strokeStyle = 'rgba(0,0,0,.14)'; for (let j = 0; j < 5; j++) { const y = i * ph + rand(3, ph - 3); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + rand(-3, 3), (2 * w) / 3, y + rand(-3, 3), w, y); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, i * ph, w, 2);
  }
}, [1, 1]);
const chieuTex = () => canvasTex(256, 256, (g, w, h) => {
  // chiếu cói: sợi đan dọc, viền đỏ – xanh hai đầu
  g.fillStyle = '#d6bd76'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,90,40' : '255,240,190'},${rand(0.08, 0.22)})`; g.fillRect(x, 0, 2, h); }
  for (let y = 0; y < h; y += 6) { g.fillStyle = 'rgba(90,60,20,.12)'; g.fillRect(0, y, w, 1); }
  for (const y of [14, h - 24]) { g.fillStyle = '#b3352a'; g.fillRect(0, y, w, 10); g.fillStyle = '#2f6a46'; g.fillRect(0, y + 12, w, 4); g.fillRect(0, y - 6, w, 4); }
  g.strokeStyle = 'rgba(179,53,42,.55)'; g.lineWidth = 3;
  for (let x = 30; x < w - 20; x += 50) { g.beginPath(); g.moveTo(x, h / 2 - 16); g.lineTo(x + 16, h / 2); g.lineTo(x, h / 2 + 16); g.lineTo(x - 16, h / 2); g.closePath(); g.stroke(); }
});
function starPath(g, cx, cy2, R, r = R * 0.382) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, k = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * k, cy2 + Math.sin(a) * k); } g.closePath(); g.fill(); }
const flagTex = () => canvasTex(192, 128, (g, w, h) => { g.fillStyle = '#d8231b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd21f'; starPath(g, w / 2, h / 2 + 2, h * 0.31); });
const textTex = (w, h, text, { bg = '#1f4e8c', fg = '#ffffff', border = fg, sub, font = 800, subColor = '#fff3d0' } = {}) => canvasTex(w, h, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, bg); gr.addColorStop(1, new THREE.Color(bg).multiplyScalar(0.7).getStyle());
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = Math.max(4, h * 0.05); g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${font} ${Math.round(h * (sub ? 0.4 : 0.56))}px system-ui, sans-serif`; g.fillText(text, w / 2, sub ? h * 0.4 : h * 0.53, w * 0.9);
  if (sub) { g.font = `600 ${Math.round(h * 0.2)}px system-ui, sans-serif`; g.fillStyle = subColor; g.fillText(sub, w / 2, h * 0.76, w * 0.9); }
});
const noticeTex = (title, lines, bg = '#2f5a3e') => canvasTex(512, 640, (g, w, h) => {
  g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(16, 16, w - 32, h - 32);
  g.fillStyle = '#c8231e'; g.fillRect(16, 16, w - 32, 92);
  g.fillStyle = '#ffd54a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 46px system-ui, sans-serif'; g.fillText(title, w / 2, 64, w - 70);
  g.textAlign = 'left'; g.font = '500 30px system-ui, sans-serif'; g.fillStyle = '#f4f0e0';
  lines.forEach((l, i) => g.fillText(l, 44, 160 + i * 74, w - 80));
  for (let i = 0; i < 4; i++) { g.fillStyle = ['#e8d48a', '#9fd4ff', '#ffb0a0', '#c8f0a0'][i]; g.fillRect(30 + i * 118, h - 64, 22, 22); }
});
const shaftTex = () => canvasTex(64, 128, (g, w, h) => {
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,240,200,.9)'); v.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const s = g.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.25, 'rgba(0,0,0,1)'); s.addColorStop(0.75, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
});
const clockTex = () => canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#2a2a2a'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(64 + Math.cos(a) * 48 - 3, 64 + Math.sin(a) * 48 - 3, 6, 6); }
  g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 28); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(64, 64); g.lineTo(92, 74); g.stroke();
  g.fillStyle = '#c8231e'; g.beginPath(); g.arc(64, 64, 5, 0, TAU); g.fill(); void w;
});
const tvTex = () => canvasTex(256, 160, (g, w, h) => {
  const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#5fa8e8'); s.addColorStop(0.6, '#cfe8f6'); s.addColorStop(0.61, '#6fa04a'); s.addColorStop(1, '#3f7a34');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4f8a3a'; g.beginPath(); g.moveTo(0, 100); g.quadraticCurveTo(70, 50, 140, 96); g.quadraticCurveTo(200, 60, 256, 92); g.lineTo(256, 160); g.lineTo(0, 160); g.fill();
  g.fillStyle = 'rgba(20,40,90,.85)'; g.fillRect(0, h - 34, w, 34);
  g.fillStyle = '#fff'; g.font = '700 20px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('BẢN TIN SÁNG · Mùa lúa bội thu', 10, h - 17, w - 20);
});

/* ---------- dự phòng khi pets.js chưa có lợn / cá ---------- */
let PIG = null;
function fallbackPig() {
  PIG ||= { pink: new THREE.MeshStandardMaterial({ color: '#f2a9a4', roughness: 0.6 }), dark: new THREE.MeshStandardMaterial({ color: '#5a2a2a', roughness: 0.5 }),
    body: new THREE.SphereGeometry(0.3, 16, 12).scale(0.85, 0.72, 1.25), head: new THREE.SphereGeometry(0.2, 14, 10), snout: new THREE.CylinderGeometry(0.09, 0.1, 0.1, 14).rotateX(PI / 2),
    ear: new THREE.ConeGeometry(0.07, 0.12, 4), leg: new THREE.CylinderGeometry(0.05, 0.045, 0.2, 8).translate(0, -0.1, 0), eye: new THREE.SphereGeometry(0.025, 8, 6), tail: new THREE.TorusGeometry(0.04, 0.012, 6, 12, PI * 1.6) };
  const root = new THREE.Group(), body = new THREE.Group(), m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; return o; };
  body.add(m(PIG.body, PIG.pink, 0, 0.32, 0), m(PIG.head, PIG.pink, 0, 0.42, 0.36), m(PIG.snout, PIG.pink, 0, 0.4, 0.55));
  for (const s of [-1, 1]) { const e = m(PIG.ear, PIG.pink, s * 0.12, 0.6, 0.32); e.rotation.z = -s * 0.5; body.add(e, m(PIG.eye, PIG.dark, s * 0.08, 0.47, 0.53)); }
  const tail = m(PIG.tail, PIG.pink, 0, 0.38, -0.38); tail.rotation.y = PI / 2; body.add(tail);
  const legs = [[-0.13, 0.2, 0.18], [0.13, 0.2, 0.18], [-0.13, 0.2, -0.18], [0.13, 0.2, -0.18]].map(([x, y, z]) => m(PIG.leg, PIG.pink, x, y, z));
  root.add(body, ...legs);
  return { root, speed: 0.5, anim(t, moving) { legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 9 + (i === 0 || i === 3 ? 0 : PI)) * 0.5 : 0; }); tail.rotation.x = Math.sin(t * 4) * 0.4; body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.02 : Math.sin(t * 1.5) * 0.005; }, dispose() {} };
}
const FISH = new Map();
function fallbackFish(color = '#ff8a3d', scale = 1) {
  if (!FISH.has(color)) FISH.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  const mat = FISH.get(color), root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8).scale(0.75, 0.6, 1.8), mat);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4).scale(0.25, 1, 1).rotateX(-PI / 2).translate(0, 0, -0.07), mat);
  tail.position.z = -0.16; root.add(body, tail); root.scale.setScalar(scale);
  return { root, anim(t) { tail.rotation.y = Math.sin(t * 8) * 0.5; }, dispose() { body.geometry.dispose(); tail.geometry.dispose(); } };
}

/* =====================================================================
   DỰNG KHU TRẠI
   ===================================================================== */
export function buildPrison(scene, theme, quality = 'high') {
  const g = new THREE.Group();
  scene.add(g);
  const [W, D, H] = theme.size;
  const hw = W / 2, hd = D / 2, T = 0.4;
  const hq = quality === 'high';
  const sur = buildSurroundings(scene, theme, quality);
  const Y = sur.prison; // dữ liệu sân lao động (null nếu cảnh ngoài không phải 'nhatu')
  const texs = [], mats = [];
  const M = (p, noCast = false) => { const m = new THREE.MeshStandardMaterial(p); m.userData.noCast = noCast; mats.push(m); if (p.map) texs.push(p.map); return m; };
  const TX = (t) => { texs.push(t); return t; };
  const B = new Map();
  const put = (mat, ...geos) => { if (!B.has(mat)) B.set(mat, []); B.get(mat).push(...geos); };
  const flush = () => {
    for (const [mat, list] of B) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false); list.forEach((x) => x.dispose());
      const m = new THREE.Mesh(geo, mat); m.castShadow = !mat.userData.noCast; m.receiveShadow = true; g.add(m);
    }
    B.clear();
  };
  const plane = (w, h, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m; };

  /* ---------- ánh sáng: nắng qua cửa sổ, đèn tuýp ấm trong nhà ---------- */
  const hemi = new THREE.HemisphereLight(theme.light?.hemi || '#f4f1e6', '#3a3026', hq ? 0.78 : 0.66);
  const keyI = theme.light?.key ?? 1.25;
  const sun = new THREE.DirectionalLight(sur.sun.color, hq ? sur.sun.intensity : keyI);
  const sunAt = new V3(0, 0, Y ? 14 : 0);
  sun.target.position.copy(sunAt);
  sun.position.copy(sur.sun.dir).multiplyScalar(90).add(sunAt);
  sun.castShadow = hq;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = Y ? 46 : Math.max(W, D) * 0.95;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 240 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  if (!hq) sur.boostSun(Math.max(0, sur.sun.intensity - keyI));
  const warm = theme.light?.warm || '#ffe2b0';
  const CH = 2.6, PT = 0.2, CD = Math.min(5.8, D * 0.27), zb = -hd, zf = zb + CD, A = 1.9, cw = (hw - A) / 4, DW = 1.0;
  const lights = [[-hw * 0.52, 4.4, zb + CD / 2, 7, 15], [hw * 0.52, 4.4, zb + CD / 2, 7, 15], [0, 5.2, (zf + hd) / 2, 13, 24]].map(([x, y, z, i, d]) => { const l = new THREE.PointLight(warm, i, d, 1.5); l.position.set(x, y, z); return l; });
  g.add(hemi, sun, sun.target, ...lights);

  /* ---------- vật liệu ---------- */
  const paintM = M({ map: TX(paintTex(H)), roughness: 0.92 });
  const barsM = M({ color: '#3b4c45', roughness: 0.42, metalness: 0.55 });
  const frameM = M({ color: '#4a4f48', roughness: 0.7 });
  const woodM = M({ map: TX(plankTex('#9a6a3e')), roughness: 0.75 });
  const darkWoodM = M({ map: TX(plankTex('#5e3c22')), roughness: 0.6 });
  const matM = M({ map: TX(chieuTex()), roughness: 0.95 });
  const vcM = M({ vertexColors: true, roughness: 0.75 });
  const steelM = M({ color: '#5b7482', roughness: 0.45, metalness: 0.5 });
  const tubeM = M({ color: '#fffaf0', emissive: '#fff1d0', emissiveIntensity: 1.7, roughness: 0.4 }, true);
  const reflM = M({ color: '#dcdad2', roughness: 0.35, metalness: 0.6 }, true);
  const chromeM = M({ color: '#d8dde2', roughness: 0.22, metalness: 0.85 });
  const leafM = M({ color: '#3f7a3e', roughness: 0.6, side: THREE.DoubleSide });
  const potM = M({ color: '#a8583a', roughness: 0.7 });

  /* ---------- sàn gạch, trần, xà ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ map: TX(floorTex(theme.floor || 'tile', [W * 2, D * 2])), color: '#cdbfae', roughness: 0.8 }));
  floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M({ color: '#e2dbc6', emissive: '#4e483c', roughness: 0.95 })); // trần quét vôi (đèn treo thấp nên tự sáng nhẹ cho khỏi tối)
  ceil.rotation.x = PI / 2; ceil.position.y = H; g.add(ceil);
  const beamM = M({ color: theme.roof || '#5b5f55', roughness: 0.7, metalness: 0.3 }, true);
  for (let z = -hd + 1.6; z < hd; z += 3.4) put(beamM, bx(W, 0.32, 0.22, 0, H - 0.16, z));

  /* ---------- tường bao có cửa chính, cửa sổ song sắt ---------- */
  const doorW = 3.0, doorH = 3.1;
  const walls = {
    back: { U: new V3(1, 0, 0), N: new V3(0, 0, -1), o: new V3(0, 0, -hd), len: W, holes: [] },
    front: { U: new V3(1, 0, 0), N: new V3(0, 0, 1), o: new V3(0, 0, hd), len: W, holes: [] },
    right: { U: new V3(0, 0, 1), N: new V3(1, 0, 0), o: new V3(hw, 0, 0), len: D, holes: [] },
    left: { U: new V3(0, 0, 1), N: new V3(-1, 0, 0), o: new V3(-hw, 0, 0), len: D, holes: [] },
  };
  const cells = [];
  for (let i = 0; i < 8; i++) {
    const s = i < 4 ? -1 : 1, k = i < 4 ? 3 - i : i - 4;
    const x1 = s * (A + k * cw), x2 = s * (A + (k + 1) * cw), xa = Math.min(x1, x2), xb = Math.max(x1, x2);
    const L = Math.abs(xa + hw) < 1e-6 ? -hw : xa + PT / 2, R = Math.abs(xb - hw) < 1e-6 ? hw : xb - PT / 2;
    cells.push({ i, xa, xb, xc: (xa + xb) / 2, L, R });
    walls.back.holes.push({ u: (xa + xb) / 2, v0: 1.85, w: 0.9, h: 0.62, win: true });
  }
  for (const u of [-7.5, 7.5, -12, 12]) if (Math.abs(u) < hw - 1.4) walls.front.holes.push({ u, v0: 1.3, w: 2.0, h: 1.5, win: true });
  walls.front.holes.push({ u: 0, v0: 0, w: doorW, h: doorH, door: true });
  for (const side of ['left', 'right']) for (const z of [zf + 3.6, zf + 9.8]) if (z < hd - 1.6) walls[side].holes.push({ u: z, v0: 1.3, w: 2.0, h: 1.5, win: true });
  function wallFace(wl, zdir, len, height, mat, offset) {
    const x = new V3().crossVectors(UPV, zdir), flip = x.dot(wl.U) < 0;
    const holes = wl.holes.map((h) => ({ ...h, u: flip ? -h.u : h.u }));
    const sh = new THREE.Shape();
    sh.moveTo(-len / 2, 0);
    for (const h of holes.filter((q) => q.v0 <= 0.01).sort((a, b) => a.u - b.u)) { sh.lineTo(h.u - h.w / 2, 0); sh.lineTo(h.u - h.w / 2, h.h); sh.lineTo(h.u + h.w / 2, h.h); sh.lineTo(h.u + h.w / 2, 0); }
    sh.lineTo(len / 2, 0); sh.lineTo(len / 2, height); sh.lineTo(-len / 2, height); sh.closePath();
    for (const h of holes.filter((q) => q.v0 > 0.01)) { const p = new THREE.Path(); p.moveTo(h.u - h.w / 2, h.v0); p.lineTo(h.u + h.w / 2, h.v0); p.lineTo(h.u + h.w / 2, h.v0 + h.h); p.lineTo(h.u - h.w / 2, h.v0 + h.h); p.closePath(); sh.holes.push(p); }
    const geo = new THREE.ShapeGeometry(sh, 4);
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, UPV, zdir).setPosition(wl.o.clone().addScaledVector(wl.N, offset)));
    const m = new THREE.Mesh(geo, mat); m.castShadow = offset > 0; m.receiveShadow = true;
    return m;
  }
  const wbox = (wl, u, v, du, dv, dn, n = T / 2) => { const gb = wl.U.x ? new THREE.BoxGeometry(du, dv, dn) : new THREE.BoxGeometry(dn, dv, du); const c = wl.o.clone().addScaledVector(wl.U, u).addScaledVector(wl.N, n); return gb.translate(c.x, v, c.z); };
  const doorM = M({ color: '#2f6b45', roughness: 0.45, metalness: 0.4 });
  for (const wl of Object.values(walls)) {
    g.add(wallFace(wl, wl.N.clone().negate(), wl.len, H, paintM, 0));
    g.add(wallFace(wl, wl.N.clone(), wl.len + 2 * T, H + 0.1, sur.outerWallMaterial, T));
    for (const h of wl.holes) {
      const d = T + 0.12;
      put(frameM, wbox(wl, h.u - h.w / 2 - 0.05, h.v0 + h.h / 2, 0.12, h.h + 0.12, d), wbox(wl, h.u + h.w / 2 + 0.05, h.v0 + h.h / 2, 0.12, h.h + 0.12, d), wbox(wl, h.u, h.v0 + h.h + 0.06, h.w + 0.22, 0.12, d));
      if (h.win) {
        put(frameM, wbox(wl, h.u, h.v0 - 0.05, h.w + 0.3, 0.1, T + 0.24));
        const nb = Math.max(3, Math.floor(h.w / 0.15));
        for (let k = 1; k < nb; k++) { const c = wl.o.clone().addScaledVector(wl.U, h.u - h.w / 2 + (h.w * k) / nb).addScaledVector(wl.N, T / 2); put(barsM, cy(0.022, 0.022, h.h, 6, c.x, h.v0 + h.h / 2, c.z)); }
        put(barsM, wbox(wl, h.u, h.v0 + h.h * 0.5, h.w, 0.035, 0.05));
      }
      if (h.door) for (const s of [-1, 1]) {
        // cửa sắt xanh hai cánh mở toang ra hiên
        const lw = h.w / 2, c = wl.o.clone().addScaledVector(wl.U, h.u + s * (h.w / 2 + 0.05)).addScaledVector(wl.N, T + lw / 2 + 0.05);
        put(doorM, bx(0.07, h.h * 0.98, lw, c.x, h.h / 2, c.z));
        for (let k = 0.3; k < lw - 0.1; k += 0.42) put(doorM, bx(0.1, h.h * 0.9, 0.05, c.x, h.h / 2, c.z - lw / 2 + k));
      }
    }
  }
  // biển "KHU GIAM GIỮ A" phía ngoài trên cửa chính
  const outSign = plane(3.4, 0.64, M({ map: TX(textTex(512, 96, 'KHU GIAM GIỮ A', { bg: '#1f4e8c', sub: '' })), roughness: 0.6 }), 0, doorH + 0.62, hd + T + 0.03);
  outSign.castShadow = false;

  /* ---------- dãy phòng giam ---------- */
  const rects = [];
  const wallUV = (geo) => {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i) + p.getZ(i), H * 0.62); else uv.setXY(i, Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i), p.getY(i)); }
    return geo;
  };
  // vách ngăn giữa các phòng (thấp hơn trần để máy quay nhìn được vào trong)
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = s * (A + k * cw);
    put(paintM, wallUV(bx(PT, CH, CD, x, CH / 2, zb + CD / 2)));
    put(frameM, bx(PT + 0.06, 0.07, CD + 0.03, x, CH + 0.035, zb + CD / 2));
    rects.push([x - PT / 2, zb, x + PT / 2, zf + 0.05]);
  }
  // cánh cửa song sắt (dùng chung một hình, mỗi phòng một bản sao)
  const dl = DW - 0.06, dh = CH - 0.24, doorParts = [];
  doorParts.push(bx(0.05, dh, 0.05, 0.025, dh / 2 + 0.06, 0), bx(0.05, dh, 0.05, dl - 0.025, dh / 2 + 0.06, 0));
  for (const y of [0.09, 1.05, dh + 0.04]) doorParts.push(bx(dl, 0.05, 0.05, dl / 2, y, 0));
  for (let x = 0.13; x < dl - 0.07; x += 0.12) doorParts.push(cy(0.019, 0.019, dh - 0.06, 6, x, dh / 2 + 0.06, 0));
  doorParts.push(bx(0.1, 0.18, 0.09, dl - 0.1, 1.05, 0.05), bx(0.26, 0.14, 0.04, dl / 2, 1.5, 0));
  const doorGeo = mergeGeometries(doorParts, false); doorParts.forEach((x) => x.dispose());
  const doorIM = new THREE.InstancedMesh(doorGeo, barsM, 8);
  doorIM.castShadow = true; doorIM.frustumCulled = false; g.add(doorIM);
  const cushions = [], seatGeo = new THREE.BoxGeometry(0.64, 0.4, 0.62), seatM = new THREE.MeshBasicMaterial({ visible: false });
  const addSeat = (x, z, seatY, ax, az, cell = -1) => {
    const mesh = new THREE.Mesh(seatGeo, seatM); mesh.position.set(x, seatY + 0.15, z); g.add(mesh);
    const cu = { index: cushions.length, pos: new V3(x, 0, z), approach: new V3(ax, 0, az), seatY, mesh, petals: new THREE.Group(), orderGroup: null, occupant: null, cell };
    cushions.push(cu); return cu;
  };
  const BLANKET = ['#2f4a7a', '#7a2f2f', '#4a6a3a', '#5e4a7a', '#2f6a74', '#8a5a2a'];
  for (const c of cells) {
    const { xc, L, R } = c;
    // song sắt mặt trước + khung cửa + xà trên
    put(barsM, bx(R - L, 0.16, 0.14, (L + R) / 2, CH - 0.08, zf), bx(R - L, 0.06, 0.06, (L + R) / 2, 0.08, zf));
    for (const [a, b] of [[L, xc - DW / 2], [xc + DW / 2, R]]) {
      for (let x = a + 0.07; x < b - 0.04; x += 0.125) put(barsM, cy(0.022, 0.022, CH - 0.24, 6, x, CH / 2 - 0.04, zf));
      put(barsM, bx(b - a, 0.04, 0.05, (a + b) / 2, 1.05, zf));
      rects.push([a, zf - 0.07, b, zf + 0.07]);
    }
    put(barsM, bx(0.08, CH, 0.11, xc - DW / 2, CH / 2, zf), bx(0.08, CH, 0.11, xc + DW / 2, CH / 2, zf));
    c.hinge = new V3(xc - DW / 2 + 0.04, 0, zf); c.angle = 0; c.door = new V3(xc, 0, zf);
    // sạp gỗ trải chiếu dọc tường sau, chăn gấp, gối
    const sw = R - L - 0.04, sd = 1.9;
    put(woodM, bx(sw, 0.45, sd, (L + R) / 2, 0.225, zb + sd / 2));
    put(matM, new THREE.PlaneGeometry(sw - 0.3, 1.62).rotateX(-PI / 2).translate((L + R) / 2, 0.455, zb + 0.95));
    for (const sx of [-1, 1]) {
      put(vcM, tint(bx(0.66, 0.13, 0.42, xc + sx * 0.72, 0.52, zb + 0.32), BLANKET[(c.i * 2 + (sx > 0 ? 1 : 0)) % BLANKET.length]));
      put(vcM, tint(bx(0.46, 0.1, 0.26, xc + sx * 0.72, 0.62, zb + 0.32), '#e8e4da'));
      put(vcM, tint(bx(0.11, 0.025, 0.24, xc + sx * 0.66, 0.012, zb + 2.08), '#2a2a2a'), tint(bx(0.11, 0.025, 0.24, xc + sx * 0.66 + 0.14, 0.012, zb + 2.1), '#2a2a2a'));
    }
    rects.push([L, zb, R, zb + sd]);
    c.seats = [-1, 1].map((sx) => addSeat(xc + sx * 0.62, zb + 1.2, 0.455 - SEAT, xc + sx * 0.62, zb + 2.3, c.i));
    // giường tầng sắt bên trái
    const bx0 = L + 0.04, bw = 0.85, bz0 = zb + 2.75, bz1 = zb + 4.55, bzc = (bz0 + bz1) / 2, bxc = bx0 + bw / 2;
    for (const [px, pz] of [[bx0, bz0], [bx0 + bw, bz0], [bx0, bz1], [bx0 + bw, bz1]]) put(steelM, bx(0.05, 1.95, 0.05, px, 0.975, pz));
    for (const y of [0.42, 1.45]) {
      put(steelM, bx(0.04, 0.07, bz1 - bz0, bx0, y, bzc), bx(0.04, 0.07, bz1 - bz0, bx0 + bw, y, bzc), bx(bw, 0.07, 0.04, bxc, y, bz0), bx(bw, 0.07, 0.04, bxc, y, bz1));
      put(vcM, tint(bx(bw - 0.06, 0.1, bz1 - bz0 - 0.08, bxc, y + 0.08, bzc), '#9fb4c6'), tint(bx(0.5, 0.09, 0.28, bxc, y + 0.17, bz0 + 0.22), '#eceae2'));
      put(vcM, tint(bx(bw - 0.1, 0.06, 0.6, bxc, y + 0.15, bz1 - 0.45), BLANKET[(c.i + (y > 1 ? 3 : 0)) % BLANKET.length]));
    }
    for (const y of [0.78, 1.12]) put(steelM, bx(bw, 0.035, 0.035, bxc, y, bz1));
    rects.push([L, bz0 - 0.05, bx0 + bw + 0.05, bz1 + 0.05]);
    c.bunk = { x: bx0 + 0.6, z: bzc, y: 0.55 };
    // kệ nhỏ, ca men, xô nhựa, chậu bên phải
    put(woodM, bx(0.26, 0.04, 1.0, R - 0.13, 1.55, zb + 3.3));
    for (let k = 0; k < 3; k++) put(vcM, tint(cy(0.045, 0.04, 0.1, 10, R - 0.13, 1.62, zb + 2.95 + k * 0.3), ['#f2efe6', '#4f86c6', '#d8423a'][(c.i + k) % 3]));
    put(vcM, tint(cy(0.19, 0.15, 0.36, 14, R - 0.3, 0.18, zb + 3.6), c.i % 2 ? '#2f6ec4' : '#c84232'), tint(cy(0.3, 0.24, 0.1, 16, R - 0.38, 0.05, zb + 4.3), '#8aa0b0'));
    rects.push([R - 0.62, zb + 3.3, R, zb + 4.62]);
    // biển "PHÒNG n" trên cửa
    plane(0.86, 0.28, M({ map: TX(textTex(256, 84, `PHÒNG ${c.i + 1}`, { bg: '#1f4e8c' })), roughness: 0.55 }, true), xc, CH + 0.2, zf + 0.075);
    put(frameM, bx(0.92, 0.34, 0.05, xc, CH + 0.2, zf + 0.04));
    // đèn tuýp treo trên mỗi phòng
    put(tubeM, bx(1.15, 0.05, 0.06, xc, 4.55, zb + CD / 2));
    put(reflM, bx(1.25, 0.04, 0.2, xc, 4.6, zb + CD / 2), rod([xc - 0.5, 4.6, zb + CD / 2], [xc - 0.5, H, zb + CD / 2], 0.008, 4), rod([xc + 0.5, 4.6, zb + CD / 2], [xc + 0.5, H, zb + CD / 2], 0.008, 4));
  }
  const doorM4 = new THREE.Matrix4(), doorQ = new THREE.Quaternion(), ONE = new V3(1, 1, 1);
  const setDoor = (c) => { doorIM.setMatrixAt(c.i, doorM4.compose(c.hinge, doorQ.setFromAxisAngle(UPV, -1.75 * c.angle), ONE)); doorIM.instanceMatrix.needsUpdate = true; };
  cells.forEach(setDoor);
  // vệt nắng xiên qua cửa sổ nhỏ
  const shafts = [];
  for (const c of cells) {
    const q = new THREE.BufferGeometry(), x0 = c.xc - 0.42, x1 = c.xc + 0.42;
    q.setAttribute('position', new THREE.Float32BufferAttribute([x0, 2.45, zb + 0.06, x1, 2.45, zb + 0.06, x0 - 0.12, 0.47, zb + 1.75, x1 + 0.12, 0.47, zb + 1.75], 3));
    q.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    q.setIndex([0, 2, 1, 1, 2, 3]);
    shafts.push(q);
  }
  const shaftMesh = new THREE.Mesh(mergeGeometries(shafts, false), new THREE.MeshBasicMaterial({ map: TX(shaftTex()), color: '#ffe9c0', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mats.push(shaftMesh.material); shafts.forEach((x) => x.dispose()); g.add(shaftMesh);

  /* ---------- góc trực ban: bàn, ghế, cờ, đồng hồ, khẩu hiệu ---------- */
  const dz = zb + 2.45;
  put(darkWoodM, bx(2.3, 0.06, 0.8, 0, 0.76, dz), bx(2.2, 0.7, 0.05, 0, 0.38, dz + 0.36), bx(0.06, 0.73, 0.75, -1.1, 0.365, dz), bx(0.06, 0.73, 0.75, 1.1, 0.365, dz));
  put(darkWoodM, bx(0.48, 0.05, 0.46, 0.15, 0.47, zb + 1.35), bx(0.48, 0.55, 0.05, 0.15, 0.75, zb + 1.12));
  for (const [x, z] of [[-0.06, 1.15], [0.36, 1.15], [-0.06, 1.55], [0.36, 1.55]]) put(steelM, bx(0.035, 0.46, 0.035, x, 0.23, zb + z));
  put(vcM, tint(bx(0.5, 0.03, 0.36, -0.45, 0.805, dz), '#f4f0e2'), tint(bx(0.52, 0.035, 0.37, -0.45, 0.79, dz), '#8a2a22'), tint(bx(0.22, 0.08, 0.16, 0.55, 0.83, dz - 0.15), '#222222'), tint(cy(0.04, 0.04, 0.1, 10, 0.25, 0.84, dz + 0.1), '#f2efe6'));
  put(vcM, tint(bx(0.36, 0.1, 0.26, 0.85, 0.84, dz + 0.05), '#d8c89a'), tint(bx(0.34, 0.08, 0.25, 0.86, 0.93, dz + 0.04), '#3f6a9a'));
  put(steelM, cy(0.08, 0.1, 0.03, 12, -0.9, 0.805, dz - 0.2), rod([-0.9, 0.8, dz - 0.2], [-0.82, 1.22, dz - 0.12], 0.012, 5));
  put(tubeM, new THREE.ConeGeometry(0.11, 0.14, 12, 1, true).translate(-0.8, 1.22, dz - 0.1));
  rects.push([-1.2, dz - 0.45, 1.2, dz + 0.45], [-0.15, zb, 0.45, zb + 1.6]);
  plane(0.72, 0.2, M({ map: TX(textTex(256, 72, 'TRỰC BAN', { bg: '#a3201a', fg: '#ffd54a' })), roughness: 0.6 }, true), 0, 0.5, dz + 0.39);
  plane(1.5, 1.0, M({ map: TX(flagTex()), roughness: 0.8 }, true), 0, 1.95, zb + 0.03);
  const clk = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), M({ map: TX(clockTex()), roughness: 0.5 }, true)); clk.position.set(0, 3.25, zb + 0.04); g.add(clk);
  put(tubeM, bx(1.15, 0.05, 0.06, 0, 4.55, zb + 2.4)); put(reflM, bx(1.25, 0.04, 0.2, 0, 4.6, zb + 2.4));
  plane(Math.min(18, W - 4), 1.05, M({ map: TX(textTex(1600, 92, 'CẢI TẠO TỐT – SỚM VỀ VỚI GIA ĐÌNH', { bg: '#b52a1f', fg: '#ffd54a', border: '#ffd54a', font: 900 })), roughness: 0.65 }, true), 0, 4.75, zb + 0.03);

  /* ---------- phòng sinh hoạt chung: bàn ăn dài, ghế băng, TV, bảng nội quy, quạt trần ---------- */
  const tables = [[-hw * 0.5, zf + 5.6], [hw * 0.5, zf + 5.6], [-hw * 0.5, zf + 9.6], [hw * 0.5, zf + 9.6]].filter(([, z]) => z < hd - 2.5);
  for (const [tx, tz] of tables) {
    put(woodM, bx(3.0, 0.06, 0.82, tx, 0.75, tz));
    for (const sz of [-1, 1]) put(woodM, bx(3.0, 0.05, 0.3, tx, 0.45, tz + sz * 0.72));
    for (const sx of [-1.35, 1.35]) { put(steelM, bx(0.05, 0.72, 0.6, tx + sx, 0.36, tz)); for (const sz of [-1, 1]) put(steelM, bx(0.05, 0.43, 0.24, tx + sx, 0.215, tz + sz * 0.72)); }
    for (let k = -1; k <= 1; k++) {
      put(vcM, tint(cy(0.1, 0.06, 0.07, 14, tx + k, 0.815, tz + 0.18), '#f2efe6'), tint(cy(0.045, 0.042, 0.1, 10, tx + k + 0.2, 0.83, tz + 0.2), k ? '#4f86c6' : '#2f8a5a'));
      addSeat(tx + k, tz + 0.72, 0.475 - SEAT, tx + k, tz + 1.42);
    }
    rects.push([tx - 1.55, tz - 0.9, tx + 1.55, tz + 0.9]);
  }
  // TV trên giá tường trái, bảng nội quy & thi đua tường phải
  put(vcM, tint(bx(0.08, 0.8, 1.32, -hw + 0.12, 2.5, zf + 6.2), '#1c1c1e'), tint(bx(0.3, 0.05, 0.6, -hw + 0.15, 2.07, zf + 6.2), '#3a3a3a'));
  plane(1.18, 0.7, M({ map: TX(tvTex()), emissive: '#ffffff', emissiveMap: texs.at(-1), emissiveIntensity: 0.55, roughness: 0.3 }, true), -hw + 0.165, 2.5, zf + 6.2, PI / 2);
  plane(1.5, 1.88, M({ map: TX(noticeTex('NỘI QUY TRẠI', ['1. Chấp hành nghiêm nội quy', '2. Lao động đúng giờ, đủ việc', '3. Giữ vệ sinh phòng giam', '4. Đoàn kết, giúp đỡ nhau', '5. Học tập, sửa mình mỗi ngày'])), roughness: 0.7 }, true), hw - 0.03, 1.85, zf + 6.0, -PI / 2);
  plane(1.5, 1.88, M({ map: TX(noticeTex('BẢNG THI ĐUA', ['🥬 Tổ trồng rau: Tốt', '🐷 Tổ chăn nuôi: Khá', '🐟 Tổ nuôi cá: Tốt', '⛏️ Tổ đào đá: Xuất sắc', 'Ai ra trại sớm nhất tuần?'], '#1f3f6a')), roughness: 0.7 }, true), hw - 0.03, 1.85, Math.min(hd - 1, zf + 12.2), -PI / 2);
  plane(Math.min(10, W - 10), 0.8, M({ map: TX(textTex(1200, 96, 'HỌC TẬP – LAO ĐỘNG – RÈN LUYỆN', { bg: '#b52a1f', fg: '#ffd54a', font: 900 })), roughness: 0.65 }, true), 0, doorH + 1.2, hd - 0.03, PI);
  // bình nước uống inox + chậu cây cau cảnh hai bên cửa
  const wx = hw - 0.8, wz = hd - 2.3;
  put(chromeM, cy(0.32, 0.32, 0.8, 18, wx, 1.15, wz), cy(0.33, 0.33, 0.04, 18, wx, 1.57, wz)); put(steelM, bx(0.7, 0.75, 0.7, wx, 0.375, wz));
  for (let k = 0; k < 4; k++) put(vcM, tint(cy(0.045, 0.04, 0.1, 10, wx - 0.2 + (k % 2) * 0.12, 0.8, wz + 0.42 + (k > 1 ? 0.1 : 0)), '#f2efe6'));
  rects.push([wx - 0.45, wz - 0.45, wx + 0.45, wz + 0.6]);
  for (const s of [-1, 1]) {
    const px = s * 2.5, pz = hd - 0.85;
    put(potM, cy(0.3, 0.22, 0.5, 14, px, 0.25, pz));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, l = new THREE.SphereGeometry(0.42, 8, 6).scale(0.16, 0.05, 1).translate(0, 0, 0.36).rotateX(-0.75 - (k % 2) * 0.3).rotateY(a); put(leafM, l.translate(px, 1.1, pz)); }
    put(leafM, cy(0.025, 0.03, 0.75, 6, px, 0.85, pz));
    rects.push([px - 0.35, pz - 0.35, px + 0.35, pz + 0.35]);
  }
  // đèn tuýp và quạt trần phòng sinh hoạt
  for (const lx of [-hw * 0.55, 0, hw * 0.55]) for (const lz of [zf + 1.6, zf + 7.6, hd - 2]) {
    put(tubeM, bx(1.15, 0.05, 0.06, lx, 4.6, lz)); put(reflM, bx(1.25, 0.04, 0.2, lx, 4.65, lz), rod([lx, 4.65, lz], [lx, H, lz], 0.01, 4));
  }
  const fans = [];
  const bladeGeo = new THREE.BoxGeometry(0.62, 0.012, 0.13).translate(0.4, 0, 0);
  for (const [tx, tz] of tables.slice(0, 2).map(([x, z]) => [x, z + 2])) {
    put(steelM, rod([tx, H, tz], [tx, H - 1.3, tz], 0.025, 6), cy(0.12, 0.14, 0.14, 14, tx, H - 1.36, tz));
    const fan = new THREE.Group(); fan.position.set(tx, H - 1.42, tz);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bladeGeo, steelM); b.rotation.y = (k / 3) * TAU; b.castShadow = true; fan.add(b); }
    g.add(fan); fans.push(fan);
  }
  flush();

  /* ---------- vật cản ngoài sân + cổng ---------- */
  rects.push(...(sur.rects || []));
  const gateRect = Y?.gate.rect || null;
  let gateOpen = false, gateK = 0;
  const setGate = (open) => {
    gateOpen = !!open;
    if (!gateRect) return;
    const i = rects.indexOf(gateRect);
    if (!gateOpen && i < 0) rects.push(gateRect);
    if (gateOpen && i >= 0) rects.splice(i, 1);
  };
  setGate(false);

  /* ---------- NPC: cán bộ (công an) & phạm nhân, dựng từ nhân vật chibi ---------- */
  const npcs = [];
  const POLICE_ROBE = { color: '#6b7a3c', sash: '#c8231e' }, PRISONER_ROBE = { color: '#7d8a9a', sash: '#e8ecef' };
  function addNpc(o) {
    const av = makeAvatar({ appearance: { gender: o.gender || 'nam', hair: o.hair || 'ngan', skin: o.skin || '#d9a07a' }, outfit: o.outfit, tool: o.tool, robe: o.police ? POLICE_ROBE : PRISONER_ROBE });
    setSeated(av, !!o.seat);
    av.root.scale.setScalar(AV);
    av.baseY = o.seat ? 0.17 + o.seat : o.y || 0;
    av.root.position.set(o.x, av.baseY, o.z);
    av.root.rotation.y = o.rot || 0;
    av.work = o.work || null;
    if (o.meditating) av.meditating = true;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(o.name, o.sub, o.police ? '#ffd36b' : '#cfe0ef'), depthWrite: false, transparent: true }));
    label.scale.set(2.1 / AV, 0.52 / AV, 1); label.position.y = o.seat ? 1.95 : 2.2; label.visible = false;
    av.root.add(label);
    scene.add(av.root);
    const n = { av, label, role: o.role || null, police: !!o.police, rot: o.rot || 0, work: o.work || null, near: o.police ? 15 : 6, walk: o.walk || null, y: o.y || 0, frame: (Math.random() * 8) | 0 };
    npcs.push(n);
    return n;
  }
  addNpc({ role: 'nu', police: true, outfit: 'congan_nu', gender: 'nu', hair: 'bui', skin: '#e8b48e', name: 'Cán bộ Thu Hà', sub: 'Trực ban · lại gần để trò chuyện', x: 0, z: zb + 1.62, rot: PI });
  const inCell = [[1, 'Anh Út', 'Phạm nhân · đọc thư nhà', false, '#c98d64'], [6, 'Bác Tám', 'Phạm nhân · ngồi tĩnh tâm', true, '#b97c55']];
  for (const [ci, name, sub, med, skin] of inCell) { const c = cells[ci]; addNpc({ outfit: 'phamnhan', hair: 'troc', skin, name, sub, x: c.bunk.x, z: c.bunk.z, seat: c.bunk.y - SEAT, rot: -PI / 2, meditating: med }); }
  let guard = null, officer = null;
  if (Y) {
    const gy = Y.gy;
    officer = addNpc({ role: 'quangiao', police: true, outfit: 'congan', tool: 'clipboard', hair: 'ngan', skin: '#d9a07a', name: 'Quản giáo Minh', sub: 'Quản giáo · lại gần để trò chuyện', x: Y.patrol[0][0], y: gy, z: Y.patrol[0][1], walk: { i: 1, wait: 1 } });
    guard = addNpc({ role: 'gac', police: true, outfit: 'congan', tool: 'baton', hair: 'ngan', skin: '#c98d64', name: 'Cán bộ Dũng', sub: 'Gác cổng trại', x: Y.guard[0], y: gy, z: Y.guard[1], rot: 0 });
    const WHO = { trongrau: [['Anh Tư', 'đang tưới rau'], ['Chú Ba', 'đang xới đất']], nuoilon: [['Chú Bảy', 'đang cho lợn ăn']], nuoica: [['Anh Sáu', 'đang vớt cá']], daoda: [['Anh Hai', 'đang đập đá']] };
    const SK = ['#d9a07a', '#c98d64', '#e2b08a', '#b97c55', '#d18a5e', '#c4875e'];
    let k = 0;
    for (const [id, st] of Object.entries(Y.stations)) st.npcs.forEach((p, j) => {
      const [name, sub] = WHO[id]?.[j] || ['Phạm nhân', 'đang lao động'];
      addNpc({ outfit: 'phamnhan', tool: p.tool, work: p.work, hair: 'troc', skin: SK[k++ % SK.length], name, sub: 'Phạm nhân · ' + sub, x: p.x, y: gy, z: p.z, rot: faceTo(p.x, p.z, p.look[0], p.look[1]) });
    });
  }
  let saluteT = 0, npcOn = true;

  /* ---------- lợn trong chuồng, cá trong ao ---------- */
  const pigs = [], fish = [];
  if (Y) {
    const P = Y.pen;
    for (let i = 0; i < 3; i++) {
      const pet = Pets.makePet({ model: 'lon', scale: 1 }, hq) || fallbackPig();
      const x = rand(P.x0, P.x1), z = rand(P.z0 + 3, P.z1);
      pet.root.position.set(x, P.y, z); pet.root.rotation.y = rand(0, TAU);
      scene.add(pet.root);
      pigs.push({ pet, tx: x, tz: z, wait: rand(0, 3), s: 1.5 + i * 0.12 });
    }
    const pd = Y.pond, COLORS = ['#8a949a', '#9aa2a6', '#ff8a3d', '#f4f0e8', '#ffb43d', '#8a949a', '#e85a3a', '#a8b0b4'];
    for (let i = 0; i < COLORS.length; i++) {
      const sc = rand(1.5, 2.1), f = Pets.makeFish?.({ color: COLORS[i], scale: sc }) || fallbackFish(COLORS[i], sc);
      const rx = rand(1.2, pd.w / 2 - 1.6), rz = rand(0.7, pd.d / 2 - 1.1);
      const cx = pd.cx + rand(-1, 1) * (pd.w / 2 - 0.9 - rx), cz = pd.cz + rand(-1, 1) * (pd.d / 2 - 0.8 - rz);
      scene.add(f.root);
      fish.push({ f, cx, cz, rx, rz, sp: rand(0.22, 0.5) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU), y: pd.y - rand(0.1, 0.24) });
    }
  }
  let fishOn = fish.length;

  /* ---------- pháo giấy mừng ra trại ---------- */
  const CONF = 240, confM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
  mats.push(confM);
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.06), confM, CONF);
  conf.setColorAt(0, new THREE.Color(1, 1, 1)); // tạo sẵn màu từng mảnh để shader biên dịch kèm
  conf.count = 0; conf.frustumCulled = false; g.add(conf);
  const parts = Array.from({ length: CONF }, () => ({ p: new V3(), v: new V3(), r: new THREE.Euler(), w: new V3() }));
  const PAL = ['#ff4d4d', '#ffd54a', '#4dd2ff', '#7dff6a', '#ff7ad9', '#ffffff', '#ff9a3d'].map((h) => new THREE.Color(h));
  let confT = 0;
  const cq = new THREE.Quaternion(), cm = new THREE.Matrix4(), cs = new V3();
  function celebrate(at = new V3(0, 0, zf + 6)) {
    parts.forEach((q, i) => {
      q.p.set(at.x + rand(-1.2, 1.2), (at.y || 0) + rand(1.6, 2.6), at.z + rand(-1.2, 1.2));
      q.v.set(rand(-3, 3), rand(4.5, 9), rand(-3, 3));
      q.r.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); q.w.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
      conf.setColorAt(i, PAL[i % PAL.length]);
    });
    conf.instanceColor.needsUpdate = true; conf.count = CONF; confT = 5;
  }

  /* ---------- phòng của người chơi: nhãn nổi trên cửa ---------- */
  let myCell = -1, myLabel = null;
  function markCell(i) {
    if (i === myCell) return;
    if (myLabel) { g.remove(myLabel); myLabel.material.map.dispose(); myLabel.material.dispose(); myLabel = null; }
    myCell = Number.isInteger(i) && cells[i] ? i : -1;
    if (myCell < 0) return;
    const c = cells[myCell];
    myLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(`PHÒNG ${myCell + 1}`, 'Phòng giam của bạn', '#ffd36b'), depthWrite: false, transparent: true }));
    myLabel.scale.set(1.7, 0.42, 1); myLabel.position.set(c.xc, CH + 0.95, zf + 0.2); g.add(myLabel);
  }
  function setProgress(tasks) {
    const k = {};
    for (const t of Array.isArray(tasks) ? tasks : []) k[t.id] = Math.min(1, (t.done || 0) / Math.max(1, t.need || 1));
    const has = Array.isArray(tasks) && tasks.length;
    Y?.grow?.(has ? 0.25 + 0.75 * (k.trongrau || 0) : 0.75);
    Y?.stones?.(has ? k.daoda || 0 : 0.6);
    pigs.forEach((p, i) => { p.s = (has ? 1.3 + 0.4 * (k.nuoilon || 0) : 1.55) + i * 0.1; });
    fishOn = Math.min(fish.length, has ? 4 + Math.round(4 * (k.nuoica || 0)) : fish.length);
    fish.forEach((f, i) => { f.f.root.visible = i < fishOn; });
  }
  setProgress(null);

  /* ---------- tìm đường qua cửa phòng giam (chạm để đi, tự đi về sạp) ---------- */
  const cellAt = (x, z) => { if (z >= zf || z < zb) return -1; for (const c of cells) if (x > c.xa && x < c.xb) return c.i; return -1; };
  function route(from, to) {
    const a = cellAt(from.x, from.z), b = cellAt(to.x, to.z), pts = [];
    const deep = (z) => THREE.MathUtils.clamp(z, zb + 2.25, zf - 0.7);
    if (a !== b) {
      if (a >= 0) { const c = cells[a]; pts.push(new V3(c.xc, 0, deep(from.z)), new V3(c.xc, 0, zf - 0.7), new V3(c.xc, 0, zf + 0.9)); }
      if (b >= 0) { const c = cells[b]; pts.push(new V3(c.xc, 0, zf + 0.9), new V3(c.xc, 0, zf - 0.7), new V3(c.xc, 0, deep(to.z))); }
    } else if (a >= 0 && to.z < zb + 2.4 && Math.abs(from.x - to.x) > 0.3) pts.push(new V3(cells[a].xc, 0, deep(from.z)), new V3(cells[a].xc, 0, zb + 2.25));
    pts.push(new V3(to.x, 0, to.z));
    return pts.filter((p, i) => i === pts.length - 1 || Math.hypot(p.x - from.x, p.z - from.z) > 0.12);
  }

  /* ---------- bảng điều khiển cho world.js ---------- */
  const stations = Y?.stations || {};
  const api = {
    cells: cells.map((c) => ({ i: c.i, xc: c.xc, inside: new V3(c.xc, 0, zf - 0.8), outside: new V3(c.xc, 0, zf + 1.0), seats: c.seats })),
    stations, gateZ: Y?.gate.z ?? null,
    get gateOpen() { return gateOpen; },
    cellAt,
    stationAt(x, z) { for (const [id, s] of Object.entries(stations)) { const [x0, z0, x1, z1] = s.area; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return id; } return null; },
    policeNear(x, z, d = 2.8) { let best = null, bd = d; for (const n of npcs) { if (!n.police) continue; const p = n.av.root.position, dd = Math.hypot(p.x - x, p.z - z); if (dd < bd) { bd = dd; best = n.role; } } return best; },
    nearGate(x, z) { return !!Y && Math.hypot(x, z - Y.gate.z) < 6.5; },
    hitNpc(ray) { for (const n of npcs) if (n.av.root.visible && ray.intersectObject(n.av.root, true).length) return { role: n.role, police: n.police, pos: n.av.root.position.clone() }; return null; },
    setGate, markCell, setProgress, celebrate,
    salute(sec = 8) { saluteT = sec; if (guard) guard.av.work = 'salute'; },
    setNpcVisible(on) { npcOn = !!on; npcs.forEach((n) => { if (!n.police) n.av.root.visible = npcOn; }); },
  };

  const bounds = { minX: -hw + 0.3, maxX: hw - 0.3, minZ: zb + 0.3, maxZ: hd - 1 };
  return {
    group: g, cushions, bounds, altarZ: zb, tableZ: zf, height: H,
    spawn: new V3(0, 0, hd - 3.2), rects, route, prison: api,
    // máy quay không hạ thấp hơn đỉnh vách khi người chơi ở trong / trước dãy phòng giam
    camMinY: (x, z) => (z < zf + 1.4 && Math.abs(x) > A - 0.3 ? CH + 0.6 : 0.6),
    setStele() {}, steleFace: null, setMerit() {}, meritStele: null, setTableOrder() {}, setRainMode() {},
    launchFireworks() { celebrate(); },
    outdoor: { group: sur.group, groundY: sur.groundY ?? 0, doorW, hw, hd, W, D, H, cable: null, walkR: sur.walkR || 0, blocks: sur.blocks, noGarden: sur.noGarden, forest: sur.forest },
    setCushionLook() {},
    addIncense() {}, brightenCandles() {}, offerFlowers() { celebrate(); },
    update(dt, time, world) {
      sur.update(dt, time);
      const me = world?.player?.root.position;
      // cửa phòng giam tự mở khi có người đứng gần
      for (const c of cells) {
        let open = me && Math.hypot(me.x - c.xc, me.z - zf) < 1.7;
        if (!open && world?.remotes) for (const r of world.remotes.values()) { const p = r.av.root.position; if (Math.hypot(p.x - c.xc, p.z - zf) < 1.7) { open = true; break; } }
        const want = open ? 1 : 0;
        if (c.angle !== want) { c.angle = want > c.angle ? Math.min(1, c.angle + dt * 1.6) : Math.max(0, c.angle - dt * 1.1); setDoor(c); }
      }
      // cổng trại
      const gw = gateOpen ? 1 : 0;
      if (Y && gateK !== gw) { gateK = gw > gateK ? Math.min(1, gateK + dt * 0.45) : Math.max(0, gateK - dt * 0.6); const e = gateK * gateK * (3 - 2 * gateK); Y.gate.leaves[0].rotation.y = -1.45 * e; Y.gate.leaves[1].rotation.y = 1.45 * e; }
      for (const f of fans) f.rotation.y += dt * 7;
      // NPC
      const showN = world?.showNames !== false, low = (world?.perfLevel || 0) >= 3;
      if (saluteT > 0 && (saluteT -= dt) <= 0 && guard) guard.av.work = null;
      for (const n of npcs) {
        const R = n.av.root;
        if (!R.visible) continue;
        if (low && !n.police) continue;
        let moving = false;
        const d = me ? Math.hypot(R.position.x - me.x, R.position.z - me.z) : 99;
        if (n.walk) {
          const w = n.walk, tgt = Y.patrol[w.i];
          if (d < 3.2) { R.rotation.y = lerpAngle(R.rotation.y, faceTo(R.position.x, R.position.z, me.x, me.z), Math.min(1, dt * 4)); }
          else if (w.wait > 0) {
            w.wait -= dt;
            if (w.look) R.rotation.y = lerpAngle(R.rotation.y, faceTo(R.position.x, R.position.z, w.look[0], w.look[1]), Math.min(1, dt * 3));
            if (w.wait <= 0) w.i = (w.i + 1) % Y.patrol.length;
          } else {
            const dx = tgt[0] - R.position.x, dz2 = tgt[1] - R.position.z, dd = Math.hypot(dx, dz2);
            if (dd < 0.08) { w.wait = tgt[2] ? rand(4, 7) : 0.3; w.look = tgt[2] ? stations[tgt[2]]?.look : null; }
            else { const st = Math.min(dd, 1.1 * dt); R.position.x += (dx / dd) * st; R.position.z += (dz2 / dd) * st; R.rotation.y = lerpAngle(R.rotation.y, Math.atan2(-dx, -dz2), Math.min(1, dt * 6)); moving = true; }
          }
          if (moving && (n.frame++ % 8 === 0) && world?.groundAt && world.walkMeshes) { const gyy = world.groundAt(R.position.x, R.position.z, n.y); if (gyy !== null && gyy !== undefined) n.y = gyy; }
          n.av.baseY = n.y;
        } else if (n.police && me) {
          const want = d < 4.5 || (n === guard && saluteT > 0) ? faceTo(R.position.x, R.position.z, me.x, me.z) : n.rot;
          R.rotation.y = lerpAngle(R.rotation.y, want, Math.min(1, dt * 3));
        }
        n.label.visible = showN && d < n.near;
        animateAvatar(n.av, dt, time, moving);
      }
      // lợn đi lại trong chuồng
      if (Y) {
        const P = Y.pen;
        for (const p of pigs) {
          const Rt = p.pet.root, dx = p.tx - Rt.position.x, dz2 = p.tz - Rt.position.z, dd = Math.hypot(dx, dz2);
          let moving = false;
          if (dd > 0.1) { const st = Math.min(dd, 0.5 * dt); Rt.position.x += (dx / dd) * st; Rt.position.z += (dz2 / dd) * st; Rt.rotation.y = lerpAngle(Rt.rotation.y, Math.atan2(dx, dz2), Math.min(1, dt * 3)); moving = true; }
          else if ((p.wait -= dt) <= 0) {
            p.wait = rand(2.5, 7);
            // thỉnh thoảng ra máng ăn
            if (Math.random() < 0.35) { p.tx = P.x0 + 0.7; p.tz = rand(P.z0 + 3.5, P.z1 - 1.5); } else { p.tx = rand(P.x0 + 0.4, P.x1); p.tz = rand(P.z0 + 3.2, P.z1); }
          }
          Rt.scale.setScalar(p.s * AV);
          p.pet.anim(time, moving);
        }
        for (let i = 0; i < fishOn; i++) {
          const f = fish[i], a = f.ph + time * f.sp;
          const x = f.cx + Math.cos(a) * f.rx, z = f.cz + Math.sin(a) * f.rz;
          const vx = -Math.sin(a) * f.rx * Math.sign(f.sp), vz = Math.cos(a) * f.rz * Math.sign(f.sp);
          f.f.root.position.set(x, f.y + Math.sin(time * 1.7 + f.ph) * 0.03, z);
          f.f.root.rotation.y = Math.atan2(vx, vz);
          f.f.anim?.(time);
        }
      }
      // pháo giấy
      if (confT > 0) {
        confT -= dt;
        for (let i = 0; i < CONF; i++) {
          const q = parts[i];
          q.v.y -= 7 * dt; q.v.multiplyScalar(1 - Math.min(0.9, dt * 1.6));
          q.p.addScaledVector(q.v, dt); q.p.x += Math.sin(time * 3 + i) * dt * 0.4;
          q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
          const s = confT > 1 ? 1 : Math.max(0, confT);
          conf.setMatrixAt(i, cm.compose(q.p, cq.setFromEuler(q.r), cs.set(s, s, s)));
        }
        conf.instanceMatrix.needsUpdate = true;
        if (confT <= 0) conf.count = 0;
      }
    },
    dispose() {
      sur.dispose();
      scene.remove(g);
      npcs.forEach((n) => disposeAvatar(n.av));
      pigs.forEach((p) => { p.pet.root.removeFromParent(); p.pet.dispose?.(); });
      fish.forEach((f) => { f.f.root.removeFromParent(); f.f.dispose?.(); });
      if (myLabel) { myLabel.material.map.dispose(); myLabel.material.dispose(); }
      g.traverse((o) => { o.geometry?.dispose?.(); });
      doorIM.dispose(); conf.dispose(); seatGeo.dispose(); seatM.dispose(); bladeGeo.dispose();
      mats.forEach((m) => m.dispose()); texs.forEach((t) => t?.dispose?.());
    },
  };
}
