export const enemies = [];

export function resetEnemies() { enemies.length = 0; }

export function spawnEnemy(gt, W, H) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -28; }
  else if (side === 1) { x = W + 28; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + 28; }
  else { x = -28; y = Math.random() * H; }

  const wave = Math.floor(gt / 45);
  const roll = Math.random();
  let type = 'runner';
  if (gt > 80 && roll < 0.22) type = 'brute';
  else if (gt > 40 && roll < 0.42) type = 'shooter';

  const cnt = (type === 'runner' && Math.random() < 0.55)
    ? Math.min(4, 2 + Math.floor(gt / 50)) : 1;

  for (let k = 0; k < cnt; k++) {
    const ox = (k - (cnt - 1) / 2) * 20;
    const base = {
      runner: { r: 10, hp: 16 + wave * 10, spd: 115 + wave * 8, dmg: 7, xp: 3, col: '#E24B4A', shape: 'tri' },
      shooter: { r: 12, hp: 28 + wave * 13, spd: 58 + wave * 4, dmg: 0, xp: 5, col: '#FFB627', shape: 'circ', shootT: 1 },
      brute: { r: 21, hp: 120 + wave * 40, spd: 40 + wave * 3, dmg: 24, xp: 12, col: '#D4537E', shape: 'sq' },
    }[type];
    enemies.push({ ...base, type, x: x + ox, y, maxHp: base.hp, slowT: 0, frozenT: 0, stunT: 0, stunned: false, frozen: false, hitFlash: 0 });
  }
}

export function pruneEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) enemies.splice(i, 1);
  }
}

let _extraTarget = null;
export function setExtraTarget(t) { _extraTarget = t; }
export function clearExtraTarget() { _extraTarget = null; }

export function nearest(P) {
  let best = null, bd = Infinity;
  enemies.forEach(e => { const d = dist2(P, e); if (d < bd) { bd = d; best = e; } });
  // also consider boss (or any extra target) so weapons lock on during boss fights
  if (_extraTarget) { const d = dist2(P, _extraTarget); if (d < bd) best = _extraTarget; }
  return best;
}

export function getExtraTarget() { return _extraTarget; }

export function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}
