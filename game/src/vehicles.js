// Neon Palms — vehicles: arcade car physics shared by everyone, the
// lane-following traffic AI, police pursuit driving, parked cars, damage and
// collisions. Whoever is driving (player, commuter, cop) just supplies a
// {throttle, steer, brake} control each frame.

import { CAR_TYPES, AVENUES_X, STREETS_Y, LANE_OFF, ROAD_HALF, WORLD, SPIKE_SLOW_SECONDS } from './config.js';
import { clamp, lerp, angDiff, fwdX, fwdY } from './random.js';
import { onRoad, collideBuildings } from './world.js';
import { fx } from './effects.js';
import { sfx } from './audio.js';

let nextId = 1;

export function createCar(G, type, x, y, angle, role = 'traffic') {
  const spec = CAR_TYPES[type];
  const car = {
    id: nextId++, type, spec, x, y, angle, speed: 0, steerVis: 0,
    color: G.rng.pick(spec.colors), role, health: 100, wrecked: false,
    hasDriver: role === 'traffic' || role === 'police',
    ai: null, spikeT: 0, smokeT: 0, lightPhase: Math.random() * 6,
    officersOut: 0, honkT: 0, stuckT: 0, lastX: x, lastY: y,
  };
  if (role === 'traffic') car.ai = freshCruise(G, car);
  if (role === 'police') car.ai = { mode: 'pursue' };
  G.cars.push(car);
  return car;
}

function freshCruise(G, car) {
  const vertical = G.rng.chance(0.5);
  const dir = G.rng.sign();
  const ai = { mode: 'cruise', axis: vertical ? 'v' : 'h', dir, cruise: G.rng.range(118, 168), target: null, wait: 0 };
  snapToLane(car, ai);
  pickTarget(G, car, ai);
  return ai;
}

/** Place a cruising car exactly on its lane centre for its axis/direction. */
export function snapToLane(car, ai) {
  if (ai.axis === 'v') {
    const ax = AVENUES_X[nearestIdx(AVENUES_X, car.x)];
    car.x = ax + (ai.dir < 0 ? LANE_OFF : -LANE_OFF);
    car.angle = ai.dir < 0 ? -Math.PI / 2 : Math.PI / 2;
    ai.roadPos = ax;
  } else {
    const sy = STREETS_Y[nearestIdx(STREETS_Y, car.y)];
    car.y = sy + (ai.dir > 0 ? LANE_OFF : -LANE_OFF);
    car.angle = ai.dir > 0 ? 0 : Math.PI;
    ai.roadPos = sy;
  }
}

function nearestIdx(arr, v) {
  let bi = 0, bd = Infinity;
  arr.forEach((n, i) => { const d = Math.abs(n - v); if (d < bd) { bd = d; bi = i; } });
  return bi;
}

function pickTarget(G, car, ai) {
  const cross = ai.axis === 'v' ? STREETS_Y : AVENUES_X;
  const pos = ai.axis === 'v' ? car.y : car.x;
  let next = null;
  for (const c of cross) {
    if (ai.dir > 0 && c > pos + 24 && (next === null || c < next)) next = c;
    if (ai.dir < 0 && c < pos - 24 && (next === null || c > next)) next = c;
  }
  if (next === null) { // end of the road: U-turn (lane swap happens in steering)
    ai.dir *= -1;
    ai.target = ai.axis === 'v' ? { x: car.x, y: pos + ai.dir * 300 } : { x: pos + ai.dir * 300, y: car.y };
    ai.uturn = true;
    return;
  }
  ai.uturn = false;
  ai.target = ai.axis === 'v' ? { x: car.x, y: next } : { x: next, y: car.y };
}

/** At an intersection a cruising car may turn onto the crossing road. */
function maybeTurn(G, car, ai) {
  if (ai.uturn) { snapToLane(car, ai); pickTarget(G, car, ai); return; }
  if (G.rng.chance(0.62)) { pickTarget(G, car, ai); return; } // straight on
  ai.axis = ai.axis === 'v' ? 'h' : 'v';
  ai.dir = G.rng.sign();
  snapToLane(car, ai);
  pickTarget(G, car, ai);
}

function obstacleAhead(G, car, lookDist) {
  const hx = car.x + fwdX(car.angle) * lookDist;
  const hy = car.y + fwdY(car.angle) * lookDist;
  for (const other of G.cars) {
    if (other === car || other.wrecked) continue;
    if (Math.hypot(other.x - hx, other.y - hy) < 40) return other;
  }
  const p = G.player;
  if (p && !p.inCar && Math.hypot(p.x - hx, p.y - hy) < 34) return p;
  for (const rb of G.roadblocks) {
    if (Math.hypot(rb.x - hx, rb.y - hy) < 46) return rb;
  }
  return null;
}

function cruiseControl(G, car, dt) {
  const ai = car.ai;
  const t = ai.target;
  if (!t) { pickTarget(G, car, ai); return { throttle: 0, steer: 0, brake: 1 }; }
  const d = Math.hypot(t.x - car.x, t.y - car.y);
  if (d < 42) { maybeTurn(G, car, ai); return { throttle: 0.4, steer: 0, brake: 0 }; }
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  const steer = clamp(angDiff(car.angle, want) * 2.2, -1, 1);
  let throttle = car.speed < ai.cruise ? 0.75 : 0;
  let brake = 0;
  const blocked = obstacleAhead(G, car, 74);
  if (blocked) {
    throttle = 0;
    brake = car.speed > 24 ? 1 : 0;
    if (car.speed < 4) {
      ai.wait += dt;
      if (ai.wait > 1.4 && car.honkT <= 0) { car.honkT = 2.6; if (Math.hypot(car.x - G.player.x, car.y - G.player.y) < 320) sfx.honk(); }
    }
  } else ai.wait = 0;
  car.honkT -= dt;
  return { throttle, steer, brake };
}

function pursueControl(G, car, dt) {
  const f = G.player.inCar ? G.player.inCar : G.player;
  const lead = clamp(Math.hypot(f.x - car.x, f.y - car.y) / 300, 0, 0.7);
  const tx = f.x + (f.speed ? fwdX(f.angle) * f.speed * lead * 0.6 : 0);
  const ty = f.y + (f.speed ? fwdY(f.angle) * f.speed * lead * 0.6 : 0);
  const want = Math.atan2(ty - car.y, tx - car.x);
  const steer = clamp(angDiff(car.angle, want) * 2.4, -1, 1);
  const d = Math.hypot(f.x - car.x, f.y - car.y);
  let throttle = 1, brake = 0;
  if (d < 54 && Math.abs(f.speed ?? 0) < 30) { throttle = 0; brake = car.speed > 10 ? 1 : 0; } // sit on a stopped suspect
  if (Math.abs(angDiff(car.angle, want)) > 2.4 && d < 120) { throttle = 0; brake = 0.6; } // swing around
  return { throttle, steer, brake };
}

/** Shared physics: applies a control to a car, moves it, resolves collisions. */
export function stepCar(G, car, dt, ctl, isPlayer = false) {
  const spec = car.spec;
  if (car.wrecked) { car.speed = 0; return; }
  if (car.spikeT > 0) car.spikeT -= dt;
  const top = spec.top * (car.spikeT > 0 ? 0.42 : 1) * (0.45 + 0.55 * (car.health / 100));
  car.steerVis = lerp(car.steerVis, ctl.steer, 1 - Math.pow(0.0001, dt));
  const speedFac = clamp(car.speed / 110, -1, 1);
  car.angle += ctl.steer * spec.turn * dt * speedFac * (ctl.handbrake ? 1.45 : 1);
  if (car.spikeT > 0 && Math.abs(car.speed) > 30) car.angle += Math.sin(G.time * 26 + car.id) * 0.35 * dt;

  if (ctl.throttle > 0) car.speed += spec.accel * ctl.throttle * dt * clamp(1 - car.speed / (top * 1.15), 0, 1);
  if (ctl.brake > 0) {
    if (car.speed > 12) car.speed -= 400 * ctl.brake * dt;
    else car.speed = Math.max(car.speed - spec.accel * 0.55 * dt, -spec.top * 0.34);
  }
  car.speed -= car.speed * (ctl.handbrake ? 1.6 : 0.55) * dt;
  if (ctl.throttle === 0 && ctl.brake === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -spec.top * 0.36, top);

  const px = car.x, py = car.y;
  car.x += fwdX(car.angle) * car.speed * dt;
  car.y += fwdY(car.angle) * car.speed * dt;

  const impact = collideBuildings(G, car, spec.w / 2);
  if (impact > 0.25 && Math.abs(car.speed) > 60) {
    hurtCar(G, car, (Math.abs(car.speed) / 60) * impact * 7, isPlayer);
    car.speed *= -0.18;
  } else if (impact > 0.05) {
    car.speed *= 0.55;
  }
  void px; void py;

  // Skid marks and damage smoke.
  if (isPlayer && ctl.handbrake && Math.abs(car.speed) > 90) {
    fx.skid(car.x - fwdX(car.angle) * 14 + Math.cos(car.angle + Math.PI / 2) * 9, car.y - fwdY(car.angle) * 14 + Math.sin(car.angle + Math.PI / 2) * 9);
    fx.skid(car.x - fwdX(car.angle) * 14 - Math.cos(car.angle + Math.PI / 2) * 9, car.y - fwdY(car.angle) * 14 - Math.sin(car.angle + Math.PI / 2) * 9);
  }
  if (car.health < 55) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) { car.smokeT = 0.12; fx.smoke(car.x + fwdX(car.angle) * 16, car.y + fwdY(car.angle) * 16, car.health < 25); }
  }
}

export function hurtCar(G, car, dmg, byPlayer = false) {
  if (car.wrecked) return;
  car.health -= dmg;
  if (byPlayer && Math.abs(car.speed) > 40) {
    fx.burst(car.x, car.y, { n: 6, color: '#ffb84d', speed: 120, life: 0.3, size: 3 });
    sfx.crash(clamp(dmg / 14, 0.3, 1));
    G.camera.shake = Math.min(9, G.camera.shake + dmg * 0.22);
  }
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    fx.burst(car.x, car.y, { n: 26, color: '#ff7b3d', speed: 190, life: 0.7, size: 4 });
    fx.burst(car.x, car.y, { n: 14, color: '#3a3a40', speed: 70, life: 1, size: 6 });
    if (byPlayer) sfx.crash(1);
  }
}

/** Circle collisions between cars: shove apart, trade speed, dent both. */
function collideCars(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      const rr = (a.spec.w + b.spec.w) / 2 * 0.82;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const nx = dx / d, ny = dy / d;
      const aPlayer = G.player.inCar === a, bPlayer = G.player.inCar === b;
      if (!a.wrecked) { a.x -= nx * push; a.y -= ny * push; }
      if (!b.wrecked) { b.x += nx * push; b.y += ny * push; }
      const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.2;
      if (rel > 55) {
        const byPlayer = aPlayer || bPlayer;
        hurtCar(G, a, rel * 0.05, byPlayer);
        hurtCar(G, b, rel * 0.05, byPlayer);
        if (byPlayer) {
          if (a.role === 'police' || b.role === 'police') G.wanted.reportQueue.push({ level: Math.min(5, G.wanted.stars + 1), delay: 0 });
          G.camera.shake = Math.min(10, G.camera.shake + rel * 0.03);
        }
      }
      const avg = (a.speed * a.spec.mass + b.speed * b.spec.mass) / (a.spec.mass + b.spec.mass);
      if (!a.wrecked) a.speed = lerp(a.speed, avg, 0.5);
      if (!b.wrecked) b.speed = lerp(b.speed, avg, 0.5);
    }
  }
}

export function updateVehicles(G, dt, playerControl) {
  for (const car of G.cars) {
    if (car.role === 'parked' || car.wrecked) continue;
    if (G.player.inCar === car) { stepCar(G, car, dt, playerControl, true); continue; }
    if (car.role === 'traffic' && car.ai) stepCar(G, car, dt, cruiseControl(G, car, dt));
    else if (car.role === 'police') stepCar(G, car, dt, pursueControl(G, car, dt));
    // Despawn traffic that wandered to the far side of the city from the player.
    if (car.role === 'traffic') {
      const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
      if (d > 1500) { respawnTrafficNear(G, car); }
    }
  }
  collideCars(G, dt);
}

function respawnTrafficNear(G, car) {
  for (let tries = 0; tries < 8; tries += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(760, 980);
    const x = clamp(G.player.x + Math.cos(a) * d, 90, WORLD.w - 90);
    const y = clamp(G.player.y + Math.sin(a) * d, 90, WORLD.h - 90);
    if (!onRoad(x, y)) continue;
    car.x = x; car.y = y;
    car.ai = freshCruise(G, car);
    return;
  }
}

/** Seed the city with moving traffic and parked cars along the kerbs. */
export function seedTraffic(G) {
  const types = ['sedan', 'sedan', 'coupe', 'taxi', 'pickup'];
  for (let i = 0; i < 26; i += 1) {
    const vertical = G.rng.chance(0.5);
    const road = vertical ? G.rng.pick(AVENUES_X) : G.rng.pick(STREETS_Y);
    const along = G.rng.range(120, (vertical ? WORLD.h : WORLD.w) - 120);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    if (Math.hypot(x - G.player.x, y - G.player.y) < 200) continue;
    createCar(G, G.rng.pick(types), x, y, 0, 'traffic');
  }
  for (let i = 0; i < 34; i += 1) {
    const vertical = G.rng.chance(0.5);
    const road = vertical ? G.rng.pick(AVENUES_X) : G.rng.pick(STREETS_Y);
    const side = G.rng.sign();
    const along = G.rng.range(100, (vertical ? WORLD.h : WORLD.w) - 100);
    const off = ROAD_HALF - 15;
    const x = vertical ? road + side * off : along;
    const y = vertical ? along : road + side * off;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = createCar(G, G.rng.pick(types), x, y, angle, 'parked');
    car.hasDriver = false;
  }
}
