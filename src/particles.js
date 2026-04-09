export let particles = [];
const MAX_PARTICLES = 900;

export function updateParticles(dt) {
  particles = particles.filter(p => {
    p.life -= dt;
    if (p.tp === 'ring') p.r += p.mr / (p.lt || 0.4) * dt;
    else { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.r *= 0.88; }
    return p.life > 0 && p.r > 0;
  });
}

export function addRing(x, y, mr, col, lw = 2, life = 0.4) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ tp: 'ring', x, y, r: 0, mr, life, lt: life, col, lw });
}

export function addBurst(x, y, col, n = 6, speed = 80, size = 2.5, life = 0.35) {
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;
  const count = Math.max(1, Math.min(n, room, room < 120 ? Math.ceil(n * 0.4) : n));
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random());
    particles.push({ tp: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: size, life, lt: life, col });
  }
}

export function addDot(x, y, col, r = 5, life = 0.1) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ tp: 'dot', x, y, r, life, lt: life, col });
}

export function drawParticles(ctx) {
  particles.forEach(p => {
    const a = Math.max(0, p.tp === 'ring' ? p.life / (p.lt || 0.4) : p.life / (p.lt || 0.3));
    ctx.globalAlpha = a;
    if (p.tp === 'ring') {
      ctx.strokeStyle = p.col; ctx.lineWidth = p.lw || 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}
