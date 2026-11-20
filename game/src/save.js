// Neon Palms — localStorage save/continue: money, story progress, packages
// found and where the player left off. Deliberately forgiving: a missing or
// corrupt save just means "no save", never a crash.

import { SAVE_KEY } from './config.js';

export function writeSave(G) {
  try {
    const p = G.player;
    const data = {
      money: G.money,
      missionIdx: G.mission.idx,
      missionDone: G.mission.done,
      packages: G.packages.map((pk) => (pk.taken ? 1 : 0)),
      packagesFound: G.stats.packages,
      jacked: G.stats.jacked,
      fares: G.stats.fares,
      x: Math.round(p.x), y: Math.round(p.y),
      clock: Math.round(G.clock),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage off (private mode): the run simply is not kept */ }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch { return null; }
}

export function applySave(G, data) {
  G.money = data.money;
  G.mission.idx = Math.min(data.missionIdx ?? 0, 6);
  G.mission.done = !!data.missionDone;
  G.mission.stage = G.mission.done ? 'done' : 'offer';
  if (Array.isArray(data.packages)) {
    data.packages.forEach((v, i) => { if (G.packages[i]) G.packages[i].taken = !!v; });
  }
  G.stats.packages = data.packagesFound ?? 0;
  G.stats.jacked = data.jacked ?? 0;
  G.stats.fares = data.fares ?? 0;
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    G.player.x = data.x; G.player.y = data.y;
  }
  if (typeof data.clock === 'number') G.clock = data.clock;
}

export function hasSave() { return readSave() !== null; }
