// Neon Palms — everything drawn in screen space: the HUD (health, armour,
// money, clock, wanted stars, busted meter), the live minimap, the objective
// banner, Mara's phone and dialogue, the radio toast — and the full-screen
// states: title, pause, help, busted and wasted.

import { WORLD, WATER_X, AVENUES_X, STREETS_Y, districtAt } from './config.js';
import { clamp } from './random.js';
import { RESPRAY } from './world.js';
import { objectiveText } from './missions.js';
import { radio } from './radio.js';
import { roundRect } from './render.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(10,12,18,0.62)') {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 1.5, y + 1.5, (w - 3) * clamp(frac, 0, 1), h - 3, (h - 3) / 2);
    ctx.fill();
  }
}

function star(ctx, cx, cy, r, filled, flash) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = flash ? '#ff5a4d' : '#ffb62e';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function clockText(clock) {
  const hh = Math.floor(clock / 60) % 24;
  const mm = Math.floor(clock % 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function drawMinimap(ctx, G, x, y, w, h) {
  const sx = w / WORLD.w, sy = h / WORLD.h;
  ctx.fillStyle = 'rgba(12,16,24,0.82)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.fillStyle = '#4a6b46';
  ctx.fillRect(x + WATER_X * sx, y, (WORLD.w - WATER_X) * sx, h);
  ctx.fillStyle = '#2c5d84';
  ctx.fillRect(x + 3380 * sx, y, (WORLD.w - 3380) * sx, h);
  ctx.strokeStyle = 'rgba(220,225,235,0.5)';
  ctx.lineWidth = 1;
  for (const ax of AVENUES_X) { ctx.beginPath(); ctx.moveTo(x + ax * sx, y); ctx.lineTo(x + ax * sx, y + h); ctx.stroke(); }
  for (const sy2 of STREETS_Y) { ctx.beginPath(); ctx.moveTo(x, y + sy2 * sy); ctx.lineTo(x + w, y + sy2 * sy); ctx.stroke(); }
  const dot = (wx, wy, color, r = 2.4) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2); ctx.fill(); };
  for (const pk of G.packages) if (!pk.taken) dot(pk.x, pk.y, 'rgba(255,211,77,0.8)', 1.8);
  dot(RESPRAY.x, RESPRAY.y, '#6ec8ff', 3);
  for (const c of GANG_DOTS) dot(c.x, c.y, '#b678f0', 3);
  if (G.fare) dot(G.fare.x, G.fare.y, '#7be382', 3.4);
  if (G.mission.target) {
    const t = G.mission.target;
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + t.x * sx, y + t.y * sy, 4.6 + Math.sin(G.time * 4) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const flash = Math.floor(G.time * 2.4) % 2 === 0;
  for (const car of G.cars) {
    if (car.role === 'police' || car.role === 'block') dot(car.x, car.y, flash ? '#ff5a4d' : '#4d7dff', 2.6);
  }
  for (const o of G.officers) dot(o.x, o.y, '#4d7dff', 2);
  if (G.heli.active) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('H', x + G.heli.x * sx, y + G.heli.y * sy + 3);
  }
  // The player arrow.
  const p = G.player;
  const px = x + p.x * sx, py = y + p.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -3.6);
  ctx.lineTo(-4.4, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '9px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA BAY', x + 6, y + 12);
}

const GANG_DOTS = [
  { x: 2660, y: 1930 }, { x: 3140, y: 670 }, { x: 740, y: 1930 },
];

export function drawHUD(ctx, G, w, h) {
  const p = G.player;
  ctx.textBaseline = 'alphabetic';
  // --- Top-left: vitals, money, clock. ---
  ctx.fillStyle = 'rgba(10,12,18,0.55)';
  roundRect(ctx, 14, 12, 216, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#f2f4f8';
  ctx.font = 'bold 19px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.money}`, 24, 36);
  ctx.font = '12px ' + FONT;
  ctx.fillStyle = 'rgba(240,244,248,0.85)';
  ctx.fillText(`${clockText(G.clock)}  ·  ${districtAt(p.x, p.y).name}`, 96, 36);
  bar(ctx, 24, 46, 196, 11, p.hp / 100, p.hp > 30 ? '#57c95e' : '#e5483c');
  bar(ctx, 24, 62, 196, 9, p.armor / 100, '#5e9be0');
  ctx.font = '10px ' + FONT;
  ctx.fillStyle = 'rgba(240,244,248,0.8)';
  ctx.fillText(p.inCar ? p.inCar.spec.label : 'On foot', 24, 90);
  if (p.inCar && radio.station) ctx.fillText(`♪ ${radio.station.name}`, 110, 90);

  // --- Top-right: wanted stars and the busted meter. ---
  const flash = G.wanted.unseen > 2 && Math.floor(G.time * 3) % 2 === 0;
  for (let i = 0; i < 5; i += 1) {
    star(ctx, w - 34 - (4 - i) * 34, 32, 13, i < G.wanted.stars, flash && i < G.wanted.stars);
  }
  if (G.bustedMeter > 0.1) {
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('BUSTED', w - 20, 62);
    bar(ctx, w - 190, 68, 170, 8, G.bustedMeter / 3, '#e5483c');
  }

  // --- Top-centre: objective banner. ---
  const obj = objectiveText(G);
  if (obj) {
    ctx.font = 'bold 14px ' + FONT;
    const tw = ctx.measureText(obj).width;
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    roundRect(ctx, w / 2 - tw / 2 - 14, 12, tw + 28, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.fillText(obj, w / 2, 32);
  }

  // --- Bottom-left: minimap. ---
  drawMinimap(ctx, G, 14, h - 148, 196, 134);

  // --- Bottom-right: weapon and speedo. ---
  ctx.fillStyle = 'rgba(10,12,18,0.55)';
  roundRect(ctx, w - 196, h - 84, 182, 70, 8);
  ctx.fill();
  ctx.textAlign = 'right';
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.34);
    ctx.fillStyle = '#f2f4f8';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText(`${kmh}`, w - 66, h - 34);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = 'rgba(240,244,248,0.8)';
    ctx.fillText('km/h', w - 24, h - 34);
    bar(ctx, w - 182, h - 26, 160, 6, p.inCar.health / 100, p.inCar.health > 40 ? '#57c95e' : '#e5483c');
    if (p.inCar.spikeT > 0) {
      ctx.fillStyle = '#ff8a7a';
      ctx.font = 'bold 11px ' + FONT;
      ctx.fillText('TYRES POPPED', w - 24, h - 52);
    }
  } else {
    ctx.fillStyle = '#f2f4f8';
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillText('PISTOL', w - 24, h - 52);
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(p.reloadT > 0 ? '···' : `${p.mag}`, w - 60, h - 26);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(240,244,248,0.8)';
    ctx.fillText(`/ ${p.ammo}`, w - 24, h - 26);
  }

  // --- Phone toast (top-right under the stars). ---
  if (G.phone) {
    const pw = 268;
    ctx.fillStyle = 'rgba(14,18,26,0.88)';
    roundRect(ctx, w - pw - 14, 84, pw, 64, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,227,130,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7be382';
    ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(`✆ ${G.phone.title}`, w - pw + 2, 104);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '12px ' + FONT;
    wrapText(ctx, G.phone.body, w - pw + 2, 122, pw - 16, 15, 2);
  }

  // --- Radio / event toast (centre, under the objective). ---
  if (G.toast) {
    ctx.font = 'bold 15px ' + FONT;
    const tw = ctx.measureText(G.toast.text).width;
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    roundRect(ctx, w / 2 - tw / 2 - 12, 50, tw + 24, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#aee2ff';
    ctx.textAlign = 'center';
    ctx.fillText(G.toast.text, w / 2, 69);
  }

  // --- Dialogue box (bottom centre). ---
  if (G.dialogue) {
    const d = G.dialogue;
    const bw = Math.min(620, w - 460);
    const bx = w / 2 - bw / 2, by = h - 108;
    ctx.fillStyle = 'rgba(10,12,18,0.85)';
    roundRect(ctx, bx, by, bw, 62, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,0.5)';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(d.who.toUpperCase(), bx + 14, by + 19);
    ctx.fillStyle = '#f2f4f8';
    ctx.font = '13.5px ' + FONT;
    wrapText(ctx, d.lines[d.i] || '', bx + 14, by + 38, bw - 28, 16, 2);
    ctx.fillStyle = 'rgba(240,244,248,0.55)';
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('T ▸', bx + bw - 10, by + 56);
  }

  // --- District banner. ---
  if (G.districtT > 0) {
    ctx.globalAlpha = clamp(G.districtT / 1.4, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(G.districtName.toUpperCase(), w / 2, 118);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // --- Hurt vignette. ---
  if (p.hurtT > 0 || p.hp < 30) {
    const a = Math.max(p.hurtT * 1.4, p.hp < 30 ? 0.16 + Math.sin(G.time * 5) * 0.05 : 0);
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, 'rgba(200,30,20,0)');
    grad.addColorStop(1, `rgba(200,30,20,${clamp(a, 0, 0.5)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines += 1;
      if (lines >= maxLines) return;
      line = word;
    } else line = test;
  }
  if (lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

function panel(ctx, w, h, title, titleColor, lines, prompt) {
  ctx.fillStyle = 'rgba(6,8,14,0.62)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(680, w - 80);
  const ph = 128 + lines.length * 27 + 56;
  const px = w / 2 - pw / 2, py = h / 2 - ph / 2;
  ctx.fillStyle = 'rgba(13,16,24,0.92)';
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,211,77,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText(title, w / 2, py + 64);
  ctx.font = '15.5px ' + FONT;
  lines.forEach((line, i) => {
    ctx.fillStyle = line.startsWith('—') ? '#ffd34d' : 'rgba(238,241,245,0.88)';
    ctx.fillText(line, w / 2, py + 108 + i * 27);
  });
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 16px ' + FONT;
  ctx.fillText(prompt, w / 2, py + ph - 24);
}

export function drawScreens(ctx, G, w, h, saveExists) {
  if (G.screen === 'title') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(10,8,24,0.25)');
    grad.addColorStop(0.55, 'rgba(10,8,24,0.1)');
    grad.addColorStop(1, 'rgba(10,8,24,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = 'bold 92px ' + FONT;
    ctx.fillStyle = '#ff5e8a';
    ctx.shadowColor = 'rgba(255,60,120,0.85)';
    ctx.shadowBlur = 34;
    ctx.fillText('NEON PALMS', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aee2ff';
    ctx.font = 'bold 21px ' + FONT;
    ctx.fillText('P A L M E R A   B A Y', w / 2, h * 0.3 + 40);
    ctx.fillStyle = 'rgba(238,241,245,0.92)';
    ctx.font = '15.5px ' + FONT;
    ctx.fillText('An original open-world crime story: six districts, one fixer, and every car on the street is yours to take.', w / 2, h * 0.3 + 76);
    ctx.font = 'bold 19px ' + FONT;
    ctx.fillStyle = '#ffd34d';
    ctx.fillText('ENTER — New Game', w / 2, h * 0.62);
    if (saveExists) ctx.fillText('C — Continue', w / 2, h * 0.62 + 32);
    ctx.fillStyle = 'rgba(238,241,245,0.85)';
    ctx.font = '14px ' + FONT;
    ctx.fillText('H — How to play      M — Sound on/off', w / 2, h * 0.62 + (saveExists ? 64 : 32));
    ctx.fillStyle = 'rgba(238,241,245,0.55)';
    ctx.font = '12.5px ' + FONT;
    ctx.fillText('WASD drive & walk · E enter car · mouse aim, click shoot · F shove · Q radio · T talk/accept · Esc pause', w / 2, h - 26);
    return;
  }
  if (G.screen === 'help') {
    panel(ctx, w, h, 'HOW TO PLAY', '#aee2ff', [
      'Walk and drive anywhere in Palmera Bay. Any car can be taken — E beside it.',
      'Crimes only raise your wanted stars when someone sees them. Break line of sight to cool off.',
      'At 3 stars expect roadblocks; at 4, Air One joins with its searchlight.',
      'Shine & Go resprays your car and clears the heat for $250.',
      'Work Mara Voss’s six jobs (press T when she calls), run taxi fares,',
      'fight the Calle Kings on their corners, and find 20 hidden packages.',
      '— Guns: click to shoot, R reloads. F shoves. Q works the radio. —',
    ], 'H or Esc — Back');
    return;
  }
  if (G.screen === 'pause') {
    panel(ctx, w, h, 'PAUSED', '#f2f4f8', [
      `Money $${G.money} · Jobs done ${Math.min(G.mission.idx, 6)}/6 · Packages ${G.stats.packages}/20`,
      `Cars jacked ${G.stats.jacked} · Taxi fares ${G.stats.fares} · Busted ${G.stats.busted} · Wasted ${G.stats.wasted}`,
      'Your progress saves itself as you play.',
    ], 'Esc — Resume      H — Help');
    return;
  }
  if (G.screen === 'busted') {
    const fine = Math.min(G.money, 120 + G.wanted.stars * 60);
    panel(ctx, w, h, 'BUSTED', '#ff5a4d', [
      'The PBPD walk you out of PBPD headquarters a little poorer.',
      `— Fine: $${fine} —`,
    ], 'ENTER — Back on the street');
    return;
  }
  if (G.screen === 'wasted') {
    panel(ctx, w, h, 'WASTED', '#ff5a4d', [
      'You wake up at Palmera General with a headache and a bill.',
      `— Hospital bill: $${Math.min(G.money, 200)} —`,
    ], 'ENTER — Discharge yourself');
  }
}
