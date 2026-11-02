// Âm thanh Quán Cafe Katinat (Web Audio API): Nhạc Lofi Jazz, tiếng tách cà phê gốm, tiếng hợp âm Piano ấm và mưa rơi ngoài hiên.
import { local } from './api.js';
import { TempleMusic } from './music.js';

const LOFI_NOTES = [261.63, 329.63, 392.00, 493.88, 587.33, 659.25];

export const Sound = {
  ctx: null, master: null,
  enabled: local.get('sound', true),
  chanting: local.get('chant', false),
  voice: local.get('voice2', false),
  musicOn: local.get('music', true),
  tempo: local.get('tempo', 76),
  vol: { master: 0.9, rhythm: 0.75, voice: 0.75, sfx: 0.8, music: 0.95, ...local.get('vol', {}) },
  active: false,
  beat: 0, nextBeat: 0, drone: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.vol.master : 0;
    this.master.connect(this.ctx.destination);
    this.bus = {};
    for (const k of ['rhythm', 'voice', 'sfx', 'music']) {
      this.bus[k] = this.ctx.createGain();
      this.bus[k].gain.value = this.vol[k];
    }
    this.bus.rhythm.connect(this.master);
    this.bus.sfx.connect(this.master);
    this.bus.music.connect(this.master);

    // Reverb ấm áp của phòng Cafe Acoustic (đuôi ngắn 1.4s ấm, không vang như chùa)
    this.reverb = this.ctx.createConvolver();
    const len = Math.floor(this.ctx.sampleRate * 1.4);
    const ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4.2);
    }
    this.reverb.buffer = ir;
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.28;
    this.reverb.connect(this.wet).connect(this.master);
    const vDry = this.ctx.createGain();
    vDry.gain.value = 0.75;
    this.bus.voice.connect(vDry).connect(this.master);
    this.bus.voice.connect(this.reverb);

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.nextBeat = this.ctx.currentTime + 0.3;
    this.music = new TempleMusic(this.ctx, this.bus.music, this.reverb);
    if (this.musicWant) this.setTempleMusic(this.musicWant);
    setInterval(() => this.schedule(), 80);
    setInterval(() => this.music.schedule(this.ctx.currentTime + 2), 500);
  },

  get now() { return this.ctx ? this.ctx.currentTime : 0; },

  setEnabled(on) {
    this.enabled = on; local.set('sound', on);
    if (this.master) this.master.gain.setTargetAtTime(on ? this.vol.master : 0, this.ctx.currentTime, 0.05);
    this.refreshLoop();
  },

  setVolume(kind, v) {
    this.vol[kind] = v; local.set('vol', this.vol);
    if (!this.ctx) return;
    const node = kind === 'master' ? (this.enabled ? this.master : null) : this.bus[kind];
    node?.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
    if (this.recording) this.recording.volume = Math.min(1, 0.75 * this.vol.voice * this.vol.master);
  },

  setChanting(on) {
    this.chanting = on; local.set('chant', on);
    this.refreshLoop();
  },

  setActive(on) { this.active = on; this.refreshLoop(); },

  setTempleMusic(id) {
    this.musicWant = id;
    if (!this.music) return;
    if (!id || !this.musicOn) { this.music.stop(); return; }
    if (this.music.id !== id) { this.music.stop(0.8); this.music.start(id); }
    this.duckMusic();
  },

  setMusicOn(on) { this.musicOn = on; local.set('music', on); this.setTempleMusic(this.musicWant); },
  setOutdoors(on) { if (this.outdoors !== on) { this.outdoors = on; this.duckMusic(); } },
  duckMusic() { this.music?.setLevel(0.9); }, // Luôn phát nhạc Lofi Cafe rõ ràng trong quán & ngoài sân

  refreshLoop() {
    if (!this.ctx) return;
    this.duckMusic();
    const on = this.chanting && this.active;
    if (on) this.nextBeat = Math.max(this.nextBeat, this.ctx.currentTime + 0.2);
    if (this.recording) {
      if (on && this.voice && this.enabled) this.recording.play().catch(() => {});
      else this.recording.pause();
    }
  },

  env(g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  },

  // Thay tiếng mõ bằng tiếng nốt đàn Rhodes Piano / Acoustic Guitar nhẹ nhàng
  mok(t = this.now, vol = 0.22) {
    if (!this.ctx) return;
    const c = this.ctx;
    const f = LOFI_NOTES[this.beat % LOFI_NOTES.length];
    const o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    this.env(g, t, vol * 0.45, 0.55);
    o.connect(lp).connect(g).connect(this.bus.rhythm);
    o.start(t);
    o.stop(t + 0.6);
  },

  // Thay tiếng chuông chùa bằng tiếng hợp âm Jazz Chime / Piano êm dịu
  bell(t = this.now, base = 329.63, vol = 0.16, len = 1.8, out = this.bus?.sfx) {
    if (!this.ctx) return;
    const freq = Math.max(261.63, base);
    [[1, 0.6], [1.25, 0.4], [1.5, 0.3]].forEach(([r, a], i) => {
      const o = this.ctx.createOscillator(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * r;
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const st = t + i * 0.035;
      this.env(g, st, vol * a, Math.min(2.2, len));
      o.connect(lp).connect(g).connect(out || this.master);
      o.start(st);
      o.stop(st + Math.min(2.3, len + 0.1));
    });
  },

  // Thay đại hồng chung bằng hợp âm Guitar Acoustic Cmaj9 tươi sáng
  bigBell() {
    if (!this.ctx) return;
    [261.63, 329.63, 392.00, 493.88, 587.33].forEach((f, i) => {
      this.bell(this.now + i * 0.06, f, 0.14, 2.0);
    });
  },

  // Tiếng đặt tách sứ / hạt cà phê nhẹ nhàng
  click(t = this.now) {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(660, t + 0.06);
    this.env(g, t, 0.12, 0.08);
    o.connect(g).connect(this.bus.sfx);
    o.start(t);
    o.stop(t + 0.09);
  },

  chime() { this.bell(this.now, 523.25, 0.12, 1.5); },
  success() { [0, 0.10, 0.20].forEach((d, i) => this.bell(this.now + d, [523.25, 659.25, 783.99][i], 0.12, 1.4)); },

  // Đã loại bỏ hoàn toàn tiếng ngân chùa (startDrone) & tiếng niệm Phật (chantPhrase)
  startDrone() {},
  stopDrone() {},
  chantPhrase() {},
  chantSyllable() {},

  schedule() {
    if (!this.chanting || !this.active || !this.ctx) return;
    const spb = 60 / this.tempo;
    if (this.nextBeat < this.ctx.currentTime - 1) this.nextBeat = this.ctx.currentTime + 0.1;
    while (this.nextBeat < this.ctx.currentTime + 0.15) {
      const t = this.nextBeat;
      if (this.beat % 2 === 0) this.mok(t, 0.2);
      this.beat++;
      this.nextBeat += spb;
    }
  },

  lines: new Map(),
  lineNow: null,
  loadLine() { return Promise.resolve(null); },
  stopLine() { this.lineNow = null; },
  async sayLine() { return 0; },

  recording: null,
  setRecording(url) {
    if (this.recording) { this.recording.pause(); this.recording = null; }
    if (!url) return;
    const a = new Audio(url); a.loop = true; a.volume = Math.min(1, 0.75 * this.vol.voice * this.vol.master); a.preload = 'auto';
    this.recording = a;
    this.refreshLoop();
  },

  /* ---------- Tiếng mưa Lofi ngoài hiên & Âm thanh Quà TikTok / Pháo hoa ---------- */
  rainNode: null,
  setRain(on) {
    this.init();
    const c = this.ctx;
    if (!c) return;
    if (!on) {
      if (this.rainNode) {
        try {
          this.rainNode.gain.gain.setTargetAtTime(0, c.currentTime, 0.25);
          setTimeout(() => { try { this.rainNode?.src?.stop(); } catch {} this.rainNode = null; }, 350);
        } catch {}
      }
      return;
    }
    if (this.rainNode) return;
    const len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.950 * b2 + w * 0.048;
      data[i] = (b0 + b1 + b2 + w * 0.018) * 0.35;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1350;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.24, c.currentTime + 0.6);
    src.connect(lp).connect(g).connect(this.bus.music || this.master);
    src.start();
    this.rainNode = { src, gain: g };
  },

  firework() {
    this.init();
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = c.currentTime + i * 0.07;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
      o.connect(g).connect(this.bus.sfx || this.master);
      o.start(t);
      o.stop(t + 0.6);
    });
  },
};
