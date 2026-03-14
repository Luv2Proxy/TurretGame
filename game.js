const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  wave: document.getElementById("waveLabel"),
  hp: document.getElementById("hpLabel"),
  shield: document.getElementById("shieldLabel"),
  xp: document.getElementById("xpLabel"),
  overlay: document.getElementById("overlay"),
  title: document.getElementById("overlayTitle"),
  subtitle: document.getElementById("overlaySubtitle"),
  choices: document.getElementById("choices"),
  upgradeList: document.getElementById("upgradeList"),
  modPanels: document.getElementById("modPanels"),
};

const center = { x: canvas.width / 2, y: canvas.height / 2 };
const TURRET_RADIUS = 24;
const CORE_COLLISION_RADIUS = 34;
const keys = new Set();
const mouse = { x: center.x, y: center.y, down: false };

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const state = {
  time: 0,
  gameOver: false,
  pausedForUpgrade: false,
  wave: 1,
  enemyBudget: 28,
  spawnTimer: 0,
  spawnRate: 0.76,
  bullets: [],
  enemies: [],
  particles: [],
  effects: [],
  modProjectiles: [],
  score: 0,
  shake: 0,
  activeUpgrades: [],
  modHooks: {
    onInit: [],
    onUpdate: [],
    onDraw: [],
    onEnemyKilled: [],
    onEnemySpawn: [],
    onUpgradeAwarded: [],
    onWaveStart: [],
    onShoot: [],
  },
  modEffectDrawers: {},
  modEnemyById: new Map(),
};

const turret = {
  angle: 0,
  hp: 100,
  maxHp: 100,
  shield: 0,
  maxShield: 0,
  shieldRegen: 0,
  fireRate: 4,
  bulletSpeed: 520,
  bulletDamage: 18,
  bulletSize: 4,
  bulletKnockback: 90,
  spread: 0,
  multiShot: 1,
  pierce: 0,
  critChance: 0.08,
  critMult: 2,
  burn: 0,
  poison: 0,
  poisonDuration: 2.8,
  burnDuration: 2.3,
  lifesteal: 0,
  chainChance: 0,
  chainRange: 130,
  chainDamageFactor: 0.55,
  shieldOnKill: 0,
  vampBurst: 0,
  pulseEvery: 0,
  pulseTimer: 0,
  overdrive: 0,
  overdriveTimer: 0,
  executeThreshold: 0,
  armorShred: 0,
  ricochetChance: 0,
  dodgeChance: 0,
  regen: 0,
  shockTouch: 0,
  orbitals: 0,
  orbitalFireRate: 6.2,
  orbitalDamageMult: 0.52,
  orbitalPierceBonus: 0,
  orbitalRange: 190,
  rotatingShields: 0,
  rotatingShieldRadius: 66,
  rotatingShieldSpeed: 1.8,
  rotatingShieldDamage: 22,
  rotatingShieldKnockback: 250,
  shootCd: 0,
  level: 1,
  xp: 0,
  xpToLevel: 100,
};

const enemyTypes = [
  { id: "runner", color: "#ff6a8f", radius: 12, hp: 34, speed: 95, touch: 11, xp: 11, cost: 6 },
  { id: "tank", color: "#ffd166", radius: 18, hp: 120, speed: 42, touch: 18, xp: 28, cost: 13 },
  { id: "splitter", color: "#8bff95", radius: 14, hp: 56, speed: 67, touch: 13, xp: 18, splitOnDeath: true, cost: 9 },
  { id: "leech", color: "#9f8cff", radius: 11, hp: 46, speed: 78, touch: 10, xp: 16, dodge: 0.18, cost: 10 },
  { id: "bomber", color: "#ff9a3d", radius: 15, hp: 76, speed: 55, touch: 10, xp: 20, explodeRange: 75, explodeDamage: 22, cost: 12 },
];

const upgrades = [
  { name: "Ablative Shield", desc: "+35 max shield, +2 shield regen", apply: () => { turret.maxShield += 35; turret.shield = Math.min(turret.maxShield, turret.shield + 35); turret.shieldRegen += 2; } },
  { name: "Venom Rounds", desc: "Bullets apply +8 poison DoT", apply: () => (turret.poison += 8) },
  { name: "Lifesteal Core", desc: "Heal 8% of bullet damage dealt", apply: () => (turret.lifesteal += 0.08) },
  { name: "Overclock", desc: "+25% fire rate", apply: () => (turret.fireRate *= 1.25) },
  { name: "Piercing Slugs", desc: "+1 bullet pierce", apply: () => (turret.pierce += 1) },
  { name: "Scatter Array", desc: "+1 projectile per shot", apply: () => (turret.multiShot += 1) },
  { name: "Corrosive Fire", desc: "Bullets ignite for +10 burn DoT", apply: () => (turret.burn += 10) },
  { name: "Chain Arc", desc: "+16% chain lightning proc chance", apply: () => (turret.chainChance += 0.16) },
  { name: "Blood Battery", desc: "Gain 6 shield on kill (+10 max)", apply: () => { turret.shieldOnKill += 6; turret.maxShield += 10; } },
  { name: "Orbital Drones", desc: "Spawn an orbiting drone blaster", apply: () => (turret.orbitals += 1), tree: "Orbitals" },
  { name: "Orbital Accelerator", desc: "Orbitals fire 24% faster", apply: () => (turret.orbitalFireRate *= 1.24), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Orbital Rail Mod", desc: "Orbitals deal +22% damage", apply: () => (turret.orbitalDamageMult *= 1.22), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Orbital Piercer", desc: "Orbitals gain +1 pierce", apply: () => (turret.orbitalPierceBonus += 1), tree: "Orbitals", requires: ["Orbital Drones"] },
  { name: "Sonic Pulse", desc: "Emit AoE every 7s (stack = faster)", apply: () => { turret.pulseEvery = Math.max(2.8, turret.pulseEvery ? turret.pulseEvery - 0.8 : 7); turret.pulseTimer = 0; } },
  { name: "Rotating Shield Node", desc: "Gain an always-on rotating shield", apply: () => (turret.rotatingShields += 1), tree: "Shield Grid" },
  { name: "Shield Gyros", desc: "Rotating shields spin faster/hit harder", apply: () => { turret.rotatingShieldSpeed += 0.4; turret.rotatingShieldDamage += 8; }, tree: "Shield Grid", requires: ["Rotating Shield Node"] },
  { name: "Shield Radius Array", desc: "Rotating shields orbit farther out", apply: () => (turret.rotatingShieldRadius += 10), tree: "Shield Grid", requires: ["Rotating Shield Node"] },
];

const ModAPI = {
  registerEnemy(def) {
    if (!def?.id) throw new Error("Enemy must have id");
    const normalized = { cost: 10, xp: 20, radius: 12, speed: 60, touch: 12, color: "#ffffff", hp: 60, ...def };
    enemyTypes.push(normalized);
    state.modEnemyById.set(normalized.id, normalized);
  },
  registerUpgrade(def) {
    if (!def?.name || typeof def.apply !== "function") throw new Error("Upgrade requires name + apply");
    upgrades.push(def);
  },
  registerHook(type, fn) {
    if (!state.modHooks[type]) throw new Error(`Unknown hook ${type}`);
    state.modHooks[type].push(fn);
  },
  registerEffectType(type, draw) {
    state.modEffectDrawers[type] = draw;
  },
  spawnEnemy(typeOrId, overrides = {}) {
    const base = typeof typeOrId === "string" ? state.modEnemyById.get(typeOrId) || enemyTypes.find((e) => e.id === typeOrId) : typeOrId;
    if (base) spawnEnemy(base, false, overrides);
  },
  spawnProjectile(projectileDef) {
    state.modProjectiles.push({ life: 2, radius: 4, ...projectileDef });
  },
  addPanel(id, title, renderText = "") {
    const box = document.createElement("div");
    box.className = "mod-panel";
    box.id = `mod-panel-${id}`;
    box.innerHTML = `<h3>${title}</h3><div>${renderText}</div>`;
    ui.modPanels.appendChild(box);
    return {
      setHtml(html) {
        box.querySelector("div").innerHTML = html;
      },
    };
  },
  addEffect(effect) {
    state.effects.push(effect);
  },
  getContext() {
    return { state, turret, center, canvas, ctx, rand, clamp };
  },
};
window.TurretGameModAPI = ModAPI;

function callHooks(type, payload = {}) {
  for (const hook of state.modHooks[type]) {
    try {
      hook(payload, ModAPI.getContext());
    } catch (err) {
      console.error(`[mod hook:${type}]`, err);
    }
  }
}

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
    // no mods installed, continue silently
  }
}

function refreshUpgradeList() {
  ui.upgradeList.innerHTML = "";
  if (!state.activeUpgrades.length) {
    ui.upgradeList.innerHTML = "<li>None yet — level up to choose boosts.</li>";
    return;
  }
  state.activeUpgrades.slice(-14).forEach((u) => {
    const li = document.createElement("li");
    li.textContent = `${u.name}${u.stacks > 1 ? ` x${u.stacks}` : ""}`;
    ui.upgradeList.appendChild(li);
  });
}

function enemyAtEdge() {
  const p = 30;
  const s = Math.floor(rand(0, 4));
  if (s === 0) return { x: rand(-p, canvas.width + p), y: -p };
  if (s === 1) return { x: canvas.width + p, y: rand(-p, canvas.height + p) };
  if (s === 2) return { x: rand(-p, canvas.width + p), y: canvas.height + p };
  return { x: -p, y: rand(-p, canvas.height + p) };
}

function pickEnemyType() {
  const w = state.wave;
  const r = Math.random();
  if (w < 3) return r < 0.76 ? enemyTypes[0] : enemyTypes[2];
  if (w < 6) return r < 0.5 ? enemyTypes[0] : r < 0.8 ? enemyTypes[2] : enemyTypes[1];
  if (w < 10) return r < 0.33 ? enemyTypes[0] : r < 0.56 ? enemyTypes[2] : r < 0.82 ? enemyTypes[1] : enemyTypes[3];
  return enemyTypes[Math.floor(rand(0, enemyTypes.length))];
}

function spawnEnemy(type = pickEnemyType(), elite = false, overrides = {}) {
  const p = enemyAtEdge();
  const waveScale = 1 + state.wave * 0.1;
  const eliteScale = elite ? 1.8 : 1;
  const enemy = {
    x: p.x,
    y: p.y,
    type,
    hp: type.hp * waveScale * eliteScale,
    maxHp: type.hp * waveScale * eliteScale,
    speed: type.speed * (1 + state.wave * 0.015) * (elite ? 1.08 : 1),
    burn: 0,
    poison: 0,
    burnTimer: 0,
    poisonTimer: 0,
    hitFlash: 0,
    kbX: 0,
    kbY: 0,
    contactTimer: 0,
    dead: false,
    elite,
    ...overrides,
  };
  state.enemies.push(enemy);
  callHooks("onEnemySpawn", { enemy });
  return enemy;
}

function pushEnemy(enemy, fromX, fromY, force) {
  const dx = enemy.x - fromX;
  const dy = enemy.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  enemy.kbX += (dx / d) * force;
  enemy.kbY += (dy / d) * force;
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

function tryShoot(dt) {
  const firing = mouse.down || keys.has(" ");
  turret.shootCd -= dt;
  if (!firing || turret.shootCd > 0) return;
  turret.shootCd = 1 / (turret.fireRate + turret.overdrive);
  for (let i = 0; i < turret.multiShot; i++) {
    fireBullet(turret.angle + (i - (turret.multiShot - 1) / 2) * 0.09 + rand(-turret.spread, turret.spread));
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
  if (turret.vampBurst > 0) turret.overdriveTimer = Math.max(turret.overdriveTimer, 3.1);
  state.shake = Math.min(18, state.shake + amount * 0.26);
  if (turret.hp <= 0) {
    turret.hp = 0;
    state.gameOver = true;
    showEnd();
  }
}

function onEnemyKilled(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.score += enemy.type.xp * (enemy.elite ? 1.6 : 1);
  gainXp(enemy.type.xp * (enemy.elite ? 1.3 : 1));
  if (turret.shieldOnKill > 0) turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldOnKill);

  if (enemy.type.splitOnDeath && !enemy.elite) {
    for (let i = 0; i < 2; i++) spawnEnemy(enemyTypes[0], false, { x: enemy.x + rand(-8, 8), y: enemy.y + rand(-8, 8), hp: 23 + state.wave * 1.9, maxHp: 23 + state.wave * 1.9, speed: 116 + state.wave * 2 });
  }
  if (enemy.type.explodeRange) blast(enemy.x, enemy.y, enemy.type.explodeRange, enemy.type.explodeDamage, true);

  callHooks("onEnemyKilled", { enemy });
}

function blast(x, y, range, damage, hurtsTurret = false) {
  state.effects.push({ type: "ring", x, y, radius: 8, max: range, life: 0.3, color: "#9befff88" });
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < range) {
      enemy.hp -= damage * (1 - (d / range) * 0.65);
      enemy.hitFlash = 0.12;
      pushEnemy(enemy, x, y, 160 * (1 - d / range));
    }
  }
  if (hurtsTurret && Math.hypot(center.x - x, center.y - y) < range + TURRET_RADIUS) dealTurretDamage(damage);
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

function chainLightning(fromEnemy, depth = 0, hit = new Set()) {
  if (depth > 3) return;
  hit.add(fromEnemy);
  const next = state.enemies
    .filter((e) => !e.dead && !hit.has(e))
    .map((e) => ({ enemy: e, d: Math.hypot(e.x - fromEnemy.x, e.y - fromEnemy.y) }))
    .filter((e) => e.d <= turret.chainRange)
    .sort((a, b) => a.d - b.d)[0];
  if (!next) return;
  const target = next.enemy;
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
    const angle = state.time * turret.rotatingShieldSpeed + (Math.PI * 2 * i) / turret.rotatingShields;
    const sx = center.x + Math.cos(angle) * turret.rotatingShieldRadius;
    const sy = center.y + Math.sin(angle) * turret.rotatingShieldRadius;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(enemy.x - sx, enemy.y - sy) <= enemy.type.radius + 10) {
        enemy.hp -= turret.rotatingShieldDamage * dt * 2;
        enemy.hitFlash = 0.12;
        pushEnemy(enemy, sx, sy, turret.rotatingShieldKnockback * dt);
      }
    }
  }
}

function awardUpgrade(upgrade) {
  upgrade.apply();
  const existing = state.activeUpgrades.find((x) => x.name === upgrade.name);
  if (existing) existing.stacks += 1;
  else state.activeUpgrades.push({ name: upgrade.name, stacks: 1 });
  refreshUpgradeList();
  callHooks("onUpgradeAwarded", { upgrade });
}

function eligibleUpgrades() {
  return upgrades.filter((u) => !u.requires || u.requires.every((r) => state.activeUpgrades.some((x) => x.name === r)));
}

function showUpgradeSelection() {
  state.pausedForUpgrade = true;
  ui.overlay.classList.remove("hidden");
  ui.title.textContent = `Level ${turret.level} upgrade`;
  ui.subtitle.textContent = "Pick your power spike";
  ui.choices.innerHTML = "";
  const picks = [...eligibleUpgrades()].sort(() => Math.random() - 0.5).slice(0, 3);
  picks.forEach((u) => {
    const card = document.createElement("button");
    card.className = "choice";
    card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}${u.tree ? ` · Tree: ${u.tree}` : ""}</p>`;
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

function startNextWave() {
  state.wave += 1;
  state.enemyBudget = Math.floor(28 + state.wave * 8 + Math.pow(state.wave, 1.28) * 2.4);
  state.spawnRate = clamp(0.76 - state.wave * 0.017, 0.16, 1);
  gainXp(30 + state.wave * 7);
  if (state.wave % 5 === 0) spawnEnemy(enemyTypes[Math.min(enemyTypes.length - 1, Math.floor(state.wave / 4))], true);
  callHooks("onWaveStart", { wave: state.wave });
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
      const hitDist = (p.radius || 4) + enemy.type.radius;
      if (Math.hypot(p.x - enemy.x, p.y - enemy.y) <= hitDist) {
        if (p.onHit) p.onHit(enemy, p, ModAPI.getContext());
        if (!p.piercing) p.life = 0;
      }
    }
  }
  state.modProjectiles = state.modProjectiles.filter((p) => p.life > 0);
}

function update(dt) {
  if (state.pausedForUpgrade || state.gameOver) return;
  state.time += dt;
  state.shake *= 0.86;
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

  state.spawnTimer -= dt;
  if (state.enemyBudget > 0 && state.spawnTimer <= 0) {
    const type = pickEnemyType();
    if (type.cost <= state.enemyBudget || state.enemyBudget < 8) {
      spawnEnemy(type);
      state.enemyBudget -= type.cost;
      state.spawnTimer = state.spawnRate * rand(0.78, 1.18);
    } else state.enemyBudget -= 1;
  }

  if (state.enemyBudget <= 0 && state.enemies.filter((e) => !e.dead).length === 0) startNextWave();

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < -30 || bullet.x > canvas.width + 30 || bullet.y < -30 || bullet.y > canvas.height + 30) { bullet.dead = true; continue; }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) > enemy.type.radius + bullet.radius) continue;
      if (enemy.type.dodge && Math.random() < enemy.type.dodge) { bullet.dead = true; break; }

      let dmg = bullet.damage * (Math.random() < turret.critChance ? turret.critMult : 1);
      if (enemy.hp / enemy.maxHp > 0.75) dmg *= 1 + turret.armorShred;
      enemy.hp -= dmg;
      enemy.hitFlash = 0.11;
      pushEnemy(enemy, center.x, center.y, turret.bulletKnockback);

      if (bullet.poison > 0) { enemy.poison = Math.max(enemy.poison, bullet.poison); enemy.poisonTimer = turret.poisonDuration; }
      if (bullet.burn > 0) { enemy.burn = Math.max(enemy.burn, bullet.burn); enemy.burnTimer = turret.burnDuration; }
      if (turret.executeThreshold > 0 && enemy.hp > 0 && enemy.hp / enemy.maxHp < turret.executeThreshold) enemy.hp = 0;
      if (turret.lifesteal > 0) turret.hp = Math.min(turret.maxHp, turret.hp + dmg * turret.lifesteal);

      if (enemy.hp <= 0) onEnemyKilled(enemy);
      else if (turret.chainChance > 0 && Math.random() < turret.chainChance) chainLightning(enemy);

      if (turret.ricochetChance > 0 && Math.random() < turret.ricochetChance) { bullet.vx *= -1; bullet.vy *= -1; bullet.pierce = Math.max(bullet.pierce, 0); }
      else if (--bullet.pierce < 0) { bullet.dead = true; break; }
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt + enemy.kbX * dt;
    enemy.y += (dy / dist) * enemy.speed * dt + enemy.kbY * dt;
    enemy.kbX *= 0.82;
    enemy.kbY *= 0.82;

    if (enemy.poisonTimer > 0) { enemy.poisonTimer -= dt; enemy.hp -= enemy.poison * dt; }
    if (enemy.burnTimer > 0) { enemy.burnTimer -= dt; enemy.hp -= enemy.burn * dt; }

    const coreDist = Math.hypot(enemy.x - center.x, enemy.y - center.y);
    const minDist = CORE_COLLISION_RADIUS + enemy.type.radius;
    if (coreDist < minDist) {
      const nx = (enemy.x - center.x) / (coreDist || 1);
      const ny = (enemy.y - center.y) / (coreDist || 1);
      const pushOut = minDist - coreDist;
      enemy.x += nx * pushOut;
      enemy.y += ny * pushOut;
      enemy.kbX += nx * 30;
      enemy.kbY += ny * 30;
      enemy.contactTimer += dt;
      if (enemy.contactTimer >= 0.08) { dealTurretDamage(enemy.type.touch * 0.5); enemy.contactTimer = 0; }
      if (turret.shockTouch > 0 && Math.random() < turret.shockTouch * dt * 4) enemy.hp -= turret.bulletDamage * 0.85;
      if (enemy.type.id === "bomber") enemy.hp = -1;
    } else enemy.contactTimer = 0;

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (enemy.hp <= 0) onEnemyKilled(enemy);
  }

  for (let i = 0; i < turret.orbitals; i++) {
    const a = state.time * 1.85 + (Math.PI * 2 * i) / turret.orbitals;
    const ox = center.x + Math.cos(a) * 88;
    const oy = center.y + Math.sin(a) * 88;
    const t = state.enemies.filter((e) => !e.dead).map((e) => ({ e, d: Math.hypot(e.x - ox, e.y - oy) })).sort((a1, b1) => a1.d - b1.d)[0];
    if (t && t.d < turret.orbitalRange && Math.random() < dt * turret.orbitalFireRate) {
      fireBullet(Math.atan2(t.e.y - oy, t.e.x - ox), turret.orbitalDamageMult, 0.9, 3, turret.orbitalPierceBonus);
    }
  }

  callHooks("onUpdate", { dt });

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => e.hp > 0 && !e.dead);
  ui.wave.textContent = `Wave ${state.wave}`;
  ui.hp.textContent = `HP: ${Math.ceil(turret.hp)} / ${Math.ceil(turret.maxHp)}`;
  ui.shield.textContent = `Shield: ${Math.ceil(turret.shield)}${turret.maxShield ? ` / ${Math.ceil(turret.maxShield)}` : ""}`;
  ui.xp.textContent = `XP: ${Math.floor(turret.xp)} / ${turret.xpToLevel}`;
}

function draw() {
  const shakeX = rand(-state.shake, state.shake);
  const shakeY = rand(-state.shake, state.shake);
  ctx.save();
  ctx.translate(shakeX, shakeY);
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
    } else if (state.modEffectDrawers[fx.type]) {
      state.modEffectDrawers[fx.type](fx, ctx, ModAPI.getContext());
    }
  }
  state.effects = state.effects.filter((fx) => fx.life === undefined || fx.life > 0);

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
window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

refreshUpgradeList();
loadMods().finally(() => requestAnimationFrame(loop));
