export const enemies = [];
let enemyIdCounter = 1;

export function resetEnemies() {
  enemies.length = 0;
  enemyIdCounter = 1;
}

function mkStatusState() {
  return {
    slowT: 0,
    spdMult: 1,
    frozenT: 0,
    stunT: 0,
    stunned: false,
    frozen: false,
    freezeMeter: 0,
    freezeMeterMax: 100,
    freezeDecayRate: 12,
    cryoPulseCd: 0,
    overloadMarkT: 0,
    empMarkT: 0,
    hitFlash: 0,
  };
}

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
    enemies.push({ id: enemyIdCounter++, ...base, type, x: x + ox, y, maxHp: base.hp, ...mkStatusState() });
  }
}

export function pruneEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) enemies.splice(i, 1);
  }
}

export function ensureFreezeState(target, max = 100) {
  if (target.freezeMeter == null) target.freezeMeter = 0;
  if (target.freezeMeterMax == null) target.freezeMeterMax = max;
  if (target.freezeDecayRate == null) target.freezeDecayRate = 12;
  return target;
}

export function applySlow(target, duration, spdMult = 0.45) {
  target.slowT = Math.max(target.slowT || 0, duration);
  target.spdMult = Math.min(target.spdMult || 1, spdMult);
}

export function applyFreezeBuildup(target, buildup, freezeDuration, freezeMeterMax = 100) {
  ensureFreezeState(target, freezeMeterMax);
  if (target.frozen) {
    target.frozenT = Math.max(target.frozenT || 0, freezeDuration * 0.25);
    return { froze: false, meter: target.freezeMeter };
  }
  target.freezeMeter = Math.min(target.freezeMeterMax, target.freezeMeter + buildup);
  if (target.freezeMeter >= target.freezeMeterMax) {
    target.frozen = true;
    target.frozenT = Math.max(target.frozenT || 0, freezeDuration);
    target.slowT = 0;
    target.freezeMeter = 0;
    return { froze: true, meter: 0 };
  }
  return { froze: false, meter: target.freezeMeter };
}

export function tickEnemyStatus(e, dt) {
  if (e.stunned) {
    e.stunT -= dt;
    if (e.stunT <= 0) e.stunned = false;
  }
  if (e.frozen) {
    e.frozenT -= dt;
    if (e.frozenT <= 0) e.frozen = false;
  } else if (e.freezeMeter > 0) {
    e.freezeMeter = Math.max(0, e.freezeMeter - (e.freezeDecayRate || 12) * dt);
  }
  if (e.slowT > 0) {
    e.slowT -= dt;
    if (e.slowT <= 0) e.spdMult = 1;
  }
  if (e.cryoPulseCd > 0) e.cryoPulseCd -= dt;
  if (e.empMarkT > 0) e.empMarkT -= dt;
  if (e.hitFlash > 0) e.hitFlash -= dt;
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
