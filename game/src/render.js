// Neon Palms — the renderer: paints Palmera Bay top-down from the state —
// district ground, roads, rooftops, palms, cars with liveries, pedestrians,
// the gang, officers, Air One and its searchlight — then a day/night pass
// that lays dusk gold or night blue over everything and punches the lights
// back through. HUD and menus live in hud.js; this file is world only.

import { AVENUES_X, STREETS_Y, ROAD_HALF, WORLD, BEACH_X, WATER_X, districtAt } from './config.js';
import { clamp, lerp } from './random.js';
import { RESPRAY } from './world.js';
import { fx } from './effects.js';

/** 0 at full day, 1 at deep night, with dawn/dusk ramps. */
export function darkFactor(clock) {
  const h = clock / 60;
  if (h < 5 || h >= 21) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  if (h >= 19) return (h - 19) / 2;
  if (h >= 17.5) return (h - 17.5) / 6;
  return 0;
}

/** Warm wash strength around golden hour (for the title shot's mood). */
export function goldFactor(clock) {
  const h = clock / 60;
  if (h >= 17.2 && h <= 19.6) return Math.max(0, 1 - Math.abs(h - 18.4) / 1.2);
  if (h >= 5.8 && h <= 7.6) return Math.max(0, 0.7 * (1 - Math.abs(h - 6.7) / 0.9));
  return 0;
}

const DISTRICT_LABELS = [
  ['DOWNTOWN', 1890, 1090], ['PALM BEACH', 2950, 1300], ['MARINA', 2470, 2240],
  ['PORTSIDE', 800, 2060], ['OLD TOWN', 2880, 380], ['CORAL SUBURBS', 620, 620],
];

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, G, view) {
  ctx.fillStyle = '#87a06c';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const xs = [0, ...AVENUES_X, BEACH_X];
  const ys = [0, ...STREETS_Y, WORLD.h];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x = xs[i] + (i === 0 ? 0 : ROAD_HALF);
      const y = ys[j] + (j === 0 ? 0 : ROAD_HALF);
      const w = xs[i + 1] - (i === xs.length - 2 ? 0 : ROAD_HALF) - x;
      const h = ys[j + 1] - (j === ys.length - 2 ? 0 : ROAD_HALF) - y;
      if (x + w < view.x0 || y + h < view.y0 || x > view.x1 || y > view.y1) continue;
      ctx.fillStyle = districtAt(x + w / 2, y + h / 2).ground;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.fillStyle = '#e3cf9f';
  ctx.fillRect(BEACH_X, view.y0, WATER_X - BEACH_X, view.y1 - view.y0);
  const grad = ctx.createLinearGradient(WATER_X, 0, WORLD.w, 0);
  grad.addColorStop(0, '#3f7ea6');
  grad.addColorStop(1, '#2c5d84');
  ctx.fillStyle = grad;
  ctx.fillRect(WATER_X, view.y0, WORLD.w - WATER_X, view.y1 - view.y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = view.y0 - (view.y0 % 90); y < view.y1; y += 90) {
    const off = Math.sin(G.time * 1.3 + y * 0.05) * 9;
    ctx.moveTo(WATER_X + 16 + off, y);
    ctx.lineTo(WATER_X + 66 + off, y);
  }
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    const by = 2050 + i * 92;
    if (by < view.y0 - 60 || by > view.y1 + 60) continue;
    const bob = Math.sin(G.time * 1.1 + i * 2.2) * 2.5;
    ctx.fillStyle = '#e8e6df';
    ctx.beginPath();
    ctx.ellipse(WATER_X + 58, by + bob, 34, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d8aa0';
    ctx.fillRect(WATER_X + 40, by - 6 + bob, 22, 12);
  }
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (const [name, x, y] of DISTRICT_LABELS) {
    if (x < view.x0 - 200 || x > view.x1 + 200 || y < view.y0 - 80 || y > view.y1 + 80) continue;
    ctx.fillText(name, x, y);
  }
}

function drawRoads(ctx, G, view) {
  ctx.fillStyle = '#3a3d43';
  for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_HALF, view.y0, ROAD_HALF * 2, view.y1 - view.y0);
  for (const sy of STREETS_Y) ctx.fillRect(view.x0, sy - ROAD_HALF, view.x1 - view.x0, ROAD_HALF * 2);
  ctx.fillStyle = 'rgba(240,200,90,0.75)';
  for (const ax of AVENUES_X) {
    for (let y = view.y0 - (view.y0 % 64); y < view.y1; y += 64) ctx.fillRect(ax - 2, y, 4, 34);
  }
  for (const sy of STREETS_Y) {
    for (let x = view.x0 - (view.x0 % 64); x < view.x1; x += 64) ctx.fillRect(x, sy - 2, 34, 4);
  }
  ctx.fillStyle = 'rgba(235,235,235,0.5)';
  for (const ax of AVENUES_X) for (const sy of STREETS_Y) {
    if (ax < view.x0 - 90 || ax > view.x1 + 90 || sy < view.y0 - 90 || sy > view.y1 + 90) continue;
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillRect(ax + i * 18 - 5, sy - ROAD_HALF + 4, 10, 16);
      ctx.fillRect(ax + i * 18 - 5, sy + ROAD_HALF - 20, 10, 16);
    }
  }
}

function drawRespray(ctx, G) {
  const { x, y } = RESPRAY;
  const pulse = 0.75 + Math.sin(G.time * 3) * 0.25;
  ctx.fillStyle = '#54606e';
  roundRect(ctx, x - 58, y - 44, 116, 88, 8);
  ctx.fill();
  ctx.strokeStyle = `rgba(110,200,255,${pulse})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#dfe9f2';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHINE & GO', x, y - 6);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('respray - lose the heat', x, y + 14);
}

function drawBuildings(ctx, G, view, dark) {
  for (const b of G.buildings) {
    if (b.x + b.w < view.x0 || b.y + b.h < view.y0 || b.x > view.x1 || b.y > view.y1) continue;
    const lift = 3 + b.floors * 1.6;
    ctx.fillStyle = 'rgba(20,20,26,0.35)';
    ctx.fillRect(b.x + lift, b.y + lift, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    const n = 1 + Math.floor(b.seed * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < n; i += 1) {
      const rx = b.x + 10 + ((b.seed * 977 + i * 131) % Math.max(10, b.w - 44));
      const ry = b.y + 10 + ((b.seed * 613 + i * 197) % Math.max(10, b.h - 40));
      ctx.fillRect(rx, ry, 20, 14);
    }
    if (b.district === 'Downtown' && b.seed > 0.78 && b.w > 130 && b.h > 110) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 8);
    }
    if (dark > 0.4 && b.district === 'Downtown') {
      ctx.fillStyle = `rgba(255,205,110,${(dark - 0.4) * 0.9})`;
      const cols = Math.floor(b.w / 26);
      for (let i = 0; i < cols; i += 1) {
        if ((b.seed * 1000 + i * 7) % 3 < 1) ctx.fillRect(b.x + 8 + i * 26, b.y + b.h - 8, 9, 3);
      }
    }
  }
}

function drawProps(ctx, G, view) {
  for (const pr of G.props) {
    if (pr.x < view.x0 - 30 || pr.x > view.x1 + 30 || pr.y < view.y0 - 30 || pr.y > view.y1 + 30) continue;
    if (pr.kind === 'palm') {
      ctx.strokeStyle = '#7a5c38';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y);
      ctx.lineTo(pr.x + 4, pr.y - 7);
      ctx.stroke();
      ctx.strokeStyle = '#3f7d3a';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + pr.seed * 3;
        ctx.beginPath();
        ctx.moveTo(pr.x + 4, pr.y - 7);
        ctx.quadraticCurveTo(pr.x + 4 + Math.cos(a) * 13, pr.y - 12 + Math.sin(a) * 5, pr.x + 4 + Math.cos(a) * 19, pr.y - 4 + Math.sin(a) * 9);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#2c2f36';
      ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
    }
  }
}

function drawCar(ctx, G, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(15,15,20,0.35)';
  roundRect(ctx, -spec.w / 2 + 3, -spec.h / 2 + 4, spec.w, spec.h, 6);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#3a3a40' : car.color;
  roundRect(ctx, -spec.w / 2, -spec.h / 2, spec.w, spec.h, 6);
  ctx.fill();
  if (car.type === 'cruiser') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-spec.w * 0.18, -spec.h / 2, spec.w * 0.4, spec.h);
    ctx.fillStyle = '#eef0f2';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PBPD', 2, 3);
    const phase = Math.floor(G.time * 6 + car.lightPhase) % 2;
    ctx.fillStyle = phase ? '#ff4040' : '#7a1010';
    ctx.fillRect(-9, -spec.h / 2 + 1, 8, 5);
    ctx.fillStyle = phase ? '#10107a' : '#4040ff';
    ctx.fillRect(1, -spec.h / 2 + 1, 8, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -5, 12, 10);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2.5);
  }
  if (car.type === 'lowrider') {
    ctx.strokeStyle = '#e8c85a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-spec.w / 2 + 3, -spec.h / 2 + 3, spec.w - 6, spec.h - 6);
  }
  if (car.type === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(2, -spec.h / 2 + 3, spec.w / 2 - 5, spec.h - 6);
  }
  ctx.fillStyle = 'rgba(18,24,34,0.85)';
  roundRect(ctx, -spec.w * 0.16, -spec.h / 2 + 3, spec.w * 0.34, spec.h - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,180,220,0.5)';
  ctx.fillRect(-spec.w * 0.16, -spec.h / 2 + 4, 4, spec.h - 8);
  ctx.fillStyle = '#14151a';
  const wy = spec.h / 2 - 2;
  for (const [wx, front] of [[-spec.w / 2 + 8, false], [spec.w / 2 - 8, true]]) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(wx, s * wy);
      if (front) ctx.rotate(car.steerVis * 0.42);
      ctx.fillRect(-5, -2.5, 10, 5);
      ctx.restore();
    }
  }
  if (car.health < 70) {
    ctx.fillStyle = `rgba(20,20,20,${(70 - car.health) / 130})`;
    roundRect(ctx, -spec.w / 2, -spec.h / 2, spec.w, spec.h, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, walkPhase, shirt, skin = '#d9a066', down = false) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = shirt;
    roundRect(ctx, -10, -5, 20, 10, 4);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const step = Math.sin(walkPhase) * 4;
  ctx.fillStyle = 'rgba(15,15,20,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2e3138';
  ctx.lineWidth = 3.4;
  const px = Math.cos(angle + Math.PI / 2), py = Math.sin(angle + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(px * step, py * step + Math.abs(step) * 0.4);
  ctx.moveTo(0, 0);
  ctx.lineTo(-px * step, -py * step + Math.abs(step) * 0.4);
  ctx.stroke();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 2.5, Math.sin(angle) * 2.5, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeli(ctx, G) {
  const H = G.heli;
  ctx.fillStyle = 'rgba(10,10,14,0.3)';
  ctx.beginPath();
  ctx.ellipse(H.x + 46, H.y + 58, 30, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(H.x, H.y);
  ctx.rotate(H.angle);
  ctx.strokeStyle = '#22262e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-44, 0);
  ctx.stroke();
  ctx.fillStyle = '#2c313c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eef0f2';
  ctx.fillRect(-16, -11, 15, 22);
  ctx.fillStyle = '#8a2b20';
  ctx.font = 'bold 7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AIR ONE', -8, 2.5);
  ctx.fillStyle = 'rgba(150,190,230,0.8)';
  ctx.beginPath();
  ctx.ellipse(9, 0, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const spin = G.time * 34;
  ctx.strokeStyle = 'rgba(220,225,235,0.55)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 2; i += 1) {
    const a = spin + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * -34, Math.sin(a) * -34);
    ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,205,215,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBeacon(ctx, G, x, y, color) {
  const pulse = 0.6 + Math.sin(G.time * 4) * 0.4;
  ctx.strokeStyle = color;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 26 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createLinearGradient(0, y - 300, 0, y);
  grad.addColorStop(0, 'rgba(255,211,77,0)');
  grad.addColorStop(1, 'rgba(255,211,77,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, y - 300, 18, 300);
  ctx.globalAlpha = 1;
}

/** Paint the whole world for this frame. Camera and shake come from G. */
export function drawWorld(ctx, G, w, h) {
  const cam = G.camera;
  const shX = (Math.random() - 0.5) * cam.shake * 2;
  const shY = (Math.random() - 0.5) * cam.shake * 2;
  const view = { x0: cam.x - w / 2 - 90, y0: cam.y - h / 2 - 90, x1: cam.x + w / 2 + 90, y1: cam.y + h / 2 + 90 };
  ctx.fillStyle = '#10131c';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - cam.x + shX, h / 2 - cam.y + shY);

  const dark = darkFactor(G.clock);
  drawGround(ctx, G, view);
  drawRoads(ctx, G, view);
  drawRespray(ctx, G);
  fx.drawSkids(ctx);
  drawProps(ctx, G, view);
  drawBuildings(ctx, G, view, dark);

  for (const rb of G.roadblocks) {
    if (!rb.spike) continue;
    ctx.strokeStyle = '#22242a';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(rb.spike.x1, rb.spike.y1);
    ctx.lineTo(rb.spike.x2, rb.spike.y2);
    ctx.stroke();
    ctx.fillStyle = '#cfd4dc';
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      ctx.fillRect(lerp(rb.spike.x1, rb.spike.x2, t) - 1.5, lerp(rb.spike.y1, rb.spike.y2, t) - 1.5, 3, 3);
    }
  }

  for (const pk of G.packages) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 3;
    ctx.fillStyle = 'rgba(255,211,77,0.25)';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9971c';
    ctx.fillRect(pk.x - 7, pk.y - 6 + bob, 14, 12);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(pk.x - 7, pk.y - 2 + bob, 14, 3);
  }
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.bob) * 2.5;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2f9e57';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#bff0cd';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3.5);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#e8e8ec';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#d23b2e';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (pk.kind === 'armor') {
      ctx.fillStyle = '#3d6fb8';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, -5);
      ctx.lineTo(8, 3);
      ctx.lineTo(0, 10);
      ctx.lineTo(-8, 3);
      ctx.lineTo(-8, -5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#c96a1c';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-8, -1, 16, 2);
    }
    ctx.restore();
  }

  if (G.mission.target && (G.screen === 'play' || G.screen === 'title')) drawBeacon(ctx, G, G.mission.target.x, G.mission.target.y, '#ffd34d');
  if (G.fare) drawBeacon(ctx, G, G.fare.x, G.fare.y, '#7be382');
  if (G.wanted.stars > 0) {
    ctx.strokeStyle = 'rgba(110,200,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(RESPRAY.x, RESPRAY.y, 70 + Math.sin(G.time * 4) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const car of G.cars) {
    if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
    drawCar(ctx, G, car);
  }
  for (const ped of G.peds) {
    if (ped.x < view.x0 || ped.x > view.x1 || ped.y < view.y0 || ped.y > view.y1) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.walkPhase, ped.shirt, '#d9a066', ped.state === 'down');
    if (ped.state === 'hail') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 18 - Math.sin(G.time * 5) * 2);
    }
  }
  for (const g of G.gang) {
    if (g.x < view.x0 || g.x > view.x1 || g.y < view.y0 || g.y > view.y1) continue;
    drawPerson(ctx, g.x, g.y, g.angle, g.walkPhase, g.dead ? '#3a2a4a' : '#6d28a8', '#b98a5e', g.dead);
    if (!g.dead && g.state === 'fight') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(g.x - 14, g.y - 24, 28, 5);
      ctx.fillStyle = g.hp > 25 ? '#b678f0' : '#ff6a5e';
      ctx.fillRect(g.x - 13, g.y - 23, 26 * clamp(g.hp / 60, 0, 1), 3);
      ctx.strokeStyle = '#1c1e24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.angle) * 15, g.y + Math.sin(g.angle) * 15);
      ctx.stroke();
    }
  }
  for (const o of G.officers) {
    drawPerson(ctx, o.x, o.y, o.angle, o.walkPhase, '#26355e', '#c9a37e', false);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(o.x - 4, o.y - 9, 8, 2.6);
  }

  // The player (the car is drawn with the cars; on foot we draw the person).
  const p = G.player;
  if (p && !p.inCar) {
    drawPerson(ctx, p.x, p.y, p.angle, p.walkPhase, '#1f7d74', '#d9a066', p.dead);
    if (!p.dead) {
      ctx.strokeStyle = '#1c1e24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17);
      ctx.stroke();
      if (p.muzzleT > 0) {
        ctx.fillStyle = '#ffca6a';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Tracer bullets.
  for (const b of G.bullets) {
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,230,150,0.9)' : 'rgba(255,140,90,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.028, b.y - b.vy * 0.028);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  fx.drawParts(ctx);

  // --- Day/night wash, then the lights punched back through. ---
  const gold = goldFactor(G.clock);
  if (gold > 0) {
    ctx.fillStyle = `rgba(255,148,58,${gold * 0.16})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }
  if (dark > 0.01) {
    ctx.fillStyle = `rgba(7,10,34,${dark * 0.52})`;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Street lamps.
    for (const pr of G.props) {
      if (pr.kind !== 'lamp') continue;
      if (pr.x < view.x0 || pr.x > view.x1 || pr.y < view.y0 || pr.y > view.y1) continue;
      const rg = ctx.createRadialGradient(pr.x, pr.y, 2, pr.x, pr.y, 44);
      rg.addColorStop(0, `rgba(255,196,110,${dark * 0.20})`);
      rg.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(pr.x - 44, pr.y - 44, 88, 88);
    }
    // Headlights on moving cars.
    for (const car of G.cars) {
      if (car.wrecked || (car.role === 'parked' && car !== p.inCar)) continue;
      if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
      const fx0 = car.x + Math.cos(car.angle) * car.spec.w * 0.5;
      const fy0 = car.y + Math.sin(car.angle) * car.spec.w * 0.5;
      const tx = car.x + Math.cos(car.angle) * 118;
      const ty = car.y + Math.sin(car.angle) * 118;
      const grad = ctx.createLinearGradient(fx0, fy0, tx, ty);
      grad.addColorStop(0, `rgba(255,240,190,${dark * 0.13})`);
      grad.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx0 + Math.cos(car.angle + Math.PI / 2) * 9, fy0 + Math.sin(car.angle + Math.PI / 2) * 9);
      ctx.lineTo(tx + Math.cos(car.angle + Math.PI / 2) * 30, ty + Math.sin(car.angle + Math.PI / 2) * 30);
      ctx.lineTo(tx - Math.cos(car.angle + Math.PI / 2) * 30, ty - Math.sin(car.angle + Math.PI / 2) * 30);
      ctx.lineTo(fx0 - Math.cos(car.angle + Math.PI / 2) * 9, fy0 - Math.sin(car.angle + Math.PI / 2) * 9);
      ctx.closePath();
      ctx.fill();
    }
    // Air One's searchlight: cone plus a pool of light on the ground.
    if (G.heli.active) {
      const H = G.heli;
      const grad = ctx.createLinearGradient(H.x, H.y, H.lightX, H.lightY);
      grad.addColorStop(0, `rgba(255,246,200,${dark * 0.05 + 0.05})`);
      grad.addColorStop(1, `rgba(255,246,200,${dark * 0.22 + 0.08})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(H.x, H.y);
      const la = Math.atan2(H.lightY - H.y, H.lightX - H.x);
      ctx.lineTo(H.lightX + Math.cos(la + Math.PI / 2) * 64, H.lightY + Math.sin(la + Math.PI / 2) * 64);
      ctx.lineTo(H.lightX - Math.cos(la + Math.PI / 2) * 64, H.lightY - Math.sin(la + Math.PI / 2) * 64);
      ctx.closePath();
      ctx.fill();
      const rg = ctx.createRadialGradient(H.lightX, H.lightY, 4, H.lightX, H.lightY, 74);
      rg.addColorStop(0, `rgba(255,248,205,${dark * 0.34 + 0.1})`);
      rg.addColorStop(1, 'rgba(255,248,205,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(H.lightX - 74, H.lightY - 74, 148, 148);
    }
    ctx.restore();
  }
  // The helicopter itself rides above the night wash.
  if (G.heli.active) drawHeli(ctx, G);

  fx.drawTexts(ctx);
  ctx.restore();

  // Dusk/night grade over the whole frame for mood.
  if (gold > 0) {
    ctx.fillStyle = `rgba(255,120,40,${gold * 0.05})`;
    ctx.fillRect(0, 0, w, h);
  }
}
