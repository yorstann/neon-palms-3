// Neon Palms — tuning constants for Palmera Bay: world size, the road grid,
// district map, car archetypes and weapon stats. Every other module reads its
// numbers from here so the whole city agrees with itself.

export const WORLD = { w: 3600, h: 2520 };

/** Centre lines of the north-south avenues, west to east. */
export const AVENUES_X = [260, 740, 1220, 1700, 2180, 2660, 3140];
/** Centre lines of the east-west streets, north to south. */
export const STREETS_Y = [250, 670, 1090, 1510, 1930, 2350];
export const ROAD_HALF = 52;   // asphalt half-width in world units
export const LANE_OFF = 26;    // lane centre offset from a road's centre line
export const SIDEWALK = 14;    // pavement ring kept clear around every block

export const BEACH_X = 3290;   // sand begins at the east edge
export const WATER_X = 3380;   // open water beyond this line

export const DISTRICTS = [
  { name: 'Palm Beach',    test: (x, y) => x >= 2600 && y >= 620 && y < 1980,  ground: '#c2ab84' },
  { name: 'Marina',        test: (x, y) => y >= 1980 && x >= 1640,            ground: '#98a48c' },
  { name: 'Portside',      test: (x, y) => y >= 1560 && x < 1640,             ground: '#8d9280' },
  { name: 'Downtown',      test: (x, y) => x >= 1090 && x < 2600 && y < 1980, ground: '#a49e90' },
  { name: 'Old Town',      test: (x, y) => x >= 2600 && y < 620,              ground: '#b0a186' },
  { name: 'Coral Suburbs', test: () => true,                                   ground: '#8fa873' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (d.test(x, y)) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

export const CAR_TYPES = {
  sedan:   { label: 'Marlin Sedan',   w: 46, h: 22, top: 262, accel: 215, turn: 2.6, mass: 1.0,  colors: ['#b8bcc4', '#7d8aa0', '#a03d3d', '#3d5a80', '#c2b280', '#4a4e57'] },
  coupe:   { label: 'Vireo Coupe',    w: 48, h: 21, top: 348, accel: 305, turn: 3.0, mass: 0.9,  colors: ['#e0a81c', '#c22f4e', '#23252d', '#2e7d6b', '#e8e8ec'] },
  taxi:    { label: 'Palmera Cab',    w: 46, h: 22, top: 252, accel: 208, turn: 2.6, mass: 1.0,  colors: ['#f2b21b'] },
  pickup:  { label: 'Bison Pickup',   w: 52, h: 24, top: 232, accel: 192, turn: 2.3, mass: 1.3,  colors: ['#6b7f5e', '#8a4b2d', '#54606e', '#d8d3c3'] },
  cruiser: { label: 'PBPD Cruiser',   w: 48, h: 22, top: 322, accel: 288, turn: 2.9, mass: 1.05, colors: ['#eef0f2'] },
  lowrider:{ label: 'Kings Lowrider', w: 48, h: 22, top: 268, accel: 222, turn: 2.5, mass: 1.0,  colors: ['#6d28a8', '#571f86'] },
};

export const PISTOL = { damage: 34, rate: 0.24, mag: 12, reload: 1.15, range: 470, spread: 0.04 };
export const GANG_GUN = { damage: 7, rate: 0.9, range: 330, hitChance: 0.34 };

export const WANTED_MAX = 5;
export const RESPRAY_COST = 250;
export const PACKAGE_COUNT = 20;
export const PACKAGE_REWARD = 150;
export const SPIKE_SLOW_SECONDS = 6;

export const SAVE_KEY = 'neon-palms-save-v3';
