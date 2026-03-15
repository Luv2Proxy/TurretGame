# Turret Frenzy

A fast-paced 2D wave-survival turret game built with HTML5 Canvas.

## Play

1. Serve the repo folder locally (for example: `python3 -m http.server 4173`).
2. Open `http://localhost:4173`.
3. Aim with your mouse.
4. Hold mouse button (or Space) to fire.
5. Survive fixed waves, boss-only checkpoints, RNG enemy mixes, and escalating pressure.

## Features

- Professional main menu with difficulty selection (Casual / Normal / Nightmare).
- Inter-wave countdown gaps for breathing room and pacing.
- Center-core turret combat with directional aiming.
- Fixed wave table with easier early ramp, weighted RNG enemy mixes, and recurring bosses.
- Base + mod-defined enemies, bosses, AIs, projectiles, and upgrade trees.
- Upgrade cards now have rarity tiers (common → legendary) with weighted rolls that can be modded.
- Upgrade picks can be increased and controlled globally or per-level by mods.
- Knockback, anti-clipping core collision separation, orbitals, rotating shields, status effects.
- Active-upgrade panel with stack tracking and custom mod panels.

## Modding Support (JavaScript)

Mods are plain JS files loaded from `mods/mods.json`.

- Manifest: `mods/mods.json`
- Example mod: `mods/example-mod.js`
- Runtime API: `window.TurretGameModAPI`

### Core mod powers

- **Content registration**
  - `registerEnemy`, `registerBoss`, `registerAI`
  - `registerUpgrade` (with `tree`, `requires`, and optional `rarity`)
  - `registerRarity`, `setUpgradeRarity`, `setRarityWeightsTable`
  - `registerProjectileType`, `spawnProjectileType`, `spawnProjectile`
  - `registerEffectType`, `addEffect`
- **Wave and progression control**
  - `registerWaveTable`, `setWaveEntry`, `setGlobalWaveTuning`, `setBossWave`, `registerWaveBuilder`
  - `setUpgradePickCount`, `registerUpgradeFilter`
- **UI and interaction**
  - `addPanel`, `registerHudStat`
  - `registerKeybind`, `createFloatingText`
- **Spawn and runtime control**
  - `spawnEnemy`, `spawnBoss`
  - boss-only wave entries via `bossSolo: true` in wave entries/builders
  - `registerHook` for:
    - `onInit`, `onUpdate`, `onDraw`
    - `onEnemySpawn`, `onEnemyKilled`, `onBossSpawn`, `onBossKilled`
    - `onUpgradeAwarded`, `onPreUpgradeChoices`
    - `onWaveStart`, `onShoot`, `onBulletHit`, `onTurretDamaged`, `onGameOver`

### Minimal example

```js
window.TurretGameModAPI.registerBoss({
  id: "my-boss",
  name: "My Boss",
  hp: 1800,
  speed: 44,
  touch: 30,
  radius: 36,
  ai: "juggernaut"
});
```
