// Neon Palms — pedestrians: Palmera Bay's crowd. They stroll the pavements,
// hail taxis, run from trouble, drop their wallets when knocked down, and —
// crucially — they are the city's eyes: most crimes only become wanted stars
// because a pedestrian saw them and made the call.

import { ROAD_HALF, WORLD } from './config.js';
import { clamp, angLerp } from './random.js';
import { collideBuildings, lineOfSight, onRoad } from './world.js';
import { fx } from './effects.js';
import { sfx } from './audio.js';

const SHIRTS = ['#e8e3d8', '#c94f4f', '#4f79c9', '#4fc97b', '#e0a81c', '#9b59c9', '#e87fa8', '#5ec8c0', '#333a45'];

export function createPed(G, x, y, state = 'walk') {
  const ped = {
    x, y, angle: G.rng.range(0, Math.PI * 2), speed: 0,
    state, tx: x, ty: y, wait: 0, walkPhase: Math.random() * 6,
    shirt: G.rng.pick(SHIRTS), hp: 30, callT: 0, panicT: 0, dead: false,
  };
  pickWaypoint(G, ped);
  G.peds.push(ped);
  return ped;
}

function pickWaypoint(G, ped) {
  // Stroll along the pavement: a point up to 300 away, biased to stay near roads.
  for (let tries = 0; tries < 6; tries += 1) {
    const x = clamp(ped.x + G.rng.range(-300, 300), 40, WORLD.w - 40);
    const y = clamp(ped.y + G.rng.range(-300, 300), 40, WORLD.h - 40);
    if (onRoad(x, y)) continue;
    ped.tx = x; ped.ty = y;
    return;
  }
  ped.tx = ped.x; ped.ty = ped.y;
}

/** Does any bystander (or cop) have eyes on this spot? The heart of the wanted system. */
export function witnessesSee(G, x, y, radius = 205) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius && lineOfSight(G, ped.x, ped.y, x, y)) return 'ped';
  }
  for (const car of G.cars) {
    if (car.role === 'police' && Math.hypot(car.x - x, car.y - y) < radius * 1.35) return 'police';
  }
  for (const o of G.officers) {
    if (Math.hypot(o.x - x, o.y - y) < radius * 1.2) return 'police';
  }
  if (G.heli.active && Math.hypot(G.heli.x - x, G.heli.y - y) < 330) return 'police';
  return null;
}

/**
 * Register a crime at a place. Police eyes make it instant; a pedestrian
 * witness phones it in after a short delay; unseen crimes are free.
 */
export function commitCrime(G, x, y, level) {
  const seen = witnessesSee(G, x, y);
  if (seen === 'police') G.wanted.reportQueue.push({ level, delay: 0 });
  else if (seen === 'ped') G.wanted.reportQueue.push({ level, delay: 2.2 });
  if (seen) scarePeds(G, x, y, 170);
  return seen;
}

export function scarePeds(G, x, y, radius = 200) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.panicT = G.rng.range(1.6, 3.2);
    }
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ped.walkPhase += dt * (2 + Math.abs(ped.speed) * 0.09);
    let wantSpeed = 0;
    if (ped.state === 'flee') {
      ped.panicT -= dt;
      const dx = ped.x - (G.threat?.x ?? p.x), dy = ped.y - (G.threat?.y ?? p.y);
      const d = Math.hypot(dx, dy) || 1;
      ped.tx = ped.x + (dx / d) * 120;
      ped.ty = ped.y + (dy / d) * 120;
      wantSpeed = 168;
      if (ped.panicT <= 0) { ped.state = 'walk'; pickWaypoint(G, ped); }
    } else if (ped.state === 'hail') {
      wantSpeed = 0;
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      if (!p.inCar || p.inCar.type !== 'taxi') { ped.state = 'walk'; pickWaypoint(G, ped); }
    } else {
      const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
      if (d < 12) {
        ped.wait -= dt;
        if (ped.wait <= 0) { pickWaypoint(G, ped); ped.wait = G.rng.range(0, 2.5); }
      } else wantSpeed = 74;
      // A cab with no fare makes some peds wave it down.
      if (p.inCar && p.inCar.type === 'taxi' && !G.fare && d > 12 && Math.hypot(p.x - ped.x, p.y - ped.y) < 130 && G.rng.chance(0.006)) {
        ped.state = 'hail';
      }
    }
    const wantAngle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    if (wantSpeed > 0) ped.angle = angLerp(ped.angle, wantAngle, dt * 7);
    ped.speed = wantSpeed;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    collideBuildings(G, ped, 9);

    // Run over: any fast car, including the player's, puts a ped down.
    for (const car of G.cars) {
      if (car.wrecked || Math.abs(car.speed) < 42) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < car.spec.w / 2 + 4) {
        ped.dead = true;
        ped.state = 'down';
        fx.burst(ped.x, ped.y, { n: 10, color: '#b8452f', speed: 90, life: 0.4, size: 3 });
        G.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: G.rng.int(8, 42), bob: Math.random() * 6 });
        if (car === p.inCar || car.role !== 'police') commitCrime(G, ped.x, ped.y, 2);
        if (car === p.inCar) { G.camera.shake = Math.min(8, G.camera.shake + 3); sfx.crash(0.5); }
        break;
      }
    }
  }
  // Keep the crowd topped up near the player; thin it out far away.
  if (G.peds.filter((q) => !q.dead).length < 40 && G.rng.chance(0.1)) {
    const a = G.rng.range(0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * G.rng.range(480, 640), 40, WORLD.w - 40);
    const y = clamp(p.y + Math.sin(a) * G.rng.range(480, 640), 40, WORLD.h - 40);
    if (!onRoad(x, y)) createPed(G, x, y);
  }
  G.peds = G.peds.filter((q) => !q.dead || q.state === 'down');
}

export function seedPeds(G) {
  for (let i = 0; i < 46; i += 1) {
    const x = G.rng.range(80, WORLD.w - 120);
    const y = G.rng.range(80, WORLD.h - 80);
    if (onRoad(x, y)) continue;
    let inside = false;
    for (const b of G.buildings) {
      if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) { inside = true; break; }
    }
    if (inside) continue;
    createPed(G, x, y);
  }
}
