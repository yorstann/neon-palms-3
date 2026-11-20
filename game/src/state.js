// Neon Palms — the whole mutable game state in one object, built fresh for
// each run. Systems import helpers, never each other's state: everything
// shared lives here so a screenshot scene can stage a world by filling fields.

import { Rng } from './random.js';

export function createState(seed) {
  return {
    rng: new Rng(seed),
    seed,
    screen: 'title',        // title | play | pause | help | busted | wasted
    time: 0,                // seconds since boot (drives blink phases)
    clock: 10 * 60,         // minutes into the day; 1 real second = 1 game minute
    camera: { x: 1800, y: 1260, shake: 0 },
    player: null,
    cars: [],               // every vehicle: traffic, parked, police, the player's ride
    peds: [],
    officers: [],           // police on foot
    gang: [],               // Calle Kings members (corner crews + mission ambush)
    bullets: [],
    pickups: [],            // {x,y,kind:'cash'|'health'|'armor'|'ammo', amount, bob}
    packages: [],           // hidden parcels {x,y,taken}
    buildings: [],
    props: [],              // palms and lamps {x,y,kind}
    roadblocks: [],         // active PBPD roadblocks
    heli: { active: false, x: 0, y: 0, angle: 0, phase: 0, lightX: 0, lightY: 0 },
    wanted: { stars: 0, heat: 0, decay: 0, reportQueue: [] },
    bustedMeter: 0,
    money: 120,
    stats: { jacked: 0, fares: 0, packages: 0, busted: 0, wasted: 0 },
    mission: { idx: 0, stage: 'offer', target: null, timer: 0, data: {}, done: false },
    fare: null,             // active taxi fare {x,y,tx,ty,tip}
    dialogue: null,         // {who, lines:[], i, t}
    phone: null,            // {title, body, t} toast from Mara
    toast: null,            // {text, t} centre-screen note (radio station, pickups)
    districtName: '',
    districtT: 0,
    muted: false,
  };
}

/** The entity the camera and most systems care about: the player or their car. */
export function focusOf(G) {
  const p = G.player;
  if (p && p.inCar) return p.inCar;
  return p;
}
