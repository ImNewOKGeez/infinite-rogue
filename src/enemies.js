import { addBurst } from './particles.js';
import { applyFreezeMeter } from './weapons.js';
import { hasAscension } from './player.js';
import { WORLD_H, WORLD_W } from './constants.js';

export const enemies = [];
let enemyIdCounter = 1;

const ENEMY_DEFS = {
  runner: { r: 10, baseHp: 16, hpWaveScale: 10 / 16, spd: 115, spdWaveScale: 8, dmg: 8.05, xp: 3, col: '#E24B4A', shape: 'tri' },
  shooter: { r: 12, baseHp: 28, hpWaveScale: 13 / 28, spd: 58, spdWaveScale: 4, dmg: 0, xp: 5, col: '#FFB627', shape: 'circ', shootT: 1, projectileDmg: 11.5 },
  brute: { r: 21, baseHp: 120, hpWaveScale: 40 / 120, spd: 40, spdWaveScale: 3, dmg: 27.6, xp: 12, col: '#D4537E', shape: 'sq' },
  titan: {
    r: 32,
    baseHp: 800,
    hpWaveScale: 0.4,
    spd: 25,
    dmg: 35,
    xp: 40,
    col: '#8B0000',
    glowCol: '#CC0000',
    shape: 'hex',
    stunResist: 0.2,
    freezeThreshMult: 3,
  },
  juggernaut: {
    r: 22,
    baseHp: 180,
    hpWaveScale: 0.4,
    spd: 72,
    dmg: 20,
    xp: 8,
    col: '#FF6600',
    shape: 'pent',
    stunImmune: true,
    slowImmune: true,
    knockImmune: true,
    freezeThreshMult: 2,
  },
  leech: {
    r: 14,
    baseHp: 80,
    hpWaveScale: 0.35,
    spd: 38,
    dmg: 5,
    xp: 15,
    col: '#1A6B3A',
    shieldCol: '#44FF88',
    protectedCol: '#2A9B5A',
    shape: 'diamond',
    shieldR: 80,
    baseShieldHp: 300,
    shieldWaveScale: 50,
  },
};

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

export function getEffectiveFreezeThreshold(target) {
  return Math.max(1, (target.freezeThreshold || 1) * (target.freezeThreshMult || 1));
}

function emitImmuneBurst(target) {
  target._onImmuneBlocked?.(target);
}

export function applyStun(target, duration) {
  if (target.stunImmune) {
    emitImmuneBurst(target);
    return false;
  }
  const stunDuration = duration * (target.stunResist || 1);
  target.stunT = Math.max(target.stunT || 0, stunDuration);
  target.stunned = true;
  return true;
}

export function applySlow(target, duration, spdMult = 0.45) {
  if (target.slowImmune) {
    target.slowT = 0;
    target.spdMult = 1;
    emitImmuneBurst(target);
    return false;
  }
  target.slowT = Math.max(target.slowT || 0, duration);
  target.spdMult = Math.min(target.spdMult || 1, spdMult);
  return true;
}

export function applyKnockback(target, vx, vy, duration = 0.35) {
  if (target.knockImmune) {
    emitImmuneBurst(target);
    return false;
  }
  target._knockVx = vx;
  target._knockVy = vy;
  target._knockT = duration;
  return true;
}

export function getEnemyType(surgeCount, roll) {
  if (surgeCount === 0) return 'runner';

  if (surgeCount === 1) {
    if (roll < 0.70) return 'runner';
    return 'shooter';
  }

  if (surgeCount === 2) {
    if (roll < 0.55) return 'runner';
    if (roll < 0.80) return 'shooter';
    return 'brute';
  }

  if (surgeCount === 3) {
    if (roll < 0.45) return 'runner';
    if (roll < 0.70) return 'shooter';
    if (roll < 0.88) return 'brute';
    return 'titan';
  }

  if (surgeCount === 4) {
    if (roll < 0.35) return 'runner';
    if (roll < 0.58) return 'shooter';
    if (roll < 0.75) return 'brute';
    if (roll < 0.88) return 'titan';
    return 'juggernaut';
  }

  if (roll < 0.28) return 'runner';
  if (roll < 0.46) return 'shooter';
  if (roll < 0.60) return 'brute';
  if (roll < 0.72) return 'titan';
  if (roll < 0.84) return 'juggernaut';
  return 'leech';
}

function buildEnemy(type, x, y, wave, lateGameMult) {
  const base = ENEMY_DEFS[type];
  const maxHp = base.baseHp * (1 + wave * base.hpWaveScale) * lateGameMult;
  const enemy = {
    id: enemyIdCounter++,
    ...base,
    type,
    x: clamp(x, 0, WORLD_W),
    y: clamp(y, 0, WORLD_H),
    maxHp,
    hp: maxHp,
    spd: base.spd + (base.spdWaveScale || 0) * wave,
    dmg: base.dmg * lateGameMult,
    ...mkStatusState(),
    freezeThreshold: Math.ceil(maxHp / 40),
  };

  if (type === 'titan') {
    enemy._pulseOffset = Math.random() * Math.PI * 2;
  }

  if (type === 'leech') {
    const shieldHp = base.baseShieldHp + wave * base.shieldWaveScale;
    enemy.shieldHp = shieldHp;
    enemy.maxShieldHp = shieldHp;
    enemy.shieldActive = true;
    enemy._shieldPopped = false;
  }

  return enemy;
}

export function spawnEnemy(gt, W, H, camX, camY, surgeCount = 0) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const pad = 50;
  if (side === 0) { x = camX + Math.random() * W; y = camY - pad; }
  else if (side === 1) { x = camX + W + pad; y = camY + Math.random() * H; }
  else if (side === 2) { x = camX + Math.random() * W; y = camY + H + pad; }
  else { x = camX - pad; y = camY + Math.random() * H; }
  x = clamp(x, 0, WORLD_W);
  y = clamp(y, 0, WORLD_H);

  const wave = gt < 120
    ? Math.floor(gt / 45)
    : Math.floor(3 + (gt - 120) / 40);
  const lateGameMult = gt > 150 ? 1 + (gt - 150) / 120 : 1;
  const type = getEnemyType(surgeCount, Math.random());
  if (type === 'leech') {
    const activeLeeches = enemies.filter(e => e.type === 'leech' && e.hp > 0).length;
    if (activeLeeches >= 2) return;
  }

  const cnt = (type === 'runner' && Math.random() < 0.55)
    ? (2 + Math.floor(Math.random() * 3)) : 1;

  for (let k = 0; k < cnt; k++) {
    const ox = (k - (cnt - 1) / 2) * 20;
    enemies.push(buildEnemy(type, x + ox, y, wave, lateGameMult));
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

export function applyFreezeBuildup(target, buildup, freezeDuration) {
  ensureFreezeState(target);
  const effectiveThreshold = getEffectiveFreezeThreshold(target);
  if (target.frozen) {
    target.frozenTimer = Math.max(target.frozenTimer || 0, freezeDuration * 0.25);
    return { froze: false, meter: target.freezeMeter };
  }
  if (target.freezeCooldown > 0 || target.freezeImmune) return { froze: false, meter: target.freezeMeter };
  target.freezeMeter = Math.min(effectiveThreshold, target.freezeMeter + buildup);
  if (target.freezeMeter >= effectiveThreshold) {
    target.frozen = true;
    target.frozenTimer = Math.max(target.frozenTimer || 0, freezeDuration);
    target.slowT = 0;
    target.freezeMeter = 0;
    return { froze: true, meter: 0 };
  }
  return { froze: false, meter: target.freezeMeter };
}

function getFrostLevel(e) {
  const threshold = getEffectiveFreezeThreshold(e);
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
  const spreadAmount = (frozenEnemy.maxHp / targetEnemy.maxHp) * (getEffectiveFreezeThreshold(targetEnemy) * 0.75);
  targetEnemy._freezeSourceLevel = frozenEnemy._freezeSourceLevel || 0;
  applyFreezeMeter(targetEnemy, spreadAmount);
}

export function updateEnemyFreezeState(e, dt, P = null) {
  ensureFreezeState(e);
  const effectiveThreshold = getEffectiveFreezeThreshold(e);

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

  if (e.freezeMeter >= effectiveThreshold && e.freezeCooldown <= 0) {
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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
