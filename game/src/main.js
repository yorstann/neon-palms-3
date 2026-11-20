// Neon Palms — boot and the one game loop: builds Palmera Bay, runs the
// screen state machine (title, play, pause, help, busted, wasted), steps
// every system in order, keeps the camera and the audio loops in step, and
// stages the deterministic ?shot= scenes for screenshots.

import { createState, focusOf } from './state.js';
import { buildCity, HOSPITAL, POLICE_HQ, MARA_SPOT } from './world.js';
import { districtAt } from './config.js';
import { Input } from './input.js';
import { createPlayer, updatePlayer } from './player.js';
import { seedTraffic, updateVehicles } from './vehicles.js';
import { seedPeds, updatePeds } from './pedestrians.js';
import { updatePolice, policeSirenLevel, resolveBusted, resolveWasted } from './police.js';
import { rotorLevel } from './helicopter.js';
import { updateRoadblocks } from './roadblocks.js';
import { seedGang, updateCombat } from './combat.js';
import { updateMissions, updateSideJobs, seedPackages } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawScreens } from './hud.js';
import { sfx } from './audio.js';
import { radio } from './radio.js';
import { fx } from './effects.js';
import { writeSave, readSave, applySave } from './save.js';
import { stageShot } from './shots.js';
import { clamp, lerp } from './random.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = new Input(canvas);

let viewW = 1280, viewH = 720;
function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
}
window.addEventListener('resize', resize);
resize();

function buildWorld(seed) {
  const G = createState(seed);
  buildCity(G);
  createPlayer(G, MARA_SPOT.x + 60, MARA_SPOT.y + 70);
  seedTraffic(G);
  seedPeds(G);
  seedGang(G);
  seedPackages(G);
  G.mission.stage = 'idle';
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  return G;
}

let G = buildWorld(Number.isInteger(seedParam) ? seedParam : 20261);
window.__neonPalms = () => G; // live state handle, handy for automated play tests
let helpReturn = 'title';
let saveTimer = 0;

function announce(msg) { if (status) status.textContent = msg; }

function newGame() {
  G = buildWorld((Math.random() * 1e9) | 0);
  G.screen = 'play';
  G.phone = { title: 'Mara Voss', body: 'New work soon. Settle in — drive safe-ish.', t: 6 };
  sfx.ensure();
  announce('New game. Mara Voss has work for you.');
}

function continueGame() {
  const data = readSave();
  if (!data) { newGame(); return; }
  G = buildWorld((Math.random() * 1e9) | 0);
  applySave(G, data);
  G.screen = 'play';
  sfx.ensure();
  announce('Save loaded. Welcome back to Palmera Bay.');
}

function releasePlayer(x, y) {
  const p = G.player;
  if (p.inCar) {
    p.inCar.role = 'parked';
    p.inCar.hasDriver = false;
    p.inCar = null;
  }
  p.x = x; p.y = y;
  G.camera.x = x; G.camera.y = y;
}

const IDLE_CONTROL = { throttle: 0, steer: 0, brake: 0, handbrake: false };

function step(dt) {
  G.time += dt;
  G.clock = (G.clock + dt) % 1440; // one real second is one city minute
  const focus = focusOf(G);
  const mouseWorld = {
    x: G.camera.x + (input.mouse.x - viewW / 2),
    y: G.camera.y + (input.mouse.y - viewH / 2),
  };

  const control = updatePlayer(G, dt, input, mouseWorld) || IDLE_CONTROL;
  updateVehicles(G, dt, control);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateRoadblocks(G, dt);
  updateCombat(G, dt, input, mouseWorld);
  updateMissions(G, dt, input);
  updateSideJobs(G, dt, input);
  fx.update(dt);

  // Camera: follow the focus, leaning into a moving car's heading.
  const lead = focus && focus.speed ? clamp(Math.abs(focus.speed) / 300, 0, 1) * 60 : 0;
  const tx = focus.x + (focus.speed ? Math.cos(focus.angle) * lead : 0);
  const ty = focus.y + (focus.speed ? Math.sin(focus.angle) * lead : 0);
  const k = 1 - Math.pow(0.0015, dt);
  G.camera.x = lerp(G.camera.x, tx, k);
  G.camera.y = lerp(G.camera.y, ty, k);
  G.camera.shake = Math.max(0, G.camera.shake - dt * 16);

  // District banner on change.
  const dName = districtAt(focus.x, focus.y).name;
  if (dName !== G.districtName) {
    if (G.districtName) { G.districtT = 2.4; }
    G.districtName = dName;
  }
  G.districtT = Math.max(0, G.districtT - dt);

  if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }

  // Radio and sound loops.
  if (input.hit('KeyQ') && G.player.inCar) {
    G.toast = { text: `♪ ${radio.cycle()}`, t: 2.4 };
  }
  radio.update(!!G.player.inCar);
  const engineNorm = G.player.inCar ? clamp(Math.abs(G.player.inCar.speed) / G.player.inCar.spec.top, 0, 1) : 0;
  sfx.update(engineNorm, policeSirenLevel(G), rotorLevel(G));

  // Autosave while playing.
  saveTimer += dt;
  if (saveTimer > 20) { saveTimer = 0; writeSave(G); }
}

function handleScreenKeys() {
  if (input.hit('KeyM')) {
    G.muted = !G.muted;
    sfx.ensure();
    sfx.setMuted(G.muted);
    G.toast = { text: G.muted ? 'Sound off' : 'Sound on', t: 1.6 };
  }
  if (G.screen === 'title') {
    if (input.hit('Enter')) newGame();
    else if (input.hit('KeyC') && readSave()) continueGame();
    else if (input.hit('KeyH')) { helpReturn = 'title'; G.screen = 'help'; }
    return;
  }
  if (G.screen === 'help') {
    if (input.hit('KeyH') || input.hit('Escape')) G.screen = helpReturn;
    return;
  }
  if (G.screen === 'busted' || G.screen === 'wasted') {
    if (input.hit('Enter')) {
      if (G.screen === 'busted') { resolveBusted(G); releasePlayer(POLICE_HQ.x + 30, POLICE_HQ.y + 70); }
      else { resolveWasted(G); releasePlayer(HOSPITAL.x + 30, HOSPITAL.y + 70); }
      G.screen = 'play';
      sfx.ui();
    }
    return;
  }
  if (input.hit('Escape') || input.hit('KeyP')) {
    if (G.screen === 'play') { G.screen = 'pause'; writeSave(G); }
    else if (G.screen === 'pause') G.screen = 'play';
  }
  if (G.screen === 'pause' && input.hit('KeyH')) { helpReturn = 'pause'; G.screen = 'help'; }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  handleScreenKeys();
  if (G.screen === 'play') step(dt);
  else {
    G.time += dt; // keep light bars, water and rotors alive behind menus
    sfx.update(0, 0, G.screen === 'title' ? 0 : rotorLevel(G));
  }
  drawWorld(ctx, G, viewW, viewH);
  if (G.screen === 'play' || G.screen === 'pause') drawHUD(ctx, G, viewW, viewH);
  drawScreens(ctx, G, viewW, viewH, !!readSave());
  input.endFrame();
}

// --- Screenshot mode: stage one scene, paint a few frames, signal ready. ---
if (shotName) {
  G = buildWorld(Number.isInteger(seedParam) ? seedParam : 1);
  stageShot(G, shotName);
  let painted = 0;
  const paint = () => {
    G.time += 1 / 30;
    drawWorld(ctx, G, viewW, viewH);
    if (G.screen === 'play') drawHUD(ctx, G, viewW, viewH);
    drawScreens(ctx, G, viewW, viewH, false);
    painted += 1;
    if (painted < 4) requestAnimationFrame(paint);
    else { window.__SHOT_READY = true; window.__shotReady = true; }
  };
  requestAnimationFrame(paint);
} else {
  announce('Neon Palms. Press Enter to start a new game.');
  requestAnimationFrame(frame);
}
