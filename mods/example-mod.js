const API = window.TurretGameModAPI;

API.registerEnemyAI("zigzag", (enemy, dt, ctx) => {
  const { center } = ctx;

  const dx = center.x - enemy.x;
  const dy = center.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  // normal chase
  enemy.x += (dx / dist) * enemy.speed * dt;
  enemy.y += (dy / dist) * enemy.speed * dt;

  // zig movement
  enemy.x += Math.sin(performance.now() * 0.004) * 120 * dt;
});

API.registerEnemy({
  id: "zigrunner",
  color: "#ff3de1",
  radius: 12,
  hp: 55,
  speed: 95,
  touch: 12,
  ai: "zigzag"
});
