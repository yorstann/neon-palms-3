// Neon Palms — the car radio: three synthesised stations that only play
// while the player is driving. A lookahead scheduler drops short notes into
// the shared audio context; Q cycles stations, and the HUD toasts the name.

import { sfx } from './audio.js';

const STATIONS = [
  { name: 'Palmera FM 98.1', style: 'arp', bpm: 112, root: 220 },
  { name: 'Bassline 104.7', style: 'bass', bpm: 96, root: 55 },
  { name: 'Cielo Latino 91.3', style: 'chords', bpm: 100, root: 196 },
];
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];

export class Radio {
  constructor() {
    this.idx = -1;        // -1 = off
    this.on = false;
    this.step = 0;
    this.nextT = 0;
  }

  get station() { return this.idx >= 0 ? STATIONS[this.idx] : null; }

  /** Cycle off -> 1 -> 2 -> 3 -> off. Returns the new station name or 'Off'. */
  cycle() {
    this.idx += 1;
    if (this.idx >= STATIONS.length) this.idx = -1;
    this.step = 0;
    this.nextT = 0;
    return this.station ? this.station.name : 'Radio off';
  }

  /** Called every frame with whether the player is behind a wheel. */
  update(driving) {
    const st = this.station;
    if (!st || !driving || !sfx.ctx) return;
    const c = sfx.ctx;
    const spb = 60 / st.bpm / 2; // eighth notes
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.18) {
      this.playStep(st, this.step, this.nextT);
      this.step = (this.step + 1) % 32;
      this.nextT += spb;
    }
  }

  playStep(st, step, t) {
    const c = sfx.ctx;
    const note = (freq, dur, type, gain, when) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g); g.connect(sfx.master);
      o.start(when); o.stop(when + dur + 0.02);
    };
    const bar = Math.floor(step / 8) % 4;
    const chordRoot = st.root * [1, 0.89, 0.75, 0.84][bar];
    if (st.style === 'arp') {
      const deg = SCALE[[0, 2, 4, 1, 3, 5, 4, 2][step % 8]];
      note(chordRoot * 2 * Math.pow(2, deg / 12), 0.16, 'triangle', 0.05, t);
      if (step % 8 === 0) note(chordRoot, 0.4, 'sine', 0.06, t);
    } else if (st.style === 'bass') {
      if (step % 2 === 0) {
        const deg = [0, 0, 7, 0, 5, 0, 7, 10][(step / 2) % 8];
        note(chordRoot * 2 * Math.pow(2, deg / 12), 0.2, 'sawtooth', 0.055, t);
      }
      if (step % 4 === 2) sfx.noise(0.03, { gain: 0.012, freq: 6000, type: 'highpass', delay: t - c.currentTime });
    } else {
      if (step % 8 === 0) {
        [0, 4, 7].forEach((iv) => note(chordRoot * Math.pow(2, iv / 12), 0.85, 'triangle', 0.035, t));
      }
      if (step % 8 === 4) note(chordRoot * 2, 0.2, 'sine', 0.04, t);
    }
  }
}

export const radio = new Radio();
