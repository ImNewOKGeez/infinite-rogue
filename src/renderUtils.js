export function traceEnemyShape(ctx, enemy) {
  ctx.beginPath();
  if (enemy.shape === 'sq') {
    ctx.rect(enemy.x - enemy.r, enemy.y - enemy.r, enemy.r * 2, enemy.r * 2);
    return;
  }

  if (enemy.shape === 'tri') {
    ctx.moveTo(enemy.x, enemy.y - enemy.r);
    ctx.lineTo(enemy.x + enemy.r, enemy.y + enemy.r);
    ctx.lineTo(enemy.x - enemy.r, enemy.y + enemy.r);
    ctx.closePath();
    return;
  }

  if (enemy.shape === 'pent') {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = enemy.x + Math.cos(angle) * enemy.r;
      const py = enemy.y + Math.sin(angle) * enemy.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }

  if (enemy.shape === 'diamond') {
    ctx.moveTo(enemy.x, enemy.y - enemy.r);
    ctx.lineTo(enemy.x + enemy.r, enemy.y);
    ctx.lineTo(enemy.x, enemy.y + enemy.r);
    ctx.lineTo(enemy.x - enemy.r, enemy.y);
    ctx.closePath();
    return;
  }

  if (enemy.shape === 'hex') {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = enemy.x + Math.cos(angle) * enemy.r;
      const py = enemy.y + Math.sin(angle) * enemy.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    return;
  }

  ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
}

export function hexToRgba(hex, alpha = 1) {
  const normalized = String(hex || '').replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(ch => ch + ch).join('')
    : normalized;

  if (full.length !== 6) return `rgba(255,68,68,${alpha})`;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function brightenHexColor(hex, brightnessBoost = 0) {
  const normalized = String(hex || '').replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(ch => ch + ch).join('')
    : normalized;

  if (full.length !== 6) return hex;

  const r = Math.min(255, parseInt(full.slice(0, 2), 16) + brightnessBoost);
  const g = Math.min(255, parseInt(full.slice(2, 4), 16) + brightnessBoost);
  const b = Math.min(255, parseInt(full.slice(4, 6), 16) + brightnessBoost);

  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

