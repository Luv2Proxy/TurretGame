const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  wave: document.getElementById("waveLabel"),
  hp: document.getElementById("hpLabel"),
  shield: document.getElementById("shieldLabel"),
  xp: document.getElementById("xpLabel"),
  boss: document.getElementById("bossLabel"),
  overlay: document.getElementById("overlay"),
  title: document.getElementById("overlayTitle"),
  subtitle: document.getElementById("overlaySubtitle"),
  choices: document.getElementById("choices"),
  upgradeList: document.getElementById("upgradeList"),
  modPanels: document.getElementById("modPanels"),
  statsRow: document.querySelector(".stats"),
};

const center = { x: canvas.width / 2, y: canvas.height / 2 };
const CORE_RADIUS = 34;
const keys = new Set();
const mouse = { x: center.x, y: center.y, down: false };

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const state = {
  time: 0,
  wave: 1,
  gameOver: false,
  pausedForUpgrade: false,
  score: 0,
  shake: 0,
  bullets: [],
  enemies: [],
  particles: [],
  effects: [],
  modProjectiles: [],
  activeUpgrades: [],
  bossAlive: null,
  upgradePickCount: 3,
  waveTable: [],
  waveTuning: { budgetScale: 1, spawnRateScale: 1, hpScale: 1, speedScale: 1 },
  waveQueue: { budget: 0, spawnRate: 0.8, timer: 0, weights: {}, bossId: null, bossSolo: false },
  inMenu: true,
  intermissionTimer: 0,
  nextWaveQueued: 1,
  difficulty: "normal",
  difficultyProfiles: {
    casual: { budgetMul: 0.72, spawnMul: 1.18, enemyHpMul: 0.84, enemySpeedMul: 0.88, turretHpMul: 1.2, xpMul: 1.18, intermission: 4.8 },
    normal: { budgetMul: 1, spawnMul: 1, enemyHpMul: 1, enemySpeedMul: 1, turretHpMul: 1, xpMul: 1, intermission: 3.5 },
    nightmare: { budgetMul: 1.35, spawnMul: 0.84, enemyHpMul: 1.32, enemySpeedMul: 1.18, turretHpMul: 0.85, xpMul: 1.05, intermission: 2.6 },
  },
  modHooks: {
    onInit: [], onUpdate: [], onDraw: [], onEnemySpawn: [], onEnemyKilled: [], onBossSpawn: [], onBossKilled: [],
    onUpgradeAwarded: [], onPreUpgradeChoices: [], onWaveStart: [], onShoot: [], onBulletHit: [], onTurretDamaged: [], onGameOver: [],
  },
  modEffectDrawers: {},
  modProjectileTypes: new Map(),
  modWaveBuilders: [],
  modUpgradeFilters: [],
  modHudStats: new Map(),
  modKeybinds: new Map(),
  modEnemyById: new Map(),
  modBossById: new Map(),
  modAiById: new Map(),
};

const turret = {
  angle: 0,
  hp: 120,
  maxHp: 120,
  shield: 0,
  maxShield: 0,
  shieldRegen: 0,
  regen: 0,
  fireRate: 4,
  shootCd: 0,
  bulletSpeed: 520,
  bulletDamage: 18,
  bulletSize: 4,
  bulletKnockback: 100,
  spread: 0,
  multiShot: 1,
  pierce: 0,
  critChance: 0.08,
  critMult: 2,
  poison: 0,
  poisonDuration: 2.8,
  burn: 0,
  burnDuration: 2.3,
  lifesteal: 0,
  dodgeChance: 0,
  armorShred: 0,
  executeThreshold: 0,
  ricochetChance: 0,
  chainChance: 0,
  chainRange: 130,
  chainDamageFactor: 0.55,
  shieldOnKill: 0,
  shockTouch: 0,
  overdrive: 0,
  overdriveTimer: 0,
  pulseEvery: 0,
  pulseTimer: 0,
  orbitals: 0,
  orbitalFireRate: 6,
  orbitalDamageMult: 0.5,
  orbitalPierceBonus: 0,
  orbitalRange: 190,
  rotatingShields: 0,
  rotatingShieldRadius: 66,
  rotatingShieldSpeed: 1.8,
  rotatingShieldDamage: 22,
  rotatingShieldKnockback: 250,
  level: 1,
  xp: 0,
  xpToLevel: 100,
};

const enemyTypes = [
  { id: "runner", color: "#ff6a8f", radius: 12, hp: 32, speed: 95, touch: 10, xp: 10, cost: 6, ai: "chaser", weight: 40 },
  { id: "tank", color: "#ffd166", radius: 18, hp: 115, speed: 44, touch: 16, xp: 24, cost: 12, ai: "chaser", weight: 22 },
  { id: "splitter", color: "#8bff95", radius: 14, hp: 54, speed: 70, touch: 11, xp: 16, cost: 8, ai: "chaser", splitOnDeath: true, weight: 20 },
  { id: "leech", color: "#9f8cff", radius: 11, hp: 44, speed: 82, touch: 9, xp: 15, cost: 9, ai: "strafer", dodge: 0.16, weight: 12 },
  { id: "bomber", color: "#ff9a3d", radius: 15, hp: 74, speed: 58, touch: 10, xp: 20, cost: 11, ai: "charger", explodeRange: 75, explodeDamage: 22, weight: 6 },
];

const bossTypes = [
  { id: "iron_colossus", name: "Iron Colossus", color: "#ff6767", radius: 34, hp: 1100, speed: 38, touch: 26, xp: 220, ai: "juggernaut", knockbackResist: 0.75 },
  { id: "arc_lord", name: "Arc Lord", color: "#76b6ff", radius: 28, hp: 900, speed: 58, touch: 20, xp: 260, ai: "orbiter_boss", knockbackResist: 0.65 },
];

const aiHandlers = {
  chaser(enemy, dt) {
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.vx += (dx / d) * enemy.speed * dt;
    enemy.vy += (dy / d) * enemy.speed * dt;
  },
  strafer(enemy, dt) {
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const px = -dy / d;
    const py = dx / d;
    enemy.vx += (dx / d) * enemy.speed * dt * 0.75 + px * enemy.speed * dt * 0.48;
    enemy.vy += (dy / d) * enemy.speed * dt * 0.75 + py * enemy.speed * dt * 0.48;
  },
  charger(enemy, dt) {
    enemy.aiTimer = (enemy.aiTimer || 0) - dt;
    if (enemy.aiTimer <= 0) {
      const a = Math.atan2(center.y - enemy.y, center.x - enemy.x);
      enemy.vx += Math.cos(a) * enemy.speed * 6;
      enemy.vy += Math.sin(a) * enemy.speed * 6;
      enemy.aiTimer = rand(1.2, 2.4);
    }
    aiHandlers.chaser(enemy, dt * 0.25);
  },
  juggernaut(enemy, dt) {
    aiHandlers.chaser(enemy, dt * 0.8);
    enemy.aiTimer = (enemy.aiTimer || 0) + dt;
    if (enemy.aiTimer > 2.2) {
      enemy.aiTimer = 0;
      blast(enemy.x, enemy.y, 120, 24, true);
    }
  },
  orbiter_boss(enemy, dt) {
    enemy.aiAngle = (enemy.aiAngle || 0) + dt * 1.1;
    const tx = center.x + Math.cos(enemy.aiAngle) * 160;
    const ty = center.y + Math.sin(enemy.aiAngle) * 160;
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.vx += (dx / d) * enemy.speed * dt * 1.2;
    enemy.vy += (dy / d) * enemy.speed * dt * 1.2;
  },
};

const upgrades = [
  { name: "Ablative Shield", rarity: "common", desc: "+35 max shield, +2 shield regen", apply: () => { turret.maxShield += 35; turret.shield = Math.min(turret.maxShield, turret.shield + 35); turret.shieldRegen += 2; } },
  { name: "Venom Rounds", rarity: "common", desc: "+8 poison DoT", apply: () => (turret.poison += 8) },
  { name: "Lifesteal Core", rarity: "uncommon", desc: "Heal 8% of bullet dmg", apply: () => (turret.lifesteal += 0.08) },
  { name: "Overclock", rarity: "common", desc: "+25% fire rate", apply: () => (turret.fireRate *= 1.25) },
  { name: "Piercing Slugs", rarity: "uncommon", desc: "+1 pierce", apply: () => (turret.pierce += 1) },
  { name: "Scatter Array", rarity: "uncommon", desc: "+1 projectile", apply: () => (turret.multiShot += 1) },
  { name: "Corrosive Fire", rarity: "rare", desc: "+10 burn DoT", apply: () => (turret.burn += 10) },
  { name: "Chain Arc", rarity: "rare", desc: "+16% chain chance", apply: () => (turret.chainChance += 0.16) },
  { name: "Blood Battery", rarity: "common", desc: "+6 shield on kill", apply: () => (turret.shieldOnKill += 6) },
  { name: "Strategist", rarity: "epic", desc: "+1 upgrade pick each level", apply: () => (state.upgradePickCount += 1) },
  { name: "Orbital Drones", rarity: "rare", desc: "+1 orbital", apply: () => (turret.orbitals += 1), tree: "Orbitals" },
  { name: "Orbital Accelerator", rarity: "epic", desc: "Orbitals fire faster", apply: () => (turret.orbitalFireRate *= 1.24), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Orbital Rail Mod", rarity: "epic", desc: "Orbitals hit harder", apply: () => (turret.orbitalDamageMult *= 1.22), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Orbital Piercer", rarity: "epic", desc: "Orbitals +1 pierce", apply: () => (turret.orbitalPierceBonus += 1), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Sonic Pulse", rarity: "rare", desc: "AoE pulse every 7s", apply: () => { turret.pulseEvery = Math.max(2.8, turret.pulseEvery ? turret.pulseEvery - 0.8 : 7); turret.pulseTimer = 0; } },
  { name: "Rotating Shield Node", rarity: "rare", desc: "+1 rotating shield", apply: () => (turret.rotatingShields += 1), tree: "Shield Grid" },
];

const upgradeRarities = {
  common: { label: "Common", color: "#8db5d8", border: "#8db5d855", glow: "#9ed2ff44" },
  uncommon: { label: "Uncommon", color: "#82e38c", border: "#82e38c66", glow: "#7fff9955" },
  rare: { label: "Rare", color: "#69b7ff", border: "#69b7ff77", glow: "#69b7ff66" },
  epic: { label: "Epic", color: "#cb8dff", border: "#cb8dff88", glow: "#cb8dff77" },
  legendary: { label: "Legendary", color: "#ffb55f", border: "#ffb55faa", glow: "#ffb55f88" },
};

const rarityWeightsByWave = [
  { minWave: 1, weights: { common: 68, uncommon: 24, rare: 7, epic: 1, legendary: 0 } },
  { minWave: 6, weights: { common: 52, uncommon: 29, rare: 14, epic: 4, legendary: 1 } },
  { minWave: 12, weights: { common: 37, uncommon: 30, rare: 20, epic: 10, legendary: 3 } },
  { minWave: 20, weights: { common: 26, uncommon: 29, rare: 24, epic: 15, legendary: 6 } },
];

function buildBaseWaveTable(count = 40) {
  const table = [];
  for (let wave = 1; wave <= count; wave++) {
    const easyRamp = wave <= 8 ? 0.78 + wave * 0.06 : 1 + (wave - 8) * 0.04;
    table.push({
      wave,
      budget: Math.floor((20 + wave * 9 + Math.pow(wave, 1.22) * 2.1) * easyRamp),
      spawnRate: clamp(0.95 - wave * 0.018, 0.14, 1.2),
      xpReward: 24 + wave * 7,
      bossId: wave % 5 === 0 ? bossTypes[(wave / 5 - 1) % bossTypes.length].id : null,
      bossSolo: wave % 5 === 0,
      weights: {
        runner: clamp(42 - wave, 16, 42),
        splitter: clamp(24 + wave * 0.3, 18, 34),
        tank: clamp(18 + wave * 0.4, 18, 34),
        leech: clamp(8 + wave * 0.55, 8, 28),
        bomber: clamp(5 + wave * 0.5, 5, 24),
      },
    });
  }
  return table;
}
state.waveTable = buildBaseWaveTable(60);

function ensureHudStat(id, label) {
  if (state.modHudStats.has(id)) return state.modHudStats.get(id);
  const span = document.createElement("span");
  span.id = `mod-stat-${id}`;
  span.textContent = `${label}: --`;
  ui.statsRow.appendChild(span);
  const stat = { id, label, span, value: "--", format: (v) => `${v}` };
  state.modHudStats.set(id, stat);
  return stat;
}

function refreshHudStats() {
  for (const stat of state.modHudStats.values()) stat.span.textContent = `${stat.label}: ${stat.value}`;
}

function callHooks(type, payload = {}) {
  for (const hook of state.modHooks[type] || []) {
    try { hook(payload, ModAPI.getContext()); } catch (err) { console.error(`[mod hook:${type}]`, err); }
  }
}

const ModAPI = {
  registerEnemy(def) {
    if (!def?.id) throw new Error("Enemy must have id");
    const normalized = { cost: 10, xp: 20, radius: 12, speed: 60, touch: 12, color: "#fff", hp: 60, ai: "chaser", weight: 10, ...def };
    enemyTypes.push(normalized);
    state.modEnemyById.set(normalized.id, normalized);
  },
  registerBoss(def) {
    if (!def?.id || !def?.name) throw new Error("Boss requires id + name");
    const normalized = { radius: 30, hp: 900, speed: 50, touch: 22, xp: 260, ai: "juggernaut", color: "#ff6b6b", knockbackResist: 0.7, ...def };
    bossTypes.push(normalized);
    state.modBossById.set(normalized.id, normalized);
  },
  registerAI(id, fn) {
    if (!id || typeof fn !== "function") throw new Error("AI requires id + function");
    state.modAiById.set(id, fn);
  },
  registerWaveTable(table) {
    if (!Array.isArray(table) || !table.length) throw new Error("Wave table must be non-empty array");
    state.waveTable = table.map((e, i) => ({ wave: i + 1, budget: 30, spawnRate: 0.8, xpReward: 32, weights: {}, bossId: null, bossSolo: false, ...e }));
  },
  setWaveEntry(wave, entry) {
    const idx = Math.max(0, wave - 1);
    state.waveTable[idx] = { wave, budget: 30, spawnRate: 0.8, xpReward: 32, weights: {}, bossId: null, bossSolo: false, ...(state.waveTable[idx] || {}), ...entry };
  },
  setGlobalWaveTuning(partial) {
    state.waveTuning = { ...state.waveTuning, ...partial };
  },
  setBossWave(wave, bossId, bossSolo = true) {
    ModAPI.setWaveEntry(wave, { bossId, bossSolo });
  },
  setDifficultyProfiles(profiles) {
    state.difficultyProfiles = { ...state.difficultyProfiles, ...profiles };
  },
  setDifficulty(id) {
    if (state.difficultyProfiles[id]) state.difficulty = id;
  },
  registerWaveBuilder(builderFn) { state.modWaveBuilders.push(builderFn); },
  registerUpgradeFilter(filterFn) { state.modUpgradeFilters.push(filterFn); },
  registerUpgrade(def) {
    if (!def?.name || typeof def.apply !== "function") throw new Error("Upgrade requires name + apply");
    upgrades.push({ rarity: "common", ...def });
  },
  registerRarity(id, def) {
    if (!id) throw new Error("Rarity id required");
    upgradeRarities[id] = { label: id, color: "#fff", border: "#ffffff66", glow: "#ffffff44", ...def };
  },
  setUpgradeRarity(upgradeName, rarity) {
    const found = upgrades.find((u) => u.name === upgradeName);
    if (found) found.rarity = rarity;
  },
  setRarityWeightsTable(table) {
    if (!Array.isArray(table) || !table.length) throw new Error("Rarity weight table must be non-empty");
    rarityWeightsByWave.length = 0;
    for (const entry of table) rarityWeightsByWave.push(entry);
  },
  setUpgradePickCount(n) { state.upgradePickCount = Math.max(1, Math.floor(n)); },
  registerProjectileType(type, factory) { state.modProjectileTypes.set(type, factory); },
  spawnProjectileType(type, payload = {}) {
    const factory = state.modProjectileTypes.get(type);
    if (!factory) throw new Error(`Unknown projectile type: ${type}`);
    const created = factory(payload, ModAPI.getContext());
    if (Array.isArray(created)) created.forEach((p) => ModAPI.spawnProjectile(p));
    else if (created) ModAPI.spawnProjectile(created);
  },
  spawnProjectile(def) { state.modProjectiles.push({ life: 2, radius: 4, ...def }); },
  registerEffectType(type, draw) { state.modEffectDrawers[type] = draw; },
  addEffect(effect) { state.effects.push(effect); },
  registerHook(type, fn) {
    if (!state.modHooks[type]) throw new Error(`Unknown hook ${type}`);
    state.modHooks[type].push(fn);
  },
  registerHudStat(id, config = {}) {
    const stat = ensureHudStat(id, config.label || id);
    if (config.format) stat.format = config.format;
    return { set(value) { stat.value = stat.format(value); } };
  },
  registerKeybind(actionId, key, handler) { state.modKeybinds.set(actionId, { key: key.toLowerCase(), handler }); },
  createFloatingText(text, x, y, color = "#fff") { state.effects.push({ type: "text", text, x, y, color, life: 0.5 }); },
  addPanel(id, title, renderText = "") {
    const box = document.createElement("div");
    box.className = "mod-panel";
    box.id = `mod-panel-${id}`;
    box.innerHTML = `<h3>${title}</h3><div>${renderText}</div>`;
    ui.modPanels.appendChild(box);
    return { setHtml(html) { box.querySelector("div").innerHTML = html; } };
  },
  spawnEnemy(typeOrId, overrides = {}) {
    const base = typeof typeOrId === "string" ? state.modEnemyById.get(typeOrId) || enemyTypes.find((e) => e.id === typeOrId) : typeOrId;
    if (base) spawnEnemy(base, false, overrides);
  },
  spawnBoss(id, overrides = {}) {
    const boss = state.modBossById.get(id) || bossTypes.find((b) => b.id === id);
    if (boss) spawnBoss(boss, overrides);
  },
  getContext() {
    return { state, turret, center, canvas, ctx, rand, clamp, enemyTypes, bossTypes, upgrades };
  },
};
window.TurretGameModAPI = ModAPI;

async function loadMods() {
  try {
    const manifest = await fetch("mods/mods.json").then((r) => (r.ok ? r.json() : []));
    for (const modPath of manifest) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = modPath;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    callHooks("onInit", {});
  } catch {
    // optional mods
  }
}

function refreshUpgradeList() {
  ui.upgradeList.innerHTML = "";
  if (!state.activeUpgrades.length) {
    ui.upgradeList.innerHTML = "<li>None yet — level up to choose boosts.</li>";
    return;
  }
  state.activeUpgrades.slice(-16).forEach((u) => {
    const li = document.createElement("li");
    li.textContent = `${u.name}${u.stacks > 1 ? ` x${u.stacks}` : ""}`;
    ui.upgradeList.appendChild(li);
  });
}

function weightedEnemy(weights = {}) {
  const pool = enemyTypes.map((e) => ({ e, w: weights[e.id] ?? e.weight ?? 1 })).filter((x) => x.w > 0);
  const sum = pool.reduce((a, b) => a + b.w, 0) || 1;
  let r = Math.random() * sum;
  for (const item of pool) {
    r -= item.w;
    if (r <= 0) return item.e;
  }
  return pool[0]?.e || enemyTypes[0];
}

function enemyAtEdge() {
  const p = 28;
  const s = Math.floor(rand(0, 4));
  if (s === 0) return { x: rand(-p, canvas.width + p), y: -p };
  if (s === 1) return { x: canvas.width + p, y: rand(-p, canvas.height + p) };
  if (s === 2) return { x: rand(-p, canvas.width + p), y: canvas.height + p };
  return { x: -p, y: rand(-p, canvas.height + p) };
}

function spawnEnemy(type = weightedEnemy(state.waveQueue.weights), elite = false, overrides = {}) {
  const p = enemyAtEdge();
  const diff = state.difficultyProfiles[state.difficulty] || state.difficultyProfiles.normal;
  const hpScale = (1 + state.wave * 0.07) * state.waveTuning.hpScale * (diff.enemyHpMul || 1);
  const speedScale = (1 + state.wave * 0.008) * state.waveTuning.speedScale * (diff.enemySpeedMul || 1);
  const enemy = {
    x: p.x,
    y: p.y,
    type,
    hp: type.hp * hpScale * (elite ? 1.45 : 1),
    maxHp: type.hp * hpScale * (elite ? 1.45 : 1),
    speed: type.speed * speedScale * (elite ? 1.08 : 1),
    burn: 0,
    poison: 0,
    burnTimer: 0,
    poisonTimer: 0,
    hitFlash: 0,
    vx: 0,
    vy: 0,
    kbX: 0,
    kbY: 0,
    contactTimer: 0,
    dead: false,
    elite,
    isBoss: false,
    ...overrides,
  };
  state.enemies.push(enemy);
  callHooks("onEnemySpawn", { enemy });
  return enemy;
}

function spawnBoss(bossDef, overrides = {}) {
  const boss = spawnEnemy(bossDef, true, {
    ...overrides,
    type: bossDef,
    isBoss: true,
    bossName: bossDef.name,
    hp: bossDef.hp * state.waveTuning.hpScale,
    maxHp: bossDef.hp * state.waveTuning.hpScale,
    speed: bossDef.speed * state.waveTuning.speedScale,
  });
  state.bossAlive = boss;
  callHooks("onBossSpawn", { boss });
  return boss;
}

function pushEnemy(enemy, fromX, fromY, force) {
  const resist = enemy.type.knockbackResist ?? 0;
  const d = Math.hypot(enemy.x - fromX, enemy.y - fromY) || 1;
  enemy.kbX += ((enemy.x - fromX) / d) * force * (1 - resist);
  enemy.kbY += ((enemy.y - fromY) / d) * force * (1 - resist);
}

function fireBullet(angle, dmgMult = 1, speedMult = 1, size = turret.bulletSize, pierceBonus = 0) {
  state.bullets.push({
    x: center.x + Math.cos(angle) * 30,
    y: center.y + Math.sin(angle) * 30,
    vx: Math.cos(angle) * turret.bulletSpeed * speedMult,
    vy: Math.sin(angle) * turret.bulletSpeed * speedMult,
    damage: turret.bulletDamage * dmgMult,
    radius: size,
    pierce: turret.pierce + pierceBonus,
    poison: turret.poison,
    burn: turret.burn,
    dead: false,
  });
  callHooks("onShoot", { angle });
}

function blast(x, y, range, damage, hurtsTurret = false) {
  state.effects.push({ type: "ring", x, y, radius: 8, max: range, life: 0.3, color: "#9befff88" });
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < range) {
      enemy.hp -= damage * (1 - (d / range) * 0.65);
      enemy.hitFlash = 0.12;
      pushEnemy(enemy, x, y, 150 * (1 - d / range));
    }
  }
  if (hurtsTurret && Math.hypot(center.x - x, center.y - y) < range + CORE_RADIUS) dealTurretDamage(damage);
}

function tryShoot(dt) {
  const firing = mouse.down || keys.has(" ");
  turret.shootCd -= dt;
  if (!firing || turret.shootCd > 0) return;
  turret.shootCd = 1 / (turret.fireRate + turret.overdrive);
  for (let i = 0; i < turret.multiShot; i++) {
    const spread = (i - (turret.multiShot - 1) / 2) * 0.09 + rand(-turret.spread, turret.spread);
    fireBullet(turret.angle + spread);
  }
}

function dealTurretDamage(amount) {
  if (amount <= 0 || state.gameOver) return;
  if (Math.random() < turret.dodgeChance) return;
  let remaining = amount;
  if (turret.shield > 0) {
    const absorbed = Math.min(turret.shield, remaining);
    turret.shield -= absorbed;
    remaining -= absorbed;
  }
  turret.hp -= remaining;
  callHooks("onTurretDamaged", { amount: remaining, blocked: amount - remaining });
  state.shake = Math.min(18, state.shake + amount * 0.26);
  if (turret.hp <= 0) {
    turret.hp = 0;
    state.gameOver = true;
    callHooks("onGameOver", { wave: state.wave, score: state.score });
    showEnd();
  }
}

function gainXp(amount) {
  turret.xp += amount;
  while (turret.xp >= turret.xpToLevel) {
    turret.xp -= turret.xpToLevel;
    turret.level += 1;
    turret.xpToLevel = Math.floor(turret.xpToLevel * 1.17);
    showUpgradeSelection();
  }
}

function onEnemyKilled(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.score += enemy.type.xp * (enemy.isBoss ? 2.2 : enemy.elite ? 1.6 : 1);
  gainXp(enemy.type.xp * (enemy.isBoss ? 2 : 1.2));
  if (turret.shieldOnKill > 0) turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldOnKill);

  if (enemy.type.splitOnDeath && !enemy.isBoss) {
    for (let i = 0; i < 2; i++) spawnEnemy(enemyTypes[0], false, { x: enemy.x + rand(-8, 8), y: enemy.y + rand(-8, 8) });
  }
  if (enemy.type.explodeRange) blast(enemy.x, enemy.y, enemy.type.explodeRange, enemy.type.explodeDamage, true);

  if (enemy.isBoss) {
    state.bossAlive = null;
    callHooks("onBossKilled", { boss: enemy });
  }
  callHooks("onEnemyKilled", { enemy });
}

function chainLightning(fromEnemy, depth = 0, hit = new Set()) {
  if (depth > 3) return;
  hit.add(fromEnemy);
  const target = state.enemies
    .filter((e) => !e.dead && !hit.has(e))
    .map((e) => ({ e, d: Math.hypot(e.x - fromEnemy.x, e.y - fromEnemy.y) }))
    .filter((e) => e.d <= turret.chainRange)
    .sort((a, b) => a.d - b.d)[0]?.e;
  if (!target) return;
  target.hp -= turret.bulletDamage * turret.chainDamageFactor * (1 - depth * 0.14);
  target.hitFlash = 0.2;
  pushEnemy(target, fromEnemy.x, fromEnemy.y, 90);
  state.effects.push({ type: "bolt", x1: fromEnemy.x, y1: fromEnemy.y, x2: target.x, y2: target.y, life: 0.09 });
  if (target.hp <= 0) onEnemyKilled(target);
  chainLightning(target, depth + 1, hit);
}

function updateRotatingShields(dt) {
  if (!turret.rotatingShields) return;
  for (let i = 0; i < turret.rotatingShields; i++) {
    const a = state.time * turret.rotatingShieldSpeed + (Math.PI * 2 * i) / turret.rotatingShields;
    const sx = center.x + Math.cos(a) * turret.rotatingShieldRadius;
    const sy = center.y + Math.sin(a) * turret.rotatingShieldRadius;
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - sx, e.y - sy) <= e.type.radius + 10) {
        e.hp -= turret.rotatingShieldDamage * dt * 2;
        pushEnemy(e, sx, sy, turret.rotatingShieldKnockback * dt);
      }
    }
  }
}

function updateEnemyAi(enemy, dt) {
  const ai = state.modAiById.get(enemy.type.ai) || aiHandlers[enemy.type.ai] || aiHandlers.chaser;
  ai(enemy, dt, ModAPI.getContext());
}

function updateModProjectiles(dt) {
  for (const p of state.modProjectiles) {
    p.life -= dt;
    if (p.update) p.update(p, dt, ModAPI.getContext());
    else {
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(p.x - enemy.x, p.y - enemy.y) <= (p.radius || 4) + enemy.type.radius) {
        if (p.onHit) p.onHit(enemy, p, ModAPI.getContext());
        if (!p.piercing) p.life = 0;
      }
    }
  }
  state.modProjectiles = state.modProjectiles.filter((p) => p.life > 0);
}

function awardUpgrade(upgrade) {
  upgrade.apply();
  const existing = state.activeUpgrades.find((x) => x.name === upgrade.name);
  if (existing) existing.stacks += 1;
  else state.activeUpgrades.push({ name: upgrade.name, stacks: 1 });
  refreshUpgradeList();
  callHooks("onUpgradeAwarded", { upgrade });
}


function getRarityWeightsForWave(wave) {
  let selected = rarityWeightsByWave[0]?.weights || { common: 1 };
  for (const row of rarityWeightsByWave) {
    if (wave >= row.minWave) selected = row.weights;
  }
  return selected;
}

function rollRarityForUpgrade(upgrade, wave) {
  if (upgrade.rarity) return upgrade.rarity;
  const weights = getRarityWeightsForWave(wave);
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((acc, [, w]) => acc + w, 0) || 1;
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[0]?.[0] || "common";
}

function eligibleUpgrades() {
  let list = upgrades.filter((u) => !u.requires || u.requires.every((r) => state.activeUpgrades.some((x) => x.name === r)));
  for (const f of state.modUpgradeFilters) {
    try { list = f(list, ModAPI.getContext()) || list; } catch (err) { console.error("[mod upgrade filter]", err); }
  }
  return list;
}

function showUpgradeSelection() {
  state.pausedForUpgrade = true;
  ui.overlay.classList.remove("hidden");
  ui.title.textContent = `Level ${turret.level} upgrade`;
  ui.subtitle.textContent = `Pick ${state.upgradePickCount} option${state.upgradePickCount > 1 ? "s" : ""}`;
  ui.choices.innerHTML = "";

  const pool = [...eligibleUpgrades()].sort(() => Math.random() - 0.5);
  let picks = pool.slice(0, Math.max(1, state.upgradePickCount)).map((u) => ({ ...u, rolledRarity: rollRarityForUpgrade(u, state.wave) }));
  const payload = { picks, pickCount: state.upgradePickCount };
  callHooks("onPreUpgradeChoices", payload);
  if (Array.isArray(payload.picks) && payload.picks.length) {
    picks = payload.picks.slice(0, Math.max(1, payload.pickCount || state.upgradePickCount));
  }

  picks.forEach((u) => {
    const card = document.createElement("button");
    const rarityId = u.rolledRarity || u.rarity || "common";
    const rarityMeta = upgradeRarities[rarityId] || upgradeRarities.common;
    card.className = `choice rarity-${rarityId}`;
    card.style.borderColor = rarityMeta.border;
    card.style.boxShadow = `inset 0 0 0 1px ${rarityMeta.border}, 0 0 16px ${rarityMeta.glow}`;
    card.innerHTML = `<div class="rarity-tag" style="color:${rarityMeta.color}">${rarityMeta.label}</div><h3>${u.name}</h3><p>${u.desc}${u.tree ? ` · Tree: ${u.tree}` : ""}</p>`;
    card.onclick = () => {
      awardUpgrade(u);
      ui.overlay.classList.add("hidden");
      state.pausedForUpgrade = false;
    };
    ui.choices.appendChild(card);
  });
}

function showEnd() {
  state.pausedForUpgrade = true;
  ui.overlay.classList.remove("hidden");
  ui.title.textContent = "Core Breached";
  ui.subtitle.textContent = `Wave ${state.wave} · Score ${Math.floor(state.score)} · Level ${turret.level}`;
  ui.choices.innerHTML = "";
  const retry = document.createElement("button");
  retry.className = "choice";
  retry.innerHTML = "<h3>Run it back</h3><p>Start a fresh chaos run.</p>";
  retry.onclick = () => window.location.reload();
  ui.choices.appendChild(retry);
}

function getWaveEntry(wave) {
  return state.waveTable[Math.max(0, wave - 1)] || state.waveTable[state.waveTable.length - 1];
}

function beginWave(wave = state.wave) {
  state.wave = wave;
  const base = getWaveEntry(wave);
  const ctxWave = {
    wave,
    budget: Math.floor(base.budget * state.waveTuning.budgetScale),
    spawnRate: base.spawnRate * state.waveTuning.spawnRateScale,
    xpReward: base.xpReward,
    weights: { ...base.weights },
    bossId: base.bossId,
    bossSolo: !!base.bossSolo,
  };

  const diff0 = state.difficultyProfiles[state.difficulty] || state.difficultyProfiles.normal;
  ctxWave.budget = Math.floor(ctxWave.budget * (diff0.budgetMul || 1));
  ctxWave.spawnRate = ctxWave.spawnRate * (diff0.spawnMul || 1);

  for (const fn of state.modWaveBuilders) {
    try { fn(ctxWave, ModAPI.getContext()); } catch (err) { console.error("[mod wave builder]", err); }
  }

  state.waveQueue = {
    budget: Math.max(0, Math.floor(ctxWave.budget)),
    spawnRate: clamp(ctxWave.spawnRate, 0.1, 2),
    timer: 0,
    weights: ctxWave.weights,
    bossId: ctxWave.bossId,
    bossSolo: !!ctxWave.bossSolo,
  };

  const diff = state.difficultyProfiles[state.difficulty] || state.difficultyProfiles.normal;
  gainXp((ctxWave.xpReward || 0) * (diff.xpMul || 1));
  if (ctxWave.bossId) ModAPI.spawnBoss(ctxWave.bossId);
  if (ctxWave.bossSolo) state.waveQueue.budget = 0;
  callHooks("onWaveStart", ctxWave);
}


function showMainMenu() {
  state.inMenu = true;
  state.pausedForUpgrade = true;
  ui.overlay.classList.remove("hidden");
  ui.title.textContent = "Turret Frenzy";
  ui.subtitle.textContent = "Choose your difficulty and begin";
  ui.choices.innerHTML = "";

  const makeButton = (id, title, desc) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.innerHTML = `<h3>${title}</h3><p>${desc}</p>`;
    b.onclick = () => startGame(id);
    ui.choices.appendChild(b);
  };

  makeButton("casual", "Casual", "Relaxed pacing, easier enemies, longer breaks");
  makeButton("normal", "Normal", "Default intended challenge");
  makeButton("nightmare", "Nightmare", "Faster, harder, relentless pressure");
}

function startGame(difficultyId = "normal") {
  state.difficulty = state.difficultyProfiles[difficultyId] ? difficultyId : "normal";
  const diff = state.difficultyProfiles[state.difficulty];
  turret.maxHp = Math.round(120 * (diff.turretHpMul || 1));
  turret.hp = turret.maxHp;
  state.inMenu = false;
  state.pausedForUpgrade = false;
  state.wave = 1;
  state.nextWaveQueued = 1;
  state.enemies = [];
  state.bullets = [];
  state.modProjectiles = [];
  state.effects = [];
  state.intermissionTimer = diff.intermission || 3.5;
  ui.overlay.classList.add("hidden");
}

function queueNextWave(nextWave) {
  state.nextWaveQueued = nextWave;
  const diff = state.difficultyProfiles[state.difficulty] || state.difficultyProfiles.normal;
  state.intermissionTimer = diff.intermission || 3.5;
}

function update(dt) {
  if (state.inMenu || state.pausedForUpgrade || state.gameOver) return;

  state.time += dt;

  if (state.intermissionTimer > 0) {
    state.intermissionTimer -= dt;
    if (state.intermissionTimer <= 0) beginWave(state.nextWaveQueued || state.wave);
    ui.wave.textContent = `Wave ${state.wave} starts in ${Math.max(0, state.intermissionTimer).toFixed(1)}s`;
    ui.hp.textContent = `HP: ${Math.ceil(turret.hp)} / ${Math.ceil(turret.maxHp)}`;
    ui.shield.textContent = `Shield: ${Math.ceil(turret.shield)}${turret.maxShield ? ` / ${Math.ceil(turret.maxShield)}` : ""}`;
    ui.xp.textContent = `XP: ${Math.floor(turret.xp)} / ${turret.xpToLevel}`;
    ui.boss.textContent = "Boss: Preparing";
    refreshHudStats();
    callHooks("onUpdate", { dt, inIntermission: true });
    return;
  }
  state.shake *= 0.87;
  turret.overdrive = turret.overdriveTimer > 0 ? 4.8 : 0;
  turret.overdriveTimer = Math.max(0, turret.overdriveTimer - dt);
  turret.hp = Math.min(turret.maxHp, turret.hp + turret.regen * dt);
  turret.angle = Math.atan2(mouse.y - center.y, mouse.x - center.x);

  tryShoot(dt);
  updateRotatingShields(dt);
  updateModProjectiles(dt);

  if (turret.maxShield > 0) turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldRegen * dt);

  if (turret.pulseEvery > 0) {
    turret.pulseTimer += dt;
    if (turret.pulseTimer >= turret.pulseEvery) {
      turret.pulseTimer = 0;
      blast(center.x, center.y, 170, 40 + turret.level * 2);
    }
  }

  state.waveQueue.timer -= dt;
  if (state.waveQueue.budget > 0 && state.waveQueue.timer <= 0) {
    const type = weightedEnemy(state.waveQueue.weights);
    if (type.cost <= state.waveQueue.budget || state.waveQueue.budget < 8) {
      spawnEnemy(type);
      state.waveQueue.budget -= type.cost;
      state.waveQueue.timer = state.waveQueue.spawnRate * rand(0.8, 1.16);
    } else state.waveQueue.budget -= 1;
  }

  if (state.waveQueue.budget <= 0 && state.enemies.every((e) => e.dead)) queueNextWave(state.wave + 1);

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < -35 || bullet.x > canvas.width + 35 || bullet.y < -35 || bullet.y > canvas.height + 35) {
      bullet.dead = true;
      continue;
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) > enemy.type.radius + bullet.radius) continue;
      if (enemy.type.dodge && Math.random() < enemy.type.dodge) { bullet.dead = true; break; }

      let dmg = bullet.damage * (Math.random() < turret.critChance ? turret.critMult : 1);
      if (enemy.hp / enemy.maxHp > 0.75) dmg *= 1 + turret.armorShred;
      enemy.hp -= dmg;
      enemy.hitFlash = 0.12;
      pushEnemy(enemy, center.x, center.y, turret.bulletKnockback);
      callHooks("onBulletHit", { enemy, bullet, damage: dmg });

      if (bullet.poison > 0) { enemy.poison = Math.max(enemy.poison, bullet.poison); enemy.poisonTimer = turret.poisonDuration; }
      if (bullet.burn > 0) { enemy.burn = Math.max(enemy.burn, bullet.burn); enemy.burnTimer = turret.burnDuration; }
      if (turret.executeThreshold > 0 && enemy.hp > 0 && enemy.hp / enemy.maxHp < turret.executeThreshold) enemy.hp = 0;
      if (turret.lifesteal > 0) turret.hp = Math.min(turret.maxHp, turret.hp + dmg * turret.lifesteal);

      if (enemy.hp <= 0) onEnemyKilled(enemy);
      else if (turret.chainChance > 0 && Math.random() < turret.chainChance) chainLightning(enemy);

      if (turret.ricochetChance > 0 && Math.random() < turret.ricochetChance) {
        bullet.vx *= -1;
        bullet.vy *= -1;
        bullet.pierce = Math.max(0, bullet.pierce);
      } else if (--bullet.pierce < 0) {
        bullet.dead = true;
        break;
      }
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;

    updateEnemyAi(enemy, dt);

    enemy.x += enemy.vx * dt + enemy.kbX * dt;
    enemy.y += enemy.vy * dt + enemy.kbY * dt;
    enemy.vx *= 0.9;
    enemy.vy *= 0.9;
    enemy.kbX *= 0.82;
    enemy.kbY *= 0.82;

    if (enemy.poisonTimer > 0) { enemy.poisonTimer -= dt; enemy.hp -= enemy.poison * dt; }
    if (enemy.burnTimer > 0) { enemy.burnTimer -= dt; enemy.hp -= enemy.burn * dt; }

    const d = Math.hypot(enemy.x - center.x, enemy.y - center.y);
    const minDist = CORE_RADIUS + enemy.type.radius;
    if (d < minDist) {
      const nx = (enemy.x - center.x) / (d || 1);
      const ny = (enemy.y - center.y) / (d || 1);
      const overlap = minDist - d;
      enemy.x += nx * overlap;
      enemy.y += ny * overlap;
      enemy.kbX += nx * 30;
      enemy.kbY += ny * 30;

      enemy.contactTimer += dt;
      if (enemy.contactTimer >= 0.08) {
        dealTurretDamage(enemy.type.touch * 0.5);
        enemy.contactTimer = 0;
      }
      if (turret.shockTouch > 0 && Math.random() < turret.shockTouch * dt * 4) enemy.hp -= turret.bulletDamage * 0.85;
      if (enemy.type.id === "bomber") enemy.hp = -1;
    } else enemy.contactTimer = 0;

    if (enemy.hp <= 0) onEnemyKilled(enemy);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  }

  for (let i = 0; i < turret.orbitals; i++) {
    const a = state.time * 1.85 + (Math.PI * 2 * i) / turret.orbitals;
    const ox = center.x + Math.cos(a) * 88;
    const oy = center.y + Math.sin(a) * 88;
    const target = state.enemies
      .filter((e) => !e.dead)
      .map((e) => ({ e, d: Math.hypot(e.x - ox, e.y - oy) }))
      .sort((a1, b1) => a1.d - b1.d)[0];
    if (target && target.d < turret.orbitalRange && Math.random() < dt * turret.orbitalFireRate) {
      fireBullet(Math.atan2(target.e.y - oy, target.e.x - ox), turret.orbitalDamageMult, 0.9, 3, turret.orbitalPierceBonus);
    }
  }

  callHooks("onUpdate", { dt });

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => !e.dead && e.hp > 0);

  ui.wave.textContent = `Wave ${state.wave}`;
  ui.hp.textContent = `HP: ${Math.ceil(turret.hp)} / ${Math.ceil(turret.maxHp)}`;
  ui.shield.textContent = `Shield: ${Math.ceil(turret.shield)}${turret.maxShield ? ` / ${Math.ceil(turret.maxShield)}` : ""}`;
  ui.xp.textContent = `XP: ${Math.floor(turret.xp)} / ${turret.xpToLevel}`;
  ui.boss.textContent = state.bossAlive ? `Boss: ${state.bossAlive.bossName} (${Math.max(0, Math.ceil(state.bossAlive.hp))})` : "Boss: None";
  refreshHudStats();
}

function draw() {
  const sx = rand(-state.shake, state.shake);
  const sy = rand(-state.shake, state.shake);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "#0b1327";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const e of state.enemies) {
    if (e.poisonTimer > 0) { ctx.fillStyle = "#57f26733"; ctx.beginPath(); ctx.arc(e.x, e.y, e.type.radius + 5, 0, Math.PI * 2); ctx.fill(); }
    if (e.burnTimer > 0) { ctx.fillStyle = "#ff9a432b"; ctx.beginPath(); ctx.arc(e.x, e.y, e.type.radius + 7, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = e.hitFlash ? "#fff" : e.type.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.type.radius + (e.elite ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.bullets) {
    ctx.fillStyle = "#abf7ff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of state.modProjectiles) {
    if (p.draw) p.draw(p, ctx, ModAPI.getContext());
    else {
      ctx.fillStyle = p.color || "#f7c8ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < turret.orbitals; i++) {
    const a = state.time * 1.85 + (Math.PI * 2 * i) / turret.orbitals;
    const x = center.x + Math.cos(a) * 88;
    const y = center.y + Math.sin(a) * 88;
    ctx.fillStyle = "#8cffef";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < turret.rotatingShields; i++) {
    const a = state.time * turret.rotatingShieldSpeed + (Math.PI * 2 * i) / turret.rotatingShields;
    const x = center.x + Math.cos(a) * turret.rotatingShieldRadius;
    const y = center.y + Math.sin(a) * turret.rotatingShieldRadius;
    ctx.fillStyle = "#8fd8ff";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (turret.shield > 0.1) {
    ctx.strokeStyle = "#69d7ff99";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 27 + 12 * (turret.shield / Math.max(1, turret.maxShield)), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(turret.angle);
  ctx.fillStyle = "#56f7ff";
  ctx.fillRect(-14, -14, 28, 28);
  ctx.fillStyle = "#eafcff";
  ctx.fillRect(10, -6, 30, 12);
  ctx.restore();

  for (const fx of state.effects) {
    if (fx.type === "ring") {
      fx.life -= 1 / 60;
      fx.radius += (fx.max - fx.radius) * 0.3;
      ctx.strokeStyle = fx.color || "#97eeff88";
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === "text") {
      fx.life -= 1 / 60;
      fx.y -= 0.4;
      ctx.fillStyle = fx.color || "#fff";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.fillText(fx.text, fx.x, fx.y);
    } else if (state.modEffectDrawers[fx.type]) {
      state.modEffectDrawers[fx.type](fx, ctx, ModAPI.getContext());
    }
  }
  state.effects = state.effects.filter((fx) => fx.life === undefined || fx.life > 0);

  if (!state.inMenu && state.intermissionTimer > 0) {
    ctx.fillStyle = "#d8f7ff";
    ctx.font = "bold 30px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Wave ${state.nextWaveQueued} in ${Math.max(0, state.intermissionTimer).toFixed(1)}s`, canvas.width / 2, 90);
    ctx.textAlign = "start";
  }

  callHooks("onDraw", { ctx });
  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});
canvas.addEventListener("mousedown", () => (mouse.down = true));
window.addEventListener("mouseup", () => (mouse.down = false));
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  for (const bind of state.modKeybinds.values()) {
    if (bind.key === key) {
      try { bind.handler({ key, event }, ModAPI.getContext()); } catch (err) { console.error("[mod keybind]", err); }
    }
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

refreshUpgradeList();
loadMods().finally(() => {
  showMainMenu();
  requestAnimationFrame(loop);
});
