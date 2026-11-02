const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load or initialize metadata
const metaFile = path.join(__dirname, 'data', 'meta.json');
let meta = {};
if (fs.existsSync(metaFile)) {
  try {
    meta = JSON.parse(fs.readFileSync(metaFile, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    console.error('Error reading meta.json:', err.message);
  }
}

// Database file
const dbFile = path.join(__dirname, 'data', 'db.json');
let db = {
  users: {},
  tokens: {},
  inventory: {},
  quests: {},
  visited: {},
  lanterns: [],
  steles: {},
  donations: []
};

function initDefaultDb() {
  db.donations = [
    { name: 'Minh Anh Lofi', amount: '500.000đ', title: 'Tặng Combo Pháo Hoa Đại Tiệc Live 🎆' },
    { name: 'Hoàng Phúc Barista', amount: '300.000đ', title: 'Mời cả quán 100 ly Cà Phê Phin ☕' },
    { name: 'Mèo Cam Cute', amount: '200.000đ', title: 'Thả 1.000 Tim Hồng cho chủ quán 💖' },
    { name: 'Thảo Vy Study', amount: '150.000đ', title: 'Ủng hộ góc học bài Lofi đêm khuya 💻' },
    { name: 'Khánh Duy Acoustic', amount: '250.000đ', title: 'Tặng quỹ âm nhạc & thức ăn cho Corgi 🎸' },
    { name: 'Linh Chi Matcha', amount: '100.000đ', title: 'Yêu không gian mưa Đà Lạt của quán 🌧️' }
  ];

  db.lanterns = [
    { id: 1, uid: 9991, name: 'Minh Anh', text: 'Chúc mọi người đang xem Live một buổi tối thật bình yên và học tập hiệu quả nhé! ☕💻', temple: 'nhattru', created_at: Date.now() - 1800000, rejoices: 38 },
    { id: 2, uid: 9992, name: 'Bảo Ngọc', text: 'Mèo cam và Corgi trong quán dễ thương xỉu, ai rảnh qua bàn số 2 uống Matcha Latte nha! 🍵🐱', temple: 'nhattru', created_at: Date.now() - 3600000, rejoices: 45 },
    { id: 3, uid: 9993, name: 'Tuấn Kiệt', text: 'Tiếng mưa rơi ngoài cửa sổ kết hợp nhạc Lofi làm việc cực kỳ vào việc luôn 🌧️🎧', temple: 'nhattru', created_at: Date.now() - 7200000, rejoices: 72 },
    { id: 4, uid: 9994, name: 'Lan Hương', text: 'Thả tim cho buổi Live tối nay! Chúc cả nhà luôn vui vẻ và vượt mọi deadline ✨💖', temple: 'nhattru', created_at: Date.now() - 10800000, rejoices: 29 }
  ];
}

function loadDb() {
  if (fs.existsSync(dbFile)) {
    try {
      db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
      console.error('Error loading db.json, using defaults:', e.message);
    }
  }
  initDefaultDb();
  // Ensure existing users have Cafe-themed quest titles and starter pets/items
  for (const uid of Object.keys(db.users || {})) {
    const u = db.users[uid];
    if (u && u.name === 'Nam Giao Phụng') u.name = 'Minh Khôi Chill';
    const inv = db.inventory[uid] || (db.inventory[uid] = {});
    if (!inv.lt_meo_cam) inv.lt_meo_cam = 1;
    if (!inv.lt_corgi) inv.lt_corgi = 1;
    if (!inv.huong_tram) inv.huong_tram = 15;
    if (!inv.nen_sap) inv.nen_sap = 10;
    if (!inv.hoa_dang) inv.hoa_dang = 8;
    if (!inv.den_hoa_dang) inv.den_hoa_dang = 5;
    if (u && u.equipped && !u.equipped.pet) u.equipped.pet = 'lt_meo_cam';
    db.quests[uid] = getDefaultQuests();
  }
  saveDb();
}

function saveDb() {
  try {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving db:', e.message);
  }
}

// Seed Steles (Bảng vàng khách quen) for cafes if empty
function getSteleRows(templeId) {
  if (db.steles[templeId] && db.steles[templeId].length) {
    return db.steles[templeId];
  }
  return [
    { name: 'Minh Anh Lofi', title: 'Lofi Chill Master · Lv.12', score: 2450 },
    { name: 'Hoàng Phúc Barista', title: 'Barista Trưởng · Lv.10', score: 1980 },
    { name: 'Bảo Ngọc Matcha', title: 'Bạn Thân Corgi · Lv.8', score: 1560 },
    { name: 'Tuấn Kiệt Study', title: 'Chiến Thần Deadline · Lv.7', score: 1240 },
    { name: 'Khánh Duy Acoustic', title: 'Nghệ Sĩ Acoustic · Lv.6', score: 980 }
  ];
}

// Default quests list (Cafe & TikTok Live themed)
function getDefaultQuests() {
  return [
    { id: 'visit_temple', title: 'Ghé thăm không gian Quán Cafe 3D', goal: 1, progress: 1, reward: { sen: 30 }, done: true, claimed: false },
    { id: 'bow_10', title: 'Nhâm nhi 10 ngụm cà phê ấm', goal: 10, progress: 0, reward: { sen: 50 }, done: false, claimed: false },
    { id: 'bead_108', title: 'Rang xay 108 hạt cà phê Arabica', goal: 108, progress: 0, reward: { sen: 80 }, done: false, claimed: false },
    { id: 'chant_mo', title: 'Phiêu theo 30 nhịp nhạc Lofi Chill', goal: 30, progress: 0, reward: { sen: 60 }, done: false, claimed: false },
    { id: 'meditate_5', title: 'Bật Laptop Học bài / Làm việc 5 phút', goal: 5, progress: 0, reward: { sen: 70 }, done: false, claimed: false },
    { id: 'light_incense', title: 'Gọi 1 ly Cà Phê Phin Sữa Đá lên bàn', goal: 1, progress: 0, reward: { sen: 40 }, done: false, claimed: false },
    { id: 'wish_lantern', title: 'Thả 1 Thiệp Tâm Sự lên màn hình Live', goal: 1, progress: 0, reward: { sen: 100 }, done: false, claimed: false }
  ];
}

loadDb();

// Calculate level from EXP
function getLevelFromExp(exp) {
  const levels = meta.levels || [];
  let lv = 1;
  for (let i = 0; i < levels.length; i++) {
    if (exp >= levels[i]) lv = i + 2;
    else break;
  }
  return Math.min(lv, meta.maxLevel || 100);
}

// Auth Helper
function authUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/, '').trim();
  if (!token) return null;
  const uid = db.tokens[token];
  if (!uid || !db.users[uid]) return null;
  return db.users[uid];
}

// REST APIs
app.get('/api/meta', (req, res) => {
  meta.serverNow = Date.now();
  meta.shopOff = false;
  res.json(meta);
});

app.get('/api/build', (req, res) => {
  res.json({ build: 'cafe3d-v3' });
});

app.get('/api/challenge', (req, res) => {
  res.json({ c: 'cf_' + Math.random().toString(36).substring(2) + Date.now().toString(36) });
});

app.get('/api/capacity', (req, res) => {
  res.json({ online: 148, max: 500, free: 352 });
});

app.post('/api/register', (req, res) => {
  const { name, appearance, sect, robe } = req.body;
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const token = 'tk_' + Math.random().toString(36).substring(2) + id.toString(36);

  const user = {
    id,
    name: (name || 'Khách Chill').trim().slice(0, 24),
    appearance: appearance || { gender: 'nam', hair: 'ngan', skin: '#f1c7a3' },
    sect: sect || 'truclam',
    level: 1,
    exp: 0,
    currencies: { sen: 300, ngoc: 25 },
    equipped: { robe: robe || 'ao_lam', beads: 'chuoi_bode', cushion: 'bd_nau', pet: 'lt_meo_cam' },
    stats: { bows: 0, beads: 0, rounds: 0, mo: 0, visits: 1, meditateMin: 0, donated: 0 },
    order: 'phin',
    study: false,
    createdAt: Date.now()
  };

  const inventory = {
    ao_lam: 1,
    ao_xam: 1,
    chuoi_bode: 1,
    bd_nau: 1,
    lt_meo_cam: 1,
    lt_corgi: 1,
    huong_tram: 15,
    nen_sap: 10,
    hoa_dang: 8,
    den_hoa_dang: 5
  };

  const quests = getDefaultQuests();

  db.users[id] = user;
  db.tokens[token] = id;
  db.inventory[id] = inventory;
  db.quests[id] = quests;
  db.visited[id] = ['nhattru'];

  saveDb();

  res.json({
    token,
    user,
    inventory,
    quests,
    visited: db.visited[id],
    account: { id, username: user.name }
  });
});

app.post('/api/login', (req, res) => {
  const users = Object.values(db.users);
  let user = users[0];
  if (!user) {
    const id = Date.now();
    const token = 'tk_' + Math.random().toString(36).substring(2) + id.toString(36);
    user = {
      id,
      name: 'Minh Khôi Chill',
      appearance: { gender: 'nam', hair: 'ngan', skin: '#f1c7a3' },
      sect: 'truclam',
      level: 5,
      exp: 1100,
      currencies: { sen: 450, ngoc: 30 },
      equipped: { robe: 'ao_lam', beads: 'chuoi_bode', cushion: 'bd_nau', pet: 'lt_meo_cam' },
      stats: { bows: 42, beads: 216, rounds: 2, mo: 150, visits: 4, meditateMin: 25, donated: 0 },
      order: 'phin',
      study: true,
      createdAt: Date.now()
    };
    db.users[id] = user;
    db.tokens[token] = id;
    db.inventory[id] = {
      ao_lam: 1, ao_xam: 1, chuoi_bode: 1, bd_nau: 1,
      lt_meo_cam: 1, lt_corgi: 1,
      huong_tram: 15, nen_sap: 10, hoa_dang: 8, den_hoa_dang: 5
    };
    db.quests[id] = getDefaultQuests();
    db.visited[id] = ['nhattru', 'tranho', 'hoangoc'];
    saveDb();
    return res.json({ token, user });
  }

  let token = Object.keys(db.tokens).find(t => db.tokens[t] === user.id);
  if (!token) {
    token = 'tk_' + Math.random().toString(36).substring(2) + user.id.toString(36);
    db.tokens[token] = user.id;
    saveDb();
  }
  res.json({ token, user });
});

app.get('/api/me', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  res.json({
    user,
    inventory: db.inventory[user.id] || {},
    quests: db.quests[user.id] || getDefaultQuests(),
    visited: db.visited[user.id] || ['nhattru']
  });
});

app.post('/api/quests/claim', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const { id } = req.body;
  const quests = db.quests[user.id] || (db.quests[user.id] = getDefaultQuests());
  const q = quests.find(x => x.id === id);
  if (q && q.done && !q.claimed) {
    q.claimed = true;
    const rewardSen = q.reward?.sen || 50;
    user.currencies.sen = (user.currencies.sen || 0) + rewardSen;
    user.exp = (user.exp || 0) + 30;
    saveDb();
  }
  res.json({ ok: true, user, quests });
});

app.post('/api/practice', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });

  const { type, count = 1, temple = 'nhattru', auto } = req.body;
  let gained = 0;
  let extra = {};

  const userQuests = db.quests[user.id] || (db.quests[user.id] = getDefaultQuests());

  if (type === 'bow') {
    const n = Math.max(1, parseInt(count) || 1);
    user.stats.bows = (user.stats.bows || 0) + n;
    gained = n * 5;
    user.currencies.sen = (user.currencies.sen || 0) + n * 2;
    extra.together = 8;

    const q = userQuests.find(x => x.id === 'bow_10');
    if (q) {
      q.progress = Math.min(q.goal, q.progress + n);
      if (q.progress >= q.goal) q.done = true;
    }
  } else if (type === 'bead') {
    const n = Math.max(1, parseInt(count) || 1);
    user.stats.beads = (user.stats.beads || 0) + n;
    gained = n * 2;
    user.currencies.sen = (user.currencies.sen || 0) + n;

    if (user.stats.beads >= 108 && Math.floor(user.stats.beads / 108) > (user.stats.rounds || 0)) {
      user.stats.rounds = Math.floor(user.stats.beads / 108);
      extra.rounds = 1;
      extra.roundExp = 50;
      gained += 50;
      user.currencies.sen += 25;
    }

    const q = userQuests.find(x => x.id === 'bead_108');
    if (q) {
      q.progress = Math.min(q.goal, q.progress + n);
      if (q.progress >= q.goal) q.done = true;
    }
  } else if (type === 'mo') {
    const n = Math.max(1, parseInt(count) || 1);
    user.stats.mo = (user.stats.mo || 0) + n;
    gained = n * (auto ? 1 : 2);
    user.currencies.sen = (user.currencies.sen || 0) + (auto ? 0 : 1);
    extra.capped = false;

    const q = userQuests.find(x => x.id === 'chant_mo');
    if (q) {
      q.progress = Math.min(q.goal, q.progress + n);
      if (q.progress >= q.goal) q.done = true;
    }
  } else if (type === 'meditate_start') {
    user._medStart = Date.now();
    user.study = true;
    return res.json({ ok: true });
  } else if (type === 'meditate_end') {
    const minutes = Math.max(1, Math.round((Date.now() - (user._medStart || Date.now() - 60000)) / 60000));
    user.stats.meditateMin = (user.stats.meditateMin || 0) + minutes;
    gained = minutes * 15;
    user.currencies.sen = (user.currencies.sen || 0) + minutes * 8;
    extra.minutes = minutes;

    const q = userQuests.find(x => x.id === 'meditate_5');
    if (q) {
      q.progress = Math.min(q.goal, q.progress + minutes);
      if (q.progress >= q.goal) q.done = true;
    }
  } else if (type === 'visit') {
    const visited = db.visited[user.id] || (db.visited[user.id] = []);
    const already = visited.includes(temple);
    if (!already) visited.push(temple);
    user.stats.visits = (user.stats.visits || 0) + 1;
    gained = already ? 5 : 30;
    extra.already = already;
  } else if (type === 'bell') {
    gained = 15;
    user.currencies.sen = (user.currencies.sen || 0) + 5;
  } else if (type === 'sit') {
    gained = 5;
  } else if (type === 'stroll') {
    gained = 8;
  } else if (type === 'chant_done') {
    gained = 80;
    user.currencies.sen = (user.currencies.sen || 0) + 30;
  } else {
    gained = 10;
  }

  user.exp = (user.exp || 0) + gained;
  const newLevel = getLevelFromExp(user.exp);
  if (newLevel > user.level) {
    user.level = newLevel;
    extra.levelUp = newLevel;
    broadcastTicker(`✨ ${user.name} vừa lên Cấp Chill ${newLevel} tại Quán Cafe 3D! ☕🎉`);
  }

  saveDb();

  res.json({
    gained,
    user,
    extra
  });
});

// Order drink / food / laptop on cafe table
app.post('/api/order', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });

  const { drink = 'phin', study, temple = 'nhattru', seat = -1 } = req.body;
  user.order = drink;
  if (study !== undefined) user.study = !!study;

  const gained = 25;
  user.exp = (user.exp || 0) + gained;
  user.currencies.sen = (user.currencies.sen || 0) + 12;

  const quests = db.quests[user.id] || [];
  const q = quests.find(x => x.id === 'light_incense');
  if (q) { q.progress = 1; q.done = true; }

  saveDb();
  broadcastToTemple(temple, { t: 'tableOrder', uid: user.id, seat, order: user.order, study: !!user.study });

  res.json({ ok: true, gained, user });
});

// Trigger TikTok Live Gift / Fireworks
app.post('/api/tiktok-gift', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  const { giftId = 'fireworks', sender, temple = 'nhattru' } = req.body;
  const senderName = (sender || user?.name || 'Viewer TikTok').trim().slice(0, 28);

  const gifts = {
    rose: { name: 'Hoa Hồng Đỏ 🌹', icon: '🌹', color: '#ff4d79', exp: 15, sen: 10 },
    coffee: { name: 'Combo Cà Phê Vàng ☕', icon: '☕', color: '#f5b942', exp: 35, sen: 25 },
    hearts: { name: 'Bão Tim TikTok 💖', icon: '💖', color: '#ff2a85', exp: 60, sen: 40 },
    corgi: { name: 'Siêu Corgi Đáng Yêu 🐶', icon: '🐶', color: '#ff9d3b', exp: 90, sen: 60 },
    fireworks: { name: 'Pháo Hoa Đại Tiệc 🎆', icon: '🎆', color: '#ffdf4d', exp: 150, sen: 100 }
  };
  const g = gifts[giftId] || gifts.fireworks;

  if (user) {
    user.exp = (user.exp || 0) + g.exp;
    user.currencies.sen = (user.currencies.sen || 0) + g.sen;
  }

  db.donations.unshift({
    name: senderName,
    amount: `+${g.sen} Hạt Cafe`,
    title: `Tặng ${g.name} trên Live`
  });
  if (db.donations.length > 30) db.donations.length = 30;
  saveDb();

  broadcastToTemple(temple, {
    t: 'tiktokGift',
    giftId,
    sender: senderName,
    giftName: g.name,
    icon: g.icon,
    color: g.color
  });
  broadcastTicker(`🎁 [TikTok Live] ${senderName} vừa gửi tặng ${g.name}! Cảm ơn bạn rất nhiều ✨`);

  res.json({ ok: true, gift: g, user, donations: db.donations.slice(0, 15) });
});

app.post('/api/use', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });

  const { item, temple = 'nhattru' } = req.body;
  const inv = db.inventory[user.id] || {};
  if (inv[item] && inv[item] > 0) {
    inv[item]--;
  }

  // Map item to drink order on 3D table
  const itemToOrder = {
    huong_tram: 'phin',
    nen_sap: 'matcha',
    hoa_dang: 'boba'
  };
  if (itemToOrder[item]) {
    user.order = itemToOrder[item];
  }

  const gained = 20;
  user.exp = (user.exp || 0) + gained;
  user.currencies.sen = (user.currencies.sen || 0) + 10;

  const quests = db.quests[user.id] || [];
  if (item === 'huong_tram') {
    const q = quests.find(x => x.id === 'light_incense');
    if (q) { q.progress = 1; q.done = true; }
  }

  saveDb();
  res.json({ ok: true, gained, user, inventory: inv });
});

app.post('/api/equip', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });

  const { type, id } = req.body;
  if (!user.equipped) user.equipped = {};
  user.equipped[type] = id;

  saveDb();
  res.json({ ok: true, user });
});

app.get('/api/stele', (req, res) => {
  const temple = req.query.temple || 'nhattru';
  res.json({
    subtitle: 'Top Khách Quen & Học Tập Chăm Chỉ',
    rows: getSteleRows(temple)
  });
});

app.get('/api/donations', (req, res) => {
  res.json({ rows: db.donations || [] });
});

app.get('/api/leaderboard', (req, res) => {
  const users = Object.values(db.users || {});
  const top = [
    ...users.map(u => ({ id: u.id, name: u.name, sect: u.sect, level: u.level, exp: u.exp || 0, appearance: u.appearance, equipped: u.equipped })),
    { id: 101, name: 'Minh Anh Lofi', sect: 'truclam', level: 12, exp: 4250, appearance: { gender: 'nu', hair: 'dai', skin: '#f1c7a3' }, equipped: { robe: 'ao_truc' } },
    { id: 102, name: 'Hoàng Phúc Barista', sect: 'tinhdo', level: 10, exp: 3400, appearance: { gender: 'nam', hair: 'ngan', skin: '#e0a67e' }, equipped: { robe: 'ao_xam' } },
    { id: 103, name: 'Bảo Ngọc Matcha', sect: 'taodong', level: 9, exp: 2890, appearance: { gender: 'nu', hair: 'bui', skin: '#f1c7a3' }, equipped: { robe: 'ao_sen' } },
    { id: 104, name: 'Tuấn Kiệt Study', sect: 'truclam', level: 8, exp: 2210, appearance: { gender: 'nam', hair: 'ngan', skin: '#d98b5f' }, equipped: { robe: 'ao_lam' } },
    { id: 105, name: 'Khánh Duy Acoustic', sect: 'lamte', level: 7, exp: 1850, appearance: { gender: 'nam', hair: 'ngan', skin: '#e0a67e' }, equipped: { robe: 'ao_nau' } }
  ].sort((a, b) => b.exp - a.exp);

  res.json({
    top,
    sects: { truclam: 42, tinhdo: 35, lamte: 28, taodong: 45 }
  });
});

app.get('/api/lanterns', (req, res) => {
  res.json({ lanterns: db.lanterns.slice(-30).reverse() });
});

app.post('/api/lanterns', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  const { text, temple = 'nhattru' } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Vui lòng nhập lời nhắn hoặc tâm sự' });

  const lantern = {
    id: Date.now(),
    uid: user ? user.id : 0,
    name: user ? user.name : 'Khách ẩn danh',
    text: text.trim().slice(0, 180),
    temple,
    created_at: Date.now(),
    rejoices: 1
  };

  db.lanterns.push(lantern);

  if (user) {
    user.exp = (user.exp || 0) + 50;
    user.currencies.sen = (user.currencies.sen || 0) + 20;
    const quests = db.quests[user.id] || [];
    const q = quests.find(x => x.id === 'wish_lantern');
    if (q) { q.progress = 1; q.done = true; }
  }

  saveDb();

  broadcastToTemple(temple, { t: 'lantern', lantern });
  broadcastTicker(`💌 ${lantern.name} vừa gửi lời nhắn lên Live: "${lantern.text.slice(0, 48)}..."`);

  res.json({ lantern, user });
});

app.post('/api/lanterns/:id/rejoice', (req, res) => {
  const id = parseInt(req.params.id);
  const lantern = db.lanterns.find(l => l.id === id);
  if (lantern) {
    lantern.rejoices = (lantern.rejoices || 0) + 1;
    saveDb();
    return res.json({ ok: true, rejoices: lantern.rejoices });
  }
  res.json({ ok: true, rejoices: 1 });
});

app.post('/api/shop/buy', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });

  const { item: itemId } = req.body;
  const itemDef = meta.items?.find(i => i.id === itemId);
  if (!itemDef) return res.status(404).json({ error: 'Không tìm thấy vật phẩm' });

  const priceNgoc = itemDef.price_ngoc || (itemDef.ngoc ? itemDef.price : 0) || 0;
  const priceSen = itemDef.price_sen || (!itemDef.ngoc ? itemDef.price : 0) || 0;

  if (priceNgoc > 0 && priceSen === 0) {
    if ((user.currencies.ngoc || 0) < priceNgoc) return res.status(400).json({ error: 'Không đủ Sao / Đậu Vàng' });
    user.currencies.ngoc -= priceNgoc;
  } else {
    if ((user.currencies.sen || 0) < priceSen) return res.status(400).json({ error: 'Không đủ Hạt Cafe' });
    user.currencies.sen -= priceSen;
  }

  const inv = db.inventory[user.id] || (db.inventory[user.id] = {});
  inv[itemId] = (inv[itemId] || 0) + (itemDef.amount || 1);

  saveDb();
  res.json({ ok: true, user, inventory: inv });
});

app.post('/api/wheel', (req, res) => {
  const user = authUser(req) || Object.values(db.users)[0];
  const rewards = [
    { type: 'sen', val: 50, label: '50 Hạt Cafe thơm' },
    { type: 'sen', val: 100, label: '100 Hạt Cafe Arabica' },
    { type: 'item', id: 'huong_tram', val: 3, label: '3 Ly Cà Phê Phin Sữa Đá' },
    { type: 'item', id: 'nen_sap', val: 2, label: '2 Ly Matcha Latte Kem' },
    { type: 'item', id: 'den_hoa_dang', val: 1, label: '1 Thiệp Tâm Sự Live' },
    { type: 'ngoc', val: 5, label: '5 Ngôi Sao Live' }
  ];
  const rw = rewards[Math.floor(Math.random() * rewards.length)];

  if (user) {
    if (rw.type === 'sen') user.currencies.sen = (user.currencies.sen || 0) + rw.val;
    else if (rw.type === 'ngoc') user.currencies.ngoc = (user.currencies.ngoc || 0) + rw.val;
    else if (rw.type === 'item') {
      const inv = db.inventory[user.id] || (db.inventory[user.id] = {});
      inv[rw.id] = (inv[rw.id] || 0) + rw.val;
    }
    saveDb();
  }

  res.json({ ok: true, reward: rw, user });
});

app.get('/api/que', (req, res) => {
  const quesm = [
    { title: 'Thông Điệp #1: Năng Lượng Tích Cực ☕', text: 'Một tách cà phê ấm mở đầu ngày mới tràn đầy cảm hứng! Mọi kế hoạch và deadline hôm nay của bạn đều sẽ hoàn thành xuất sắc.' },
    { title: 'Thông Điệp #8: Khoảnh Khắc Bình Yên 🌧️', text: 'Đừng quá vội vàng trước những áp lực. Hãy bật một bản nhạc Lofi, hít thở sâu và làm từng việc nhỏ một — bạn đang đi đúng hướng rồi!' },
    { title: 'Thông Điệp #15: Tin Vui Đang Tới 🍀', text: 'Giống như hương thơm dịu ngọt của Matcha Latte, một cơ hội mới hoặc một người bạn tâm giao sắp ghé thăm góc bàn của bạn.' },
    { title: 'Thông Điệp #24: Bứt Phá Ngoạn Mục ✨', text: 'Sự kiên trì học tập và làm việc mỗi ngày của bạn đã đến ngày hái quả ngọt. Hãy tự thưởng cho mình một buổi chiều thật chill nhé!' }
  ];
  res.json({ quesm: quesm[Math.floor(Math.random() * quesm.length)] });
});

// Broadcast Helper
function broadcastTicker(text) {
  const msg = JSON.stringify({ t: 'ticker', text });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function broadcastToTemple(templeId, data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN && c.temple === templeId) {
      c.send(msg);
    }
  });
}

// Simulated fellow Cafe Customers / Streamers / Students sitting at tables
const simulatedDevotees = [
  { id: 101, name: 'Minh Anh Lofi 🎧', appearance: { gender: 'nu', hair: 'dai', skin: '#f1c7a3' }, equipped: { robe: 'ao_truc', pet: 'lt_meo_cam' }, level: 8, honor: 'Lofi Chill Master', seat: 0, a: 3, x: -4, z: -3.2, y: 0, r: 0, order: 'matcha', study: true },
  { id: 102, name: 'Hoàng Phúc Barista ☕', appearance: { gender: 'nam', hair: 'ngan', skin: '#e0a67e' }, equipped: { robe: 'ao_xam', pet: 'lt_corgi' }, level: 6, honor: 'Nghệ Nhân Latte Art', seat: 1, a: 3, x: -1.6, z: -3.2, y: 0, r: 0, order: 'phin', study: false },
  { id: 103, name: 'Thảo Vy Study 💻', appearance: { gender: 'nu', hair: 'bui', skin: '#f1c7a3' }, equipped: { robe: 'ao_trang' }, level: 5, honor: 'Chiến Thần Deadline', seat: 2, a: 3, x: 1.6, z: -3.2, y: 0, r: 0, order: 'boba', study: true },
  { id: 104, name: 'Bảo Ngọc Matcha 🍵', appearance: { gender: 'nu', hair: 'dai', skin: '#f1c7a3' }, equipped: { robe: 'ao_sen', pet: 'lt_tho_ngoc' }, level: 7, honor: 'Bạn Thân Corgi', seat: 3, a: 3, x: 4, z: -3.2, y: 0, r: 0, order: 'croissant', study: false },
  { id: 105, name: 'Khánh Duy Acoustic 🎸', appearance: { gender: 'nam', hair: 'ngan', skin: '#d98b5f' }, equipped: { robe: 'ao_nau' }, level: 4, honor: 'Nghệ Sĩ Acoustic', seat: 4, a: 3, x: -6.4, z: -0.8, y: 0, r: 0, order: 'cappuccino', study: false },
  { id: 106, name: 'Tuấn Kiệt Coder ⚡', appearance: { gender: 'nam', hair: 'ngan', skin: '#d98b5f' }, equipped: { robe: 'ao_lam' }, level: 7, honor: 'Tín Đồ Lofi', seat: 5, a: 3, x: -4, z: -0.8, y: 0, r: 0, order: 'phin', study: true },
  { id: 107, name: 'Lan Hương TikTok 💖', appearance: { gender: 'nu', hair: 'bui', skin: '#e0a67e' }, equipped: { robe: 'ao_vulan', pet: 'lt_meo_cam' }, level: 5, honor: 'Sen Của Hoàng Thượng', seat: 6, a: 3, x: -1.6, z: -0.8, y: 0, r: 0, order: 'boba', study: false },
  { id: 108, name: 'Hải Đăng Freelancer', appearance: { gender: 'nam', hair: 'ngan', skin: '#f1c7a3' }, equipped: { robe: 'ao_may_bac' }, level: 4, honor: 'Góc Cửa Sổ', seat: 7, a: 3, x: 1.6, z: -0.8, y: 0, r: 0, order: 'cappuccino', study: true },
  { id: 109, name: 'Quỳnh Châu Tarot ✨', appearance: { gender: 'nu', hair: 'dai', skin: '#f1c7a3' }, equipped: { robe: 'ao_hoang_kim', pet: 'lt_corgi' }, level: 9, honor: 'Chủ Quán Mèo Chill', seat: 8, a: 3, x: 4, z: -0.8, y: 0, r: 0, order: 'matcha', study: false },
  { id: 110, name: 'Gia Huy Designer 🎨', appearance: { gender: 'nam', hair: 'ngan', skin: '#d98b5f' }, equipped: { robe: 'ao_vang' }, level: 5, honor: 'Yêu Cà Phê Phin', seat: 9, a: 3, x: 6.4, z: -0.8, y: 0, r: 0, order: 'croissant', study: true }
];

// WebSocket Connection Handling
wss.on('connection', (ws, req) => {
  ws.temple = 'nhattru';
  ws.userId = null;
  ws.state = { x: 0, z: 2, y: 0, r: 0, seat: -1, a: 0, order: 'phin', study: false };

  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (token && db.tokens[token]) {
    ws.userId = db.tokens[token];
  }

  ws.on('message', (data) => {
    try {
      const m = JSON.parse(data.toString());
      if (m.t === 'join') {
        ws.temple = m.temple || 'nhattru';
        ws.send(JSON.stringify({ t: 'joined', build: 'cafe3d-v3' }));

        const activeProfiles = [...simulatedDevotees];
        if (ws.userId && db.users[ws.userId]) {
          activeProfiles.push(db.users[ws.userId]);
        }
        ws.send(JSON.stringify({ t: 'prof', p: activeProfiles }));

        broadcastRoom(ws.temple);
      } else if (m.t === 's') {
        ws.state.x = m.x || 0;
        ws.state.z = m.z || 0;
        ws.state.y = m.y || 0;
        ws.state.r = m.r || 0;
        ws.state.seat = m.seat !== undefined ? m.seat : -1;
        ws.state.a = m.a || 0;
        if (m.order) ws.state.order = m.order;
        if (m.study !== undefined) ws.state.study = !!m.study;

        broadcastRoom(ws.temple);
      } else if (m.t === 'order') {
        ws.state.order = m.order || 'phin';
        if (m.study !== undefined) ws.state.study = !!m.study;
        if (ws.userId && db.users[ws.userId]) {
          db.users[ws.userId].order = ws.state.order;
          db.users[ws.userId].study = ws.state.study;
        }
        broadcastToTemple(ws.temple, {
          t: 'tableOrder',
          uid: ws.userId || 0,
          seat: m.seat !== undefined ? m.seat : ws.state.seat,
          order: ws.state.order,
          study: ws.state.study
        });
        broadcastRoom(ws.temple);
      } else if (m.t === 'tiktokGift') {
        broadcastToTemple(ws.temple, {
          t: 'tiktokGift',
          giftId: m.giftId || 'fireworks',
          sender: m.sender || 'Khách Xem Live',
          giftName: m.giftName || 'Pháo Hoa Đại Tiệc 🎆',
          icon: m.icon || '🎆',
          color: m.color || '#ffdf4d'
        });
      } else if (m.t === 'emote') {
        broadcastToTemple(ws.temple, { t: 'bubble', from: ws.userId || 0, e: m.e || 'pray' });
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on('close', () => {
    broadcastRoom(ws.temple);
  });
});

function broadcastRoom(templeId) {
  const roomClients = [...wss.clients].filter(c => c.readyState === WebSocket.OPEN && c.temple === templeId);
  const realPlayers = [];

  roomClients.forEach(c => {
    if (c.userId && db.users[c.userId]) {
      const u = db.users[c.userId];
      realPlayers.push({
        ...u,
        x: c.state.x,
        z: c.state.z,
        y: c.state.y,
        r: c.state.r,
        seat: c.state.seat,
        a: c.state.a,
        order: c.state.order || u.order || 'phin',
        study: c.state.study !== undefined ? c.state.study : !!u.study
      });
    }
  });

  const allPlayers = [...simulatedDevotees, ...realPlayers];
  const onlineCount = 128 + roomClients.length;

  const msg = JSON.stringify({
    t: 'room',
    temple: templeId,
    online: onlineCount,
    players: allPlayers
  });

  roomClients.forEach(c => c.send(msg));
}

// Start Server
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  ☕ Quán Cafe Online 3D - Lofi Chill & TikTok Live`);
  console.log(`  🌐 Máy chủ đang chạy tại: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
