import { enemies, nearest, dist2, pruneEnemies } from './enemies.js';
import { addRing, addBurst, addDot } from './particles.js';

export let bullets = [];
export function resetBullets() { bullets = []; }

function mkBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  bullets.push({ x, y, vx, vy, r, dmg, col, life, pl: meta?.pierce || 0, meta });
}

function fireShot(e, P) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 5, dmg: 10, col: '#FFB627', life: 4, pl: 0, enemy: true, meta: {} });
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
      pruneEnemies();
    }
  },
  swarm: {
    id: 'swarm', name: 'SWARM', icon: '◉', col: '#1DFFD0',
    baseRate: 0, getRate: () => 0, fire() {},
    tick(p, dt, onHitEnemy) {
      const lvl = p.w.swarm, cnt = 1 + lvl, orR = 55 + lvl * 14, dmgPer = p.dmg * (7 + lvl * 3.5);
      if (!p._dr || p._dr.length !== cnt)
        p._dr = Array.from({ length: cnt }, (_, i) => ({ a: (i / cnt) * Math.PI * 2, ht: 0 }));
      p._dr.forEach(d => {
        d.a += dt * 2.8; d.ht -= dt;
        const dx = p.x + Math.cos(d.a) * orR, dy = p.y + Math.sin(d.a) * orR;
        addDot(dx, dy, '#1DFFD0', 5, 0.1);
        if (d.ht <= 0) {
          d.ht = 0.26;
          enemies.forEach(e => { if (Math.hypot(e.x - dx, e.y - dy) < e.r + 8) onHitEnemy(e, dmgPer, '#1DFFD0'); });
          pruneEnemies();
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
