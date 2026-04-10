import { dist2 } from './enemies.js';
import { addRing, addBurst } from './particles.js';
import { WORLD_H, WORLD_W } from './constants.js';

export const BOSS_SPAWN_TIME = 120; // 2 minutes
export const BOSS_RESPAWN_DELAY = 90;

const BASE_HP = 3000;
const CONTACT_DAMAGE_MULT = 1.4;
const PROJECTILE_DAMAGE_MULT = 1.4;
const SPEED_MULT = 1.25;
const PHASE_TWO_THRESHOLD = 0.68;
const PHASE_THREE_THRESHOLD = 0.33;
const TRANSITION_DURATION = 1.5;
const PHASE_ONE_TELEGRAPH_SCALE = 0.85;
const PHASE_TUNING = {
  1: {
    lookAhead: 0.48,
    laneCut: 0.22,
    ringCd: 2.7,
    ringShots: 10,
    ringSpeed: 206,
    shootCd: 1.35,
    shootSpread: 3,
    shootSpeed: 278,
    shotArc: 0.17,
  },
  2: {
    lookAhead: 0.62,
    laneCut: 0.34,
    ringCd: 1.75,
    ringShots: 14,
    ringSpeed: 208,
    shootCd: 0.88,
    shootSpread: 4,
    shootSpeed: 252,
    shotArc: 0.15,
    spiralCd: 1.95,
    spiralArms: 4,
    chargeCd: 7,
  },
  3: {
    lookAhead: 0.78,
    laneCut: 0.42,
    ringCd: 1.15,
    ringShots: 18,
    ringSpeed: 238,
    shootCd: 0.58,
    shootSpread: 6,
    shootSpeed: 290,
    shotArc: 0.13,
    spiralCd: 1.35,
    spiralArms: 5,
    chargeCd: 4.5,
    mineCd: 2.45,
    mineCount: 5,
    barrageCd: 10,
    barrageShots: 18,
  },
};

export function mkBoss(gt, player, viewH, worldW = WORLD_W, worldH = WORLD_H) {
  const cycleScale = 1 + Math.floor(gt / 180) * 0.25;
  const baseHp = Math.round(BASE_HP * cycleScale);
  const hpScale = Math.max(1, gt / 120);
  const scaledHp = Math.round(baseHp * hpScale);
  const margin = 34 + 8;
  const spawnDist = viewH * 0.4;
  return {
    x: clamp(player.x, margin, worldW - margin),
    y: clamp(player.y - spawnDist, margin, worldH - margin),
    r: 34,
    baseHp,
    hp: scaledHp,
    maxHp: scaledHp,
    spd: 78 * SPEED_MULT,
    dmg: 30 * CONTACT_DAMAGE_MULT,
    xp: 110,
    col: '#E24B4A',
    phase: 1,
    angle: 0,
    phaseTimer: 0,
    shootT: 0,
    shootWindupT: 0,
    ringT: 0,
    ringWindupT: 0,
    barrageT: 0,
    barrageWindupT: 0,
    spiralT: 0,
    mineT: 0,
    chargeT: 4,
    chargeWindupT: 0,
    charging: false,
    chargeVx: 0,
    chargeVy: 0,
    chargeTargetX: 0,
    chargeTargetY: 0,
    chargeDir: 0,
    chargeHit: false,
    transitionT: 0,
    transitionFlash: 0,
    transitionShockT: 0,
    transitionShockDur: 1.05,
    hitFlash: 0,
    isBoss: true,
    frozen: false,
    freezeMeter: 0,
    freezeThreshold: 999,
    freezeCooldown: 0,
    frozenTimer: 0,
    frostLevel: 0,
    bossFreezeCooldown: 0,
    freezeImmune: false,
    stunned: false,
    stunT: 0,
    stunImmune: false,
    slowT: 0,
    spdMult: 1,
    empMarkT: 0,
    alive: true,
    arenaW: worldW,
    arenaH: worldH,
  };
}

export function updateBoss(boss, P, dt, handlers) {
  if (!boss || !boss.alive) return;

  const {
    onHitPlayer,
    onSpawnBullet,
    onPhaseChange,
    onTransitionTax,
    onClearEnemyBullets,
  } = handlers;

  boss.phaseTimer += dt;
  boss.angle += dt * (boss.phase === 3 ? 5.1 : boss.phase === 2 ? 3.9 : 2.2);
  if (boss.hitFlash > 0) boss.hitFlash -= dt;
  if (boss.transitionFlash > 0) boss.transitionFlash -= dt;
  if (boss.transitionShockT > 0) boss.transitionShockT -= dt;
  if (boss.empMarkT > 0) boss.empMarkT -= dt;

  if (boss.frozen) {
    if (boss.freezeImmune) {
      boss.frozen = false;
      boss.frozenTimer = 0;
    } else {
      boss.frozenTimer -= dt;
      if (boss.frozenTimer <= 0) boss.frozen = false;
    }
  }
  if (boss.stunned) {
    if (boss.stunImmune) {
      boss.stunned = false;
      boss.stunT = 0;
    } else {
      boss.stunT -= dt;
      if (boss.stunT <= 0) boss.stunned = false;
    }
  }
  if (boss.slowT > 0) {
    boss.slowT -= dt;
    if (boss.slowT <= 0) boss.spdMult = 1;
  }

  if (boss.phase === 1 && boss.hp <= boss.maxHp * PHASE_TWO_THRESHOLD) {
    beginPhaseTransition(boss, 2, P, onClearEnemyBullets, onTransitionTax, onPhaseChange);
  } else if (boss.phase === 2 && boss.hp <= boss.maxHp * PHASE_THREE_THRESHOLD) {
    beginPhaseTransition(boss, 3, P, onClearEnemyBullets, onTransitionTax, onPhaseChange);
  }

  if (boss.transitionT > 0) {
    boss.transitionT -= dt;
    if (boss.transitionT <= 0) {
      boss.transitionT = 0;
      boss.transitionFlash = 0.45;
    }
    return;
  }

  if (boss.stunned || boss.frozen) return;

  if (boss.chargeWindupT > 0) {
    boss.chargeWindupT -= dt;
    boss.transitionFlash = Math.max(boss.transitionFlash, 0.08);
    if (boss.chargeWindupT <= 0) {
      launchCharge(boss);
    }
  }

  if (boss.charging) {
    updateCharge(boss, P, dt, onHitPlayer, onSpawnBullet);
    return;
  }

  const move = getMovementVector(boss, P);
  const spd = boss.slowT > 0 ? boss.spd * (boss.spdMult || 0.5) : boss.spd;
  boss.x += move.x * spd * dt;
  boss.y += move.y * spd * dt;
  clampBossToArena(boss);

  if (Math.sqrt(dist2(boss, P)) < boss.r + P.r) onHitPlayer(boss.dmg);

  tickRingAttack(boss, dt, onSpawnBullet);
  tickShotAttack(boss, P, dt, onSpawnBullet);
  tickSpiralAttack(boss, dt, onSpawnBullet);
  tickMines(boss, dt, onSpawnBullet);
  tickBarrage(boss, dt, onSpawnBullet);
  tickChargePrep(boss, P, dt);
}

export function drawBoss(ctx, boss) {
  if (!boss || !boss.alive) return;

  const col = boss.hitFlash > 0 ? '#fff'
    : boss.transitionFlash > 0 ? '#fff'
    : boss.frozen ? '#00CFFF'
    : boss.stunned ? '#BF77FF'
    : boss.phase === 3 ? '#8A2BE2'
    : boss.phase === 2 ? '#D4537E'
    : '#E24B4A';

  if (boss.transitionShockT > 0) {
    const progress = 1 - boss.transitionShockT / boss.transitionShockDur;
    const maxR = Math.sqrt(boss.arenaW ** 2 + boss.arenaH ** 2);
    const shockR = Math.max(24, maxR * progress);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 - progress * 0.55})`;
    ctx.lineWidth = 10 - progress * 4;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, shockR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.shadowColor = col;
  ctx.shadowBlur = boss.phase === 3 ? 40 : boss.phase === 2 ? 30 : 20;

  ctx.fillStyle = col + '55';
  ctx.strokeStyle = col;
  ctx.lineWidth = boss.chargeWindupT > 0 ? 4 : 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = boss.angle + (i / 6) * Math.PI * 2;
    i === 0
      ? ctx.moveTo(boss.x + Math.cos(a) * boss.r, boss.y + Math.sin(a) * boss.r)
      : ctx.lineTo(boss.x + Math.cos(a) * boss.r, boss.y + Math.sin(a) * boss.r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = boss.chargeWindupT > 0 ? '#ffffffcc' : col + 'aa';
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const innerSides = boss.phase === 3 ? 4 : 3;
  for (let i = 0; i < innerSides; i++) {
    const a = -boss.angle * 1.6 + (i / innerSides) * Math.PI * 2;
    const ir = boss.r * (boss.phase === 3 ? 0.6 : 0.55);
    i === 0
      ? ctx.moveTo(boss.x + Math.cos(a) * ir, boss.y + Math.sin(a) * ir)
      : ctx.lineTo(boss.x + Math.cos(a) * ir, boss.y + Math.sin(a) * ir);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (boss.phase >= 2) {
    ctx.strokeStyle = boss.chargeWindupT > 0 ? '#ffffffaa' : col + '77';
    ctx.lineWidth = boss.phase === 3 ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.r + 8 + Math.sin(boss.angle * 2.2) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (boss.chargeWindupT > 0) {
    const chargeA = boss.chargeDir || 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(
      boss.x + Math.cos(chargeA) * 80,
      boss.y + Math.sin(chargeA) * 80
    );
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  if (boss.frozen) {
    ctx.strokeStyle = 'rgba(0,207,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (boss.stunned) {
    ctx.strokeStyle = 'rgba(191,119,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function hitBoss(boss, dmg, col, isSynergy = false) {
  if (!boss || !boss.alive) return;
  if (boss.transitionT > 0) return;
  boss.hp -= dmg;
  boss.hitFlash = 0.08;
  addBurst(boss.x, boss.y, col, isSynergy ? 5 : 2, isSynergy ? 80 : 50, 3, 0.28);
}

function beginPhaseTransition(boss, nextPhase, P, onClearEnemyBullets, onTransitionTax, onPhaseChange) {
  applyPhaseState(boss, nextPhase);
  boss.transitionT = TRANSITION_DURATION;
  boss.transitionFlash = TRANSITION_DURATION;
  boss.transitionShockT = boss.transitionShockDur;
  boss.charging = false;
  boss.chargeWindupT = 0;
  boss.shootWindupT = 0;
  boss.ringWindupT = 0;
  boss.barrageWindupT = 0;
  boss.frozen = false;
  boss.frozenTimer = 0;
  boss.freezeMeter = 0;
  boss.stunned = false;
  boss.stunT = 0;
  onClearEnemyBullets();
  addBurst(boss.x, boss.y, '#ffffff', 28, 220, 7, 0.9);
  addRing(boss.x, boss.y, 180, '#ffffff', 4.5, 0.9);
  addRing(boss.x, boss.y, 240, boss.col, 3, 0.75);
  onTransitionTax();
  teleportOppositePlayer(boss, P);
  onPhaseChange();
}

function applyPhaseState(boss, phase) {
  boss.phase = phase;
  if (phase === 2) {
    boss.spd = 108 * SPEED_MULT;
    boss.dmg = 30 * CONTACT_DAMAGE_MULT;
    boss.col = '#D4537E';
    boss.chargeT = 2.8;
    boss.spiralT = 0.4;
    boss.freezeImmune = false;
  } else if (phase === 3) {
    boss.spd = 130 * SPEED_MULT;
    boss.dmg = 34 * CONTACT_DAMAGE_MULT;
    boss.col = '#8A2BE2';
    boss.chargeT = 1.2;
    boss.mineT = 0.35;
    boss.barrageT = 3.4;
    boss.spiralT = 0.25;
    boss.freezeImmune = true;
    boss.stunImmune = true;
  }
}

function tickChargePrep(boss, P, dt) {
  if (boss.phase < 2 || boss.chargeWindupT > 0 || boss.charging) return;
  boss.chargeT -= dt;
  if (boss.chargeT > 0) return;
  boss.chargeT = PHASE_TUNING[boss.phase].chargeCd;
  boss.chargeWindupT = 0.6;
  boss.chargeTargetX = P.x;
  boss.chargeTargetY = P.y;
  boss.chargeDir = Math.atan2(P.y - boss.y, P.x - boss.x);
  addRing(boss.x, boss.y, boss.phase === 3 ? 86 : 72, '#ffffff', 2.5, 0.35);
  addRing(boss.chargeTargetX, boss.chargeTargetY, boss.phase === 3 ? 34 : 26, 'rgba(255,255,255,0.85)', 2.2, 0.3);
  addBurst(boss.x, boss.y, boss.col, 10, 110, 4, 0.35);
}

function launchCharge(boss) {
  boss.charging = true;
  boss.chargeHit = false;
  const dir = Math.atan2(boss.chargeTargetY - boss.y, boss.chargeTargetX - boss.x);
  const speed = boss.phase === 3 ? 760 : 640;
  boss.chargeDir = dir;
  boss.chargeVx = Math.cos(dir) * speed;
  boss.chargeVy = Math.sin(dir) * speed;
}

function updateCharge(boss, P, dt, onHitPlayer, onSpawnBullet) {
  const prevDx = boss.chargeTargetX - boss.x;
  const prevDy = boss.chargeTargetY - boss.y;
  boss.x += boss.chargeVx * dt;
  boss.y += boss.chargeVy * dt;
  clampBossToArena(boss);

  if (!boss.chargeHit && dist2(boss, P) < (boss.r + P.r) ** 2) {
    onHitPlayer(boss.dmg * 1.5);
    boss.chargeHit = true;
    boss.charging = false;
    addBurst(boss.x, boss.y, '#ffffff', 12, 130, 5, 0.4);
    addRing(boss.x, boss.y, 92, boss.col, 2.4, 0.32);
    if (boss.phase === 3) fireChargeSpread(boss, onSpawnBullet);
    return;
  }

  const nextDx = boss.chargeTargetX - boss.x;
  const nextDy = boss.chargeTargetY - boss.y;
  const reachedTarget = prevDx * nextDx + prevDy * nextDy <= 0;
  if (!reachedTarget) return;

  boss.x = boss.chargeTargetX;
  boss.y = boss.chargeTargetY;
  boss.charging = false;
  addBurst(boss.x, boss.y, '#ffffff', 12, 130, 5, 0.4);
  addRing(boss.x, boss.y, boss.phase === 3 ? 120 : 96, boss.col, 2.2, 0.35);
  if (boss.phase >= 2) fireChargeCrashBurst(boss, onSpawnBullet);
  if (boss.phase === 3) fireChargeSpread(boss, onSpawnBullet);
}

function fireChargeSpread(boss, onSpawnBullet) {
  const spreadArc = 1.3;
  const start = boss.chargeDir - spreadArc * 0.5;
  for (let i = 0; i < 6; i++) {
    const a = start + (spreadArc / 5) * i;
    onSpawnBullet(
      boss.x,
      boss.y,
      Math.cos(a) * 230,
      Math.sin(a) * 230,
      6,
      16 * PROJECTILE_DAMAGE_MULT,
      '#ffffff',
      { life: 3.8 }
    );
  }
}

function tickRingAttack(boss, dt, onSpawnBullet) {
  if (boss.ringWindupT > 0) {
    boss.ringWindupT -= dt;
    if (boss.ringWindupT <= 0) fireRingAttack(boss, onSpawnBullet);
    return;
  }

  boss.ringT -= dt;
  if (boss.ringT > 0) return;

  boss.ringT = PHASE_TUNING[boss.phase].ringCd;
  const baseTelegraph = 0.4;
  boss.ringWindupT = boss.phase === 1 ? baseTelegraph * PHASE_ONE_TELEGRAPH_SCALE : baseTelegraph;
  addRing(boss.x, boss.y, boss.phase === 3 ? 255 : 225, '#ffffff', 2, 0.28);
}

function fireRingAttack(boss, onSpawnBullet) {
  const tune = PHASE_TUNING[boss.phase];
  const shots = tune.ringShots;
  const speed = tune.ringSpeed;
  const dmg = (boss.phase === 3 ? 17 : 14) * PROJECTILE_DAMAGE_MULT;
  for (let i = 0; i < shots; i++) {
    const a = (i / shots) * Math.PI * 2 + boss.angle;
    onSpawnBullet(boss.x, boss.y, Math.cos(a) * speed, Math.sin(a) * speed, boss.phase === 3 ? 7 : 6, dmg, boss.col);
  }
}

function tickShotAttack(boss, P, dt, onSpawnBullet) {
  if (boss.shootWindupT > 0) {
    boss.shootWindupT -= dt;
    if (boss.shootWindupT <= 0) fireShotAttack(boss, P, onSpawnBullet);
    return;
  }

  boss.shootT -= dt;
  const shootRate = PHASE_TUNING[boss.phase].shootCd;
  if (boss.shootT > 0) return;

  boss.shootT = shootRate;
  const baseTelegraph = 0.26;
  boss.shootWindupT = boss.phase === 1 ? baseTelegraph * PHASE_ONE_TELEGRAPH_SCALE : baseTelegraph;
  addRing(boss.x, boss.y, boss.phase === 3 ? 58 : 46, '#ffffff', 1.5, 0.2);
}

function fireShotAttack(boss, P, onSpawnBullet) {
  const tune = PHASE_TUNING[boss.phase];
  const spread = tune.shootSpread;
  const baseA = Math.atan2(P.y - boss.y, P.x - boss.x);
  const speed = tune.shootSpeed;
  const dmg = (boss.phase === 3 ? 17 : 15) * PROJECTILE_DAMAGE_MULT;
  for (let i = 0; i < spread; i++) {
    const off = (i - (spread - 1) / 2) * tune.shotArc;
    onSpawnBullet(boss.x, boss.y, Math.cos(baseA + off) * speed, Math.sin(baseA + off) * speed, 6, dmg, '#FFB627');
  }
}

function tickSpiralAttack(boss, dt, onSpawnBullet) {
  boss.spiralT -= dt;
  if (boss.spiralT > 0) return;

  const tune = PHASE_TUNING[boss.phase];
  boss.spiralT = tune.spiralCd || 99;
  const arms = tune.spiralArms || 0;
  for (let i = 0; i < arms; i++) {
    const a = boss.angle * 1.35 + (i / arms) * Math.PI * 2;
    onSpawnBullet(boss.x, boss.y, Math.cos(a) * 165, Math.sin(a) * 165, 5, 12 * PROJECTILE_DAMAGE_MULT, '#ffffff', { life: 4.5 });
    onSpawnBullet(boss.x, boss.y, Math.cos(a + 0.18) * 195, Math.sin(a + 0.18) * 195, 5, 12 * PROJECTILE_DAMAGE_MULT, boss.col, { life: 4.5 });
    if (boss.phase >= 2) {
      onSpawnBullet(boss.x, boss.y, Math.cos(a - 0.18) * 215, Math.sin(a - 0.18) * 215, 5, 12 * PROJECTILE_DAMAGE_MULT, boss.col, { life: 4.5 });
      onSpawnBullet(boss.x, boss.y, Math.cos(a + 0.38) * 185, Math.sin(a + 0.38) * 185, 5, 11 * PROJECTILE_DAMAGE_MULT, '#ffffff', { life: 4.1 });
    }
  }
}

function tickMines(boss, dt, onSpawnBullet) {
  if (boss.phase !== 3) return;
  boss.mineT -= dt;
  if (boss.mineT > 0) return;

  const tune = PHASE_TUNING[3];
  boss.mineT = tune.mineCd;
  const baseA = boss.angle * 0.7;
  for (let i = 0; i < tune.mineCount; i++) {
    const a = baseA + (i / tune.mineCount) * Math.PI * 2;
    onSpawnBullet(
      boss.x + Math.cos(a) * 18,
      boss.y + Math.sin(a) * 18,
      Math.cos(a) * (95 * 1.25),
      Math.sin(a) * (95 * 1.25),
      9,
      20 * PROJECTILE_DAMAGE_MULT,
      '#8A2BE2',
      { life: 5.5 * 1.25 }
    );
  }
}

function tickBarrage(boss, dt, onSpawnBullet) {
  if (boss.phase !== 3) return;

  if (boss.barrageWindupT > 0) {
    boss.barrageWindupT -= dt;
    if (boss.barrageWindupT <= 0) fireBarrage(boss, onSpawnBullet);
    return;
  }

  boss.barrageT -= dt;
  if (boss.barrageT > 0) return;

  boss.barrageT = PHASE_TUNING[3].barrageCd;
  boss.barrageWindupT = 0.8;
  addRing(boss.x, boss.y, 150, '#ffffff', 2.5, 0.42);
  addBurst(boss.x, boss.y, '#8A2BE2', 8, 120, 3.5, 0.3);
}

function fireBarrage(boss, onSpawnBullet) {
  fireBarrageRing(boss, 0, onSpawnBullet);
  fireBarrageRing(boss, Math.PI / 16, onSpawnBullet);
}

function fireBarrageRing(boss, offset, onSpawnBullet) {
  const shots = PHASE_TUNING[3].barrageShots;
  for (let i = 0; i < shots; i++) {
    const a = offset + (i / shots) * Math.PI * 2;
    onSpawnBullet(
      boss.x,
      boss.y,
      Math.cos(a) * 210,
      Math.sin(a) * 210,
      6,
      18 * PROJECTILE_DAMAGE_MULT,
      '#ffffff',
      { life: 4.4 }
    );
  }
}

function getMovementVector(boss, P) {
  const vx = P.vx || 0;
  const vy = P.vy || 0;
  const lookAhead = PHASE_TUNING[boss.phase].lookAhead;
  const interceptX = P.x + vx * lookAhead;
  const interceptY = P.y + vy * lookAhead;
  const dx = interceptX - boss.x;
  const dy = interceptY - boss.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;

  const laneCutStrength = PHASE_TUNING[boss.phase].laneCut;
  const tangentX = -dy / d;
  const tangentY = dx / d;
  const cutDir = (boss.x - P.x) * (P.vy || 0) - (boss.y - P.y) * (P.vx || 0) > 0 ? -1 : 1;

  const moveX = dx / d + tangentX * laneCutStrength * cutDir;
  const moveY = dy / d + tangentY * laneCutStrength * cutDir;
  const moveD = Math.sqrt(moveX * moveX + moveY * moveY) || 1;
  return { x: moveX / moveD, y: moveY / moveD };
}

function teleportOppositePlayer(boss, P) {
  const margin = boss.r + 22;
  boss.x = clamp(boss.arenaW - P.x, margin, boss.arenaW - margin);
  boss.y = clamp(boss.arenaH - P.y, margin, boss.arenaH - margin);
}

function clampBossToArena(boss) {
  const margin = boss.r + 8;
  boss.x = clamp(boss.x, margin, boss.arenaW - margin);
  boss.y = clamp(boss.y, margin, boss.arenaH - margin);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function fireChargeCrashBurst(boss, onSpawnBullet) {
  const shots = boss.phase === 3 ? 10 : 8;
  const offset = boss.phase === 3 ? Math.PI / 10 : Math.PI / 8;
  for (let i = 0; i < shots; i++) {
    const a = boss.chargeDir + offset + (i / shots) * Math.PI * 2;
    onSpawnBullet(
      boss.x,
      boss.y,
      Math.cos(a) * (boss.phase === 3 ? 180 : 150),
      Math.sin(a) * (boss.phase === 3 ? 180 : 150),
      5,
      (boss.phase === 3 ? 13 : 10) * PROJECTILE_DAMAGE_MULT,
      boss.col,
      { life: 2.8 }
    );
  }
}
