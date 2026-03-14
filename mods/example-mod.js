(() => {
  const api = window.TurretGameModAPI;
  if (!api) return;

  const panel = api.addPanel("example", "Example Overdrive Mod", "Loaded ✓");
  const fluxStat = api.registerHudStat("flux", { label: "Flux", format: (v) => `${v.toFixed(1)}%` });

  api.registerAI("zigzag_hunter", (enemy, dt, { center }) => {
    enemy.aiPhase = (enemy.aiPhase || 0) + dt * 4;
    const dx = center.x - enemy.x;
    const dy = center.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const px = -dy / d;
    const py = dx / d;
    enemy.vx += (dx / d) * enemy.speed * dt * 0.9 + px * Math.sin(enemy.aiPhase) * enemy.speed * dt;
    enemy.vy += (dy / d) * enemy.speed * dt * 0.9 + py * Math.sin(enemy.aiPhase) * enemy.speed * dt;
  });

  api.registerEnemy({ id: "glitch", color: "#56f0ff", radius: 10, hp: 58, speed: 115, touch: 10, xp: 20, cost: 8, ai: "zigzag_hunter", weight: 16 });


  api.registerRarity("mythic", {
    label: "Mythic",
    color: "#ff6be8",
    border: "#ff6be8bb",
    glow: "#ff6be899",
  });

  api.registerBoss({
    id: "fracture_core",
    name: "Fracture Core",
    color: "#c684ff",
    radius: 32,
    hp: 1300,
    speed: 52,
    touch: 28,
    xp: 360,
    ai: "zigzag_hunter",
    knockbackResist: 0.85,
  });

  api.registerProjectileType("arcNova", (payload, { center }) => {
    const count = payload.count || 14;
    const speed = payload.speed || 300;
    return Array.from({ length: count }, (_, i) => {
      const a = (Math.PI * 2 * i) / count;
      return {
        x: center.x,
        y: center.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color: payload.color || "#9df6ff",
        radius: 3,
        life: 1.25,
        onHit(enemy) {
          enemy.hp -= payload.damage || 18;
        },
      };
    });
  });

  api.registerUpgrade({
    name: "Mod: Nova Shot",
    desc: "Every 2.8s fire an arc nova",
    tree: "Example Mod Tree",
    rarity: "mythic",
    apply: () => {
      api.registerHook("onUpdate", ({ dt }, { state }) => {
        state.__novaT = (state.__novaT || 0) + dt;
        if (state.__novaT < 2.8) return;
        state.__novaT = 0;
        api.spawnProjectileType("arcNova", { count: 12, damage: 18 });
      });
    },
  });

  api.registerWaveBuilder((waveCtx) => {
    if (waveCtx.wave % 3 === 0) waveCtx.budget += 10;
    if (waveCtx.wave % 4 === 0) waveCtx.spawnRate *= 0.93;
    if (waveCtx.wave === 7) waveCtx.bossId = "fracture_core";
  });

  api.registerUpgradeFilter((choices) => {
    const preferred = choices.filter((c) => c.tree === "Example Mod Tree");
    return preferred.length ? [...preferred, ...choices.filter((c) => c.tree !== "Example Mod Tree")] : choices;
  });

  api.registerHook("onPreUpgradeChoices", (payload) => {
    payload.pickCount = Math.max(payload.pickCount, 4);
  });

  api.setUpgradePickCount(4);

  api.registerKeybind("spawn-glitch", "g", () => {
    api.spawnEnemy("glitch");
    api.createFloatingText("GLITCH DEPLOYED", 420, 130, "#56f0ff");
  });

  api.registerKeybind("spawn-boss", "b", () => {
    api.spawnBoss("fracture_core");
    api.createFloatingText("FRACTURE CORE ARRIVES", 360, 160, "#d9a7ff");
  });

  api.registerHook("onWaveStart", ({ wave, budget, bossId }) => {
    panel.setHtml(`Loaded ✓<br/>Wave: ${wave}<br/>Budget: ${budget}<br/>Boss: ${bossId || "none"}<br/><small>G=glitch B=boss</small>`);
  });

  api.registerHook("onUpdate", ({ dt }, { state }) => {
    state.__flux = (state.__flux || 0) + dt * 18;
    fluxStat.set((Math.sin(state.__flux * 0.05) + 1) * 50);
  });
})();
