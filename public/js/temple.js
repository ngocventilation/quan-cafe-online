// Dựng chánh điện theo "theme" của từng chùa (lưu trong DB, admin chỉnh được tên/mô tả).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorTex, rockTex, muralTex, softDot, rand } from './textures.js';
import { buildStatue } from './statues.js';
import { buildSurroundings } from './exterior.js';
import { lotusPad, lotusPadColor, makeLotusPetals } from './lotus.js';
import { cushionGeo, cushionColor, cushionMaterial, cushionMap, setCushionFabric, rugTex } from './cushion.js';

function mk(geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.scale) m.scale.set(...o.scale);
  if (o.rot) m.rotation.set(...o.rot);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  return m;
}

const WALL = {
  wood: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
  lacquer: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }),
  plaster: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }),
  bronze: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.6 }),
  khmer: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }),
};
const FRAME = { wood: '#3a2416', lacquer: '#5a1208', plaster: '#6a4a30', bronze: '#4a3820', khmer: '#b07a18' };

export function buildTemple(scene, theme, quality = 'high') {
  const g = new THREE.Group();
  scene.add(g);
  const [W, D, H] = theme.size;
  const hw = W / 2, hd = D / 2;
  const isCave = theme.wall === 'rock';
  const flames = [], updaters = [];

  const hq = quality === 'high';
  // thế giới bên ngoài (trời, núi, nước, cây…) + nền trời/sương cho scene
  const sur = buildSurroundings(scene, theme, quality);

  /* ---------- ánh sáng ---------- */
  const hemi = new THREE.HemisphereLight(theme.light?.hemi || '#ffe2b8', '#2a1a10', hq ? 0.72 : 0.6);
  // nắng thật theo hướng mặt trời của cảnh; khi có bóng đổ, tường & mái che nắng nên chỉ lọt qua cửa
  const keyI = theme.light?.key ?? 1.4;
  const sun = new THREE.DirectionalLight(sur.sun.color, hq ? sur.sun.intensity : keyI);
  sun.position.copy(sur.sun.dir).multiplyScalar(70);
  sun.castShadow = hq;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = Math.max(W, D) * 0.95;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  if (!hq) sur.boostSun(Math.max(0, sur.sun.intensity - keyI));
  const altarZ = -hd + 2.6;
  const spot = new THREE.SpotLight('#ffd99a', 60 * (H / 9), H * 3.5, 0.55, 0.6, 1.5);
  spot.position.set(0, H - 0.5, altarZ + 8);
  spot.target.position.set(0, 3, altarZ);
  g.add(hemi, sun, spot, spot.target);

  /* ---------- sàn ---------- */
  const fmat = new THREE.MeshStandardMaterial({ map: floorTex(theme.floor, [W, D]), roughness: theme.floor === 'wood' ? 0.55 : 0.75 });
  g.add(mk(new THREE.PlaneGeometry(W, D), fmat, 0, 0, 0, { rot: [-Math.PI / 2, 0, 0], cast: false }));

  /* ---------- tường / hang đá ---------- */
  if (isCave) {
    const A = hw + 1.5, Cz = hd + 1.5, M = sur.mouth;
    const geo = new THREE.SphereGeometry(1, 64, 40, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = 1 + Math.sin(x * 7 + z * 3) * 0.05 + Math.sin(y * 11 + x * 5) * 0.04 + Math.cos(z * 9) * 0.04;
      pos.setXYZ(i, x * n, y * n, z * n);
    }
    // khoét cửa động phía trước (bỏ các tam giác nằm trong elip miệng hang)
    const idx = geo.index.array, keep = [];
    const inMouth = (i) => {
      const wx = pos.getX(i) * A, wy = pos.getY(i) * H - 0.3, wz = pos.getZ(i) * Cz;
      return wz > 0 && (wx / (M.rx * 1.06)) ** 2 + ((wy - M.cy) / (M.ry * 1.06)) ** 2 < 1;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (inMouth(a) || inMouth(b) || inMouth(c)) continue;
      keep.push(a, b, c);
    }
    geo.setIndex(keep);
    geo.computeVertexNormals();
    const rock = new THREE.MeshStandardMaterial({ map: rockTex(), color: theme.wallColor, roughness: 0.95, side: THREE.BackSide, shadowSide: THREE.DoubleSide });
    const dome = mk(geo, rock, 0, -0.3, 0, { scale: [A, H, Cz], cast: true });
    g.add(dome);
    // đường hầm cửa động nối vòm hang với vách núi bên ngoài
    const tun = [], tIdx = [], K = 10, S = 48;
    for (let k = 0; k <= K; k++) {
      const t = k / K;
      for (let j = 0; j <= S; j++) {
        const a = (j / S) * Math.PI * 2;
        const wob = 1.3 + 0.08 * Math.sin(a * 3 + k * 1.3) + 0.04 * Math.sin(a * 7 - k);
        const x = Math.cos(a) * M.rx * wob, y = Math.max(-0.4, M.cy + Math.sin(a) * M.ry * wob);
        // điểm khởi đầu nằm ngay trên mặt vòm (cùng hàm nhiễu với vòm) để ống không lòi vào trong hang
        const ux = x / A, uy = (y + 0.3) / H, uz = Math.sqrt(Math.max(0.02, 1 - ux * ux - uy * uy));
        const nn = (1 + Math.sin(ux * 7 + uz * 3) * 0.05 + Math.sin(uy * 11 + ux * 5) * 0.04 + Math.cos(uz * 9) * 0.04) * 1.0;
        const sx = ux * nn * A, sy = uy * nn * H - 0.3, sz = uz * nn * Cz;
        tun.push(THREE.MathUtils.lerp(sx, x, t), THREE.MathUtils.lerp(sy, y, t), THREE.MathUtils.lerp(sz, M.z + 0.6, t));
      }
    }
    for (let k = 0; k < K; k++) for (let j = 0; j < S; j++) { const a = k * (S + 1) + j, b = a + S + 1; tIdx.push(a, b, a + 1, b, b + 1, a + 1); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tun, 3));
    const tuv = []; for (let i = 0; i < tun.length; i += 3) tuv.push(tun[i] * 0.15 + tun[i + 2] * 0.1, tun[i + 1] * 0.15);
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
    tg.setIndex(tIdx); tg.computeVertexNormals();
    g.add(mk(tg, new THREE.MeshStandardMaterial({ map: rockTex(), color: theme.wallColor, roughness: 0.95, shadowSide: THREE.DoubleSide }), 0, 0, 0, { cast: true }));
    // nền đá nối ra bậc thềm ngoài cửa động
    g.add(mk(new THREE.PlaneGeometry(M.rx * 2.6, M.z - hd + 3), new THREE.MeshStandardMaterial({ map: floorTex(theme.floor, [M.rx * 2.6, M.z - hd + 3]), roughness: 0.8 }), 0, 0.004, (hd + M.z) / 2 + 0.5, { rot: [-Math.PI / 2, 0, 0], cast: false }));
    // nhũ đá
    const sm = new THREE.MeshStandardMaterial({ color: '#8a8070', roughness: 0.6 });
    for (let i = 0; i < (hq ? 70 : 35); i++) {
      const x = rand(-hw, hw), z = rand(-hd, hd);
      const r = Math.hypot(x / A, z / Cz);
      if (r > 0.95) continue;
      if (z > 0 && Math.abs(x) < M.rx * 1.2 && r > 0.6) continue;
      const top = H * Math.sqrt(Math.max(0.05, 1 - r * r)) * 0.95 - 0.3;
      const len = rand(0.6, 2.6);
      g.add(mk(new THREE.ConeGeometry(rand(0.08, 0.3), len, 8), sm, x, top - len / 2, z, { rot: [Math.PI, 0, 0], cast: false }));
    }
    const mouthLight = new THREE.PointLight('#e8ffe0', 30, 30, 1.2);
    mouthLight.position.set(0, 4, hd - 1);
    g.add(mouthLight);
  } else {
    const wm = WALL[theme.wall](theme.wallColor);
    const outerM = sur.outerWallMaterial;
    const frameCol = FRAME[theme.wall] || '#3a2416';
    const T = 0.4;
    const winH = Math.min(3.8, H * 0.42), winY = Math.min(H * 0.5, 4.4);
    const nWin = Math.max(2, Math.round(D / 7));
    // các ô cửa thật (u: toạ độ dọc tường theo trục thế giới, v0: chân cửa)
    const walls = {
      back: { U: new THREE.Vector3(1, 0, 0), N: new THREE.Vector3(0, 0, -1), o: new THREE.Vector3(0, 0, -hd), len: W, holes: [] },
      front: { U: new THREE.Vector3(1, 0, 0), N: new THREE.Vector3(0, 0, 1), o: new THREE.Vector3(0, 0, hd), len: W, holes: [] },
      right: { U: new THREE.Vector3(0, 0, 1), N: new THREE.Vector3(1, 0, 0), o: new THREE.Vector3(hw, 0, 0), len: D, holes: [] },
      left: { U: new THREE.Vector3(0, 0, 1), N: new THREE.Vector3(-1, 0, 0), o: new THREE.Vector3(-hw, 0, 0), len: D, holes: [] },
    };
    for (const side of ['left', 'right']) for (let i = 0; i < nWin; i++) {
      const z = -hd + 3 + ((D - 5) / nWin) * (i + 0.5);
      if (z < altarZ + 1.5 && !theme.windowsAllSides) continue;
      walls[side].holes.push({ u: z, v0: winY - winH / 2, w: Math.min(4.2, D / nWin - 1), h: winH, win: true });
    }
    const doorW = Math.min(6, W * 0.3), doorH = Math.min(5, H * 0.6);
    walls.front.holes.push({ u: 0, v0: 0, w: doorW, h: doorH, door: true });
    if (theme.windowsAllSides) for (const x of [-hw * 0.6, hw * 0.6]) walls.front.holes.push({ u: x, v0: winY - winH / 2, w: Math.min(W * 0.26, 3.6), h: winH, win: true });

    const UP = new THREE.Vector3(0, 1, 0);
    function wallFace(wl, zdir, len, height, mat, offset) {
      const x = new THREE.Vector3().crossVectors(UP, zdir);
      const flip = x.dot(wl.U) < 0;
      const holes = wl.holes.map((h) => ({ ...h, u: flip ? -h.u : h.u }));
      const sh = new THREE.Shape();
      sh.moveTo(-len / 2, 0);
      for (const h of holes.filter((q) => q.v0 <= 0.01).sort((a, b) => a.u - b.u)) {
        sh.lineTo(h.u - h.w / 2, 0); sh.lineTo(h.u - h.w / 2, h.h); sh.lineTo(h.u + h.w / 2, h.h); sh.lineTo(h.u + h.w / 2, 0);
      }
      sh.lineTo(len / 2, 0); sh.lineTo(len / 2, height); sh.lineTo(-len / 2, height); sh.closePath();
      for (const h of holes.filter((q) => q.v0 > 0.01)) {
        const p = new THREE.Path();
        p.moveTo(h.u - h.w / 2, h.v0); p.lineTo(h.u + h.w / 2, h.v0); p.lineTo(h.u + h.w / 2, h.v0 + h.h); p.lineTo(h.u - h.w / 2, h.v0 + h.h); p.closePath();
        sh.holes.push(p);
      }
      const geo = new THREE.ShapeGeometry(sh, 4);
      const m = new THREE.Matrix4().makeBasis(x, UP, zdir).setPosition(wl.o.clone().addScaledVector(wl.N, offset));
      geo.applyMatrix4(m);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = offset > 0; mesh.receiveShadow = true;
      return mesh;
    }
    const frameParts = [], barParts = [];
    const box = (wl, u, v, du, dv, dn, n = T / 2) => {
      const gb = wl.U.x ? new THREE.BoxGeometry(du, dv, dn) : new THREE.BoxGeometry(dn, dv, du);
      const c = wl.o.clone().addScaledVector(wl.U, u).addScaledVector(wl.N, n); c.y = v;
      gb.translate(c.x, c.y, c.z);
      return gb;
    };
    const doorMat = new THREE.MeshStandardMaterial({ color: theme.wall === 'khmer' ? '#7a1e10' : theme.wall === 'plaster' ? '#7a3a1e' : '#5a160c', roughness: 0.5 });
    const doorLeaves = [];
    for (const wl of Object.values(walls)) {
      g.add(wallFace(wl, wl.N.clone().negate(), wl.len, H, wm, 0));
      g.add(wallFace(wl, wl.N.clone(), wl.len + 2 * T, H + 0.1, outerM, T));
      for (const h of wl.holes) {
        const d = T + 0.14;
        frameParts.push(box(wl, h.u - h.w / 2 - 0.06, h.v0 + h.h / 2, 0.2, h.h + 0.2, d), box(wl, h.u + h.w / 2 + 0.06, h.v0 + h.h / 2, 0.2, h.h + 0.2, d));
        frameParts.push(box(wl, h.u, h.v0 + h.h + 0.08, h.w + 0.44, 0.22, d + 0.04));
        if (h.win) {
          frameParts.push(box(wl, h.u, h.v0 - 0.06, h.w + 0.5, 0.14, T + 0.34));
          frameParts.push(box(wl, h.u, h.v0 + h.h * 0.78, h.w, 0.07, 0.08));
          const nb = Math.max(3, Math.floor(h.w / 0.34));
          for (let k = 1; k < nb; k++) {
            const cb = new THREE.CylinderGeometry(0.035, 0.035, h.h, 6);
            const c = wl.o.clone().addScaledVector(wl.U, h.u - h.w / 2 + (h.w * k) / nb).addScaledVector(wl.N, T / 2);
            cb.translate(c.x, h.v0 + h.h / 2, c.z);
            barParts.push(cb);
          }
        }
        if (h.door) {
          // hai cánh cửa mở toang ra hiên
          for (const s of [-1, 1]) {
            const lw = h.w / 2;
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, h.h * 0.98, lw), doorMat);
            const c = wl.o.clone().addScaledVector(wl.U, h.u + s * (h.w / 2 + 0.05)).addScaledVector(wl.N, T + lw / 2 + 0.05);
            leaf.position.set(c.x, h.h / 2, c.z);
            leaf.castShadow = true; leaf.receiveShadow = true;
            doorLeaves.push(leaf);
          }
        }
        if (theme.wall === 'khmer' && h.win) {
          const tri = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 3), new THREE.MeshStandardMaterial({ color: '#f0c050', metalness: 0.6, roughness: 0.35 }));
          const c = wl.o.clone().addScaledVector(wl.U, h.u).addScaledVector(wl.N, -0.06);
          tri.position.set(c.x, h.v0 + h.h + 0.7, c.z);
          tri.rotation.set(0, wl.U.x ? 0 : Math.PI / 2, 0); tri.scale.set(1, 1, 0.05);
          g.add(tri);
        }
      }
    }
    const fm = new THREE.MeshStandardMaterial({ color: theme.wall === 'khmer' ? '#c8901e' : frameCol, roughness: 0.6, metalness: theme.wall === 'khmer' || theme.wall === 'bronze' ? 0.5 : 0 });
    const frames = new THREE.Mesh(mergeGeometries(frameParts), fm);
    frames.castShadow = true; frames.receiveShadow = true;
    g.add(frames);
    if (barParts.length) {
      const bars = new THREE.Mesh(mergeGeometries(barParts), fm);
      bars.castShadow = true;
      g.add(bars);
    }
    frameParts.concat(barParts).forEach((x) => x.dispose());
    doorLeaves.forEach((l) => g.add(l));
    // tranh vách
    if (theme.mural) {
      g.add(mk(new THREE.PlaneGeometry(W * 0.92, H * 0.8), new THREE.MeshStandardMaterial({ map: muralTex(theme.mural), roughness: 0.8 }), 0, H * 0.52, -hd + 0.05, { cast: false }));
    }
    // dầm ngang
    const beamM = new THREE.MeshStandardMaterial({ color: theme.roof || '#3a2216', roughness: 0.8 });
    if (theme.wall !== 'plaster') for (const s of [-1, 1]) for (const y of [winY - winH / 2 - 0.3, winY + winH / 2 + 0.3]) {
      g.add(mk(new THREE.BoxGeometry(0.3, 0.35, D), beamM, s * (hw - 0.15), y, 0, { cast: false }));
    }
    // trần
    g.add(mk(new THREE.PlaneGeometry(W, D), beamM, 0, H, 0, { rot: [Math.PI / 2, 0, 0], cast: false }));
    for (let z = -hd + 1; z < hd; z += 3) g.add(mk(new THREE.BoxGeometry(W, 0.5, 0.4), beamM, 0, H - 0.3, z, { cast: false }));
    if (theme.wall === 'lacquer' || theme.wall === 'khmer') {
      const trim = new THREE.MeshStandardMaterial({ color: '#e0b050', metalness: 0.7, roughness: 0.3 });
      for (const s of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.1, 0.12, D), trim, s * (hw - 0.05), H - 0.9, 0, { cast: false }));
      g.add(mk(new THREE.BoxGeometry(W, 0.12, 0.1), trim, 0, H - 0.9, -hd + 0.06, { cast: false }));
    }
    if (theme.wall === 'bronze') {
      const relief = new THREE.MeshStandardMaterial({ color: '#a07a40', metalness: 0.75, roughness: 0.35 });
      for (let i = -3; i <= 3; i++) g.add(mk(new THREE.BoxGeometry(1.4, 1.8, 0.12), relief, i * (W / 7), H * 0.78, -hd + 0.08, { cast: false }));
    }
  }

  /* ---------- cột ---------- */
  if (theme.pillar) {
    const pm = new THREE.MeshStandardMaterial({ color: theme.pillar, roughness: 0.5, metalness: theme.wall === 'bronze' ? 0.6 : 0 });
    const bm = new THREE.MeshStandardMaterial({ color: '#9c6a22', metalness: 0.8, roughness: 0.4 });
    const colGeo = new THREE.CylinderGeometry(0.42, 0.48, H, 24), baseGeo = new THREE.CylinderGeometry(0.62, 0.7, 0.35, 24);
    const xs = W > 14 ? [-(hw - 2.2), hw - 2.2] : [-(hw - 1.2), hw - 1.2];
    for (const x of xs) for (let z = -hd + 3; z < hd - 1; z += Math.max(5, D / 4)) {
      g.add(mk(colGeo, pm, x, H / 2, z), mk(baseGeo, bm, x, 0.17, z));
    }
  }

  /* ---------- đèn lồng / đèn dầu ---------- */
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#ffb36b', emissive: '#ff8a3a', emissiveIntensity: 1.2 });
  if (!isCave) {
    for (const [x, z] of [[-W * 0.22, -D * 0.12], [W * 0.22, -D * 0.12], [-W * 0.22, D * 0.2], [W * 0.22, D * 0.2]]) {
      g.add(mk(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 16), lanternMat, x, H - 2, z, { cast: false }));
      g.add(mk(new THREE.CylinderGeometry(0.01, 0.01, 1.4), lanternMat, x, H - 0.9, z, { cast: false }));
    }
  } else {
    for (const [x, z] of [[-hw + 2, -2], [hw - 2, -2], [-hw + 2, 5], [hw - 2, 5]]) {
      g.add(mk(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 12), lanternMat, x, 0.2, z, { cast: false }));
    }
  }
  for (const s of [-1, 1]) {
    const fill = new THREE.PointLight(theme.light?.warm || '#ffa860', 8 * (W / 24), Math.max(W, D) * 0.7, 1.6);
    fill.position.set(s * W * 0.22, H - 2.4, 0);
    g.add(fill);
  }

  /* ---------- QUẦY BARISTA, BACK-BAR & GÓC ACOUSTIC LOFI ---------- */
  const statues = theme.statues || [];
  const span = Math.max(...statues.map((s) => Math.abs(s.x)), 0);
  const altarW = Math.min(W - 2, Math.max(8.5, span * 2 + 6.5)), altarH = isCave ? 1.05 : 1.15;

  const woodDarkM = new THREE.MeshStandardMaterial({ color: '#3b2314', roughness: 0.65 });
  const woodWarmM = new THREE.MeshStandardMaterial({ color: '#6e472b', roughness: 0.55 });
  const marbleM = new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.25, metalness: 0.08 });
  const brassM = new THREE.MeshStandardMaterial({ color: '#d9a443', metalness: 0.82, roughness: 0.28 });
  const chromeM = new THREE.MeshStandardMaterial({ color: '#e2e6ec', metalness: 0.9, roughness: 0.18 });
  const copperM = new THREE.MeshStandardMaterial({ color: '#c86d44', metalness: 0.78, roughness: 0.25 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1 });

  // Kệ tủ Back-Bar phía sau (tại altarZ)
  const backW = Math.min(W - 3, Math.max(7.6, altarW * 0.9));
  g.add(mk(new THREE.BoxGeometry(backW, altarH, 1.35), woodDarkM, 0, altarH / 2, altarZ));
  g.add(mk(new THREE.BoxGeometry(backW + 0.12, 0.08, 1.45), marbleM, 0, altarH + 0.04, altarZ));
  // Khung kệ gỗ cao phía sau quầy
  const shelfH = Math.min(H - 1.6, 4.6);
  g.add(mk(new THREE.BoxGeometry(backW, shelfH, 0.35), woodDarkM, 0, altarH + shelfH / 2, altarZ - 0.5));
  for (let sy = 1; sy <= 3; sy++) {
    const y = altarH + sy * (shelfH / 3.4);
    g.add(mk(new THREE.BoxGeometry(backW - 0.4, 0.07, 0.45), woodWarmM, 0, y, altarZ - 0.38));
    // Đèn LED thanh ấm dưới mỗi tầng kệ
    const ledM = new THREE.MeshBasicMaterial({ color: '#ffd599' });
    g.add(mk(new THREE.BoxGeometry(backW - 0.6, 0.025, 0.04), ledM, 0, y - 0.04, altarZ - 0.2, { cast: false }));
    // Các hũ hạt cà phê, bình syphon, sách decor trên kệ
    for (let bx = -backW * 0.38; bx <= backW * 0.38; bx += 0.85) {
      if (Math.abs(bx) < 1.8 && sy >= 2) continue; // chừa khoảng giữa cho bảng Neon
      const jarCol = ((Math.round(bx * 10) + sy) % 3 === 0) ? '#b85d38' : ((Math.round(bx * 10) + sy) % 2 === 0) ? '#3d6b58' : '#d6a15c';
      const jarM = new THREE.MeshStandardMaterial({ color: jarCol, roughness: 0.35, metalness: 0.2 });
      g.add(mk(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 12), jarM, bx, y + 0.18, altarZ - 0.36, { cast: false }));
      g.add(mk(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 12), brassM, bx, y + 0.34, altarZ - 0.36, { cast: false }));
    }
  }

  // Bảng hiệu Neon & Menu Cafe phát sáng ở chính giữa Back-Bar
  const neonCanvas = document.createElement('canvas');
  neonCanvas.width = 1024; neonCanvas.height = 512;
  const nctx = neonCanvas.getContext('2d');
  const nbg = nctx.createLinearGradient(0, 0, 0, 512);
  nbg.addColorStop(0, '#1e120b'); nbg.addColorStop(1, '#120a06');
  nctx.fillStyle = nbg; nctx.fillRect(0, 0, 1024, 512);
  nctx.strokeStyle = '#f5b952'; nctx.lineWidth = 10; nctx.strokeRect(18, 18, 988, 476);
  nctx.strokeStyle = '#ff7eb3'; nctx.lineWidth = 3; nctx.strokeRect(32, 32, 960, 448);
  nctx.textAlign = 'center';
  nctx.shadowColor = '#ff9d3b'; nctx.shadowBlur = 24;
  nctx.fillStyle = '#ffe599'; nctx.font = '800 64px system-ui, sans-serif';
  nctx.fillText('☕ LOFI CHILL CAFE 3D', 512, 118);
  nctx.shadowColor = '#ff4d94'; nctx.shadowBlur = 18;
  nctx.fillStyle = '#ff9ec6'; nctx.font = '700 34px system-ui, sans-serif';
  nctx.fillText('✨ TIKTOK LIVE · STUDY WITH ME · ACOUSTIC ✨', 512, 176);
  nctx.shadowBlur = 0;
  // Menu 4 món nổi bật
  const menuItems = [
    ['☕ Phin Sữa Đá', '29k'],
    ['🍵 Matcha Latte', '39k'],
    ['🧋 Trà Sữa Boba', '35k'],
    ['🥐 Bánh Croissant', '32k']
  ];
  menuItems.forEach(([mName, mPrice], idx) => {
    const mx = idx < 2 ? 270 : 754;
    const my = (idx % 2 === 0) ? 275 : 355;
    nctx.fillStyle = '#fff3d6'; nctx.font = '600 34px system-ui, sans-serif';
    nctx.textAlign = 'left'; nctx.fillText(mName, mx - 180, my);
    nctx.fillStyle = '#ffd166'; nctx.textAlign = 'right'; nctx.fillText(mPrice, mx + 180, my);
  });
  nctx.textAlign = 'center'; nctx.fillStyle = '#9fe3c0'; nctx.font = '500 26px system-ui, sans-serif';
  nctx.fillText('🐾 Thú cưng Mèo Cam & Corgi · 🌧️ Mưa Đà Lạt ngoài hiên', 512, 442);
  const neonTex = new THREE.CanvasTexture(neonCanvas);
  neonTex.colorSpace = THREE.SRGBColorSpace;
  const neonSign = mk(
    new THREE.PlaneGeometry(3.6, 1.8),
    new THREE.MeshStandardMaterial({ map: neonTex, roughness: 0.4, emissive: '#ffffff', emissiveMap: neonTex, emissiveIntensity: 0.65 }),
    0, altarH + shelfH * 0.58, altarZ - 0.18, { cast: false }
  );
  g.add(neonSign);

  /* ---------- QUẦY PHA CHẾ CHÍNH (ESPRESSO BAR & TỦ BÁNH) ---------- */
  const tz = altarZ + 2.6;
  const barW = 5.2, barH = 1.02, barD = 1.15;
  // Thân quầy gỗ óc chó + mặt đá cẩm thạch + viền đồng
  g.add(
    mk(new THREE.BoxGeometry(barW, barH, barD), woodDarkM, 0, barH / 2, tz),
    mk(new THREE.BoxGeometry(barW + 0.14, 0.08, barD + 0.14), marbleM, 0, barH + 0.04, tz),
    mk(new THREE.BoxGeometry(barW + 0.06, 0.06, barD + 0.06), brassM, 0, 0.04, tz)
  );
  // Các lam gỗ trang trí mặt trước quầy bar
  for (let sx = -barW / 2 + 0.22; sx <= barW / 2 - 0.22; sx += 0.28) {
    g.add(mk(new THREE.BoxGeometry(0.08, barH - 0.12, 0.04), woodWarmM, sx, barH / 2, tz + barD / 2 + 0.02, { cast: false }));
  }

  // Máy pha Espresso La Marzocco 2 Group ở giữa quầy (x = -0.35)
  const espX = -0.35, espY = barH + 0.08;
  g.add(
    mk(new THREE.BoxGeometry(0.95, 0.48, 0.52), copperM, espX, espY + 0.24, tz),
    mk(new THREE.BoxGeometry(0.98, 0.06, 0.56), chromeM, espX, espY + 0.50, tz),
    mk(new THREE.BoxGeometry(0.88, 0.05, 0.22), chromeM, espX, espY + 0.03, tz + 0.24),
    // 2 Group heads + tay cầm Portafilter
    mk(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14), chromeM, espX - 0.22, espY + 0.30, tz + 0.28),
    mk(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14), chromeM, espX + 0.22, espY + 0.30, tz + 0.28),
    mk(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), woodDarkM, espX - 0.22, espY + 0.28, tz + 0.42, { rot: [Math.PI / 2, 0, 0] }),
    mk(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), woodDarkM, espX + 0.22, espY + 0.28, tz + 0.42, { rot: [Math.PI / 2, 0, 0] })
  );
  // 2 Máy xay hạt Cafe Mazzer (x = -1.15 và -1.45)
  for (const gx of [-1.15, -1.48]) {
    g.add(
      mk(new THREE.CylinderGeometry(0.11, 0.13, 0.32, 14), chromeM, gx, espY + 0.16, tz),
      mk(new THREE.CylinderGeometry(0.13, 0.08, 0.24, 14), glassM, gx, espY + 0.44, tz),
      mk(new THREE.CylinderGeometry(0.11, 0.07, 0.12, 12), woodDarkM, gx, espY + 0.38, tz)
    );
  }

  // Tủ kính trưng bày bánh ngọt Croissant & Tiramisu (x = 1.25)
  const caseX = 1.25;
  g.add(
    mk(new THREE.BoxGeometry(1.35, 0.12, 0.65), woodDarkM, caseX, espY + 0.06, tz),
    mk(new THREE.BoxGeometry(1.32, 0.56, 0.62), glassM, caseX, espY + 0.40, tz, { cast: false }),
    mk(new THREE.BoxGeometry(1.24, 0.025, 0.52), chromeM, caseX, espY + 0.38, tz, { cast: false })
  );
  const pastryGoldM = new THREE.MeshStandardMaterial({ color: '#e09538', roughness: 0.45 });
  const cakeMatchaM = new THREE.MeshStandardMaterial({ color: '#6fa852', roughness: 0.55 });
  const cakeBerryM = new THREE.MeshStandardMaterial({ color: '#e05a6d', roughness: 0.5 });
  for (let px = -0.4; px <= 0.4; px += 0.4) {
    // Khay bánh tầng dưới & tầng trên
    g.add(
      mk(new THREE.CylinderGeometry(0.13, 0.11, 0.02, 14), marbleM, caseX + px, espY + 0.14, tz, { cast: false }),
      mk(new THREE.SphereGeometry(0.08, 12, 8), pastryGoldM, caseX + px, espY + 0.19, tz, { scale: [1.3, 0.65, 0.85], cast: false }),
      mk(new THREE.CylinderGeometry(0.12, 0.10, 0.02, 14), marbleM, caseX + px, espY + 0.41, tz, { cast: false }),
      mk(new THREE.CylinderGeometry(0.08, 0.08, 0.09, 12), px < 0 ? cakeMatchaM : cakeBerryM, caseX + px, espY + 0.46, tz, { cast: false })
    );
  }

  // Hai đèn bàn Edison ấm áp hai đầu quầy Barista
  const shadeM = new THREE.MeshStandardMaterial({ color: '#ffcf78', emissive: '#ff9d3b', emissiveIntensity: 0.85, roughness: 0.35 });
  const flameM = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  for (const x of [-2.2, 2.2]) {
    g.add(
      mk(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 16), brassM, x, espY + 0.04, tz),
      mk(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 10), brassM, x, espY + 0.28, tz),
      mk(new THREE.ConeGeometry(0.24, 0.22, 18, 1, true), shadeM, x, espY + 0.52, tz, { cast: false })
    );
    const f = mk(new THREE.SphereGeometry(0.06, 10, 8), flameM, x, espY + 0.46, tz, { cast: false });
    const pl = new THREE.PointLight('#ffb060', 3.4, 8, 1.7);
    pl.position.set(x, espY + 0.65, tz + 0.2);
    g.add(f, pl);
    flames.push({ f, pl, base: 3.4 });
  }

  // Cây xanh Monstera & Đàn Guitar Acoustic ở góc sân khấu nhỏ cạnh quầy
  const flowerGroup = new THREE.Group();
  g.add(flowerGroup);
  const potM = new THREE.MeshStandardMaterial({ color: '#d9c3a8', roughness: 0.7 });
  const leafM = new THREE.MeshStandardMaterial({ color: '#397a44', roughness: 0.5, side: THREE.DoubleSide });
  const leafBrightM = new THREE.MeshStandardMaterial({ color: '#58a85c', roughness: 0.45, side: THREE.DoubleSide });
  function makePlant(px, pz) {
    const pg = new THREE.Group();
    pg.add(mk(new THREE.CylinderGeometry(0.28, 0.22, 0.48, 16), potM, px, 0.24, pz));
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2;
      const lx = px + Math.cos(ang) * 0.22, lz = pz + Math.sin(ang) * 0.22;
      pg.add(mk(new THREE.CylinderGeometry(0.015, 0.02, 0.65, 6), leafM, lx * 0.4 + px * 0.6, 0.68, lz * 0.4 + pz * 0.6, { rot: [Math.sin(ang) * 0.25, 0, -Math.cos(ang) * 0.25], cast: false }));
      pg.add(mk(new THREE.SphereGeometry(0.18, 10, 8), leafM, lx, 0.95 + (k % 2) * 0.12, lz, { scale: [1.3, 0.25, 0.9], rot: [0.2, ang, 0] }));
    }
    return pg;
  }
  flowerGroup.add(makePlant(-barW / 2 - 0.65, tz), makePlant(barW / 2 + 0.65, tz));

  // Đàn Guitar Acoustic đặt trên giá cạnh quầy
  const guitarG = new THREE.Group();
  guitarG.position.set(barW / 2 + 1.35, 0, tz - 0.4);
  guitarG.rotation.y = -0.4;
  const gWood = new THREE.MeshStandardMaterial({ color: '#c87d32', roughness: 0.35 });
  guitarG.add(
    mk(new THREE.CylinderGeometry(0.24, 0.28, 0.10, 18), gWood, 0, 0.55, 0, { rot: [Math.PI / 2 - 0.2, 0, 0] }),
    mk(new THREE.CylinderGeometry(0.18, 0.22, 0.10, 18), gWood, 0, 0.82, -0.05, { rot: [Math.PI / 2 - 0.2, 0, 0] }),
    mk(new THREE.BoxGeometry(0.06, 0.58, 0.03), woodDarkM, 0, 1.22, -0.13, { rot: [-0.2, 0, 0] })
  );
  g.add(guitarG);

  // Hơi nước thơm lừng bốc lên từ máy Espresso & bình Pour-over
  const tips = [];
  function addStick(dx, dz = 0) {
    tips.push(new THREE.Vector3(espX + dx, espY + 0.56, tz + dz));
  }
  [-0.22, 0, 0.22].forEach((dx) => addStick(dx));

  const smokeMat = new THREE.SpriteMaterial({ map: softDot(), color: '#fff8ee', transparent: true, depthWrite: false, opacity: 0.22 });
  const smoke = [];
  function spawnSmoke(n) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(smokeMat.clone());
      s.userData = { tip: tips[(smoke.length + i) % tips.length], life: Math.random() * 3.5 };
      g.add(s); smoke.push(s);
    }
  }
  spawnSmoke(28);
  updaters.push((dt) => {
    for (const s of smoke) {
      const u = s.userData;
      u.life += dt; if (u.life > 3.5) { u.life = 0; u.tip = tips[Math.floor(Math.random() * tips.length)]; }
      const k = u.life / 3.5;
      s.position.set(u.tip.x + Math.sin(u.life * 2.2 + u.tip.x * 30) * 0.08 * k, u.tip.y + k * 1.35, u.tip.z + Math.cos(u.life * 1.8) * 0.05 * k);
      const sc = 0.05 + k * 0.32; s.scale.set(sc, sc, sc);
      s.material.opacity = 0.20 * Math.sin(k * Math.PI);
    }
  });

  /* ---------- chi tiết đặc thù ---------- */
  const extras = theme.extras || [];
  if (extras.includes('bamboo')) {
    const bm = new THREE.MeshStandardMaterial({ color: '#5f8a3a', roughness: 0.6 });
    const lm = new THREE.MeshStandardMaterial({ color: '#4a7a30', roughness: 0.7, side: THREE.DoubleSide });
    for (const [cx, cz] of [[-hw + 1.2, -hd + 1.2], [hw - 1.2, -hd + 1.2], [-hw + 1.2, hd - 1.5], [hw - 1.2, hd - 1.5]]) {
      g.add(mk(new THREE.CylinderGeometry(0.6, 0.45, 0.6, 16), new THREE.MeshStandardMaterial({ color: '#6a4a30' }), cx, 0.3, cz));
      for (let i = 0; i < 6; i++) {
        const h = rand(3, H - 1.5), x = cx + rand(-0.3, 0.3), z = cz + rand(-0.3, 0.3);
        g.add(mk(new THREE.CylinderGeometry(0.04, 0.05, h, 8), bm, x, h / 2 + 0.5, z));
        for (let k = 0; k < 4; k++) g.add(mk(new THREE.PlaneGeometry(0.12, 0.6), lm, x + rand(-0.3, 0.3), h * rand(0.6, 1) + 0.5, z + rand(-0.3, 0.3), { rot: [rand(-1, 1), rand(0, 3), rand(-1, 1)], cast: false }));
      }
    }
  }
  if (extras.includes('haze')) scene.fog = new THREE.Fog(theme.fog, 8, Math.max(W, D) * 1.4);

  /* ---------- BÀN GHẾ CAFE 3D & ĐỒ UỐNG / LAPTOP TRÊN BÀN ---------- */
  const cushions = [];
  const c = theme.cushions;
  const matGeo = new THREE.BoxGeometry(1.55, 0.025, 1.55), cuGeo = cushionGeo();
  const matM = new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 });
  const matGeos = [];
  const tableTopGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.045, 20);
  const tableRimGeo = new THREE.CylinderGeometry(0.435, 0.435, 0.03, 20);
  const tableLegGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.48, 10);
  const tableBaseGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.03, 14);
  const lampBaseGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.03, 10);
  const lampStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8);
  const lampShadeGeo = new THREE.ConeGeometry(0.075, 0.09, 12);
  const tableGeosWood = [], tableGeosBrass = [], tableGeosLamp = [];

  // Hàm tạo mô hình 3D đồ uống, bánh ngọt & Laptop học bài đặt trực tiếp lên bàn
  const ceramicM = new THREE.MeshStandardMaterial({ color: '#fffdf9', roughness: 0.25 });
  const coffeeDarkM = new THREE.MeshStandardMaterial({ color: '#3b1e0e', roughness: 0.3 });
  const milkM = new THREE.MeshStandardMaterial({ color: '#fff3db', roughness: 0.35 });
  const matchaM = new THREE.MeshStandardMaterial({ color: '#6eb854', roughness: 0.35 });
  const bobaTeaM = new THREE.MeshStandardMaterial({ color: '#d49b6a', roughness: 0.35 });
  const pearlM = new THREE.MeshStandardMaterial({ color: '#24140c', roughness: 0.2 });
  const laptopBodyM = new THREE.MeshStandardMaterial({ color: '#cfd6e0', metalness: 0.65, roughness: 0.28 });
  const laptopScreenM = new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#60a5fa', emissiveIntensity: 0.75, roughness: 0.2 });

  function buildOrderMesh(drinkKind = 'phin', hasLaptop = false) {
    const og = new THREE.Group();
    const dx = hasLaptop ? 0.17 : 0;
    const dz = hasLaptop ? 0.04 : 0;

    if (drinkKind === 'matcha') {
      // Ly Matcha Latte 2 tầng + kem sữa + ống hút xanh
      og.add(
        mk(new THREE.CylinderGeometry(0.065, 0.052, 0.06, 14), milkM, dx, 0.03, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.072, 0.065, 0.09, 14), matchaM, dx, 0.105, dz, { cast: false }),
        mk(new THREE.SphereGeometry(0.066, 12, 8), ceramicM, dx, 0.155, dz, { scale: [1, 0.55, 1], cast: false }),
        mk(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), matchaM, dx + 0.02, 0.13, dz, { rot: [0, 0, -0.22], cast: false })
      );
    } else if (drinkKind === 'boba') {
      // Ly Trà Sữa Trân Châu Đường Đen
      og.add(
        mk(new THREE.CylinderGeometry(0.058, 0.05, 0.04, 14), pearlM, dx, 0.02, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.074, 0.058, 0.12, 14), bobaTeaM, dx, 0.10, dz, { cast: false }),
        mk(new THREE.SphereGeometry(0.072, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glassM, dx, 0.16, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.013, 0.013, 0.23, 10), pearlM, dx + 0.015, 0.13, dz, { rot: [0, 0, -0.18], cast: false })
      );
    } else if (drinkKind === 'cappuccino') {
      // Tách Cappuccino gốm trắng + đĩa lót
      og.add(
        mk(new THREE.CylinderGeometry(0.095, 0.08, 0.015, 16), ceramicM, dx, 0.008, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.068, 0.052, 0.09, 16), ceramicM, dx, 0.052, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.063, 0.063, 0.01, 14), pastryGoldM, dx, 0.095, dz, { cast: false }),
        mk(new THREE.SphereGeometry(0.025, 10, 8), milkM, dx, 0.098, dz, { scale: [1.2, 0.3, 1], cast: false })
      );
    } else if (drinkKind === 'croissant') {
      // Đĩa bánh sừng bò Croissant + tách Espresso
      og.add(
        mk(new THREE.CylinderGeometry(0.115, 0.095, 0.016, 16), ceramicM, dx - 0.02, 0.008, dz, { cast: false }),
        mk(new THREE.SphereGeometry(0.065, 12, 8), pastryGoldM, dx - 0.02, 0.042, dz, { scale: [1.35, 0.62, 0.82], rot: [0, 0.4, 0], cast: false }),
        mk(new THREE.CylinderGeometry(0.048, 0.038, 0.07, 12), ceramicM, dx + 0.11, 0.035, dz - 0.04, { cast: false }),
        mk(new THREE.CylinderGeometry(0.043, 0.043, 0.01, 12), coffeeDarkM, dx + 0.11, 0.068, dz - 0.04, { cast: false })
      );
    } else {
      // Mặc định: Cà Phê Phin Sữa Đá Việt Nam chuẩn vị (ly sữa dưới, cà phê đen, phin nhôm trên đỉnh)
      og.add(
        mk(new THREE.CylinderGeometry(0.08, 0.065, 0.014, 14), ceramicM, dx, 0.007, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.054, 0.046, 0.035, 14), milkM, dx, 0.028, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.060, 0.054, 0.085, 14), coffeeDarkM, dx, 0.088, dz, { cast: false }),
        // Đĩa phin + thân phin + nắp phin nhôm
        mk(new THREE.CylinderGeometry(0.072, 0.072, 0.01, 14), chromeM, dx, 0.135, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.058, 0.052, 0.065, 14), chromeM, dx, 0.172, dz, { cast: false }),
        mk(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 14), chromeM, dx, 0.208, dz, { cast: false }),
        mk(new THREE.SphereGeometry(0.015, 8, 8), chromeM, dx, 0.22, dz, { cast: false })
      );
    }

    if (hasLaptop) {
      // Laptop 3D mở màn hình sáng + sổ tay ghi chép bên cạnh
      const lx = -0.11, lz = 0.02;
      og.add(
        // Đế bàn phím Laptop xoay về phía người ngồi (+Z)
        mk(new THREE.BoxGeometry(0.28, 0.014, 0.20), laptopBodyM, lx, 0.008, lz, { cast: false }),
        // Màn hình Laptop dựng nghiêng
        mk(new THREE.BoxGeometry(0.28, 0.19, 0.012), laptopBodyM, lx, 0.10, lz - 0.095, { rot: [-0.22, 0, 0], cast: false }),
        mk(new THREE.PlaneGeometry(0.255, 0.165), laptopScreenM, lx, 0.10, lz - 0.088, { rot: [-0.22, 0, 0], cast: false })
      );
    }
    return og;
  }

  const defaultDrinks = ['phin', 'matcha', 'boba', 'cappuccino', 'croissant'];
  for (let r = 0; r < c.rows; r++) for (const x of c.cols) {
    const z = c.z0 + r * c.dz;
    const idx = cushions.length;
    const cm = cushionMaterial();
    const mesh = mk(cuGeo, cm, x, 0.095, z);
    const petals = new THREE.Group();
    petals.position.set(x, 0, z);
    petals.visible = false;
    matGeos.push(matGeo.clone().translate(x, 0.015, z));

    // Bàn Cafe 3D đặt ngay phía trước chỗ ngồi (z - 0.58)
    const tx = x, tzTable = z - 0.58, tyTop = 0.50;
    tableGeosWood.push(
      tableTopGeo.clone().translate(tx, tyTop, tzTable),
      tableLegGeo.clone().translate(tx, tyTop / 2, tzTable),
      tableBaseGeo.clone().translate(tx, 0.015, tzTable)
    );
    tableGeosBrass.push(
      tableRimGeo.clone().translate(tx, tyTop - 0.005, tzTable),
      lampBaseGeo.clone().translate(tx - 0.25, tyTop + 0.035, tzTable - 0.16),
      lampStemGeo.clone().translate(tx - 0.25, tyTop + 0.11, tzTable - 0.16)
    );
    tableGeosLamp.push(
      lampShadeGeo.clone().translate(tx - 0.25, tyTop + 0.19, tzTable - 0.16)
    );

    const orderGroup = new THREE.Group();
    orderGroup.position.set(tx, tyTop + 0.024, tzTable);
    // Mặc định mỗi bàn đều có sẵn tách cà phê / trà bánh ấm cúng
    const initDrink = defaultDrinks[idx % defaultDrinks.length];
    const initStudy = (idx < 10) ? (idx % 2 === 0) : false;
    orderGroup.add(buildOrderMesh(initDrink, initStudy));

    g.add(mesh, petals, orderGroup);
    cushions.push({
      index: idx,
      pos: new THREE.Vector3(x, 0, z),
      mesh,
      petals,
      orderGroup,
      drink: initDrink,
      study: initStudy,
      occupant: null
    });
  }
  // Gộp toàn bộ bàn cafe & đèn bàn thành các batch Mesh duy nhất để mượt 60 FPS
  if (matGeos.length) { g.add(mk(mergeGeometries(matGeos), matM, 0, 0, 0, { cast: false })); matGeos.forEach((x) => x.dispose()); }
  if (tableGeosWood.length) { g.add(mk(mergeGeometries(tableGeosWood), woodWarmM, 0, 0, 0)); tableGeosWood.forEach((x) => x.dispose()); }
  if (tableGeosBrass.length) { g.add(mk(mergeGeometries(tableGeosBrass), brassM, 0, 0, 0, { cast: false })); tableGeosBrass.forEach((x) => x.dispose()); }
  if (tableGeosLamp.length) { g.add(mk(mergeGeometries(tableGeosLamp), shadeM, 0, 0, 0, { cast: false })); tableGeosLamp.forEach((x) => x.dispose()); }

  function setTableOrder(seatIdx, drinkKind = 'phin', hasLaptop = false) {
    const cu = cushions[seatIdx];
    if (!cu || !cu.orderGroup) return;
    cu.drink = drinkKind || cu.drink || 'phin';
    cu.study = !!hasLaptop;
    while (cu.orderGroup.children.length) {
      const ch = cu.orderGroup.children.pop();
      cu.orderGroup.remove(ch);
    }
    cu.orderGroup.add(buildOrderMesh(cu.drink, cu.study));
  }

  /* ---------- HIỆU ỨNG MƯA LOFI NGOÀI CỬA SỔ & PHÁO HOA TIKTOK LIVE ---------- */
  const rainGroup = new THREE.Group();
  rainGroup.visible = false;
  g.add(rainGroup);
  const rainDropGeo = new THREE.BoxGeometry(0.018, 0.65, 0.018);
  const rainDropMat = new THREE.MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0.55 });
  const rainDrops = [];
  for (let i = 0; i < 180; i++) {
    const side = i % 3;
    let rx, rz;
    if (side === 0) { rx = -hw - rand(0.6, 4.5); rz = rand(-hd, hd); }
    else if (side === 1) { rx = hw + rand(0.6, 4.5); rz = rand(-hd, hd); }
    else { rx = rand(-hw, hw); rz = hd + rand(0.6, 5.0); }
    const ry = rand(0.5, H + 2);
    const drop = new THREE.Mesh(rainDropGeo, rainDropMat);
    drop.position.set(rx, ry, rz);
    drop.userData = { speed: rand(9.5, 14.5) };
    rainGroup.add(drop);
    rainDrops.push(drop);
  }
  updaters.push((dt) => {
    if (!rainGroup.visible) return;
    for (const d of rainDrops) {
      d.position.y -= d.userData.speed * dt;
      if (d.position.y < 0.2) d.position.y = H + 1.5;
    }
  });

  // Hệ thống hạt Pháo hoa 3D trong quán khi có người tặng quà TikTok Live
  const fireworks = [];
  const fwGeo = new THREE.SphereGeometry(0.065, 8, 8);
  function launchFireworks(colorHex = '#ffdf4d') {
    const colors = [colorHex, '#ff4d94', '#5ce1e6', '#ffd166', '#a8ff78'];
    for (let burst = 0; burst < 3; burst++) {
      const cx = rand(-W * 0.28, W * 0.28);
      const cy = rand(H * 0.48, H * 0.78);
      const cz = rand(altarZ + 3.5, Math.min(hd - 2, 4));
      const bCol = colors[burst % colors.length];
      const mat = new THREE.MeshBasicMaterial({ color: bCol, transparent: true, opacity: 1 });
      const light = new THREE.PointLight(bCol, 8, 12, 1.5);
      light.position.set(cx, cy, cz);
      g.add(light);
      const parts = [];
      for (let i = 0; i < 32; i++) {
        const p = new THREE.Mesh(fwGeo, mat);
        p.position.set(cx, cy, cz);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const spd = rand(2.2, 5.4);
        p.userData = {
          vx: Math.sin(phi) * Math.cos(theta) * spd,
          vy: Math.sin(phi) * Math.sin(theta) * spd + 1.2,
          vz: Math.cos(phi) * spd
        };
        g.add(p);
        parts.push(p);
      }
      fireworks.push({ parts, mat, light, life: 0, maxLife: 1.8 + burst * 0.25 });
    }
  }
  updaters.push((dt) => {
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const fw = fireworks[i];
      fw.life += dt;
      const t = fw.life / fw.maxLife;
      if (t >= 1) {
        fw.parts.forEach((p) => g.remove(p));
        g.remove(fw.light);
        fw.mat.dispose();
        fireworks.splice(i, 1);
        continue;
      }
      fw.mat.opacity = Math.max(0, 1 - t * t);
      fw.light.intensity = 8 * (1 - t);
      for (const p of fw.parts) {
        p.position.x += p.userData.vx * dt;
        p.position.y += p.userData.vy * dt;
        p.position.z += p.userData.vz * dt;
        p.userData.vy -= 3.8 * dt;
        const sc = Math.max(0.2, 1.2 - t);
        p.scale.setScalar(sc);
      }
    }
  });

  /* ---------- BẢNG VÀNG KHÁCH QUEN (BÊN TRÁI QUẦY BAR) ---------- */
  const steleCanvas = document.createElement('canvas');
  steleCanvas.width = 512; steleCanvas.height = 768;
  const steleTex = new THREE.CanvasTexture(steleCanvas);
  steleTex.colorSpace = THREE.SRGBColorSpace;
  const pillarX = W > 14 ? hw - 2.2 : hw - 1.2;
  const sx = -Math.max(1.8, Math.min(pillarX - 1.7, altarW / 2 + 1.8));
  const sz = Math.min(altarZ + 2.4, (c.z0 ?? altarZ + 4) - 1.4);
  const stele = new THREE.Group();
  stele.position.set(sx, 0, sz);
  stele.rotation.y = 0.45;
  const stoneM = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.65 });
  const goldM = new THREE.MeshStandardMaterial({ color: '#d9a443', metalness: 0.8, roughness: 0.35 });
  stele.add(mk(new THREE.BoxGeometry(2.9, 1.1, 1.1), stoneM, 0, 0.55, 0));
  stele.add(mk(new THREE.BoxGeometry(3.1, 0.12, 1.2), goldM, 0, 1.12, 0));
  stele.add(mk(new THREE.BoxGeometry(2.5, 3.6, 0.32), stoneM, 0, 2.95, 0));
  stele.add(mk(new THREE.CylinderGeometry(1.25, 1.25, 0.32, 40, 1, false, -Math.PI / 2, Math.PI), stoneM, 0, 4.75, 0, { rot: [-Math.PI / 2, 0, 0] }));
  const face = mk(new THREE.PlaneGeometry(2.25, 3.35), new THREE.MeshStandardMaterial({ map: steleTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: steleTex, emissiveIntensity: 0.42 }), 0, 2.95, 0.17, { cast: false });
  stele.add(face);
  const steleLight = new THREE.SpotLight('#ffd9a0', 6, 7, 0.6, 0.5, 1.5);
  steleLight.position.set(0, 6, 2.6); steleLight.target = face; stele.add(steleLight);
  g.add(stele);
  function drawStele(rows = [], subtitle = 'Top Chill & Học Bài Tuần Này') {
    const list = Array.isArray(rows) ? rows : (rows?.rows || []);
    const sub = (!Array.isArray(rows) && rows?.subtitle) || subtitle || 'Top Chill & Study With Me';
    const c = steleCanvas.getContext('2d'), w = 512, h = 768;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2c1b10'); bg.addColorStop(1, '#160d07');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d9a645'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.lineWidth = 2; c.strokeRect(30, 30, w - 60, h - 60);
    c.fillStyle = '#f6d27e'; c.textAlign = 'center';
    c.font = '700 40px system-ui, sans-serif'; c.fillText('☕ BẢNG VÀNG', w / 2, 98);
    c.font = '700 28px system-ui, sans-serif'; c.fillText('KHÁCH QUEN QUÁN CAFE', w / 2, 144);
    c.font = '400 21px system-ui, sans-serif'; c.fillStyle = '#c9a76a'; c.fillText(sub, w / 2, 180);
    c.fillStyle = '#d9a645'; c.fillRect(100, 202, w - 200, 2);
    if (!list.length) { c.fillStyle = '#c9a76a'; c.font = 'italic 25px system-ui, sans-serif'; c.fillText('Chưa có khách quen ghi danh.', w / 2, 330); c.fillText('Hãy ngồi bàn & gọi món ngay!', w / 2, 370); }
    list.slice(0, 5).forEach((r, i) => {
      const y = 270 + i * 92;
      const mc = ['#ffd36b', '#d9dde3', '#d89a62', '#8a6a3a', '#8a6a3a'][i];
      c.beginPath(); c.arc(76, y - 4, 22, 0, Math.PI * 2); c.fillStyle = mc; c.fill();
      c.textAlign = 'center'; c.font = '700 24px system-ui, sans-serif'; c.fillStyle = i < 3 ? '#3a2205' : '#f3e2bc'; c.fillText(String(i + 1), 76, y + 4);
      c.textAlign = 'left';
      c.font = `${i === 0 ? 700 : 600} ${i === 0 ? 32 : 28}px system-ui, sans-serif`; c.fillStyle = i === 0 ? '#ffe08a' : '#f3e2bc';
      let name = r.name || 'Khách quen'; while (c.measureText(name).width > 260 && name.length > 3) name = name.slice(0, -2) + '…';
      c.fillText(name, 116, y);
      c.font = '20px system-ui, sans-serif'; c.fillStyle = '#c9a76a'; c.fillText(r.title || '', 116, y + 30);
      c.textAlign = 'right'; c.font = '700 26px system-ui, sans-serif'; c.fillStyle = '#f6d27e'; c.fillText(String(r.score ?? ''), w - 54, y + 8);
    });
    steleTex.needsUpdate = true;
  }
  drawStele();

  /* ---------- BẢNG TOP DONATE TIKTOK LIVE (BÊN PHẢI QUẦY BAR) ---------- */
  const meritCanvas = document.createElement('canvas');
  meritCanvas.width = 512; meritCanvas.height = 768;
  const meritTex = new THREE.CanvasTexture(meritCanvas);
  meritTex.colorSpace = THREE.SRGBColorSpace;
  const merit = new THREE.Group();
  merit.position.set(-sx, 0, sz);
  merit.rotation.y = -0.45;
  merit.add(mk(new THREE.BoxGeometry(2.9, 1.1, 1.1), stoneM, 0, 0.55, 0));
  merit.add(mk(new THREE.BoxGeometry(3.1, 0.12, 1.2), goldM, 0, 1.12, 0));
  merit.add(mk(new THREE.BoxGeometry(2.5, 3.6, 0.32), stoneM, 0, 2.95, 0));
  merit.add(mk(new THREE.CylinderGeometry(1.25, 1.25, 0.32, 40, 1, false, -Math.PI / 2, Math.PI), stoneM, 0, 4.75, 0, { rot: [-Math.PI / 2, 0, 0] }));
  merit.add(mk(new THREE.PlaneGeometry(2.25, 3.35), new THREE.MeshStandardMaterial({ map: meritTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: meritTex, emissiveIntensity: 0.65 }), 0, 2.95, 0.17, { cast: false }));
  g.add(merit);
  function drawMerit(rows = []) {
    const list = Array.isArray(rows) ? rows : (rows?.rows || []);
    const c = meritCanvas.getContext('2d'), w = 512, h = 768;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3d1522'); bg.addColorStop(1, '#1c0a11');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ff7eb3'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.strokeRect(30, 30, w - 60, h - 60);
    c.fillStyle = '#ffe08a'; c.textAlign = 'center';
    c.font = '700 40px system-ui, sans-serif'; c.fillText('🎁 TOP DONATE LIVE', w / 2, 98);
    c.font = '500 23px system-ui, sans-serif'; c.fillStyle = '#ff9ec6'; c.fillText('Vinh danh người xem tặng quà TikTok', w / 2, 144);
    c.fillStyle = '#ff7eb3'; c.fillRect(100, 170, w - 200, 2);
    if (!list.length) { c.fillStyle = '#f3d1dc'; c.font = 'italic 25px system-ui, sans-serif'; c.fillText('Chưa có ai thả quà.', w / 2, 330); c.fillText('Bấm nút Quà TikTok để bắn pháo hoa!', w / 2, 370); }
    list.slice(0, 9).forEach((r, i) => {
      c.font = `600 ${i === 0 ? 32 : 28}px system-ui, sans-serif`; c.fillStyle = i === 0 ? '#ffe08a' : '#fff0f5';
      let name = (i === 0 ? '👑 ' : '💖 ') + (r.name || 'Viewer');
      while (c.measureText(name).width > 410 && name.length > 3) name = name.slice(0, -2) + '…';
      c.fillText(name, w / 2, 222 + i * 47);
    });
    c.fillStyle = '#ff7eb3'; c.fillRect(100, 650, w - 200, 2);
    c.font = '600 24px system-ui, sans-serif'; c.fillStyle = '#ffe08a'; c.fillText('Chạm vào bảng để xem & tặng quà', w / 2, 690);
    c.font = '400 20px system-ui, sans-serif'; c.fillStyle = '#ff9ec6'; c.fillText('Quán Cafe Online 3D · TikTok Live', w / 2, 722);
    meritTex.needsUpdate = true;
  }
  drawMerit();

  const bounds = { minX: -hw + 1, maxX: hw - 1, minZ: tz + 1.2, maxZ: hd - 1 };
  if (isCave) { bounds.minX *= 0.85; bounds.maxX *= 0.85; }

  let candleBoost = 0;
  return {
    group: g, cushions, bounds, altarZ, tableZ: tz, height: H,
    setStele: drawStele,
    steleFace: face,
    setMerit: drawMerit,
    meritStele: merit,
    setTableOrder,
    setRainMode(on) {
      rainGroup.visible = !!on;
    },
    launchFireworks,
    // dữ liệu để đi ra ngoài: cảnh quan, cửa chính, nền đất
    outdoor: !isCave ? { group: sur.group, groundY: sur.groundY ?? 0, doorW: Math.min(6, W * 0.3), hw, hd, W, D, H, cable: sur.cable || null, walkR: sur.walkR || 0, blocks: sur.blocks, noGarden: sur.noGarden, forest: sur.forest } : null,
    setCushionLook(cu, look) {
      const lotus = !!look?.lotus;
      cu.mesh.geometry = lotus ? lotusPad() : cuGeo;
      setCushionFabric(cu.mesh.material, !lotus);
      if (!lotus && cu.mesh.material.map !== cushionMap(look)) { cu.mesh.material.map = cushionMap(look); cu.mesh.material.needsUpdate = true; }
      if (lotus) cu.mesh.material.color.copy(lotusPadColor(look));
      else cu.mesh.material.color.set(cushionColor(look));
      cu.mesh.material.metalness = look?.metal || 0;
      cu.mesh.material.roughness = look?.metal ? 0.45 : 0.95;
      cu.petals.visible = lotus;
      if (lotus) {
        if (!cu.petals.children.length) cu.petals.add(makeLotusPetals(look.petal || '#d97a95'));
        const pm = cu.petals.children[0].material;
        pm.color.set(look.petal || look.color || '#d97a95');
        pm.metalness = (look.metal || 0) * 0.4;
      }
    },
    addIncense() { spawnSmoke(6); },
    brightenCandles() { candleBoost = 600; },
    offerFlowers() { launchFireworks('#ffd166'); },
    update(dt, time) {
      candleBoost = Math.max(0, candleBoost - dt);
      const boost = candleBoost > 0 ? 1.8 : 1;
      for (const { f, pl, base } of flames) {
        const k = 1 + Math.sin(time * 8 + f.position.x) * 0.04;
        f.scale.setScalar(boost > 1 ? 1.25 : 1);
        pl.intensity = base * k * boost;
      }
      updaters.forEach((u) => u(dt, time));
      sur.update(dt, time);
    },
    dispose() {
      sur.dispose();
      scene.remove(g);
      g.traverse((o) => { o.geometry?.dispose?.(); if (o.material && !o.material.map?.isCanvasTextureCached) o.material.dispose?.(); });
    },
  };
}
