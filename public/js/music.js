// Nhạc nền Quán Cafe Katinat (Lofi Chill, Jazz Rhodes Piano, Acoustic Guitar & Bossa Nova)
// Tự tổng hợp bằng Web Audio API: hợp âm Jazz Maj7/Min9 êm dịu, tiếng đàn Guitar thùng, Bass ấm và nhịp trống Lofi nhẹ nhàng.

const CHORD_PROGRESSIONS = {
  lofi_chill: [
    [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
    [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
    [293.66, 349.23, 440.00, 523.25, 659.25], // Dm9
    [196.00, 246.94, 349.23, 392.00, 440.00], // G13
  ],
  paris_bossa: [
    [349.23, 440.00, 523.25, 659.25], // Fmaj7
    [329.63, 392.00, 493.88, 587.33], // Em7
    [293.66, 349.23, 440.00, 523.25], // Dm7
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
  ],
  acoustic_night: [
    [220.00, 261.63, 329.63, 392.00], // Am7
    [293.66, 349.23, 440.00, 523.25], // Dm7
    [196.00, 246.94, 293.66, 349.23], // G7
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
  ],
};

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function presetOf(id) {
  const r = rng(hash(id || 'katinat'));
  const keys = Object.keys(CHORD_PROGRESSIONS);
  const prog = keys[Math.floor(r() * keys.length)];
  return {
    prog,
    beat: 0.52 + r() * 0.14, // ~95-115 BPM half-step Lofi groove
    transpose: [0.89, 1.0, 1.059, 0.943][Math.floor(r() * 4)],
  };
}

export class TempleMusic {
  constructor(ctx, out, send) {
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
    this.send = ctx.createGain();
    this.send.gain.value = 0.35;
    this.gain.connect(this.send);
    if (send) this.send.connect(send);

    const n = (this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)).getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    this.id = null;
    this.loops = [];
  }

  start(id, fade = 2.0) {
    const c = this.ctx, t = c.currentTime;
    this.id = id;
    this.p = presetOf(id);
    this.r = rng(hash(id));
    this.step = 0;
    this.next = t + 0.3;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(this.level ?? 0.85, t, fade / 3);
    this.startVinylAmbience();
  }

  stop(fade = 1.0) {
    if (!this.id) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0, t, fade / 3);
    const old = this.loops;
    this.loops = [];
    this.id = null;
    setTimeout(() => old.forEach((o) => { try { o.stop(); } catch {} }), (fade + 1.2) * 1000);
  }

  setLevel(v) {
    this.level = v;
    if (this.id) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.6);
  }

  schedule(until) {
    if (!this.id) return;
    const p = this.p;
    const chords = CHORD_PROGRESSIONS[p.prog];
    while (this.next < until) {
      const t = this.next;
      const k = this.step;
      const barStep = k % 8;
      const chordIdx = Math.floor(k / 8) % chords.length;
      const chord = chords[chordIdx].map((f) => f * p.transpose);

      // 1. Hợp âm Rhodes Electric Piano ấm áp vào phách đầu mỗi ô nhịp
      if (barStep === 0) {
        this.playRhodesChord(t, chord, p.beat * 7.2);
        this.playWarmBass(t, chord[0] * 0.5, p.beat * 3.8);
      } else if (barStep === 4) {
        this.playWarmBass(t, chord[0] * 0.5, p.beat * 3.5);
      }

      // 2. Tiếng gảy đàn Acoustic Guitar / Lofi Pluck rải hợp âm
      if (barStep === 2 || barStep === 5 || (barStep === 7 && this.r() < 0.65)) {
        const note = chord[Math.floor(this.r() * chord.length)] * (this.r() < 0.3 ? 2 : 1);
        this.playAcousticPluck(t, note, 0.085, p.beat * 2.2);
      }

      // 3. Nhịp trống Lofi Chill nhẹ nhàng (Soft Kick, Brush Rimshot, Shaker)
      if (barStep === 0 || barStep === 3) {
        this.playLofiKick(t, 0.14);
      }
      if (barStep === 2 || barStep === 6) {
        this.playBrushSnare(t, 0.055);
      }
      if (barStep % 2 === 1) {
        this.playHiHat(t, 0.025);
      }

      this.next += p.beat;
      this.step++;
    }
  }

  playRhodesChord(t, freqs, dur) {
    const c = this.ctx;
    freqs.forEach((f, idx) => {
      const o = c.createOscillator();
      const g = c.createGain();
      const lp = c.createBiquadFilter();
      o.type = idx === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f, t);
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1100, t);
      const peak = 0.045 / Math.sqrt(freqs.length);
      const st = t + idx * 0.025; // rải nhẹ hợp âm kiểu Jazz
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(peak, st + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(lp).connect(g).connect(this.gain);
      o.start(st);
      o.stop(st + dur + 0.05);
    });
  }

  playWarmBass(t, f, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  playAcousticPluck(t, f, v, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  playLofiKick(t, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + 0.24);
  }

  playBrushSnare(t, v) {
    const c = this.ctx;
    const n = c.createBufferSource();
    const bp = c.createBiquadFilter();
    const g = c.createGain();
    n.buffer = this.noise;
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.Q.setValueAtTime(2.2, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(bp).connect(g).connect(this.gain);
    n.start(t, Math.random());
    n.stop(t + 0.15);
  }

  playHiHat(t, v) {
    const c = this.ctx;
    const n = c.createBufferSource();
    const hp = c.createBiquadFilter();
    const g = c.createGain();
    n.buffer = this.noise;
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5200, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(hp).connect(g).connect(this.gain);
    n.start(t, Math.random());
    n.stop(t + 0.06);
  }

  startVinylAmbience() {
    const c = this.ctx, t = c.currentTime;
    const n = c.createBufferSource();
    const bp = c.createBiquadFilter();
    const g = c.createGain();
    n.buffer = this.noise;
    n.loop = true;
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.8;
    g.gain.value = 0.006; // tiếng đĩa than Vinyl Lofi rất nhẹ ấm
    n.connect(bp).connect(g).connect(this.gain);
    n.start(t);
    this.loops.push(n);
  }
}
