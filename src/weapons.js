import { enemies, nearest, dist2, pruneEnemies, getExtraTarget, applySlow } from './enemies.js';
import { addRing, addBurst, addDot } from './particles.js';
import { getWeaponLevel } from './player.js';

export const bullets = [];
export const pulseClusters = [];

export function resetBullets() { bullets.length = 0; }
export function resetPulseClusters() { pulseClusters.length = 0; }

function mkBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  const pl = meta?.pierce || 0;
  bullets.push({ x, y, vx, vy, r, dmg, col, life, pl, meta, hitIds: pl > 0 ? new Set() : null });
}

function getCryoProjectileCount(lvl) {
  return Math.min(5, Math.max(1, lvl));
}

function getCryoSpreadStep(lvl) {
  return lvl >= 5 ? 0.34 : lvl >= 4 ? 0.22 : lvl >= 3 ? 0.12 : lvl >= 2 ? 0.08 : 0;
}

function getEmpRadius(lvl) {
  return [0, 160, 220, 280, 340, 400][Math.min(lvl, 5)] || 160;
}

function getSwarmCount(lvl) {
  return Math.min(6, 1 + lvl);
}

export const WDEFS = {
  cryo: {
    id: 'cryo', name: 'CRYO', icon: '❄', col: '#00CFFF',
    maxLvl: 5,
    baseRate: 1.9,
    getRate: p => {
      const lvl = getWeaponLevel(p, 'cryo');
      const base = 1.9 + lvl * 0.35;
      return base * (p.rateBonus || 1);
    },
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = getWeaponLevel(p, 'cryo');
      const dmg = p.dmg * (8 + lvl * 3);
      const count = getCryoProjectileCount(lvl);
      const spreadStep = getCryoSpreadStep(lvl);
      const startOffset = -spreadStep * (count - 1) * 0.5;

      for (let i = 0; i < count; i++) {
        const angle = a + startOffset + i * spreadStep;
        mkBullet(
          p.x,
          p.y,
          Math.cos(angle) * 430,
          Math.sin(angle) * 430,
          5,
          dmg,
          '#00CFFF',
          2.2,
          { type: 'cryo', tier: lvl, pierce: 1 }
        );
      }
    }
  },
  pulse: {
    id: 'pulse', name: 'PULSE', icon: '◈', col: '#FFB627',
    maxLvl: 5,
    baseRate: 0.45,
    getRate: p => 0.45 * (p.rateBonus || 1),
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = getWeaponLevel(p, 'pulse');
      const dmg = p.dmg * (28 + lvl * 10);
      mkBullet(
        p.x,
        p.y,
        Math.cos(a) * 300,
        Math.sin(a) * 300,
        9,
        dmg,
        '#FFB627',
        2.8,
        { type: 'pulse', tier: lvl, pulseLvl: lvl, pierce: 0, explosive: true }
      );
    }
  },
  emp: {
    id: 'emp', name: 'EMP', icon: '⚡', col: '#BF77FF',
    maxLvl: 5,
    baseRate: 0.4,
    getRate: p => 0.4 * (p.rateBonus || 1),
    fire(p, onHitEnemy) {
      const lvl = getWeaponLevel(p, 'emp');
      const r = getEmpRadius(lvl);
      const dmg = p.dmg * (12 + lvl * 6);
      const stunDur = 2.0 + lvl * 0.5;
      const affected = [];

      addRing(p.x, p.y, r, '#BF77FF', 2.5, 0.45);
      addRing(p.x, p.y, r * 0.4, '#ffffff', 1.5, 0.2);

      enemies.forEach(e => {
        if (dist2(p, e) < r * r) {
          onHitEnemy(e, dmg, '#BF77FF');
          e.stunT = stunDur;
          e.stunned = true;
          e.empMarkT = Math.max(e.empMarkT || 0, stunDur);
          if (e.hp > 0) affected.push(e);
        }
      });

      const boss = getExtraTarget();
      if (boss?.alive && dist2(p, boss) < r * r) {
        onHitEnemy(boss, dmg, '#BF77FF');
        boss.stunT = stunDur * 0.5;
        boss.stunned = true;
        boss.empMarkT = Math.max(boss.empMarkT || 0, stunDur * 0.5);
        affected.push(boss);
      }

      if (lvl >= 5) {
        affected.forEach(target => triggerEmpShockwave(target, p.dmg * 6, onHitEnemy, boss));
      }

      pruneEnemies();
    }
  },
  swarm: {
    id: 'swarm', name: 'SWARM', icon: '◉', col: '#1DFFD0',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
    tick(p, dt, onHitEnemy) {
      const lvl = getWeaponLevel(p, 'swarm');
      const cnt = getSwarmCount(lvl);
      const orR = 85 + lvl * 15;
      const seekR = 190 + lvl * 30;
      const seekSpd = 320 + lvl * 40;
      const dmgPer = p.dmg * (28 + lvl * 14);

      if (!p._dr || p._dr.length !== cnt) {
        p._dr = Array.from({ length: cnt }, (_, i) => ({
          a: (i / cnt) * Math.PI * 2,
          state: 'orbit',
          sx: 0, sy: 0,
          tx: 0, ty: 0,
          target: null,
          cooldown: 0,
        }));
      }

      const boss = getExtraTarget();
      const allTargets = [...enemies, ...(boss?.alive ? [boss] : [])];

      p._dr.forEach(d => {
        d.a += dt * 2.2;
        if (d.cooldown > 0) d.cooldown -= dt;

        if (d.state === 'orbit') {
          d.sx = p.x + Math.cos(d.a) * orR;
          d.sy = p.y + Math.sin(d.a) * orR;
          addDot(d.sx, d.sy, '#1DFFD0', 7, 0.12);

          if (d.cooldown <= 0) {
            let bestT = null;
            let bestDist = seekR * seekR;
            allTargets.forEach(e => {
              const dd = dist2({ x: d.sx, y: d.sy }, e);
              if (dd < bestDist) { bestDist = dd; bestT = e; }
            });
            if (bestT) {
              d.state = 'seek';
              d.target = bestT;
              d.tx = bestT.x;
              d.ty = bestT.y;
              addBurst(d.sx, d.sy, '#1DFFD0', 4, 60, 2.5, 0.2);
            }
          }
        } else if (d.state === 'seek') {
          if (d.target && (d.target.hp > 0 || d.target === boss)) {
            d.tx = d.target.x;
            d.ty = d.target.y;
          }
          const ddx = d.tx - d.sx;
          const ddy = d.ty - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, '#1DFFD0', 7, 0.14);

          const hitR = d.target === boss ? boss.r : (d.target?.r || 12);
          if (dist < hitR + 10) {
            const prevTarget = d.target;
            if (prevTarget) onHitEnemy(prevTarget, dmgPer, '#1DFFD0');
            pruneEnemies();
            addBurst(d.sx, d.sy, '#1DFFD0', 7, 100, 3.5, 0.35);
            addRing(d.sx, d.sy, 28, '#1DFFD0', 1.5, 0.2);
            d.cooldown = 0.55;
            d.state = 'return';
            d.target = null;
          }

          if (d.target && d.target !== boss && d.target.hp <= 0) {
            d.state = 'return';
            d.target = null;
            d.cooldown = 0.2;
          }
        } else {
          const homeX = p.x + Math.cos(d.a) * orR;
          const homeY = p.y + Math.sin(d.a) * orR;
          const ddx = homeX - d.sx;
          const ddy = homeY - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * 1.4 * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, '#1DFFD055', 5, 0.1);
          if (dist < 12) d.state = 'orbit';
        }
      });

      p._miniDr = [];
    }
  }
};

export function triggerOverload(e, dmg, onHitEnemy) {
  const x = e.x, y = e.y, r = 100;
  addRing(x, y, r, '#ffffff', 3, 0.5);
  addRing(x, y, r * 1.4, '#BF77FF', 2, 0.6);
  addBurst(x, y, '#ffffff', 9, 110, 4, 0.55);
  addBurst(x, y, '#BF77FF', 9, 90, 3, 0.55);
  enemies.forEach(f => {
    if (f !== e && (f.x - x) ** 2 + (f.y - y) ** 2 < r * r) onHitEnemy(f, dmg, '#BF77FF', true);
  });
  pruneEnemies();
}

export function handleCryoImpact(game, bullet, target) {
  if (!target.frozen) applySlow(target, 2.0, 0.5);
}

export function updateCryoFields(game, dt) {
  updatePulseClusters(game, dt);
  game.cryoFields = [];
}

export function getPulseHitDamage(b, dmg) {
  return dmg;
}

export function triggerPulseShockwave(e, dmg, onHitEnemy) {
  const x = e.x, y = e.y, r = 80;
  const splash = dmg * 0.6;
  addRing(x, y, r, '#FFB627', 2.5, 0.5);
  addBurst(x, y, '#FFB627', 8, 90, 3.5, 0.4);
  enemies.forEach(f => {
    if (f !== e && (f.x - x) ** 2 + (f.y - y) ** 2 < r * r) {
      onHitEnemy(f, splash, '#FFB627', false);
    }
  });
  pruneEnemies();
}

export function triggerPulseExplosion(game, bullet, x, y, onHitEnemy, onHitBoss) {
  const lvl = bullet.meta?.pulseLvl || 1;
  const radius = 78;
  const splash = bullet.dmg * 0.65;
  addRing(x, y, radius, '#FFB627', 2.8, 0.5);
  addBurst(x, y, '#FFB627', 10, 95, 4, 0.45);
  applyPulseExplosionDamage(x, y, radius, splash, onHitEnemy, onHitBoss);
  if (lvl >= 2) spawnPulseClusterBombs(x, y, bullet.dmg * 0.45, 1, lvl);
}

function spawnPulseClusterBombs(x, y, dmg, generation, lvl) {
  const count = generation === 1 ? 4 : 3;
  const speed = generation === 1 ? 180 : 140;
  const life = generation === 1 ? 0.32 : 0.24;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
    pulseClusters.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      dmg,
      life,
      maxLife: life,
      lvl,
      generation,
      canRecluster: generation < getPulseMaxClusterGeneration(lvl),
    });
  }
}

function getPulseMaxClusterGeneration(lvl) {
  if (lvl >= 5) return 4;
  if (lvl >= 4) return 3;
  if (lvl >= 3) return 2;
  if (lvl >= 2) return 1;
  return 0;
}

function updatePulseClusters(game, dt) {
  for (let i = pulseClusters.length - 1; i >= 0; i--) {
    const cluster = pulseClusters[i];
    cluster.x += cluster.vx * dt;
    cluster.y += cluster.vy * dt;
    cluster.life -= dt;
    addDot(
      cluster.x,
      cluster.y,
      cluster.generation === 1 ? '#FFB627' : '#FFE4A3',
      cluster.generation === 1 ? 4 : 3,
      0.12
    );
    if (cluster.life > 0) continue;
    detonatePulseCluster(cluster, game);
    pulseClusters.splice(i, 1);
  }
}

function detonatePulseCluster(cluster, game) {
  const radius = cluster.generation === 1 ? 56 : 42;
  const color = cluster.generation === 1 ? '#FFB627' : '#FFE4A3';
  addRing(cluster.x, cluster.y, radius, color, 1.8, 0.35);
  addBurst(cluster.x, cluster.y, color, cluster.generation === 1 ? 6 : 4, 70, 2.8, 0.35);
  applyPulseExplosionDamage(
    cluster.x,
    cluster.y,
    radius,
    cluster.dmg,
    (target, dmg, col) => game.hitEnemy(target, dmg, col),
    (dmg, col) => game._doBossHit(dmg, col)
  );
  if (cluster.canRecluster) {
    spawnPulseClusterBombs(
      cluster.x,
      cluster.y,
      cluster.dmg * 0.55,
      cluster.generation + 1,
      cluster.lvl
    );
  }
}

function applyPulseExplosionDamage(x, y, radius, dmg, onHitEnemy, onHitBoss) {
  enemies.forEach(f => {
    const dx = f.x - x;
    const dy = f.y - y;
    if (dx * dx + dy * dy < radius * radius) onHitEnemy(f, dmg, '#FFB627');
  });
  const boss = getExtraTarget();
  if (boss?.alive) {
    const dx = boss.x - x;
    const dy = boss.y - y;
    if (dx * dx + dy * dy < radius * radius) onHitBoss(dmg, '#FFB627');
  }
  pruneEnemies();
}

function triggerEmpShockwave(source, dmg, onHitEnemy, boss) {
  const radius = 60;
  addRing(source.x, source.y, radius, '#ffffff', 1.4, 0.28);
  addRing(source.x, source.y, radius * 0.7, '#BF77FF', 1.8, 0.24);
  enemies.forEach(target => {
    if (target === source) return;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    if (dx * dx + dy * dy < radius * radius) onHitEnemy(target, dmg, '#BF77FF', true);
  });
  if (boss?.alive && boss !== source) {
    const dx = boss.x - source.x;
    const dy = boss.y - source.y;
    if (dx * dx + dy * dy < radius * radius) onHitEnemy(boss, dmg, '#BF77FF', true);
  }
  pruneEnemies();
}
