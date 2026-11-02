// Mini-game lao động cải tạo ở Trại Cải Tạo Bình Minh (khu nhatu): Trồng rau, Nuôi lợn, Nuôi cá, Đào đá.
// Mỗi buổi là một màn chơi toàn màn hình vẽ bằng canvas 2D + emoji (không dùng ảnh ngoài), chạm hay chuột đều chơi được.
// runRehab(task, { durSec, pass, maxScore, practice, onFinish(score), onCancel }) → { close(), score }
// onFinish có thể trả Promise: màn kết quả chờ ghi sổ xong mới đóng.
import { Sound } from './audio.js';

export const REHAB = {
  trongrau: {
    id: 'trongrau', name: 'Trồng rau', icon: '🥬', need: 2, minSec: 20, pass: 6, maxScore: 40, work: 'water',
    desc: 'Xới đất, gieo hạt, tưới nước rồi thu hoạch rau xanh ở vườn trại.',
    hint: 'Bấm luống: cuốc ⛏️ → gieo 🌰 → tưới 💧 → chờ lớn → hái 🥬. Gieo rồi không tưới là héo!',
    how: ['Bấm vào luống đất để làm bước kế tiếp: cuốc xới ⛏️, gieo hạt 🌰, tưới nước 💧 (biểu tượng nhỏ ở góc luống cho biết bước tiếp theo).', 'Rau lớn sau khoảng 3 giây, bấm vào rau 🥬 để thu hoạch (+1).', 'Luống đã gieo mà không tưới kịp, hoặc rau chín để quá lâu, sẽ héo 🥀 — bấm để dọn.', 'Sâu 🐛 bò lên rau thì bấm bắt ngay kẻo sâu ăn mất rau.'],
  },
  nuoilon: {
    id: 'nuoilon', name: 'Nuôi lợn', icon: '🐷', need: 2, minSec: 20, pass: 8, maxScore: 60, work: 'feed',
    desc: 'Cho lợn ăn đúng lúc đói và dọn chuồng luôn sạch sẽ.',
    hint: 'Bấm (hoặc kéo) xô cám 🪣 rồi bấm con lợn đang đói 🍚. Bấm 💩 để dọn chuồng.',
    how: ['Mỗi con lợn có thanh no – đói. Lợn đói thì hiện bong bóng 🍚.', 'Bấm hoặc kéo xô cám, rồi bấm vào con lợn đang đói để cho ăn (+1). Lợn còn no thì không chịu ăn.', 'Phân 💩 rơi trong chuồng: bấm để dọn (+1). Chuồng bẩn làm lợn mau đói.'],
  },
  nuoica: {
    id: 'nuoica', name: 'Nuôi cá', icon: '🐟', need: 2, minSec: 20, pass: 5, maxScore: 40, work: 'net',
    desc: 'Rắc cám cho cá ăn, chỉ vớt những con cá đã lớn.',
    hint: 'Bấm mặt nước để rắc cám. Cá lớn có vòng vàng ✨ thì bấm để vớt. Vớt cá nhỏ bị trừ điểm!',
    how: ['Bấm vào chỗ nước trống để rắc cám, cá sẽ bơi tới ăn và lớn dần.', 'Cá đủ lớn có vòng sáng vàng ✨: bấm vào cá để vớt (+1).', 'Vớt nhầm cá còn nhỏ bị trừ 1 điểm và cá sợ hãi bơi đi.'],
  },
  daoda: {
    id: 'daoda', name: 'Đào đá', icon: '⛏️', need: 2, minSec: 20, pass: 8, maxScore: 50, work: 'dig',
    desc: 'Canh đúng nhịp bổ cuốc để đập vỡ tảng đá, chở đá về xe cút kít.',
    hint: 'Bấm màn hình (hoặc phím Space) khi kim vào vùng xanh. Trúng 3 nhát là vỡ tảng!',
    how: ['Kim lực chạy qua lại trên thanh phía dưới. Bấm màn hình hoặc phím Space khi kim nằm trong vùng xanh để bổ đá.', 'Trúng 3 nhát thì tảng đá vỡ, một viên vào xe cút kít (+1). Trúng ngay vạch vàng ở giữa tính 2 nhát.', 'Bổ trượt thì mất nhịp một lúc và vùng xanh đổi chỗ. Càng về sau kim chạy càng nhanh.'],
  },
};

/* ---------------- tiện ích vẽ ---------------- */
const TAU = Math.PI * 2;
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
const lerp = (a, b, k) => a + (b - a) * k;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function emo(c, ch, x, y, size, { alpha = 1, rot = 0, sx = 1 } = {}) {
  if (size < 2 || alpha <= 0) return;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); if (rot) c.rotate(rot); if (sx !== 1) c.scale(sx, 1);
  c.font = `${Math.round(size)}px ${EMOJI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, 0, size * 0.06);
  c.restore();
}
function label(c, text, x, y, { size = 16, color = '#fff', stroke = 'rgba(0,0,0,.6)', weight = 800, align = 'center', alpha = 1 } = {}) {
  if (alpha <= 0 || size < 2) return;
  c.save(); c.globalAlpha *= alpha;
  c.font = `${weight} ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = stroke; c.strokeText(text, x, y); }
  c.fillStyle = color; c.fillText(text, x, y);
  c.restore();
}
// vòng tiến độ / đếm ngược quanh một vật
function ring(c, x, y, r, frac, color, w = 5) {
  c.save(); c.lineCap = 'round'; c.lineWidth = w;
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  c.strokeStyle = color; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1)); c.stroke();
  c.restore();
}

/* ---------------- âm thanh nhỏ (Web Audio của Sound, chưa bật thì im lặng) ---------------- */
const sfx = {
  tone(f, d = 0.12, type = 'sine', vol = 0.12, slide = 1, delay = 0) {
    const a = Sound.ctx; if (!a) return;
    try {
      const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(Sound.bus?.sfx || Sound.master); o.start(t); o.stop(t + d + 0.03);
    } catch {}
  },
  tap() { this.tone(880, 0.05, 'triangle', 0.07); },
  good() { this.tone(660, 0.1, 'triangle', 0.1); this.tone(990, 0.16, 'triangle', 0.09, 1, 0.07); },
  ding() { this.tone(1320, 0.18, 'sine', 0.07); },
  bad() { this.tone(240, 0.22, 'sawtooth', 0.05, 0.55); },
  thud() { this.tone(110, 0.16, 'square', 0.07, 0.45); this.tone(1800, 0.05, 'triangle', 0.04, 0.6); },
  crack() { this.tone(90, 0.3, 'square', 0.09, 0.4); this.tone(2400, 0.08, 'triangle', 0.05, 0.5, 0.02); },
  plip() { this.tone(520, 0.09, 'sine', 0.08, 1.8); },
  oink() { this.tone(330, 0.09, 'sawtooth', 0.04, 1.5); this.tone(300, 0.12, 'sawtooth', 0.04, 1.4, 0.11); },
  chomp() { this.tone(180, 0.06, 'square', 0.05, 0.7); this.tone(160, 0.06, 'square', 0.05, 0.7, 0.12); },
  tick() { this.tone(1200, 0.04, 'square', 0.035); },
  go() { this.tone(523, 0.12, 'triangle', 0.1); this.tone(784, 0.24, 'triangle', 0.1, 1, 0.1); },
  win() { try { Sound.success?.(); } catch {} },
};

/* ---------------- hiệu ứng: hạt bay, chữ nổi, vật bay vào giỏ ---------------- */
function makeFx() {
  return {
    parts: [], pops: [], flies: [], shake: 0, banner: null,
    pop(x, y, text, color = '#fff6b0', size = 24) { this.pops.push({ x, y, text, color, size, t: 0 }); },
    burst(x, y, { n = 10, color = '#fff', speed = 180, life = 0.7, size = 4, grav = 420, emoji = null, up = 0.4, shape = 'dot' } = {}) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * up, life: life * (0.6 + Math.random() * 0.6), t: 0, size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? pick(color) : color, grav, emoji, rot: Math.random() * TAU, vr: rand(-6, 6), shape });
      }
    },
    fly(draw, x0, y0, x1, y1, dur = 0.6, done) { this.flies.push({ draw, x0, y0, x1, y1, dur, t: 0, done }); },
    show(text, color = '#ffe27a', dur = 1.4) { this.banner = { text, color, t: 0, dur }; },
    update(dt) {
      this.shake = Math.max(0, this.shake - dt);
      for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += dt; if (p.t >= p.life) { this.parts.splice(i, 1); continue; } p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) > 0.95) this.pops.splice(i, 1);
      for (let i = this.flies.length - 1; i >= 0; i--) { const f = this.flies[i]; if ((f.t += dt) >= f.dur) { this.flies.splice(i, 1); f.done?.(); } }
      if (this.banner && (this.banner.t += dt) > this.banner.dur) this.banner = null;
    },
    draw(c, W, H) {
      for (const p of this.parts) {
        const a = 1 - p.t / p.life;
        if (p.emoji) emo(c, p.emoji, p.x, p.y, p.size, { alpha: a, rot: p.rot * 0.15 });
        else if (p.shape === 'spark') { c.save(); c.globalAlpha = a; c.strokeStyle = p.color; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); c.stroke(); c.restore(); }
        else if (p.shape === 'shard') { c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.beginPath(); c.moveTo(-p.size, -p.size * 0.6); c.lineTo(p.size, -p.size * 0.3); c.lineTo(p.size * 0.4, p.size * 0.8); c.closePath(); c.fill(); c.restore(); }
        else { c.save(); c.globalAlpha = a; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); c.restore(); }
      }
      for (const f of this.flies) { const k = ease(f.t / f.dur); f.draw(c, lerp(f.x0, f.x1, k), lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 90, k); }
      for (const p of this.pops) { const k = p.t / 0.95; label(c, p.text, p.x, p.y - 46 * ease(k), { size: p.size * (k < 0.12 ? 0.6 + k * 3.3 : 1), color: p.color, alpha: k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1 }); }
      if (this.banner) {
        const b = this.banner, k = b.t / b.dur, s = k < 0.15 ? 0.5 + 0.5 * ease(k / 0.15) : 1;
        label(c, b.text, W / 2, H * 0.4, { size: Math.min(48, W * 0.09) * s, color: b.color, alpha: k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1 });
      }
    },
  };
}

/* =====================================================================
   1) TRỒNG RAU: 3×3 luống — cuốc → gieo → tưới → lớn → hái
   ===================================================================== */
function gardenGame(G) {
  const GROW = 3.2, WATER_MAX = 6, RIPE_MAX = 8, BUG_MAX = 4.5;
  const NEXT = { empty: '⛏️', tilled: '🌰', seeded: '💧', ripe: '🧺', wilted: '🧹' };
  const plots = Array.from({ length: 9 }, (_, i) => ({ i, st: 'empty', t: 0, bug: 0, act: 0, actMax: 0.35, tool: '', wob: 0, seed: Math.floor(Math.random() * 997) }));
  const st = { harvest: 0, wilt: 0 };
  const L = { bump: 0 }, deco = [];
  let bugT = rand(5, 8);
  const pos = (p) => { const x = L.x0 + (p.i % 3) * (L.s + L.gap), y = L.y0 + Math.floor(p.i / 3) * (L.s + L.gap); return { x, y, cx: x + L.s / 2, cy: y + L.s / 2 }; };
  const wilt = (p, msg) => {
    const { cx, cy } = pos(p);
    p.st = 'wilted'; p.t = 0; p.bug = 0; st.wilt++;
    G.fx.pop(cx, cy - L.s * 0.2, msg, '#ffc2b6', 16);
    G.fx.burst(cx, cy, { n: 6, color: ['#8a6a3a', '#a07a44'], speed: 90, size: 4 });
    sfx.bad();
  };
  const tool = (p, ch, dur = 0.35) => { p.tool = ch; p.act = p.actMax = dur; };

  function drawPlot(c, p) {
    const { x, y, cx, cy } = pos(p), s = L.s, vt = G.vt;
    const sh = p.wob > 0 ? Math.sin(p.wob * 50) * p.wob * 8 : 0;
    c.save(); c.translate(sh, 0);
    c.fillStyle = 'rgba(0,0,0,.2)'; rr(c, x + 3, y + 6, s, s, s * 0.14); c.fill();
    c.fillStyle = '#b5844c'; rr(c, x, y, s, s, s * 0.14); c.fill();
    c.strokeStyle = '#8a5f30'; c.lineWidth = 2; c.stroke();
    const m = s * 0.07, ix = x + m, iy = y + m, iw = s - m * 2;
    const wet = p.st === 'growing' || p.st === 'ripe';
    c.fillStyle = p.st === 'empty' ? '#8fbf5a' : p.st === 'wilted' ? '#86663f' : wet ? '#56331a' : '#7d4c27';
    rr(c, ix, iy, iw, iw, s * 0.1); c.fill();
    if (p.st === 'empty') {
      // cỏ dại chưa xới
      c.fillStyle = '#679a39';
      for (let k = 0; k < 6; k++) {
        const a = ((p.seed + k * 37) % 100) / 100, b = ((p.seed * 3 + k * 53) % 100) / 100;
        const tx = ix + iw * (0.15 + a * 0.7), ty = iy + iw * (0.25 + b * 0.65), ts = s * 0.06;
        c.beginPath(); c.moveTo(tx - ts, ty); c.lineTo(tx - ts * 0.3, ty - ts * 1.7); c.lineTo(tx, ty); c.lineTo(tx + ts * 0.5, ty - ts * 1.4); c.lineTo(tx + ts, ty); c.fill();
      }
    } else {
      // rãnh luống
      c.lineCap = 'round';
      for (let k = 1; k <= 3; k++) {
        const yy = iy + (iw * k) / 4;
        c.strokeStyle = 'rgba(0,0,0,.24)'; c.lineWidth = Math.max(2, s * 0.035);
        c.beginPath(); c.moveTo(ix + iw * 0.1, yy); c.quadraticCurveTo(ix + iw / 2, yy + s * 0.04, ix + iw * 0.9, yy); c.stroke();
        c.strokeStyle = 'rgba(255,220,170,.12)'; c.lineWidth = Math.max(1.5, s * 0.02);
        c.beginPath(); c.moveTo(ix + iw * 0.1, yy - s * 0.04); c.quadraticCurveTo(ix + iw / 2, yy, ix + iw * 0.9, yy - s * 0.04); c.stroke();
      }
    }
    if (p.st === 'seeded') {
      c.fillStyle = '#f0d08a';
      for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(ix + iw * (0.2 + (k % 3) * 0.3), iy + iw * (0.3 + Math.floor(k / 3) * 0.4), s * 0.025, 0, TAU); c.fill(); }
      const left = 1 - p.t / WATER_MAX;
      ring(c, cx, cy, s * 0.36, left, left < 0.35 ? '#ff6b5a' : '#7cc7ff', Math.max(3, s * 0.035));
      emo(c, '💧', cx, cy + Math.sin(vt * 6 + p.i) * s * 0.04, s * 0.3, { alpha: 0.9 });
    } else if (p.st === 'growing') {
      const k = p.t / GROW;
      emo(c, '🌱', cx, cy + s * 0.06 - k * s * 0.05, s * (0.22 + k * 0.32));
      ring(c, cx, cy, s * 0.4, k, '#9dff7a', Math.max(3, s * 0.03));
    } else if (p.st === 'ripe') {
      const bob = Math.sin(vt * 5 + p.i) * s * 0.025;
      c.fillStyle = `rgba(255,240,150,${0.18 + Math.sin(vt * 4 + p.i) * 0.08})`; c.beginPath(); c.arc(cx, cy, s * 0.36, 0, TAU); c.fill();
      emo(c, '🥬', cx, cy + bob, s * 0.6);
      if (p.t > RIPE_MAX - 3) ring(c, cx, cy, s * 0.42, 1 - (p.t - (RIPE_MAX - 3)) / 3, '#ffcf4a', Math.max(3, s * 0.03));
    } else if (p.st === 'wilted') {
      emo(c, '🥀', cx, cy, s * 0.46, { alpha: 0.9 });
    }
    if (p.bug) {
      const bx = cx + s * 0.16 + Math.sin(vt * 3 + p.i) * s * 0.08, by = cy - s * 0.1;
      emo(c, '🐛', bx, by, s * 0.27, { sx: Math.cos(vt * 3 + p.i) > 0 ? 1 : -1 });
      ring(c, cx, cy, s * 0.46, 1 - p.bug / BUG_MAX, '#ff6b5a', Math.max(3, s * 0.03));
    }
    // biểu tượng bước kế tiếp ở góc luống
    const nx = p.bug ? '🖐️' : NEXT[p.st];
    if (nx) {
      const hr = s * 0.13, hx = x + s - hr * 0.95, hy = y + hr * 0.95;
      c.fillStyle = 'rgba(255,255,255,.93)'; c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(80,50,20,.25)'; c.lineWidth = 1.5; c.stroke();
      emo(c, nx, hx, hy, hr * 1.2);
    }
    // dụng cụ đang dùng (vung lên rồi hạ xuống)
    if (p.act > 0) { const k = 1 - p.act / p.actMax; emo(c, p.tool, cx + s * 0.18, cy - s * 0.2, s * 0.4, { rot: -0.9 + k * 1.4, alpha: Math.min(1, p.act * 6) }); }
    c.restore();
  }

  return {
    stats: () => `Thu hoạch ${st.harvest} bó rau · ${st.wilt} luống bị héo`,
    layout() {
      const { W, H, top } = G, bottom = 96;
      const aw = W - 24, ah = Math.max(120, H - top - bottom);
      const cell = Math.min(aw / 3, ah / 3, 170);
      L.gap = cell * 0.09; L.s = cell - L.gap;
      const gw = L.s * 3 + L.gap * 2;
      L.x0 = (W - gw) / 2; L.y0 = top + Math.max(0, (ah - gw) / 2);
      L.basket = { x: W / 2, y: H - 50 };
      deco.length = 0;
      for (let k = 0; k < 46; k++) deco.push({ x: Math.random() * W, y: top + Math.random() * (H - top), s: rand(6, 13), f: Math.random() < 0.18 ? pick(['🌼', '🌸', '🌿']) : null });
    },
    update(dt) {
      L.bump = Math.max(0, L.bump - dt);
      for (const p of plots) {
        p.act = Math.max(0, p.act - dt); p.wob = Math.max(0, p.wob - dt);
        if (p.st === 'seeded') { if ((p.t += dt) > WATER_MAX) wilt(p, 'Quên tưới, héo rồi!'); }
        else if (p.st === 'growing') {
          if ((p.t += dt) >= GROW) { p.st = 'ripe'; p.t = 0; const { cx, cy } = pos(p); G.fx.burst(cx, cy - L.s * 0.1, { n: 5, emoji: '✨', size: L.s * 0.16, speed: 80, grav: 0, life: 0.6 }); sfx.ding(); }
        } else if (p.st === 'ripe') { if ((p.t += dt) > RIPE_MAX) wilt(p, 'Chín quá, héo mất!'); }
        if (p.bug && (p.bug += dt) > BUG_MAX) wilt(p, 'Sâu ăn mất rau!');
      }
      if ((bugT -= dt) <= 0) {
        bugT = rand(4.5, 7.5);
        const cand = plots.filter((p) => (p.st === 'growing' || p.st === 'ripe') && !p.bug);
        if (cand.length) pick(cand).bug = 0.001;
      }
    },
    down(x, y) {
      const p = plots.find((q) => { const r = pos(q); return x >= r.x - 4 && x <= r.x + L.s + 4 && y >= r.y - 4 && y <= r.y + L.s + 4; });
      if (!p) return;
      const { cx, cy } = pos(p), s = L.s;
      p.wob = 0.22;
      if (p.bug) {
        p.bug = 0;
        G.fx.pop(cx, cy - s * 0.25, 'Bắt được sâu!', '#e6ffb0', 17);
        G.fx.burst(cx + s * 0.2, cy - s * 0.15, { n: 1, emoji: '🐛', size: s * 0.25, speed: 220, up: 1, grav: 700, life: 0.7 });
        sfx.tap(); return;
      }
      if (p.st === 'empty') { p.st = 'tilled'; tool(p, '⛏️'); G.fx.burst(cx, cy + s * 0.15, { n: 12, color: ['#7a4c2a', '#9c6b3f', '#5d3a1e'], speed: 170, size: 4 }); sfx.thud(); }
      else if (p.st === 'tilled') { p.st = 'seeded'; p.t = 0; tool(p, '🌰'); G.fx.burst(cx, cy - s * 0.1, { n: 8, color: '#e8c27a', speed: 110, size: 3, grav: 500 }); sfx.tap(); }
      else if (p.st === 'seeded') { p.st = 'growing'; p.t = 0; tool(p, '💧', 0.45); G.fx.burst(cx, cy - s * 0.3, { n: 16, color: ['#7cc7ff', '#4aa8f0', '#bfe6ff'], speed: 120, size: 3.5, grav: 700, up: 0.2 }); sfx.plip(); }
      else if (p.st === 'growing') G.fx.pop(cx, cy - s * 0.25, 'Rau đang lớn…', '#e8f5ff', 15);
      else if (p.st === 'ripe') {
        p.st = 'empty'; p.t = 0; st.harvest++;
        G.add(1, cx, cy - s * 0.2);
        const b = L.basket, sz = s * 0.5;
        G.fx.fly((cc, X, Y, k) => emo(cc, '🥬', X, Y, sz * (1 - k * 0.5), { rot: k * 4 }), cx, cy, b.x, b.y - 8, 0.55, () => { L.bump = 0.25; });
        sfx.good();
      } else if (p.st === 'wilted') { p.st = 'empty'; tool(p, '🧹'); G.fx.burst(cx, cy, { n: 10, color: ['#a88a5a', '#7a6a3a'], speed: 140, size: 4 }); sfx.tap(); }
    },
    draw(c) {
      const { W, H } = G;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a5d376'); g.addColorStop(1, '#6a9f43');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const d of deco) {
        if (d.f) { emo(c, d.f, d.x, d.y, d.s * 1.6, { alpha: 0.8 }); continue; }
        c.fillStyle = 'rgba(40,90,20,.28)';
        c.beginPath(); c.moveTo(d.x - d.s * 0.5, d.y); c.lineTo(d.x - d.s * 0.15, d.y - d.s); c.lineTo(d.x, d.y); c.lineTo(d.x + d.s * 0.25, d.y - d.s * 0.9); c.lineTo(d.x + d.s * 0.5, d.y); c.fill();
      }
      // lối đất nơi đặt giỏ rau
      c.fillStyle = 'rgba(140,100,55,.45)'; rr(c, W / 2 - 110, H - 86, 220, 72, 36); c.fill();
      for (const p of plots) drawPlot(c, p);
      const b = L.basket;
      emo(c, '🧺', b.x - 14, b.y, 50 * (1 + L.bump));
      label(c, `× ${st.harvest}`, b.x + 30, b.y + 4, { size: 22, color: '#fffbe0' });
    },
  };
}

/* =====================================================================
   2) NUÔI LỢN: 3 chuồng — cho ăn khi đói, dọn phân
   ===================================================================== */
function drawPig(c, x, y, s, pn, vt) {
  const eat = pn.eat > 0, walk = !eat && pn.moving;
  const bob = walk ? Math.abs(Math.sin(vt * 9 + pn.i)) * s * 0.03 : Math.sin(vt * 2 + pn.i) * s * 0.01;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(0, s * 0.34, s * 0.48, s * 0.09, 0, 0, TAU); c.fill();
  c.translate(0, -bob); c.scale(pn.face, 1);
  // chân
  c.fillStyle = '#e48aa0';
  const lg = walk ? Math.sin(vt * 12 + pn.i) * s * 0.035 : 0;
  [[-0.32, 1], [-0.16, -1], [0.14, 1], [0.3, -1]].forEach(([lx, ph]) => { rr(c, lx * s - s * 0.045, s * 0.12 + ph * lg, s * 0.09, s * 0.2, s * 0.03); c.fill(); });
  // đuôi xoắn
  c.strokeStyle = '#e07a94'; c.lineWidth = Math.max(2, s * 0.025); c.lineCap = 'round'; c.beginPath();
  for (let k = 0; k <= 20; k++) {
    const a = (k / 20) * TAU * 1.4 + Math.sin(vt * 8 + pn.i) * 0.4, r = s * 0.06 * (1 - k / 32);
    const px = -s * 0.54 + Math.cos(a) * r, py = -s * 0.07 + Math.sin(a) * r;
    if (k) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
  // thân
  const bg = c.createRadialGradient(-s * 0.1, -s * 0.16, s * 0.05, 0, 0, s * 0.56);
  bg.addColorStop(0, '#ffd3de'); bg.addColorStop(1, '#ef90a9');
  c.fillStyle = bg; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.32, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(120,80,50,.28)'; c.beginPath(); c.ellipse(-s * 0.2, s * 0.08, s * 0.09, s * 0.05, 0.4, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(s * 0.05, s * 0.16, s * 0.06, s * 0.035, -0.3, 0, TAU); c.fill();
  // đầu (cúi xuống khi ăn)
  const hy = eat ? s * 0.06 + Math.abs(Math.sin(vt * 14)) * s * 0.05 : -s * 0.06;
  c.save(); c.translate(s * 0.42, hy);
  c.fillStyle = '#e98aa2';
  c.beginPath(); c.moveTo(-s * 0.15, -s * 0.12); c.lineTo(-s * 0.06, -s * 0.34); c.lineTo(s * 0.02, -s * 0.15); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(s * 0.03, -s * 0.15); c.lineTo(s * 0.14, -s * 0.33); c.lineTo(s * 0.17, -s * 0.1); c.closePath(); c.fill();
  c.fillStyle = '#f7a8bc'; c.beginPath(); c.arc(0, 0, s * 0.24, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,120,150,.35)'; c.beginPath(); c.arc(-s * 0.02, s * 0.1, s * 0.05, 0, TAU); c.fill();
  // mõm tròn 2 lỗ mũi
  c.fillStyle = '#ffbccb'; c.beginPath(); c.ellipse(s * 0.19, s * 0.05, s * 0.1, s * 0.085, 0, 0, TAU); c.fill();
  c.strokeStyle = '#d97690'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#9b4a5e';
  c.beginPath(); c.ellipse(s * 0.16, s * 0.05, s * 0.018, s * 0.03, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(s * 0.22, s * 0.05, s * 0.018, s * 0.03, 0, 0, TAU); c.fill();
  // mắt
  c.fillStyle = '#2a1a1e'; c.strokeStyle = '#2a1a1e'; c.lineWidth = Math.max(1.5, s * 0.018);
  if (eat) { c.beginPath(); c.arc(s * 0.05, -s * 0.07, s * 0.03, Math.PI * 0.1, Math.PI * 0.9); c.stroke(); }
  else {
    c.beginPath(); c.arc(s * 0.05, -s * 0.07, s * 0.032, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 0.06, -s * 0.08, s * 0.011, 0, TAU); c.fill();
    if (pn.hunger < 0.2) { c.beginPath(); c.moveTo(-s * 0.02, -s * 0.15); c.lineTo(s * 0.1, -s * 0.11); c.stroke(); }
  }
  c.restore();
  c.restore();
}
function drawBucket(c, x, y, r, glow) {
  c.save(); c.translate(x, y);
  if (glow) { c.fillStyle = 'rgba(255,230,120,.35)'; c.beginPath(); c.arc(0, 0, r * 1.45, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, r * 0.85, r * 0.85, r * 0.18, 0, 0, TAU); c.fill();
  c.strokeStyle = '#6d7680'; c.lineWidth = 3; c.beginPath(); c.arc(0, -r * 0.45, r * 0.8, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  const g = c.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#8b949e'); g.addColorStop(0.45, '#d5dbe1'); g.addColorStop(1, '#7c858f');
  c.fillStyle = g; c.beginPath(); c.moveTo(-r * 0.85, -r * 0.45); c.lineTo(r * 0.85, -r * 0.45); c.lineTo(r * 0.65, r * 0.82); c.lineTo(-r * 0.65, r * 0.82); c.closePath(); c.fill();
  c.strokeStyle = '#5b636c'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#c99550'; c.beginPath(); c.ellipse(0, -r * 0.45, r * 0.85, r * 0.2, 0, 0, TAU); c.fill();
  c.fillStyle = '#e2b06e'; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(-r * 0.6 + k * r * 0.2, -r * 0.47 + (k % 2) * r * 0.06, r * 0.05, 0, TAU); c.fill(); }
  c.restore();
}
function pigGame(G) {
  const pens = [0, 1, 2].map((i) => ({ i, hunger: rand(0.5, 0.95), rate: rand(1 / 15, 1 / 11), u: rand(0.3, 0.7), v: rand(0.3, 0.7), tu: 0.5, tv: 0.5, wait: rand(0.5, 2), face: i % 2 ? -1 : 1, eat: 0, poops: [], squeal: rand(2, 4), moving: false }));
  const st = { fed: 0, clean: 0, full: 0 };
  const L = { pens: [], s: 100, bucket: { x: 0, y: 0, r: 36 }, flash: 0 };
  let holding = false, dragging = false, mouse = false, ptr = { x: -99, y: -99 }, poopT = 1.2;
  const pigBox = (pn) => { const r = L.pens[pn.i], mx = L.s * 0.6; return { x0: r.x + mx, x1: r.x + r.w - mx, y0: r.y + Math.max(L.s * 0.72, r.h * 0.42), y1: r.y + r.h - L.s * 0.38 }; };
  const pigPos = (pn) => { const b = pigBox(pn); return { x: lerp(b.x0, Math.max(b.x0, b.x1), pn.u), y: lerp(b.y0, Math.max(b.y0, b.y1), pn.v) }; };
  const poopPos = (pn, p) => { const r = L.pens[pn.i]; return { x: r.x + r.w * (0.1 + p.u * 0.8), y: r.y + r.h * (0.42 + p.v * 0.46) }; };
  const pigAt = (x, y) => { let best = null, bd = L.s * 0.6; for (const pn of pens) { const P = pigPos(pn), d = dist(x, y, P.x, P.y - L.s * 0.05); if (d < bd) { bd = d; best = pn; } } return best; };
  function feed(pn) {
    holding = false;
    const P = pigPos(pn), s = L.s;
    const b = L.bucket;
    G.fx.fly((cc, X, Y) => emo(cc, '🥣', X, Y, 30), b.x, b.y - b.r, P.x + pn.face * s * 0.45, P.y, 0.3);
    if (pn.hunger < 0.5) {
      pn.hunger = 1; pn.eat = 1.3; st.fed++;
      G.add(1, P.x, P.y - s * 0.55);
      G.fx.burst(P.x + pn.face * s * 0.45, P.y + s * 0.05, { n: 10, color: ['#c99550', '#e2b06e'], speed: 90, size: 3 });
      G.fx.burst(P.x, P.y - s * 0.45, { n: 3, emoji: '💕', size: s * 0.18, speed: 60, grav: -40, life: 1 });
      sfx.chomp(); sfx.good();
    } else {
      st.full++;
      G.fx.pop(P.x, P.y - s * 0.55, 'Lợn còn no!', '#eaeaea', 16);
      sfx.bad();
    }
  }
  return {
    stats: () => `Cho ăn đúng bữa ${st.fed} lần · Dọn ${st.clean} bãi phân${st.full ? ` · ${st.full} lần đổ cám thừa` : ''}`,
    layout() {
      const { W, H, top } = G, bottom = 118, ah = Math.max(150, H - top - bottom), aw = W - 20;
      const vert = W < H * 0.8; // điện thoại dọc: 3 chuồng xếp chồng
      L.pens = [0, 1, 2].map((i) => (vert ? { x: 10, y: top + (i * ah) / 3, w: aw, h: ah / 3 - 8 } : { x: 10 + (i * aw) / 3, y: top, w: aw / 3 - 10, h: ah - 4 }));
      const p0 = L.pens[0];
      L.s = Math.max(40, Math.min(vert ? p0.h * 0.6 : p0.w * 0.46, vert ? aw * 0.3 : ah * 0.38, 150));
      L.bucket = { x: W / 2, y: H - 64, r: 34 };
      L.mud = L.pens.map(() => Array.from({ length: 4 }, () => ({ u: Math.random(), v: rand(0.35, 0.95), r: rand(0.08, 0.16) })));
    },
    update(dt) {
      L.flash = Math.max(0, L.flash - dt);
      for (const pn of pens) {
        const dirty = pn.poops.length >= 2;
        pn.hunger = Math.max(0, pn.hunger - pn.rate * dt * (dirty ? 1.5 : 1));
        pn.moving = false;
        if (pn.eat > 0) pn.eat -= dt;
        else {
          const d = Math.hypot(pn.tu - pn.u, pn.tv - pn.v);
          if (d < 0.02) { if ((pn.wait -= dt) <= 0) { pn.tu = Math.random(); pn.tv = Math.random(); pn.wait = rand(0.8, 2.5); } }
          else {
            const sp = (pn.hunger < 0.2 ? 0.55 : 0.3) * dt;
            pn.u += ((pn.tu - pn.u) / d) * Math.min(d, sp); pn.v += ((pn.tv - pn.v) / d) * Math.min(d, sp);
            if (Math.abs(pn.tu - pn.u) > 0.01) pn.face = pn.tu > pn.u ? 1 : -1;
            pn.moving = true;
          }
        }
        if (pn.hunger < 0.2 && (pn.squeal -= dt) <= 0) {
          pn.squeal = rand(2.5, 4);
          sfx.oink();
          const P = pigPos(pn); G.fx.pop(P.x, P.y - L.s * 0.7, 'Ụt ịt! Đói quá!', '#ffd0d0', 14);
        }
        for (const p of pn.poops) p.t += dt;
      }
      if ((poopT -= dt) <= 0) {
        poopT = rand(1.6, 2.8);
        const cand = pens.filter((p) => p.poops.length < 3);
        if (cand.length) { const pn = pick(cand); pn.poops.push({ u: Math.random(), v: Math.random(), t: 0 }); }
      }
    },
    down(x, y, e) {
      ptr = { x, y }; mouse = e?.pointerType === 'mouse';
      for (const pn of pens) for (let k = pn.poops.length - 1; k >= 0; k--) {
        const P = poopPos(pn, pn.poops[k]);
        if (dist(x, y, P.x, P.y) < Math.max(26, L.s * 0.24)) {
          pn.poops.splice(k, 1); st.clean++;
          G.add(1, P.x, P.y - 14);
          G.fx.burst(P.x, P.y, { n: 6, emoji: '✨', size: 14, speed: 90, grav: 0, life: 0.5 });
          G.fx.fly((cc, X, Y, kk) => emo(cc, '🧹', X, Y, 34, { rot: Math.sin(kk * 20) * 0.6 }), P.x + 30, P.y - 10, P.x - 10, P.y, 0.3);
          sfx.tap(); return;
        }
      }
      const b = L.bucket;
      if (dist(x, y, b.x, b.y) < b.r * 1.6) { holding = true; dragging = true; sfx.tap(); return; }
      const pn = pigAt(x, y);
      if (pn) {
        if (holding) { dragging = false; feed(pn); }
        else { const P = pigPos(pn); G.fx.pop(P.x, P.y - L.s * 0.6, 'Lấy cám ở xô trước!', '#ffffff', 15); L.flash = 0.8; sfx.bad(); }
      }
    },
    move(x, y, e) { ptr = { x, y }; if (e) mouse = e.pointerType === 'mouse'; },
    up(x, y) {
      if (!dragging) return;
      dragging = false;
      const pn = pigAt(x, y);
      if (pn && holding) feed(pn);
    },
    draw(c) {
      const { W, H, vt } = G, s = L.s;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dcbf86'); g.addColorStop(1, '#b38d57');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,235,170,.35)'; c.lineWidth = 2;
      for (let k = 0; k < 40; k++) { const x = (k * 97) % W, y = G.top + ((k * 61) % Math.max(1, H - G.top)); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 10, y - 3); c.stroke(); }
      L.pens.forEach((r, i) => {
        const pn = pens[i];
        // nền bùn
        c.fillStyle = '#8b6b47'; rr(c, r.x, r.y, r.w, r.h, 14); c.fill();
        c.fillStyle = 'rgba(80,55,30,.45)';
        for (const m of L.mud[i]) { c.beginPath(); c.ellipse(r.x + r.w * (0.1 + m.u * 0.8), r.y + r.h * m.v, r.w * m.r, r.h * m.r * 0.45, 0, 0, TAU); c.fill(); }
        // máng ăn
        const tw = Math.min(r.w * 0.38, s * 1.3), th = Math.max(12, s * 0.16), tx = r.x + r.w - tw - 14, ty = r.y + 14;
        c.fillStyle = '#6e4a2a'; rr(c, tx, ty, tw, th, th * 0.4); c.fill();
        c.fillStyle = pn.eat > 0 ? '#d4a25a' : '#3f2a17'; rr(c, tx + 4, ty + 3, tw - 8, th - 7, th * 0.3); c.fill();
        // hàng rào gỗ
        c.strokeStyle = '#c08a50'; c.lineWidth = 5; c.lineCap = 'round';
        for (const yy of [r.y + 3, r.y + r.h - 3]) { c.beginPath(); c.moveTo(r.x + 2, yy); c.lineTo(r.x + r.w - 2, yy); c.stroke(); }
        for (const xx of [r.x + 3, r.x + r.w - 3]) { c.beginPath(); c.moveTo(xx, r.y + 2); c.lineTo(xx, r.y + r.h - 2); c.stroke(); }
        c.fillStyle = '#8e5e2e';
        const posts = Math.max(3, Math.round(r.w / 70));
        for (let k = 0; k <= posts; k++) { const px = r.x + (k * (r.w - 10)) / posts; rr(c, px, r.y - 4, 10, 14, 3); c.fill(); rr(c, px, r.y + r.h - 10, 10, 14, 3); c.fill(); }
        label(c, `Chuồng ${i + 1}`, r.x + 14, r.y + 22, { size: 13, align: 'left', color: '#ffeccc', stroke: 'rgba(60,35,10,.7)' });
        // phân lợn (có ruồi bay)
        for (const p of pn.poops) {
          const P = poopPos(pn, p), k = Math.min(1, p.t / 0.25);
          emo(c, '💩', P.x, P.y, Math.max(22, s * 0.26) * (0.4 + 0.6 * ease(k)));
          c.fillStyle = '#222'; c.beginPath(); c.arc(P.x + Math.cos(vt * 7 + p.u * 9) * 14, P.y - 16 + Math.sin(vt * 9 + p.v * 9) * 6, 1.8, 0, TAU); c.fill();
        }
        // lợn
        const P = pigPos(pn);
        drawPig(c, P.x, P.y, s, pn, vt);
        // thanh no – đói
        const bw = s * 0.85, bh = 8, bx = P.x - bw / 2, by = P.y - s * 0.62;
        c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, bx - 2, by - 2, bw + 4, bh + 4, 6); c.fill();
        c.fillStyle = pn.hunger > 0.5 ? '#6fd36a' : pn.hunger > 0.2 ? '#ffc34a' : '#ff5a4a';
        rr(c, bx, by, Math.max(4, bw * pn.hunger), bh, 4); c.fill();
        c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(bx + bw * 0.5 - 1, by - 2, 2, bh + 4);
        // bong bóng đòi ăn
        if (pn.hunger < 0.5 && pn.eat <= 0) {
          const hx = P.x + pn.face * s * 0.5, hy = P.y - s * 0.95 + Math.sin(vt * 4 + i) * 3, hr = Math.max(16, s * 0.17);
          c.fillStyle = 'rgba(255,255,255,.95)';
          c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
          c.beginPath(); c.arc(P.x + pn.face * s * 0.36, P.y - s * 0.66, hr * 0.25, 0, TAU); c.fill();
          emo(c, '🍚', hx, hy, hr * 1.25);
        }
      });
      // xô cám
      const b = L.bucket;
      const pulse = L.flash > 0 ? 1 + Math.sin(L.flash * 25) * 0.08 : 1;
      drawBucket(c, b.x, b.y, b.r * pulse, holding || L.flash > 0);
      label(c, 'Xô cám', b.x, b.y + b.r + 14, { size: 13, color: '#fff3d6' });
      if (holding) {
        if (dragging || mouse) emo(c, '🥣', ptr.x, ptr.y - 18, 38);
        else { emo(c, '🥣', b.x, b.y - b.r - 26 + Math.sin(vt * 6) * 4, 34); label(c, 'Bấm vào lợn đói', b.x, b.y - b.r - 52, { size: 13, color: '#fffbe0' }); }
      }
    },
  };
}

/* =====================================================================
   3) NUÔI CÁ: rắc cám cho cá lớn, vớt cá có vòng vàng
   ===================================================================== */
const FISH_COLS = [
  { body: '#ff8a3d', fin: '#ffb37a', spot: '#fff3e6' },
  { body: '#f5efe6', fin: '#ffd2b0', spot: '#e8452c' },
  { body: '#ffc23d', fin: '#ffe08a', spot: '#ff7a2a' },
  { body: '#e8452c', fin: '#ff9c80', spot: '#ffffff' },
];
function drawFish(c, x, y, a, len, col, wag) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = 'rgba(0,30,60,.18)'; c.beginPath(); c.ellipse(4, 6, len * 0.5, len * 0.2, 0, 0, TAU); c.fill();
  // đuôi quẫy
  c.save(); c.translate(-len * 0.4, 0); c.rotate(Math.sin(wag) * 0.45);
  c.fillStyle = col.fin; c.beginPath(); c.moveTo(0, 0);
  c.quadraticCurveTo(-len * 0.2, -len * 0.3, -len * 0.38, -len * 0.25); c.quadraticCurveTo(-len * 0.27, 0, -len * 0.38, len * 0.25); c.quadraticCurveTo(-len * 0.2, len * 0.3, 0, 0); c.fill();
  c.restore();
  // vây ngực
  c.fillStyle = col.fin;
  for (const sd of [-1, 1]) { c.save(); c.translate(len * 0.1, sd * len * 0.15); c.rotate(sd * (0.6 + Math.sin(wag * 1.3) * 0.25)); c.beginPath(); c.ellipse(-len * 0.05, sd * len * 0.05, len * 0.12, len * 0.05, 0, 0, TAU); c.fill(); c.restore(); }
  // thân
  c.fillStyle = col.body; c.beginPath(); c.ellipse(0, 0, len * 0.5, len * 0.2, 0, 0, TAU); c.fill();
  c.fillStyle = col.spot;
  c.beginPath(); c.ellipse(-len * 0.08, -len * 0.04, len * 0.13, len * 0.08, 0.3, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(len * 0.16, len * 0.05, len * 0.08, len * 0.05, -0.4, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = Math.max(1.5, len * 0.035); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-len * 0.32, 0); c.lineTo(len * 0.22, 0); c.stroke();
  c.fillStyle = '#161616';
  c.beginPath(); c.arc(len * 0.33, -len * 0.09, Math.max(1.5, len * 0.035), 0, TAU); c.fill();
  c.beginPath(); c.arc(len * 0.33, len * 0.09, Math.max(1.5, len * 0.035), 0, TAU); c.fill();
  c.restore();
}
function fishGame(G) {
  const st = { caught: 0, wrong: 0 };
  const L = { cx: 0, cy: 0, rx: 1, ry: 1, base: 30, bucket: { x: 0, y: 0 }, bump: 0, stones: [], pads: [], glints: [] };
  let fish = [], pellets = [], ripples = [], nets = [], respawn = [];
  const inPond = (x, y, m = 0) => ((x - L.cx) / Math.max(1, L.rx - m)) ** 2 + ((y - L.cy) / Math.max(1, L.ry - m)) ** 2 <= 1;
  const len = (f) => L.base * (1 + f.g * 0.9);
  const spawn = (edge) => {
    const a = Math.random() * TAU, k = edge ? 0.85 : rand(0.15, 0.7);
    fish.push({ x: L.cx + Math.cos(a) * L.rx * k, y: L.cy + Math.sin(a) * L.ry * k, a: a + Math.PI + rand(-0.6, 0.6), v: 0, g: rand(0, 0.35), col: pick(FISH_COLS), wag: rand(0, TAU), flee: 0, turn: rand(-1, 1), appear: edge ? 0.6 : 0 });
  };
  return {
    stats: () => `Vớt ${st.caught} con cá lớn · Vớt nhầm ${st.wrong} con nhỏ`,
    layout() {
      const { W, H, top } = G, old = { ...L };
      L.cx = W / 2; L.cy = top + (H - top - 86) / 2;
      L.rx = Math.max(80, W / 2 - 22); L.ry = Math.max(80, (H - top - 96) / 2);
      L.base = Math.max(18, Math.min(L.rx, L.ry) * 0.13);
      L.bucket = { x: W - 56, y: H - 46 };
      // giữ chỗ cá và cám khi đổi kích thước màn hình
      if (old.rx > 1) for (const o of [...fish, ...pellets, ...ripples]) { o.x = L.cx + ((o.x - old.cx) / old.rx) * L.rx; o.y = L.cy + ((o.y - old.cy) / old.ry) * L.ry; }
      const ns = Math.round((L.rx + L.ry) / 9);
      L.stones = Array.from({ length: ns }, (_, k) => ({ a: (k / ns) * TAU + rand(-0.04, 0.04), r: rand(9, 16), c: pick(['#a7a397', '#8f8b80', '#bdb8ab', '#9c978a']) }));
      L.pads = Array.from({ length: 4 }, (_, k) => { const a = k * 1.7 + 0.5, d = rand(0.55, 0.8); return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: rand(0.08, 0.12), rot: Math.random() * TAU, flower: k === 1 }; });
      L.glints = Array.from({ length: 7 }, () => ({ x: rand(-0.7, 0.7), y: rand(-0.6, 0.6), s: rand(0.3, 0.8), p: rand(0, TAU) }));
      if (!fish.length) for (let k = 0; k < 6; k++) spawn(false);
    },
    update(dt) {
      L.bump = Math.max(0, L.bump - dt);
      for (const p of pellets) p.t += dt;
      pellets = pellets.filter((p) => p.t < 7 && !p.eaten);
      for (const r of ripples) r.t += dt;
      ripples = ripples.filter((r) => r.t < 1.2);
      for (const n of nets) n.t += dt;
      nets = nets.filter((n) => n.t < 0.5);
      if (Math.random() < dt * 0.7) ripples.push({ x: L.cx + rand(-0.6, 0.6) * L.rx, y: L.cy + rand(-0.6, 0.6) * L.ry, t: 0, small: true });
      for (const f of fish) {
        const Lf = len(f);
        f.flee = Math.max(0, f.flee - dt); f.appear = Math.max(0, f.appear - dt);
        let target = null;
        if (!f.flee && f.g < 1) { let best = Math.max(L.rx, L.ry) * 1.3; for (const p of pellets) { const d = dist(f.x, f.y, p.x, p.y); if (d < best) { best = d; target = p; } } }
        let want;
        if (target) want = Math.atan2(target.y - f.y, target.x - f.x);
        else { f.turn = clamp(f.turn + rand(-1, 1) * dt * 2, -1, 1); want = f.a + f.turn * 0.8; }
        if (!inPond(f.x + Math.cos(f.a) * Lf, f.y + Math.sin(f.a) * Lf, L.base * 0.6)) want = Math.atan2(L.cy - f.y, L.cx - f.x);
        const d = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a));
        f.a += clamp(d, -3.4 * dt, 3.4 * dt) * (f.flee ? 2 : 1);
        const sp = L.base * (f.flee ? 5 : target ? 2.8 : f.g >= 1 ? 0.8 : 1.3);
        f.v += (sp - f.v) * Math.min(1, dt * 3);
        f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt;
        if (!inPond(f.x, f.y, L.base * 0.3)) {
          const ang = Math.atan2((f.y - L.cy) / L.ry, (f.x - L.cx) / L.rx);
          f.x = L.cx + Math.cos(ang) * (L.rx - L.base * 0.3) * 0.98; f.y = L.cy + Math.sin(ang) * (L.ry - L.base * 0.3) * 0.98;
        }
        f.wag += dt * (4 + (f.v / L.base) * 3);
        if (target && dist(f.x + Math.cos(f.a) * Lf * 0.45, f.y + Math.sin(f.a) * Lf * 0.45, target.x, target.y) < Lf * 0.35 + 5) {
          target.eaten = true;
          const was = f.g; f.g = Math.min(1, f.g + 0.21);
          G.fx.burst(target.x, target.y, { n: 3, color: 'rgba(255,255,255,.8)', speed: 30, size: 2.5, grav: -60, life: 0.5 });
          if (was < 1 && f.g >= 1) { G.fx.burst(f.x, f.y, { n: 5, emoji: '✨', size: 16, speed: 70, grav: 0, life: 0.6 }); sfx.ding(); }
        }
      }
      for (let i = respawn.length - 1; i >= 0; i--) if ((respawn[i] -= dt) <= 0) { respawn.splice(i, 1); spawn(true); }
    },
    down(x, y) {
      if (!inPond(x, y)) { G.fx.pop(x, y, 'Rắc cám xuống ao nhé', '#ffffff', 14); return; }
      let hit = null, best = Infinity;
      for (const f of fish) {
        const Lf = len(f), d = dist(x, y, f.x, f.y), ready = f.g >= 1;
        if (d < (ready ? Lf * 0.7 + 12 : Lf * 0.42)) { const sc = d - (ready ? 1000 : 0); if (sc < best) { best = sc; hit = f; } }
      }
      if (hit) {
        if (hit.g >= 1) {
          fish.splice(fish.indexOf(hit), 1); st.caught++; respawn.push(rand(0.8, 1.6));
          G.add(1, hit.x, hit.y - 22);
          nets.push({ x: hit.x, y: hit.y, t: 0, r: len(hit) * 0.75 });
          G.fx.burst(hit.x, hit.y, { n: 14, color: ['#bfe6ff', '#ffffff', '#7cc7ff'], speed: 160, size: 3, grav: 500 });
          const col = hit.col, Lf = len(hit), b = L.bucket;
          G.fx.fly((cc, X, Y, k) => drawFish(cc, X, Y, -Math.PI / 2 + k * 3, Lf * (1 - k * 0.55), col, G.vt * 20), hit.x, hit.y, b.x, b.y - 10, 0.6, () => { L.bump = 0.25; });
          sfx.plip(); sfx.good();
        } else {
          st.wrong++;
          G.add(-1, hit.x, hit.y - 22, 'Cá còn nhỏ! −1');
          hit.flee = 1.4; hit.a = Math.atan2(hit.y - y, hit.x - x);
          ripples.push({ x, y, t: 0 });
          sfx.bad();
        }
        return;
      }
      for (let k = 0; k < 4; k++) { const a = Math.random() * TAU, r = Math.random() * 16, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (inPond(px, py, 4)) pellets.push({ x: px, y: py, t: 0, eaten: false }); }
      ripples.push({ x, y, t: 0 });
      G.fx.burst(x, y - 26, { n: 6, color: '#d8a55a', speed: 50, size: 2.5, grav: 260, up: 0 });
      sfx.plip();
    },
    draw(c) {
      const { W, H, vt } = G;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fcd72'); g.addColorStop(1, '#6b9c44');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // bờ đá quanh ao
      c.fillStyle = '#857f72'; c.beginPath(); c.ellipse(L.cx, L.cy, L.rx + 12, L.ry + 12, 0, 0, TAU); c.fill();
      for (const s of L.stones) { c.fillStyle = s.c; c.beginPath(); c.arc(L.cx + Math.cos(s.a) * (L.rx + 8), L.cy + Math.sin(s.a) * (L.ry + 8), s.r, 0, TAU); c.fill(); }
      // mặt nước
      c.save();
      c.beginPath(); c.ellipse(L.cx, L.cy, L.rx, L.ry, 0, 0, TAU);
      const wg = c.createRadialGradient(L.cx, L.cy - L.ry * 0.3, Math.min(L.rx, L.ry) * 0.1, L.cx, L.cy, Math.max(L.rx, L.ry));
      wg.addColorStop(0, '#56b9ea'); wg.addColorStop(1, '#1b5f99');
      c.fillStyle = wg; c.fill(); c.clip();
      for (const gl of L.glints) {
        c.fillStyle = 'rgba(255,255,255,.07)';
        c.beginPath(); c.ellipse(L.cx + (gl.x + Math.sin(vt * 0.4 + gl.p) * 0.05) * L.rx, L.cy + (gl.y + Math.cos(vt * 0.3 + gl.p) * 0.04) * L.ry, L.rx * 0.18 * gl.s, L.ry * 0.05 * gl.s, Math.sin(vt * 0.2 + gl.p) * 0.3, 0, TAU); c.fill();
      }
      for (const p of L.pads) {
        const px = L.cx + p.x * L.rx, py = L.cy + p.y * L.ry, r = Math.min(L.rx, L.ry) * p.r;
        c.fillStyle = '#4f9a3a'; c.beginPath(); c.moveTo(px, py); c.arc(px, py, r, p.rot + 0.35, p.rot + TAU - 0.05); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,70,20,.5)'; c.lineWidth = 1.5; c.stroke();
        if (p.flower) emo(c, '🪷', px + r * 0.3, py - r * 0.2, r * 1.1);
      }
      for (const p of pellets) { const a = 1 - Math.max(0, p.t - 5) / 2; c.fillStyle = `rgba(214,160,80,${a})`; c.beginPath(); c.arc(p.x, p.y + Math.sin(vt * 3 + p.x) * 1.5, 3.2, 0, TAU); c.fill(); }
      for (const f of fish) {
        const Lf = len(f);
        if (f.g >= 1) {
          c.strokeStyle = `rgba(255,214,64,${0.55 + Math.sin(vt * 6) * 0.35})`; c.lineWidth = 3.5;
          c.beginPath(); c.arc(f.x, f.y, Lf * 0.62, 0, TAU); c.stroke();
          emo(c, '✨', f.x + Math.cos(vt * 2) * Lf * 0.62, f.y + Math.sin(vt * 2) * Lf * 0.62, 16);
        }
        drawFish(c, f.x, f.y, f.a, Lf, f.col, f.wag);
      }
      for (const r of ripples) {
        const k = r.t / 1.2;
        c.strokeStyle = `rgba(255,255,255,${(r.small ? 0.25 : 0.6) * (1 - k)})`; c.lineWidth = 2;
        c.beginPath(); c.ellipse(r.x, r.y, (r.small ? 14 : 8) + k * (r.small ? 22 : 46), ((r.small ? 14 : 8) + k * (r.small ? 22 : 46)) * 0.6, 0, 0, TAU); c.stroke();
      }
      for (const n of nets) {
        const k = n.t / 0.5, r = n.r * (0.7 + k * 0.5);
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
        c.beginPath(); c.arc(n.x, n.y, r, 0, TAU); c.stroke();
        c.lineWidth = 1; c.beginPath();
        for (let q = -2; q <= 2; q++) { c.moveTo(n.x + q * r * 0.35, n.y - r); c.lineTo(n.x + q * r * 0.35, n.y + r); c.moveTo(n.x - r, n.y + q * r * 0.35); c.lineTo(n.x + r, n.y + q * r * 0.35); }
        c.stroke(); c.restore();
      }
      c.restore();
      const b = L.bucket;
      emo(c, '🪣', b.x, b.y, 50 * (1 + L.bump));
      label(c, `× ${st.caught}`, b.x - 48, b.y + 4, { size: 22, color: '#fffbe0', align: 'right' });
    },
  };
}

/* =====================================================================
   4) ĐÀO ĐÁ: canh kim lực vào vùng xanh, 3 nhát vỡ tảng
   ===================================================================== */
function quarryGame(G) {
  const st = { broken: 0, hits: 0, perfect: 0, miss: 0 };
  const L = { cx: 0, cy: 0, R: 100, bar: { x: 0, y: 0, w: 300, h: 26 }, barrow: { x: 0, y: 0, s: 90 }, bump: 0, pebbles: [] };
  const zone = { c: 0.5, w: 0.13 };
  let rock = null, nextRock = 0, pos = 0, dir = 1, speed = 0.72, stun = 0, swing = 0, cool = 0;
  const SWING = 0.3;
  const newRock = () => {
    const n = 11, verts = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rand(-0.15, 0.15); verts.push([Math.cos(a) * rand(0.82, 1.05), Math.sin(a) * rand(0.7, 0.92)]); }
    const cracks = [0, 1, 2].map((k) => {
      let x = 0.22, y = -0.32, a = Math.PI * (0.55 + k * 0.3) + rand(-0.2, 0.2);
      const pts = [[x, y]];
      for (let j = 0; j < 5; j++) { x += Math.cos(a) * rand(0.14, 0.24); y += Math.sin(a) * rand(0.14, 0.24); a += rand(-0.5, 0.5); pts.push([x, y]); }
      return pts;
    });
    rock = { verts, cracks, crack: 0, appear: 0.35, shake: 0, tone: pick(['#9a958c', '#8f8a80', '#a39d92', '#8a8478']) };
    zone.c = rand(0.18, 0.82); zone.w = Math.max(0.075, 0.14 - st.broken * 0.004);
    speed = Math.min(1.6, 0.66 + st.broken * 0.045);
  };
  const hitPoint = () => ({ x: L.cx + 0.22 * L.R, y: L.cy - 0.32 * L.R });
  const pivot = () => ({ x: L.cx + L.R * 1.12, y: L.cy + L.R * 0.15 });
  function strike() {
    if (cool > 0 || stun > 0 || !rock || rock.appear > 0.12) return;
    cool = 0.2; swing = SWING;
    const d = Math.abs(pos - zone.c), H = hitPoint();
    if (d > zone.w) {
      st.miss++; stun = 0.6;
      zone.c = clamp(zone.c + (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.4), 0.15, 0.85);
      G.fx.pop(L.cx, L.cy - L.R * 0.2, 'Trượt! Mất nhịp…', '#ffb0a0', 20);
      rock.shake = 0.1; sfx.bad(); return;
    }
    const perfect = d <= zone.w * 0.35;
    rock.crack += perfect ? 2 : 1; st.hits++; if (perfect) st.perfect++;
    rock.shake = 0.25; G.fx.shake = 0.12;
    G.fx.burst(H.x, H.y, { n: perfect ? 16 : 10, color: ['#ffe27a', '#fff6c8', '#ffb347'], speed: 260, size: 3, grav: 300, shape: 'spark', life: 0.45 });
    G.fx.burst(H.x, H.y, { n: 6, color: ['#7a746a', '#9a958c'], speed: 160, size: 4, grav: 600 });
    G.fx.pop(H.x, H.y - 20, perfect ? 'Hoàn hảo! ×2' : 'Trúng!', perfect ? '#ffe27a' : '#ffffff', perfect ? 22 : 18);
    sfx.thud();
    if (rock.crack >= 3) {
      const R = L.R, tone = rock.tone;
      G.fx.burst(L.cx, L.cy, { n: 22, color: [tone, '#6d685f', '#b5afa3'], speed: 320, size: R * 0.09, grav: 700, shape: 'shard', life: 0.9 });
      G.fx.burst(L.cx, L.cy + R * 0.3, { n: 14, color: ['rgba(200,185,160,.7)', 'rgba(170,155,130,.6)'], speed: 120, size: R * 0.08, grav: -30, life: 0.8 });
      G.fx.shake = 0.25;
      st.broken++; rock = null; nextRock = 0.5;
      G.add(1, L.cx, L.cy - R * 0.5);
      const b = L.barrow;
      G.fx.fly((cc, X, Y) => { cc.fillStyle = tone; cc.beginPath(); cc.arc(X, Y, 11, 0, TAU); cc.fill(); cc.strokeStyle = '#5a554c'; cc.lineWidth = 2; cc.stroke(); }, L.cx, L.cy, b.x, b.y - b.s * 0.3, 0.55, () => { L.bump = 0.25; });
      sfx.crack();
    } // trúng thì vùng xanh giữ nguyên để người chơi bắt nhịp; trượt mới đổi chỗ
  }
  function drawPick(c) {
    const P = pivot(), H = hitPoint(), R = L.R, Lh = dist(P.x, P.y, H.x, H.y);
    const idle = -1.25 + Math.sin(G.vt * 3) * 0.04, hitA = Math.atan2(H.y - P.y, H.x - P.x);
    let th = idle;
    if (swing > 0) {
      const k = 1 - swing / SWING;
      th = k < 0.3 ? lerp(idle, idle + 0.35, k / 0.3) : k < 0.55 ? lerp(idle + 0.35, hitA, ease((k - 0.3) / 0.25)) : lerp(hitA, idle, (k - 0.55) / 0.45);
    }
    c.save(); c.translate(P.x, P.y); c.rotate(th);
    c.strokeStyle = '#7a4f28'; c.lineWidth = Math.max(5, R * 0.07); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-R * 0.1, 0); c.lineTo(Lh, 0); c.stroke();
    c.strokeStyle = '#4e3218'; c.lineWidth = Math.max(6, R * 0.085); c.beginPath(); c.moveTo(-R * 0.1, 0); c.lineTo(R * 0.15, 0); c.stroke();
    c.strokeStyle = '#c9ccd1'; c.lineWidth = Math.max(5, R * 0.08);
    c.beginPath(); c.moveTo(Lh - R * 0.06, -R * 0.42); c.quadraticCurveTo(Lh + R * 0.14, 0, Lh - R * 0.06, R * 0.42); c.stroke();
    c.strokeStyle = '#8d9097'; c.lineWidth = Math.max(2, R * 0.025);
    c.beginPath(); c.moveTo(Lh - R * 0.03, -R * 0.36); c.quadraticCurveTo(Lh + R * 0.1, 0, Lh - R * 0.03, R * 0.36); c.stroke();
    c.fillStyle = '#55585e'; rr(c, Lh - R * 0.06, -R * 0.07, R * 0.12, R * 0.14, 3); c.fill();
    c.restore();
    // bàn tay cầm cán (tay áo sọc phạm nhân)
    c.save(); c.translate(P.x, P.y);
    c.fillStyle = '#eef0f2'; rr(c, R * 0.02, -R * 0.08, R * 0.32, R * 0.16, R * 0.05); c.fill();
    c.fillStyle = '#6d7b8d'; for (let k = 0; k < 3; k++) c.fillRect(R * (0.06 + k * 0.1), -R * 0.08, R * 0.045, R * 0.16);
    c.fillStyle = '#f1c7a3'; c.beginPath(); c.arc(0, 0, R * 0.09, 0, TAU); c.fill();
    c.restore();
  }
  function drawBarrow(c) {
    const { x, y } = L.barrow, s = L.barrow.s * (1 + L.bump * 0.5);
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, s * 0.36, s * 0.55, s * 0.08, 0, 0, TAU); c.fill();
    c.strokeStyle = '#7a5230'; c.lineWidth = s * 0.06; c.lineCap = 'round';
    c.beginPath(); c.moveTo(s * 0.2, -s * 0.08); c.lineTo(s * 0.7, s * 0.12); c.stroke();
    c.beginPath(); c.moveTo(s * 0.18, s * 0.06); c.lineTo(s * 0.28, s * 0.34); c.stroke();
    // đá chất trong thùng
    const n = Math.min(st.broken, 12);
    for (let k = 0; k < n; k++) { const row = k < 5 ? 0 : k < 9 ? 1 : 2, col = row === 0 ? k : row === 1 ? k - 5 : k - 9, cnt = row === 0 ? 5 : row === 1 ? 4 : 3; c.fillStyle = ['#9a958c', '#8f8a80', '#a39d92', '#b0aa9e'][k % 4]; c.beginPath(); c.arc(-s * 0.3 + (col + (5 - cnt) / 2) * s * 0.13, -s * 0.25 - row * s * 0.1, s * 0.075, 0, TAU); c.fill(); c.strokeStyle = 'rgba(60,55,45,.6)'; c.lineWidth = 1.5; c.stroke(); }
    const g = c.createLinearGradient(0, -s * 0.25, 0, s * 0.15); g.addColorStop(0, '#4f9a6a'); g.addColorStop(1, '#2f6a48');
    c.fillStyle = g; c.beginPath(); c.moveTo(-s * 0.48, -s * 0.24); c.lineTo(s * 0.32, -s * 0.24); c.lineTo(s * 0.2, s * 0.14); c.lineTo(-s * 0.36, s * 0.14); c.closePath(); c.fill();
    c.strokeStyle = '#24533a'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(-s * 0.1, s * 0.24, s * 0.13, 0, TAU); c.fill();
    c.fillStyle = '#9aa0a6'; c.beginPath(); c.arc(-s * 0.1, s * 0.24, s * 0.04, 0, TAU); c.fill();
    c.restore();
    label(c, `× ${st.broken}`, x, y + s * 0.55, { size: 20, color: '#fffbe0' });
  }
  return {
    stats: () => `Vỡ ${st.broken} tảng đá · ${st.perfect} nhát hoàn hảo · Trượt ${st.miss} nhát`,
    key(code) { if (code === 'Space' || code === 'Enter') strike(); },
    layout() {
      const { W, H, top } = G;
      const bw = Math.min(W - 48, 520);
      L.bar = { x: (W - bw) / 2, y: H - 74, w: bw, h: 26 };
      const area = Math.max(140, L.bar.y - 26 - top);
      L.R = Math.max(50, Math.min(W * 0.27, area * 0.36, 150));
      L.cx = W / 2 - L.R * 0.15; L.cy = top + area * 0.44;
      L.barrow = { x: Math.min(W - 60, L.cx + L.R * 2.1), y: L.cy + L.R * 0.95, s: Math.max(64, Math.min(110, L.R * 0.8)) };
      if (L.barrow.y + L.barrow.s * 0.7 > L.bar.y - 10) L.barrow.y = L.bar.y - 10 - L.barrow.s * 0.7;
      L.pebbles = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: top + area * 0.7 + Math.random() * (H - top - area * 0.7), r: rand(2, 6), c: pick(['#8a7a60', '#9c8d72', '#76684f']) }));
      if (!rock && !nextRock) { newRock(); rock.appear = 0; }
    },
    update(dt) {
      L.bump = Math.max(0, L.bump - dt); cool = Math.max(0, cool - dt); swing = Math.max(0, swing - dt);
      if (stun > 0) stun = Math.max(0, stun - dt);
      else { pos += dir * speed * dt; if (pos > 1) { pos = 2 - pos; dir = -1; } if (pos < 0) { pos = -pos; dir = 1; } }
      if (rock) { rock.appear = Math.max(0, rock.appear - dt); rock.shake = Math.max(0, rock.shake - dt); }
      else if ((nextRock -= dt) <= 0) { nextRock = 0; newRock(); }
    },
    down() { strike(); },
    draw(c) {
      const { W, H, top } = G;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c9b99e'); g.addColorStop(0.55, '#a9956f'); g.addColorStop(1, '#8a7655');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // vách đá phân tầng
      c.strokeStyle = 'rgba(90,70,40,.2)'; c.lineWidth = 3;
      for (let k = 0; k < 6; k++) { const yy = top + k * 26 + 10; c.beginPath(); c.moveTo(0, yy); for (let x = 0; x <= W; x += 40) c.lineTo(x, yy + Math.sin(x * 0.02 + k) * 6); c.stroke(); }
      for (const p of L.pebbles) { c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      // tảng đá
      if (rock) {
        const R = L.R * (1 - (rock.appear / 0.35) * 0.4), sh = rock.shake > 0 ? Math.sin(rock.shake * 80) * rock.shake * 14 : 0;
        c.save(); c.translate(L.cx + sh, L.cy); c.globalAlpha = 1 - rock.appear / 0.35 * 0.7;
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, R * 0.82, R * 1.05, R * 0.18, 0, 0, TAU); c.fill();
        const poly = () => { c.beginPath(); rock.verts.forEach(([x, y], k) => (k ? c.lineTo(x * R, y * R) : c.moveTo(x * R, y * R))); c.closePath(); };
        poly();
        const rg = c.createLinearGradient(-R, -R, R, R); rg.addColorStop(0, '#d2ccc1'); rg.addColorStop(0.5, rock.tone); rg.addColorStop(1, '#5f5a52');
        c.fillStyle = rg; c.fill(); c.lineWidth = 3; c.strokeStyle = '#4d4840'; c.stroke();
        c.save(); poly(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2;
        for (const [x, y] of rock.verts.filter((_, k) => k % 3 === 0)) { c.beginPath(); c.moveTo(x * R, y * R); c.lineTo(x * R * 0.25 - R * 0.1, y * R * 0.25 - R * 0.1); c.stroke(); }
        c.restore();
        c.strokeStyle = '#2b2722'; c.lineWidth = Math.max(2, R * 0.035); c.lineJoin = 'round'; c.lineCap = 'round';
        for (let k = 0; k < Math.min(rock.crack, 3); k++) { c.beginPath(); rock.cracks[k].forEach(([x, y], j) => (j ? c.lineTo(x * R, y * R) : c.moveTo(x * R, y * R))); c.stroke(); }
        c.restore();
        // chấm vàng nơi bổ
        const Hp = hitPoint();
        c.strokeStyle = `rgba(255,230,120,${0.4 + Math.sin(G.vt * 6) * 0.25})`; c.lineWidth = 2; c.beginPath(); c.arc(Hp.x, Hp.y, 10, 0, TAU); c.stroke();
      }
      drawBarrow(c);
      drawPick(c);
      // thanh lực
      const b = L.bar;
      c.fillStyle = 'rgba(20,16,12,.78)'; rr(c, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 16); c.fill();
      c.fillStyle = '#3b342c'; rr(c, b.x, b.y, b.w, b.h, 9); c.fill();
      c.save(); rr(c, b.x, b.y, b.w, b.h, 9); c.clip();
      c.fillStyle = '#4fc95a'; c.fillRect(b.x + (zone.c - zone.w) * b.w, b.y, zone.w * 2 * b.w, b.h);
      c.fillStyle = '#ffd54a'; c.fillRect(b.x + (zone.c - zone.w * 0.35) * b.w, b.y, zone.w * 0.7 * b.w, b.h);
      c.restore();
      const cx = b.x + pos * b.w;
      c.fillStyle = stun > 0 ? '#9a9a9a' : '#ffffff';
      rr(c, cx - 3.5, b.y - 9, 7, b.h + 18, 3); c.fill();
      c.beginPath(); c.moveTo(cx - 8, b.y - 16); c.lineTo(cx + 8, b.y - 16); c.lineTo(cx, b.y - 8); c.closePath(); c.fill();
      if (stun > 0) { c.fillStyle = 'rgba(60,60,60,.45)'; rr(c, b.x, b.y, b.w, b.h, 9); c.fill(); label(c, 'Mất nhịp…', b.x + b.w / 2, b.y + b.h / 2, { size: 15, color: '#ffd0c8' }); }
    },
  };
}

const GAMES = { trongrau: gardenGame, nuoilon: pigGame, nuoica: fishGame, daoda: quarryGame };

/* =====================================================================
   KHUNG MÀN CHƠI: hướng dẫn → đếm ngược → chơi → kết quả
   ===================================================================== */
export function runRehab(task, opts = {}) {
  const def = REHAB[task];
  if (!def) throw new Error(`Không có việc cải tạo “${task}”`);
  const durSec = Math.max(5, Number(opts.durSec) || 45);
  const pass = Number.isFinite(+opts.pass) && opts.pass !== null ? +opts.pass : def.pass;
  const maxScore = Number.isFinite(+opts.maxScore) && opts.maxScore !== null ? +opts.maxScore : def.maxScore;
  const { onFinish, onCancel, practice = false } = opts;
  try { Sound.init?.(); } catch {}

  const root = document.createElement('div');
  root.className = `rh rh-${task}`;
  root.innerHTML = `<canvas class="rh-cv"></canvas>
    <div class="rh-top">
      <div class="rh-name"><span>${def.icon}</span><b>${esc(def.name)}</b>${practice ? '<em>Làm thử</em>' : ''}</div>
      <div class="rh-sc"><div class="rh-sc-row"><b class="rh-n">0</b><small class="rh-need">/ cần ${pass}</small></div>
        <div class="rh-meter"><i class="rh-fill"></i><em class="rh-pass" title="Mức đạt: ${pass} điểm"></em></div></div>
      <div class="rh-time"><b class="rh-t">${durSec}</b><small>giây</small></div>
      <button class="rh-x" type="button" title="Thoát" aria-label="Thoát">✕</button>
    </div>
    <div class="rh-hint">${esc(def.hint)}</div>
    <div class="rh-card hidden"></div>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const cv = q('.rh-cv'), c = cv.getContext('2d');
  const fx = makeFx();
  const meterCap = Math.max(1, Math.min(maxScore, Math.max(pass * 2, pass + 4)));
  q('.rh-pass').style.left = `${(pass / meterCap) * 100}%`;
  let phase = 'intro', prevPhase = 'play', countT = 0, countStage = -1, raf = 0, closed = false, last = performance.now(), lastSec = -1, autoT = 0, submitted = false;

  const G = { W: 0, H: 0, top: 0, dpr: 1, T: 0, vt: 0, score: 0, pass, maxScore, fx, add };
  const game = GAMES[task](G);

  function paintScore() {
    q('.rh-n').textContent = G.score;
    q('.rh-fill').style.width = `${Math.min(100, (G.score / meterCap) * 100)}%`;
    root.classList.toggle('passed', G.score >= pass);
    q('.rh-need').textContent = G.score >= pass ? '✓ đạt' : `/ cần ${pass}`;
  }
  function add(n, x, y, text) {
    const before = G.score;
    G.score = clamp(G.score + n, 0, maxScore);
    fx.pop(x, y, text || (n > 0 ? `+${n}` : `${n}`), n > 0 ? '#fff6b0' : '#ff9a8a', n > 0 ? 26 : 20);
    paintScore();
    if (n > 0) { const el = q('.rh-n'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    if (before < pass && G.score >= pass) {
      fx.show('🎯 ĐẠT YÊU CẦU!', '#b8ff9a', 1.6);
      fx.burst(G.W / 2, G.H * 0.4, { n: 18, emoji: pick(['⭐', '✨', '🎉']), size: 22, speed: 260, grav: 300, life: 1.1 });
      sfx.win();
    }
  }
  function size() {
    G.W = innerWidth; G.H = innerHeight; G.dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(G.W * G.dpr); cv.height = Math.round(G.H * G.dpr);
    G.top = Math.round(q('.rh-hint').getBoundingClientRect().bottom + 10);
    game.layout();
  }
  const card = (html, bind) => { const el = q('.rh-card'); el.innerHTML = html; el.classList.remove('hidden'); root.classList.add('carded'); bind?.(el); el.querySelector('.btn')?.focus?.({ preventScroll: true }); };
  const hideCard = () => { q('.rh-card').classList.add('hidden'); root.classList.remove('carded'); };

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf); clearInterval(autoT);
    removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKey, true);
    root.remove();
  }
  function cancel() { close(); try { onCancel?.(); } catch (e) { console.warn(e); } }
  function startCount() { hideCard(); document.activeElement?.blur?.(); phase = 'count'; countT = 3.6; countStage = -1; last = performance.now(); }
  function intro() {
    card(`<div class="rh-big">${def.icon}</div><h3>${esc(def.name)}${practice ? ' <small>(làm thử)</small>' : ''}</h3>
      <p>${esc(def.desc)}</p>
      <ul class="rh-how">${def.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
      <p class="rh-goal">⏱️ ${durSec} giây · 🎯 Đạt từ <b>${pass}</b> điểm</p>
      ${practice ? '<p class="rh-note">Bạn đang là khách: làm thử cho biết, không được ghi vào sổ cải tạo.</p>' : ''}
      <button class="btn gold rh-go" type="button">Bắt đầu làm việc</button><button class="btn ghost rh-back" type="button">Để sau</button>`, (el) => {
      el.querySelector('.rh-go').onclick = () => { sfx.tap(); startCount(); };
      el.querySelector('.rh-back').onclick = cancel;
    });
  }
  function confirmExit() {
    if (phase !== 'play' && phase !== 'count') return;
    prevPhase = phase; phase = 'pause';
    card(`<div class="rh-big">🚪</div><h3>Bỏ dở buổi lao động?</h3><p>${practice ? 'Bạn có thể làm thử lại bất cứ lúc nào.' : 'Buổi này sẽ <b>không</b> được ghi vào sổ cải tạo.'}</p>
      <button class="btn gold rh-stay" type="button">Làm tiếp</button><button class="btn ghost rh-quit" type="button">Thoát</button>`, (el) => {
      el.querySelector('.rh-stay').onclick = resume;
      el.querySelector('.rh-quit').onclick = cancel;
    });
  }
  function resume() { if (phase !== 'pause') return; hideCard(); phase = prevPhase; last = performance.now(); }
  function endGame() {
    phase = 'end';
    root.classList.remove('hurry');
    q('.rh-t').textContent = '0';
    const ok = G.score >= pass;
    fx.show('HẾT GIỜ!', '#ffffff', 1.1);
    if (ok) sfx.win(); else sfx.bad();
    setTimeout(() => {
      if (closed) return;
      card(`<div class="rh-res ${ok ? 'ok' : 'no'}"><div class="rh-big">${ok ? '🏅' : '💪'}</div><h3>${ok ? 'Đạt yêu cầu!' : 'Chưa đạt'}</h3>
        <div class="rh-final"><b>${G.score}</b><small>điểm</small></div>
        <p>${ok ? `Vượt mức đạt ${pass} điểm. Cán bộ ghi nhận buổi lao động tốt!` : `Cần ${pass} điểm để đạt. Buổi sau cố gắng hơn nhé!`}</p>
        <p class="rh-stats">${esc(game.stats())}</p></div>
        <button class="btn gold rh-ok" type="button">${practice ? 'Xong' : '📋 Nộp sổ cho cán bộ'}</button>`, (el) => {
        const btn = el.querySelector('.rh-ok'), base = btn.textContent;
        btn.onclick = () => submit(btn);
        let n = 15; // để quên thì tự nộp, không mất buổi
        autoT = setInterval(() => { if (--n <= 0) submit(btn); else if (!submitted) btn.textContent = `${base} (${n})`; }, 1000);
      });
    }, 900);
  }
  async function submit(btn) {
    if (submitted) return;
    submitted = true; clearInterval(autoT);
    if (btn) { btn.disabled = true; btn.textContent = practice ? 'Xong' : 'Đang ghi sổ…'; }
    try { await onFinish?.(G.score); } catch (e) { console.warn(e); }
    close();
  }

  function onKey(e) {
    if (closed) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
    e.stopPropagation(); // không cho nhân vật 3D đi lại hay phím tắt khác chạy khi đang chơi
    if (e.type !== 'keydown') { if (phase === 'play' && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault(); return; }
    if (e.code === 'Escape') { e.preventDefault(); if (phase === 'intro') cancel(); else if (phase === 'pause') resume(); else confirmExit(); }
    else if ((e.code === 'Space' || e.code === 'Enter') && phase === 'play') { e.preventDefault(); if (!e.repeat) game.key?.(e.code); }
  }
  document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKey, true);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (phase !== 'play') return;
    try { cv.setPointerCapture(e.pointerId); } catch {}
    const [x, y] = pt(e); game.down(x, y, e);
  });
  cv.addEventListener('pointermove', (e) => { const [x, y] = pt(e); game.move?.(x, y, e); });
  cv.addEventListener('pointerup', (e) => { if (phase !== 'play') return; const [x, y] = pt(e); game.up?.(x, y, e); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  q('.rh-x').onclick = () => { if (phase === 'intro') cancel(); else if (phase === 'pause') resume(); else if (phase !== 'end') confirmExit(); };
  addEventListener('resize', size);

  function drawCount() {
    const stage = countT > 2.6 ? 3 : countT > 1.6 ? 2 : countT > 0.6 ? 1 : 0;
    const k = stage ? (stage + 0.6 - countT) : (0.6 - countT) / 0.6;
    if (stage !== countStage) { countStage = stage; if (stage) sfx.tick(); else sfx.go(); }
    c.fillStyle = 'rgba(10,8,5,.28)'; c.fillRect(0, 0, G.W, G.H);
    const s = 1.5 - 0.5 * ease(k * 2.5);
    label(c, stage ? String(stage) : 'Bắt đầu!', G.W / 2, G.H / 2, { size: (stage ? 120 : Math.min(70, G.W * 0.13)) * s, color: stage ? '#ffe08a' : '#b8ff9a', alpha: k > 0.8 ? 1 - (k - 0.8) * 4 : 1 });
  }
  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    G.vt += dt;
    if (phase === 'count') { countT -= dt; if (countT <= 0) { phase = 'play'; lastSec = -1; } }
    else if (phase === 'play') {
      G.T += dt; game.update(dt);
      const sec = Math.max(0, Math.ceil(durSec - G.T));
      if (sec !== lastSec) { lastSec = sec; q('.rh-t').textContent = sec; root.classList.toggle('hurry', sec <= 10); if (sec <= 5 && sec > 0) sfx.tick(); }
      if (G.T >= durSec) endGame();
    }
    fx.update(dt);
    c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    c.save();
    if (fx.shake > 0) { const sh = fx.shake * 20; c.translate(rand(-sh, sh), rand(-sh, sh)); }
    game.draw(c);
    fx.draw(c, G.W, G.H);
    c.restore();
    if (phase === 'count') drawCount();
    raf = requestAnimationFrame(frame);
  }
  size(); paintScore(); intro();
  raf = requestAnimationFrame(frame);
  return { close, get score() { return G.score; } };
}
