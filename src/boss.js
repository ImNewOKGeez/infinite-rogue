import { dist2 } from './enemies.js';
import { addRing, addBurst } from './particles.js';

export const BOSS_SPAWN_TIME = 120; // 2 minutes
export const BOSS_RESPAWN_DELAY = 90;

export function mkBoss(gt, W, H) {
  const scale = 1 + Math.floor(gt / 180) * 0.25; // gets harder each cycle
  return {
    x: W / 2, y: -60,
    r: 30,
    hp: Math.round(1800 * scale),
    maxHp: Math.round(1800 * scale),
    spd: 72,
    dmg: 28,
    xp: 80,
    col: '#E24B4A',
    phase: 1,          // 1 or 2
    angle: 0,          // rotation for draw
    shootT: 0,
    ringT: 0,
    chargeT: 0,        // cooldown between charges
    charging: false,
    chargeVx: 0,
    chargeVy: 0,
    chargeDur: 0,
    hitFlash: 0,
    frozen: false, frozenT: 0,
    stunned: false, stunT: 0,
    slowT: 0, spdMult: 1,
    alive: true,
  };
}

// Returns true if boss transitions to phase 2 this call
export function updateBoss(boss, P, dt, bullets, onHitPlayer, onSpawnBullet, onPhaseTwo) {
  if (!boss || !boss.alive) return;

  boss.angle += dt * (boss.phase === 2 ? 3.5 : 1.8);
  if (boss.hitFlash > 0) boss.hitFlash -= dt;

  // status effects — boss resists, not immune (halved durations applied at hit site)
  if (boss.frozen)  { boss.frozenT -= dt; if (boss.frozenT <= 0) boss.frozen  = false; }
  if (boss.stunned) { boss.stunT   -= dt; if (boss.stunT   <= 0) boss.stunned = false; }
  if (boss.slowT > 0) boss.slowT -= dt;

  // phase 2 transition
  if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.phase = 2;
    boss.spd = 115;
    boss.col = '#D4537E';
    addRing(boss.x, boss.y, 80,  '#D4537E', 3, 0.6);
    addRing(boss.x, boss.y, 130, '#fff',    2, 0.4);
    addBurst(boss.x, boss.y, '#D4537E', 18, 130, 5, 0.7);
    onPhaseTwo();
  }

  if (boss.stunned || boss.frozen) return;

  const spd = boss.slowT > 0 ? boss.spd * (boss.spdMult || 0.5) : boss.spd;

  // --- charge attack (phase 2 only) ---
  if (boss.phase === 2) {
    boss.chargeT -= dt;
    if (boss.charging) {
      boss.x += boss.chargeVx * dt;
      boss.y += boss.chargeVy * dt;
      boss.chargeDur -= dt;
      // hit player during charge
      if (dist2(boss, P) < (boss.r + P.r) ** 2) {
        onHitPlayer(boss.dmg * 1.6);
        boss.charging = false;
      }
      if (boss.chargeDur <= 0) boss.charging = false;
      return; // skip normal move while charging
    } else if (boss.chargeT <= 0) {
      // launch charge toward player
      const a = Math.atan2(P.y - boss.y, P.x - boss.x);
      boss.charging  = true;
      boss.chargeVx  = Math.cos(a) * 520;
      boss.chargeVy  = Math.sin(a) * 520;
      boss.chargeDur = 0.28;
      boss.chargeT   = boss.phase === 2 ? 3.5 : 99;
      addBurst(boss.x, boss.y, '#D4537E', 8, 100, 4, 0.35);
      return;
    }
  }

  // --- normal movement: orbit + close in ---
  const dx = P.x - boss.x, dy = P.y - boss.y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  const targetDist = boss.phase === 2 ? 90 : 140;
  if (d > targetDist) {
    boss.x += (dx / d) * spd * dt;
    boss.y += (dy / d) * spd * dt;
  }

  // contact damage
  if (d < boss.r + P.r) onHitPlayer(boss.dmg);

  // --- ring pulse attack ---
  boss.ringT -= dt;
  if (boss.ringT <= 0) {
    boss.ringT = boss.phase === 2 ? 2.2 : 3.5;
    const ringR = 200;
    addRing(boss.x, boss.y, ringR, boss.col, 2, 0.5);
    // 8 bullets outward
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + boss.angle;
      onSpawnBullet(boss.x, boss.y, Math.cos(a) * 160, Math.sin(a) * 160, 6, 14, '#E24B4A');
    }
  }

  // --- aimed burst at player ---
  boss.shootT -= dt;
  const shootRate = boss.phase === 2 ? 1.1 : 1.9;
  if (boss.shootT <= 0) {
    boss.shootT = shootRate;
    const spread = boss.phase === 2 ? 3 : 1;
    const baseA  = Math.atan2(P.y - boss.y, P.x - boss.x);
    for (let i = 0; i < spread; i++) {
      const off = (i - (spread - 1) / 2) * 0.22;
      onSpawnBullet(boss.x, boss.y, Math.cos(baseA + off) * 210, Math.sin(baseA + off) * 210, 6, 16, '#FFB627');
    }
  }
}

export function drawBoss(ctx, boss) {
  if (!boss || !boss.alive) return;

  const col = boss.hitFlash > 0 ? '#fff'
    : boss.frozen  ? '#00CFFF'
    : boss.stunned ? '#BF77FF'
    : boss.phase === 2 ? '#D4537E'
    : '#E24B4A';

  // outer glow ring
  ctx.shadowColor = col;
  ctx.shadowBlur  = boss.phase === 2 ? 28 : 18;

  // main body — hexagon
  ctx.fillStyle   = col + '55';
  ctx.strokeStyle = col;
  ctx.lineWidth   = 2.5;
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

  // inner counter-rotating triangle
  ctx.fillStyle   = col + 'aa';
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -boss.angle * 1.6 + (i / 3) * Math.PI * 2;
    const ir = boss.r * 0.55;
    i === 0
      ? ctx.moveTo(boss.x + Math.cos(a) * ir, boss.y + Math.sin(a) * ir)
      : ctx.lineTo(boss.x + Math.cos(a) * ir, boss.y + Math.sin(a) * ir);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // status rings
  if (boss.frozen)  { ctx.strokeStyle = 'rgba(0,207,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r + 5, 0, Math.PI * 2); ctx.stroke(); }
  if (boss.stunned) { ctx.strokeStyle = 'rgba(191,119,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r + 5, 0, Math.PI * 2); ctx.stroke(); }
}

export function hitBoss(boss, dmg, col, isSynergy = false) {
  if (!boss || !boss.alive) return;
  // boss resists status effects — halved durations handled at call site in game.js
  boss.hp -= dmg;
  boss.hitFlash = 0.08;
  addBurst(boss.x, boss.y, col, isSynergy ? 5 : 2, isSynergy ? 80 : 50, 3, 0.28);
}
