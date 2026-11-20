// Neon Palms — transient visual juice: particles (sparks, smoke, muzzle
// smoke, splashes of cash-green), skid marks burned into the asphalt, and
// floating text for money and events. Purely cosmetic; nothing reads it back.

import { clamp } from './random.js';

export class Effects {
  constructor() {
    this.parts = [];
    this.skids = [];
    this.texts = [];
  }

  burst(x, y, { n = 10, color = '#ffd34d', speed = 130, life = 0.5, size = 3, gravity = 0 } = {}) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.8), max: life, color, size: size * (0.6 + Math.random() * 0.8), gravity });
    }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }

  smoke(x, y, dark = false) {
    this.parts.push({ x, y, vx: (Math.random() - 0.5) * 22, vy: -34 - Math.random() * 26, life: 1.1, max: 1.1, color: dark ? 'rgba(40,40,44,0.5)' : 'rgba(190,190,195,0.4)', size: 7 + Math.random() * 7, gravity: -12, smoke: true });
  }

  muzzle(x, y, angle) {
    const mx = x + Math.cos(angle) * 20, my = y + Math.sin(angle) * 20;
    this.burst(mx, my, { n: 4, color: '#ffca6a', speed: 60, life: 0.09, size: 4 });
    this.parts.push({ x: mx, y: my, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30, life: 0.07, max: 0.07, color: '#fff3c4', size: 8 });
  }

  skid(x, y) {
    this.skids.push({ x, y, t: 14 });
    if (this.skids.length > 1400) this.skids.splice(0, this.skids.length - 1400);
  }

  floatText(x, y, text, color = '#7be382') {
    this.texts.push({ x, y, text, color, t: 1.4 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      if (p.smoke) { p.vx *= 0.98; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const s of this.skids) s.t -= dt;
    this.skids = this.skids.filter((s) => s.t > 0);
    for (const t of this.texts) { t.t -= dt; t.y -= 26 * dt; }
    this.texts = this.texts.filter((t) => t.t > 0);
  }

  drawSkids(ctx) {
    ctx.fillStyle = 'rgba(18,18,20,0.4)';
    for (const s of this.skids) {
      ctx.globalAlpha = clamp(s.t / 6, 0, 0.4);
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  drawParts(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      const s = p.smoke ? p.size * (1.6 - p.life / p.max) : p.size;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.t, 0, 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

export const fx = new Effects();
