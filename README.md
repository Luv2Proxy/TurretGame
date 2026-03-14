# Turret Frenzy

A fast-paced 2D wave-survival turret game built with HTML5 Canvas.

## Play

1. Serve the repo folder locally (for example: `python3 -m http.server 4173`).
2. Open `http://localhost:4173`.
3. Aim with your mouse.
4. Hold mouse button (or Space) to fire.
5. Survive waves, level up, and pick absurd upgrade combinations.

## Features

- Center-core turret combat with directional aiming.
- Multiple enemy archetypes (runners, tanks, splitters, leeches, bombers, plus modded enemies).
- Upgrade trees and chained upgrade prerequisites (base game + mod-defined upgrades).
- Knockback, anti-clipping core collision separation, orbitals, rotating shields, status effects, and wave scaling.
- Active-upgrade panel with stack tracking.

## Modding Support (JavaScript)

Mods are plain JS files loaded from `mods/mods.json`.

- Manifest: `mods/mods.json`
- Example mod: `mods/example-mod.js`
- Runtime API: `window.TurretGameModAPI`

### What mods can add

- GUI panels (`addPanel`)
- Enemies (`registerEnemy`)
- Upgrades and upgrade trees (`registerUpgrade`, optional `tree`/`requires`)
- Effects (`registerEffectType`, `addEffect`)
- Projectiles (`spawnProjectile`)
- Gameplay hooks (`registerHook` for `onInit`, `onUpdate`, `onDraw`, `onEnemySpawn`, `onEnemyKilled`, `onUpgradeAwarded`, `onWaveStart`, `onShoot`)

### Minimal example

```js
window.TurretGameModAPI.registerEnemy({ id: "my-enemy", hp: 80, speed: 70, radius: 14, touch: 12, xp: 20, cost: 10, color: "#44ffaa" });
```
