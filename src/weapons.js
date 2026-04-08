import { enemies, nearest, dist2, pruneEnemies, getExtraTarget } from './enemies.js';
import { addRing, addBurst, addDot } from './particles.js';

export const bullets = [];
export function resetBullets() { bullets.length = 0; }

function mkBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  bullets.push({ x, y, vx, vy, r, dmg, col, life, pl: meta?.pierce || 0, meta });
}

export const WDEFS = {
  cryo: {
    id: 'cryo', name: 'CRYO', icon: '❄', col: '#00CFFF',
    baseRate: 1.9,
    getRate: p => (1.9 + p.w.cryo * 0.35) * (p.rateBonus || 1),
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = p.w.cryo, spread = lvl >= 3 ? 3 : 1;
      const dmg = p.dmg * (8 + lvl * 3);
      for (let i = 0; i < spread; i++) {
        const off = (i - (spread - 1) / 2) * 0.22;
        mkBullet(p.x, p.y, Math.cos(a + off) * 430, Math.sin(a + off) * 430, 5, dmg, '#00CFFF', 2.2,
          { type: 'cryo', freeze: lvl >= 2, slow: 0.5, pierce: 1 });
      }
    }
  },
  pulse: {
    id: 'pulse', name: 'PULSE', icon: '◈', col: '#FFB627',
    baseRate: 0.65,
    getRate: p => (0.65 + p.w.pulse * 0.1) * (p.rateBonus || 1),
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = p.w.pulse, dmg = p.dmg * (18 + lvl * 8);
      mkBullet(p.x, p.y, Math.cos(a) * 300, Math.sin(a) * 300, 9, dmg, '#FFB627', 2.8,
        { type: 'pulse', aoe: lvl >= 2, pierce: lvl >= 3 ? 1 : 0 });
    }
  },
  emp: {
    id: 'emp', name: 'EMP', icon: '⚡', col: '#BF77FF',
    baseRate: 0.4,
    getRate: p => (0.4 + p.w.emp * 0.1) * (p.rateBonus || 1),
    fire(p, onHitEnemy) {
      const lvl = p.w.emp, r = 160 + lvl * 55, dmg = p.dmg * (12 + lvl * 6), stunDur = 2.0 + lvl * 0.5;
      addRing(p.x, p.y, r, '#BF77FF', 2.5, 0.45);
      addRing(p.x, p.y, r * 0.4, '#ffffff', 1.5, 0.2);
      enemies.forEach(e => {
        if (dist2(p, e) < r * r) {
          onHitEnemy(e, dmg, '#BF77FF');
          e.stunT = stunDur; e.stunned = true;
          if (lvl >= 3 && e.hp > 0) triggerOverload(e, p.dmg * 8, onHitEnemy);
        }
      });
      // also hit boss if in range
      const boss = getExtraTarget();
      if (boss?.alive && dist2(p, boss) < r * r) {
        onHitEnemy(boss, dmg, '#BF77FF');
        boss.stunT = stunDur * 0.5; boss.stunned = true; // halved stun on boss
      }
      pruneEnemies();
    }
  },
  swarm: {
    id: 'swarm', name: 'SWARM', icon: '◉', col: '#1DFFD0',
    baseRate: 0, getRate: () => 0, fire() {},
    tick(p, dt, onHitEnemy) {
      const lvl = p.w.swarm;
      const cnt    = 1 + lvl;                  // T1:2 T2:3 T3:4
      const orR    = 85 + lvl * 15;            // larger orbit radius
      const seekR  = 190 + lvl * 30;           // detection range
      const seekSpd = 320 + lvl * 40;
      const dmgPer  = p.dmg * (28 + lvl * 14); // much higher damage
      const chain   = lvl >= 3;                // T3 chains to next target on hit

      if (!p._dr || p._dr.length !== cnt)
        p._dr = Array.from({ length: cnt }, (_, i) => ({
          a: (i / cnt) * Math.PI * 2, // orbit angle
          state: 'orbit',
          sx: 0, sy: 0,               // current seek position
          tx: 0, ty: 0,               // target position snapshot
          target: null,
          cooldown: 0,
        }));

      // build target list: enemies + boss
      const boss = getExtraTarget();
      const allTargets = [...enemies, ...(boss?.alive ? [boss] : [])];

      p._dr.forEach(d => {
        d.a += dt * 2.2;
        if (d.cooldown > 0) d.cooldown -= dt;

        if (d.state === 'orbit') {
          // orbit position
          d.sx = p.x + Math.cos(d.a) * orR;
          d.sy = p.y + Math.sin(d.a) * orR;
          addDot(d.sx, d.sy, '#1DFFD0', 7, 0.12);

          // seek nearest target in range (skip if on cooldown)
          if (d.cooldown <= 0) {
            let bestT = null, bestDist = seekR * seekR;
            allTargets.forEach(e => {
              const dd = dist2({ x: d.sx, y: d.sy }, e);
              if (dd < bestDist) { bestDist = dd; bestT = e; }
            });
            if (bestT) {
              d.state = 'seek';
              d.target = bestT;
              d.tx = bestT.x; d.ty = bestT.y;
              addBurst(d.sx, d.sy, '#1DFFD0', 4, 60, 2.5, 0.2);
            }
          }

        } else if (d.state === 'seek') {
          // update target pos snapshot if still alive/valid
          if (d.target && (d.target.hp > 0 || d.target === boss)) {
            d.tx = d.target.x; d.ty = d.target.y;
          }
          // fly toward target
          const ddx = d.tx - d.sx, ddy = d.ty - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, '#1DFFD0', 7, 0.14);

          // hit check
          const hitR = d.target === boss ? boss.r : (d.target?.r || 12);
          if (dist < hitR + 10) {
            if (d.target) onHitEnemy(d.target, dmgPer, '#1DFFD0');
            pruneEnemies();
            addBurst(d.sx, d.sy, '#1DFFD0', 7, 100, 3.5, 0.35);
            addRing(d.sx, d.sy, 28, '#1DFFD0', 1.5, 0.2);
            d.cooldown = chain ? 0.1 : 0.55; // chain = find next target quickly
            d.state = 'return';
            d.target = null;
          }

          // target died or too far — return
          if (d.target && d.target !== boss && d.target.hp <= 0) {
            d.state = 'return'; d.target = null; d.cooldown = 0.2;
          }

        } else { // return
          const homeX = p.x + Math.cos(d.a) * orR;
          const homeY = p.y + Math.sin(d.a) * orR;
          const ddx = homeX - d.sx, ddy = homeY - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * 1.4 * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, '#1DFFD055', 5, 0.1);
          if (dist < 12) d.state = 'orbit';
        }
      });
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
