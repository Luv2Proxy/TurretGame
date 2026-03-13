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
};

const center = { x: canvas.width / 2, y: canvas.height / 2 };
const keys = new Set();
const mouse = { x: center.x, y: center.y, down: false };

const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const state = {
  time: 0,
  gameOver: false,
  pausedForUpgrade: false,
  wave: 1,
  enemiesToSpawn: 8,
  spawnTimer: 0,
  spawnRate: 0.9,
  bullets: [],
  enemies: [],
  particles: [],
  effects: [],
  score: 0,
  shake: 0,
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
  shootCd: 0,
  level: 1,
  xp: 0,
  xpToLevel: 100,
};

const enemyTypes = [
  {
    id: "runner",
    color: "#ff6a8f",
    radius: 12,
    hp: 34,
    speed: 92,
    touch: 10,
    xp: 12,
  },
  {
    id: "tank",
    color: "#ffd166",
    radius: 18,
    hp: 120,
    speed: 40,
    touch: 16,
    xp: 28,
  },
  {
    id: "splitter",
    color: "#8bff95",
    radius: 14,
    hp: 55,
    speed: 64,
    touch: 11,
    xp: 18,
    splitOnDeath: true,
  },
  {
    id: "leech",
    color: "#9f8cff",
    radius: 11,
    hp: 45,
    speed: 74,
    touch: 9,
    xp: 16,
    dodge: 0.2,
  },
  {
    id: "bomber",
    color: "#ff9a3d",
    radius: 15,
    hp: 70,
    speed: 52,
    touch: 9,
    xp: 20,
    explodeRange: 70,
    explodeDamage: 22,
  },
];

const upgrades = [
  {
    name: "Ablative Shield",
    desc: "+35 max shield, +2 shield regen",
    apply: () => {
      turret.maxShield += 35;
      turret.shield = Math.min(turret.maxShield, turret.shield + 35);
      turret.shieldRegen += 2;
    },
  },
  {
    name: "Venom Rounds",
    desc: "Bullets apply poison (damage over time)",
    apply: () => {
      turret.poison += 8;
    },
  },
  {
    name: "Lifesteal Core",
    desc: "Heal 8% of bullet damage dealt",
    apply: () => {
      turret.lifesteal += 0.08;
    },
  },
  {
    name: "Overclock",
    desc: "+25% fire rate",
    apply: () => {
      turret.fireRate *= 1.25;
    },
  },
  {
    name: "Piercing Slugs",
    desc: "+1 bullet pierce",
    apply: () => {
      turret.pierce += 1;
    },
  },
  {
    name: "Scatter Array",
    desc: "+1 projectile per shot",
    apply: () => {
      turret.multiShot += 1;
    },
  },
  {
    name: "Corrosive Fire",
    desc: "Bullets ignite enemies for extra burn",
    apply: () => {
      turret.burn += 10;
    },
  },
  {
    name: "Chain Arc",
    desc: "Chance for lightning bounce between enemies",
    apply: () => {
      turret.chainChance += 0.16;
    },
  },
  {
    name: "Blood Battery",
    desc: "Gain 6 shield on kill",
    apply: () => {
      turret.shieldOnKill += 6;
      turret.maxShield += 10;
    },
  },
  {
    name: "Orbital Drones",
    desc: "Summon an orbiting drone blaster",
    apply: () => {
      turret.orbitals += 1;
    },
  },
  {
    name: "Sonic Pulse",
    desc: "Emit AoE shockwave every 7s",
    apply: () => {
      turret.pulseEvery = Math.max(3.4, turret.pulseEvery ? turret.pulseEvery - 0.9 : 7);
      turret.pulseTimer = 0;
    },
  },
  {
    name: "Berserk Protocol",
    desc: "Taking damage grants overdrive briefly",
    apply: () => {
      turret.vampBurst += 1;
    },
  },
];

function enemyAtEdge() {
  const padding = 30;
  const side = Math.floor(rand(0, 4));
  if (side === 0) return { x: rand(-padding, canvas.width + padding), y: -padding };
  if (side === 1) return { x: canvas.width + padding, y: rand(-padding, canvas.height + padding) };
  if (side === 2) return { x: rand(-padding, canvas.width + padding), y: canvas.height + padding };
  return { x: -padding, y: rand(-padding, canvas.height + padding) };
}

function spawnEnemy() {
  const rarityRoll = Math.random() + state.wave * 0.03;
  let type = enemyTypes[0];
  if (rarityRoll > 0.3) type = enemyTypes[1];
  if (rarityRoll > 0.8) type = enemyTypes[2];
  if (rarityRoll > 1.25) type = enemyTypes[3];
  if (rarityRoll > 1.7) type = enemyTypes[4];

  const p = enemyAtEdge();
  const scale = 1 + state.wave * 0.09;
  state.enemies.push({
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    type,
    hp: type.hp * scale,
    maxHp: type.hp * scale,
    speed: type.speed * (1 + state.wave * 0.02),
    burn: 0,
    poison: 0,
    burnTimer: 0,
    poisonTimer: 0,
    hitFlash: 0,
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
  if (amount <= 0) return;
  let remaining = amount;
  if (turret.shield > 0) {
    const absorbed = Math.min(turret.shield, remaining);
    turret.shield -= absorbed;
    remaining -= absorbed;
  }
  turret.hp -= remaining;
  if (turret.vampBurst > 0) turret.overdriveTimer = Math.max(turret.overdriveTimer, 3.2);
  state.shake = Math.min(18, state.shake + amount * 0.3);
  if (turret.hp <= 0) {
    turret.hp = 0;
    state.gameOver = true;
    showEnd();
  }
}

function onEnemyKilled(enemy) {
  state.score += enemy.type.xp;
  gainXp(enemy.type.xp);
  if (turret.shieldOnKill > 0) {
    turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldOnKill);
  }

  if (enemy.type.splitOnDeath) {
    for (let i = 0; i < 2; i++) {
      state.enemies.push({
        x: enemy.x + rand(-8, 8),
        y: enemy.y + rand(-8, 8),
        type: enemyTypes[0],
        hp: 22 + state.wave * 1.8,
        maxHp: 22 + state.wave * 1.8,
        speed: 110 + state.wave * 2,
        burn: 0,
        poison: 0,
        burnTimer: 0,
        poisonTimer: 0,
        hitFlash: 0,
      });
    }
  }

  if (enemy.type.explodeRange) {
    blast(enemy.x, enemy.y, enemy.type.explodeRange, enemy.type.explodeDamage, true);
  }

  for (let i = 0; i < 11; i++) {
    state.particles.push({
      x: enemy.x,
      y: enemy.y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.25, 0.55),
      color: enemy.type.color,
      radius: rand(1.5, 3.2),
    });
  }
}

function blast(x, y, range, damage, hurtsTurret = false) {
  state.effects.push({ type: "ring", x, y, radius: 8, max: range, life: 0.3 });
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < range) {
      enemy.hp -= damage * (1 - d / range * 0.65);
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
    turret.xpToLevel = Math.floor(turret.xpToLevel * 1.18);
    showUpgradeSelection();
  }
}

function chainLightning(fromEnemy, depth = 0, hit = new Set()) {
  if (depth > 3) return;
  hit.add(fromEnemy);
  const candidates = state.enemies
    .filter((enemy) => !hit.has(enemy))
    .map((enemy) => ({ enemy, d: Math.hypot(enemy.x - fromEnemy.x, enemy.y - fromEnemy.y) }))
    .filter((entry) => entry.d <= turret.chainRange)
    .sort((a, b) => a.d - b.d);

  if (!candidates.length) return;
  const target = candidates[0].enemy;
  const damage = turret.bulletDamage * turret.chainDamageFactor * (1 - depth * 0.14);
  target.hp -= damage;
  target.hitFlash = 0.2;
  state.effects.push({
    type: "bolt",
    x1: fromEnemy.x,
    y1: fromEnemy.y,
    x2: target.x,
    y2: target.y,
    life: 0.08,
  });
  if (target.hp <= 0) onEnemyKilled(target);
  chainLightning(target, depth + 1, hit);
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
      upgrade.apply();
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
  ui.subtitle.textContent = `You reached wave ${state.wave} with score ${Math.floor(state.score)}. Click to retry.`;
  ui.choices.innerHTML = "";
  const retry = document.createElement("button");
  retry.className = "choice";
  retry.innerHTML = "<h3>Run it back</h3><p>Start a new insane run.</p>";
  retry.onclick = () => window.location.reload();
  ui.choices.appendChild(retry);
}

function update(dt) {
  if (state.pausedForUpgrade || state.gameOver) return;

  state.time += dt;
  state.shake *= 0.86;
  turret.overdrive = turret.overdriveTimer > 0 ? 5 : 0;
  turret.overdriveTimer = Math.max(0, turret.overdriveTimer - dt);

  turret.angle = Math.atan2(mouse.y - center.y, mouse.x - center.x);
  tryShoot(dt);

  if (turret.maxShield > 0) {
    turret.shield = Math.min(turret.maxShield, turret.shield + turret.shieldRegen * dt);
  }

  if (turret.pulseEvery > 0) {
    turret.pulseTimer += dt;
    if (turret.pulseTimer >= turret.pulseEvery) {
      turret.pulseTimer = 0;
      blast(center.x, center.y, 165, 40 + turret.level * 2);
    }
  }

  state.spawnTimer -= dt;
  if (state.enemiesToSpawn > 0 && state.spawnTimer <= 0) {
    spawnEnemy();
    state.enemiesToSpawn -= 1;
    state.spawnTimer = Math.max(0.18, state.spawnRate - state.wave * 0.015);
  }

  if (state.enemiesToSpawn <= 0 && state.enemies.length === 0) {
    state.wave += 1;
    state.enemiesToSpawn = 7 + state.wave * 3;
    state.spawnRate = Math.max(0.22, 0.92 - state.wave * 0.03);
    gainXp(35 + state.wave * 5);
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.x < -20 || bullet.x > canvas.width + 20 || bullet.y < -20 || bullet.y > canvas.height + 20) {
      bullet.dead = true;
      continue;
    }

    for (const enemy of state.enemies) {
      const d = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (d > enemy.type.radius + bullet.radius) continue;

      if (enemy.type.dodge && Math.random() < enemy.type.dodge) {
        bullet.dead = true;
        break;
      }

      const crit = Math.random() < turret.critChance;
      const dmg = bullet.damage * (crit ? turret.critMult : 1);
      enemy.hp -= dmg;
      enemy.hitFlash = 0.12;

      if (bullet.poison > 0) {
        enemy.poison = Math.max(enemy.poison, bullet.poison);
        enemy.poisonTimer = 2.6;
      }
      if (bullet.burn > 0) {
        enemy.burn = Math.max(enemy.burn, bullet.burn);
        enemy.burnTimer = 2.1;
      }

      if (turret.lifesteal > 0) {
        turret.hp = Math.min(turret.maxHp, turret.hp + dmg * turret.lifesteal);
      }

      if (enemy.hp <= 0) {
        onEnemyKilled(enemy);
      } else if (turret.chainChance > 0 && Math.random() < turret.chainChance) {
        chainLightning(enemy);
      }

      bullet.pierce -= 1;
      if (bullet.pierce < 0) {
        bullet.dead = true;
        break;
      }
    }
  }

  for (const enemy of state.enemies) {
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    if (enemy.poisonTimer > 0) {
      enemy.poisonTimer -= dt;
      enemy.hp -= enemy.poison * dt;
    }
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.hp -= enemy.burn * dt;
    }

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

    if (dist < enemy.type.radius + 25) {
      dealTurretDamage(enemy.type.touch * dt * 2.4);
      if (enemy.type.id === "bomber") enemy.hp = -1;
    }

    if (enemy.hp <= 0) onEnemyKilled(enemy);
  }

  const orbitCount = turret.orbitals;
  for (let i = 0; i < orbitCount; i++) {
    const angle = state.time * 1.8 + (Math.PI * 2 * i) / orbitCount;
    const ox = center.x + Math.cos(angle) * 88;
    const oy = center.y + Math.sin(angle) * 88;

    const target = state.enemies
      .map((enemy) => ({ enemy, d: Math.hypot(enemy.x - ox, enemy.y - oy) }))
      .sort((a, b) => a.d - b.d)[0];

    if (target && target.d < 185 && Math.random() < dt * 6.2) {
      const a = Math.atan2(target.enemy.y - oy, target.enemy.x - ox);
      fireBullet(a, 0.52, 0.86, 3);
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
    if (fx.type === "ring") fx.radius += (fx.max - fx.radius) * 0.32;
  }

  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.particles = state.particles.filter((p) => p.life > 0);
  state.effects = state.effects.filter((fx) => fx.life > 0);

  ui.wave.textContent = `Wave ${state.wave}`;
  ui.hp.textContent = `HP: ${Math.ceil(turret.hp)}`;
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
      ctx.strokeStyle = "#97eeff88";
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
    }
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = "#abf7ff";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.hitFlash ? "#ffffff" : enemy.type.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.type.radius, 0, Math.PI * 2);
    ctx.fill();

    const hpW = enemy.type.radius * 1.8;
    ctx.fillStyle = "#0008";
    ctx.fillRect(enemy.x - hpW / 2, enemy.y - enemy.type.radius - 10, hpW, 4);
    ctx.fillStyle = "#78ff8f";
    ctx.fillRect(
      enemy.x - hpW / 2,
      enemy.y - enemy.type.radius - 10,
      hpW * clamp(enemy.hp / enemy.maxHp, 0, 1),
      4
    );
  }

  for (let i = 0; i < turret.orbitals; i++) {
    const a = state.time * 1.8 + (Math.PI * 2 * i) / turret.orbitals;
    const x = center.x + Math.cos(a) * 88;
    const y = center.y + Math.sin(a) * 88;
    ctx.fillStyle = "#8cffef";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const shieldRadius = 26 + (turret.maxShield > 0 ? 12 * (turret.shield / Math.max(1, turret.maxShield)) : 0);
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
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
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

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});
window.addEventListener("mouseup", () => {
  mouse.down = false;
});
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

requestAnimationFrame(loop);
