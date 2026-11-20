// Neon Palms — all sound is synthesised with WebAudio: no audio files exist.
// One-shot effects are tiny oscillator/noise envelopes; the engine, siren and
// helicopter rotor are standing loops whose gains follow the action.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.loops = null;
  }

  /** Create the context on the first user gesture (browser autoplay rules). */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(c.destination);
    const len = c.sampleRate * 1;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.buildLoops();
  }

  setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.5; }

  tone(freq, dur, { type = 'square', gain = 0.15, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { gain = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  buildLoops() {
    const c = this.ctx;
    const mk = (type, freq) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = 0;
      o.connect(g); g.connect(this.master); o.start();
      return { o, g };
    };
    const engine = mk('sawtooth', 60);
    const engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engine.o.disconnect(); engine.o.connect(engineFilter); engineFilter.connect(engine.g);
    const siren = mk('triangle', 820);
    const sirenLfo = c.createOscillator(), sirenLfoGain = c.createGain();
    sirenLfo.frequency.value = 0.55; sirenLfoGain.gain.value = 130;
    sirenLfo.connect(sirenLfoGain); sirenLfoGain.connect(siren.o.frequency); sirenLfo.start();
    // Rotor: looped noise chopped by a 11 Hz gain LFO for the thump-thump.
    const rotorSrc = c.createBufferSource();
    rotorSrc.buffer = this.noiseBuf; rotorSrc.loop = true;
    const rotorFilter = c.createBiquadFilter();
    rotorFilter.type = 'lowpass'; rotorFilter.frequency.value = 300;
    const rotorGain = c.createGain(); rotorGain.gain.value = 0;
    const chop = c.createOscillator(), chopDepth = c.createGain();
    chop.frequency.value = 11; chopDepth.gain.value = 0.5;
    const chopBase = c.createConstantSource(); chopBase.offset.value = 0.5;
    chop.connect(chopDepth); chopDepth.connect(rotorGain.gain); chopBase.connect(rotorGain.gain);
    rotorSrc.connect(rotorFilter); rotorFilter.connect(rotorGain); rotorGain.connect(this.master);
    rotorSrc.start(); chop.start(); chopBase.start();
    this.loops = { engine, siren, rotorGain };
  }

  /** Per-frame: engine pitch from the player's speed, siren/rotor by proximity (0..1). */
  update(engineSpeed, sirenNear, rotorNear) {
    if (!this.ctx || !this.loops) return;
    const t = this.ctx.currentTime;
    const L = this.loops;
    L.engine.g.gain.setTargetAtTime(engineSpeed > 0.02 ? 0.05 : 0, t, 0.1);
    L.engine.o.frequency.setTargetAtTime(55 + engineSpeed * 165, t, 0.08);
    L.siren.g.gain.setTargetAtTime(sirenNear * 0.045, t, 0.2);
    L.rotorGain.gain.setTargetAtTime(rotorNear * 0.16, t, 0.25);
  }

  shot() { this.noise(0.14, { gain: 0.32, freq: 2600, q: 0.4 }); this.tone(150, 0.1, { type: 'triangle', gain: 0.22, slide: -90 }); }
  enemyShot() { this.noise(0.11, { gain: 0.13, freq: 2000, q: 0.5 }); }
  dryFire() { this.tone(1900, 0.03, { gain: 0.06 }); }
  reload() { this.tone(500, 0.05, { gain: 0.1 }); this.tone(320, 0.05, { gain: 0.1, delay: 0.14 }); this.tone(700, 0.05, { gain: 0.12, delay: 0.85 }); }
  hitMark() { this.tone(1250, 0.05, { gain: 0.09, type: 'sine' }); }
  hurt() { this.tone(140, 0.16, { type: 'sawtooth', gain: 0.16, slide: -60 }); }
  pickup() { this.tone(880, 0.07, { type: 'sine', gain: 0.12 }); this.tone(1320, 0.09, { type: 'sine', gain: 0.1, delay: 0.05 }); }
  cash() { this.tone(1560, 0.06, { type: 'sine', gain: 0.1 }); this.tone(2090, 0.1, { type: 'sine', gain: 0.09, delay: 0.05 }); }
  ui() { this.tone(660, 0.05, { type: 'sine', gain: 0.08 }); }
  phone() { this.tone(1046, 0.09, { type: 'sine', gain: 0.1 }); this.tone(1046, 0.09, { type: 'sine', gain: 0.1, delay: 0.16 }); }
  honk() { this.tone(370, 0.16, { type: 'square', gain: 0.05 }); this.tone(466, 0.16, { type: 'square', gain: 0.04 }); }
  crash(v = 1) { this.noise(0.22, { gain: 0.16 * v, freq: 500, q: 0.3, type: 'lowpass' }); this.tone(90, 0.18, { type: 'triangle', gain: 0.14 * v, slide: -40 }); }
  popTire() { this.noise(0.2, { gain: 0.25, freq: 900, q: 0.6 }); }
  spray() { this.noise(0.7, { gain: 0.08, freq: 3400, q: 0.4, type: 'highpass' }); }
  jingle() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, { type: 'sine', gain: 0.11, delay: i * 0.09 })); }
  sting() { this.tone(196, 0.5, { type: 'sawtooth', gain: 0.14 }); this.tone(185, 0.55, { type: 'sawtooth', gain: 0.12, delay: 0.12 }); }
}

export const sfx = new SoundBank();
