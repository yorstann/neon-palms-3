// Neon Palms — gun combat: the player's pistol (mouse aim, magazine,
// reload), tracer bullets that respect walls, and the Calle Kings, a rival
// gang who hold street corners, shoot back when provoked, and star in one
// of Mara's missions. Health, armour and ammo pickups drop from the fallen.

import { PISTOL, GANG_GUN } from './config.js';
import { clamp, dist } from './random.js';
import { lineOfSight, collideBuildings } from './world.js';
import { hurtPlayer } from './player.js';
import { commitCrime, scarePeds } from './pedestrians.js';
import { hurtCar } from './vehicles.js';
import { fx } from './effects.js';
import { sfx } from './audio.js';

export const GANG_CORNERS = [
  { x: 2660, y: 1930, name: 'Palm Beach corner' },
  { x: 3140, y: 670, name: 'Old Town corner' },
  { x: 740, y: 1930, name: 'Portside corner' },
];

export function createGang(G, x, y, corner = null) {
  const g = {
    x, y, angle: G.rng.range(0, Math.PI * 2), hp: 60, dead: false,
    state: 'idle', fireCd: G.rng.range(0.2, 1), strafe: G.rng.sign(),
    strafeT: G.rng.range(1, 2.4), calmT: 0, corner, walkPhase: Math.random() * 6,
  };
  G.gang.push(g);
  return g;
}

export function seedGang(G) {
  for (const c of GANG_CORNERS) {
    for (let i = 0; i < 3; i += 1) {
      createGang(G, c.x + G.rng.range(-64, 64), c.y + G.rng.range(-64, 64), c);
    }
  }
}

/** A mission ambush: n Kings already shooting, ringed around a point. */
export function startAmbush(G, x, y, n) {
  const spawned = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + G.rng.range(-0.3, 0.3);
    const g = createGang(G, x + Math.cos(a) * G.rng.range(110, 170), y + Math.sin(a) * G.rng.range(110, 170));
    g.state = 'fight';
    spawned.push(g);
  }
  return spawned;
}

export function aggroCorner(G, corner) {
  for (const g of G.gang) if (g.corner === corner && !g.dead) g.state = 'fight';
}

function dropPickup(G, x, y) {
  const roll = G.rng.next();
  if (roll < 0.42) G.pickups.push({ x, y, kind: 'cash', amount: G.rng.int(20, 65), bob: 0 });
  else if (roll < 0.66) G.pickups.push({ x, y, kind: 'health', amount: 35, bob: 0 });
  else if (roll < 0.84) G.pickups.push({ x, y, kind: 'armor', amount: 50, bob: 0 });
  else G.pickups.push({ x, y, kind: 'ammo', amount: 24, bob: 0 });
}

function fireBullet(G, from, x, y, angle, speed = 780) {
  G.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, from, life: 0.62 });
}

function playerShoot(G, mouseWorld) {
  const p = G.player;
  if (p.reloadT > 0 || p.fireCd > 0) return;
  if (p.mag <= 0) {
    sfx.dryFire();
    p.fireCd = 0.3;
    startReload(G);
    return;
  }
  p.mag -= 1;
  p.fireCd = PISTOL.rate;
  p.muzzleT = 0.06;
  const angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x) + G.rng.range(-PISTOL.spread, PISTOL.spread);
  fireBullet(G, 'player', p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16, angle);
  fx.muzzle(p.x, p.y, angle);
  sfx.shot();
  G.threat = { x: p.x, y: p.y };
  scarePeds(G, p.x, p.y, 230);
  if ((G.lastCrimeT ?? 0) <= 0) { commitCrime(G, p.x, p.y, 2); G.lastCrimeT = 2.5; }
  G.camera.shake = Math.min(6, G.camera.shake + 0.7);
  if (p.mag === 0) startReload(G);
}

export function startReload(G) {
  const p = G.player;
  if (p.reloadT > 0 || p.mag >= 12 || p.ammo <= 0) return;
  p.reloadT = PISTOL.reload;
  sfx.reload();
}

function gangShoot(G, g) {
  const p = G.player;
  const base = Math.atan2(p.y - g.y, p.x - g.x);
  const angle = base + G.rng.range(-0.09, 0.09);
  fireBullet(G, 'gang', g.x + Math.cos(base) * 15, g.y + Math.sin(base) * 15, angle, 640);
  fx.muzzle(g.x, g.y, base);
  sfx.enemyShot();
  G.threat = { x: g.x, y: g.y };
}

function updateGang(G, dt) {
  const p = G.player;
  for (const g of G.gang) {
    if (g.dead) continue;
    collideBuildings(G, g, 10);
    const d = dist(g.x, g.y, p.x, p.y);
    // Run down by any car: down, and the corner remembers it.
    for (const car of G.cars) {
      if (Math.abs(car.speed) > 40 && Math.hypot(car.x - g.x, car.y - g.y) < car.spec.w / 2 + 4) {
        g.dead = true;
        dropPickup(G, g.x, g.y);
        if (g.corner) aggroCorner(G, g.corner);
        if (car === p.inCar) commitCrime(G, g.x, g.y, 2);
        break;
      }
    }
    if (g.dead) continue;
    if (g.state !== 'fight') {
      g.angle += Math.sin(G.time * 0.7 + g.walkPhase) * dt * 0.4;
      if (d < 120 && G.wanted.stars >= 2) { g.state = 'fight'; }
      continue;
    }
    // Fighting: keep a firing distance, strafe, shoot when the line is clear.
    g.calmT = d > 460 ? g.calmT + dt : 0;
    if (g.calmT > 4) { g.state = 'idle'; g.calmT = 0; continue; }
    const toP = Math.atan2(p.y - g.y, p.x - g.x);
    g.angle = toP;
    g.strafeT -= dt;
    if (g.strafeT <= 0) { g.strafe *= -1; g.strafeT = G.rng.range(0.8, 2); }
    let mx = 0, my = 0;
    const perp = toP + Math.PI / 2;
    mx += Math.cos(perp) * g.strafe * 0.8;
    my += Math.sin(perp) * g.strafe * 0.8;
    if (d > 200) { mx += Math.cos(toP); my += Math.sin(toP); }
    if (d < 110) { mx -= Math.cos(toP); my -= Math.sin(toP); }
    const ml = Math.hypot(mx, my) || 1;
    g.x += (mx / ml) * 96 * dt;
    g.y += (my / ml) * 96 * dt;
    g.walkPhase += dt * 9;
    g.fireCd -= dt;
    if (g.fireCd <= 0 && d < GANG_GUN.range && lineOfSight(G, g.x, g.y, p.x, p.y)) {
      gangShoot(G, g);
      g.fireCd = GANG_GUN.rate * G.rng.range(0.8, 1.35);
    }
  }
}

function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const bd of G.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          fx.burst(b.x, b.y, { n: 3, color: '#ffd34d', speed: 70, life: 0.2, size: 2 });
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const g of G.gang) {
        if (g.dead || Math.hypot(g.x - b.x, g.y - b.y) > 13) continue;
        g.hp -= PISTOL.damage;
        g.state = 'fight';
        if (g.corner) aggroCorner(G, g.corner);
        fx.burst(g.x, g.y, { n: 6, color: '#c93a2e', speed: 90, life: 0.3, size: 3 });
        sfx.hitMark();
        if (g.hp <= 0) {
          g.dead = true;
          dropPickup(G, g.x, g.y);
          fx.floatText(g.x, g.y - 22, 'KING DOWN', '#c99df0');
          commitCrime(G, g.x, g.y, 2);
        }
        dead = true;
        break;
      }
      if (!dead) {
        for (const car of G.cars) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < car.spec.w / 2) {
            hurtCar(G, car, 6, false);
            if (car.role === 'police') G.wanted.reportQueue.push({ level: 3, delay: 0 });
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'gang') {
      const target = p.inCar || p;
      const rr = p.inCar ? p.inCar.spec.w / 2 : 12;
      if (Math.hypot(target.x - b.x, target.y - b.y) < rr) {
        if (p.inCar) hurtCar(G, p.inCar, 4, false);
        else hurtPlayer(G, GANG_GUN.damage);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += dt * 3;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) > 30) continue;
    if (pk.kind === 'cash') { G.money += pk.amount; fx.floatText(p.x, p.y - 26, `+$${pk.amount}`); sfx.cash(); }
    else if (pk.kind === 'health') { p.hp = clamp(p.hp + pk.amount, 0, 100); fx.floatText(p.x, p.y - 26, '+HEALTH', '#7be382'); sfx.pickup(); }
    else if (pk.kind === 'armor') { p.armor = clamp(p.armor + pk.amount, 0, 100); fx.floatText(p.x, p.y - 26, '+ARMOUR', '#8ec9f0'); sfx.pickup(); }
    else if (pk.kind === 'ammo') { p.ammo += pk.amount; fx.floatText(p.x, p.y - 26, '+AMMO', '#ffd34d'); sfx.pickup(); }
    G.pickups.splice(i, 1);
  }
  // Hidden packages are pickups with better PR.
  for (const pk of G.packages) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      G.stats.packages += 1;
      G.money += 150;
      fx.floatText(p.x, p.y - 30, `PACKAGE ${G.stats.packages}/20  +$150`, '#ffd34d');
      fx.burst(pk.x, pk.y, { n: 14, color: '#ffd34d', speed: 110, life: 0.5, size: 3 });
      sfx.jingle();
    }
  }
}

export function updateCombat(G, dt, input, mouseWorld) {
  G.lastCrimeT = Math.max(0, (G.lastCrimeT ?? 0) - dt);
  const p = G.player;
  if (!p.inCar && G.screen === 'play') {
    if (input.mouse.down) playerShoot(G, mouseWorld);
    if (input.hit('KeyR')) startReload(G);
  }
  updateGang(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
}
