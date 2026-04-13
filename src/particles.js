export let particles = [];
const MAX_PARTICLES = 900;

export function resetParticles() {
  particles = [];
}

export function updateParticles(dt) {
  particles = particles.filter(p => {
    p.life -= dt;
    if (p.tp === 'ring') {
      p.r += p.mr / (p.lt || 0.4) * dt;
      return p.life > 0 && p.r > 0;
    }
    if (p.tp === 'arc' || p.tp === 'spoke') return p.life > 0;
    if (p.tp === 'frost' || p.tp === 'stun') {
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.r *= 0.88;
      return p.life > 0 && p.r > 0;
    }
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    p.r *= 0.88;
    return p.life > 0 && p.r > 0;
  });
}

export function addRing(x, y, mr, col, lw = 2, life = 0.4, opts = {}) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ tp: 'ring', x, y, r: 0, mr, life, lt: life, col, lw, ...opts });
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

export function addArc(x1, y1, x2, y2, life = 0.3, col = '#BF77FF', opts = {}) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ tp: 'arc', x1, y1, x2, y2, life, lt: life, col, ...opts });
}

export function addFrostTrail(x, y) {
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;
  for (let i = 0; i < 2; i++) {
    particles.push({
      tp: 'frost',
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100,
      life: 0.8,
      lt: 0.8,
      col: '#00CFFF',
      r: 3 + Math.random() * 2
    });
  }
}

export function addStunAura(x, y) {
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;
  particles.push({
    tp: 'stun',
    x,
    y,
    vx: (Math.random() - 0.5) * 20,
    vy: (Math.random() - 0.5) * 20,
    life: 0.4,
    lt: 0.4,
    col: '#BF77FF',
    r: 3 + Math.random()
  });
}

export function drawParticles(ctx) {
  particles.forEach(p => {
    const a = Math.max(0, p.tp === 'ring' ? p.life / (p.lt || 0.4) : p.life / (p.lt || 0.3));
    if (p.tp === 'ring') {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.col;
      ctx.lineWidth = p.lw || 1.5;
      ctx.shadowColor = p.shadowColor || p.col;
      ctx.shadowBlur = p.shadowBlur || 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (p.tp === 'arc') {
      ctx.save();
      const col = p.col || '#BF77FF';
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.glowColor || 'rgba(191, 119, 255, 0.3)';
      ctx.lineWidth = p.glowWidth || 6;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = p.lineWidth || 2;
      ctx.shadowColor = p.shadowColor || col;
      ctx.shadowBlur = p.shadowBlur || 12;
      ctx.globalAlpha = a * 0.9;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (p.tp === 'spoke') {
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = p.col || '#1DFFD0';
      ctx.lineWidth = p.lineWidth || 2;
      ctx.shadowColor = p.shadowColor || p.col || '#1DFFD0';
      ctx.shadowBlur = p.shadowBlur || 10;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.restore();
    } else if (p.tp === 'frost') {
      ctx.fillStyle = p.col;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2); ctx.fill();
    } else if (p.tp === 'stun') {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      const pulse = Math.sin((1 - a) * Math.PI) * 0.5 + 0.5;
      ctx.globalAlpha = pulse * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}
