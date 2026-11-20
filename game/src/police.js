// Neon Palms — the PBPD: turns witnessed-crime reports into wanted stars,
// keeps the right number of cruisers hunting the player, puts officers on
// foot when the chase slows down, and fills the busted meter when they get
// close. Losing line-of-sight for a while bleeds the stars away.

import { WANTED_MAX } from './config.js';
import { clamp } from './random.js';
import { onRoad, nearestRoad } from './world.js';
import { createCar } from './vehicles.js';
import { updateHelicopter } from './helicopter.js';

const CARS_BY_STARS = [0, 2, 3, 4, 5, 6];

export function policeSirenLevel(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.role !== 'police') continue;
    best = Math.min(best, Math.hypot(car.x - G.player.x, car.y - G.player.y));
  }
  return clamp(1 - best / 620, 0, 1);
}

function spawnCruiser(G) {
  for (let tries = 0; tries < 10; tries += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(560, 720);
    const x = clamp(G.player.x + Math.cos(a) * d, 80, 3520);
    const y = clamp(G.player.y + Math.sin(a) * d, 80, 2440);
    if (!onRoad(x, y)) continue;
    const snap = nearestRoad(x, y);
    const car = createCar(G, 'cruiser', snap.x, snap.y, G.rng.range(0, Math.PI * 2), 'police');
    return car;
  }
  return null;
}

function playerSeen(G) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.role === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 400) return true;
  }
  for (const o of G.officers) if (Math.hypot(o.x - p.x, o.y - p.y) < 300) return true;
  if (G.heli.active && Math.hypot(G.heli.lightX - p.x, G.heli.lightY - p.y) < 240) return true;
  return false;
}

export function updatePolice(G, dt) {
  const W = G.wanted;
  // Reports land: stars rise to the worst thing anyone phoned in.
  for (const r of W.reportQueue) r.delay -= dt;
  const ready = W.reportQueue.filter((r) => r.delay <= 0);
  W.reportQueue = W.reportQueue.filter((r) => r.delay > 0);
  for (const r of ready) W.stars = clamp(Math.max(W.stars, r.level), 0, WANTED_MAX);
  if (ready.length) W.unseen = 0;

  // Evasion: stay unseen and the heat bleeds off, one star at a time.
  if (W.stars > 0) {
    if (playerSeen(G)) W.unseen = 0;
    else {
      W.unseen = (W.unseen || 0) + dt;
      if (W.unseen > 13) { W.stars -= 1; W.unseen = 0; }
    }
  }

  // Fleet size follows the stars; extras are called off when heat drops.
  const cops = G.cars.filter((c) => c.role === 'police');
  const want = CARS_BY_STARS[W.stars];
  if (cops.length < want) spawnCruiser(G);
  for (const car of cops) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d > 1150 || (W.stars === 0 && d > 500)) {
      G.cars.splice(G.cars.indexOf(car), 1);
    }
  }

  updateOfficers(G, dt);
  updateHelicopter(G, dt);

  // The busted meter: officers on your collar, or a cruiser pinning you.
  const p = G.player;
  let pressure = 0;
  for (const o of G.officers) {
    if (Math.hypot(o.x - p.x, o.y - p.y) < 34) pressure += 1.5;
  }
  if (!p.inCar || Math.abs(p.inCar.speed) < 26) {
    for (const car of G.cars) {
      if (car.role === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 62) pressure += 0.55;
    }
  }
  if (pressure > 0) G.bustedMeter = Math.min(3, G.bustedMeter + pressure * dt);
  else G.bustedMeter = Math.max(0, G.bustedMeter - dt * 1.1);
  if (G.bustedMeter >= 3 && G.screen === 'play') {
    G.screen = 'busted';
    G.stats.busted += 1;
  }
}

function updateOfficers(G, dt) {
  const p = G.player;
  // Cruisers that have boxed the player in spill their officers.
  if (G.wanted.stars >= 1) {
    for (const car of G.cars) {
      if (car.role !== 'police' || car.wrecked || car.officersOut >= 2) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      const playerSlow = !p.inCar || Math.abs(p.inCar.speed) < 44;
      if (d < 150 && playerSlow && G.officers.length < 8) {
        car.officersOut += 1;
        G.officers.push({ x: car.x + G.rng.range(-16, 16), y: car.y + G.rng.range(-16, 16), angle: 0, carId: car.id, guard: false, walkPhase: Math.random() * 6 });
      }
    }
  }
  for (let i = G.officers.length - 1; i >= 0; i -= 1) {
    const o = G.officers[i];
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d > 900 || (G.wanted.stars === 0 && d > 260)) {
      const car = G.cars.find((c) => c.id === o.carId);
      if (car) car.officersOut = Math.max(0, car.officersOut - 1);
      G.officers.splice(i, 1);
      continue;
    }
    if (o.guard && d > 210) continue; // roadblock guards hold their line
    const spd = o.guard ? 132 : 152;
    o.angle = Math.atan2(p.y - o.y, p.x - o.x);
    if (d > 24) {
      o.x += Math.cos(o.angle) * spd * dt;
      o.y += Math.sin(o.angle) * spd * dt;
      o.walkPhase += dt * 10;
    }
  }
}

/** After a bust: fine paid, stars cleared, released at PBPD headquarters. */
export function resolveBusted(G) {
  const fine = Math.min(G.money, 120 + G.wanted.stars * 60);
  G.money -= fine;
  G.wanted.stars = 0;
  G.wanted.reportQueue.length = 0;
  G.bustedMeter = 0;
  clearPolice(G);
  return fine;
}

/** After being wasted: hospital bill, released at Palmera General. */
export function resolveWasted(G) {
  const bill = Math.min(G.money, 200);
  G.money -= bill;
  G.wanted.stars = 0;
  G.wanted.reportQueue.length = 0;
  G.bustedMeter = 0;
  clearPolice(G);
  G.player.hp = 100;
  G.player.dead = false;
  return bill;
}

function clearPolice(G) {
  G.cars = G.cars.filter((c) => c.role !== 'police' || G.player.inCar === c);
  G.officers.length = 0;
  G.heli.active = false;
  for (const c of G.cars) c.officersOut = 0;
}
