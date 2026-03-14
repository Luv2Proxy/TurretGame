(() => {
  const api = window.TurretGameModAPI;
  if (!api) return;

  const panel = api.addPanel("example", "Example Mod", "Loaded ✓");

  api.registerEnemy({
    id: "glitch",
    color: "#56f0ff",
    radius: 10,
    hp: 52,
    speed: 110,
    touch: 9,
    xp: 18,
    cost: 8,
  });

  api.registerUpgrade({
    name: "Mod: Nova Shot",
    desc: "Every 3 seconds fire a radial burst (modded)",
    tree: "Example Mod Tree",
    apply: () => {
      api.registerHook("onUpdate", ({ dt }, { state, center }) => {
        state.__novaT = (state.__novaT || 0) + dt;
        if (state.__novaT < 3) return;
        state.__novaT = 0;
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 * i) / 10;
          api.spawnProjectile({
            x: center.x,
            y: center.y,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            color: "#9df6ff",
            radius: 3,
            life: 1.2,
            onHit(enemy) {
              enemy.hp -= 16;
            },
          });
        }
      });
    },
  });

  api.registerHook("onWaveStart", ({ wave }) => {
    panel.setHtml(`Loaded ✓<br/>Wave: ${wave}`);
    if (wave % 4 === 0) api.spawnEnemy("glitch");
  });
})();
