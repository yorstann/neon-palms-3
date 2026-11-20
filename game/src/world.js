// Neon Palms — Palmera Bay itself: generates the road grid's buildings, palms
// and lamps from the seeded RNG, and answers the spatial questions every
// system asks (is this asphalt? which lane? what did I just bump into?).

import { AVENUES_X, STREETS_Y, ROAD_HALF, LANE_OFF, SIDEWALK, WORLD, BEACH_X, WATER_X, districtAt } from './config.js';
import { clamp } from './random.js';

const ROOFS = {
  'Downtown':      ['#5b6472', '#4a5160', '#68707e', '#3f4654'],
  'Old Town':      ['#8a6f52', '#77593f', '#96795c'],
  'Palm Beach':    ['#d9cfc0', '#cbb9a4', '#e6ddcf'],
  'Marina':        ['#7d8894', '#6b7683', '#939ea9'],
  'Portside':      ['#6e6257', '#7c6f60', '#5d5348'],
  'Coral Suburbs': ['#a8583f', '#96604a', '#b06a4a', '#8a5a44'],
};

/** True when the point sits on asphalt (either road direction, not water). */
export function onRoad(x, y) {
  if (x >= WATER_X || y < 0 || y >= WORLD.h) return false;
  for (const rx of AVENUES_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of STREETS_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function onWater(x, y) { return x >= WATER_X; }
export function onSand(x, y) { return x >= BEACH_X && x < WATER_X; }

/** Nearest road centre line point, for spawning and AI snapping. */
export function nearestRoad(x, y) {
  let best = { x, y, d: Infinity, vertical: true };
  for (const rx of AVENUES_X) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { x: rx, y, d, vertical: true };
  }
  for (const ry of STREETS_Y) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { x, y: ry, d, vertical: false };
  }
  return best;
}

/** Lane centre for a heading along a road: right-hand traffic offset. */
export function lanePoint(cx, cy, heading) {
  return { x: cx + -Math.sin(heading) * LANE_OFF, y: cy + Math.cos(heading) * LANE_OFF };
}

function addBuilding(G, x, y, w, h, district) {
  const rng = G.rng;
  const tall = district === 'Downtown' ? rng.range(3, 9) : district === 'Palm Beach' ? rng.range(2, 5) : 1;
  G.buildings.push({
    x, y, w, h, district,
    roof: rng.pick(ROOFS[district] || ROOFS['Downtown']),
    floors: tall,
    seed: rng.next(),
  });
}

/**
 * Fill every block (the rectangles between roads) with buildings suited to
 * its district, ring the beach with palms, and line the avenues with lamps.
 */
export function buildCity(G) {
  const rng = G.rng;
  G.buildings.length = 0;
  G.props.length = 0;

  const xEdges = [70, ...AVENUES_X, BEACH_X - 40];
  const yEdges = [60, ...STREETS_Y, WORLD.h - 60];
  for (let xi = 0; xi < xEdges.length - 1; xi += 1) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 1) {
      const insetL = xi === 0 ? 0 : ROAD_HALF + SIDEWALK;
      const insetR = xi === xEdges.length - 2 ? 0 : ROAD_HALF + SIDEWALK;
      const insetT = yi === 0 ? 0 : ROAD_HALF + SIDEWALK;
      const insetB = yi === yEdges.length - 2 ? 0 : ROAD_HALF + SIDEWALK;
      const bx = xEdges[xi] + insetL;
      const by = yEdges[yi] + insetT;
      const bw = xEdges[xi + 1] - insetR - bx;
      const bh = yEdges[yi + 1] - insetB - by;
      if (bw < 90 || bh < 80) continue;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const district = districtAt(cx, cy).name;
      if (district === 'Coral Suburbs') {
        // Four to six little houses with gaps a player can slip through.
        const cols = 2, rows = rng.int(2, 3);
        const hw = (bw - 30) / cols - 16, hh = (bh - 30) / rows - 16;
        for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
          if (rng.chance(0.12)) continue;
          addBuilding(G, bx + 15 + c * (hw + 16), by + 15 + r * (hh + 16), hw, hh, district);
        }
      } else if (district === 'Portside' || district === 'Marina') {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i += 1) {
          addBuilding(G, bx + 12 + i * (bw / n), by + 14, bw / n - 24, bh - 28, district);
        }
      } else if (district === 'Downtown') {
        addBuilding(G, bx + 10, by + 10, bw - 20, bh - 20, district);
        if (bw > 300 && rng.chance(0.5)) addBuilding(G, bx + bw / 2 + 6, by + 14, bw / 2 - 26, bh - 28, district);
      } else {
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i += 1) {
          addBuilding(G, bx + 12 + i * (bw / n), by + 12 + rng.range(0, 18), bw / n - 24, bh - 30, district);
        }
      }
    }
  }

  // Palms along the beach and scattered through the suburbs and beachfront.
  for (let y = 120; y < WORLD.h - 80; y += rng.range(90, 170)) {
    G.props.push({ x: BEACH_X + rng.range(14, 60), y, kind: 'palm', seed: rng.next() });
  }
  for (let i = 0; i < 90; i += 1) {
    const x = rng.range(90, BEACH_X - 60), y = rng.range(90, WORLD.h - 90);
    if (onRoad(x, y) || rng.chance(0.6)) continue;
    G.props.push({ x, y, kind: 'palm', seed: rng.next() });
  }
  // Street lamps at intersections and mid-block along every road.
  for (const rx of AVENUES_X) for (let y = 130; y < WORLD.h; y += 300) G.props.push({ x: rx - ROAD_HALF - 8, y, kind: 'lamp', seed: 0 });
  for (const ry of STREETS_Y) for (let x = 160; x < BEACH_X; x += 300) G.props.push({ x, y: ry - ROAD_HALF - 8, kind: 'lamp', seed: 0 });
}

/** Push a circle (entity) out of every building it overlaps; returns impact speed factor 0..1. */
export function collideBuildings(G, e, r) {
  let impact = 0;
  for (const b of G.buildings) {
    const nx = clamp(e.x, b.x, b.x + b.w);
    const ny = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - nx, dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = nx + (dx / d) * r;
      e.y = ny + (dy / d) * r;
      impact = Math.max(impact, 1 - d / r);
    } else {
      // Centre inside the box: leave by the shallowest face.
      const left = e.x - b.x, right = b.x + b.w - e.x, top = e.y - b.y, bot = b.y + b.h - e.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) e.x = b.x - r; else if (m === right) e.x = b.x + b.w + r;
      else if (m === top) e.y = b.y - r; else e.y = b.y + b.h + r;
      impact = 1;
    }
  }
  // The sea is a wall, and so is the world edge.
  if (e.x > WATER_X - r) { e.x = WATER_X - r; impact = Math.max(impact, 0.6); }
  e.x = clamp(e.x, r, WORLD.w - r);
  e.y = clamp(e.y, r, WORLD.h - r);
  return impact;
}

/** True when a sight line between two points crosses no building (for witnesses and gunfire). */
export function lineOfSight(G, x1, y1, x2, y2) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (const b of G.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
  }
  return true;
}

/** The Shine & Go respray garage: drive in, lose the heat (for a price). */
export const RESPRAY = { x: 1220, y: 1930, r: 64, name: 'Shine & Go' };
/** Palmera General hospital — where wasted players wake up. */
export const HOSPITAL = { x: 740, y: 1090 };
/** PBPD headquarters — where busted players are released. */
export const POLICE_HQ = { x: 2180, y: 670 };
/** Mara Voss's usual corner, where the story begins. */
export const MARA_SPOT = { x: 1700, y: 1090 };
