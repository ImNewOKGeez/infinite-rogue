import { enemies, nearest, dist2, pruneEnemies, getExtraTarget, applySlow, ensureFreezeState, applyStun, getEffectiveFreezeThreshold } from './enemies.js';
import { addRing, addBurst, addDot } from './particles.js';
import { getAscension, getWeaponLevel } from './player.js';

export const bullets = [];
export const pulseClusters = [];

export const ASCENSIONS = {
  cryo: [
    {
      id: 'cryo_storm',
      name: 'CRYO STORM',
      description: 'Hitting a frozen enemy resets their freeze timer and releases freeze-building shards in all directions. No damage on frozen hits.',
    },
    {
      id: 'permafrost',
      name: 'PERMAFROST',
      description: 'Frozen enemies never thaw. They remain frozen until killed. High burst damage required.',
    },
    {
      id: 'cryo_nova',
      name: 'CRYO NOVA',
      description: 'Frozen enemies that die explode for 80% max-HP damage in a 150px ice nova and seed freeze buildup on survivors.',
    },
    {
      id: 'glacial_lance',
      name: 'GLACIAL LANCE',
      description: 'Every third Cryo fire is replaced by a piercing Glacial Lance. Level 5 releases a five-beam spread.',
    },
    {
      id: 'frost_field',
      name: 'FROST FIELD',
      description: 'Removes all projectiles. Generates a 150px frost aura around the player that builds freeze meter and slows all enemies inside it.',
    },
    {
      id: 'shatter',
      name: 'SHATTER',
      description: 'Frozen enemies have a chance to instantly die on any hit. Chance scales with freeze time remaining - max 25% at moment of freeze, drops to zero as timer expires.',
    },
  ],
  pulse: [
    {
      id: 'chain_reaction',
      name: 'CHAIN REACTION',
      description: 'Cluster bomb explosions have a 35% chance to trigger a full new Pulse shell impact at that location, complete with its own cluster generation.',
    },
    {
      id: 'collapsed_round',
      name: 'COLLAPSED ROUND',
      description: 'Pulse shells pull all enemies within 180px sharply toward the impact point for 0.3 seconds before the explosion fires. Cluster chain follows as normal.',
    },
    {
      id: 'overload_round',
      name: 'OVERLOAD ROUND',
      description: 'Every 3rd Pulse shot is an Overload Round - 5x damage, pierces all enemies, explosion radius doubled. Counter resets on death.',
    },
    {
      id: 'proximity_mine',
      name: 'PROXIMITY MINE',
      description: 'Pulse shells drop at the player\'s feet as proximity mines. Enemies walking over a mine trigger it. Up to 6 mines active at once.',
    },
    {
      id: 'fragmentation',
      name: 'FRAGMENTATION',
      description: 'Pulse shells split into 8 fragments before impact. Each deals 40% damage and triggers a smaller explosion with one fewer cluster generation.',
    },
  ],
  emp: [
    {
      id: 'cascade_pulse',
      name: 'CASCADE PULSE',
      description: 'Stunning an enemy causes it to emit a secondary pulse that stuns all enemies within 80px. Secondary stuns do not cascade further.',
    },
    {
      id: 'triple_pulse',
      name: 'TRIPLE PULSE',
      description: 'EMP releases a single expanding shockwave with three strength thresholds. Inner hits deal full damage and stun, outer hits deal less.',
    },
    {
      id: 'arc_discharge',
      name: 'ARC DISCHARGE',
      description: 'Electrical arcs jump between all stunned enemies within 200px of each other. Each arc deals 40% of EMP burst damage.',
    },
  ],
  swarm: [
    {
      id: 'nova_swarm',
      name: 'NOVA SWARM',
      description: 'Drone kills detonate at the kill point in an 80px explosion. A temporary drone spawns at the detonation and orbits for 8 seconds. Temporary drones can Nova but only explode - no further drone spawning.',
    },
    {
      id: 'frenzy',
      name: 'FRENZY',
      description: 'A drone kill triggers a 3-second frenzy on that drone - 2x speed, 2x damage, continuous target seeking with no orbit return between hits. Each drone has a 3-second cooldown before it can frenzy again.',
    },
    {
      id: 'split_swarm',
      name: 'SPLIT SWARM',
      description: 'Each drone splits into two on first contact with an enemy. The split drone seeks a different target independently for 5 seconds then expires. Split drones cannot split again.',
    },
  ],
  arcblade: [
    {
      id: 'saw_blade',
      name: 'SAW BLADE',
      description: 'All boomerangs merge into a single large orbital saw. Continuously damages all enemies within its radius.',
    },
  ],
  molotov: [
    {
      id: 'inferno',
      name: 'INFERNO',
      description: 'All fire pools merge into one massive zone. Combined radius, 5s duration, 50% more damage.',
    },
    {
      id: 'bouncing_cocktail',
      name: 'BOUNCING COCKTAIL',
      description: 'Bottles bounce 3 times, leaving diminishing fire pools at each landing point.',
    },
    {
      id: 'cluster_molotov',
      name: 'CLUSTER MOLOTOV',
      description: 'Each bottle shatters into 3 sub-bottles on impact, each creating a smaller fire pool.',
    },
  ]
};

export function resetBullets() { bullets.length = 0; }
export function resetPulseClusters() { pulseClusters.length = 0; }

function mkBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  const pl = meta?.pierce || 0;
  bullets.push({ x, y, vx, vy, r, dmg, col, life, pl, meta, hitIds: pl > 0 ? new Set() : null });
}

export function spawnBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  mkBullet(x, y, vx, vy, r, dmg, col, life, meta);
}

function getCryoProjectileCount(lvl) {
  return Math.min(5, Math.max(1, lvl));
}

function getCryoSpreadStep(lvl) {
  return lvl >= 5 ? 0.34 : lvl >= 4 ? 0.22 : lvl >= 3 ? 0.12 : lvl >= 2 ? 0.08 : 0;
}

export const EMP_SCALING = {
  1: { radius: 160, stun: 1.2, dmgMult: 1.0 },
  2: { radius: 200, stun: 1.4, dmgMult: 1.3 },
  3: { radius: 245, stun: 1.6, dmgMult: 1.7 },
  4: { radius: 295, stun: 1.8, dmgMult: 2.2 },
  5: { radius: 350, stun: 2.0, dmgMult: 2.8 },
};

export const MOLOTOV_TIERS = {
  1: { pools: 1, radius: 55, duration: 2.5, fireRate: 2.5, dmgMult: 8 },
  2: { pools: 1, radius: 70, duration: 2.5, fireRate: 2.2, dmgMult: 9 },
  3: { pools: 2, radius: 80, duration: 3.0, fireRate: 2.0, dmgMult: 10 },
  4: { pools: 2, radius: 90, duration: 3.0, fireRate: 1.8, dmgMult: 11 },
  5: { pools: 3, radius: 100, duration: 3.0, fireRate: 1.6, dmgMult: 12 },
};

function getEmpScaling(lvl) {
  return EMP_SCALING[Math.min(Math.max(lvl, 1), 5)] || EMP_SCALING[1];
}

function getSwarmCount(lvl) {
  return Math.min(6, 1 + lvl);
}

function mkSwarmDrone(angle) {
  return {
    a: angle,
    state: 'orbit',
    sx: 0, sy: 0,
    tx: 0, ty: 0,
    target: null,
    cooldown: 0,
    ht: 0,
    frenzy: false,
    frenzyT: 0,
    frenzyCD: 0,
    pulseOffset: 0,
    hasSplitThisContact: false,
  };
}

function mkNovaDrone() {
  return {
    a: Math.random() * Math.PI * 2,
    ht: 0,
    life: 8.0,
    isNova: true,
    state: 'orbit',
    sx: 0, sy: 0,
    tx: 0, ty: 0,
    target: null,
    cooldown: 0,
    pulseOffset: 0,
  };
}

function acquireSwarmTarget(allTargets, x, y, seekR, excludedTarget = null) {
  let bestT = null;
  let bestDist = seekR * seekR;
  allTargets.forEach(target => {
    if (!target || target.hp <= 0) return;
    if (target === excludedTarget) return;
    const dd = dist2({ x, y }, target);
    if (dd < bestDist) {
      bestDist = dd;
      bestT = target;
    }
  });
  return bestT;
}

function getBarrierTier(lvl) {
  const tier = Math.min(Math.max(lvl, 1), 5);
  return {
    1: { maxCap: 40, activeDuration: 4.2, rechargeTime: 8 },
    2: { maxCap: 65, activeDuration: 5.1, rechargeTime: 7 },
    3: { maxCap: 95, activeDuration: 5.9, rechargeTime: 6 },
    4: { maxCap: 130, activeDuration: 6.8, rechargeTime: 5 },
    5: { maxCap: 175, activeDuration: 8.5, rechargeTime: 4 },
  }[tier];
}

function getCryoFreezeAmount(lvl) {
  return [0, 1.0, 1.5, 2.0, 2.5, 3.0][Math.min(Math.max(lvl, 1), 5)] || 1.0;
}

function getCryoDamage(lvl, dmgMult) {
  return dmgMult * (4 + lvl * 1.5);
}

function getPulseClusterGeneration(lvl) {
  return Math.max(0, lvl - 1);
}

function getPulseBaseDamage(p, lvl) {
  return p.dmg * (28 + lvl * 10);
}

function getEmpBaseDamage(p) {
  return p.dmg * 4.6;
}

function firePulseShell(p, angle, dmg, lvl, overrides = {}) {
  const radius = overrides.radius ?? 9;
  const speed = overrides.speed ?? 300;
  const color = overrides.col ?? '#FFB627';
  const life = overrides.life ?? 2.8;
  mkBullet(
    p.x,
    p.y,
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
    radius,
    dmg,
    color,
    life,
    {
      type: 'pulse',
      tier: lvl,
      pulseLvl: lvl,
      pierce: overrides.pierce ?? 0,
      explosive: true,
      clusterGen: overrides.clusterGen ?? getPulseClusterGeneration(lvl),
      isOverload: !!overrides.isOverload,
      isFragment: !!overrides.isFragment,
      ...overrides.meta,
    }
  );
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
      const ascension = getAscension(p, 'cryo');
      if (ascension === 'frost_field') return;
      const dmg = getCryoDamage(lvl, p.dmg);
      if (ascension === 'glacial_lance') {
        p._lanceCounter = (p._lanceCounter || 0) + 1;
        if (p._lanceCounter >= 3) {
          p._lanceCounter = 0;
          this.fireLance?.(p, t, lvl === 5 ? 5 : 1);
          return { suppressDefaultSound: true };
        }
      }
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
          { type: 'cryo', tier: lvl, cryoLevel: lvl, pierce: 1 }
        );
      }
    },
    tick(p, dt, _onHitEnemy, helpers = {}) {
      tickCryoAscension(
        p,
        helpers.enemies || enemies,
        dt,
        helpers.addParticle,
        helpers.applyFreezeMeter || applyFreezeMeter,
        helpers.onTickDamage
      );
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
      const dmg = getPulseBaseDamage(p, lvl);
      const ascension = getAscension(p, 'pulse');

      if (ascension === 'proximity_mine') {
        p._pulseMines ||= [];
        if (p._pulseMines.length >= 6) p._pulseMines.shift();
        p._pulseMines.push({
          x: p.x,
          y: p.y,
          r: 18,
          armed: false,
          armTimer: 0.5,
          triggered: false,
          dmg: dmg * 3,
          col: '#FFB627',
          life: 30,
        });
        return;
      }

      if (ascension === 'fragmentation') {
        const fragmentCount = 8;
        const spread = (50 * Math.PI) / 180;
        const startOffset = -spread * 0.5;
        const step = fragmentCount > 1 ? spread / (fragmentCount - 1) : 0;
        const fragmentClusterGen = Math.max(0, getPulseClusterGeneration(lvl) - 1);
        for (let i = 0; i < fragmentCount; i++) {
          const angle = a + startOffset + i * step;
          firePulseShell(p, angle, dmg * 0.4, lvl, {
            radius: 5,
            speed: 340,
            clusterGen: fragmentClusterGen,
            isFragment: true,
          });
        }
        return;
      }

      if (ascension === 'overload_round') {
        p._pulseOverloadCounter = (p._pulseOverloadCounter || 0) + 1;
        if (p._pulseOverloadCounter >= 3) {
          p._pulseOverloadCounter = 0;
          firePulseShell(p, a, dmg * 5, lvl, {
            radius: 14,
            pierce: 999,
            col: '#FFD56A',
            isOverload: true,
            meta: {
              glowCol: '#FFE6A6',
            },
          });
          return;
        }
      }

      firePulseShell(p, a, dmg, lvl, {
        meta: ascension === 'chain_reaction' ? { chainState: { procs: 0 } } : undefined,
      });
    }
  },
  emp: {
    id: 'emp', name: 'EMP', icon: '⚡', col: '#BF77FF',
    maxLvl: 5,
    baseRate: 0.4,
    getRate: p => 0.4 * (p.rateBonus || 1),
    fire(p, onHitEnemy) {
      const lvl = getWeaponLevel(p, 'emp');
      const ascension = getAscension(p, 'emp');
      const scaling = getEmpScaling(lvl);
      const r = scaling.radius;
      const dmg = getEmpBaseDamage(p) * scaling.dmgMult;
      const stunDur = scaling.stun;

      if (ascension === 'triple_pulse') {
        this.tripleWaves = this.tripleWaves || [];
        this.tripleWaves.push({
          x: p.x,
          y: p.y,
          r1: 0,
          r2: 0,
          r3: 0,
          maxR1: (160 + lvl * 38) * 1.0,
          maxR2: (160 + lvl * 38) * 1.5,
          maxR3: (160 + lvl * 38) * 2.2,
          speed1: 500,
          speed2: 350,
          speed3: 220,
          dmg,
          stunBase: stunDur,
          hitEnemies: new Set(),
          hitBoss: false,
          life: 1.8,
          r1Sound: false,
          r2Sound: false,
          r3Sound: false,
        });
        return;
      }

      addRing(p.x, p.y, r, '#BF77FF', 2.5, 0.45);

      enemies.forEach(e => {
        if (dist2(p, e) < r * r) {
          if (ascension) this.hitEnemy(e, dmg, '#BF77FF');
          else onHitEnemy(e, dmg, '#BF77FF');
          applyStun(e, stunDur);
        }
      });

      const boss = getExtraTarget();
      if (boss?.alive && dist2(p, boss) < r * r) {
        onHitEnemy(boss, dmg, '#BF77FF');
        if (!boss.stunImmune) {
          boss.stunT = stunDur * 0.5;
          boss.stunned = true;
        }
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
    tick(p, dt, onHitEnemy, helpers = {}) {
      const lvl = getWeaponLevel(p, 'swarm');
      const ascension = getAscension(p, 'swarm');
      const cnt = getSwarmCount(lvl);
      const orR = 85 + lvl * 15;
      const seekR = 190 + lvl * 30;
      const seekSpd = 320 + lvl * 40;
      const dmgPer = p.dmg * (28 + lvl * 14);

      if (!p._dr || p._dr.length !== cnt) {
        p._dr = Array.from({ length: cnt }, (_, i) => mkSwarmDrone((i / cnt) * Math.PI * 2));
      }
      p._novaDrones ||= [];
      p._splitDrones ||= [];

      const boss = getExtraTarget();
      const allTargets = [...enemies, ...(boss?.alive ? [boss] : [])];

      const processDrone = (d, options = {}) => {
        const isNova = !!options.isNova;
        const canFrenzy = !isNova && ascension === 'frenzy';
        const canSplit = !isNova && ascension === 'split_swarm';
        const speedMult = isNova ? 2 : (canFrenzy && d.frenzy ? 2 : 1);
        const damageMult = canFrenzy && d.frenzy ? 2 : 1;
        const hitCooldown = d.frenzy ? 0.08 : 0.55;
        const droneOrbitR = isNova ? orR * 1.3 : orR;

        d.a += dt * 2.2;
        d.pulseOffset = 0;
        if (d.cooldown > 0) d.cooldown -= dt;
        if (typeof d.ht === 'number' && d.ht > 0) d.ht -= dt;
        if (typeof d.frenzyCD !== 'number') d.frenzyCD = 0;
        if (canFrenzy) {
          if (d.frenzyCD > 0) d.frenzyCD = Math.max(0, d.frenzyCD - dt);
          d.frenzyT = Math.max(0, (d.frenzyT || 0) - dt);
          if (d.frenzy && d.frenzyT <= 0) {
            d.frenzy = false;
            d.frenzyCD = 3.0;
          }
        }

        if (d.state === 'orbit') {
          d.sx = p.x + Math.cos(d.a) * droneOrbitR;
          d.sy = p.y + Math.sin(d.a) * droneOrbitR;
          addDot(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', isNova ? 6 : 7, 0.12);

          if (d.cooldown <= 0) {
            const bestT = acquireSwarmTarget(allTargets, d.sx, d.sy, seekR);
            if (bestT) {
              d.state = 'seek';
              d.target = bestT;
              d.tx = bestT.x;
              d.ty = bestT.y;
              addBurst(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', 4, 60, 2.5, 0.2);
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
          const move = Math.min(dist, seekSpd * speedMult * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', isNova ? 6 : 7, 0.14);

          const hitR = d.target === boss ? boss.r : (d.target?.r || 12);
          if (dist < hitR + 10) {
            if (canSplit && !d.hasSplitThisContact) {
              d.hasSplitThisContact = true;
              if (d.target) helpers.spawnSplitDrone?.(p, d, d.target, orR);
            }
            const prevTarget = d.target;
            const hit = prevTarget ? onHitEnemy(prevTarget, dmgPer * damageMult, '#1DFFD0') : null;
            pruneEnemies();
            addBurst(d.sx, d.sy, '#1DFFD0', 7, 100, 3.5, 0.35);
            addRing(d.sx, d.sy, 28, '#1DFFD0', 1.5, 0.2);
            d.cooldown = hitCooldown;
            d.ht = hitCooldown;

            if (hit?.killed && ascension === 'nova_swarm' && hit.target) {
              helpers.onNovaDroneKill?.(hit.target.x, hit.target.y, hit.target, {
                isNova,
                drone: d,
              });
            }

            if (canFrenzy && hit?.killed && prevTarget !== boss && !d.frenzy && d.frenzyCD <= 0) {
              d.frenzy = true;
              d.frenzyT = 3.0;
              helpers.onFrenzyStart?.(d);
            }

            if (canFrenzy && d.frenzy) {
              d.target = acquireSwarmTarget(allTargets, d.sx, d.sy, seekR, prevTarget);
              if (d.target) {
                d.tx = d.target.x;
                d.ty = d.target.y;
                d.state = 'seek';
              } else {
                d.state = 'return';
                d.target = null;
              }
            } else {
              d.state = 'return';
              d.target = null;
            }
          }

          if (d.target && d.target !== boss && d.target.hp <= 0) {
            d.state = 'return';
            d.target = null;
            d.cooldown = 0.2;
          }
        } else {
          const homeX = p.x + Math.cos(d.a) * droneOrbitR;
          const homeY = p.y + Math.sin(d.a) * droneOrbitR;
          const ddx = homeX - d.sx;
          const ddy = homeY - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * 1.4 * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, isNova ? '#5DFFE099' : '#1DFFD055', isNova ? 4 : 5, 0.1);
          if (dist < 12) {
            d.state = 'orbit';
            d.hasSplitThisContact = false;
          }
        }
      };

      p._dr.forEach(d => processDrone(d, { allowPulseVisual: true }));

      for (let i = p._novaDrones.length - 1; i >= 0; i--) {
        const d = p._novaDrones[i];
        d.life -= dt;
        if (d.life <= 0) {
          helpers.onNovaDroneExpire?.(d.sx ?? p.x, d.sy ?? p.y);
          p._novaDrones.splice(i, 1);
          continue;
        }
        if (typeof d.state !== 'string') {
          Object.assign(d, mkNovaDrone(), d);
        }
        processDrone(d, { isNova: true, allowPulseVisual: false });
      }
    }
  },
  arcblade: {
    id: 'arcblade', name: "JAC'S BOOMERANG", icon: '◈', col: '#FF2D9B',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
    tick(_p, _dt, _onHitEnemy, _helpers = {}) {
      // ARC BLADE runtime is managed directly in game.js.
    }
  },
  molotov: {
    id: 'molotov', name: "LUKE'S MOLOTOV", icon: '🔥', col: '#FF2D9B',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
  },
  barrier: {
    id: 'barrier', name: 'BARRIER', icon: '◎', col: '#C6FF00',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire: () => {},
    tiers: {
      1: getBarrierTier(1),
      2: getBarrierTier(2),
      3: getBarrierTier(3),
      4: getBarrierTier(4),
      5: getBarrierTier(5),
    },
    tick(p, dt, _onHitEnemy, helpers = {}) {
      const lvl = getWeaponLevel(p, 'barrier');
      if (!lvl) return;
      const tier = getBarrierTier(lvl);

      p._shieldMaxCap = tier.maxCap;
      p._shieldFlashT = Math.max(0, p._shieldFlashT || 0);
      p._shieldHitT = Math.max(0, p._shieldHitT || 0);

      if (typeof p._shieldActive !== 'boolean') p._shieldActive = true;
      if (typeof p._shieldCap !== 'number') p._shieldCap = tier.maxCap;
      if (typeof p._shieldRechargeT !== 'number') p._shieldRechargeT = 0;
      if (typeof p._shieldActiveT !== 'number') p._shieldActiveT = tier.activeDuration;
      if (typeof p._shieldAbsorbedCycle !== 'number') p._shieldAbsorbedCycle = 0;

      if (p._shieldFlashT > 0) p._shieldFlashT = Math.max(0, p._shieldFlashT - dt);
      if (p._shieldHitT > 0) p._shieldHitT = Math.max(0, p._shieldHitT - dt);

      if (p._shieldActive) {
        p._shieldCap = Math.min(p._shieldCap, p._shieldMaxCap);
        p._shieldActiveT -= dt;
        if (p._shieldActiveT <= 0 || p._shieldCap <= 0) {
          helpers.onShieldBreak?.(p, tier);
        }
        return;
      }

      p._shieldRechargeT -= dt;
      if (p._shieldRechargeT <= 0) {
        p._shieldActive = true;
        p._shieldCap = p._shieldMaxCap;
        p._shieldActiveT = tier.activeDuration;
        p._shieldRechargeT = 0;
        p._shieldAbsorbedCycle = 0;
        helpers.onShieldRestore?.(p, tier);
      }
    }
  }
};

export function handleCryoImpact(game, bullet, target) {
  if (bullet.meta?.isCryoShard) {
    addBurst(target.x, target.y, '#A6F7FF', 5, 36, 1.8, 0.16);
    addRing(target.x, target.y, 16, '#7BE9FF', 1.2, 0.12);
  } else if (!target.frozen) {
    applySlow(target, 2.0, 0.5);
  }
  const cryoLevel = bullet.meta?.cryoLevel || 1;
  target._freezeSourceLevel = cryoLevel;
  const freezeAmount = bullet.meta?.freeze
    ? getEffectiveFreezeThreshold(target)
    : (bullet.meta?.freezeAmount || getCryoFreezeAmount(cryoLevel));
  applyFreezeMeter(target, freezeAmount);
}

export function tickCryoAscension(P, enemyList, dt, addParticle, applyFreezeMeterFn, onTickDamage) {
  const ascension = getAscension(P, 'cryo');
  if (ascension !== 'frost_field') return;

  enemyList.forEach(e => {
    if (!e || e.hp <= 0) return;
    const dx = e.x - P.x;
    const dy = e.y - P.y;
    if (dx * dx + dy * dy > 150 * 150) {
      e._frostFieldTime = 0;
      return;
    }
    applySlow(e, 0.4, 0.4);
    e._frostFieldTime = (e._frostFieldTime || 0) + dt;
    onTickDamage?.(e, P.dmg * 5 * dt, '#00CFFF');
    if (e._frostFieldTime >= 1.5) {
      applyFreezeMeterFn(e, getEffectiveFreezeThreshold(e));
    }
  });
  addParticle?.(P.x, P.y, 150, 'rgba(0, 207, 255, 0.22)', 1.5, 0.18);
}

export function applyFreezeMeter(e, amount) {
  ensureFreezeState(e);
  if (e.frozen) return;
  if (e.freezeCooldown > 0) return;
  if (e.freezeImmune) return;
  if (e.isBoss && e.bossFreezeCooldown > 0) return;

  const effectiveThreshold = getEffectiveFreezeThreshold(e);
  e.freezeMeter = Math.min(effectiveThreshold, e.freezeMeter + amount);

  if (e.isBoss && e.freezeMeter > effectiveThreshold * 0.3) {
    e.freezeMeter = 0;
    e.bossFreezeCooldown = 8;
  }
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
  const radius = bullet.meta?.isOverload ? 156 : bullet.meta?.chainProc ? 117 : bullet.meta?.isFragment ? 48 : 78;
  const splash = bullet.dmg * 0.65;
  const ringMr = bullet.meta?.isOverload ? radius * 2.5 : bullet.meta?.chainProc ? radius * 1.5 : radius;
  addRing(x, y, ringMr, '#FFB627', 2.8, 0.5);
  addBurst(x, y, '#FFB627', 10, 95, 4, 0.45);
  if (bullet.meta?.isOverload && game) game.overloadFlash = Math.max(game.overloadFlash || 0, 0.15);
  if (bullet.meta?.chainProc && game) game.chainFlash = Math.max(game.chainFlash || 0, 0.1);
  applyPulseExplosionDamage(x, y, radius, splash, onHitEnemy, onHitBoss);
  const clusterGen = Math.max(0, bullet.meta?.clusterGen ?? getPulseClusterGeneration(bullet.meta?.pulseLvl || 1));
  if (clusterGen > 0) {
    spawnPulseClusterBombs(x, y, bullet.dmg * 0.45, 1, clusterGen, {
      chainState: bullet.meta?.chainState || null,
      isChainProc: !!bullet.meta?.isChainProc,
    });
  }
}

function spawnPulseClusterBombs(x, y, dmg, generation, maxGeneration, options = {}) {
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
      generation,
      maxGeneration,
      canRecluster: generation < maxGeneration,
      chainState: options.chainState || null,
      isChainProc: !!options.isChainProc,
    });
  }
}

export function spawnPulseClusters(x, y, dmg, maxGeneration, options = {}) {
  if (maxGeneration <= 0) return;
  spawnPulseClusterBombs(x, y, dmg, 1, maxGeneration, options);
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
  const chainReactionActive = game && getAscension(game.P, 'pulse') === 'chain_reaction';
  const radiusBase = cluster.generation === 1 ? 56 : 42;
  const radius = chainReactionActive ? radiusBase * 1.3 : radiusBase;
  const color = cluster.generation === 1 ? '#FFB627' : '#FFE4A3';
  addRing(cluster.x, cluster.y, radius, color, 1.8, 0.35);
  const burstCount = (cluster.generation === 1 ? 6 : 4) + (chainReactionActive ? 4 : 0);
  const burstSpeed = (chainReactionActive ? 1.3 : 1) * 70;
  addBurst(cluster.x, cluster.y, color, burstCount, burstSpeed, 2.8, 0.35);
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
      cluster.maxGeneration,
      {
        chainState: cluster.chainState,
        isChainProc: cluster.isChainProc,
      }
    );
  }
  if (game?.handlePulseClusterExplosion) game.handlePulseClusterExplosion(cluster, radius, color);
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
