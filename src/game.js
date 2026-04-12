import { initHUD, updateHUD, showOverlay, hideOverlay, setSurge, setBossBar, showDiscoveryOverlay, showRecordsScreen, showAscensionDraft } from './hud.js';
import { initInput, initJoystick, jDir } from './input.js';
import { CHARACTERS, addWeapon, getAscension, getOwnedWeaponIds, getWeaponLevel, hasAscension, mkPlayer } from './player.js';
import { enemies, resetEnemies, spawnEnemy, pruneEnemies, dist2, nearest, setExtraTarget, clearExtraTarget, tickEnemyStatus, updateEnemyFreezeState } from './enemies.js';
import { ASCENSIONS, EMP_SCALING, WDEFS, bullets, resetBullets, resetPulseClusters, handleCryoImpact, updateCryoFields, getPulseHitDamage, triggerPulseExplosion, spawnBullet, applyFreezeMeter, spawnPulseClusters } from './weapons.js';
import { PASSIVES, buildPool, applyUpgrade, buildAscensionPool, applyAscension } from './upgrades.js';
import { updateParticles, addRing, addBurst, addDot, addArc, drawParticles } from './particles.js';
import { mkBoss, updateBoss, drawBoss, hitBoss, BOSS_SPAWN_TIME, BOSS_RESPAWN_DELAY } from './boss.js';
import { SYNERGIES, recordDiscovery, recordRun } from './progression.js';
import { WORLD_BOUNDARY_WARN, WORLD_H, WORLD_W } from './constants.js';
import {
  initAudio, resumeAudio,
  playEMPSound,
  playCryoFire, playPulseFire, playCascadeSound, playTriplePulseSound, playArcSound,
  playArcBladeSound, playArcBladeReturnSound,
  playNovaDetonationSound,
  playFrenzySound,
  playHit, playEnemyDeath, playPlayerHit, playDodge,
  playLevelUp, playXp, playSurge, playDeath, playDiscoverySound,
  playShatter,
  playBossWarning, playBossPhaseTwo, playBossDeath,
  startBossMusic, stopBossMusic,
} from './audio.js';

const ARC_BLADE_TIERS = {
  1: { discCount: 1, rx: 55, ry: 35, thetaSpeed: 3.2, dmgMult: 1.0, pierce: false },
  2: { discCount: 1, rx: 65, ry: 42, thetaSpeed: 3.2, dmgMult: 1.3, pierce: false },
  3: { discCount: 2, rx: 75, ry: 48, thetaSpeed: 3.0, dmgMult: 1.3, pierce: false },
  4: { discCount: 2, rx: 85, ry: 55, thetaSpeed: 2.8, dmgMult: 1.4, pierce: false },
  5: { discCount: 3, rx: 95, ry: 62, thetaSpeed: 2.6, dmgMult: 1.5, pierce: false },
};

function traceEnemyShape(ctx, e) {
  ctx.beginPath();
  if (e.shape === 'sq') ctx.rect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
  else if (e.shape === 'tri') {
    ctx.moveTo(e.x, e.y - e.r);
    ctx.lineTo(e.x + e.r, e.y + e.r);
    ctx.lineTo(e.x - e.r, e.y + e.r);
    ctx.closePath();
  } else {
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  }
}

export class Game {
  constructor() {
    this.P = null;
    this.selectedCharId = 'ghost';
    this.gt = 0;
    this.lt = 0;
    this.dt = 0;
    this.running = false;
    this.paused = false;
    this.killCount = 0;
    this.gems = [];
    this.healOrbs = [];
    this.healOrbDropCooldown = 0;
    this.barrierHealFx = [];
    this.dmgNums = [];
    this.shake = { x: 0, y: 0, t: 0, mag: 22 };
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this._st = 0;
    this._lastHitSound = 0;
    this._lastXpSound = 0;
    this.surgeFlashT = 0;
    this._dmgTextSkip = 0;
    this.boss = null;
    this.bossWarned = false;
    this.bossIntro = false;
    this.bossIntroT = 0;
    this.nextBossTime = BOSS_SPAWN_TIME;
    this.bossRespawnT = 0;
    this.cryoFields = [];
    this.runDiscoveries = new Set();
    this.runNewDiscoveries = new Set();
    this.discoveryPauseQueue = [];
    this.discoveryPauseActive = false;
    this.shatterFlashT = 0;
    this.shatterBursts = [];
    this.playtestMode = false;
    this.playtestBuild = null;
    this.camX = 0;
    this.camY = 0;
    this.bgNodes = [];
    this.bgConnections = [];
    this.bgPackets = [];
    this.pendingExplosions = [];
    this.pendingCascades = [];
    this.tripleWaves = [];
    this.slowFields = [];
    this.overloadFlash = 0;
    this.chainFlash = 0;
    this.novaFlashT = 0;
    this.novaImpactFlashes = [];
  }

  start() {
    initHUD();
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 100);
    });
    window.addEventListener('touchstart', resumeAudio, { passive: true });
    initInput();
    initJoystick(
      document.getElementById('joystick-zone'),
      document.getElementById('joystick'),
      document.getElementById('jknob')
    );
    window.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'l') return;
      if (!this.playtestMode || !this.running || this.discoveryPauseActive) return;
      if (document.getElementById('overlay')?.style.display === 'flex') return;
      this.openPlaytestLab();
    });
    window.__game = this;
    this.showStart();
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.canvas.width = W;
    this.canvas.height = H;
    this.W = W;
    this.H = H;
  }

  newRun(char = CHARACTERS.ghost, options = {}) {
    this.selectedCharId = char.id;
    this.playtestMode = !!options.playtest;
    if (this.playtestMode) {
      this.playtestBuild = sanitizePlaytestBuild(options.build || this.playtestBuild || createPlaytestBuild(char), char);
    }
    initAudio();
    resumeAudio();
    resetEnemies();
    resetBullets();
    resetPulseClusters();
    this.gems = [];
    this.healOrbs = [];
    this.healOrbDropCooldown = 0;
    this.barrierHealFx = [];
    this.dmgNums = [];
    this.gt = 0;
    this.killCount = 0;
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this._st = 0;
    this._lastHitSound = 0;
    this._lastXpSound = 0;
    this.surgeFlashT = 0;
    this._dmgTextSkip = 0;
    this.boss = null;
    this.bossWarned = false;
    this.bossIntro = false;
    this.bossIntroT = 0;
    this.nextBossTime = BOSS_SPAWN_TIME;
    this.bossRespawnT = 0;
    this.cryoFields = [];
    this.runDiscoveries = new Set();
    this.runNewDiscoveries = new Set();
    this.discoveryPauseQueue = [];
    this.discoveryPauseActive = false;
    this.shatterFlashT = 0;
    this.shatterBursts = [];
    this.pendingExplosions = [];
    this.pendingCascades = [];
    this.tripleWaves = [];
    this.slowFields = [];
    this.overloadFlash = 0;
    this.chainFlash = 0;
    this.novaFlashT = 0;
    this.novaImpactFlashes = [];
    this.P = mkPlayer(this.W, this.H, char);
    this.P._pulseMines = [];
    this.P._pulseOverloadCounter = 0;
    this.P._arcDiscs = [];
    this.P._sawBlade = null;
    this.P._novaDrones = [];
    this.P._splitDrones = [];
    this.P._dr = null;
    this.P._miniDr = [];
    this.camX = 0;
    this.camY = 0;
    this.initBackground();
    if (this.playtestMode) this._applyPlaytestBuildToPlayer();
    if (this.P._dr) this.P._dr.forEach(d => { d.hasSplitThisContact = false; d.frenzy = false; d.frenzyT = 0; });
    this.P.vx = 0;
    this.P.vy = 0;
    this.shake.x = 0;
    this.shake.y = 0;
    this.shake.t = 0;
    this.shake.mag = 22;
    this.running = true;
    this.paused = false;
    this.setPlaytestToggleVisible(this.playtestMode);
    clearExtraTarget();
    setBossBar(null);
    hideOverlay();
    this.updateCamera();
    this.lt = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
  }

  triggerSynergy(synergyId) {
    this.runDiscoveries.add(synergyId);
    const synergy = SYNERGIES.find(entry => entry.id === synergyId);
    const isNew = recordDiscovery(synergyId);
    if (!isNew) return false;
    this.runNewDiscoveries.add(synergyId);
    if (synergy) {
      this.discoveryPauseQueue.push(synergy);
      this._showNextDiscoveryPause();
    }
    playDiscoverySound();
    return true;
  }

  _showNextDiscoveryPause() {
    if (this.discoveryPauseActive) return;
    const synergy = this.discoveryPauseQueue.shift();
    if (!synergy) return;
    this.discoveryPauseActive = true;
    this.paused = true;
    showDiscoveryOverlay(synergy, () => this.resumeAfterDiscovery());
  }

  resumeAfterDiscovery() {
    hideOverlay();
    this.discoveryPauseActive = false;
    if (this.discoveryPauseQueue.length) {
      this._showNextDiscoveryPause();
      return;
    }
    if (this.running) this.paused = false;
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lt) / 1000, 0.033);
    this.dt = dt;
    this.lt = ts;
    if (!this.paused) { this.gt += dt; this.update(dt); }
    this.draw();
    requestAnimationFrame(ts => this.loop(ts));
  }

  updateCamera() {
    this.camX = cl(this.P.x - this.W / 2, 0, Math.max(0, WORLD_W - this.W));
    this.camY = cl(this.P.y - this.H / 2, 0, Math.max(0, WORLD_H - this.H));
  }

  toScreen(wx, wy) {
    return { x: wx - this.camX, y: wy - this.camY };
  }

  initBackground() {
    const nodeCount = 200;
    this.bgNodes = [];
    for (let i = 0; i < nodeCount; i++) {
      this.bgNodes.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        pulses: Math.random() < 0.25,
        pulseOffset: Math.random() * Math.PI * 2,
        r: 3 + Math.random() * 1.5,
      });
    }

    this.bgConnections = [];
    for (let i = 0; i < this.bgNodes.length; i++) {
      const a = this.bgNodes[i];
      const distances = this.bgNodes
        .map((b, j) => ({ j, d: Math.hypot(b.x - a.x, b.y - a.y) }))
        .filter(({ j, d }) => j !== i && d < 350)
        .sort((lhs, rhs) => lhs.d - rhs.d)
        .slice(0, 3);
      distances.forEach(({ j }) => {
        if (!this.bgConnections.find(c => (c.a === i && c.b === j) || (c.a === j && c.b === i))) {
          this.bgConnections.push({ a: i, b: j });
        }
      });
    }

    this.bgPackets = [];
    for (let i = 0; i < 4; i++) this.spawnPacket();
  }

  spawnPacket() {
    if (!this.bgConnections.length) return;
    const connIdx = Math.floor(Math.random() * this.bgConnections.length);
    this.bgPackets.push({
      connIdx,
      t: 0,
      speed: 0.015 + Math.random() * 0.02,
    });
  }

  updateBackground(dt) {
    this.bgPackets.forEach(packet => {
      packet.t += packet.speed * dt * 60;
    });
    this.bgPackets = this.bgPackets.filter(packet => packet.t < 1);
    while (this.bgPackets.length < 4) this.spawnPacket();
  }

  update(dt) {
    const { P, W, H } = this;
    this.updateCamera();
    const sh = this.shake;
    sh.t = Math.max(0, sh.t - dt);
    sh.x = sh.t > 0 ? (Math.random() - .5) * sh.t * sh.mag : 0;
    sh.y = sh.t > 0 ? (Math.random() - .5) * sh.t * sh.mag : 0;

    const prevX = P.x;
    const prevY = P.y;
    P.x = cl(P.x + jDir.x * P.spd * dt, P.r, WORLD_W - P.r);
    P.y = cl(P.y + jDir.y * P.spd * dt, P.r, WORLD_H - P.r);
    P.vx = (P.x - prevX) / Math.max(dt, 0.0001);
    P.vy = (P.y - prevY) / Math.max(dt, 0.0001);
    if (P.invT > 0) P.invT -= dt;
    if (P.hurtFlash > 0) P.hurtFlash = Math.max(0, P.hurtFlash - dt * 2.8);
    if (P.barrierHealT > 0) P.barrierHealT = Math.max(0, P.barrierHealT - dt * 1.2);
    if (P.barrierHealImpactT > 0) P.barrierHealImpactT = Math.max(0, P.barrierHealImpactT - dt * 2.4);
    if (P.hpLag > P.hp) P.hpLag = Math.max(P.hp, P.hpLag - dt * Math.max(35, (P.hpLag - P.hp) * 3.2));
    else P.hpLag = P.hp;
    if (this.healOrbDropCooldown > 0) this.healOrbDropCooldown = Math.max(0, this.healOrbDropCooldown - dt);
    this.barrierHealFx = this.barrierHealFx.filter(fx => {
      fx.life -= dt;
      return fx.life > 0;
    });
    if (this.shatterFlashT > 0) this.shatterFlashT = Math.max(0, this.shatterFlashT - dt);
    if (this.overloadFlash > 0) this.overloadFlash = Math.max(0, this.overloadFlash - dt);
    if (this.chainFlash > 0) this.chainFlash = Math.max(0, this.chainFlash - dt);
    if (this.novaFlashT > 0) this.novaFlashT = Math.max(0, this.novaFlashT - dt);
    this.novaImpactFlashes = this.novaImpactFlashes.filter(flash => {
      flash.life -= dt;
      return flash.life > 0;
    });
    this.shatterBursts = this.shatterBursts.filter(p => {
      p.life -= dt;
      p.x += Math.cos(p.a) * p.spd * dt;
      p.y += Math.sin(p.a) * p.spd * dt;
      return p.life > 0;
    });

    this._updateSurge(dt);
    this.updateBackground(dt);
    this._spawnEnemies(dt);
    this._updateBoss(dt);
    this._fireWeapons(dt);
    if (getWeaponLevel(P, 'arcblade')) {
      this.updateArcBlade(dt);
    }
    this.updateTripleWaves(dt);
    this.updatePendingCascades(dt);
    this._updateBullets(dt);
    updateCryoFields(this, dt);
    this.updateSlowFields(dt);
    this.updateSplitDrones(dt);
    this._updateEnemies(dt);
    this.updatePendingExplosions(dt);
    this.updateMines(dt);
    this._updateGems(dt);
    this._updateHealOrbs(dt);

    updateParticles(dt);
    this.dmgNums = this.dmgNums.filter(d => { d.y -= 40 * dt; d.life -= dt; return d.life > 0; });
    this.updateCamera();
    updateHUD(P, this.gt, WDEFS);
    setBossBar(this.boss);
  }

  setShake(duration, mag = 22) {
    this.shake.t = Math.max(this.shake.t, duration);
    this.shake.mag = Math.max(this.shake.mag, mag);
  }

  hitPlayer(dmg, shakeDur = 0.28, shakeMag = 26) {
    const P = this.P;
    if (P.invT > 0) return false;
    if (Math.random() <= P.dodge) {
      this.addDN(P.x, P.y - 20, 'DODGE', P.col, 0.55);
      playDodge();
      return false;
    }
    const remainingDamage = this.absorbWithShield(dmg);
    if (remainingDamage <= 0) return false;
    P.hp -= remainingDamage;
    P.invT = 0.7;
    P.hurtFlash = 1;
    P.hpLag = Math.max(P.hpLag, P.hp + remainingDamage);
    this.setShake(shakeDur, shakeMag);
    playPlayerHit();
    if (P.hp <= 0) { P.hp = 0; this.endGame(); }
    return true;
  }

  absorbWithShield(damage) {
    const P = this.P;
    if (!getWeaponLevel(P, 'barrier') || !P._shieldActive) return damage;
    const absorbed = Math.min(damage, P._shieldCap || 0);
    P._shieldCap = Math.max(0, (P._shieldCap || 0) - absorbed);
    P._shieldAbsorbedCycle = (P._shieldAbsorbedCycle || 0) + absorbed;
    P._shieldHitT = 0.2;
    if (absorbed > 0) {
      addBurst(P.x, P.y, '#C6FF00', 6, 80, 2.8, 0.18);
      addRing(P.x, P.y, P.r + 11, '#FFFFFF', 2, 0.12);
    }
    if (P._shieldCap <= 0 && P._shieldActive) {
      const tier = WDEFS.barrier.tiers[Math.min(getWeaponLevel(P, 'barrier'), 5)];
      this._breakShield(P, tier);
    }
    return damage - absorbed;
  }

  _breakShield(P, tier) {
    if (!P._shieldActive) return;
    P._shieldActive = false;
    P._shieldCap = Math.max(0, P._shieldCap || 0);
    P._shieldRechargeT = tier.rechargeTime;
    P._shieldFlashT = 0.22;
    P._shieldHitT = 0;
    const heal = Math.min(P.maxHp - P.hp, Math.round(P._shieldAbsorbedCycle || 0));
    if (heal > 0) {
      const healFrom = P.hp;
      P.hp += heal;
      P.hpLag = Math.max(P.hpLag, P.hp);
      P.barrierHealFrom = healFrom;
      P.barrierHealTo = P.hp;
      P.barrierHealT = 1;
      P.barrierHealImpactT = 1;
      this._spawnBarrierHealFx(P, healFrom, P.hp);
      this.addDN(P.x, P.y - 26, `+${heal}`, '#C6FF00', 0.8, true);
    }
    P._shieldAbsorbedCycle = 0;
    addBurst(P.x, P.y, '#C6FF00', 18, 150, 4.5, 0.36);
    addBurst(P.x, P.y, '#FFFFFF', 10, 95, 2.8, 0.18);
    addRing(P.x, P.y, P.r + 10, '#FFFFFF', 3.5, 0.16);
    addRing(P.x, P.y, P.r + 24, '#C6FF00', 3, 0.34);
    this.setShake(0.22, 22);
  }

  _spawnBarrierHealFx(P, healFrom, healTo) {
    const targetRatio = Math.max(0, Math.min(1, ((healFrom + healTo) * 0.5) / P.maxHp));
    const count = 8;
    for (let i = 0; i < count; i++) {
      this.barrierHealFx.push({
        sx: P.x,
        sy: P.y,
        targetRatio,
        drift: (Math.random() - 0.5) * 36,
        lift: 80 + Math.random() * 36,
        size: 2.5 + Math.random() * 2,
        delay: i * 0.025,
        life: 0.72 + i * 0.025,
        lt: 0.72 + i * 0.025,
      });
    }
  }

  _restoreShield(P) {
    P._shieldActive = true;
    P._shieldCap = P._shieldMaxCap;
    P._shieldHitT = 0;
    P._shieldAbsorbedCycle = 0;
    addRing(P.x, P.y, P.r + 14, '#C6FF00', 3, 0.35);
    addRing(P.x, P.y, P.r + 22, '#FFFFFF', 1.6, 0.18);
    addBurst(P.x, P.y, '#C6FF00', 10, 90, 3.2, 0.24);
  }

  applyBossTransitionTax() {
    const P = this.P;
    if (!P || P.hp <= 0) return;
    const tax = P.hp * 0.25;
    P.hp = Math.max(1, P.hp - tax);
    P.hurtFlash = 1;
    P.hpLag = Math.max(P.hpLag, P.hp + tax);
    this.setShake(0.48, 34);
    playPlayerHit();
  }

  clearEnemyBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].enemy) bullets.splice(i, 1);
    }
  }

  queuePulseExplosion({ x, y, dmg, clusterGen = 0, delay = 0.3, sourceMeta = null }) {
    this.pendingExplosions.push({ x, y, dmg, clusterGen, delay, sourceMeta });
  }

  handleNovaDroneKill(x, y, killedEnemy, options = {}) {
    if (!killedEnemy) return;
    const blastR = 110;
    const blastDmg = (killedEnemy.maxHp || 0) * 0.4;

    enemies.forEach(e => {
      if (Math.hypot(e.x - x, e.y - y) < blastR) {
        this.hitEnemy(e, blastDmg, '#1DFFD0');
      }
    });
    pruneEnemies();

    addRing(x, y, blastR, '#1DFFD0', 2.8, 0.4);
    addRing(x, y, 60, '#AAFFEE', 1.6, 0.28);
    addBurst(x, y, '#AAFFEE', 16, 130, 3.2, 0.45);
    this.novaImpactFlashes.push({ x, y, r: 20, life: 0.1, maxLife: 0.1 });
    this.novaFlashT = Math.max(this.novaFlashT, 0.1);
    playNovaDetonationSound();

    if (!options.isNova) {
      this.P._novaDrones.push({
        a: Math.random() * Math.PI * 2,
        ht: 0,
        life: 8.0,
        isNova: true,
      });
    }
  }

  handleNovaDroneExpire(x, y) {
    addBurst(x, y, '#AAFFEE', 5, 35, 2, 0.16);
    addRing(x, y, 20, '#AAFFEE', 1.4, 0.18);
  }

  spawnSplitDrone(P, parentDrone, targetEnemy, orbitR) {
    const takenTargets = new Set(P._splitDrones.map(sd => sd.target).filter(Boolean));
    takenTargets.add(targetEnemy);

    let bestTarget = null;
    let bestDist = Infinity;
    enemies.forEach(e => {
      if (takenTargets.has(e)) return;
      if (e.hp <= 0) return;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = e;
      }
    });

    const spawnX = P.x + Math.cos(parentDrone.a) * orbitR;
    const spawnY = P.y + Math.sin(parentDrone.a) * orbitR;
    P._splitDrones.push({
      x: spawnX,
      y: spawnY,
      target: bestTarget,
      life: 3.0,
      maxLife: 3.0,
      ht: 0,
      speed: 220,
    });

    addBurst(spawnX, spawnY, '#1DFFD0', 6, 80, 2, 0.3);
    addRing(spawnX, spawnY, 20, '#1DFFD0', 1.5, 0.2);
  }

  updateSplitDrones(dt) {
    if (!this.P._splitDrones?.length) return;
    const swarmLvl = getWeaponLevel(this.P, 'swarm');
    const dmg = this.P.dmg * (7 + swarmLvl * 3.5) * 0.6;
    this.P._splitDrones = this.P._splitDrones.filter(sd => {
      sd.life -= dt;
      if (sd.life <= 0) {
        addBurst(sd.x, sd.y, '#1DFFD066', 4, 40, 1.5, 0.2);
        return false;
      }

      if (!sd.target || sd.target.hp <= 0) {
        const takenTargets = new Set(
          this.P._splitDrones
            .filter(other => other !== sd)
            .map(other => other.target)
            .filter(Boolean)
        );
        sd.target = enemies.find(e => e.hp > 0 && !takenTargets.has(e))
          || enemies.find(e => e.hp > 0)
          || null;
      }

      if (sd.target) {
        const dx = sd.target.x - sd.x;
        const dy = sd.target.y - sd.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        sd.x += (dx / d) * sd.speed * dt;
        sd.y += (dy / d) * sd.speed * dt;

        sd.ht = Math.max(0, (sd.ht || 0) - dt);
        if (d < sd.target.r + 4 && sd.ht <= 0) {
          sd.ht = 0.3;
          this.hitEnemy(sd.target, dmg, '#1DFFD0');
          pruneEnemies();
        }
      }
      return true;
    });
  }

  launchDisc(discIndex, throwAngle) {
    const P = this.P;
    const tier = ARC_BLADE_TIERS[getWeaponLevel(P, 'arcblade')];
    if (!tier) return;

    const cx = P.x + Math.cos(throwAngle) * tier.rx;
    const cy = P.y + Math.sin(throwAngle) * tier.rx;
    const disc = {
      rx: tier.rx,
      ry: tier.ry,
      theta: Math.PI,
      thetaSpeed: tier.thetaSpeed,
      throwAngle,
      cx,
      cy,
      rotation: 0,
      dmg: P.dmg * tier.dmgMult * 15,
      pierce: tier.pierce,
      hitEnemies: new Set(),
      discIndex,
      isSplit: false,
      x: P.x,
      y: P.y,
      trail: [],
    };

    P._arcDiscs.push(disc);
    playArcBladeSound();
  }

  updateArcBlade(dt) {
    const P = this.P;
    const tier = ARC_BLADE_TIERS[getWeaponLevel(P, 'arcblade')];
    if (!tier) return;
    const arcAscension = P.ascensions.arcblade;

    if (arcAscension !== 'saw_blade' && P._sawBlade) P._sawBlade = null;

    if (arcAscension === 'saw_blade') {
      if (!P._sawBlade) {
        P._sawBlade = {
          theta: 0,
          thetaSpeed: 2.2,
          orbitR: 80,
          rotation: 0,
          x: P.x,
          y: P.y,
          damageTimer: 0,
        };
      }
      if (P._arcDiscs.length) P._arcDiscs = [];
      this.updateSawBlade(dt);
      return;
    }

    const target = nearest(P);
    const baseAngle = target
      ? Math.atan2(target.y - P.y, target.x - P.x)
      : 0;
    for (let i = 0; i < tier.discCount; i++) {
      const active = P._arcDiscs.filter(disc => disc.discIndex === i);
      if (active.length === 0) {
        const throwAngle = getDiscAngle(i, tier.discCount, baseAngle);
        this.launchDisc(i, throwAngle);
      }
    }

    P._arcDiscs = P._arcDiscs.filter(disc => {
      disc.theta += disc.thetaSpeed * dt;
      disc.rotation += dt * 8;

      disc.cx = this.P.x + Math.cos(disc.throwAngle) * disc.rx;
      disc.cy = this.P.y + Math.sin(disc.throwAngle) * disc.rx;
      const cosA = Math.cos(disc.throwAngle);
      const sinA = Math.sin(disc.throwAngle);
      const localX = Math.cos(disc.theta) * disc.rx;
      const localY = Math.sin(disc.theta) * disc.ry;
      disc.x = disc.cx + localX * cosA - localY * sinA;
      disc.y = disc.cy + localX * sinA + localY * cosA;
      disc.trail ||= [];
      disc.trail.push({ x: disc.x, y: disc.y });
      if (disc.trail.length > 6) disc.trail.shift();

      if (!disc._passedPeak && disc.theta >= Math.PI * 2) {
        disc._passedPeak = true;
        disc.hitEnemies.clear();
      }

      if (disc.theta >= Math.PI * 3) {
        playArcBladeReturnSound();
        return false;
      }

      let stopOnHit = false;
      enemies.forEach(e => {
        if (stopOnHit) return;
        if (disc.hitEnemies.has(e)) return;
        const d = Math.hypot(e.x - disc.x, e.y - disc.y);
        if (d < e.r + 10) {
          disc.hitEnemies.add(e);
          this.hitEnemy(e, disc.dmg, '#FF2D9B');

          if (!disc.pierce) stopOnHit = true;
        }
      });
      pruneEnemies();
      return !stopOnHit;
    });
  }

  updateSawBlade(dt) {
    const P = this.P;
    if (!P._sawBlade) return;
    const tier = ARC_BLADE_TIERS[getWeaponLevel(P, 'arcblade')];
    if (!tier) return;
    const saw = P._sawBlade;

    saw.thetaSpeed = 2.2;
    saw.theta += saw.thetaSpeed * dt;
    saw.rotation += dt * 5;
    saw.x = P.x + Math.cos(saw.theta) * saw.orbitR;
    saw.y = P.y + Math.sin(saw.theta) * saw.orbitR;

    saw.damageTimer -= dt;
    if (saw.damageTimer <= 0) {
      saw.damageTimer = 0.1;
      const sawDmg = P.dmg * tier.dmgMult * 15 * 0.25;
      enemies.forEach(e => {
        if (Math.hypot(e.x - saw.x, e.y - saw.y) < 40 + e.r) {
          this.hitEnemy(e, sawDmg, '#FF2D9B');
        }
      });
      pruneEnemies();
    }
  }

  updatePendingExplosions(dt) {
    if (!this.pendingExplosions.length) return;
    for (let i = this.pendingExplosions.length - 1; i >= 0; i--) {
      const explosion = this.pendingExplosions[i];
      explosion.delay -= dt;
      if (explosion.delay > 0) continue;
      const bullet = {
        x: explosion.x,
        y: explosion.y,
        dmg: explosion.dmg,
        col: '#FFB627',
        meta: {
          type: 'pulse',
          pulseLvl: explosion.sourceMeta?.pulseLvl || getWeaponLevel(this.P, 'pulse'),
          clusterGen: explosion.clusterGen,
          isOverload: !!explosion.sourceMeta?.isOverload,
          isFragment: !!explosion.sourceMeta?.isFragment,
          chainProc: !!explosion.sourceMeta?.chainProc,
          chainState: explosion.sourceMeta?.chainState || null,
          isChainProc: !!explosion.sourceMeta?.isChainProc,
        },
      };
      triggerPulseExplosion(
        this,
        bullet,
        explosion.x,
        explosion.y,
        (target, splash, col) => this.hitEnemy(target, splash, col),
        (splash, col) => this._doBossHit(splash, col)
      );
      this.pendingExplosions.splice(i, 1);
    }
  }

  updateTripleWaves(dt) {
    if (!this.tripleWaves?.length) return;
    this.tripleWaves = this.tripleWaves.filter(wave => {
      wave.r1 = Math.min(wave.r1 + wave.speed1 * dt, wave.maxR1);
      wave.r2 = Math.min(wave.r2 + wave.speed2 * dt, wave.maxR2);
      wave.r3 = Math.min(wave.r3 + wave.speed3 * dt, wave.maxR3);
      wave.life -= dt;

      if (!wave.r1Sound && wave.r1 > wave.maxR1 * 0.2) {
        wave.r1Sound = true;
        playTriplePulseSound(1);
      }
      if (!wave.r2Sound && wave.r2 > wave.maxR2 * 0.2) {
        wave.r2Sound = true;
        playTriplePulseSound(2);
      }
      if (!wave.r3Sound && wave.r3 > wave.maxR3 * 0.2) {
        wave.r3Sound = true;
        playTriplePulseSound(3);
      }

      enemies.forEach(e => {
        if (wave.hitEnemies.has(e)) return;
        const d = Math.hypot(e.x - wave.x, e.y - wave.y);
        if (d <= wave.r1 + e.r) {
          wave.hitEnemies.add(e);
          this.hitEnemy(e, wave.dmg, '#BF77FF');
          if (e.hp <= 0) return;
          this.applyTriplePulseKnockback(e, wave, 1);
        } else if (d <= wave.r2 + e.r) {
          wave.hitEnemies.add(e);
          this.hitEnemy(e, wave.dmg * 0.6, '#9955DD');
          if (e.hp <= 0) return;
          this.applyTriplePulseKnockback(e, wave, 2);
        } else if (d <= wave.r3 + e.r) {
          wave.hitEnemies.add(e);
          this.hitEnemy(e, wave.dmg * 0.3, '#7733BB');
          if (e.hp <= 0) return;
          this.applyTriplePulseKnockback(e, wave, 3);
        }
      });

      if (this.boss?.alive && !wave.hitBoss) {
        const d = Math.hypot(this.boss.x - wave.x, this.boss.y - wave.y);
        if (d <= wave.r1 + this.boss.r) {
          wave.hitBoss = true;
          this._doBossHit(wave.dmg, '#BF77FF');
        } else if (d <= wave.r2 + this.boss.r) {
          wave.hitBoss = true;
          this._doBossHit(wave.dmg * 0.6, '#9955DD');
        } else if (d <= wave.r3 + this.boss.r) {
          wave.hitBoss = true;
          this._doBossHit(wave.dmg * 0.3, '#7733BB');
        }
      }

      pruneEnemies();
      return wave.life > 0 && (wave.r1 < wave.maxR1 || wave.r2 < wave.maxR2 || wave.r3 < wave.maxR3);
    });
  }

  applyTriplePulseKnockback(e, wave, ring) {
    const knockAngle = Math.atan2(e.y - wave.y, e.x - wave.x);
    const baseStrength = ring === 1 ? 80 : ring === 2 ? 140 : 200;
    const typeMult = e.type === 'brute' ? 0.4 : e.type === 'runner' ? 1.3 : 1;
    const strength = baseStrength * typeMult;
    e._knockVx = Math.cos(knockAngle) * strength;
    e._knockVy = Math.sin(knockAngle) * strength;
    e._knockT = 0.35;
  }

  applyCascadePulse(hitEnemies) {
    if (!hitEnemies?.length) return;
    hitEnemies.forEach(source => {
      if (!source || source.hp <= 0) return;
      this.pendingCascades.push({
        x: source.x,
        y: source.y,
        sourceEnemy: source,
        delay: 0.4,
        fired: false,
      });
    });
  }

  updatePendingCascades(dt) {
    if (!this.pendingCascades?.length) return;
    this.pendingCascades = this.pendingCascades.filter(cascade => {
      cascade.delay -= dt;
      if (cascade.sourceEnemy && cascade.sourceEnemy.hp > 0) {
        cascade.x = cascade.sourceEnemy.x;
        cascade.y = cascade.sourceEnemy.y;
      }

      const chargeProgress = 1 - (cascade.delay / 0.4);
      const chargeR = chargeProgress * 40;
      if (chargeR > 0) {
        addRing(cascade.x, cascade.y, chargeR, '#CC66FF', 1.5, 0.08, {
          shadowColor: '#CC66FF',
          shadowBlur: 8,
        });
      }

      if (cascade.delay <= 0 && !cascade.fired) {
        cascade.fired = true;
        this.fireCascadeBurst(cascade.x, cascade.y);
        return false;
      }
      return !cascade.fired;
    });
  }

  fireCascadeBurst(x, y) {
    const cascadeR = 100;
    const cascadeDmg = this.P.dmg * 8;

    addRing(x, y, cascadeR, '#CC66FF', 2.5, 0.45, {
      shadowColor: '#CC66FF',
      shadowBlur: 10,
    });
    addBurst(x, y, '#CC66FF', 8, 80, 2.5, 0.4);

    enemies.forEach(e => {
      if (e._cascaded) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d >= cascadeR) return;
      this.hitEnemy(e, cascadeDmg, '#CC66FF');
      if (e.hp <= 0) return;
      e.stunned = true;
      e.stunT = 1.0;
      e._cascaded = true;
    });
    pruneEnemies();
    playCascadeSound();
  }

  applyArcDischarge(_empBurstDmg) {
    const arcsDrawn = [];
    const MAX_ARCS_PER_ENEMY = 3;
    const ARC_RANGE = 250;
    const MAX_TOTAL_ARCS = 20;
    const stunnedEnemies = enemies.filter(e => e.hp > 0 && e.stunned);

    for (const stunned of stunnedEnemies) {
      if (arcsDrawn.length >= MAX_TOTAL_ARCS) break;

      const nonStunnedCandidates = enemies
        .map(target => ({
          target,
          dist: Math.hypot(target.x - stunned.x, target.y - stunned.y),
        }))
        .filter(({ target, dist }) => target !== stunned && target.hp > 0 && !target.stunned && dist < ARC_RANGE)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_ARCS_PER_ENEMY);

      const fallbackCandidates = nonStunnedCandidates.length
        ? []
        : enemies
          .map(target => ({
            target,
            dist: Math.hypot(target.x - stunned.x, target.y - stunned.y),
          }))
          .filter(({ target, dist }) => target !== stunned && target.hp > 0 && target.stunned && dist < ARC_RANGE)
          .sort((a, b) => (a.target.hp - b.target.hp) || (a.dist - b.dist))
          .slice(0, MAX_ARCS_PER_ENEMY);

      const candidates = nonStunnedCandidates.length ? nonStunnedCandidates : fallbackCandidates;

      for (const { target } of candidates) {
        if (arcsDrawn.length >= MAX_TOTAL_ARCS) break;
        if (target.hp <= 0) continue;

        const dmg = target.maxHp * 0.12;
        const hit = this.hitEnemy(target, dmg, '#BF77FF');
        if (hit.killed) {
          arcsDrawn.push({
            x1: stunned.x,
            y1: stunned.y,
            x2: target.x,
            y2: target.y,
          });
          continue;
        }
        target.stunT = Math.max(target.stunT || 0, 0.5);
        target.stunned = true;
        arcsDrawn.push({
          x1: stunned.x,
          y1: stunned.y,
          x2: target.x,
          y2: target.y,
        });
      }
    }

    pruneEnemies();

    arcsDrawn.forEach(arc => {
      addArc(arc.x1, arc.y1, arc.x2, arc.y2, 0.3, '#BF77FF', {
        glowColor: 'rgba(191, 119, 255, 0.3)',
        glowWidth: 6,
        lineWidth: 2,
        shadowColor: '#BF77FF',
        shadowBlur: 16,
      });
    });

    if (arcsDrawn.length > 0) playArcSound();
  }

  _applyCollapsedRoundPull(x, y) {
    const pullRadius = 180;
    enemies.forEach(e => {
      const dx = x - e.x;
      const dy = y - e.y;
      if (dx * dx + dy * dy > pullRadius * pullRadius) return;
      e._pullTarget = { x, y };
      e._pullTimer = 0.3;
      e._pullSpeed = 400;
    });
    addBurst(x, y, '#FFB627', 12, 110, -2.4, 0.28);
    addRing(x, y, pullRadius, 'rgba(255,182,39,0.4)', 1.8, 0.18);
  }

  handlePulseImpact(bullet, x, y) {
    const ascension = getAscension(this.P, 'pulse');
    if (ascension === 'collapsed_round' && !bullet.meta?.isFragment) {
      this._applyCollapsedRoundPull(x, y);
      this.queuePulseExplosion({
        x,
        y,
        dmg: bullet.dmg,
        clusterGen: Math.max(0, bullet.meta?.clusterGen ?? 0),
        delay: 0.3,
        sourceMeta: {
          pulseLvl: bullet.meta?.pulseLvl,
          isOverload: !!bullet.meta?.isOverload,
          isFragment: !!bullet.meta?.isFragment,
          chainProc: !!bullet.meta?.chainProc,
          chainState: bullet.meta?.chainState || null,
          isChainProc: !!bullet.meta?.isChainProc,
        },
      });
      return;
    }
    triggerPulseExplosion(
      this,
      bullet,
      x,
      y,
      (target, splash, col) => this.hitEnemy(target, splash, col),
      (splash, col) => this._doBossHit(splash, col)
    );
  }

  handlePulseClusterExplosion(cluster) {
    if (getAscension(this.P, 'pulse') !== 'chain_reaction') return;
    if (cluster.isChainProc) return;
    const chainState = cluster.chainState;
    if (!chainState || chainState.procs >= 3) return;
    if (Math.random() >= 0.35) return;
    chainState.procs += 1;
    addRing(cluster.x, cluster.y, 80, '#FFB627', 2.8, 0.3);
    addBurst(cluster.x, cluster.y, '#FFD56A', 10, 200, 2.8, 0.22);
    this.chainFlash = Math.max(this.chainFlash, 0.1);
    const lvl = getWeaponLevel(this.P, 'pulse');
    const procBullet = {
      x: cluster.x,
      y: cluster.y,
      dmg: this.P.dmg * (28 + lvl * 10),
      col: '#FFB627',
      meta: {
        type: 'pulse',
        tier: lvl,
        pulseLvl: lvl,
        explosive: true,
        clusterGen: Math.max(0, lvl - 1),
        chainProc: true,
        isChainProc: true,
      },
    };
    this.handlePulseImpact(procBullet, cluster.x, cluster.y);
  }

  updateMines(dt) {
    if (!this.P?._pulseMines) return;
    this.P._pulseMines = this.P._pulseMines.filter(mine => {
      mine.life -= dt;
      if (mine.armTimer > 0) {
        mine.armTimer -= dt;
        return mine.life > 0;
      }
      mine.armed = true;
      if (mine.triggered || mine.life <= 0) return false;
      for (const e of enemies) {
        if (Math.hypot(e.x - mine.x, e.y - mine.y) < mine.r + e.r) {
          mine.triggered = true;
          this.triggerMineExplosion(mine);
          return false;
        }
      }
      return true;
    });
  }

  updateSlowFields(dt) {
    this.slowFields = this.slowFields.filter(f => {
      f.life -= dt;
      return f.life > 0;
    });
  }

  triggerMineExplosion(mine) {
    const blastR = 120;
    enemies.forEach(e => {
      if (Math.hypot(e.x - mine.x, e.y - mine.y) < blastR) {
        this.hitEnemy(e, mine.dmg, mine.col);
      }
    });
    pruneEnemies();
    const clusterGen = Math.max(0, getWeaponLevel(this.P, 'pulse') - 1);
    if (clusterGen > 0) {
      spawnPulseClusters(mine.x, mine.y, mine.dmg * 0.5, clusterGen, {
        chainState: getAscension(this.P, 'pulse') === 'chain_reaction' ? { procs: 0 } : null,
      });
    }
    this.slowFields.push({
      x: mine.x,
      y: mine.y,
      r: 100,
      life: 2.0,
      maxLife: 2.0,
    });
    addRing(mine.x, mine.y, blastR, mine.col, 2.5, 0.4);
    addBurst(mine.x, mine.y, mine.col, 16, 150, 3, 0.5);
  }

  _updateSurge(dt) {
    const bossFight = this.bossIntro || (this.boss && this.boss.alive);

    // cancel active surge if boss fight starts
    if (bossFight && this.surgeActive) {
      this.surgeActive = false;
      this.surgeFlashT = 0;
      setSurge(false);
    }

    // suppress surge activation during boss intro/fight, and push nextSurge forward so
    // it doesn't fire the moment the boss dies
    if (bossFight) {
      if (this.gt >= this.nextSurge) this.nextSurge = this.gt + 40;
      return;
    }

    if (this.gt >= this.nextSurge && !this.surgeActive) {
      this.surgeActive = true;
      this.surgeTimer = 8 + Math.floor(this.gt / 60) * 3;
      this.nextSurge += 40;
      this.surgeFlashT = 1.8;
      setSurge(true);
      playSurge();
    }
    if (this.surgeActive) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) { this.surgeActive = false; setSurge(false); }
    }
    if (this.surgeFlashT > 0) this.surgeFlashT -= dt;
  }

  _spawnEnemies(dt) {
    // no spawning during boss intro or while boss is alive
    if (this.bossIntro || (this.boss && this.boss.alive)) return;
    this._st += dt;
    const wave = this.gt / 45;
    const baseRate = Math.max(0.06, 0.9 - this.gt / 110);
    const rate = this.surgeActive ? baseRate * 0.3 : baseRate;
    if (this._st >= rate) {
      this._st = 0;
      const batch = this.surgeActive ? Math.ceil(1 + wave * 0.5) : 1;
      for (let i = 0; i < batch; i++) spawnEnemy(this.gt, this.W, this.H, this.camX, this.camY);
    }
  }

  _updateBoss(dt) {
    const { W, H } = this;

    // warning 5s before intro
    if (!this.bossWarned && this.gt >= this.nextBossTime - 5 && !this.boss && !this.bossIntro) {
      this.bossWarned = true;
      this.addDN(this.P.x, this.P.y - 60, '⚠ SIGNAL INCOMING', '#E24B4A', 2.5, true);
      playBossWarning();
    }

    // trigger intro — clear field, start music and countdown
    if (!this.boss && !this.bossIntro && this.gt >= this.nextBossTime) {
      this.bossIntro = true;
      this.bossIntroT = 3.5;
      this.bossWarned = false;
      resetEnemies();
      this.clearEnemyBullets();
      startBossMusic();
    }

    // tick intro countdown
    if (this.bossIntro) {
      this.bossIntroT -= dt;
      if (this.bossIntroT <= 0) {
        this.bossIntro = false;
        this.boss = mkBoss(this.gt, this.P, H, WORLD_W, WORLD_H);
        setExtraTarget(this.boss); // weapons now lock onto boss
      }
      return; // boss not active yet during intro
    }

    // dead boss — show upgrade screen then schedule respawn
    if (this.boss && !this.boss.alive) {
      this.bossRespawnT -= dt;
      if (this.bossRespawnT <= 0) {
        this.boss = null;
        this.nextBossTime = this.gt + BOSS_RESPAWN_DELAY;
        this.bossWarned = false;
      }
      return;
    }

    if (!this.boss) return;

    updateBoss(this.boss, this.P, dt, {
      onHitPlayer: (dmg) => {
        this.hitPlayer(dmg, 0.32, 30);
      },
      onSpawnBullet: (x, y, vx, vy, r, dmg, col, meta = {}) => {
        bullets.push({ x, y, vx, vy, r, dmg, col, life: meta.life || 3.5, pl: 0, enemy: true, meta });
      },
      onPhaseChange: () => {
        this.setShake(0.72, 40);
        const text = this.boss?.phase === 3 ? '!!! SIGNAL OVERCLOCK !!!' : '!! SIGNAL ENRAGED !!';
        const col = this.boss?.phase === 3 ? '#8A2BE2' : '#D4537E';
        this.addDN(this.P.x, this.P.y - 60, text, col, 2.5, true);
        playBossPhaseTwo();
      },
      onTransitionTax: () => {
        this.applyBossTransitionTax();
      },
      onClearEnemyBullets: () => {
        this.clearEnemyBullets();
      },
    });

    // check death
    if (this.boss.hp <= 0 && this.boss.alive) {
      this.boss.alive = false;
      this.bossRespawnT = BOSS_RESPAWN_DELAY;
      this.killCount++;
      this.spawnGem(this.boss.x, this.boss.y, this.boss.xp);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.spawnGem(this.boss.x + Math.cos(a) * 30, this.boss.y + Math.sin(a) * 30, 10);
      }
      for (let i = 0; i < 3; i++) this.spawnHealOrb(this.boss.x, this.boss.y);
      addBurst(this.boss.x, this.boss.y, this.boss.col, 24, 160, 6, 0.9);
      addRing(this.boss.x, this.boss.y, 120, '#fff', 3, 0.7);
      addRing(this.boss.x, this.boss.y, 180, this.boss.col, 2, 0.9);
      this.setShake(0.6, 36);
      clearExtraTarget(); // weapons stop targeting boss
      stopBossMusic();
      playBossDeath();
      this._showBossUpgrade();
    }
  }

  _showBossUpgrade() {
    this.paused = true;
    const ascensionDraft = buildAscensionPool(this.P);
    if (ascensionDraft) {
      showAscensionDraft(ascensionDraft.weaponId, ascensionDraft.options, ascensionId => {
        this.pickAscension(ascensionDraft.weaponId, ascensionId);
      });
      return;
    }
    const pool = buildPool(this.P);
    const cards = pool.map(u => renderUpgradeCard(u, this.P, `window.__game.pickBossUpgrade('${u.id}')`)).join('');
    showOverlay(`
      <div style="color:#E24B4A;font-size:9px;letter-spacing:3px;margin-bottom:6px">// SIGNAL TERMINATED //</div>
      <div style="font-size:15px;color:#E24B4A;letter-spacing:2px;margin-bottom:4px">BOSS DEFEATED</div>
      <div style="font-size:9px;color:#444;letter-spacing:2px;margin-bottom:18px">choose your reward</div>
      <div class="upg-grid">${cards}</div>`);
  }

  pickBossUpgrade(id) {
    applyUpgrade(id, this.P);
    hideOverlay();
    this.paused = false;
    if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }
  }

  pickAscension(weaponId, ascensionId) {
    applyAscension(this.P, weaponId, ascensionId);
    hideOverlay();
    this.paused = false;
    if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }
  }

  _fireWeapons(dt) {
    const P = this.P;
    // smart callback: route boss vs regular enemy
    const onHit = (e, d, c, big) => {
      if (e === this.boss) return this._doBossHit(d, c, big);
      return this.hitEnemy(e, d, c, big);
    };
    getOwnedWeaponIds(P).forEach(wid => {
      const w = WDEFS[wid]; if (!w.fire) return;
      P.ft[wid] = (P.ft[wid] || 0) + dt;
      const r = w.getRate(P);
      if (r > 0 && P.ft[wid] >= 1 / r) {
        P.ft[wid] = 0;
        let empPreStun = null;
        let empPreHp = null;
        let empEnemyPool = null;
        const empAscension = wid === 'emp' ? getAscension(P, 'emp') : null;
        if (wid === 'emp' && empAscension === 'cascade_pulse') {
          empEnemyPool = [...enemies];
          empPreHp = new Map(empEnemyPool.map(e => [e.id, e.hp]));
        }
        if (wid === 'emp' && (empAscension === 'cascade_pulse' || empAscension === 'arc_discharge')) {
          empPreStun = new Map(enemies.map(e => [e.id, !!e.stunned && (e.stunT || 0) > 0]));
        }
        w.fire.call(this, P, onHit, {
          addText: (...args) => this.addDN(...args),
          triggerSynergy: (id) => this.triggerSynergy(id),
        });
        if (wid === 'emp' && empPreStun) {
          const newlyStunned = enemies.filter(e => {
            const wasStunned = empPreStun.get(e.id);
            return e.hp > 0 && !wasStunned && e.stunned && (e.stunT || 0) > 0;
          });
          if (empAscension === 'cascade_pulse') {
            const hitEnemies = (empEnemyPool || []).filter(e => {
              const prevHp = empPreHp?.get(e.id);
              return e.hp > 0 && prevHp != null && e.hp < prevHp;
            });
            this.applyCascadePulse(hitEnemies);
          }
          if (empAscension === 'arc_discharge') {
            const lvl = getWeaponLevel(P, 'emp');
            this.applyArcDischarge(P.dmg * 5.4 * (EMP_SCALING[lvl]?.dmgMult || EMP_SCALING[1].dmgMult));
          }
        }
        if (wid === 'cryo' && !hasAscension(P, 'cryo', 'frost_field')) playCryoFire();
        else if (wid === 'pulse') playPulseFire();
        else if (wid === 'emp' && empAscension !== 'triple_pulse') playEMPSound();
      }
      w.tick?.(P, dt, onHit, {
        enemies,
        addParticle: (...args) => addRing(...args),
        applyFreezeMeter: (target, amount) => applyFreezeMeter(target, amount),
        triggerSynergy: (id) => this.triggerSynergy(id),
        onNovaDroneKill: (x, y, killedEnemy, options) => this.handleNovaDroneKill(x, y, killedEnemy, options),
        onNovaDroneExpire: (x, y) => this.handleNovaDroneExpire(x, y),
        onFrenzyStart: () => playFrenzySound(),
        spawnSplitDrone: (player, parentDrone, targetEnemy, orbitR) => this.spawnSplitDrone(player, parentDrone, targetEnemy, orbitR),
        onShieldBreak: (player, tier) => this._breakShield(player, tier),
        onShieldRestore: (player) => this._restoreShield(player),
      });
    });
  }

  _tryCryoStormHit(bullet, enemy) {
    if (!hasAscension(this.P, 'cryo', 'cryo_storm')) return false;
    if (bullet.meta?.type !== 'cryo' || bullet.meta?.isCryoShard) return false;
    if (!enemy.frozen) return false;

    enemy.frozenTimer = 1.5;
    this._spawnCryoStormShards(enemy.x, enemy.y);
    addBurst(enemy.x, enemy.y, '#B8F7FF', 8, 85, 2.6, 0.24);
    addRing(enemy.x, enemy.y, 24, '#00CFFF', 1.6, 0.18);
    return true;
  }

  _spawnCryoStormShards(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      spawnBullet(
        x,
        y,
        Math.cos(angle) * 280,
        Math.sin(angle) * 280,
        3,
        this.P.dmg * 3,
        '#8AF4FF',
        0.8,
        { type: 'cryo', tier: 5, cryoLevel: 1, pierce: 0, isCryoShard: true, freezeAmount: 0.8, angle }
      );
    }
  }

  _maybeApplyShatter(enemy) {
    if (!hasAscension(this.P, 'cryo', 'shatter')) return false;
    if (!enemy?.frozen || enemy.isBoss) return false;
    const chance = 0.25 * Math.max(0, Math.min(1, (enemy.frozenTimer || 0) / 1.5));
    if (Math.random() >= chance) return false;

    enemy.hp = 0;
    enemy.shattered = true;
    this.addDN(enemy.x, enemy.y - enemy.r, 'SHATTER', '#FFFFFF', 0.85, true);
    this.shatterFlashT = Math.max(this.shatterFlashT, 0.1);
    this._spawnShatterBurst(enemy.x, enemy.y);
    addRing(enemy.x, enemy.y, enemy.r + 16, '#FFFFFF', 2.4, 0.18);
    addBurst(enemy.x, enemy.y, '#DFF9FF', 10, 70, 2.6, 0.2);
    playShatter();
    return true;
  }

  _spawnShatterBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const life = 0.18 + Math.random() * 0.08;
      this.shatterBursts.push({
        x,
        y,
        a: (Math.PI * 2 * i) / 12,
        spd: 130 + Math.random() * 70,
        len: 8 + Math.random() * 8,
        life,
        maxLife: life,
      });
    }
  }

  _triggerCryoNova(enemy) {
    if (!hasAscension(this.P, 'cryo', 'cryo_nova')) return;

    addRing(enemy.x, enemy.y, 120, '#00CFFF', 3, 0.4);
    addBurst(enemy.x, enemy.y, '#00CFFF', 16, 135, 4.2, 0.4);
    addBurst(enemy.x, enemy.y, '#E9FDFF', 10, 90, 2.8, 0.24);

    enemies.forEach(target => {
      if (target === enemy || target.hp <= 0 || target.frozen) return;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      if (dx * dx + dy * dy > 120 * 120) return;
      target.freezeCooldown = 0;
      target.freezeMeter = target.freezeThreshold;
    });
  }

  _getBulletEnemyCollisionRadius(b, e) {
    if (!b.meta?.isLance) return b.r + e.r;
    const angle = b.meta.angle || Math.atan2(b.vy, b.vx);
    const length = b.meta.lanceLength || 170;
    const tailX = b.x - Math.cos(angle) * length;
    const tailY = b.y - Math.sin(angle) * length;
    const dist = pointToSegmentDistance(e.x, e.y, tailX, tailY, b.x, b.y);
    return dist;
  }

  _canBulletHitTarget(b, targetId, dt) {
    if (!b.meta?.multiHit) return !b.hitIds?.has(targetId);
    if (!b.meta.hitTimers) b.meta.hitTimers = new Map();
    const remaining = Math.max(0, (b.meta.hitTimers.get(targetId) || 0) - dt);
    if (remaining > 0) {
      b.meta.hitTimers.set(targetId, remaining);
      return false;
    }
    b.meta.hitTimers.set(targetId, b.meta.hitInterval || 0.12);
    return true;
  }

  _updateBullets(dt) {
    const { P } = this;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life < 0 || b.x < -80 || b.x > WORLD_W + 80 || b.y < -80 || b.y > WORLD_H + 80) { bullets.splice(i, 1); continue; }

      // enemy bullets hit player
      if (b.enemy) {
        if (dist2(b, P) < (b.r + P.r) ** 2 && P.invT <= 0) {
          this.hitPlayer(b.dmg, 0.24, 24);
          bullets.splice(i, 1);
        }
        continue;
      }

      // player bullets — check boss first, then enemies
      if (b.meta?.type === 'cryo') addDot(b.x, b.y, '#00CFFF44', 2.5, 0.15);

      let alive = true;

      // hit boss
      const bossLanceDist = this.boss?.alive ? this._getBulletEnemyCollisionRadius(b, this.boss) : Infinity;
      const hitBossByCircle = this.boss?.alive && dist2(b, this.boss) < (b.r + this.boss.r) ** 2;
      const hitBossByLance = this.boss?.alive && b.meta?.isLance && bossLanceDist <= this.boss.r + b.r;
      if (this.boss?.alive && this._canBulletHitTarget(b, 'boss', dt) && (hitBossByCircle || hitBossByLance)) {
        let dmg = b.dmg;
        if (b.meta?.type === 'pulse') dmg = getPulseHitDamage(b, dmg);
        this._doBossHit(dmg, b.col, false);
        if (b.meta?.type === 'cryo') handleCryoImpact(this, b, this.boss, b.x, b.y, true);
        if (b.meta?.type === 'pulse') {
          this.handlePulseImpact(b, b.x, b.y);
        }
        if (!b.meta?.multiHit) b.hitBoss = true;
        if (!b.meta?.multiHit) b.pl = (b.pl || 0) - 1;
        if (b.pl < 0) { alive = false; }
      }

      if (alive) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (!e) continue;
          if (!this._canBulletHitTarget(b, e.id, dt)) continue;
          const lanceDist = this._getBulletEnemyCollisionRadius(b, e);
          const hitByCircle = dist2(b, e) < (b.r + e.r) ** 2;
          const hitByLance = b.meta?.isLance && lanceDist <= e.r + b.r;
          if (hitByCircle || hitByLance) {
            const cryoStormBlocked = this._tryCryoStormHit(b, e);
            let dmg = b.dmg;
            if (b.meta?.type === 'pulse') dmg = getPulseHitDamage(b, dmg);
            if (!cryoStormBlocked) this.hitEnemy(e, dmg, b.col, false);
            if (b.meta?.type === 'cryo') handleCryoImpact(this, b, e, e.x, e.y, false);
            if (b.meta?.type === 'pulse') {
              this.handlePulseImpact(b, e.x, e.y);
            }
            if (!b.meta?.multiHit) b.hitIds?.add(e.id);
            if (!b.meta?.multiHit) b.pl = (b.pl || 0) - 1;
            if (b.pl < 0) { alive = false; break; }
          }
        }
      }

      pruneEnemies();
      if (!alive) bullets.splice(i, 1);
    }
  }

  _updateEnemies(dt) {
    const { P } = this;
    enemies.forEach(e => {
      updateEnemyFreezeState(e, dt, P);
      tickEnemyStatus(e, dt);
      if (!e.stunned || (e.stunT || 0) <= 0) {
        e.isSecondaryCascade = false;
        e._cascaded = false;
      }
      if ((e._knockT || 0) > 0) {
        e._knockT = Math.max(0, e._knockT - dt);
        const knockDecay = e._knockT / 0.35;
        e.x += (e._knockVx || 0) * knockDecay * dt;
        e.y += (e._knockVy || 0) * knockDecay * dt;
        e.x = cl(e.x, e.r, WORLD_W - e.r);
        e.y = cl(e.y, e.r, WORLD_H - e.r);
      }
      this.slowFields.forEach(field => {
        if (Math.hypot(e.x - field.x, e.y - field.y) < field.r) {
          e.slowT = 0.3;
          e.spdMult = 0.4;
        }
      });
      if (e._pullTimer > 0 && e._pullTarget) {
        const dxPull = e._pullTarget.x - e.x;
        const dyPull = e._pullTarget.y - e.y;
        const distPull = Math.hypot(dxPull, dyPull) || 1;
        const travel = Math.min(distPull, (e._pullSpeed || 400) * dt);
        e.x += dxPull / distPull * travel;
        e.y += dyPull / distPull * travel;
        e._pullTimer = Math.max(0, e._pullTimer - dt);
      }
      if (e.type === 'shooter' && !e.stunned && !e.frozen) {
        e.shootT = (e.shootT || 0) - dt;
        const d = Math.sqrt(dist2(P, e));
        if (d > 110 && d < 400) {
          if (e.shootT <= 0) { e.shootT = 2.2; this.fireShot(e); }
          return;
        }
      }
      if (e.stunned || e.frozen) return;
      const m = e.slowT > 0 ? (e.spdMult || 0.45) : 1;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += dx / d * e.spd * m * dt;
      e.y += dy / d * e.spd * m * dt;
      if (d < e.r + P.r && P.invT <= 0) {
        this.hitPlayer(e.dmg, 0.28, 26);
      }
    });
  }

  _updateGems(dt) {
    let collectedXp = 0;
    this.gems = this._updatePickupArray(this.gems, dt, g => {
      collectedXp += g.val;
    });
    if (collectedXp > 0) {
      const now = performance.now();
      this.addXp(collectedXp);
      if (now - this._lastXpSound > 80) { playXp(); this._lastXpSound = now; }
    }
  }

  _updateHealOrbs(dt) {
    this.healOrbs = this._updatePickupArray(this.healOrbs, dt, () => {
      const heal = Math.round(this.P.maxHp * 0.05);
      this.P.hp = Math.min(this.P.maxHp, this.P.hp + heal);
      this.P.hpLag = Math.max(this.P.hpLag, this.P.hp);
      addBurst(this.P.x, this.P.y, '#4DFFB4', 5, 55, 2.4, 0.2);
      addRing(this.P.x, this.P.y, this.P.r + 10, '#4DFFB4', 1.8, 0.18);
    });
  }

  _updatePickupArray(items, dt, onCollect) {
    const P = this.P;
    return items.filter(item => {
      const dx = P.x - item.x;
      const dy = P.y - item.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < P.mag) {
        item.x += (P.x - item.x) * 5 * dt;
        item.y += (P.y - item.y) * 5 * dt;
      }
      if (d < P.r + item.r) {
        onCollect(item);
        return false;
      }
      return true;
    });
  }

  _doBossHit(dmg, col, isSynergy = false) {
    if (this.P.char === 'bruiser' && this.P.hp < this.P.maxHp * 0.5) dmg *= 1.35;
    const now = performance.now();
    const prevHp = this.boss.hp;
    hitBoss(this.boss, dmg, col, isSynergy);
    if (this.boss.hp === prevHp) return { killed: false, target: this.boss, damage: 0 };
    const numCol = isSynergy ? '#FFB627' : col;
    this.addDN(this.boss.x, this.boss.y - this.boss.r, Math.round(dmg), numCol, 0.7, isSynergy);
    if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
    return { killed: false, target: this.boss, damage: dmg };
  }

  hitEnemy(e, dmg, col, isSynergy = false, minHpFloor = null) {
    if (this.P.char === 'bruiser' && this.P.hp < this.P.maxHp * 0.5) dmg *= 1.35;
    if (this._maybeApplyShatter(e)) dmg = 0;
    if (minHpFloor != null) {
      const floor = Math.max(1, minHpFloor);
      if (e.hp - dmg < floor) dmg = Math.max(0, e.hp - floor);
    }
    e.hp -= dmg; e.hitFlash = 0.1;
    const numCol = isSynergy ? '#FFB627' : col === '#00CFFF' ? '#00CFFF' : col === '#BF77FF' ? '#BF77FF' : '#fff';
    if (dmg > 0) this.addDN(e.x, e.y - e.r, Math.round(dmg), numCol, 0.7, isSynergy);
    addBurst(e.x, e.y, col, isSynergy ? 6 : 3, isSynergy ? 90 : 60, 2.5, 0.32);
    const now = performance.now();
    if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
    if (e.hp <= 0) {
      this.killCount++;
      const xpVal = (this.P.char === 'hacker' && e.stunned) ? e.xp * 2 : e.xp;
      if (e.frozen) this._triggerCryoNova(e);
      this._dropEnemyPickups(e, xpVal);
      this.spawnDeath(e.x, e.y, e.col, e.frozen, e.shattered);
      playEnemyDeath(e.frozen);
      return { killed: true, target: e, damage: dmg };
    }
    return { killed: false, target: e, damage: dmg };
  }

  spawnDeath(x, y, col, frozen, shattered = false) {
    if (shattered) {
      addRing(x, y, 52, '#FFFFFF', 2, 0.16);
      return;
    }
    const c = frozen ? '#00CFFF' : col;
    addBurst(x, y, c, 10, 90, frozen ? 4 : 3, 0.5);
    if (frozen) addRing(x, y, 44, '#00CFFF', 1.5, 0.25);
  }

  spawnRing(x, y, r, col, dmg) {
    addRing(x, y, r, col, 2, 0.35);
    // hit boss
    if (this.boss?.alive && dist2({ x, y }, this.boss) < r * r) this._doBossHit(dmg, col);
    // hit enemies
    enemies.forEach(e => { if (dist2({ x, y }, e) < r * r) this.hitEnemy(e, dmg, col); });
    pruneEnemies();
  }

  fireShot(e) {
    const a = Math.atan2(this.P.y - e.y, this.P.x - e.x);
    bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 5, dmg: 10, col: '#FFB627', life: 4, pl: 0, enemy: true, meta: {} });
  }

  addXp(v) {
    this.P.xp += v;
    while (this.P.xp >= this.P.xpNext) {
      this.P.xp -= this.P.xpNext;
      this.P.level++;
      this.P.xpNext = Math.floor(this.P.xpNext * 1.22);
      this.levelUp();
    }
  }

  addDN(x, y, v, col, life = 0.65, big = false) {
    const perfMode = this.surgeActive && enemies.length > 70;
    if (perfMode && !big) {
      this._dmgTextSkip = (this._dmgTextSkip + 1) % 5;
      if (this._dmgTextSkip !== 0) return;
      life = Math.min(life, 0.38);
    }
    if (this.dmgNums.length > (perfMode ? 28 : 90)) return;
    this.dmgNums.push({ x, y, val: v, life, col: col || '#fff', big });
  }

  spawnGem(x, y, val) {
    if (val <= 0) return;
    if (this.surgeActive && this.gems.length > 80) {
      this.addXp(val);
      return;
    }
    let best = null;
    let bestD2 = 26 * 26;
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      const dx = g.x - x;
      const dy = g.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        best = g;
        bestD2 = d2;
      }
    }
    if (best) {
      best.val += val;
      best.r = Math.min(8, 5 + Math.floor(best.val / 20));
      best.x = (best.x + x) * 0.5;
      best.y = (best.y + y) * 0.5;
      return;
    }
    if (this.gems.length >= 140) {
      this.addXp(val);
      return;
    }
    this.gems.push({ x, y, r: 5, val });
  }

  spawnHealOrb(x, y) {
    this.healOrbs.push({ x, y, r: 7 });
  }

  _getHealOrbDropChance(baseChance) {
    const timeScale = Math.max(0.25, 1 - this.gt / 240);
    return baseChance * timeScale;
  }

  _getHealOrbDropCooldown() {
    return Math.min(18, 6 + this.gt * 0.04);
  }

  _trySpawnHealOrbFromEnemy(x, y, baseChance) {
    if (this.healOrbDropCooldown > 0) return false;
    if (this.healOrbs.length >= 2) return false;
    const chance = this._getHealOrbDropChance(baseChance);
    if (Math.random() >= chance) return false;
    this.spawnHealOrb(x, y);
    this.healOrbDropCooldown = this._getHealOrbDropCooldown();
    return true;
  }

  _dropEnemyPickups(enemy, xpVal) {
    if (enemy.type === 'brute') {
      this.spawnGem(enemy.x, enemy.y, xpVal);
      this._trySpawnHealOrbFromEnemy(enemy.x, enemy.y, 0.04);
      return;
    }
    if (enemy.type === 'runner' || enemy.type === 'shooter') {
      if (this._trySpawnHealOrbFromEnemy(enemy.x, enemy.y, 0.01)) return;
      else this.spawnGem(enemy.x, enemy.y, xpVal);
      return;
    }
    this.spawnGem(enemy.x, enemy.y, xpVal);
  }

  levelUp() {
    this.paused = true;
    playLevelUp();
    const pool = buildPool(this.P);
    const cards = pool.map(u => renderUpgradeCard(u, this.P, `window.__game.pickUpgrade('${u.id}')`)).join('');
    showOverlay(`
      <div style="color:#444;font-size:9px;letter-spacing:3px;margin-bottom:6px">// SYSTEM UPGRADE //</div>
      <div style="font-size:15px;color:#BF77FF;letter-spacing:2px;margin-bottom:4px">LEVEL ${this.P.level} — CHOOSE ONE</div>
      <div style="font-size:9px;color:#444;letter-spacing:2px;margin-bottom:18px">weapon + passive choices every level</div>
      <div class="upg-grid">${cards}</div>`);
  }

  pickUpgrade(id) {
    applyUpgrade(id, this.P);
    hideOverlay();
    this.paused = false;
    if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }
  }

  endGame() {
    this.running = false;
    this.setPlaytestToggleVisible(false);
    stopBossMusic();
    playDeath();
    const recordSummary = recordRun(this.P.char, {
      time: this.gt,
      kills: this.killCount,
      level: this.P.level,
    });
    const bestFields = new Set([
      ...recordSummary.newGlobalBests,
      ...recordSummary.newCharBests,
    ]);
    const char = CHARACTERS[this.P.char] || this.getSelectedCharacter();
    const weaponsHtml = getOwnedWeaponIds(this.P)
      .map(id => {
        const weapon = WDEFS[id];
        return `<div class="death-list-line"><span style="color:${weapon.col}">${weapon.icon} ${weapon.name}</span><strong>T${getWeaponLevel(this.P, id)}</strong></div>`;
      })
      .join('');
    const synergiesHtml = this.runDiscoveries.size
      ? [...this.runDiscoveries].map(id => {
          const synergy = SYNERGIES.find(entry => entry.id === id);
          if (!synergy) return '';
          const prefix = this.runNewDiscoveries.has(id)
            ? '<span class="death-new">★ NEW</span>'
            : '<span class="death-known">✓</span>';
          return `<div class="death-list-line">${prefix}<span>${synergy.label}</span></div>`;
        }).join('')
      : '<div class="death-empty">- none -</div>';
    showOverlay(`
      <div class="death-shell">
        <div class="ov-title" style="color:#E24B4A;font-size:22px">FLATLINED</div>
        <div class="death-char" style="color:${char.col}">${char.name}</div>
        <div class="death-section">
          <div class="panel-label">RUN STATS</div>
          <div class="death-stats">
            <div class="death-list-line"><span>TIME SURVIVED</span><strong>${formatRunTime(this.gt)}${renderBestMark(bestFields, 'bestTime')}</strong></div>
            <div class="death-list-line"><span>KILLS</span><strong>${this.killCount}${renderBestMark(bestFields, 'mostKills')}</strong></div>
            <div class="death-list-line"><span>LEVEL REACHED</span><strong>${this.P.level}${renderBestMark(bestFields, 'highestLevel')}</strong></div>
          </div>
        </div>
        <div class="death-section">
          <div class="panel-label">WEAPONS EQUIPPED</div>
          <div class="death-stats">${weaponsHtml}</div>
        </div>
        <div class="death-section">
          <div class="panel-label">SYNERGIES THIS RUN</div>
          <div class="death-stats">${synergiesHtml}</div>
        </div>
        <div class="menu-actions">
          <button class="btn" onclick="${this.playtestMode ? 'window.__game.restartPlaytestRun()' : 'window.__game.newRun(window.__game.getSelectedCharacter())'}">${this.playtestMode ? 'RESTART TEST' : 'RUN AGAIN'}</button>
          <button class="btn btn-secondary" onclick="window.__game.showMainMenu()">MENU</button>
        </div>
      </div>
      `, 'death-screen');
  }

  showMainMenu() {
    this.running = false;
    this.paused = false;
    this.setPlaytestToggleVisible(false);
    stopBossMusic();
    const char = this.getSelectedCharacter();
    const cards = Object.values(CHARACTERS).map(c => {
      const active = c.id === char.id ? ' active' : '';
      const weapon = WDEFS[c.startWeapon];
      const passiveCopy = c.id === 'ghost'
        ? '20% dodge chance. Freeze setups and kite hard.'
        : c.id === 'bruiser'
          ? '+35% damage under 50% HP. Heavy close-range pressure.'
          : 'Stunned enemies drop extra XP. Fast snowball control.';
      const passiveLabel = c.id === 'ghost'
        ? 'GHOST STEP'
        : c.id === 'bruiser'
          ? 'LOW HP RAMP'
          : 'DATA LEECH';
      const passiveValue = c.id === 'ghost'
        ? '20% dodge chance'
        : c.id === 'bruiser'
          ? '+35% damage below 50% HP'
          : '2x XP from stunned kills';
      return `<button class="char-card${active}" onclick="window.__game.selectCharacter('${c.id}')">
        <div class="char-card-top">
          <span class="char-sigil" style="color:${c.col}">◆</span>
          <span class="char-name">${c.name}</span>
          <span class="char-tag">${c.id === char.id ? 'SELECTED' : 'READY'}</span>
        </div>
        <div class="char-compact-row">
          <span class="char-weapon" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</span>
          <span class="char-speed">SPD ${c.spd}</span>
        </div>
        ${c.id === char.id ? `
          <div class="char-inline-meta">
            <div class="char-inline-line"><span>PASSIVE</span><strong>${passiveLabel}</strong></div>
            <div class="char-inline-line"><span>EFFECT</span><strong>${passiveValue}</strong></div>
            <div class="char-inline-copy">${passiveCopy}</div>
          </div>
        ` : ''}
      </button>`;
    }).join('');
    showOverlay(`
      <div class="menu-shell">
        <div class="menu-brand compact">
          <div class="menu-kicker">NEURAL SURVIVAL ROGUELITE</div>
          <div class="menu-title">INFINITE ROGUE</div>
          <div class="menu-sub">// choose an operator and jack in //</div>
        </div>
        <section class="menu-panel menu-panel-operators">
          <div class="menu-panel-head">
            <div class="panel-label">OPERATORS</div>
            <button class="menu-link-btn" onclick="window.__game.openRecords()">RECORDS</button>
          </div>
          <div class="char-grid compact">${cards}</div>
        </section>
        <div class="menu-footer">
          <button class="btn menu-start-btn" onclick="window.__game.newRun(window.__game.getSelectedCharacter())">JACK IN</button>
          <button class="menu-link-btn" onclick="window.__game.openPlaytestLab()">PLAYTEST LAB</button>
        </div>
      </div>`, 'main-menu');
  }

  showStart() {
    this.showMainMenu();
  }

  openRecords() {
    showRecordsScreen(() => this.showMainMenu());
  }

  getSelectedCharacter() {
    return CHARACTERS[this.selectedCharId] || CHARACTERS.ghost;
  }

  selectCharacter(id) {
    if (!CHARACTERS[id]) return;
    this.selectedCharId = id;
    this.playtestBuild = sanitizePlaytestBuild(this.playtestBuild, CHARACTERS[id]);
    this.showStart();
  }

  setPlaytestToggleVisible(visible) {
    const btn = document.getElementById('playtest-toggle');
    if (!btn) return;
    btn.style.display = visible ? 'block' : 'none';
  }

  restartPlaytestRun() {
    this.newRun(this.getSelectedCharacter(), {
      playtest: true,
      build: this.playtestBuild,
    });
    this.openPlaytestLab();
  }

  startPlaytestRun() {
    this.newRun(this.getSelectedCharacter(), {
      playtest: true,
      build: this.playtestBuild,
    });
    this.openPlaytestLab();
  }

  openPlaytestLab() {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuild(this.playtestBuild, char);
    if (this.running) this.paused = true;
    showOverlay(renderPlaytestLab(this.playtestBuild, char, this.running, this.getPlaytestWorldDebug()), 'playtest-screen');
  }

  getPlaytestWorldDebug() {
    const player = this.running && this.P ? this.P : previewPlaytestPlayer(this.getSelectedCharacter(), this.playtestBuild);
    const camX = cl((player.x || WORLD_W / 2) - this.W / 2, 0, Math.max(0, WORLD_W - this.W));
    const camY = cl((player.y || WORLD_H / 2) - this.H / 2, 0, Math.max(0, WORLD_H - this.H));
    return {
      x: Math.round(player.x || WORLD_W / 2),
      y: Math.round(player.y || WORLD_H / 2),
      camX: Math.round(camX),
      camY: Math.round(camY),
      worldW: WORLD_W,
      worldH: WORLD_H,
      edgeDist: Math.round(Math.min(
        player.x || WORLD_W / 2,
        WORLD_W - (player.x || WORLD_W / 2),
        player.y || WORLD_H / 2,
        WORLD_H - (player.y || WORLD_H / 2)
      )),
    };
  }

  closePlaytestLab() {
    hideOverlay();
    if (this.running) this.paused = false;
    else this.showMainMenu();
  }

  resetPlaytestBuild() {
    this.playtestBuild = createPlaytestBuild(this.getSelectedCharacter());
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  refillPlaytestVitals() {
    if (!this.P) return;
    this.P.hp = this.P.maxHp;
    this.P.hpLag = this.P.maxHp;
    this.P.invT = 0;
    this.P.hurtFlash = 0;
    this.openPlaytestLab();
  }

  playtestAdjustWeapon(wid, delta) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuild(this.playtestBuild, char);
    const min = wid === char.startWeapon ? 1 : 0;
    const current = this.playtestBuild.weapons[wid] || 0;
    this.playtestBuild.weapons[wid] = cl(Math.round(current + delta), min, 5);
    if (this.playtestBuild.weapons[wid] < 5) this.playtestBuild.ascensions[wid] = null;
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  playtestAdjustPassive(pid, delta) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuild(this.playtestBuild, char);
    const current = this.playtestBuild.passives[pid] || 0;
    this.playtestBuild.passives[pid] = cl(Math.round(current + delta), 0, 8);
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  playtestSetAscension(wid, ascensionId) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuild(this.playtestBuild, char);
    if ((this.playtestBuild.weapons[wid] || 0) < 5) return;
    this.playtestBuild.ascensions[wid] = ascensionId;
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  _applyPlaytestBuildToPlayer() {
    if (!this.playtestMode || !this.playtestBuild || !this.P) return;
    const char = CHARACTERS[this.P.char] || this.getSelectedCharacter();
    const prev = this.P;
    const next = mkPlayer(this.W, this.H, char);
    next.x = prev.x;
    next.y = prev.y;
    next.vx = 0;
    next.vy = 0;

    Object.entries(this.playtestBuild.weapons || {}).forEach(([wid, lvl]) => {
      if (lvl > 0) addWeapon(next, wid, lvl);
    });

    PASSIVES.forEach(passive => {
      const count = this.playtestBuild.passives?.[passive.id] || 0;
      for (let i = 0; i < count; i++) applyUpgrade(`p_${passive.id}`, next);
    });

    Object.entries(this.playtestBuild.ascensions || {}).forEach(([wid, ascensionId]) => {
      if (!ascensionId) return;
      if ((this.playtestBuild.weapons?.[wid] || 0) < 5) return;
      applyAscension(next, wid, ascensionId);
    });

    next.hp = next.maxHp;
    next.hpLag = next.maxHp;
    next._arcDiscs = [];
    next._sawBlade = null;
    this.P = next;
    this.cryoFields = [];
    this.barrierHealFx = [];
    resetBullets();
    resetPulseClusters();
    clearExtraTarget();
    if (this.boss?.alive) setExtraTarget(this.boss);
    this.updateCamera();
  }

  drawBackground() {
    const { ctx, gt } = this;
    const margin = 100;
    const visL = this.camX - margin;
    const visR = this.camX + this.W + margin;
    const visT = this.camY - margin;
    const visB = this.camY + this.H + margin;

    ctx.strokeStyle = 'rgba(0, 207, 255, 0.06)';
    ctx.lineWidth = 1;
    this.bgConnections.forEach(conn => {
      const a = this.bgNodes[conn.a];
      const b = this.bgNodes[conn.b];
      if (a.x < visL && b.x < visL) return;
      if (a.x > visR && b.x > visR) return;
      if (a.y < visT && b.y < visT) return;
      if (a.y > visB && b.y > visB) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    this.bgNodes.forEach(node => {
      if (node.x < visL || node.x > visR || node.y < visT || node.y > visB) return;
      const pulse = node.pulses ? 0.8 + 0.2 * Math.sin(gt * 1.5 + node.pulseOffset) : 1;
      ctx.fillStyle = 'rgba(0, 207, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    this.bgPackets.forEach(packet => {
      const conn = this.bgConnections[packet.connIdx];
      if (!conn) return;
      const a = this.bgNodes[conn.a];
      const b = this.bgNodes[conn.b];
      const x = a.x + (b.x - a.x) * packet.t;
      const y = a.y + (b.y - a.y) * packet.t;
      if (x < visL || x > visR || y < visT || y > visB) return;
      ctx.fillStyle = 'rgba(0, 207, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawCryoFields() {
    const { ctx, P } = this;
    this.cryoFields.forEach(field => {
      const lifeRatio = field.life / field.maxLife;
      const pulse = 0.15 + 0.16 * Math.sin((this.gt * 5.5) + field.pulse + field.life * 4);
      ctx.save();
      ctx.globalAlpha = Math.max(0.32, lifeRatio * 0.7);
      ctx.fillStyle = `rgba(0, 207, 255, ${0.16 + pulse * 0.28})`;
      ctx.strokeStyle = `rgba(180, 245, 255, ${0.52 + pulse * 0.28})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(field.x, field.y, field.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = `rgba(220, 255, 255, ${0.42 + pulse * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(field.x, field.y, field.r * (0.58 + 0.06 * Math.sin(this.gt * 4 + field.pulse)), 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = field.pulse + this.gt * 1.6 + (i / 6) * Math.PI * 2;
        const px = field.x + Math.cos(a) * field.r * 0.82;
        const py = field.y + Math.sin(a) * field.r * 0.82;
        ctx.fillStyle = `rgba(210, 255, 255, ${0.5 + pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (!hasAscension(P, 'cryo', 'frost_field')) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 207, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this.gt * 18;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawTripleWaves() {
    const { ctx } = this;
    this.tripleWaves.forEach(wave => {
      ctx.save();
      const a1 = Math.max(0, 1 - wave.r1 / wave.maxR1) * wave.life;
      ctx.globalAlpha = a1 * 0.9;
      ctx.strokeStyle = '#BF77FF';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#BF77FF';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r1, 0, Math.PI * 2);
      ctx.stroke();

      if (wave.r2 > 0) {
        const a2 = Math.max(0, 1 - wave.r2 / wave.maxR2) * wave.life;
        ctx.globalAlpha = a2 * 0.65;
        ctx.strokeStyle = '#9955DD';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#9955DD';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.r2, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (wave.r3 > 0) {
        const a3 = Math.max(0, 1 - wave.r3 / wave.maxR3) * wave.life;
        ctx.globalAlpha = a3 * 0.4;
        ctx.strokeStyle = '#7733BB';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#7733BB';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.r3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }

  drawShatterBursts() {
    const { ctx } = this;
    this.shatterBursts.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      const len = p.len * alpha;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.a) * len, p.y + Math.sin(p.a) * len);
      ctx.stroke();
    });
  }

  drawGems() {
    const { ctx } = this;
    this.gems.forEach(g => {
      ctx.fillStyle = '#7F77DD';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(191,119,255,0.8)';
      ctx.beginPath();
      ctx.arc(g.x - 1, g.y - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawMines() {
    if (!this.P?._pulseMines) return;
    const { ctx } = this;
    this.P._pulseMines.forEach(mine => {
      ctx.strokeStyle = mine.armed ? '#FFB627' : '#FFB62766';
      ctx.lineWidth = mine.armed ? 2 : 1;
      ctx.fillStyle = mine.armed ? '#FFB62722' : '#FFB62711';
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, mine.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (mine.armed) {
        const pulse = 0.5 + 0.5 * Math.sin(this.gt * 4);
        ctx.strokeStyle = `rgba(255, 182, 39, ${pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mine.x, mine.y, mine.r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  drawHealOrbs() {
    const { ctx } = this;
    this.healOrbs.forEach(orb => {
      const innerScale = Math.sin(this.gt * 6) * 0.3 + 0.7;
      ctx.fillStyle = '#4DFFB4';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r * 0.45 * innerScale, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSlowFields() {
    const { ctx } = this;
    this.slowFields.forEach(f => {
      const alpha = (f.life / f.maxLife) * 0.2;
      ctx.fillStyle = `rgba(255, 182, 39, ${alpha})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 182, 39, ${alpha * 2})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  drawArcBlade() {
    const { ctx } = this;
    const P = this.P;
    if (!P.w?.arcblade && !getWeaponLevel(P, 'arcblade')) return;
    if (P.ascensions.arcblade === 'saw_blade') return;

    const drawBoomerang = (x, y, rotation, alpha = 1, scale = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#FF2D9B';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -12);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -12);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.restore();
    };

    P._arcDiscs.forEach(disc => {
      if (disc.x === undefined) return;
      disc.trail?.forEach((pos, i) => {
        ctx.globalAlpha = (i / disc.trail.length) * 0.4;
        ctx.fillStyle = '#FF2D9B';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, Math.max(2, 6 - i * 0.6), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      drawBoomerang(disc.x, disc.y, disc.rotation);
    });

  }

  drawSawBlade() {
    const { ctx } = this;
    const saw = this.P._sawBlade;
    if (!saw) return;
    ctx.save();
    ctx.translate(saw.x, saw.y);
    ctx.rotate(saw.rotation);

    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * Math.PI * 2);
      ctx.translate(16, 0);
      ctx.strokeStyle = '#FF2D9B';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -8);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, -8);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowColor = '#FF2D9B';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FF2D9B44';
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FF2D9B66';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawEnemies(perfMode) {
    const { ctx } = this;
    enemies.forEach(e => {
      const col = e.hitFlash > 0 ? '#fff' : e.frozen ? '#00CFFF' : e.stunned ? '#BF77FF' : e.slowT > 0 ? '#7ecfef' : e.col;
      ctx.fillStyle = col + 'bb';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      traceEnemyShape(ctx, e);
      ctx.fill();
      ctx.stroke();

      if (!perfMode && !e.frozen && e.frostLevel > 0) {
        const overlayAlpha = e.frostLevel === 3 ? 0.55 : e.frostLevel === 2 ? 0.35 : 0.15;
        ctx.fillStyle = `rgba(0, 207, 255, ${overlayAlpha})`;
        traceEnemyShape(ctx, e);
        ctx.fill();

        if (e.frostLevel >= 2) {
          ctx.save();
          ctx.globalAlpha = e.frostLevel === 3 ? 0.8 : 0.5;
          ctx.strokeStyle = '#00CFFF';
          ctx.lineWidth = e.frostLevel === 3 ? 2 : 1;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + (e.frostLevel === 3 ? 3 : 2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        if (e.frostLevel === 3) {
          if ((e._frostParticleT || 0) <= this.gt) {
            e._frostParticleT = this.gt + 0.3;
            const a = Math.random() * Math.PI * 2;
            addDot(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, '#00CFFF', 2.2, 0.45);
          }
        } else {
          e._frostParticleT = 0;
        }
      } else {
        e._frostParticleT = 0;
      }

      if (!perfMode && e.frozen) {
        ctx.fillStyle = e.permafrost ? 'rgba(170, 240, 255, 0.78)' : 'rgba(0, 207, 255, 0.65)';
        traceEnemyShape(ctx, e);
        ctx.fill();
        ctx.strokeStyle = e.permafrost ? 'rgba(235, 253, 255, 0.95)' : 'rgba(0,207,255,0.85)';
        ctx.lineWidth = e.permafrost ? 3.5 : 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.save();
        ctx.strokeStyle = e.permafrost ? 'rgba(255,255,255,0.98)' : 'rgba(215, 248, 255, 0.95)';
        ctx.lineWidth = e.permafrost ? 1.9 : 1.6;
        for (let i = 0; i < 4; i++) {
          const a = this.gt * 1.8 + e.id * 0.23 + (i / 4) * Math.PI * 2;
          const innerR = e.r + 2;
          const outerR = e.r + 8 + (i % 2) * 2;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * innerR, e.y + Math.sin(a) * innerR);
          ctx.lineTo(e.x + Math.cos(a) * outerR, e.y + Math.sin(a) * outerR);
          ctx.stroke();
        }
        if (e.permafrost) {
          ctx.strokeStyle = 'rgba(195, 245, 255, 0.95)';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const crystalR = e.r + 11 + ((i % 2) * 3);
            const px = e.x + Math.cos(a) * crystalR;
            const py = e.y + Math.sin(a) * crystalR;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - Math.cos(a) * 8 + Math.cos(a + Math.PI / 2) * 4, py - Math.sin(a) * 8 + Math.sin(a + Math.PI / 2) * 4);
            ctx.lineTo(px - Math.cos(a) * 8 - Math.cos(a + Math.PI / 2) * 4, py - Math.sin(a) * 8 - Math.sin(a + Math.PI / 2) * 4);
            ctx.closePath();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      if (!perfMode && e.stunned) {
        ctx.strokeStyle = 'rgba(191,119,255,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!perfMode || e.type === 'brute') {
        const bw = e.r * 2 + 2;
        ctx.fillStyle = '#111';
        ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw, 3);
        ctx.fillStyle = col;
        ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw * Math.max(0, e.hp / e.maxHp), 3);
      }
    });
  }

  drawBullets(ultraMode) {
    const { ctx } = this;
    bullets.filter(b => b.enemy).forEach(b => {
      ctx.fillStyle = '#FFB62766';
      ctx.strokeStyle = '#FFB627';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    bullets.filter(b => !b.enemy).forEach(b => {
      if (b.meta?.isLance) {
        const angle = b.meta.angle || Math.atan2(b.vy, b.vx);
        const length = b.meta.lanceLength || 220;
        const tailX = b.x - Math.cos(angle) * length;
        const tailY = b.y - Math.sin(angle) * length;
        ctx.save();
        ctx.shadowColor = '#00CFFF';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(0, 207, 255, 0.92)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(185, 247, 255, 0.95)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235, 253, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -this.gt * 30;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        return;
      }

      if (b.meta?.isCryoShard) {
        const angle = b.meta.angle || Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.shadowColor = '#BDF7FF';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#BDF7FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(angle) * 6, b.y - Math.sin(angle) * 6);
        ctx.lineTo(b.x + Math.cos(angle) * 4, b.y + Math.sin(angle) * 4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(angle + Math.PI / 2) * 3, b.y - Math.sin(angle + Math.PI / 2) * 3);
        ctx.lineTo(b.x + Math.cos(angle + Math.PI / 2) * 3, b.y + Math.sin(angle + Math.PI / 2) * 3);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const tier = b.meta?.tier || 1;
      const glow = b.meta?.glowCol || (b.meta?.type === 'cryo' ? '#9af3ff' : b.meta?.type === 'pulse' ? '#ffd16f' : b.col);
      const drawR = b.meta?.isOverload ? 20 : b.meta?.type === 'cryo' ? b.r : b.r + (tier >= 2 ? 1 : 0) + (b.meta?.type === 'pulse' && tier >= 2 ? 1 : 0);
      ctx.shadowColor = glow;
      ctx.shadowBlur = ultraMode ? 0 : (b.meta?.isOverload ? 30 : 10 + tier * 2);
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.arc(b.x, b.y, drawR, 0, Math.PI * 2);
      ctx.fill();
      if (!ultraMode && tier >= 2) {
        ctx.strokeStyle = tier >= 3 ? '#ffffff' : glow;
        ctx.lineWidth = tier >= 3 ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, drawR + 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!ultraMode && b.meta?.type === 'pulse' && tier >= 2) {
        ctx.strokeStyle = b.meta?.isOverload ? 'rgba(255,230,166,0.9)' : `rgba(255,182,39,${0.35 + (b.pierceDmgMult || 1) * 0.25})`;
        ctx.lineWidth = b.meta?.isOverload ? 4 : tier >= 3 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      if (!ultraMode && b.meta?.isOverload) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#FFB627';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.shadowBlur = 0;
    });
  }

  drawPlayer() {
    const { ctx, P } = this;
    const drawDrone = (drone, options = {}) => {
      let x = options.overridePos?.x ?? drone.sx ?? drone.x;
      let y = options.overridePos?.y ?? drone.sy ?? drone.y;
      if (x == null || y == null) return;
      if ((drone.pulseOffset || 0) > 0 && !options.ignorePulseOffset) {
        const dx = P.x - x;
        const dy = P.y - y;
        const dist = Math.hypot(dx, dy) || 1;
        x += (dx / dist) * drone.pulseOffset;
        y += (dy / dist) * drone.pulseOffset;
      }
      const r = options.radius ?? 7;
      const fill = options.fill ?? '#1DFFD0';
      const stroke = options.stroke ?? '#a2ffeb';
      const alpha = options.alpha ?? 1;
      ctx.shadowColor = options.shadowColor ?? stroke;
      ctx.shadowBlur = options.shadowBlur ?? 14;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = options.lineWidth ?? 1.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (options.outerRing) {
        ctx.strokeStyle = 'rgba(255,182,39,0.45)';
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    (P._dr || []).forEach(drone => {
      const isFrenzied = !!drone.frenzy;
      drawDrone(drone, {
        radius: 5,
        fill: isFrenzied ? '#FFB627' : '#1DFFD0',
        stroke: isFrenzied ? '#FFB627' : '#a2ffeb',
        shadowBlur: isFrenzied ? 8 : 14,
      });
    });
    (P._novaDrones || []).forEach((drone, index) => {
      const x = drone.sx ?? drone.x;
      const y = drone.sy ?? drone.y;
      if (x == null || y == null) return;
      const lifeRatio = Math.max(0, Math.min(1, (drone.life || 0) / 8));
      const pulse = 1 + Math.sin(this.gt * 4 + index * 1.2) * 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#1DFFD0';
      ctx.shadowBlur = 16;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 18 * lifeRatio, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '8px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('N', x, y - 16);
      ctx.shadowBlur = 0;
    });
    (P._miniDr || []).forEach(drone => {
      drawDrone(drone, {
        radius: 4,
        fill: '#d7fff3',
        stroke: '#FFB627',
        shadowBlur: 10,
        lineWidth: 1.4,
        outerRing: true,
      });
    });

    const fl = P.invT > 0 && Math.floor(P.invT * 12) % 2 === 0;
    ctx.shadowColor = fl ? '#fff' : P.col;
    ctx.shadowBlur = 14;
    ctx.fillStyle = fl ? '#fff' : P.col;
    ctx.beginPath();
    ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,200,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!getWeaponLevel(P, 'barrier')) return;
    const baseRadius = P.r + 9;
    if (P._shieldFlashT > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, P._shieldFlashT / 0.15)})`;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(P.x, P.y, baseRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(198,255,0,${Math.min(1, P._shieldFlashT / 0.22)})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(P.x, P.y, baseRadius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    if (P._shieldActive) {
      const pulse = Math.sin(this.gt * 3) * 2.6;
      const capRatio = Math.max(0.12, (P._shieldCap || 0) / Math.max(1, P._shieldMaxCap || 1));
      const hitBoost = (P._shieldHitT || 0) > 0 ? Math.min(0.7, P._shieldHitT * 3.2) : 0;
      ctx.fillStyle = `rgba(198,255,0,${0.06 + capRatio * 0.08 + hitBoost * 0.12})`;
      ctx.beginPath();
      ctx.arc(P.x, P.y, baseRadius + 5 + pulse * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(198,255,0,${Math.min(1, 0.42 + capRatio * 0.48 + hitBoost)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(P.x, P.y, baseRadius + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + capRatio * 0.22 + hitBoost * 0.55})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(P.x, P.y, baseRadius - 3 + pulse * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = this.gt * 2.8 + (i / 5) * Math.PI * 2;
        const orbitR = baseRadius + 5 + pulse * 0.35;
        const px = P.x + Math.cos(a) * orbitR;
        const py = P.y + Math.sin(a) * orbitR;
        ctx.fillStyle = `rgba(198,255,0,${0.45 + hitBoost * 0.35})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + hitBoost, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = 'rgba(198,255,0,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(P.x, P.y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(P.x, P.y, baseRadius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawDamageNumbers() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    this.dmgNums.forEach(d => {
      ctx.globalAlpha = Math.min(1, d.life / 0.35);
      ctx.fillStyle = d.col;
      const isStr = typeof d.val === 'string';
      ctx.font = `bold ${d.big ? (isStr ? 14 : 15) : (isStr ? 11 : 12)}px Courier New`;
      if (d.big) {
        ctx.shadowColor = d.col;
        ctx.shadowBlur = 8;
      }
      ctx.fillText(d.val, d.x, d.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  drawScreenEffects() {
    const { ctx, W, H, P } = this;
    if (this.surgeActive) {
      const pulse = 0.13 + 0.07 * Math.sin(this.gt * 9);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(200,20,20,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.bossIntro) {
      const pulse = 0.22 + 0.14 * Math.sin(this.gt * 11);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(220,10,10,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    const hpRatio = P.hp / P.maxHp;
    if (hpRatio <= 0.3) {
      const pulse = 0.14 + (0.3 - hpRatio) * 0.6 + 0.09 * Math.sin(this.gt * 10);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.88);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(226,75,74,${Math.max(0.16, pulse)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.bossIntro) {
      const flash = Math.sin(this.gt * 7) > 0;
      if (flash) {
        ctx.globalAlpha = 0.92;
        ctx.textAlign = 'center';
        ctx.font = 'bold 52px Courier New';
        ctx.fillStyle = '#E24B4A';
        ctx.shadowColor = '#E24B4A';
        ctx.shadowBlur = 40;
        ctx.fillText('BOSS FIGHT', W / 2, H / 2 - 10);
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#ff6666';
        ctx.shadowBlur = 12;
        ctx.fillText('// SIGNAL DETECTED //', W / 2, H / 2 + 28);
        ctx.shadowBlur = 0;
      }
    }

    if (this.surgeFlashT > 0) {
      const t = this.surgeFlashT / 1.8;
      const alpha = t > 0.7 ? 1 : t / 0.7;
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px Courier New';
      ctx.fillStyle = '#E24B4A';
      ctx.shadowColor = '#E24B4A';
      ctx.shadowBlur = 28;
      ctx.fillText('!! SURGE !!', W / 2, H / 2);
      ctx.shadowBlur = 0;
    }

    if (this.shatterFlashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 * Math.min(1, this.shatterFlashT / 0.1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.overloadFlash > 0) {
      ctx.fillStyle = `rgba(255,182,39,${0.15 * Math.min(1, this.overloadFlash / 0.15)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.chainFlash > 0) {
      ctx.fillStyle = `rgba(255,182,39,${0.1 * Math.min(1, this.chainFlash / 0.1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.novaFlashT > 0) {
      ctx.fillStyle = `rgba(29,255,208,${0.05 * Math.min(1, this.novaFlashT / 0.1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalAlpha = 1;
  }

  drawBoundaryWarning() {
    const { ctx, W, H, P } = this;
    const edges = [
      { dist: P.x, side: 'left' },
      { dist: WORLD_W - P.x, side: 'right' },
      { dist: P.y, side: 'top' },
      { dist: WORLD_H - P.y, side: 'bottom' },
    ];

    edges.forEach(({ dist, side }) => {
      if (dist >= WORLD_BOUNDARY_WARN) return;
      const intensity = 1 - dist / WORLD_BOUNDARY_WARN;
      const pulse = dist < 100 ? Math.sin(this.gt * 4) * 0.15 : 0;
      const alpha = Math.max(0, Math.min(1, intensity * 0.75 + pulse));
      const reach = 200;
      const grad = (() => {
        switch (side) {
          case 'left': return ctx.createLinearGradient(0, 0, reach, 0);
          case 'right': return ctx.createLinearGradient(W, 0, W - reach, 0);
          case 'top': return ctx.createLinearGradient(0, 0, 0, reach);
          default: return ctx.createLinearGradient(0, H, 0, H - reach);
        }
      })();
      grad.addColorStop(0, `rgba(226, 75, 74, ${alpha})`);
      grad.addColorStop(1, 'rgba(226, 75, 74, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (dist < 150) {
        ctx.fillStyle = 'rgba(226, 75, 74, 0.9)';
        if (side === 'left') ctx.fillRect(0, 0, 3, H);
        else if (side === 'right') ctx.fillRect(W - 3, 0, 3, H);
        else if (side === 'top') ctx.fillRect(0, 0, W, 3);
        else ctx.fillRect(0, H - 3, W, 3);
      }
    });
  }

  draw() {
    const { ctx, W, H } = this;
    const perfMode = this.surgeActive && enemies.length > 70;
    const ultraMode = this.surgeActive && enemies.length > 110;

    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-this.camX + this.shake.x, -this.camY + this.shake.y);
    this.drawBackground();
    this.drawCryoFields();
    this.drawTripleWaves();
    drawParticles(ctx);
    this.drawNovaImpactFlashes();
    this.drawSplitDrones();
    this.drawShatterBursts();
    this.drawGems();
    this.drawMines();
    this.drawHealOrbs();
    this.drawSlowFields();
    this.drawArcBlade();
    this.drawSawBlade();
    drawBoss(ctx, this.boss);
    this.drawEnemies(perfMode);
    this.drawBullets(ultraMode);
    this.drawPlayer();
    this.drawDamageNumbers();
    ctx.restore();

    this.drawScreenEffects();
    this.drawBoundaryWarning();
    this._drawBarrierHealFx(ctx);
  }

  _drawBarrierHealFx(ctx) {
    if (!this.barrierHealFx.length) return;
    const hpWrap = document.getElementById('hpbar-wrap');
    if (!hpWrap) return;
    const rect = hpWrap.getBoundingClientRect();
    const targetY = rect.top + rect.height * 0.5;

    ctx.save();
    for (const fx of this.barrierHealFx) {
      const elapsed = fx.lt - fx.life;
      const rawT = Math.max(0, Math.min(1, elapsed / fx.lt));
      const t = Math.max(0, Math.min(1, (rawT - fx.delay) / Math.max(0.15, 1 - fx.delay)));
      if (t <= 0) continue;

      const start = this.toScreen(fx.sx, fx.sy);
      const tx = rect.left + rect.width * fx.targetRatio;
      const cx = (start.x + tx) * 0.5 + fx.drift;
      const cy = Math.min(start.y, targetY) - fx.lift;
      const x = quadPoint(start.x, cx, tx, t);
      const y = quadPoint(start.y, cy, targetY, t);
      const trailT = Math.max(0, t - 0.16);
      const trailX = quadPoint(start.x, cx, tx, trailT);
      const trailY = quadPoint(start.y, cy, targetY, trailT);
      const alpha = Math.max(0, fx.life / fx.lt);

      ctx.strokeStyle = `rgba(198,255,0,${0.18 * alpha})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = `rgba(255,255,255,${0.52 * alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, fx.size * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(198,255,0,${0.95 * alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, fx.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.P?.barrierHealT > 0) {
      const alpha = Math.max(0, this.P.barrierHealT);
      const start = this.toScreen(this.P.x, this.P.y - 6);
      const startX = start.x;
      const startY = start.y;
      const endX = rect.left + rect.width * Math.max(0, Math.min(1, ((this.P.barrierHealFrom || 0) + (this.P.barrierHealTo || 0)) * 0.5 / this.P.maxHp));
      const endY = targetY;
      ctx.strokeStyle = `rgba(198,255,0,${0.15 * alpha})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.08 * alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawNovaImpactFlashes() {
    const { ctx } = this;
    if (!this.novaImpactFlashes.length) return;
    this.novaImpactFlashes.forEach(flash => {
      const alpha = flash.life / flash.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, flash.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawSplitDrones() {
    const { ctx } = this;
    if (!this.P._splitDrones?.length) return;
    this.P._splitDrones.forEach((sd, i) => {
      const a = Math.min(1, sd.life / sd.maxLife);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#88FFDD';
      ctx.shadowColor = '#1DFFD0';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sd.x, sd.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1DFFD0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sd.x, sd.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });
  }
}

function wStats(wid, lvl, p) {
  const rb = p.rateBonus || 1;
  const empScaling = EMP_SCALING[Math.min(Math.max(lvl, 1), 5)] || EMP_SCALING[1];
  const rates = {
    cryo: (1.9 + lvl * 0.35) * rb,
    pulse: 0.45 * rb,
    emp: 0.4 * rb,
    swarm: 0,
    barrier: 0,
  };
  const r = (rates[wid] || 0).toFixed(1);
  if (wid === 'cryo') return [`Rate: ${r}/s`, `Projectiles: ${Math.min(5, Math.max(1, lvl))}`, lvl >= 2 ? 'Spread: widening fan' : 'Slow: 50% for 2s', 'Pierce: 1 enemy'];
  if (wid === 'pulse') return [`Rate: ${r}/s`, `Dmg: ${Math.round(p.dmg * (28 + lvl * 10))}`, 'Impact: heavy explosive shot', lvl >= 2 ? 'Cluster: splits on impact' : 'Cooldown: long', lvl >= 5 ? 'Cluster: four split layers' : lvl >= 4 ? 'Cluster: three split layers' : lvl >= 3 ? 'Cluster: bomblets split again' : ''];
  if (wid === 'emp') return [`Rate: ${r}/s`, `Radius: ${empScaling.radius}px`, `Stun: ${empScaling.stun.toFixed(1)}s`, `Dmg mult: x${empScaling.dmgMult.toFixed(1)}`];
  if (wid === 'swarm') return [`Drones: ${Math.min(6, 1 + lvl)}`, `Dmg/hit: ${Math.round(p.dmg * (28 + lvl * 14))}`, 'Orbit: auto-seek', lvl >= 2 ? 'Upgrade: +1 drone' : ''];
  if (wid === 'barrier') {
    const tier = WDEFS.barrier.tiers[Math.min(lvl, 5)];
    return [`Rate: ${r}/s`, `Absorb: ${tier.maxCap} dmg`, `Active: ${tier.activeDuration}s`, `Recharge: ${tier.rechargeTime}s`];
  }
  return [];
}

function wDesc(wid, lvl) {
  return ({
    cryo: {
      1: 'Fires a single Cryo lance that slows enemies by 50% for 2 seconds and pierces 1 target.',
      2: 'Adds a second Cryo lance and starts spreading the volley into a light fan.',
      3: 'Adds a third Cryo lance, giving the weapon a wider spread for better lane coverage.',
      4: 'Adds a fourth Cryo lance and widens the spread again to cover more of the screen.',
      5: 'Adds a fifth Cryo lance with the widest spread version of the weapon.'
    },
    pulse: {
      1: 'Launches a slow-cycling heavy Pulse round that explodes for strong burst damage on impact.',
      2: 'The main Pulse detonation now throws cluster bombs outward when it lands.',
      3: 'Cluster bombs now split again when they detonate, pushing the blast pattern much farther outward.',
      4: 'Those secondary cluster bombs now split again, creating a third outward wave of explosions.',
      5: 'Pulse reaches full cluster saturation, with yet another recursive split layer for a huge blast web.'
    },
    emp: {
      1: 'Releases a 160px EMP burst that lightly damages and stuns enemies for 1.2 seconds.',
      2: 'EMP grows to 200px, hits harder, and stuns for 1.4 seconds.',
      3: 'EMP reaches 245px with stronger damage and a 1.6 second stun.',
      4: 'EMP expands to 295px with a 1.8 second stun and higher control damage.',
      5: 'EMP peaks at a 350px burst with a 2.0 second stun and 2.8x damage scaling.'
    },
    swarm: {
      1: 'Deploys 2 orbiting drones that seek targets and strike automatically.',
      2: 'Adds a third orbiting swarm drone.',
      3: 'Adds a fourth orbiting swarm drone.',
      4: 'Adds a fifth orbiting swarm drone.',
      5: 'Adds a sixth orbiting swarm drone.'
    },
    barrier: {
      1: 'Absorbs 40 damage per cycle. Active 5s, recharge 8s.',
      2: 'Absorbs 65 damage per cycle. Active 6s, recharge 7s.',
      3: 'Absorbs 95 damage per cycle. Active 7s, recharge 6s.',
      4: 'Absorbs 130 damage per cycle. Active 8s, recharge 5s.',
      5: 'Absorbs 175 damage per cycle. Active 10s, recharge 4s.'
    }
  }[wid] || {})[lvl] || '';
}

function renderUpgradeCard(u, p, onClick) {
  if (u.type === 'wep') {
    const w = WDEFS[u.wid];
    const stats = wStats(u.wid, u.lvl, p);
    const subLine = u.isNew ? `UNLOCKS WEAPON ${w.name}` : `UPGRADES ${w.name} TO T${u.lvl}`;
    const detailLines = [u.isNew ? weaponUnlockDesc(u.wid) : wDesc(u.wid, u.lvl), ...stats].filter(Boolean);
    return `<div class="uc wep" tabindex="0" onclick="${onClick}">
      <div class="ut">WEAPON</div>
      <div class="un">${w.icon} ${w.name} T${u.lvl}</div>
      <div class="ud">${subLine}</div>
      <div class="us">${detailLines.join('<br>')}</div></div>`;
  }
  const preview = u.apply ? (() => { const c = { ...p }; return u.apply(c); })() : [];
  return `<div class="uc pas" tabindex="0" onclick="${onClick}">
    <div class="ut">PASSIVE UPGRADE</div>
    <div class="un">${passiveHeadline(u.id)}</div>
    <div class="us">${preview.join('<br>')}</div></div>`;
}

function weaponUnlockDesc(wid) {
  return ({
    cryo: 'Fires slowing Cryo lances that scale by adding more projectiles and wider spread.',
    pulse: 'Launches a heavy explosive Pulse shell that upgrades into cluster-bomb bursts.',
    emp: 'Sends a radial EMP stun that upgrades mostly through larger and larger control radius.',
    swarm: 'Deploys orbiting drones that keep scaling by adding more swarm bodies.',
    barrier: 'Wraps the player in a cycling shield that absorbs damage, then recharges after breaking.'
  }[wid] || 'Unlocks a new weapon.');
}
function passiveHeadline(id) {
  return ({
    p_spd: 'INCREASE MOVE SPEED',
    p_dmg: 'INCREASE ALL DAMAGE',
    p_mag: 'INCREASE XP PICKUP RANGE',
    p_hp: 'INCREASE MAX HP',
    p_dg: 'INCREASE DODGE CHANCE',
    p_rt: 'INCREASE ATTACK SPEED'
  }[id] || 'INCREASE RUN-WIDE STATS');
}

function formatWeaponList(p) {
  return getOwnedWeaponIds(p)
    .map(id => `${WDEFS[id].icon} ${WDEFS[id].name} T${getWeaponLevel(p, id)}`)
    .join(' · ');
}

function formatRunTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function renderBestMark(bestFields, field) {
  return bestFields.has(field) ? ' <span class="death-best">★ BEST</span>' : '';
}

function createPlaytestBuild(char) {
  const build = {
    charId: char.id,
    weapons: Object.fromEntries(Object.keys(WDEFS).map(wid => [wid, 0])),
    passives: Object.fromEntries(PASSIVES.map(passive => [passive.id, 0])),
    ascensions: Object.fromEntries(Object.keys(WDEFS).map(wid => [wid, null])),
  };
  build.weapons[char.startWeapon] = 1;
  return build;
}

function sanitizePlaytestBuild(build, char) {
  const base = createPlaytestBuild(char);
  const next = {
    charId: char.id,
    weapons: { ...base.weapons, ...(build?.weapons || {}) },
    passives: { ...base.passives, ...(build?.passives || {}) },
    ascensions: { ...base.ascensions, ...(build?.ascensions || {}) },
  };

  Object.keys(next.weapons).forEach(wid => {
    const min = wid === char.startWeapon ? 1 : 0;
    next.weapons[wid] = cl(Math.round(next.weapons[wid] || 0), min, 5);
  });

  Object.keys(next.passives).forEach(pid => {
    next.passives[pid] = cl(Math.round(next.passives[pid] || 0), 0, 8);
  });

  Object.keys(next.ascensions).forEach(wid => {
    const options = ASCENSIONS[wid] || [];
    const chosen = next.ascensions[wid];
    if ((next.weapons[wid] || 0) < 5) {
      next.ascensions[wid] = null;
      return;
    }
    next.ascensions[wid] = options.some(option => option.id === chosen) ? chosen : null;
  });

  return next;
}

function previewPlaytestPlayer(char, build) {
  const p = mkPlayer(0, 0, char);
  const safeBuild = sanitizePlaytestBuild(build, char);
  Object.entries(safeBuild.weapons).forEach(([wid, lvl]) => {
    if (lvl > 0) addWeapon(p, wid, lvl);
  });
  PASSIVES.forEach(passive => {
    const count = safeBuild.passives[passive.id] || 0;
    for (let i = 0; i < count; i++) passive.apply(p);
  });
  Object.entries(safeBuild.ascensions || {}).forEach(([wid, ascensionId]) => {
    if (!ascensionId) return;
    if ((safeBuild.weapons[wid] || 0) < 5) return;
    applyAscension(p, wid, ascensionId);
  });
  p.hp = p.maxHp;
  p.hpLag = p.maxHp;
  return p;
}

function renderPlaytestLab(build, char, isRunActive, worldDebug) {
  const safeBuild = sanitizePlaytestBuild(build, char);
  const summary = previewPlaytestPlayer(char, safeBuild);
  const ascensionCards = Object.entries(ASCENSIONS).map(([wid, options]) => {
    const weapon = WDEFS[wid];
    const lvl = safeBuild.weapons[wid] || 0;
    const selected = safeBuild.ascensions?.[wid] || null;
    const locked = lvl < 5;
    const optionButtons = options.map(option => `
      <button
        class="playtest-ascension-option${selected === option.id ? ' active' : ''}"
        ${locked ? 'disabled' : ''}
        onclick="window.__game.playtestSetAscension('${wid}', '${option.id}')">
        <span>${option.name}</span>
        <small>${option.description}</small>
      </button>
    `).join('');
    return `
      <div class="playtest-card">
        <div class="playtest-card-top">
          <div>
            <div class="playtest-item-name" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</div>
            <div class="playtest-item-copy">${locked ? 'Reach Tier 5 in the lab to enable ascensions.' : 'Choose one transformation to test.'}</div>
          </div>
          <button class="playtest-clear" ${selected ? '' : 'disabled'} onclick="window.__game.playtestSetAscension('${wid}', null)">CLEAR</button>
        </div>
        <div class="playtest-item-copy">${selected ? `Selected: ${options.find(option => option.id === selected)?.name || 'None'}` : 'No ascension selected'}</div>
        <div class="playtest-ascension-list">${optionButtons}</div>
      </div>`;
  }).join('');

  const weaponCards = Object.keys(WDEFS).map(wid => {
    const weapon = WDEFS[wid];
    const lvl = safeBuild.weapons[wid] || 0;
    const min = wid === char.startWeapon ? 1 : 0;
    const canDown = lvl > min;
    const stats = lvl > 0 ? wStats(wid, lvl, summary) : [weaponUnlockDesc(wid)];
    return `
      <div class="playtest-card">
        <div class="playtest-card-top">
          <div>
            <div class="playtest-item-name" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</div>
            <div class="playtest-item-copy">${lvl > 0 ? `Tier ${lvl}` : 'Not equipped'}</div>
          </div>
          <div class="playtest-stepper">
            <button class="playtest-step" ${canDown ? '' : 'disabled'} onclick="window.__game.playtestAdjustWeapon('${wid}', -1)">-</button>
            <span class="playtest-value">${lvl}</span>
            <button class="playtest-step" ${lvl < 5 ? '' : 'disabled'} onclick="window.__game.playtestAdjustWeapon('${wid}', 1)">+</button>
          </div>
        </div>
        <div class="playtest-item-copy">${wid === char.startWeapon ? 'Starter weapon cannot go below Tier 1.' : 'Tap to slot in or remove this weapon instantly.'}</div>
        <div class="playtest-stats">${stats.filter(Boolean).slice(0, 4).map(line => `<span>${line}</span>`).join('')}</div>
      </div>`;
  }).join('');

  const passiveCards = PASSIVES.map(passive => {
    const count = safeBuild.passives[passive.id] || 0;
    const previewLines = passive.apply(previewPlaytestPlayer(char, safeBuild)).slice(0, 2);
    return `
      <div class="playtest-card">
        <div class="playtest-card-top">
          <div>
            <div class="playtest-item-name">${passive.label}</div>
            <div class="playtest-item-copy">Stacks instantly for feel testing.</div>
          </div>
          <div class="playtest-stepper">
            <button class="playtest-step" ${count > 0 ? '' : 'disabled'} onclick="window.__game.playtestAdjustPassive('${passive.id}', -1)">-</button>
            <span class="playtest-value">${count}</span>
            <button class="playtest-step" ${count < 8 ? '' : 'disabled'} onclick="window.__game.playtestAdjustPassive('${passive.id}', 1)">+</button>
          </div>
        </div>
        <div class="playtest-stats">${previewLines.map(line => `<span>${line}</span>`).join('')}</div>
      </div>`;
  }).join('');

  const actions = isRunActive
    ? `
      <button class="btn" onclick="window.__game.closePlaytestLab()">RESUME TEST</button>
      <button class="btn btn-secondary" onclick="window.__game.refillPlaytestVitals()">REFILL HP</button>
      <button class="btn btn-secondary" onclick="window.__game.resetPlaytestBuild()">RESET BUILD</button>
      <button class="btn btn-secondary" onclick="window.__game.showMainMenu()">MENU</button>`
    : `
      <button class="btn" onclick="window.__game.startPlaytestRun()">START TEST SESSION</button>
      <button class="btn btn-secondary" onclick="window.__game.resetPlaytestBuild()">RESET BUILD</button>
      <button class="btn btn-secondary" onclick="window.__game.showMainMenu()">BACK</button>`;

  return `
    <div class="playtest-shell">
      <div class="records-head">
        <div class="ov-title">PLAYTEST LAB</div>
        <div class="ov-sub">// quick build toggles // no full run required //</div>
      </div>
      <section class="playtest-summary">
        <div>
          <div class="panel-label">ACTIVE OPERATOR</div>
          <div class="playtest-summary-name" style="color:${char.col}">${char.name}</div>
        </div>
        <div class="playtest-summary-stats">
          <span>SPD ${summary.spd}</span>
          <span>DMG x${summary.dmg.toFixed(2)}</span>
          <span>DODGE ${Math.round(summary.dodge * 100)}%</span>
          <span>HP ${summary.maxHp}</span>
        </div>
      </section>
      <section class="records-panel">
        <div class="panel-label">WORLD DEBUG</div>
        <div class="playtest-summary-stats">
          <span>P (${worldDebug.x}, ${worldDebug.y})</span>
          <span>CAM (${worldDebug.camX}, ${worldDebug.camY})</span>
          <span>WORLD ${worldDebug.worldW} x ${worldDebug.worldH}</span>
          <span>EDGE ${worldDebug.edgeDist}px</span>
        </div>
      </section>
      <section class="records-panel">
        <div class="panel-label">WEAPONS</div>
        <div class="playtest-grid">${weaponCards}</div>
      </section>
      <section class="records-panel">
        <div class="panel-label">PASSIVES</div>
        <div class="playtest-grid">${passiveCards}</div>
      </section>
      <section class="records-panel">
        <div class="panel-label">ASCENSIONS</div>
        <div class="playtest-grid">${ascensionCards}</div>
      </section>
      <div class="menu-actions">${actions}</div>
      ${isRunActive ? '<div class="playtest-hint">Tap LAB or press L during a test run to reopen this panel.</div>' : ''}
    </div>`;
}

function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
function getDiscAngle(discIndex, discCount, baseAngle) {
  if (discCount === 1) return baseAngle;
  if (discCount === 2) return discIndex === 0 ? baseAngle : baseAngle + Math.PI;
  if (discCount === 3) return baseAngle + (discIndex / 3) * Math.PI * 2;
  return baseAngle + (discIndex / discCount) * Math.PI * 2;
}
function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / abLenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}
function quadPoint(a, c, b, t) { return ((1 - t) * (1 - t) * a) + (2 * (1 - t) * t * c) + (t * t * b); }



