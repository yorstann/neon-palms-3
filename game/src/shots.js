// Neon Palms — the four deterministic screenshot scenes behind
// ?shot=title|downtown|chase|shootout&seed=1. Each one stages the real game
// state (never a mock-up): the same entities, HUD and lighting the player
// gets, arranged so a single frame shows several systems at once.

import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { createGang } from './combat.js';
import { radio } from './radio.js';
import { fx } from './effects.js';

function placeTraffic(G, list) {
  for (const [type, x, y, angle, speed] of list) {
    const car = createCar(G, type, x, y, angle, 'traffic');
    car.speed = speed;
    car.ai = null; // staged: no AI in a still frame
  }
}

function placePeds(G, cx, cy, n) {
  for (let i = 0; i < n; i += 1) {
    let ped = null;
    for (let tries = 0; tries < 12 && !ped; tries += 1) {
      const x = cx + G.rng.range(-190, 190);
      const y = cy + G.rng.range(-150, 150);
      const inside = G.buildings.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6);
      if (!inside) ped = createPed(G, x, y);
    }
    if (ped) ped.walkPhase = G.rng.range(0, 6);
  }
}

function stageTitle(G) {
  G.clock = 18.35 * 60; // golden hour over the marina
  G.screen = 'title';
  G.player.x = 2960; G.player.y = 2180;
  G.camera.x = 2720; G.camera.y = 2060;
  placeTraffic(G, [
    ['sedan', 2634, 1780, Math.PI / 2, 120],
    ['taxi', 2790, 1956, 0, 130],
    ['coupe', 3166, 2240, -Math.PI / 2, 150],
    ['pickup', 2400, 2324, Math.PI, 90],
  ]);
  placePeds(G, 2800, 2100, 5);
}

function stageDowntown(G) {
  G.clock = 11.2 * 60;
  G.screen = 'play';
  const p = G.player;
  p.x = 1768; p.y = 1152; p.angle = -0.7;
  G.camera.x = p.x; G.camera.y = p.y;
  G.phone = { title: 'Mara Voss', body: 'New work: “First Errand”. Press T to take it.', t: 99 };
  G.mission.stage = 'offer';
  placeTraffic(G, [
    ['taxi', 1674, 950, Math.PI / 2, 120],
    ['sedan', 1560, 1064, Math.PI, 135],
    ['coupe', 1726, 1240, -Math.PI / 2, 150],
    ['sedan', 1960, 1116, 0, 0],
  ]);
  placePeds(G, p.x, p.y, 8);
}

function stageChase(G) {
  G.clock = 21.4 * 60; // deep night: the searchlight earns its keep
  G.screen = 'play';
  const p = G.player;
  const car = createCar(G, 'coupe', 1700, 1510, 0, 'player');
  car.color = '#c22f4e';
  car.speed = 302;
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  G.camera.x = car.x + 30; G.camera.y = car.y;
  G.wanted.stars = 5;
  // Pursuit, close behind with light bars strobing.
  const cop1 = createCar(G, 'cruiser', 1560, 1478, 0.06, 'police'); cop1.speed = 290;
  const cop2 = createCar(G, 'cruiser', 1500, 1552, -0.05, 'police'); cop2.speed = 284;
  const cop3 = createCar(G, 'cruiser', 1610, 1586, -0.12, 'police'); cop3.speed = 276;
  cop2.lightPhase = 2.4; cop3.lightPhase = 4.1;
  // Air One overhead, light pinned to the coupe.
  G.heli.active = true;
  G.heli.x = 1760; G.heli.y = 1420; G.heli.angle = 0.4;
  G.heli.lightX = car.x + 8; G.heli.lightY = car.y;
  // A roadblock across the street ahead, spikes on the near lane.
  const b1 = createCar(G, 'cruiser', 2075, 1493, Math.PI / 2 + 0.14, 'block'); b1.hasDriver = false;
  const b2 = createCar(G, 'cruiser', 2075, 1529, Math.PI / 2 - 0.14 + Math.PI, 'block'); b2.hasDriver = false;
  for (const [gx, gy] of [[2037, 1452], [2113, 1568]]) {
    G.officers.push({ x: gx, y: gy, angle: Math.PI, carId: 0, guard: true, walkPhase: 1 });
  }
  G.roadblocks.push({
    x: 2075, y: 1510, angle: Math.PI / 2, cars: [b1, b2], guards: [],
    spike: { x1: 2018, y1: 1466, x2: 2018, y2: 1554 }, t: 0,
  });
  // Rubber on the road behind the coupe.
  for (let i = 0; i < 16; i += 1) {
    const sx = car.x - 30 - i * 17;
    fx.skid(sx, car.y - 10);
    fx.skid(sx, car.y + 10);
  }
  radio.idx = 0;
  G.toast = { text: '♪ Palmera FM 98.1', t: 99 };
}

function stageShootout(G) {
  G.clock = 18.8 * 60; // dusk at the docks
  G.screen = 'play';
  const p = G.player;
  p.x = 2896; p.y = 2214; p.angle = 0.12;
  p.muzzleT = 0.06;
  G.camera.x = 3010; G.camera.y = 2210;
  G.mission.idx = 4;
  G.mission.stage = 'run';
  G.mission.stepIdx = 1;
  G.mission.target = { x: 2980, y: 2210 };
  G.dialogue = { who: 'Calle Kings', lines: ['Kings: Wrong dock, hero. Nobody leaves.'], i: 0, t: 0 };
  const spots = [[3078, 2152, 60], [3120, 2228, 26], [3052, 2276, 44], [3166, 2184, 60]];
  const crew = [];
  for (const [gx, gy, hp] of spots) {
    const g = createGang(G, gx, gy);
    g.state = 'fight';
    g.hp = hp;
    g.angle = Math.PI;
    crew.push(g);
  }
  const down = createGang(G, 3012, 2252);
  down.dead = true;
  G.mission.data = { armed: true, gang: crew };
  // Tracers frozen mid-flight, both ways.
  G.bullets.push({ x: 2960, y: 2218, vx: 780, vy: 40, from: 'player', life: 0.5 });
  G.bullets.push({ x: 2996, y: 2224, vx: 780, vy: 30, from: 'player', life: 0.5 });
  G.bullets.push({ x: 3030, y: 2196, vx: -640, vy: -60, from: 'gang', life: 0.5 });
  G.pickups.push({ x: 2952, y: 2268, kind: 'health', amount: 35, bob: 1 });
  G.pickups.push({ x: 3006, y: 2162, kind: 'cash', amount: 45, bob: 2 });
  placePeds(G, 2700, 2050, 3);
  placeTraffic(G, [['lowrider', 3140, 2080, -Math.PI / 2, 0]]);
}

export function stageShot(G, name) {
  if (name === 'downtown') stageDowntown(G);
  else if (name === 'chase') stageChase(G);
  else if (name === 'shootout') stageShootout(G);
  else stageTitle(G);
}
