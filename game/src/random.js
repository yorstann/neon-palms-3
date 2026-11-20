// Neon Palms — seeded randomness (mulberry32) and the small maths helpers
// every system shares. A fixed seed is what makes the screenshot scenes and
// the city layout deterministic.

export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/** Smallest signed turn from angle a to angle b, in (-PI, PI]. */
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const angLerp = (a, b, t) => a + angDiff(a, b) * clamp(t, 0, 1);

/** Forward unit vector for a heading (screen space: +x east, +y south). */
export const fwdX = (a) => Math.cos(a);
export const fwdY = (a) => Math.sin(a);
/** Right-hand unit vector for a heading; traffic lanes sit on this side. */
export const rightX = (a) => -Math.sin(a);
export const rightY = (a) => Math.cos(a);
