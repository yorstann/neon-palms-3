// Neon Palms — PBPD roadblocks. From three stars up, dispatch throws a wall
// of cruisers across the road ahead of a fleeing driver, officers standing
// guard beside them; from four stars a spike strip joins it. Ram through
// and it will cost you paint and health — or find another street.

import { SPIKE_SLOW_SECONDS, AVENUES_X } from './config.js';
import { nearestRoad } from './world.js';
import { createCar } from './vehicles.js';
import { fx } from './effects.js';
import { sfx } from './audio.js';

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function spawnBlock(G) {
  const p = G.player;
  const focus = p.inCar || p;
  const heading = focus.angle;
  const bx = focus.x + Math.cos(heading) * 480;
  const by = focus.y + Math.sin(heading) * 480;
  const snap = nearestRoad(bx, by);
  const vertical = AVENUES_X.some((ax) => Math.abs(ax - snap.x) < 4);
  const cars = [];
  const perp = vertical ? 0 : Math.PI / 2; // direction across the road
  for (let i = -1; i <= 1; i += 2) {
    const cx = snap.x + (vertical ? i * 17 : i * 8);
    const cy = snap.y + (vertical ? i * 8 : i * 17);
    const car = createCar(G, 'cruiser', cx, cy, perp + (i > 0 ? 0.16 : -0.16 + Math.PI), 'block');
    car.hasDriver = false;
    cars.push(car);
  }
  const guards = [];
  for (let i = -1; i <= 1; i += 2) {
    const o = {
      x: snap.x + (vertical ? i * 44 : 0), y: snap.y + (vertical ? 0 : i * 44),
      angle: heading + Math.PI, carId: 0, guard: true, walkPhase: 0,
    };
    G.officers.push(o);
    guards.push(o);
  }
  let spike = null;
  if (G.wanted.stars >= 4) {
    const off = 58;
    spike = vertical
      ? { x1: snap.x - 46, y1: snap.y - off, x2: snap.x + 46, y2: snap.y - off }
      : { x1: snap.x - off, y1: snap.y - 46, x2: snap.x - off, y2: snap.y + 46 };
  }
  G.roadblocks.push({ x: snap.x, y: snap.y, angle: perp, cars, guards, spike, t: 0 });
}

function clearBlock(G, block) {
  for (const car of block.cars) {
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  for (const o of block.guards) {
    const i = G.officers.indexOf(o);
    if (i >= 0) G.officers.splice(i, 1);
  }
  G.roadblocks.splice(G.roadblocks.indexOf(block), 1);
}

export function updateRoadblocks(G, dt) {
  G.rbTimer = Math.max(0, (G.rbTimer ?? 14) - dt);
  const stars = G.wanted.stars;
  if (stars >= 3 && G.roadblocks.length === 0 && G.rbTimer <= 0) spawnBlock(G);

  for (let i = G.roadblocks.length - 1; i >= 0; i -= 1) {
    const block = G.roadblocks[i];
    block.t += dt;
    const d = Math.hypot(block.x - G.player.x, block.y - G.player.y);
    if (block.t > 34 || d > 880 || stars === 0) {
      clearBlock(G, block);
      G.rbTimer = 15;
      continue;
    }
    // Spike strip: anything fast and not police-owned loses its tyres.
    if (block.spike) {
      for (const car of G.cars) {
        if (car.role === 'police' || car.role === 'block' || car.spikeT > 0 || Math.abs(car.speed) < 46) continue;
        const s = block.spike;
        if (segDist(car.x, car.y, s.x1, s.y1, s.x2, s.y2) < 17) {
          car.spikeT = SPIKE_SLOW_SECONDS;
          fx.burst(car.x, car.y, { n: 8, color: '#d8d8de', speed: 90, life: 0.3, size: 2 });
          if (car === G.player.inCar) { sfx.popTire(); fx.floatText(car.x, car.y - 34, 'TYRES POPPED', '#ff8a7a'); }
        }
      }
    }
  }
}
