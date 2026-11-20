# neon-palms-3

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yorstann/neon-palms-3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yorstann/neon-palms-3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Palms** — an original top-down open-world crime game that runs in a desktop browser from static files. Explore Palmera Bay, a six-district coastal city (Downtown, Palm Beach, Marina, Portside, Old Town, Coral Suburbs) with a full day/night cycle, on foot or behind the wheel of anything you can steal.

- **Living city:** lane-following traffic that stops, waits and honks; pedestrians who stroll, flee, drop cash — and phone the police when they witness a crime.
- **Wanted system:** 0–5 stars driven by *witnessed* crime. Break line of sight to cool off. Cruisers pursue and ram, officers pile out to make the arrest, at 3 stars dispatch sets **roadblocks** (spike strips at 4), and at 4 stars **PBPD Air One** joins the chase with a searchlight that pins you at night. The **Shine & Go** respray clears the heat for $250.
- **Combat:** mouse-aimed pistol with magazines and reloads, against the **Calle Kings** — a rival gang holding street corners and ambushing you in the story. Health, armour and ammo pickups drop from the fallen.
- **Story:** six jobs for fixer **Mara Voss** — an errand, a car theft, a checkpoint run, a hot-passenger escape, a dockside shootout and a three-bag finale — plus taxi fares and 20 hidden packages.
- **Presentation:** HUD with live minimap (police blips, Air One, mission markers), title/pause/help/busted/wasted screens, a toggleable synth **car radio** with three stations, and progress saved to localStorage.

Everything is vanilla JS ES modules on a single canvas — no assets at all: the art is drawn in code and every sound, from the engine to the rotor, is synthesised with WebAudio. One job per file under `game/src/` (city, vehicles, police, helicopter, roadblocks, combat, missions, radio, …).

**Controls:** WASD/arrows move & drive · E enter/exit car · mouse aim, click to shoot · F shove · R reload · Q radio · T talk/accept job · Shift run · Space handbrake · Esc pause · M mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=2qd39n6s&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
