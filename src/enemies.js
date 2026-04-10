import { addBurst } from './particles.js';
import { applyFreezeMeter } from './weapons.js';
import { hasAscension } from './player.js';

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
    stunT: 0,
    stunned: false,
    frozen: false,
    freezeMeter: 0,
    freezeThreshold: 1,
    freezeCooldown: 0,
    frozenTimer: 0,
    frostLevel: 0,
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
    const maxHp = base.hp;
    enemies.push({
      id: enemyIdCounter++,
      ...base,
      type,
      x: x + ox,
      y,
      maxHp,
      ...mkStatusState(),
      freezeThreshold: Math.ceil(maxHp / 40),
    });
  }
}

export function pruneEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) enemies.splice(i, 1);
  }
}

export function ensureFreezeState(target) {
  if (target.freezeMeter == null) target.freezeMeter = 0;
  if (target.freezeThreshold == null) target.freezeThreshold = Math.max(1, Math.ceil((target.maxHp || 40) / 40));
  if (target.freezeCooldown == null) target.freezeCooldown = 0;
  if (target.frozenTimer == null) target.frozenTimer = 0;
  if (target.frozen == null) target.frozen = false;
  if (target.frostLevel == null) target.frostLevel = 0;
  if (target.isBoss && target.bossFreezeCooldown == null) target.bossFreezeCooldown = 0;
  return target;
}

export function applySlow(target, duration, spdMult = 0.45) {
  target.slowT = Math.max(target.slowT || 0, duration);
  target.spdMult = Math.min(target.spdMult || 1, spdMult);
}

export function applyFreezeBuildup(target, buildup, freezeDuration) {
  ensureFreezeState(target);
  if (target.frozen) {
    target.frozenTimer = Math.max(target.frozenTimer || 0, freezeDuration * 0.25);
    return { froze: false, meter: target.freezeMeter };
  }
  if (target.freezeCooldown > 0 || target.freezeImmune) return { froze: false, meter: target.freezeMeter };
  target.freezeMeter = Math.min(target.freezeThreshold, target.freezeMeter + buildup);
  if (target.freezeMeter >= target.freezeThreshold) {
    target.frozen = true;
    target.frozenTimer = Math.max(target.frozenTimer || 0, freezeDuration);
    target.slowT = 0;
    target.freezeMeter = 0;
    return { froze: true, meter: 0 };
  }
  return { froze: false, meter: target.freezeMeter };
}

function getFrostLevel(e) {
  const threshold = Math.max(1, e.freezeThreshold || 1);
  const fillPct = (e.freezeMeter / threshold) * 100;
  if (fillPct >= 75) return 3;
  if (fillPct >= 50) return 2;
  if (fillPct >= 25) return 1;
  return 0;
}

function maybeSpreadFreeze(frozenEnemy) {
  if ((frozenEnemy._freezeSourceLevel || 0) < 2) return;

  let targetEnemy = null;
  let bestDist = 120 * 120;
  enemies.forEach(e => {
    if (e === frozenEnemy || e.hp <= 0 || e.frozen || e.freezeCooldown > 0) return;
    const d = dist2(frozenEnemy, e);
    if (d < bestDist) {
      bestDist = d;
      targetEnemy = e;
    }
  });

  if (!targetEnemy) return;
  const spreadAmount = (frozenEnemy.maxHp / targetEnemy.maxHp) * (targetEnemy.freezeThreshold * 0.75);
  targetEnemy._freezeSourceLevel = frozenEnemy._freezeSourceLevel || 0;
  applyFreezeMeter(targetEnemy, spreadAmount);
}

export function updateEnemyFreezeState(e, dt, P = null) {
  ensureFreezeState(e);

  if (e.freezeCooldown > 0) e.freezeCooldown = Math.max(0, e.freezeCooldown - dt);
  if (e.isBoss && e.bossFreezeCooldown > 0) e.bossFreezeCooldown = Math.max(0, e.bossFreezeCooldown - dt);

  if (e.frozen) {
    e.frozenTimer = Math.max(0, (e.frozenTimer || 0) - dt);
    if (e.frozenTimer <= 0) {
      e.frozen = false;
      e.frozenTimer = 0;
      e.permafrost = false;
      e.freezeMeter = 0;
      e.freezeCooldown = 4;
      e.frostLevel = 0;
      addBurst(e.x, e.y, '#00CFFF', 8, 75, 2.8, 0.45);
      return;
    }
    e.frostLevel = 3;
    return;
  }

  if (e.freezeMeter >= e.freezeThreshold && e.freezeCooldown <= 0) {
    e.frozen = true;
    e.permafrost = hasAscension(P, 'cryo', 'permafrost');
    e.frozenTimer = e.permafrost ? 99999 : 1.5;
    e.freezeMeter = 0;
    e.slowT = 0;
    e.frostLevel = 3;
    maybeSpreadFreeze(e);
    e._freezeSourceLevel = 0;
    return;
  }

  if (e.freezeCooldown <= 0) {
    e.freezeMeter = Math.max(0, e.freezeMeter - 0.5 * dt);
  }

  e.frostLevel = getFrostLevel(e);
}

export function tickEnemyStatus(e, dt) {
  if (e.stunned) {
    e.stunT -= dt;
    if (e.stunT <= 0) e.stunned = false;
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
