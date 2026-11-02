// Đồ Tây Du Ký: mũ gắn vào đầu, pháp khí dựng bên phải, Cân Đẩu Vân dưới chân. Người khác thấy được vì dựng từ equipped như áo.
// Khu Nhà Tù: mũ kê-pi Công an nhân dân (HATS.kepi) và dụng cụ lao động/công vụ (makeTool).
// Hình và vật liệu dùng chung (mỗi mẫu dựng một lần rồi clone), disposeAvatar không huỷ chúng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const std =(color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const GOLD = std('#e0ac3c', { metalness: 0.75, roughness: 0.32, emissive: '#5a3a08', emissiveIntensity: 0.35 });
const GOLD_D = std('#a87522', { metalness: 0.7, roughness: 0.42, emissive: '#2c1b04', emissiveIntensity: 0.3 });
const RED = std('#b3261c', { roughness: 0.45, emissive: '#3a0806', emissiveIntensity: 0.3 });
const WOOD = std('#5b3a20', { roughness: 0.75 });
const STEEL = std('#c7ced6', { metalness: 0.7, roughness: 0.3, emissive: '#23262a', emissiveIntensity: 0.3 });
const GEM = std('#2fb7a6', { metalness: 0.2, roughness: 0.15, emissive: '#0d5a50', emissiveIntensity: 0.6 });
const PLUME = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

function add(g, geo, mat, x = 0, y = 0, z = 0, rot) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z);
  if (rot) o.rotation.set(...rot);
  o.castShadow = true; g.add(o); return o;
}
const cyl = (r, h, top = r) => new THREE.CylinderGeometry(top, r, h, 14);
const ball = (r) => new THREE.SphereGeometry(r, 14, 10);

// lông trĩ: thon dần về ngọn, khoang đỏ sậm xen vàng nâu như đuôi trĩ thật
function plumeGeo(points, r0) {
  const curve = new THREE.CatmullRomCurve3(points), SEG = 30, SIDE = 6, pos = [], col = [], idx = [];
  const frames = curve.computeFrenetFrames(SEG, false);
  const c = new THREE.Color();
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, p = curve.getPoint(t), r = r0 * (1 - t * 0.9), band = Math.sin(t * 42) > 0;
    c.set(band ? '#8e1d14' : '#d9a23c').multiplyScalar(t > 0.93 ? 0.5 : 1);
    for (let j = 0; j < SIDE; j++) {
      const a = (j / SIDE) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r * 0.55);
      pos.push(p.x + n.x, p.y + n.y, p.z + n.z); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < SIDE; j++) {
    const a = i * SIDE + j, b = a + SIDE, d = i * SIDE + (j + 1) % SIDE, e = d + SIDE;
    idx.push(a, b, d, d, b, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function petalGeo(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.5, 0); s.bezierCurveTo(-w * 0.62, h * 0.5, -w * 0.25, h * 0.85, 0, h);
  s.bezierCurveTo(w * 0.25, h * 0.85, w * 0.62, h * 0.5, w * 0.5, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false, curveSegments: 8 });
}

const HATS = {
  // nón thần: nón lá viền vàng
  non_than() {
    const g = new THREE.Group();
    add(g, new THREE.ConeGeometry(0.72, 0.42, 32, 1, true), std('#e7d7a4', { roughness: 0.8, side: THREE.DoubleSide }), 0, 0.42, 0);
    // vành tre chạy quanh nón, cách đều như nón lá thật
    for (let i = 1; i <= 9; i++) { const k = i / 10; add(g, new THREE.TorusGeometry(0.72 * k, i % 3 ? 0.0035 : 0.006, 5, 36), i % 3 ? BAMBOO_D : GOLD_D, 0, 0.63 - 0.42 * k, 0, [Math.PI / 2, 0, 0]); }
    add(g, new THREE.TorusGeometry(0.72, 0.016, 6, 40), GOLD, 0, 0.21, 0, [Math.PI / 2, 0, 0]);
    add(g, ball(0.035), GEM, 0, 0.64, 0);
    return g;
  },
  // vòng kim cô của Tôn Ngộ Không
  kim_co() {
    const g = new THREE.Group();
    add(g, new THREE.TorusGeometry(0.405, 0.026, 8, 40), GOLD, 0, 0.13, 0, [Math.PI / 2 - 0.08, 0, 0]);
    add(g, new THREE.TorusGeometry(0.405, 0.01, 6, 40), GOLD_D, 0, 0.17, 0, [Math.PI / 2 - 0.08, 0, 0]);
    add(g, ball(0.045), GEM, 0, 0.13, -0.42, [0, 0, 0]).scale.set(1, 1.2, 0.5);
    for (const s of [-1, 1]) add(g, new THREE.TorusGeometry(0.05, 0.012, 6, 16), GOLD, s * 0.09, 0.14, -0.395, [0, s * 0.3, 0]);
    return g;
  },
  // tử kim quan phượng sí: mũ vàng, ngù đỏ, hai lông trĩ dài cong ra sau
  tu_kim_quan() {
    const g = new THREE.Group();
    add(g, new THREE.TorusGeometry(0.405, 0.035, 8, 40), GOLD, 0, 0.13, 0, [Math.PI / 2 - 0.08, 0, 0]);
    const dome = new THREE.SphereGeometry(0.415, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.46);
    add(g, dome, GOLD_D, 0, 0.1, 0.01);
    add(g, petalGeo(0.3, 0.34), GOLD, 0, 0.14, -0.41, [-0.22, 0, 0]);
    add(g, ball(0.05), GEM, 0, 0.27, -0.455).scale.set(1, 1.2, 0.5);
    for (const s of [-1, 1]) {
      add(g, petalGeo(0.2, 0.26), GOLD, s * 0.25, 0.15, -0.33, [-0.2, -s * 0.65, 0]);
      add(g, ball(0.075), RED, s * 0.33, 0.42, -0.1);
      add(g, ball(0.055), RED, s * 0.43, 0.13, -0.02);
      const root = new THREE.Group(); root.position.set(s * 0.14, 0.42, -0.22); root.userData.sway = s;
      add(root, plumeGeo([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.08, 0.5, 0.02), new THREE.Vector3(s * 0.26, 1.0, 0.22),
        new THREE.Vector3(s * 0.56, 1.28, 0.62), new THREE.Vector3(s * 0.92, 1.16, 1.0),
      ], 0.036), PLUME);
      g.add(root);
    }
    add(g, ball(0.07), RED, 0, 0.53, 0.02);
    return g;
  },
  // mũ Tỳ Lư của Đường Tăng: năm cánh sen trước trán, dải đỏ sau tai
  ty_lu() {
    const g = new THREE.Group();
    add(g, new THREE.TorusGeometry(0.405, 0.03, 8, 40), RED, 0, 0.14, 0, [Math.PI / 2 - 0.08, 0, 0]);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.52, p = new THREE.Group();
      p.position.set(Math.sin(a) * 0.4, 0.13, -Math.cos(a) * 0.4); p.rotation.y = -a;
      const h = 0.46 - Math.abs(i) * 0.05;
      add(p, petalGeo(0.26, h), GOLD, 0, 0, -0.012, [-0.2, 0, 0]);
      add(p, petalGeo(0.17, h * 0.72), RED, 0, 0.025, -0.036, [-0.2, 0, 0]);
      add(p, ball(0.032), GEM, 0, h * 0.42, -0.1).scale.z = 0.5;
      g.add(p);
    }
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.07, 0.62, 0.012), RED, s * 0.36, -0.15, 0.2, [0.25, 0, -s * 0.12]);
    return g;
  },
};

const IVORY = std('#e8d286', { roughness: 0.38, emissive: '#4a380c', emissiveIntensity: 0.25 });
const BAMBOO = std('#6e9450', { roughness: 0.48, emissive: '#142a0a', emissiveIntensity: 0.2 });
const BAMBOO_D = std('#3f5f2a', { roughness: 0.62 });

// lá tre: thon nhọn hai đầu, dẹt
function leafGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.05, 0.14, 0, 0.36); s.quadraticCurveTo(-0.05, 0.14, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}
function bamboo(body, ring, n, leaf) {
  const g = new THREE.Group(), H = 2.3, geo = leafGeo();
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, ra = 0.042 - a * 0.016, rb = 0.042 - b * 0.016;
    add(g, new THREE.CylinderGeometry(rb, ra, (H / n) * 0.97, 12), body, 0, (a + b) / 2 * H, 0);
    if (i) { add(g, new THREE.CylinderGeometry(ra + 0.005, ra + 0.005, 0.016, 12), ring, 0, a * H, 0); }
  }
  // cành nhỏ gần ngọn, mỗi cành một chùm lá rủ
  for (const [y, dir, ry] of [[H * 0.97, 1, 0.3], [H * 0.9, -1, 2.2], [H * 0.8, 1, 4.1]]) {
    const sprig = new THREE.Group(); sprig.position.y = y; sprig.rotation.y = ry; g.add(sprig);
    add(sprig, new THREE.CylinderGeometry(0.004, 0.008, 0.22, 5), ring, dir * 0.08, 0.05, 0, [0, 0, -dir * 1.1]);
    for (const [z, x] of [[-dir * 2.2, 0.15], [-dir * 1.55, -0.4], [-dir * 0.8, 0.35], [-dir * 2.7, 0.5]]) add(sprig, geo, leaf, dir * 0.17, 0.09, 0, [x, 0, z]);
  }
  return g;
}

const STAFFS = {
  // tre ngà làng Gióng: thân vàng ngà thon dần, đốt phình có vạch nâu, ngọn tủa lá
  tre_nga() { return bamboo(IVORY, GOLD_D, 7, std('#7fa64f', { roughness: 0.55, side: THREE.DoubleSide })); },
  // tre trăm đốt: xanh già, đốt ngắn và dày
  tram_dot() { return bamboo(BAMBOO, BAMBOO_D, 16, std('#4f8a3c', { roughness: 0.6, side: THREE.DoubleSide })); },
  // gậy thần: gỗ mun cong nhẹ, đầu ngọc ôm vòng vàng
  gay_than() {
    const g = new THREE.Group();
    add(g, cyl(0.036, 1.1, 0.03), WOOD, 0, 0.55, 0);
    add(g, cyl(0.03, 1.0, 0.038), WOOD, 0.03, 1.55, 0, [0, 0, -0.06]);
    add(g, cyl(0.046, 0.05), GOLD, 0.01, 1.08, 0);
    add(g, new THREE.TorusGeometry(0.13, 0.02, 8, 24), GOLD, 0.06, 2.18, 0);
    add(g, ball(0.085), GEM, 0.06, 2.18, 0);
    return g;
  },
  // thiền trượng: cán đỏ, đầu tháp vàng, sáu khoen đồng rung khi đi
  thien_truong() {
    const g = new THREE.Group();
    add(g, cyl(0.03, 2.0), RED, 0, 1, 0);
    for (const y of [0.04, 0.72, 1.4, 1.98]) add(g, cyl(0.042, 0.06), GOLD, 0, y, 0);
    add(g, new THREE.TorusGeometry(0.2, 0.024, 8, 28), GOLD, 0, 2.22, 0).scale.y = 1.25;
    add(g, new THREE.TorusGeometry(0.12, 0.014, 6, 20), GOLD_D, 0, 2.2, 0).scale.y = 1.3;
    add(g, ball(0.05), GOLD, 0, 2.5, 0);
    add(g, new THREE.ConeGeometry(0.035, 0.14, 8), GOLD, 0, 2.6, 0);
    add(g, petalGeo(0.15, 0.2), GOLD, 0, 2.03, -0.01);
    const rings = new THREE.Group(); rings.position.y = 2.2; rings.userData.jingle = 1;
    for (const [x, y] of [[-0.24, 0.1], [-0.27, -0.06], [-0.2, -0.2], [0.24, 0.1], [0.27, -0.06], [0.2, -0.2]]) add(rings, new THREE.TorusGeometry(0.052, 0.009, 6, 14), GOLD, x, y, 0, [0, 0.9, 0]);
    g.add(rings);
    return g;
  },
  // Như Ý Kim Cô Bổng: thân đỏ son, hai đầu vàng
  kim_co_bong() {
    const g = new THREE.Group();
    add(g, cyl(0.04, 2.3), std('#c8301e', { roughness: 0.35, emissive: '#541006', emissiveIntensity: 0.5 }), 0, 1.15, 0);
    for (const y of [0.13, 2.17]) add(g, cyl(0.052, 0.26), GOLD, 0, y, 0);
    for (const y of [0.3, 2]) add(g, new THREE.TorusGeometry(0.052, 0.012, 6, 18), GOLD_D, 0, y, 0, [Math.PI / 2, 0, 0]);
    return g;
  },
  // cửu xỉ đinh ba của Trư Bát Giới
  dinh_ba() {
    const g = new THREE.Group();
    add(g, cyl(0.032, 1.95), WOOD, 0, 0.97, 0);
    add(g, new THREE.BoxGeometry(0.72, 0.12, 0.09), GOLD_D, 0, 1.97, 0);
    add(g, ball(0.075), GEM, 0, 2.02, -0.04).scale.z = 0.5;
    for (let i = 0; i < 9; i++) add(g, new THREE.ConeGeometry(0.024, 0.34, 8), STEEL, -0.32 + i * 0.08, 1.74, 0, [Math.PI, 0, 0]);
    return g;
  },
  // nguyệt nha sản của Sa Tăng: đầu xẻng bán nguyệt, đuôi trăng khuyết
  nguyet_nha() {
    const g = new THREE.Group();
    add(g, cyl(0.03, 2.1), WOOD, 0, 1.05, 0);
    for (const y of [0.4, 1.7]) add(g, cyl(0.04, 0.05), GOLD, 0, y, 0);
    const s = new THREE.Shape(); s.moveTo(-0.22, 0); s.quadraticCurveTo(-0.26, 0.26, 0, 0.36); s.quadraticCurveTo(0.26, 0.26, 0.22, 0); s.quadraticCurveTo(0, 0.1, -0.22, 0);
    add(g, new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), STEEL, 0, 2.08, -0.01);
    const m = new THREE.Shape(); m.moveTo(-0.24, 0.16); m.quadraticCurveTo(0, -0.26, 0.24, 0.16); m.quadraticCurveTo(0, -0.06, -0.24, 0.16);
    add(g, new THREE.ExtrudeGeometry(m, { depth: 0.02, bevelEnabled: false }), STEEL, 0, -0.02, -0.01);
    add(g, ball(0.045), GOLD, 0, 2.08, 0);
    return g;
  },
};

// Cân Đẩu Vân: vầng mây vàng trắng dưới chân, khi ngồi thì ẩn
function cloudModel(kind) {
  const g = new THREE.Group(), m = kind === 'song_bac' ? std('#9fd6f2', { roughness: 0.4, metalness: 0.15, emissive: '#1f7fc4', emissiveIntensity: 0.55 }) : std('#fffaf0', { roughness: 0.9, emissive: '#ffd98a', emissiveIntensity: 0.35 });
  for (const [x, y, z, r] of [[0, 0.1, 0, 0.42], [0.42, 0.08, 0.05, 0.3], [-0.42, 0.08, 0.05, 0.3], [0.2, 0.08, -0.38, 0.28], [-0.2, 0.08, 0.4, 0.28], [-0.26, 0.06, -0.3, 0.25], [0.28, 0.06, 0.36, 0.25], [0.72, 0.06, -0.06, 0.2], [-0.72, 0.06, -0.06, 0.18], [0.95, 0.05, 0.1, 0.12]]) add(g, new THREE.SphereGeometry(r, 14, 10), m, x, y, z).scale.y = 0.55;
  return g;
}

/* ---------- Công an nhân dân: mũ kê-pi; đồ lao động ở trại cải tạo ---------- */
function ctex(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function star5(g, cx, cy, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  g.closePath();
}
const OLIVE = std('#6b7a3c', { roughness: 0.82 });
const CAP_RED = std('#c8231e', { roughness: 0.55, side: THREE.DoubleSide });
// Phong (không phản chiếu môi trường) để lưỡi trai luôn đen bóng, không bạc màu khi nhìn xiên
const VISOR = new THREE.MeshPhongMaterial({ color: '#070708', specular: '#3a3a40', shininess: 70, side: THREE.DoubleSide });
const BRASS = std('#e9b93a', { metalness: 0.8, roughness: 0.28, emissive: '#5a3a08', emissiveIntensity: 0.35 });
// Công an hiệu: vành vàng kết bông lúa, nền đỏ, sao vàng ở giữa
let badgeMat;
function badge() {
  badgeMat ||= new THREE.MeshStandardMaterial({
    roughness: 0.3, metalness: 0.35, emissive: '#2a0a04', emissiveIntensity: 0.2,
    map: ctex(128, 128, (g, w) => {
      const c = w / 2;
      g.fillStyle = '#9c6f1c'; g.beginPath(); g.arc(c, c, 64, 0, 7); g.fill();
      g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(c, c, 59, 0, 7); g.fill();
      g.fillStyle = '#b8861f';
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
        const a = Math.PI / 2 + s * (0.45 + i * 0.3);
        g.save(); g.translate(c + Math.cos(a) * 49, c + Math.sin(a) * 49); g.rotate(a + s * 0.7);
        g.beginPath(); g.ellipse(0, 0, 7, 3.2, 0, 0, 7); g.fill(); g.restore();
      }
      g.fillStyle = '#d3261b'; g.beginPath(); g.arc(c, c - 2, 38, 0, 7); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#7d140d'; g.stroke();
      star5(g, c, c, 27, 11); g.fillStyle = '#ffd94a'; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = '#b98a10'; g.stroke();
    }),
  });
  const b = new THREE.Group();
  add(b, new THREE.CylinderGeometry(0.086, 0.086, 0.022, 28), BRASS, 0, 0, 0, [Math.PI / 2, 0, 0]);
  add(b, new THREE.CircleGeometry(0.083, 28), badgeMat, 0, 0, -0.0115, [0, Math.PI, 0]).castShadow = false;
  return b;
}
// mũ kê-pi: chóp ô-liu rộng vểnh trước, băng đỏ, lưỡi trai đen bóng, dây coóc-đông vàng, Công an hiệu tròn
HATS.kepi = () => bakeByMaterial(buildKepi());
function buildKepi() {
  const root = new THREE.Group(), g = new THREE.Group();
  // đội hơi ngửa ra sau để lưỡi trai nằm ngay trên lông mày
  g.position.set(0, 0.05, 0.01); g.rotation.x = 0.1; root.add(g);
  add(g, new THREE.CylinderGeometry(0.445, 0.43, 0.115, 40, 1, true), CAP_RED, 0, 0.215, 0);
  const top = new THREE.Group(); top.position.set(0, 0.27, 0); top.rotation.x = 0.12; g.add(top);
  // chóp loe rộng, thân kéo xuống lọt vào băng đỏ để không hở khi vểnh trước
  add(top, new THREE.CylinderGeometry(0.545, 0.44, 0.17, 44, 1, true), OLIVE, 0, 0.04, -0.025).scale.z = 1.05;
  add(top, new THREE.SphereGeometry(0.545, 44, 10, 0, Math.PI * 2, 0, Math.PI / 2), OLIVE, 0, 0.125, -0.025).scale.set(1, 0.16, 1.05);
  add(top, new THREE.TorusGeometry(0.545, 0.013, 6, 56), CAP_RED, 0, 0.125, -0.025, [Math.PI / 2, 0, 0]).scale.set(1, 1.05, 1);
  const bd = badge(); bd.position.set(0, 0.035, -0.548); bd.rotation.x = -0.4; bd.scale.setScalar(1.1); top.add(bd);
  // lưỡi trai đen bóng: nửa đĩa phía trước, gập xuống quanh mép trước của băng mũ (không hở trán)
  const hinge = new THREE.Group(); hinge.position.set(0, 0.165, -0.43); hinge.rotation.x = -0.3; g.add(hinge);
  add(hinge, new THREE.CylinderGeometry(0.445, 0.445, 0.018, 32, 1, false, Math.PI / 2 + 0.32, Math.PI - 0.64), VISOR, 0, 0, 0.43).scale.z = 1.36;
  const cord = new THREE.TorusGeometry(0.452, 0.012, 6, 32, 1.7).rotateX(-Math.PI / 2).rotateY(Math.PI / 2 - 0.85);
  add(g, cord, BRASS, 0, 0.2, 0);
  for (const s of [-1, 1]) add(g, ball(0.02), BRASS, s * 0.452 * Math.sin(0.85), 0.2, -0.452 * Math.cos(0.85));
  return root;
}

const WOOD_L = std('#8d5c33', { roughness: 0.68 });
const STEEL_D = std('#5f666e', { metalness: 0.6, roughness: 0.42 });
const BAMBOO_L = std('#c39b5c', { roughness: 0.55 });
const GREEN = std('#2f9a52', { roughness: 0.38, metalness: 0.08 });
const GREEN_D = std('#1d6b38', { roughness: 0.45 });
const RUBBER = std('#141416', { roughness: 0.42 });
const BUCKET = std('#3f78b9', { roughness: 0.48, side: THREE.DoubleSide });
const BRAN = std('#a87a40', { roughness: 0.95 });
const BOARD = std('#8b5a2b', { roughness: 0.62 });
const NET = new THREE.MeshBasicMaterial({ color: '#eef3f6', wireframe: true });
const WATER = new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: '#2f7fc0', emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.75 });
let paperMat;
const TOOLS = {
  // xẻng: cán gỗ tay nắm chữ T, lưỡi thép nhọn; lưỡi hướng về phía trước
  xeng() {
    const g = new THREE.Group();
    add(g, cyl(0.021, 0.56), WOOD_L, 0, -0.12, 0);
    add(g, cyl(0.02, 0.14), WOOD_L, 0, 0.16, 0, [0, 0, Math.PI / 2]);
    add(g, cyl(0.026, 0.09, 0.019), STEEL_D, 0, -0.42, 0);
    const s = new THREE.Shape();
    s.moveTo(-0.08, 0); s.lineTo(0.08, 0); s.lineTo(0.085, -0.1); s.quadraticCurveTo(0.07, -0.17, 0, -0.205); s.quadraticCurveTo(-0.07, -0.17, -0.085, -0.1); s.closePath();
    add(g, new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 6 }), STEEL, 0, -0.44, -0.006);
    return g;
  },
  // cuốc chim: cán gỗ dài, đầu thép một bên nhọn một bên dẹt, cong về phía cán
  cuoc() {
    const g = new THREE.Group();
    add(g, cyl(0.022, 0.72, 0.019), WOOD_L, 0, -0.29, 0);
    const h = new THREE.Group(); h.position.y = -0.64; g.add(h);
    add(h, new THREE.BoxGeometry(0.055, 0.08, 0.07), STEEL_D);
    add(h, new THREE.ConeGeometry(0.03, 0.3, 8), STEEL, 0, 0.03, 0.16, [Math.PI / 2 - 0.25, 0, 0]);
    add(h, new THREE.BoxGeometry(0.05, 0.022, 0.24), STEEL, 0, 0.025, -0.13, [0.2, 0, 0]);
    return g;
  },
  // vợt bắt cá cán dài: cán tre, vành thép, lưới trắng
  vot() {
    const g = new THREE.Group();
    add(g, cyl(0.018, 1.12), BAMBOO_L, 0, -0.26, 0);
    add(g, new THREE.TorusGeometry(0.16, 0.011, 6, 28), STEEL_D, 0, -0.98, 0);
    add(g, new THREE.ConeGeometry(0.155, 0.24, 12, 3, true), NET, 0, -0.98, 0.12, [Math.PI / 2, 0, 0]).castShadow = false;
    return g;
  },
  // bình tưới xanh: quai xách trên đỉnh (chỗ cầm), vòi dài có hoa sen tưới
  binh() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.1, 0.112, 0.17, 22), GREEN, 0, -0.175, 0);
    add(g, new THREE.TorusGeometry(0.1, 0.012, 6, 22), GREEN_D, 0, -0.09, 0, [Math.PI / 2, 0, 0]);
    add(g, new THREE.CircleGeometry(0.1, 22), GREEN_D, 0, -0.092, 0, [-Math.PI / 2, 0, 0]);
    add(g, new THREE.TorusGeometry(0.078, 0.014, 6, 16, Math.PI), GREEN_D, 0, -0.088, 0, [0, Math.PI / 2, 0]);
    add(g, cyl(0.017, 0.28, 0.012), GREEN, 0, -0.15, -0.21, [-1.05, 0, 0]);
    add(g, cyl(0.04, 0.05, 0.016), GREEN_D, 0, -0.08, -0.33, [-1.05, 0, 0]);
    // tia nước (ẩn, chỉ hiện khi đang tưới — avatar.js điều khiển)
    const stream = new THREE.Group(); stream.position.set(0, -0.06, -0.36); stream.userData.stream = true; stream.visible = false;
    for (let i = 0; i < 5; i++) add(stream, ball(0.014 + (i % 2) * 0.006), WATER).castShadow = false;
    g.add(stream);
    return g;
  },
  // bìa kẹp hồ sơ của quản giáo (giấy kẻ dòng, không chữ); cầm ở mép phải
  clipboard() {
    paperMat ||= new THREE.MeshStandardMaterial({
      roughness: 0.9,
      map: ctex(64, 80, (g, w, h) => {
        g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#9aa3ad';
        for (let y = 14; y < h - 6; y += 7) g.fillRect(8, y, w - 16 - (y % 3) * 6, 1.5);
        g.fillStyle = '#c8231e'; g.fillRect(8, 5, 18, 3);
      }),
    });
    const g = new THREE.Group();
    add(g, new THREE.BoxGeometry(0.2, 0.27, 0.012), BOARD, -0.09, 0, 0);
    add(g, new THREE.PlaneGeometry(0.17, 0.22), paperMat, -0.09, -0.015, 0.0065).castShadow = false;
    add(g, new THREE.BoxGeometry(0.08, 0.03, 0.02), STEEL, -0.09, 0.12, 0.009);
    return g;
  },
  // dùi cui đen đeo hông, có vòng treo ở thắt lưng
  baton() {
    const g = new THREE.Group();
    add(g, cyl(0.021, 0.44, 0.018), RUBBER, 0, -0.2, 0);
    add(g, cyl(0.025, 0.12), std('#2a2a2e', { roughness: 0.8 }), 0, -0.04, 0);
    add(g, new THREE.TorusGeometry(0.032, 0.008, 6, 14), RUBBER, 0, 0.0, 0, [Math.PI / 2, 0, 0]);
    return g;
  },
  // xô cám cho lợn (cầm tay trái)
  xo() {
    const g = new THREE.Group();
    add(g, new THREE.CylinderGeometry(0.11, 0.085, 0.16, 18, 1, true), BUCKET, 0, -0.2, 0);
    add(g, new THREE.CircleGeometry(0.085, 18), BUCKET, 0, -0.279, 0, [Math.PI / 2, 0, 0]);
    add(g, new THREE.TorusGeometry(0.11, 0.01, 6, 22), BUCKET, 0, -0.12, 0, [Math.PI / 2, 0, 0]);
    add(g, new THREE.TorusGeometry(0.11, 0.006, 5, 16, Math.PI), STEEL_D, 0, -0.12, 0);
    add(g, new THREE.CircleGeometry(0.102, 18), BRAN, 0, -0.145, 0, [-Math.PI / 2, 0, 0]);
    return g;
  },
};

const cache = new Map();
const model = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key).clone(true); };

// gộp các mảnh cùng vật liệu thành một lần vẽ (giữ nguyên nhóm có userData, ví dụ tia nước)
function bakeByMaterial(src) {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), groups = new Map(), out = new THREE.Group(), keep = [];
  src.traverse((o) => {
    if (o !== src && Object.keys(o.userData).length) { keep.push(o); return; }
    if (!o.isMesh || keep.some((k) => o.parent === k || k.getObjectById(o.id))) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(g);
  });
  for (const [mat, list] of groups) {
    const mesh = new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], mat);
    mesh.castShadow = mat !== NET; out.add(mesh);
  }
  for (const k of keep) { k.removeFromParent(); out.add(k); }
  return out;
}

// dụng cụ lao động / công vụ: gốc toạ độ là chỗ tay cầm, đầu làm việc hướng -y (dựng một lần, các nhân vật dùng bản clone)
export function makeTool(kind) {
  if (!TOOLS[kind]) return null;
  const t = model('t' + kind, () => bakeByMaterial(TOOLS[kind]()));
  t.rotation.order = 'YXZ';
  return t;
}

export function addGear(av, { hat, staff, cloud }) {
  const parts = { sways: [], rings: [] };
  if (HATS[hat?.model]) {
    const h = model('h' + hat.model, HATS[hat.model]);
    av.head.add(h);
    h.traverse((o) => { if (o.userData.sway) parts.sways.push(o); });
  }
  if (STAFFS[staff?.model]) {
    const s = model('s' + staff.model, STAFFS[staff.model]);
    s.position.set(0.68, 0, -0.08); s.rotation.z = -0.05;
    av.root.add(s);
    s.traverse((o) => { if (o.userData.jingle) parts.rings.push(o); });
  }
  if (cloud) { av.cloud = model('cloud' + (cloud.model || ''), () => cloudModel(cloud.model)); av.root.add(av.cloud); }
  if (!parts.sways.length && !parts.rings.length && !av.cloud) return;
  av.gearTick = (time, moving) => {
    const k = moving ? 2.2 : 1;
    for (const p of parts.sways) { p.rotation.z = Math.sin(time * 1.5 * k + av.phase) * 0.035 * k * p.userData.sway; p.rotation.x = Math.sin(time * 1.1 * k + av.phase) * 0.03 * k; }
    for (const r of parts.rings) r.rotation.z = moving ? Math.sin(time * 9) * 0.1 : Math.sin(time * 0.9 + av.phase) * 0.02;
    if (av.cloud) av.cloud.position.y = 0.02 + Math.sin(time * 1.6 + av.phase) * 0.025;
  };
}
