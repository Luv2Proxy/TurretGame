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
};

const center = { x: canvas.width / 2, y: canvas.height / 2 };
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
  score: 0,
  shake: 0,
  activeUpgrades: [],
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
  spread: 0,
  multiShot: 1,
  pierce: 0,
  critChance: 0.08,
  critMult: 2,
  burn: 0,
  poison: 0,
  lifesteal: 0,
  chainChance: 0,
  chainRange: 130,
  chainDamageFactor: 0.55,
  shieldOnKill: 0,
  vampBurst: 0,
  orbitals: 0,
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
  {
    id: "bomber",
    color: "#ff9a3d",
    radius: 15,
    hp: 76,
    speed: 55,
    touch: 10,
    xp: 20,
    explodeRange: 75,
    explodeDamage: 22,
    cost: 12,
  },
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
  { name: "Orbital Drones", desc: "Spawn an orbiting drone blaster", apply: () => (turret.orbitals += 1) },
  { name: "Sonic Pulse", desc: "Emit AoE every 7s (stack = faster)", apply: () => { turret.pulseEvery = Math.max(2.8, turret.pulseEvery ? turret.pulseEvery - 0.8 : 7); turret.pulseTimer = 0; } },
  { name: "Berserk Protocol", desc: "Taking damage grants overdrive", apply: () => (turret.vampBurst += 1) },
  { name: "Titan Core", desc: "+35 max HP and +2 regen", apply: () => { turret.maxHp += 35; turret.hp += 35; turret.regen += 2; } },
  { name: "Plasma Spread", desc: "+0.025 spread for wider cone", apply: () => (turret.spread += 0.025) },
  { name: "High Velocity", desc: "+20% bullet speed, +2 damage", apply: () => { turret.bulletSpeed *= 1.2; turret.bulletDamage += 2; } },
  { name: "Execution Protocol", desc: "Execute enemies below +7% HP", apply: () => (turret.executeThreshold += 0.07) },
  { name: "Armor Shred", desc: "Bullets deal 10% more to healthy targets", apply: () => (turret.armorShred += 0.1) },
  { name: "Static Armor", desc: "20% chance to zap touching enemies", apply: () => (turret.shockTouch += 0.2) },
  { name: "Ricochet Matrix", desc: "18% chance bullets bounce once", apply: () => (turret.ricochetChance += 0.18) },
  { name: "Phase Plating", desc: "+6% chance to dodge incoming damage", apply: () => (turret.dodgeChance += 0.06) },
  { name: "Critical Lens", desc: "+9% crit chance", apply: () => (turret.critChance += 0.09) },
  { name: "Critical Core", desc: "+0.45 crit multiplier", apply: () => (turret.critMult += 0.45) },
  { name: "Heavy Caliber", desc: "+7 bullet damage", apply: () => (turret.bulletDamage += 7) },
];

function refreshUpgradeList() {
  ui.upgradeList.innerHTML = "";
  if (!state.activeUpgrades.length) {
    ui.upgradeList.innerHTML = "<li>None yet — level up to choose boosts.</li>";
    return;
  }
  state.activeUpgrades.slice(-11).forEach((upgrade) => {
    const li = document.createElement("li");
    li.textContent = `${upgrade.name} ${upgrade.stacks > 1 ? `x${upgrade.stacks}` : ""}`;
    ui.upgradeList.appendChild(li);
  });
}

function enemyAtEdge() {
  const pad = 30;
  const side = Math.floor(rand(0, 4));
  if (side === 0) return { x: rand(-pad, canvas.width + pad), y: -pad };
  if (side === 1) return { x: canvas.width + pad, y: rand(-pad, canvas.height + pad) };
  if (side === 2) return { x: rand(-pad, canvas.width + pad), y: canvas.height + pad };
  return { x: -pad, y: rand(-pad, canvas.height + pad) };
}

function pickEnemyType() {
  const wave = state.wave;
  const chance = Math.random();
  if (wave < 3) return chance < 0.76 ? enemyTypes[0] : enemyTypes[2];
  if (wave < 6) return chance < 0.5 ? enemyTypes[0] : chance < 0.8 ? enemyTypes[2] : enemyTypes[1];
  if (wave < 10) return chance < 0.33 ? enemyTypes[0] : chance < 0.56 ? enemyTypes[2] : chance < 0.82 ? enemyTypes[1] : enemyTypes[3];
  return chance < 0.22 ? enemyTypes[0] : chance < 0.45 ? enemyTypes[1] : chance < 0.66 ? enemyTypes[2] : chance < 0.85 ? enemyTypes[3] : enemyTypes[4];
}

function spawnEnemy(type = pickEnemyType(), elite = false) {
  const p = enemyAtEdge();
  const waveScale = 1 + state.wave * 0.1;
  const eliteScale = elite ? 1.8 : 1;
  state.enemies.push({
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
    elite,
  });
}

function fireBullet(angle, dmgMult = 1, speedMult = 1, size = turret.bulletSize) {
  state.bullets.push({
    x: center.x + Math.cos(angle) * 30,
    y: center.y + Math.sin(angle) * 30,
    vx: Math.cos(angle) * turret.bulletSpeed * speedMult,
    vy: Math.sin(angle) * turret.bulletSpeed * speedMult,
    damage: turret.bulletDamage * dmgMult,
    radius: size,
    pierce: turret.pierce,
    poison: turret.poison,
    burn: turret.burn,
    dead: false,
  });
}

function tryShoot(dt) {
  const firing = mouse.down || keys.has(" ");
  turret.shootCd -= dt;
  if (!firing || turret.shootCd > 0) return;

  turret.shootCd = 1 / (turret.fireRate + turret.overdrive);
  for (let i = 0; i < turret.multiShot; i++) {
    const spreadOffset = (i - (turret.multiShot - 1) / 2) * 0.09 + rand(-turret.spread, turret.spread);
    fireBullet(turret.angle + spreadOffset);
  }
}

function dealTurretDamage(amount) {
  if (amount <= 0 || state.gameOver) return;
  if (Math.random() < turret.dodgeChance) {
    state.effects.push({ type: "text", text: "DODGE", x: center.x + rand(-20, 20), y: center.y - 36, color: "#75f8ff", life: 0.32 });
    return;
  }

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
    for (let i = 0; i < 2; i++) {
      state.enemies.push({
        x: enemy.x + rand(-8, 8),
        y: enemy.y + rand(-8, 8),
        type: enemyTypes[0],
        hp: 23 + state.wave * 1.9,
        maxHp: 23 + state.wave * 1.9,
        speed: 116 + state.wave * 2,
        burn: 0,
        poison: 0,
        burnTimer: 0,
        poisonTimer: 0,
        hitFlash: 0,
      });
    }
  }

  if (enemy.type.explodeRange) blast(enemy.x, enemy.y, enemy.type.explodeRange, enemy.type.explodeDamage, true);

  for (let i = 0; i < 10; i++) {
    state.particles.push({ x: enemy.x, y: enemy.y, vx: rand(-120, 120), vy: rand(-120, 120), life: rand(0.2, 0.5), color: enemy.type.color, radius: rand(1.4, 3.1) });
  }
}

function blast(x, y, range, damage, hurtsTurret = false) {
  state.effects.push({ type: "ring", x, y, radius: 8, max: range, life: 0.3, color: "#9befff88" });
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < range) {
      enemy.hp -= damage * (1 - (d / range) * 0.65);
      enemy.hitFlash = 0.12;
    }
  }
  if (hurtsTurret) {
    const distTurret = Math.hypot(center.x - x, center.y - y);
    if (distTurret < range + 24) dealTurretDamage(damage);
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

function chainLightning(fromEnemy, depth = 0, hit = new Set()) {
  if (depth > 3) return;
  hit.add(fromEnemy);
  const candidates = state.enemies
    .filter((enemy) => !hit.has(enemy) && !enemy.dead)
    .map((enemy) => ({ enemy, d: Math.hypot(enemy.x - fromEnemy.x, enemy.y - fromEnemy.y) }))
    .filter((entry) => entry.d <= turret.chainRange)
    .sort((a, b) => a.d - b.d);
  if (!candidates.length) return;

  const target = candidates[0].enemy;
  const damage = turret.bulletDamage * turret.chainDamageFactor * (1 - depth * 0.14);
  target.hp -= damage;
  target.hitFlash = 0.2;
  state.effects.push({ type: "bolt", x1: fromEnemy.x, y1: fromEnemy.y, x2: target.x, y2: target.y, life: 0.09 });

  if (target.hp <= 0) onEnemyKilled(target);
  chainLightning(target, depth + 1, hit);
}

function awardUpgrade(upgrade) {
  upgrade.apply();
  const existing = state.activeUpgrades.find((entry) => entry.name === upgrade.name);
  if (existing) existing.stacks += 1;
  else state.activeUpgrades.push({ name: upgrade.name, stacks: 1 });
  refreshUpgradeList();
}

function showUpgradeSelection() {
  state.pausedForUpgrade = true;
  ui.overlay.classList.remove("hidden");
  ui.title.textContent = `Level ${turret.level} upgrade`;
  ui.subtitle.textContent = "Pick your power spike";
  ui.choices.innerHTML = "";

  const picks = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
  picks.forEach((upgrade) => {
    const card = document.createElement("button");
    card.className = "choice";
    card.innerHTML = `<h3>${upgrade.name}</h3><p>${upgrade.desc}</p>`;
    card.onclick = () => {
      awardUpgrade(upgrade);
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
  const baseBudget = 28 + state.wave * 8 + Math.pow(state.wave, 1.28) * 2.4;
  state.enemyBudget = Math.floor(baseBudget);
  state.spawnRate = clamp(0.76 - state.wave * 0.017, 0.16, 1);
  gainXp(30 + state.wave * 7);

  if (state.wave % 5 === 0) {
    spawnEnemy(enemyTypes[Math.min(4, Math.floor(state.wave / 4))], true);
  }
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

  if (turret.maxShield > 0) turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldRegen * dt);

  if (turret.pulseEvery > 0) {
    turret.pulseTimer += dt;
    if (turret.pulseTimer >= turret.pulseEvery) {
      turret.pulseTimer = 0;
      state.effects.push({ type: "ring", x: center.x, y: center.y, radius: 8, max: 170, life: 0.32, color: "#9cf2ff88" });
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
    } else {
      state.enemyBudget -= 1;
    }
  }

  if (state.enemyBudget <= 0 && state.enemies.filter((enemy) => !enemy.dead).length === 0) {
    startNextWave();
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    if (bullet.x < -30 || bullet.x > canvas.width + 30 || bullet.y < -30 || bullet.y > canvas.height + 30) {
      bullet.dead = true;
      continue;
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const d = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (d > enemy.type.radius + bullet.radius) continue;

      if (enemy.type.dodge && Math.random() < enemy.type.dodge) {
        bullet.dead = true;
        break;
      }

      const crit = Math.random() < turret.critChance;
      let dmg = bullet.damage * (crit ? turret.critMult : 1);
      if (enemy.hp / enemy.maxHp > 0.75) dmg *= 1 + turret.armorShred;
      enemy.hp -= dmg;
      enemy.hitFlash = 0.11;

      if (bullet.poison > 0) {
        enemy.poison = Math.max(enemy.poison, bullet.poison);
        enemy.poisonTimer = 2.8;
      }
      if (bullet.burn > 0) {
        enemy.burn = Math.max(enemy.burn, bullet.burn);
        enemy.burnTimer = 2.3;
      }

      if (turret.executeThreshold > 0 && enemy.hp > 0 && enemy.hp / enemy.maxHp < turret.executeThreshold) {
        enemy.hp = 0;
        state.effects.push({ type: "text", text: "EXECUTE", x: enemy.x, y: enemy.y - 20, color: "#ffd889", life: 0.35 });
      }

      if (turret.lifesteal > 0) turret.hp = Math.min(turret.maxHp, turret.hp + dmg * turret.lifesteal);

      if (enemy.hp <= 0) onEnemyKilled(enemy);
      else if (turret.chainChance > 0 && Math.random() < turret.chainChance) chainLightning(enemy);

      if (turret.ricochetChance > 0 && Math.random() < turret.ricochetChance) {
        bullet.vx *= -1;
        bullet.vy *= -1;
        bullet.pierce = Math.max(bullet.pierce, 0);
      } else {
        bullet.pierce -= 1;
        if (bullet.pierce < 0) {
          bullet.dead = true;
          break;
        }
      }
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;

    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    if (enemy.poisonTimer > 0) {
      enemy.poisonTimer -= dt;
      enemy.hp -= enemy.poison * dt;
      if (Math.random() < dt * 12) {
        state.particles.push({ x: enemy.x + rand(-8, 8), y: enemy.y + rand(-8, 8), vx: rand(-20, 20), vy: rand(-30, 0), life: 0.22, color: "#57f267", radius: 2.2 });
      }
    }
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.hp -= enemy.burn * dt;
      if (Math.random() < dt * 13) {
        state.particles.push({ x: enemy.x + rand(-8, 8), y: enemy.y + rand(-8, 8), vx: rand(-18, 18), vy: rand(-45, -10), life: 0.19, color: "#ff9a43", radius: 2.4 });
      }
    }

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

    if (dist < enemy.type.radius + 26) {
      dealTurretDamage(enemy.type.touch * dt * 2.45);
      if (turret.shockTouch > 0 && Math.random() < turret.shockTouch * dt * 3.5) {
        enemy.hp -= turret.bulletDamage * 0.8;
        state.effects.push({ type: "bolt", x1: center.x, y1: center.y, x2: enemy.x, y2: enemy.y, life: 0.07 });
      }
      if (enemy.type.id === "bomber") enemy.hp = -1;
    }

    if (enemy.hp <= 0) onEnemyKilled(enemy);
  }

  for (let i = 0; i < turret.orbitals; i++) {
    const a = state.time * 1.85 + (Math.PI * 2 * i) / turret.orbitals;
    const ox = center.x + Math.cos(a) * 88;
    const oy = center.y + Math.sin(a) * 88;
    const target = state.enemies
      .filter((enemy) => !enemy.dead)
      .map((enemy) => ({ enemy, d: Math.hypot(enemy.x - ox, enemy.y - oy) }))
      .sort((aItem, bItem) => aItem.d - bItem.d)[0];

    if (target && target.d < 190 && Math.random() < dt * 6.2) {
      const aim = Math.atan2(target.enemy.y - oy, target.enemy.x - ox);
      fireBullet(aim, 0.52, 0.9, 3);
      state.effects.push({ type: "muzzle", x: ox, y: oy, life: 0.06 });
    }
  }

  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }

  for (const fx of state.effects) {
    fx.life -= dt;
    if (fx.type === "ring") fx.radius += (fx.max - fx.radius) * 0.3;
    if (fx.type === "text") fx.y -= dt * 32;
  }

  state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && !enemy.dead);
  state.particles = state.particles.filter((particle) => particle.life > 0);
  state.effects = state.effects.filter((effect) => effect.life > 0);

  ui.wave.textContent = `Wave ${state.wave}`;
  ui.hp.textContent = `HP: ${Math.ceil(turret.hp)} / ${Math.ceil(turret.maxHp)}`;
  ui.shield.textContent = `Shield: ${Math.ceil(turret.shield)}${turret.maxShield ? ` / ${Math.ceil(turret.maxShield)}` : ""}`;
  ui.xp.textContent = `XP: ${Math.floor(turret.xp)} / ${turret.xpToLevel}`;
}

function drawBackground() {
  ctx.save();
  ctx.fillStyle = "#0b1327";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grid = 38;
  ctx.strokeStyle = "#65deff14";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  const shakeX = rand(-state.shake, state.shake);
  const shakeY = rand(-state.shake, state.shake);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();

  for (const fx of state.effects) {
    if (fx.type === "ring") {
      ctx.strokeStyle = fx.color || "#97eeff88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === "bolt") {
      ctx.strokeStyle = "#b4e7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    } else if (fx.type === "muzzle") {
      ctx.fillStyle = "#e0fdff";
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.type === "text") {
      ctx.fillStyle = fx.color;
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.fillText(fx.text, fx.x, fx.y);
    }
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = "#abf7ff";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    if (enemy.poisonTimer > 0) {
      ctx.fillStyle = "#57f26733";
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.type.radius + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.burnTimer > 0) {
      ctx.fillStyle = "#ff9a432b";
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.type.radius + 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = enemy.hitFlash ? "#ffffff" : enemy.type.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.type.radius + (enemy.elite ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();

    const hpW = enemy.type.radius * 1.9;
    ctx.fillStyle = "#0008";
    ctx.fillRect(enemy.x - hpW / 2, enemy.y - enemy.type.radius - 11, hpW, 4);
    ctx.fillStyle = "#78ff8f";
    ctx.fillRect(enemy.x - hpW / 2, enemy.y - enemy.type.radius - 11, hpW * clamp(enemy.hp / enemy.maxHp, 0, 1), 4);
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

  const shieldRadius = 27 + (turret.maxShield > 0 ? 12 * (turret.shield / Math.max(1, turret.maxShield)) : 0);
  if (turret.shield > 0.1) {
    ctx.strokeStyle = "#69d7ff99";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, shieldRadius, 0, Math.PI * 2);
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

  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life * 3, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
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

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});
window.addEventListener("mouseup", () => {
  mouse.down = false;
});
window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

refreshUpgradeList();
requestAnimationFrame(loop);
