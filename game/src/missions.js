// Neon Palms — Mara Voss's story: six jobs told through phone offers and
// dialogue, plus the city's side economy (taxi fares, the Shine & Go
// respray, twenty hidden packages). One generic step runner drives every
// mission kind: go, steal, checkpoints, escape, shootout, collect.

import { RESPRAY_COST, PACKAGE_COUNT } from './config.js';
import { dist } from './random.js';
import { MARA_SPOT, RESPRAY, onRoad } from './world.js';
import { createCar } from './vehicles.js';
import { startAmbush } from './combat.js';
import { sfx } from './audio.js';
import { fx } from './effects.js';

export const MISSIONS = [
  {
    title: 'First Errand', reward: 300,
    intro: ['Mara: You came. Good. I fix problems for people in this city, and today you are the solution.', 'Mara: A parcel is waiting at the Marina docks. Fetch it, bring it to me Downtown. Simple.'],
    steps: [
      { kind: 'go', x: 3140, y: 2280, label: 'Pick up the parcel at the Marina' },
      { kind: 'go', x: 1700, y: 1160, label: 'Deliver it to Mara Downtown' },
    ],
    outro: ['Mara: On time and in one piece. There may be hope for you yet.'],
  },
  {
    title: 'Borrowed Wheels', reward: 450,
    intro: ['Mara: A Vireo Coupe in Palm Beach belongs to a man who owes me. He does not know he is giving it back.', 'Mara: Take it. Deliver it to my lockup in Portside. Try not to gift-wrap it around a lamp post.'],
    steps: [
      { kind: 'steal', x: 2660, y: 1020, label: 'Steal the marked Vireo Coupe' },
      { kind: 'deliverCar', x: 740, y: 1860, label: 'Deliver the coupe to the Portside lockup' },
    ],
    outro: ['Mara: Barely a scratch. The debt is settled, and so is yours — a little.'],
  },
  {
    title: 'Checkpoint Run', reward: 500,
    intro: ['Mara: My couriers are being watched, so the route changes daily. Today the route is you.', 'Mara: Hit every checkpoint before the clock dies. The city is your shortcut.'],
    steps: [
      { kind: 'checkpoints', points: [[1220, 670], [2180, 1510], [1220, 1930], [1700, 1090]], time: 165, label: 'Hit every checkpoint' },
    ],
    outro: ['Mara: Fast and invisible. My favourite combination.'],
  },
  {
    title: 'Hot Passenger', reward: 650,
    intro: ['Mara: My cousin Lio talked to the wrong people and now the PBPD want a word. He is hiding in Old Town.', 'Mara: Pick him up, lose the heat, and put him on the Marina dock. If they are still on you at the dock, keep driving.'],
    steps: [
      { kind: 'go', x: 2180, y: 740, label: 'Pick up Lio in Old Town' },
      { kind: 'escape', x: 3140, y: 2280, label: 'Reach the Marina dock with the heat off (stars at 1 or less)' },
    ],
    outro: ['Mara: Lio sails tonight. You drive like the city owes you money.'],
  },
  {
    title: 'Dockside Ambush', reward: 800,
    intro: ['Mara: The Calle Kings think the Marina docks are theirs now. They sent flowers. Then they sent men.', 'Mara: Go down there and explain property law. Bring the pistol. Bring spare magazines.'],
    steps: [
      { kind: 'go', x: 2980, y: 2210, label: 'Go to the Marina docks' },
      { kind: 'shootout', x: 2980, y: 2210, n: 5, label: 'Clear the Calle Kings from the docks' },
    ],
    outro: ['Mara: The docks are quiet again. The Kings will remember your face — wear it proudly.'],
  },
  {
    title: 'Three Bags', reward: 1500,
    intro: ['Mara: Last job, then you are a free agent. Three bags of very persuasive money sit across the city.', 'Mara: Collect all three and bring them to my boat at the Marina. Everyone will want to stop you. Let them try.'],
    steps: [
      { kind: 'collect', points: [[1220, 320], [2660, 1440], [740, 600]], label: 'Collect the money bags' },
      { kind: 'go', x: 3220, y: 2280, label: 'Bring the bags to Mara’s boat' },
    ],
    outro: ['Mara: Palmera Bay is yours now, partner. Spend it somewhere warm.'],
  },
];

export function say(G, who, lines) {
  G.dialogue = { who, lines, i: 0, t: 0 };
  sfx.phone();
}

export function updateDialogue(G, dt, input) {
  const d = G.dialogue;
  if (!d) return;
  d.t += dt;
  if (input.hit('KeyT') || input.mouse.clicked || d.t > 4.2) {
    d.i += 1;
    d.t = 0;
    if (d.i >= d.lines.length) G.dialogue = null;
  }
}

function offerMission(G) {
  const m = MISSIONS[G.mission.idx];
  if (!m) return;
  G.mission.stage = 'offer';
  G.phone = { title: 'Mara Voss', body: `New work: “${m.title}”. Press T to take it.`, t: 9 };
  sfx.phone();
}

export function startMission(G) {
  const def = MISSIONS[G.mission.idx];
  if (!def) return;
  G.mission.stage = 'run';
  G.mission.stepIdx = 0;
  G.mission.data = {};
  say(G, 'Mara Voss', def.intro);
  setupStep(G);
}

function setupStep(G) {
  const def = MISSIONS[G.mission.idx];
  const step = def.steps[G.mission.stepIdx];
  const M = G.mission;
  M.data = {};
  if (step.kind === 'steal') {
    const car = createCar(G, 'coupe', step.x, step.y, Math.PI / 2, 'parked');
    car.hasDriver = false;
    car.color = '#c22f4e';
    M.data.car = car;
    M.target = { x: step.x, y: step.y };
  } else if (step.kind === 'checkpoints' || step.kind === 'collect') {
    M.data.pi = 0;
    M.timer = step.time || 0;
    const [x, y] = step.points[0];
    M.target = { x, y };
  } else if (step.kind === 'shootout') {
    M.target = { x: step.x, y: step.y };
    M.data.armed = false;
  } else {
    M.target = { x: step.x, y: step.y };
  }
}

function completeStep(G) {
  const def = MISSIONS[G.mission.idx];
  G.mission.stepIdx += 1;
  if (G.mission.stepIdx >= def.steps.length) {
    G.money += def.reward;
    fx.floatText(G.player.x, G.player.y - 44, `JOB DONE  +$${def.reward}`, '#7be382');
    sfx.jingle();
    say(G, 'Mara Voss', def.outro);
    G.mission.idx += 1;
    if (G.mission.idx >= MISSIONS.length) {
      G.mission.done = true;
      G.mission.stage = 'done';
      G.phone = { title: 'Mara Voss', body: 'Story complete. Palmera Bay is yours — free roam, fares and packages remain.', t: 10 };
    } else {
      G.mission.stage = 'between';
      G.mission.betweenT = 7;
    }
    G.mission.target = null;
    return;
  }
  setupStep(G);
}

function focus(G) { return G.player.inCar || G.player; }

export function updateMissions(G, dt, input) {
  const M = G.mission;
  updateDialogue(G, dt, input);
  if (G.phone) { G.phone.t -= dt; if (G.phone.t <= 0) G.phone = null; }

  if (M.stage === 'between') {
    M.betweenT -= dt;
    if (M.betweenT <= 0) offerMission(G);
    return;
  }
  if (M.stage === 'offer') {
    if (input.hit('KeyT')) startMission(G);
    return;
  }
  if (M.stage !== 'run') return;

  const def = MISSIONS[M.idx];
  const step = def.steps[M.stepIdx];
  const f = focus(G);
  const d = M.target ? dist(f.x, f.y, M.target.x, M.target.y) : Infinity;

  switch (step.kind) {
    case 'go':
      if (d < 74) completeStep(G);
      break;
    case 'steal':
      if (G.player.inCar === M.data.car) completeStep(G);
      else if (M.data.car) M.target = { x: M.data.car.x, y: M.data.car.y };
      break;
    case 'deliverCar': {
      const prev = def.steps[M.stepIdx - 1];
      void prev;
      if (d < 84 && G.player.inCar && G.player.inCar.type === 'coupe') {
        const car = G.player.inCar;
        G.player.inCar = null;
        G.player.x = car.x + 34; G.player.y = car.y;
        G.cars.splice(G.cars.indexOf(car), 1);
        completeStep(G);
      }
      break;
    }
    case 'checkpoints':
    case 'collect': {
      if (step.time) {
        M.timer -= dt;
        if (M.timer <= 0) {
          say(G, 'Mara Voss', ['Mara: Too slow. The route resets — go again, and use the alleys.']);
          setupStep(G);
          break;
        }
      }
      if (d < 78) {
        sfx.pickup();
        fx.burst(M.target.x, M.target.y, { n: 12, color: '#ffd34d', speed: 120, life: 0.4, size: 3 });
        M.data.pi += 1;
        if (M.data.pi >= step.points.length) completeStep(G);
        else {
          const [x, y] = step.points[M.data.pi];
          M.target = { x, y };
        }
      }
      break;
    }
    case 'escape':
      if (d < 84 && G.wanted.stars <= 1) completeStep(G);
      break;
    case 'shootout': {
      if (!M.data.armed && d < 300) {
        M.data.gang = startAmbush(G, step.x, step.y, step.n);
        M.data.armed = true;
        say(G, 'Calle Kings', ['Kings: Wrong dock, hero. Nobody leaves.']);
      }
      if (M.data.armed && M.data.gang.every((g) => g.dead)) completeStep(G);
      break;
    }
    default:
      break;
  }
}

/** The one-line objective the HUD shows; empty string when there is none. */
export function objectiveText(G) {
  const M = G.mission;
  if (M.stage === 'offer') return `Press T — new job from Mara Voss`;
  if (M.stage !== 'run') return '';
  const step = MISSIONS[M.idx].steps[M.stepIdx];
  let text = step.label;
  if ((step.kind === 'checkpoints' || step.kind === 'collect')) {
    text += `  (${(M.data.pi || 0) + 1}/${step.points.length})`;
    if (step.time) text += `  —  ${Math.max(0, Math.ceil(M.timer))}s`;
  }
  if (step.kind === 'escape' && G.wanted.stars > 1) text += '  —  LOSE THE HEAT FIRST';
  if (M.target) text += `  ·  ${Math.round(dist(focus(G).x, focus(G).y, M.target.x, M.target.y))}m`;
  return text;
}

/** Taxi fares, the respray garage and Mara's first offer live here too. */
export function updateSideJobs(G, dt, input) {
  const p = G.player;
  // First offer shortly after a new game starts.
  if (G.mission.stage === 'idle') {
    G.mission.idleT = (G.mission.idleT || 0) + dt;
    if (G.mission.idleT > 2.5) offerMission(G);
  }
  // Taxi fare: stop beside a hailing pedestrian while driving a cab.
  if (!G.fare && p.inCar && p.inCar.type === 'taxi' && Math.abs(p.inCar.speed) < 14) {
    for (const ped of G.peds) {
      if (ped.state === 'hail' && dist(p.x, p.y, ped.x, ped.y) < 46) {
        ped.state = 'gone';
        ped.dead = true;
        let tx = 0, ty = 0;
        for (let tries = 0; tries < 12; tries += 1) {
          tx = p.x + G.rng.range(-1000, 1000);
          ty = p.y + G.rng.range(-1000, 1000);
          if (onRoad(tx, ty)) break;
        }
        const pay = Math.round(dist(p.x, p.y, tx, ty) * 0.055) + 12;
        G.fare = { x: tx, y: ty, pay, t: 0 };
        G.phone = { title: 'Fare', body: `Take me across town — $${pay} in it for you.`, t: 5 };
        sfx.phone();
        break;
      }
    }
  }
  if (G.fare) {
    G.fare.t += dt;
    if (dist(p.x, p.y, G.fare.x, G.fare.y) < 64 && p.inCar) {
      const tip = Math.max(0, 26 - Math.floor(G.fare.t / 6));
      G.money += G.fare.pay + tip;
      G.stats.fares += 1;
      fx.floatText(p.x, p.y - 40, `FARE $${G.fare.pay} + TIP $${tip}`, '#7be382');
      sfx.cash();
      G.fare = null;
    }
  }
  // Shine & Go respray: park inside, heat gone, paint fresh.
  G.resprayCd = Math.max(0, (G.resprayCd || 0) - dt);
  if (p.inCar && G.wanted.stars > 0 && G.resprayCd <= 0) {
    if (dist(p.x, p.y, RESPRAY.x, RESPRAY.y) < RESPRAY.r && Math.abs(p.inCar.speed) < 16) {
      if (G.money >= RESPRAY_COST) {
        G.money -= RESPRAY_COST;
        G.wanted.stars = 0;
        G.wanted.reportQueue.length = 0;
        p.inCar.color = G.rng.pick(p.inCar.spec.colors);
        fx.floatText(p.x, p.y - 40, 'SHINE & GO  −$250', '#8ec9f0');
        sfx.spray();
        G.resprayCd = 5;
      } else if ((G.resprayNag || 0) <= 0) {
        fx.floatText(p.x, p.y - 40, 'SHINE & GO NEEDS $250', '#ff8a7a');
        G.resprayNag = 4;
      }
    }
  }
  G.resprayNag = Math.max(0, (G.resprayNag || 0) - dt);
  void MARA_SPOT;
}

/** Scatter the twenty hidden packages in alleys and behind buildings. */
export function seedPackages(G) {
  G.packages = [];
  let placed = 0, guard = 0;
  while (placed < PACKAGE_COUNT && guard < 900) {
    guard += 1;
    const x = G.rng.range(120, 3220);
    const y = G.rng.range(120, 2400);
    if (onRoad(x, y)) continue;
    let inside = false;
    for (const b of G.buildings) {
      if (x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6) { inside = true; break; }
    }
    if (inside) continue;
    G.packages.push({ x, y, taken: false });
    placed += 1;
  }
}
