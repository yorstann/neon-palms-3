// Neon Palms — the player on foot: walking and running with a mouse-facing
// stance, slipping into any car with E (politely if it's empty, by force if
// it isn't), a quick melee shove, and the health/armour model everything
// hostile aims at.

import { clamp, dist } from './random.js';
import { collideBuildings } from './world.js';
import { createPed, commitCrime, scarePeds } from './pedestrians.js';
import { fx } from './effects.js';
import { sfx } from './audio.js';

export function createPlayer(G, x, y) {
  const p = {
    x, y, angle: -Math.PI / 2, speed: 0, walkPhase: 0,
    hp: 100, armor: 0, inCar: null, dead: false,
    ammo: 48, mag: 12, fireCd: 0, reloadT: 0, muzzleT: 0, meleeCd: 0, hurtT: 0,
  };
  G.player = p;
  return p;
}

/** Damage with armour soaking the first 60% while it lasts. */
export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.dead || G.screen !== 'play') return;
  const soaked = Math.min(p.armor, dmg * 0.6);
  p.armor -= soaked;
  p.hp -= dmg - soaked;
  p.hurtT = 0.25;
  sfx.hurt();
  fx.burst(p.x, p.y, { n: 5, color: '#c93a2e', speed: 80, life: 0.3, size: 3 });
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    G.screen = 'wasted';
    G.stats.wasted += 1;
    sfx.sting();
  }
}

function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(G, car) {
  const p = G.player;
  if (car.hasDriver && car.role === 'traffic') {
    // Carjacking: the driver is hauled out and runs, and anyone watching
    // will remember it. Police cars are never simply borrowed.
    const door = createPed(G, car.x + 20, car.y + 14, 'flee');
    door.panicT = 3;
    commitCrime(G, car.x, car.y, 1);
    G.stats.jacked += 1;
    fx.floatText(car.x, car.y - 30, 'JACKED', '#ffb84d');
    sfx.crash(0.35);
  } else if (car.role === 'parked' || car.role === 'traffic') {
    G.stats.jacked += car.hasDriver ? 1 : 0;
  }
  car.hasDriver = true;
  car.role = 'player';
  p.inCar = car;
  sfx.ui();
}

function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.role = car.type === 'cruiser' ? 'police' : 'parked';
  if (car.type === 'cruiser') { car.role = 'police'; car.ai = { mode: 'pursue' }; }
  car.hasDriver = false;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  collideBuildings(G, p, 10);
  sfx.ui();
}

/**
 * Advance the player one frame. Returns the driving control for the car the
 * player sits in (main passes it to the vehicle step), or null on foot.
 */
export function updatePlayer(G, dt, input, mouseWorld) {
  const p = G.player;
  if (p.dead) return null;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.meleeCd = Math.max(0, p.meleeCd - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const take = Math.min(12 - p.mag, p.ammo);
      p.mag += take; p.ammo -= take;
    }
  }

  if (input.hit('KeyE')) {
    if (p.inCar) exitCar(G);
    else {
      const car = nearestCar(G, 58);
      if (car && car.role !== 'police') enterCar(G, car);
      else if (car && car.role === 'police' && G.wanted.stars === 0) enterCar(G, car);
    }
  }

  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    const ctl = {
      throttle: input.down('KeyW', 'ArrowUp') ? 1 : 0,
      brake: input.down('KeyS', 'ArrowDown') ? 1 : 0,
      steer: (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0),
      handbrake: input.down('Space'),
    };
    return ctl;
  }

  // On foot: move with the keys, face the mouse.
  let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const running = input.down('ShiftLeft', 'ShiftRight');
  const spd = running ? 216 : 128;
  p.speed = (mx || my) ? spd : 0;
  p.x += (mx / len) * p.speed * dt;
  p.y += (my / len) * p.speed * dt;
  p.walkPhase += dt * (running ? 11 : 8) * (p.speed ? 1 : 0);
  collideBuildings(G, p, 10);
  p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);

  // Melee shove on F (clicks are for the pistol).
  if (input.hit('KeyF') && p.meleeCd <= 0) {
    p.meleeCd = 0.38;
    const tx = p.x + Math.cos(p.angle) * 30, ty = p.y + Math.sin(p.angle) * 30;
    fx.burst(tx, ty, { n: 3, color: '#e8e3d8', speed: 60, life: 0.15, size: 2 });
    for (const ped of G.peds) {
      if (!ped.dead && dist(tx, ty, ped.x, ped.y) < 26) {
        ped.hp -= 16;
        ped.state = 'flee'; ped.panicT = 2.4;
        if (ped.hp <= 0) {
          ped.dead = true; ped.state = 'down';
          G.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: G.rng.int(5, 26), bob: 0 });
        }
        commitCrime(G, p.x, p.y, 1);
        sfx.crash(0.25);
      }
    }
    for (const g of G.gang) {
      if (!g.dead && dist(tx, ty, g.x, g.y) < 28) {
        g.hp -= 22;
        g.state = 'fight';
        fx.burst(g.x, g.y, { n: 5, color: '#b8452f', speed: 80, life: 0.25, size: 3 });
        sfx.crash(0.3);
      }
    }
    scarePeds(G, p.x, p.y, 90);
  }
  return null;
}
