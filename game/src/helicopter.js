// Neon Palms — PBPD Air One, the police helicopter. From four stars up it
// joins the chase: it shadows the player from above, paints them with a
// searchlight cone that is unmissable at night, shows on the minimap, and
// keeps the wanted heat from cooling while its light is on you.

import { clamp, angLerp } from './random.js';

export function updateHelicopter(G, dt) {
  const H = G.heli;
  const p = G.player;
  const wanted = G.wanted.stars >= 4;
  if (wanted && !H.active) {
    H.active = true;
    H.x = p.x + G.rng.range(-500, 500);
    H.y = p.y - 620;
    H.phase = Math.random() * 6;
  }
  if (!H.active) return;
  H.phase += dt;

  if (!wanted) {
    // Called off: climb away and vanish once it is far off-screen.
    H.x += Math.cos(H.angle) * 330 * dt;
    H.y += Math.sin(H.angle) * 330 * dt;
    if (Math.hypot(H.x - p.x, H.y - p.y) > 900) H.active = false;
    return;
  }

  // Orbit a slow circle over the suspect so the light sweeps as it tracks.
  const orbit = H.phase * 0.55;
  const tx = p.x + Math.cos(orbit) * 105;
  const ty = p.y + Math.sin(orbit) * 105 - 30;
  const d = Math.hypot(tx - H.x, ty - H.y);
  const spd = clamp(d * 2.2, 60, 330);
  const want = Math.atan2(ty - H.y, tx - H.x);
  H.angle = angLerp(H.angle, want, dt * 3);
  H.x += Math.cos(want) * Math.min(spd * dt, d);
  H.y += Math.sin(want) * Math.min(spd * dt, d);

  // The light leads the player's motion a touch and trembles like a real lamp.
  const lead = p.inCar ? clamp(Math.abs(p.inCar.speed) / 300, 0, 1) * 46 : 0;
  const la = p.inCar ? p.inCar.angle : p.angle;
  H.lightX = p.x + Math.cos(la) * lead + Math.sin(H.phase * 7.3) * 7;
  H.lightY = p.y + Math.sin(la) * lead + Math.cos(H.phase * 6.1) * 7;
}

/** 0..1 rotor loudness for the audio loop, from the player's distance. */
export function rotorLevel(G) {
  if (!G.heli.active) return 0;
  const d = Math.hypot(G.heli.x - G.player.x, G.heli.y - G.player.y);
  return clamp(1 - d / 700, 0, 1);
}
