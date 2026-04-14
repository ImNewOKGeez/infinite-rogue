import { initHUD, updateHUD, showOverlay, hideOverlay, setBossBar, showDiscoveryOverlay, showRecordsScreen, showAscensionDraft } from './hud.js';
import { initInput, initJoystick, jDir } from './input.js';
import { CHARACTERS, addWeapon, getAscension, getAscensionTier, getOwnedWeaponIds, getWeaponLevel, hasAscension, mkPlayer, mkWeaponState } from './player.js';
import { enemies, resetEnemies, spawnEnemy, pruneEnemies, dist2, nearest, setExtraTarget, clearExtraTarget, tickEnemyStatus, updateEnemyFreezeState, applyStun, applySlow, applyKnockback } from './enemies.js';
import { EMP_SCALING, MOLOTOV_TIERS, WDEFS, bullets, resetBullets, resetPulseClusters, handleCryoImpact, updateCryoFields, getPulseHitDamage, triggerPulseExplosion, spawnBullet, applyFreezeMeter, spawnPulseClusters, getAscensionTierData } from './weapons.js';
import { PASSIVES, buildPool, applyUpgrade, applyAscension, applyAscensionTier } from './upgrades.js';
import { particles, resetParticles, updateParticles, addRing, addBurst, addDot, addArc, addFrostTrail, addStunAura, drawParticles } from './particles.js';
import { mkBoss, updateBoss, drawBoss, hitBoss, BOSS_SPAWN_TIME, BOSS_RESPAWN_DELAY } from './boss.js';
import { SYNERGIES, getSave, recordDiscovery, recordRun, getRatingTier, RATING_COLORS } from './progression.js';
import { WORLD_BOUNDARY_WARN, WORLD_H, WORLD_W } from './constants.js';
import { ARC_BLADE_TIERS, quadPoint as quadBezierPoint } from './arcBlade.js';
import { renderUpgradeCard as renderUpgradeCardView, formatRunTime as formatRunTimeView } from './gameUi.js';
import { MenuBackground } from './menuBackground.js';
import {
  createPlaytestBuild as makePlaytestBuild,
  createPlaytestLabState as makePlaytestLabState,
  getLabNextBossTime as getPlaytestLabNextBossTime,
  getNextSurgeTime as getPlaytestNextSurgeTime,
  getXpTargetForLevel as getPlaytestXpTargetForLevel,
  LAB_PASSIVE_INPUTS as LAB_PASSIVE_INPUT_CONFIG,
  LAB_WEAPON_INPUTS as LAB_WEAPON_INPUT_CONFIG,
  PLAYTEST_LAB_PRESETS as PLAYTEST_LAB_PRESETS_CONFIG,
  previewPlaytestPlayer as buildPreviewPlaytestPlayer,
  renderPlaytestLab as renderPlaytestLabView,
  sanitizePlaytestBuild as sanitizePlaytestBuildView,
} from './playtest.js';
import { hexToRgba, brightenHexColor, traceEnemyShape } from './renderUtils.js';
import {
  initAudio, resumeAudio,
  playEMPSound,
  playCryoFire, playPermafrostFire, playCryoStormSound, playPulseFire, playCascadeSound, playTriplePulseSound, playArcSound,
  playArcBladeSound,
  playMolotovThrowSound, playMolotovLandSound,
  playBarrierAbsorbSound,
  playNovaDetonationSound,
  playFrenzySound,
  playHit, playEnemyDeath, playPlayerHit, playDodge,
  playLevelUp, playXp, playSurge, playDeathSound, playDiscoverySound, playAscensionOpen, playUIClick, playUIClose, playUIOpen, playUISelect,
  playShatter,
  playBossWarning, playBossPhaseTwo, playBossDeath,
  startBossMusic, stopBossMusic,
} from './audio.js';

export class Game {
  constructor() {
    this.P = null;
    this.selectedCharId = 'ghost';
    this.menuSelectedCharId = null;
    this.gt = 0;
    this.lt = 0;
    this.dt = 0;
    this.running = false;
    this.paused = false;
    this.killCount = 0;
    this.killsByType = {
      runner: 0,
      shooter: 0,
      brute: 0,
      titan: 0,
      juggernaut: 0,
      leech: 0,
    };
    this.gems = [];
    this.healOrbs = [];
    this.healOrbDropCooldown = 0;
    this.barrierHealFx = [];
    this.dmgNums = [];
    this.shake = { x: 0, y: 0, t: 0, mag: 22 };
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this.surgeCount = 0;
    this._activeShields = [];
    this._st = 0;
    this._lastHitSound = 0;
    this._lastXpSound = 0;
    this.surgeFlashT = 0;
    this._dmgTextSkip = 0;
    this.boss = null;
    this.bossWarned = false;
    this.bossIntro = false;
    this.bossIntroT = 0;
    this.bossActive = false;
    this.nextBossTime = BOSS_SPAWN_TIME;
    this.bossRespawnT = 0;
    this.cryoFields = [];
    this.runDiscoveries = new Set();
    this.runNewDiscoveries = new Set();
    this.discoveryPauseQueue = [];
    this.discoveryPauseActive = false;
    this.shatterBursts = [];
    this.playtestMode = false;
    this.playtestBuild = null;
    this.playtestLabState = makePlaytestLabState();
    this.camX = 0;
    this.camY = 0;
    this.bgNodes = [];
    this.bgConnections = [];
    this.bgPackets = [];
    this.pendingExplosions = [];
    this.pendingCascades = [];
    this.tripleWaves = [];
    this.slowFields = [];
    this.currentUpgradePool = [];
    this.overloadFlash = 0;
    this.chainFlash = 0;
    this.novaFlashT = 0;
    this.novaImpactFlashes = [];
    this._bossShockwave = null;
    this._screenFlash = null;
    this._cryoStormSoundPlayedThisFrame = false;
    this._barrierRipple = null;
    this.menuBg = null;
    this._overlayToken = 0;
    this._overlayFadeTimeout = null;
    this._overlayHideTimeout = null;
  }

  start() {
    initHUD();
    this.initPause();
    this.menuBg = new MenuBackground(document.getElementById('menu-bg-canvas'));
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
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !this.running) return;
      this.togglePause();
    });
    window.__game = this;
    this.showStart();
  }

  initPause() {
    document.getElementById('pause-btn')?.addEventListener('click', () => {
      if (!this.running) return;
      this.togglePause();
    });
    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.togglePause();
    });
    document.getElementById('btn-quit-run')?.addEventListener('click', () => {
      this.unpause();
      this.endGame();
    });
  }

  _clearOverlayTimers() {
    if (this._overlayFadeTimeout) {
      clearTimeout(this._overlayFadeTimeout);
      this._overlayFadeTimeout = null;
    }
    if (this._overlayHideTimeout) {
      clearTimeout(this._overlayHideTimeout);
      this._overlayHideTimeout = null;
    }
  }

  _resetOverlayStyles() {
    const overlay = document.getElementById('overlay');
    if (!overlay) return null;
    overlay.style.opacity = '';
    overlay.style.transition = '';
    overlay.style.animation = '';
    return overlay;
  }

  _prepareOverlayShow() {
    this._overlayToken++;
    this._clearOverlayTimers();
    this._resetOverlayStyles();
    return this._overlayToken;
  }

  _showOverlay(html, className = '') {
    this._prepareOverlayShow();
    showOverlay(html, className);
    this._resetOverlayStyles();
  }

  _hideOverlayNow() {
    this._overlayToken++;
    this._clearOverlayTimers();
    this._resetOverlayStyles();
    hideOverlay();
  }

  togglePause() {
    if (!this.running) return;
    const overlay = document.getElementById('pause-overlay');
    const btn = document.getElementById('pause-btn');
    const appOverlay = document.getElementById('overlay');
    const pauseVisible = !!overlay?.classList.contains('visible');
    const blockingOverlayVisible = appOverlay?.style.display === 'flex';
    if (blockingOverlayVisible && !pauseVisible) return;

    this.paused = !this.paused;
    if (this.paused) {
      overlay?.classList.add('visible');
      if (btn) btn.textContent = '▶';
      playUIClick();
      return;
    }
    this.unpause();
    playUIClick();
  }

  unpause() {
    this.paused = false;
    document.getElementById('pause-overlay')?.classList.remove('visible');
    const btn = document.getElementById('pause-btn');
    if (btn) btn.textContent = '⏸';
    this.lt = performance.now();
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
      this.playtestBuild = sanitizePlaytestBuildView(options.build || this.playtestBuild || makePlaytestBuild(char), char);
    }
    initAudio();
    resumeAudio();
    resetEnemies();
    resetBullets();
    resetPulseClusters();
    resetParticles();
    this.gems = [];
    this.healOrbs = [];
    this.healOrbDropCooldown = 0;
    this.barrierHealFx = [];
    this.dmgNums = [];
    this.gt = 0;
    this.killCount = 0;
    this.killsByType = {
      runner: 0,
      shooter: 0,
      brute: 0,
      titan: 0,
      juggernaut: 0,
      leech: 0,
    };
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this.surgeCount = 0;
    this._activeShields = [];
    this._st = 0;
    this._lastHitSound = 0;
    this._lastXpSound = 0;
    this.surgeFlashT = 0;
    this._dmgTextSkip = 0;
    this.boss = null;
    this.bossWarned = false;
    this.bossIntro = false;
    this.bossIntroT = 0;
    this.bossActive = false;
    this.nextBossTime = BOSS_SPAWN_TIME;
    this.bossRespawnT = 0;
    this.cryoFields = [];
    this.runDiscoveries = new Set();
    this.runNewDiscoveries = new Set();
    this.discoveryPauseQueue = [];
    this.discoveryPauseActive = false;
    this.shatterBursts = [];
    this.pendingExplosions = [];
    this.pendingCascades = [];
    this.tripleWaves = [];
    this.slowFields = [];
    this.currentUpgradePool = [];
    this.overloadFlash = 0;
    this.chainFlash = 0;
    this.novaFlashT = 0;
    this.novaImpactFlashes = [];
    this._bossShockwave = null;
    this._screenFlash = null;
    this._cryoStormSoundPlayedThisFrame = false;
    this._barrierRipple = null;
    this.P = mkPlayer(this.W, this.H, char);
    this.P._pulseMines = [];
    this.P._pulseOverloadCounter = 0;
    this.P._arcDiscs = [];
    this.P._sawBlade = null;
    this.P._novaDrones = [];
    this.P._splitDrones = [];
    this.P._dr = null;
    this.P._cryoOverloadCounter = 0;
    this.P._molotovTimer = 0;
    this.P._firePools = [];
    this.P._bottles = [];
    this.P._pendingBottles = [];
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
    this.menuBg?.stop();
    document.getElementById('low-health-vignette')?.classList.remove('active');
    document.getElementById('death-vignette')?.classList.remove('active');
    document.getElementById('screen-transition')?.classList.remove('fade-in');
    this.setPlaytestToggleVisible(this.playtestMode);
    clearExtraTarget();
    setBossBar(null);
    this._hideOverlayNow();
    this.unpause();
    document.getElementById('pause-btn')?.style.setProperty('display', 'block');
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
    this._prepareOverlayShow();
    showDiscoveryOverlay(synergy, () => this.resumeAfterDiscovery());
  }

  resumeAfterDiscovery() {
    this._hideOverlayNow();
    this.discoveryPauseActive = false;
    if (this.discoveryPauseQueue.length) {
      this._showNextDiscoveryPause();
      return;
    }
    if (this.running) this.unpause();
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
    const { P } = this;
    this._cryoStormSoundPlayedThisFrame = false;
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
    if (this.overloadFlash > 0) this.overloadFlash = Math.max(0, this.overloadFlash - dt);
    if (this.chainFlash > 0) this.chainFlash = Math.max(0, this.chainFlash - dt);
    if (this.novaFlashT > 0) this.novaFlashT = Math.max(0, this.novaFlashT - dt);
    if (this._screenFlash) {
      this._screenFlash.life -= dt;
      if (this._screenFlash.life <= 0) this._screenFlash = null;
    }
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
    this._updateActiveShields();
    this._updateBoss(dt);
    this.updateBossShockwave(dt);
    this._fireWeapons(dt);
    if (getWeaponLevel(P, 'arcblade')) {
      this.updateArcBlade(dt);
    }
    if (getWeaponLevel(P, 'molotov')) {
      this.updateMolotov(dt);
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
    this.updateSurgeTimer();
    setBossBar(this.boss);
  }

  updateSurgeTimer() {
    const wrap = document.getElementById('surge-timer-wrap');
    const bar = document.getElementById('surge-timer-bar');
    const label = document.getElementById('surge-timer-label');
    if (!wrap || !bar || !label) return;

    if (this.surgeActive) {
      wrap.classList.add('active');
      wrap.classList.remove('warning');
      bar.style.width = '100%';
      bar.style.background = '#E24B4A';
      bar.style.opacity = String(0.5 + 0.5 * Math.sin(this.gt * 6));
      label.style.color = '#E24B4A';
      label.textContent = 'SURGE ACTIVE';
      return;
    }

    const timeSinceLastSurge = this.gt % 40;
    const progress = timeSinceLastSurge / 40;
    wrap.classList.remove('active');
    wrap.classList.toggle('warning', progress > 0.8);
    bar.style.width = (progress * 100) + '%';
    bar.style.background = progress > 0.8 ? '#E24B4A' : '#8a2b2a';
    bar.style.opacity = '1';
    label.style.color = progress > 0.8 ? '#E24B4A' : '#8a2b2a';
    label.textContent = 'SURGE';
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
    P.invT = 0.6;
    P.hurtFlash = 1;
    this._screenFlash = { col: '#FFFFFF', alpha: 0.35, life: 0.18, maxLife: 0.18 };
    P.hpLag = Math.max(P.hpLag, P.hp + remainingDamage);
    this.setShake(shakeDur, shakeMag);
    const hpbar = document.getElementById('hpbar');
    if (hpbar) {
      hpbar.classList.add('damage-flash');
      setTimeout(() => hpbar.classList.remove('damage-flash'), 80);
    }
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
    P._shieldHitT = 0.32;
    if (absorbed > 0) {
      this._barrierRipple = { life: 0.42, maxLife: 0.42 };
      addBurst(P.x, P.y, '#C6FF00', 10, 110, 3.6, 0.24);
      addRing(P.x, P.y, P.r + 11, '#FFFFFF', 3, 0.16);
      addRing(P.x, P.y, P.r + 15, '#C6FF00', 2.5, 0.2);
      playBarrierAbsorbSound();
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
    const missingHp = P.maxHp - P.hp;
    const absorbed = P._shieldAbsorbedCycle || 0;
    const heal = Math.min(absorbed, missingHp * 0.4);
    if (heal > 0) {
      const healFrom = P.hp;
      P.hp = Math.min(P.maxHp, P.hp + heal);
      P.hpLag = Math.max(P.hpLag, P.hp);
      P.barrierHealFrom = healFrom;
      P.barrierHealTo = P.hp;
      P.barrierHealT = 1;
      P.barrierHealImpactT = 1;
      this._spawnBarrierHealFx(P, healFrom, P.hp);
      this.addDN(P.x, P.y - 26, `+${Math.round(heal)}`, '#C6FF00', 0.8, true);
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
    const novaDef = getAscensionTierData(this.P, 'swarm')?.definition;
    const blastR = novaDef?.blastRadius || 110;
    const blastDmg = (killedEnemy.maxHp || 0) * (novaDef?.blastDamageMult || 0.4);

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
        life: novaDef?.novaLife || 8.0,
        isNova: true,
      });
    }
  }

  handleNovaDroneExpire(x, y) {
    addBurst(x, y, '#AAFFEE', 5, 35, 2, 0.16);
    addRing(x, y, 20, '#AAFFEE', 1.4, 0.18);
  }

  spawnSplitDrone(P, parentDrone, targetEnemy, orbitR) {
    const splitDef = getAscensionTierData(P, 'swarm')?.definition;
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
      life: splitDef?.life || 3.0,
      maxLife: splitDef?.life || 3.0,
      ht: 0,
      speed: splitDef?.speed || 220,
    });

    addBurst(spawnX, spawnY, '#1DFFD0', 6, 80, 2, 0.3);
    addRing(spawnX, spawnY, 20, '#1DFFD0', 1.5, 0.2);
  }

  updateSplitDrones(dt) {
    if (!this.P._splitDrones?.length) return;
    const swarmLvl = getWeaponLevel(this.P, 'swarm');
    const splitDef = getAscensionTierData(this.P, 'swarm')?.definition;
    const dmg = this.P.dmg * (7 + swarmLvl * 3.5) * (splitDef?.damageMult || 0.6);
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
          sd.ht = splitDef?.hitCooldown || 0.3;
          this.hitEnemy(sd.target, dmg, '#1DFFD0');
          pruneEnemies();
        }
      }
      return true;
    });
  }

  launchDisc(discIndex, startAngle) {
    const P = this.P;
    const tier = ARC_BLADE_TIERS[getWeaponLevel(P, 'arcblade')];
    if (!tier) return;

    const orbitR = tier.rx;
    const disc = {
      orbitR,
      theta: startAngle,
      thetaSpeed: tier.thetaSpeed,
      rotation: 0,
      dmg: P.dmg * tier.dmgMult * 15,
      pierce: tier.pierce,
      hitEnemies: new Set(),
      discIndex,
      isSplit: false,
      x: P.x + Math.cos(startAngle) * orbitR,
      y: P.y + Math.sin(startAngle) * orbitR,
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

    for (let i = 0; i < tier.discCount; i++) {
      const active = P._arcDiscs.filter(disc => disc.discIndex === i);
      if (active.length === 0) {
        const startAngle = (i / tier.discCount) * Math.PI * 2;
        this.launchDisc(i, startAngle);
      }
    }

    P._arcDiscs = P._arcDiscs.filter(disc => {
      disc.theta += disc.thetaSpeed * dt;
      disc.rotation += dt * 8;

      const orbitCos = Math.cos(disc.theta);
      const orbitSin = Math.sin(disc.theta);
      disc.x = this.P.x + orbitCos * disc.orbitR;
      disc.y = this.P.y + orbitSin * disc.orbitR;
      disc.trail ||= [];
      disc.trail.push({ x: disc.x, y: disc.y });
      if (disc.trail.length > 6) disc.trail.shift();

      if (disc.theta >= Math.PI * 2) {
        disc.theta -= Math.PI * 2;
        disc.hitEnemies.clear();
      }

      enemies.forEach(e => {
        if (disc.hitEnemies.has(e)) return;
        const d = Math.hypot(e.x - disc.x, e.y - disc.y);
        if (d < e.r + 10) {
          disc.hitEnemies.add(e);
          this.hitEnemy(e, disc.dmg, '#FF2D9B');
        }
      });
      pruneEnemies();
      return true;
    });
  }

  updateMolotov(dt) {
    const P = this.P;
    P._pendingBottles ||= [];
    const molotovLvl = getWeaponLevel(P, 'molotov');
    if (!molotovLvl) return;
    const tier = MOLOTOV_TIERS[molotovLvl];
    if (!tier) return;
    const molotovTierDef = getAscensionTierData(P, 'molotov')?.definition;

    P._molotovTimer -= dt;
    if (P._molotovTimer <= 0) {
      const fireRate = P.ascensions.molotov === 'inferno'
        ? tier.fireRate * (molotovTierDef?.fireRateMult || 2.0)
        : tier.fireRate;
      P._molotovTimer = fireRate * (1 / (P.rateBonus || 1));
      this.throwMolotov(tier);
    }

    P._bottles = P._bottles.filter(b => {
      if (b.justCreated) {
        b.justCreated = false;
        return true;
      }

      b.t += dt / b.flightTime;
      const lx = b.targetX - b.startX;
      const ly = b.targetY - b.startY;
      b.x = b.startX + lx * b.t;
      b.y = b.startY + ly * b.t - Math.sin(b.t * Math.PI) * b.arcHeight;

      b.trail ||= [];
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      if (b.t >= 1) {
        this.landMolotov(b);
        return false;
      }
      return true;
    });

    if (P._pendingBottles.length > 0) {
      P._bottles.push(...P._pendingBottles);
      P._pendingBottles = [];
    }

    P._firePools = P._firePools.filter(pool => {
      pool.life -= dt;
      if (pool.life <= 0) return false;

      pool.dmgTimer = (pool.dmgTimer || 0) - dt;
      if (pool.dmgTimer <= 0) {
        pool.dmgTimer = 0.1;
        enemies.forEach(e => {
          if (Math.hypot(e.x - pool.x, e.y - pool.y) < pool.r + e.r) {
            const dmg = P.dmg * pool.dmgMult * 0.1;
            this.hitEnemy(e, dmg, '#FF2D9B');
          }
        });
        pruneEnemies();
      }
      return true;
    });

  }

  throwMolotov(tier) {
    const P = this.P;
    const primaryTarget = nearest(P);
    const baseAngle = primaryTarget
      ? Math.atan2(primaryTarget.y - P.y, primaryTarget.x - P.x)
      : 0;
    const primaryEnemyAngle = primaryTarget
      ? Math.atan2(P.y - primaryTarget.y, P.x - primaryTarget.x)
      : baseAngle;
    const primaryPredictDist = primaryTarget ? (primaryTarget.spd || 60) * 0.5 * 0.7 : 0;
    const primaryPredictX = primaryTarget
      ? primaryTarget.x - Math.cos(primaryEnemyAngle) * primaryPredictDist
      : P.x + Math.cos(baseAngle) * 200;
    const primaryPredictY = primaryTarget
      ? primaryTarget.y - Math.sin(primaryEnemyAngle) * primaryPredictDist
      : P.y + Math.sin(baseAngle) * 200;
    const angle = Math.atan2(primaryPredictY - P.y, primaryPredictX - P.x);
    const dist = primaryTarget
      ? Math.min(Math.hypot(primaryPredictX - P.x, primaryPredictY - P.y) + 30, 350)
      : 200;

    if (P.ascensions.molotov === 'inferno') {
      const infernoDef = getAscensionTierData(P, 'molotov')?.definition;
      const infernoRadius = tier.radius * (infernoDef?.radiusMult || 1.8);
      const targetX = P.x + Math.cos(angle) * dist;
      const targetY = P.y + Math.sin(angle) * dist;
      P._bottles.push({
        startX: P.x,
        startY: P.y,
        targetX,
        targetY,
        x: P.x,
        y: P.y,
        t: 0,
        flightTime: 0.5,
        arcHeight: 100,
        trail: [],
        dmgMult: tier.dmgMult * (infernoDef?.damageMult || 1.5),
        radius: infernoRadius,
        duration: infernoDef?.duration || 8.0,
        isBounce: false,
        isCluster: false,
        bounceCount: 0,
        isInferno: true,
        justCreated: true,
      });
      playMolotovThrowSound();
      return;
    }

    const poolCount = tier.pools;
    const sectorAngles = poolCount === 1
      ? [baseAngle]
      : poolCount === 2
        ? [baseAngle - Math.PI / 3, baseAngle + Math.PI / 3]
        : [baseAngle - Math.PI * 2 / 3, baseAngle, baseAngle + Math.PI * 2 / 3];
    const sectorHalfWidth = Math.PI / 3;

    sectorAngles.forEach(sectorCentre => {
      let sectorTarget = null;
      let sectorDist = Infinity;
      enemies.forEach(e => {
        const eAngle = Math.atan2(e.y - P.y, e.x - P.x);
        let angleDiff = eAngle - sectorCentre;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) <= sectorHalfWidth) {
          const d = Math.hypot(e.x - P.x, e.y - P.y);
          if (d < sectorDist) {
            sectorDist = d;
            sectorTarget = e;
          }
        }
      });

      const throwAngle = sectorTarget
        ? Math.atan2(sectorTarget.y - P.y, sectorTarget.x - P.x)
        : sectorCentre;
      const throwDist = sectorTarget
        ? Math.min(Math.hypot(sectorTarget.x - P.x, sectorTarget.y - P.y) + 30, 350)
        : 200;
      const predictDist = sectorTarget ? (sectorTarget.spd || 60) * 0.5 * 0.7 : 0;
      const enemyMoveAngle = sectorTarget
        ? Math.atan2(P.y - sectorTarget.y, P.x - sectorTarget.x)
        : throwAngle + Math.PI;
      const targetX = P.x + Math.cos(throwAngle) * throwDist
        - Math.cos(enemyMoveAngle) * predictDist;
      const targetY = P.y + Math.sin(throwAngle) * throwDist
        - Math.sin(enemyMoveAngle) * predictDist;

      P._bottles.push({
        startX: P.x,
        startY: P.y,
        targetX,
        targetY,
        x: P.x,
        y: P.y,
        t: 0,
        flightTime: 0.5,
        arcHeight: 80,
        trail: [],
        tier,
        dmgMult: tier.dmgMult,
        radius: tier.radius,
        duration: tier.duration,
        isBounce: P.ascensions.molotov === 'bouncing_cocktail',
        isCluster: P.ascensions.molotov === 'cluster_molotov',
        bounceCount: 0,
        justCreated: true,
      });
    });

    playMolotovThrowSound();
  }

  landMolotov(bottle) {
    const P = this.P;
    P._pendingBottles ||= [];
    const landedX = bottle.targetX;
    const landedY = bottle.targetY;

    if (bottle.isCluster) {
      const clusterDef = getAscensionTierData(this.P, 'molotov')?.definition;
      const subBottleCount = clusterDef?.subBottleCount || 3;
      this.createFirePool(landedX, landedY, bottle.radius, bottle.duration, bottle.dmgMult, bottle.isInferno === true);
      Array.from({ length: subBottleCount }, (_, index) => index).forEach(index => {
        const offset = subBottleCount === 1 ? 0 : -0.9 + (1.8 * index) / (subBottleCount - 1);
        const subDist = (clusterDef?.subDistanceMin || 150) + Math.random() * ((clusterDef?.subDistanceMax || 210) - (clusterDef?.subDistanceMin || 150));
        const baseAngle = Math.atan2(
          landedY - bottle.startY,
          landedX - bottle.startX
        ) + offset;
        const targetX = landedX + Math.cos(baseAngle) * subDist;
        const targetY = landedY + Math.sin(baseAngle) * subDist;
        P._pendingBottles.push({
          startX: landedX,
          startY: landedY,
          targetX,
          targetY,
          x: landedX,
          y: landedY,
          t: 0,
          flightTime: 0.5,
          arcHeight: 60,
          trail: [],
          tier: bottle.tier,
          dmgMult: bottle.dmgMult,
          radius: bottle.radius * (clusterDef?.subRadiusMult || 0.8),
          duration: bottle.duration,
          isBounce: false,
          isCluster: false,
          bounceCount: 0,
          isSub: true,
          justCreated: true,
        });
      });
    } else if (bottle.isBounce && bottle.bounceCount < (getAscensionTierData(this.P, 'molotov')?.definition?.maxBounces || 3)) {
      const bounceDef = getAscensionTierData(this.P, 'molotov')?.definition;
      this.createFirePool(
        landedX,
        landedY,
        bounceDef?.bouncePoolRadius || 85,
        bottle.duration,
        bottle.dmgMult,
        false
      );
      const bounceAngle = Math.atan2(
        landedY - bottle.startY,
        landedX - bottle.startX
      ) + (Math.random() - 0.5) * 0.6;
      const bounceDist = (bounceDef?.bounceDistanceBase || 140) - bottle.bounceCount * (bounceDef?.bounceDistanceStep || 20);
      P._pendingBottles.push({
        ...bottle,
        startX: landedX,
        startY: landedY,
        targetX: landedX + Math.cos(bounceAngle) * bounceDist,
        targetY: landedY + Math.sin(bounceAngle) * bounceDist,
        x: landedX,
        y: landedY,
        t: 0,
        flightTime: 0.25,
        arcHeight: 40 - bottle.bounceCount * 10,
        trail: [],
        bounceCount: bottle.bounceCount + 1,
        justCreated: true,
      });
    } else {
      this.createFirePool(landedX, landedY, bottle.radius, bottle.duration, bottle.dmgMult, bottle.isInferno === true);
    }

    addBurst(landedX, landedY, '#FF2D9B', 10, 80, 3, 0.4);
    addRing(landedX, landedY, bottle.radius * 0.5, '#FF2D9B', 2, 0.3);
    playMolotovLandSound();
  }

  createFirePool(x, y, r, duration, dmgMult, isInferno = false) {
    this.P._firePools.push({
      x, y, r,
      life: duration,
      maxLife: duration,
      dmgMult,
      dmgTimer: 0,
      isInferno,
    });
  }

  updateSawBlade(dt) {
    const P = this.P;
    if (!P._sawBlade) return;
    const tier = ARC_BLADE_TIERS[getWeaponLevel(P, 'arcblade')];
    if (!tier) return;
    const saw = P._sawBlade;
    const sawDef = getAscensionTierData(P, 'arcblade')?.definition;

    saw.thetaSpeed = sawDef?.thetaSpeed || 2.2;
    saw.orbitR = sawDef?.orbitR || saw.orbitR;
    saw.theta += saw.thetaSpeed * dt;
    saw.rotation += dt * 5;
    saw.x = P.x + Math.cos(saw.theta) * saw.orbitR;
    saw.y = P.y + Math.sin(saw.theta) * saw.orbitR;

    saw.damageTimer -= dt;
    if (saw.damageTimer <= 0) {
      saw.damageTimer = sawDef?.tickRate || 0.1;
      const sawRadius = sawDef?.radius || 40;
      const sawDmg = P.dmg * tier.dmgMult * 15 * (sawDef?.damageMult || 0.25);
      enemies.forEach(e => {
        if (Math.hypot(e.x - saw.x, e.y - saw.y) < sawRadius + e.r) {
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
          applyStun(e, wave.stunBase);
          this.applyTriplePulseKnockback(e, wave, 1);
        } else if (d <= wave.r2 + e.r) {
          wave.hitEnemies.add(e);
          this.hitEnemy(e, wave.dmg * (wave.midDamageMult || 0.6), '#9955DD');
          if (e.hp <= 0) return;
          if (wave.midStunMult > 0) applyStun(e, wave.stunBase * wave.midStunMult);
          this.applyTriplePulseKnockback(e, wave, 2);
        } else if (d <= wave.r3 + e.r) {
          wave.hitEnemies.add(e);
          this.hitEnemy(e, wave.dmg * (wave.outerDamageMult || 0.3), '#7733BB');
          if (e.hp <= 0) return;
          if (wave.outerStunMult > 0) applyStun(e, wave.stunBase * wave.outerStunMult);
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
          this._doBossHit(wave.dmg * (wave.midDamageMult || 0.6), '#9955DD');
        } else if (d <= wave.r3 + this.boss.r) {
          wave.hitBoss = true;
          this._doBossHit(wave.dmg * (wave.outerDamageMult || 0.3), '#7733BB');
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
    applyKnockback(e, Math.cos(knockAngle) * strength, Math.sin(knockAngle) * strength, 0.35);
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
    const cascadeDef = getAscensionTierData(this.P, 'emp')?.definition;
    const cascadeR = cascadeDef?.radius || 100;
    const cascadeDmg = this.P.dmg * (cascadeDef?.damageMult || 8);

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
      applyStun(e, cascadeDef?.stun || 1.0);
      e._cascaded = true;
    });
    pruneEnemies();
    playCascadeSound();
  }

  applyArcDischarge(_empBurstDmg) {
    const arcsDrawn = [];
    const arcDef = getAscensionTierData(this.P, 'emp')?.definition;
    const MAX_ARCS_PER_ENEMY = arcDef?.maxArcsPerEnemy || 3;
    const ARC_RANGE = arcDef?.arcRange || 250;
    const MAX_TOTAL_ARCS = arcDef?.maxTotalArcs || 20;
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

        const dmg = target.maxHp * (arcDef?.damageRatio || 0.12);
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
        applyStun(target, arcDef?.stun || 0.5);
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
    const collapseDef = getAscensionTierData(this.P, 'pulse')?.definition;
    const pullRadius = collapseDef?.pullRadius || 180;
    enemies.forEach(e => {
      const dx = x - e.x;
      const dy = y - e.y;
      if (dx * dx + dy * dy > pullRadius * pullRadius) return;
      e._pullTarget = { x, y };
      e._pullTimer = collapseDef?.pullTime || 0.3;
      e._pullSpeed = collapseDef?.pullSpeed || 400;
    });
    addBurst(x, y, '#FFB627', 12, 110, 2.4, 0.28);
    addRing(x, y, pullRadius, 'rgba(255,182,39,0.4)', 1.8, 0.18);
  }

  handlePulseImpact(bullet, x, y) {
    const ascension = getAscension(this.P, 'pulse');
    if (ascension === 'collapsed_round' && !bullet.meta?.isFragment) {
      const collapseDef = getAscensionTierData(this.P, 'pulse')?.definition;
      this._applyCollapsedRoundPull(x, y);
      this.queuePulseExplosion({
        x,
        y,
        dmg: bullet.dmg,
        clusterGen: Math.max(0, bullet.meta?.clusterGen ?? 0),
        delay: collapseDef?.pullTime || 0.3,
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
    const chainDef = getAscensionTierData(this.P, 'pulse')?.definition;
    if (!chainState || chainState.procs >= (chainDef?.maxProcs || 3)) return;
    if (Math.random() >= (chainDef?.procChance || 0.35)) return;
    chainState.procs += 1;
    addRing(cluster.x, cluster.y, 80, '#FF6A2A', 2.8, 0.3);
    addBurst(cluster.x, cluster.y, '#FFE3A0', 10, 200, 2.8, 0.22);
    this.chainFlash = Math.max(this.chainFlash, 0.1);
    const lvl = getWeaponLevel(this.P, 'pulse');
    const procBullet = {
      x: cluster.x,
      y: cluster.y,
      dmg: this.P.dmg * (28 + lvl * 10),
      col: '#FF6A2A',
      meta: {
        type: 'pulse',
        tier: lvl,
        pulseLvl: lvl,
        explosive: true,
        clusterGen: Math.max(0, lvl - 1),
        chainReaction: true,
        glowCol: '#FFE3A0',
        chainProc: true,
        isChainProc: true,
        chainState,
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
    const blastR = mine.blastRadius || 120;
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
      playSurge();
    }
    if (this.surgeActive) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) {
        this.surgeActive = false;
        this.surgeCount++;
      }
    }
    if (this.surgeFlashT > 0) this.surgeFlashT -= dt;
  }

  _updateActiveShields() {
    this._activeShields = enemies
      .filter(e => e.type === 'leech' && e.shieldActive && e.hp > 0)
      .map(leech => ({
        x: leech.x,
        y: leech.y,
        r: leech.shieldR,
        leech,
      }));
  }

  _spawnEnemies(dt) {
    // no spawning during boss intro or while boss is alive
    if (this.bossIntro || (this.boss && this.boss.alive)) return;
    this._st += dt;
    const wave = this.gt < 120
      ? Math.floor(this.gt / 45)
      : Math.floor(3 + (this.gt - 120) / 40);
    const baseRate = Math.max(0.06, 0.9 - this.gt / 110);
    const rate = this.surgeActive ? baseRate * 0.3 : baseRate;
    if (this._st >= rate) {
      this._st = 0;
      const beforeCount = enemies.length;
      const batch = this.surgeActive ? Math.ceil(1 + wave * 0.5) : 1;
      for (let i = 0; i < batch; i++) spawnEnemy(this.gt, this.W, this.H, this.camX, this.camY, this.surgeCount);
      for (let i = beforeCount; i < enemies.length; i++) {
        enemies[i]._onImmuneBlocked = target => this.showJuggernautImmuneFx(target);
      }
    }
  }

  updateBossShockwave(dt) {
    if (!this._bossShockwave) return;
    if ((!this.boss || !this.boss.alive) && this._bossShockwave.phase === 'telegraph') {
      this._bossShockwave = null;
      return;
    }
    const sw = this._bossShockwave;

    if (sw.phase === 'telegraph') {
      sw.timer -= dt;
      sw.telegraphR = Math.max(0, (1 - sw.timer / 1.5) * sw.telegraphMaxR);
      addRing(sw.x, sw.y, sw.telegraphR, '#FF4444', 2, 0.05);

      if (sw.timer <= 0) {
        sw.phase = 'fire';
        sw.fireR = 0;
        const dist = Math.hypot(this.P.x - sw.x, this.P.y - sw.y);
        if (dist < 200) {
          const dmg = this.P.maxHp * 0.20;
          this.P.hp = Math.max(1, this.P.hp - dmg);
          this.P.hurtFlash = 1;
          this.P.hpLag = Math.max(this.P.hpLag, this.P.hp + dmg);
          this.setShake(0.3, 26);
          this._screenFlash = { col: '#FF4444', alpha: 0.4, life: 0.3 };
          playPlayerHit();
        }
      }
      return;
    }

    if (sw.phase === 'fire') {
      sw.fireR += 600 * dt;
      addRing(sw.x, sw.y, sw.fireR, '#FFFFFF', 3, 0.1);
      if (sw.fireR > 800) this._bossShockwave = null;
    }
  }

  _updateBoss(dt) {
    const { H } = this;

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
      this.bossActive = false;
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
        this.bossActive = true;
        setExtraTarget(this.boss); // weapons now lock onto boss
      }
      return; // boss not active yet during intro
    }

    // dead boss — show upgrade screen then schedule respawn
    if (this.boss && !this.boss.alive) {
      this.bossActive = false;
      this.bossRespawnT -= dt;
      if (this.bossRespawnT <= 0) {
        this.boss = null;
        this.nextBossTime = this.gt + BOSS_RESPAWN_DELAY;
        this.bossWarned = false;
      }
      return;
    }

    if (!this.boss) {
      this.bossActive = false;
      return;
    }

    updateBoss(this.boss, this.P, dt, {
      onHitPlayer: (dmg) => {
        this.hitPlayer(dmg, 0.32, 30);
      },
      onSpawnBullet: (x, y, vx, vy, r, dmg, col, meta = {}) => {
        bullets.push({ x, y, vx, vy, r, dmg, col, life: meta.life || 3.5, pl: 0, enemy: true, meta });
      },
      onPhaseChange: () => {
        this.setShake(0.72, 40);
        this._bossShockwave = {
          x: this.boss.x,
          y: this.boss.y,
          telegraphR: 0,
          telegraphMaxR: 300,
          phase: 'telegraph',
          timer: 1.5,
          fireR: 0,
        };
        const text = this.boss?.phase === 3 ? '!!! SIGNAL OVERCLOCK !!!' : '!! SIGNAL ENRAGED !!';
        const col = this.boss?.phase === 3 ? '#8A2BE2' : '#D4537E';
        this.addDN(this.P.x, this.P.y - 60, text, col, 2.5, true);
        playBossPhaseTwo();
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
      this._bossShockwave = null;
      clearExtraTarget(); // weapons stop targeting boss
      stopBossMusic();
      playBossDeath();
      this._showBossUpgrade();
    }
  }

  _showBossUpgrade() {
    this.paused = true;
    const pool = buildPool(this.P, { allowAscension: false });
    this.currentUpgradePool = pool;
    const cards = pool.map(u => renderUpgradeCardView(u, this.P, `window.__game.pickBossUpgrade('${u.id}')`)).join('');
    this._showOverlay(`
      <div style="color:#E24B4A;font-size:9px;letter-spacing:3px;margin-bottom:6px">// SIGNAL TERMINATED //</div>
      <div style="font-size:15px;color:#E24B4A;letter-spacing:2px;margin-bottom:4px">BOSS DEFEATED</div>
      <div style="font-size:9px;color:#444;letter-spacing:2px;margin-bottom:18px">choose your reward</div>
      <div class="upg-grid">${cards}</div>`, 'levelup-screen');
  }

  pickBossUpgrade(id) {
    applyUpgrade(id, this.P);
    this.currentUpgradePool = [];
    this._hideOverlayNow();
    this.paused = false;
    if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }
  }

  pickAscension(weaponId, ascensionId, pickedCard = null) {
    playUISelect();
    const overlay = document.getElementById('overlay');
    const allCards = [...document.querySelectorAll('.asc-card')];
    const otherCards = allCards.filter(card => card !== pickedCard);
    if (pickedCard) pickedCard.style.transform = 'scale(1.05)';
    otherCards.forEach(card => { card.style.opacity = '0'; });
    setTimeout(() => {
      playUIClose();
      const token = this._prepareOverlayShow();
      if (overlay) overlay.style.animation = 'fadeOut 0.3s ease forwards';
      this._overlayHideTimeout = setTimeout(() => {
        if (token !== this._overlayToken) return;
        applyAscension(this.P, weaponId, ascensionId);
        this.currentUpgradePool = [];
        this._hideOverlayNow();
        this.paused = false;
        if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }
      }, 300);
    }, 200);
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
        const fireResult = w.fire.call(this, P, onHit, {
          addText: (...args) => this.addDN(...args),
          triggerSynergy: (id) => this.triggerSynergy(id),
        });
        if (wid === 'emp' && empPreStun) {
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
        if (wid === 'cryo' && !hasAscension(P, 'cryo', 'frost_field') && !fireResult?.suppressDefaultSound) {
          if (hasAscension(P, 'cryo', 'permafrost')) playPermafrostFire();
          else playCryoFire();
        }
        else if (wid === 'pulse') playPulseFire();
        else if (wid === 'emp' && empAscension !== 'triple_pulse') playEMPSound();
      }
      w.tick?.(P, dt, onHit, {
        enemies,
        addParticle: (...args) => addRing(...args),
        applyFreezeMeter: (target, amount) => applyFreezeMeter(target, amount),
        onTickDamage: (target, dmg, col) => this.hitEnemy(target, dmg, col, false, 0, true),
        triggerSynergy: (id) => this.triggerSynergy(id),
        onNovaDroneKill: (x, y, killedEnemy, options) => this.handleNovaDroneKill(x, y, killedEnemy, options),
        onNovaDroneExpire: (x, y) => this.handleNovaDroneExpire(x, y),
        onFrenzyStart: () => playFrenzySound(),
        spawnSplitDrone: (player, parentDrone, targetEnemy, orbitR) => this.spawnSplitDrone(player, parentDrone, targetEnemy, orbitR),
        onShieldBreak: (player, tier) => this._breakShield(player, tier),
        onShieldRestore: (player) => this._restoreShield(player),
      });
    });
    this.bossActive = !!this.boss?.alive;
  }

  _triggerCryoStorm(enemy) {
    if (!hasAscension(this.P, 'cryo', 'cryo_storm')) return;
    if (!enemy?.frozen) return;

    this._spawnCryoStormShards(enemy.x, enemy.y);
    addBurst(enemy.x, enemy.y, '#B8F7FF', 8, 85, 2.6, 0.24);
    addRing(enemy.x, enemy.y, 24, '#00CFFF', 1.6, 0.18);
    if (!this._cryoStormSoundPlayedThisFrame) {
      playCryoStormSound();
      this._cryoStormSoundPlayedThisFrame = true;
    }
  }

  _spawnCryoStormShards(x, y) {
    const stormDef = getAscensionTierData(this.P, 'cryo')?.definition;
    const shardCount = stormDef?.shardCount || 8;
    for (let i = 0; i < shardCount; i++) {
      const angle = (Math.PI * 2 * i) / shardCount;
      spawnBullet(
        x,
        y,
        Math.cos(angle) * 280,
        Math.sin(angle) * 280,
        4,
        this.P.dmg * (stormDef?.shardDamageMult || 3),
        '#AAFFFF',
        0.8,
        {
          type: 'cryo',
          tier: 5,
          cryoLevel: 1,
          pierce: stormDef?.shardPierce || 0,
          isCryoShard: true,
          freezeAmount: stormDef?.shardFreeze || 0.8,
          angle
        }
      );
    }
  }

  _maybeApplyShatter(enemy) {
    if (!hasAscension(this.P, 'cryo', 'shatter')) return false;
    if (!enemy?.frozen || enemy.isBoss) return false;
    const shatterDef = getAscensionTierData(this.P, 'cryo')?.definition;
    const frozenDuration = Math.max(enemy.frozenDuration || 1.5, 0.001);
    const freezeRatio = Math.max(0, Math.min(1, (enemy.frozenTimer || 0) / frozenDuration));
    const maxChance = shatterDef?.maxChance || 0.25;
    const chance = maxChance * freezeRatio;
    if (Math.random() >= chance) return false;

    enemy.hp = 0;
    enemy.shattered = true;
    this.addDN(enemy.x, enemy.y - enemy.r, 'SHATTER', '#FFFFFF', 0.85, true);
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
      if (b.meta?.isCryoShard) addDot(b.x, b.y, 'rgba(184,247,255,0.55)', 3.6, 0.2);
      else if (b.meta?.isCryoOverload) {
        addDot(b.x, b.y, 'rgba(255,246,184,0.75)', 5.6, 0.22);
        addDot(b.x - b.vx * 0.012, b.y - b.vy * 0.012, 'rgba(255,205,92,0.42)', 3.8, 0.18);
      }
      else if (b.meta?.type === 'cryo' && hasAscension(this.P, 'cryo', 'cryo_storm')) {
        addDot(b.x, b.y, 'rgba(220,250,255,0.45)', 3.2, 0.18);
      } else if (b.meta?.type === 'cryo') addDot(b.x, b.y, b.meta?.projectileColor === '#007DCC' ? 'rgba(0,125,204,0.36)' : b.meta?.projectileColor === '#00B4FF' ? 'rgba(0,180,255,0.32)' : '#00CFFF44', 2.8, 0.16);

      let alive = true;

      // hit boss
      const hitBossByCircle = this.boss?.alive && dist2(b, this.boss) < (b.r + this.boss.r) ** 2;
      if (this.boss?.alive && this._canBulletHitTarget(b, 'boss', dt) && hitBossByCircle) {
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
          const hitByCircle = dist2(b, e) < (b.r + e.r) ** 2;
          if (hitByCircle) {
            let dmg = b.dmg;
            if (b.meta?.type === 'pulse') dmg = getPulseHitDamage(b, dmg);
            this.hitEnemy(e, dmg, b.col, false, null, false, true);
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
      if (!e || e.hp <= 0) return;
      updateEnemyFreezeState(e, dt, P);
      tickEnemyStatus(e, dt);

      // Emit particle trails for frozen enemies
      if (e.frozen) {
        if (e._freezeParticleTimer === undefined) e._freezeParticleTimer = 0;
        e._freezeParticleTimer++;
        if (e._freezeParticleTimer >= 3) {
          addFrostTrail(e.x, e.y);
          e._freezeParticleTimer = 0;
        }
      } else {
        e._freezeParticleTimer = 0;
      }

      // Emit particle trails for stunned enemies
      if (e.stunned && e.stunT > 0) {
        if (e._stunParticleTimer === undefined) e._stunParticleTimer = 0;
        e._stunParticleTimer++;
        if (e._stunParticleTimer >= 2) {
          addStunAura(e.x, e.y);
          e._stunParticleTimer = 0;
        }
      } else {
        e._stunParticleTimer = 0;
      }

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
          applySlow(e, 0.3, 0.4);
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

      if (e.type === 'leech') {
        let nearestEnemy = null;
        let nearestDist = Infinity;
        enemies.forEach(other => {
          if (other === e || other.type === 'leech' || other.hp <= 0) return;
          const d = Math.hypot(other.x - e.x, other.y - e.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = other;
          }
        });

        const target = nearestEnemy || P;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const m = e.slowT > 0 ? (e.spdMult || 0.45) : 1;
        e.x += dx / d * e.spd * m * dt;
        e.y += dy / d * e.spd * m * dt;
        e.x = cl(e.x, e.r, WORLD_W - e.r);
        e.y = cl(e.y, e.r, WORLD_H - e.r);
        if (Math.hypot(P.x - e.x, P.y - e.y) < e.r + P.r && P.invT <= 0) {
          this.hitPlayer(e.dmg, 0.28, 26);
        }
        return;
      }

      const m = e.slowT > 0 ? (e.spdMult || 0.45) : 1;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += dx / d * e.spd * m * dt;
      e.y += dy / d * e.spd * m * dt;
      if (d < e.r + P.r && P.invT <= 0) {
        this.hitPlayer(e.dmg, 0.28, 26);
      }
    });
    pruneEnemies();
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
      const collectRadius = P.r + item.r;
      let dx = P.x - item.x;
      let dy = P.y - item.y;
      let d = Math.sqrt(dx * dx + dy * dy);

      if (!item.magnetizing && d < P.mag) {
        item.magnetizing = true;
        item.magnetizeTime = 0;
        item.magnetizeDuration = 0.25;
        item.magnetSpeed = Math.max(220, P.spd * 0.95);
      }

      if (item.magnetizing) {
        item.magnetizeTime += dt;
        item.magnetSpeed = Math.min((item.magnetSpeed || 220) + 1200 * dt, 1400);
        if (d <= collectRadius) {
          onCollect(item);
          return false;
        }

        const step = Math.min(d, item.magnetSpeed * dt);
        if (d > 0) {
          item.x += (dx / d) * step;
          item.y += (dy / d) * step;
        }

        dx = P.x - item.x;
        dy = P.y - item.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d <= collectRadius) {
          onCollect(item);
          return false;
        }
      } else if (d <= collectRadius) {
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

  showJuggernautImmuneFx(target) {
    if (!target || target.type !== 'juggernaut') return;
    addRing(target.x, target.y, target.r + 15, '#FF6600', 3, 0.3);
    addBurst(target.x, target.y, '#FF8800', 6, 60, 2, 0.3);
    this.addDN(target.x, target.y - target.r - 10, 'IMMUNE', '#FF6600', 0.6, true);
  }

  getShieldFor(target) {
    return this._activeShields?.find(shield =>
      shield.leech?.shieldActive &&
      shield.leech.hp > 0 &&
      shield.leech !== target &&
      Math.hypot(target.x - shield.x, target.y - shield.y) < shield.r
    ) || null;
  }

  popLeechShield(leech) {
    if (!leech?.shieldActive || leech._shieldPopped) return;
    leech.shieldActive = false;
    leech.shieldHp = 0;
    leech._shieldPopped = true;
    addBurst(leech.x, leech.y, '#44FF88', 16, 120, 4, 0.5);
    addRing(leech.x, leech.y, 80, '#44FF88', 2.5, 0.4);
    this.addXp(10);
    this.addDN(leech.x, leech.y - leech.r - 10, 'SHIELD BROKEN', '#44FF88', 1.1, true);
  }

  hitEnemy(e, dmg, col, isSynergy = false, minHpFloor = null, silent = false, directHit = false) {
    if (this.P.char === 'bruiser' && this.P.hp < this.P.maxHp * 0.5) dmg *= 1.35;
    if (this._maybeApplyShatter(e)) dmg = 0;

    if (e.type === 'leech' && e.shieldActive) {
      const shieldDmg = directHit ? dmg * 2 : dmg;
      e.shieldHp -= shieldDmg;
      e.hitFlash = 0.1;
      e.hpBarVisT = 2.0;
      if (!silent) addBurst(e.x, e.y, e.shieldCol || '#44FF88', isSynergy ? 6 : 3, isSynergy ? 90 : 60, 2.5, 0.32);
      if (!silent && shieldDmg > 0) this.addDN(e.x, e.y - e.r, Math.round(shieldDmg), e.shieldCol || '#44FF88', 0.7, isSynergy);
      if (!silent) {
        const now = performance.now();
        if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
      }
      if (e.shieldHp <= 0) this.popLeechShield(e);
      return { killed: false, target: e, damage: 0 };
    }

    const shield = this.getShieldFor(e);
    if (shield) {
      shield.leech.shieldHp -= dmg * 0.70;
      if (shield.leech.shieldHp <= 0) this.popLeechShield(shield.leech);
      dmg *= 0.30;
    }

    if (minHpFloor != null) {
      const floor = Math.max(0, minHpFloor);
      if (e.hp - dmg < floor) dmg = Math.max(0, e.hp - floor);
    }
    e.hp -= dmg;
    if (e.hp <= 0.001) e.hp = 0;
    e.hitFlash = 0.1;
    e.hpBarVisT = 2.0;
    const numCol = isSynergy ? '#FFB627' : col === '#00CFFF' ? '#00CFFF' : col === '#BF77FF' ? '#BF77FF' : col === '#FF2D9B' ? '#FF2D9B' : '#fff';
    if (!silent && dmg > 0) this.addDN(e.x, e.y - e.r, Math.round(dmg), numCol, 0.7, isSynergy);
    if (!silent) addBurst(e.x, e.y, col, isSynergy ? 6 : 3, isSynergy ? 90 : 60, 2.5, 0.32);
    if (!silent) {
      const now = performance.now();
      if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
    }
    if (e.hp <= 0) {
      this.killCount++;
      this.killsByType[e.type]++;
      const xpVal = (this.P.char === 'hacker' && e.stunned) ? e.xp * 2 : e.xp;
      if (e.frozen) this._triggerCryoStorm(e);
      e.permafrost = false;
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
    bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 5, dmg: e.projectileDmg || 12.5, col: '#FFB627', life: 4, pl: 0, enemy: true, meta: {} });
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
    this.unpause();
    this.paused = true;
    playLevelUp();
    playUIOpen();
    const pool = buildPool(this.P);
    this.currentUpgradePool = pool;
    const cards = pool.map(u => renderUpgradeCardView(u, this.P, `window.__game.pickUpgrade('${u.id}', this)`)).join('');

    // Build current loadout summary
    const ownedIds = getOwnedWeaponIds(this.P);
    const loadoutItems = [];
    for (let i = 0; i < 4; i++) {
      if (ownedIds[i]) {
        const w = WDEFS[ownedIds[i]];
        const lvl = getWeaponLevel(this.P, ownedIds[i]);
        loadoutItems.push(`<span style="color:${w.col}">${w.icon} ${w.name} L${lvl}</span>`);
      } else {
        loadoutItems.push(`<span style="color:#282828">EMPTY</span>`);
      }
    }
    const loadoutSummary = `<div style="font-size:10px;color:#aaa;letter-spacing:2px;margin-bottom:16px">CURRENT: ${loadoutItems.join(' · ')}</div>`;

    this._showOverlay(`
      <div style="color:#444;font-size:9px;letter-spacing:3px;margin-bottom:6px">// SYSTEM UPGRADE //</div>
      <div style="font-size:15px;color:#BF77FF;letter-spacing:2px;margin-bottom:4px">LEVEL ${this.P.level} — CHOOSE ONE</div>
      <div style="font-size:9px;color:#444;letter-spacing:2px;margin-bottom:18px">weapon + passive choices every level</div>
      ${loadoutSummary}
      <div class="upg-grid">${cards}</div>`, 'levelup-screen');
  }

  pickUpgrade(id, pickedCard = null) {
    playUISelect();
    const cards = document.querySelectorAll('.uc');
    cards.forEach(card => {
      const cardId = card.dataset.upgradeId;
      card.classList.remove('selected', 'dismissed');
      if ((pickedCard && card === pickedCard) || cardId === id) card.classList.add('selected');
      else card.classList.add('dismissed');
    });

    if (id.startsWith('asc_')) {
      const wid = id.slice(4);
      const ascensionOptions = this.currentUpgradePool.find(option => option.id === id)?.options || [];
      if (ascensionOptions.length) {
        this._screenFlash = { col: '#FFFFFF', alpha: 0.6, life: 0.3 };
        setTimeout(() => {
          this._prepareOverlayShow();
          showAscensionDraft(wid, ascensionOptions, (ascensionId, pickedAscensionCard) => {
            this.pickAscension(wid, ascensionId, pickedAscensionCard);
          });
          playAscensionOpen();
        }, 120);
        return;
      }
    }

    applyUpgrade(id, this.P);
    this.currentUpgradePool = [];
    this.unpause();
    if (this.P.xp >= this.P.xpNext) { const v = this.P.xp; this.P.xp = 0; this.addXp(v); }

    const token = this._overlayToken;
    this._clearOverlayTimers();
    this._overlayFadeTimeout = setTimeout(() => {
      if (token !== this._overlayToken) return;
      const overlay = document.getElementById('overlay');
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.15s ease';
        this._overlayHideTimeout = setTimeout(() => {
          if (token !== this._overlayToken) return;
          this._hideOverlayNow();
        }, 150);
      }
    }, 120);
  }

  endGame() {
    this.running = false;
    this.unpause();
    this.paused = true;
    this.setPlaytestToggleVisible(false);
    document.getElementById('pause-btn')?.style.setProperty('display', 'none');
    stopBossMusic();
    this._screenFlash = { col: '#FFFFFF', alpha: 0.8, life: 0.15, maxLife: 0.15 };
    this.shake.t = 0.5;
    playDeathSound();
    const recordSummary = recordRun(this.P.char, {
      time: this.gt,
      kills: this.killCount,
      level: this.P.level,
    });
    const char = CHARACTERS[this.P.char] || this.getSelectedCharacter();
    const save = getSave();
    const charBest = save?.personalBests?.perCharacter?.[this.P.char];
    const isNewTimeBest = recordSummary.newGlobalBests.includes('bestTime') || recordSummary.newCharBests.includes('bestTime');
    const isNewKillBest = recordSummary.newGlobalBests.includes('mostKills') || recordSummary.newCharBests.includes('mostKills');
    const timeStr = formatRunTimeView(this.gt);
    const surgeCount = this.surgeCount;
    const runRatingTier = getRatingTier(this.gt);
    const runRatingColor = RATING_COLORS[runRatingTier];

    // Store death info for later display
    this._lastDeathInfo = {
      char, isNewTimeBest, isNewKillBest, timeStr, surgeCount,
      runRatingTier, runRatingColor,
      charBest
    };

    setTimeout(() => {
      document.getElementById('death-vignette')?.classList.add('active');
    }, 150);
    setTimeout(() => {
      this.showYouDiedScreen();
    }, 600);
  }

  showYouDiedScreen() {
    const info = this._lastDeathInfo;
    window.__game_showDeathStats = () => {
      playUIClick();
      this.showFullDeathStats();
    };
    window.__game_returnToMenu = () => {
      playUIClick();
      this.returnToMenu();
    };

    const youDiedHTML = `
      <div class="death-shell" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:60px 40px">
        <div style="text-align:center">
          <div class="death-title glitch-text" style="font-size:64px;margin-bottom:24px">YOU DIED</div>
          <div class="death-char-name" style="color:${info.char.col};font-size:28px;margin-bottom:32px">${info.char.name}</div>
          <div style="font-size:48px;letter-spacing:4px;margin-bottom:16px;color:${info.runRatingColor};font-weight:bold">${info.runRatingTier}</div>
          <div style="font-size:14px;color:#888;letter-spacing:2px;margin-bottom:32px">SURVIVAL TIME: ${info.timeStr}</div>
        </div>

        <div class="menu-actions" style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:300px">
          <button class="btn ui-btn-press" onclick="window.__game_showDeathStats()">VIEW STATS</button>
          <button class="btn btn-secondary ui-btn-press" onclick="window.__game_returnToMenu()">MAIN MENU</button>
        </div>
      </div>
    `;
    this._showOverlay(youDiedHTML, 'death-screen you-died-screen');
  }

  showFullDeathStats() {
    const info = this._lastDeathInfo;
    const { char, isNewTimeBest, isNewKillBest, timeStr, surgeCount, runRatingTier, runRatingColor, charBest } = info;

    const allWeaponSlots = [];
    for (let i = 0; i < 4; i++) {
      const wid = this.P.ws[i];
      if (wid) {
        const weapon = WDEFS[wid];
        const lvl = getWeaponLevel(this.P, wid);
        const asc = this.P.ascensions?.[wid];
        const ascTier = asc ? getAscensionTier(this.P, wid) : 0;
        const dots = '●'.repeat(lvl) + '○'.repeat(5 - lvl);
        allWeaponSlots.push(`<div class="death-weapon-row">
          <span style="color:${weapon.col}">${weapon.icon} ${weapon.name}</span>
          <span class="death-weapon-dots" style="color:${weapon.col}">${dots}</span>
          ${asc ? `<span class="death-asc-tag">ASC T${ascTier}: ${asc.toUpperCase().replace(/_/g, ' ')}</span>` : ''}
        </div>`);
      } else {
        allWeaponSlots.push(`<div class="death-weapon-row" style="opacity:0.5">
          <span style="color:#444">? ---</span>
        </div>`);
      }
    }
    const weaponsHtml = allWeaponSlots.join('');
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
    const encountersHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:11px;font-family:Courier New,monospace;letter-spacing:1px">
        <div><span style="color:#888">RUNNERS</span><br><strong style="color:#E24B4A">${this.killsByType.runner}</strong></div>
        <div><span style="color:#888">SHOOTERS</span><br><strong style="color:#FFB627">${this.killsByType.shooter}</strong></div>
        <div><span style="color:#888">BRUTES</span><br><strong style="color:#D4537E">${this.killsByType.brute}</strong></div>
        <div><span style="color:#888">TITANS</span><br><strong style="color:#8B0000">${this.killsByType.titan}</strong></div>
        <div><span style="color:#888">JUGGERNAUTS</span><br><strong style="color:#FF6600">${this.killsByType.juggernaut}</strong></div>
        <div><span style="color:#888">SHIELD LEECHES</span><br><strong style="color:#1A6B3A">${this.killsByType.leech}</strong></div>
      </div>
    `;

    window.__game_restartAfterStats = () => {
      playUIClick();
      this.restartAfterDeath();
    };
    window.__game_returnToMenuFromStats = () => {
      playUIClick();
      this.returnToMenu();
    };

    const deathHTML = `
      <div class="death-shell">
        <div class="death-title glitch-text">FLATLINED</div>
        <div class="death-char-name" style="color:${char.col}">${char.name}</div>

        <div class="death-stats-wrap">
          <div class="death-stat">
            TIME &nbsp;
            <span class="${isNewTimeBest ? 'new-best' : ''}">${timeStr}</span>
            <span style="color:${runRatingColor};font-size:10px;letter-spacing:1px;margin-left:8px">[${runRatingTier}]</span>
            ${isNewTimeBest ? '<span class="best-tag">★ BEST</span>' : ''}
            ${charBest?.bestTime ? `<span class="prev-best">PB ${formatRunTimeView(charBest.bestTime)}</span>` : ''}
          </div>
          <div class="death-stat">
            KILLS &nbsp;
            <span class="${isNewKillBest ? 'new-best' : ''}">${this.killCount}</span>
            ${isNewKillBest ? '<span class="best-tag">★ BEST</span>' : ''}
            ${charBest?.mostKills ? `<span class="prev-best">PB ${charBest.mostKills}</span>` : ''}
          </div>
          <div class="death-stat">LEVEL &nbsp;<span>${this.P.level}</span></div>
          <div class="death-stat">WAVE &nbsp;<span>${surgeCount}</span></div>
        </div>

        <div class="death-divider">// LOADOUT //</div>
        <div class="death-weapons">${weaponsHtml || '<div class="death-empty">- none -</div>'}</div>

        <div class="death-divider">// ENCOUNTERS //</div>
        <div class="death-encounters">${encountersHtml}</div>

        <div class="death-divider">// SYNERGIES //</div>
        <div class="death-synergies">${synergiesHtml}</div>

        <div class="death-buttons menu-actions">
          <button class="btn ui-btn-press" onclick="window.__game_restartAfterStats()">${this.playtestMode ? 'RESTART TEST' : 'RUN AGAIN'}</button>
          <button class="btn btn-secondary ui-btn-press" onclick="window.__game_returnToMenuFromStats()">MENU</button>
        </div>
      </div>
    `;
    this._showOverlay(deathHTML, 'death-screen');
  }

  showMainMenu() {
    this.running = false;
    this.unpause();
    this.setPlaytestToggleVisible(false);
    document.getElementById('pause-btn')?.style.setProperty('display', 'none');
    stopBossMusic();
    this.menuBg?.start();
    this._showOverlay(`
      <div class="menu-shell">
        <div id="menu-splash">
          <div id="menu-title-wrap">
            <div id="menu-title-line1">INFINITE</div>
            <div id="menu-title-line2">ROGUE</div>
            <div id="menu-tagline">// cyberpunk survivor //</div>
          </div>
          <div id="menu-options">
            <button class="menu-btn ui-btn-press" id="btn-start-game" onclick="window.__game.openCharacterSelectFromMenu()">START GAME</button>
            <button class="menu-btn ui-btn-press secondary" id="btn-records" onclick="window.__game.openRecordsFromMenu()">RECORDS</button>
            <button class="menu-btn ui-btn-press lab" id="btn-lab" onclick="window.__game.openPlaytestLabFromMenu()">// PLAYTEST LAB //</button>
          </div>
        </div>
        <div id="menu-charselect">
          <div class="menu-back-btn ui-btn-press" id="btn-back" onclick="window.__game.backToMenuSplash()">← BACK</div>
          <div class="menu-section-title">SELECT OPERATIVE</div>
          <div id="char-cards-wrap">${this.renderCharacterSelectCards()}</div>
          <button class="menu-btn ui-btn-press" id="start-btn" onclick="window.__game.jackIn()">JACK IN</button>
        </div>
      </div>`, 'main-menu');
    this.syncCharacterSelectUI();
  }

  showStart() {
    this.showMainMenu();
  }

  openRecords() {
    this._prepareOverlayShow();
    showRecordsScreen(() => this.showMainMenu());
  }

  openRecordsFromMenu() {
    playUIOpen();
    this.openRecords();
  }

  openPlaytestLabFromMenu() {
    playUIClick();
    this.openPlaytestLab();
  }

  renderCharacterSelectCards() {
    return Object.values(CHARACTERS).map(c => {
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
      return `<button class="char-card ui-btn-press" data-char-id="${c.id}" onclick="window.__game.selectCharacter('${c.id}')">
        <div class="char-card-top">
          <span class="char-sigil" style="color:${c.col}">◆</span>
          <span class="char-name">${c.name}</span>
          <span class="char-tag">READY</span>
        </div>
        <div class="char-compact-row">
          <span class="char-weapon" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</span>
          <span class="char-speed">SPD ${c.spd}</span>
        </div>
        <div class="char-inline-meta">
          <div class="char-inline-line"><span>PASSIVE</span><strong>${passiveLabel}</strong></div>
          <div class="char-inline-line"><span>EFFECT</span><strong>${passiveValue}</strong></div>
          <div class="char-inline-copy">${passiveCopy}</div>
        </div>
      </button>`;
    }).join('');
  }

  syncCharacterSelectUI() {
    const selectedId = this.menuSelectedCharId;
    document.querySelectorAll('.char-card').forEach(card => {
      const id = card.dataset.charId;
      const tag = card.querySelector('.char-tag');
      card.classList.remove('selected', 'unselected');
      if (!selectedId) {
        if (tag) tag.textContent = 'READY';
        return;
      }
      if (id === selectedId) {
        card.classList.add('selected');
        if (tag) tag.textContent = 'SELECTED';
      } else {
        card.classList.add('unselected');
        if (tag) tag.textContent = 'READY';
      }
    });
    const btn = document.getElementById('start-btn');
    if (btn) btn.classList.toggle('visible', !!selectedId);
  }

  openCharacterSelectFromMenu() {
    playUIOpen();
    const splash = document.getElementById('menu-splash');
    const charselect = document.getElementById('menu-charselect');
    if (!splash || !charselect) return;
    splash.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => {
      splash.style.display = 'none';
      splash.style.animation = '';
      charselect.style.display = 'flex';
      charselect.style.animation = 'fadeIn 0.25s ease forwards';
      this.syncCharacterSelectUI();
    }, 200);
  }

  backToMenuSplash() {
    playUIClose();
    const splash = document.getElementById('menu-splash');
    const charselect = document.getElementById('menu-charselect');
    if (!splash || !charselect) return;
    charselect.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => {
      charselect.style.display = 'none';
      charselect.style.animation = '';
      splash.style.display = 'flex';
      splash.style.animation = 'fadeIn 0.25s ease forwards';
    }, 200);
  }

  jackIn() {
    if (!this.menuSelectedCharId) return;
    playUIClick();
    const transition = document.getElementById('screen-transition');
    transition?.classList.add('fade-in');
    setTimeout(() => {
      this._hideOverlayNow();
      this.newRun(this.getSelectedCharacter());
      setTimeout(() => {
        transition?.classList.remove('fade-in');
      }, 100);
    }, 350);
  }

  restartAfterDeath() {
    playUIClick();
    if (this.playtestMode) this.restartPlaytestRun();
    else this.newRun(this.getSelectedCharacter());
  }

  returnToMenuFromOverlay() {
    playUIClick();
    this.showMainMenu();
  }

  returnToMenu() {
    this.running = false;
    this._hideOverlayNow();
    this.showMainMenu();
  }

  getSelectedCharacter() {
    return CHARACTERS[this.selectedCharId] || CHARACTERS.ghost;
  }

  selectCharacter(id) {
    if (!CHARACTERS[id]) return;
    this.selectedCharId = id;
    this.menuSelectedCharId = id;
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, CHARACTERS[id]);
    this.syncCharacterSelectUI();
    playUISelect();
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
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    this.syncPlaytestLabState();
    if (this.running) this.paused = true;
    this._showOverlay(renderPlaytestLabView(this.playtestBuild, char, this.running, this.getPlaytestWorldDebug(), this.playtestLabState), 'playtest-screen');
    this.initPlaytestLabControls();
  }

  getPlaytestWorldDebug() {
    const player = this.running && this.P ? this.P : buildPreviewPlaytestPlayer(this.getSelectedCharacter(), this.playtestBuild);
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
    this._hideOverlayNow();
    if (this.running) this.paused = false;
    else this.showMainMenu();
  }

  resetPlaytestBuild() {
    this.playtestBuild = makePlaytestBuild(this.getSelectedCharacter());
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
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    const min = 0;
    const current = this.playtestBuild.weapons[wid] || 0;
    this.playtestBuild.weapons[wid] = cl(Math.round(current + delta), min, 5);
    if (this.playtestBuild.weapons[wid] < 5) {
      this.playtestBuild.ascensions[wid] = null;
      this.playtestBuild.ascensionTiers[wid] = 0;
    }
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  playtestAdjustPassive(pid, delta) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    const current = this.playtestBuild.passives[pid] || 0;
    this.playtestBuild.passives[pid] = cl(Math.round(current + delta), 0, 8);
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  playtestSetAscension(wid, ascensionId) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    if ((this.playtestBuild.weapons[wid] || 0) < 5) return;
    this.playtestBuild.ascensions[wid] = ascensionId;
    this.playtestBuild.ascensionTiers[wid] = ascensionId ? 1 : 0;
    if (this.running && this.playtestMode) this._applyPlaytestBuildToPlayer();
    this.openPlaytestLab();
  }

  playtestSetAscensionTier(wid, delta) {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    if (!this.playtestBuild.ascensions?.[wid]) return;
    const current = this.playtestBuild.ascensionTiers?.[wid] || 1;
    this.playtestBuild.ascensionTiers[wid] = cl(current + delta, 1, 5);
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
    Object.keys(next.ws).forEach(wid => {
      next.ws[wid] = mkWeaponState();
    });

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
      applyAscensionTier(next, wid, this.playtestBuild.ascensionTiers?.[wid] || 1);
    });

    next.hp = next.maxHp;
    next.hpLag = next.maxHp;
    next._arcDiscs = [];
    next._sawBlade = null;
    next._cryoOverloadCounter = 0;
    this.P = next;
    this.cryoFields = [];
    this.barrierHealFx = [];
    resetBullets();
    resetPulseClusters();
    clearExtraTarget();
    if (this.boss?.alive) setExtraTarget(this.boss);
    this.updateCamera();
  }

  syncPlaytestLabState() {
    const char = this.getSelectedCharacter();
    this.playtestBuild = sanitizePlaytestBuildView(this.playtestBuild, char);
    if (!this.playtestLabState) this.playtestLabState = makePlaytestLabState();

    Object.keys(LAB_WEAPON_INPUT_CONFIG).forEach(wid => {
      this.playtestLabState.weapons[wid] = this.playtestBuild?.weapons?.[wid] || 0;
    });
    Object.keys(LAB_PASSIVE_INPUT_CONFIG).forEach(pid => {
      this.playtestLabState.passives[pid] = this.playtestBuild?.passives?.[pid] || 0;
    });

    if (this.running && this.P) {
      this.playtestLabState.timeSkipSeconds = Math.max(0, Math.floor(this.gt));
      this.playtestLabState.surgeCount = Math.max(0, this.surgeCount || 0);
      Object.keys(LAB_WEAPON_INPUT_CONFIG).forEach(wid => {
        this.playtestLabState.weapons[wid] = getWeaponLevel(this.P, wid);
      });
      this.playtestLabState.stats.hp = Math.max(1, Math.round(this.P.maxHp || 100));
      this.playtestLabState.stats.level = Math.max(1, Math.round(this.P.level || 1));
      return;
    }

    const preview = buildPreviewPlaytestPlayer(char, this.playtestBuild);
    this.playtestLabState.timeSkipSeconds = 0;
    this.playtestLabState.surgeCount = 0;
    this.playtestLabState.stats.hp = Math.max(1, Math.round(preview.maxHp || 100));
    this.playtestLabState.stats.level = Math.max(1, Math.round(preview.level || 1));
  }

  initPlaytestLabControls() {
    const bindClick = (id, handler) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', handler);
    };

    bindClick('lab-apply-time', () => this.applyPlaytestTimeSkip());
    bindClick('lab-apply-loadout', () => this.applyPlaytestLoadout());
    bindClick('lab-preset-lategame', () => this.applyPlaytestPreset('lategame'));
    bindClick('lab-preset-bosstest', () => this.applyPlaytestPreset('bosstest'));
    bindClick('lab-preset-maxweapon', () => this.applyPlaytestPreset('maxweapon'));
  }

  getLabNumberValue(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const value = parseInt(el.value, 10);
    return Number.isFinite(value) ? value : fallback;
  }

  readPlaytestLabInputs() {
    const state = makePlaytestLabState();
    state.timeSkipSeconds = cl(this.getLabNumberValue('lab-timeskip', this.playtestLabState?.timeSkipSeconds || 0), 0, 600);
    state.surgeCount = cl(this.getLabNumberValue('lab-surgecount', this.playtestLabState?.surgeCount || 0), 0, 10);

    Object.entries(LAB_WEAPON_INPUT_CONFIG).forEach(([wid, config]) => {
      state.weapons[wid] = cl(this.getLabNumberValue(config.inputId, 0), config.min, config.max);
    });
    Object.entries(LAB_PASSIVE_INPUT_CONFIG).forEach(([pid, config]) => {
      state.passives[pid] = cl(this.getLabNumberValue(config.inputId, 0), config.min, config.max);
    });

    state.stats.hp = cl(this.getLabNumberValue('lab-stat-hp', this.playtestLabState?.stats?.hp || 100), 1, 999);
    state.stats.level = cl(this.getLabNumberValue('lab-stat-level', this.playtestLabState?.stats?.level || 1), 1, 50);
    this.playtestLabState = state;
    return state;
  }

  ensurePlaytestRunActive() {
    if (this.running) return true;
    alert('Start a run first');
    return false;
  }

  applyPlaytestTimeSkip() {
    if (!this.ensurePlaytestRunActive()) return;
    const state = this.readPlaytestLabInputs();
    const targetTime = state.timeSkipSeconds;
    const surgeOverride = state.surgeCount;

    this.gt = targetTime;
    this.surgeCount = surgeOverride;
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.surgeFlashT = 0;
    this.nextSurge = getPlaytestNextSurgeTime(targetTime);
    resetEnemies();
    this.clearEnemyBullets();
    this._activeShields = [];
    this._st = 999;

    if (!this.bossIntro && !(this.boss && this.boss.alive)) {
      this.boss = null;
      this.bossActive = false;
      this.bossRespawnT = 0;
      this.bossWarned = false;
      this.nextBossTime = getPlaytestLabNextBossTime(targetTime);
      clearExtraTarget();
    }

    updateHUD(this.P, this.gt, WDEFS);
    this.openPlaytestLab();
  }

  applyPlaytestLoadout() {
    if (!this.ensurePlaytestRunActive()) return;
    const state = this.readPlaytestLabInputs();
    const char = this.getSelectedCharacter();
    const requestedWeapons = Object.entries(state.weapons)
      .filter(([, lvl]) => lvl > 0)
      .slice(0, 4);
    const allowedWeaponIds = new Set(requestedWeapons.map(([wid]) => wid));

    const nextBuild = {
      ...this.playtestBuild,
      weapons: {},
      passives: { ...state.passives },
      ascensions: { ...(this.playtestBuild?.ascensions || {}) },
      ascensionTiers: { ...(this.playtestBuild?.ascensionTiers || {}) },
    };

    Object.keys(LAB_WEAPON_INPUT_CONFIG).forEach(wid => {
      nextBuild.weapons[wid] = allowedWeaponIds.has(wid) ? state.weapons[wid] : 0;
      if (nextBuild.weapons[wid] < 5) {
        nextBuild.ascensions[wid] = null;
        nextBuild.ascensionTiers[wid] = 0;
      }
    });

    this.playtestBuild = sanitizePlaytestBuildView(nextBuild, char);
    this._applyPlaytestBuildToPlayer();

    const hpOverride = cl(state.stats.hp, 1, 999);
    const levelOverride = cl(state.stats.level, 1, 50);
    this.P.maxHp = hpOverride;
    this.P.hp = hpOverride;
    this.P.hpLag = hpOverride;
    this.P.level = levelOverride;
    this.P.xp = 0;
    this.P.xpNext = getPlaytestXpTargetForLevel(levelOverride);

    updateHUD(this.P, this.gt, WDEFS);
    this.openPlaytestLab();
  }

  applyPlaytestPreset(presetId) {
    const preset = PLAYTEST_LAB_PRESETS_CONFIG[presetId];
    if (!preset) return;

    Object.entries(preset).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    this.readPlaytestLabInputs();
    document.getElementById('lab-apply-time')?.click();
    document.getElementById('lab-apply-loadout')?.click();
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
      let scale = 1;
      let alpha = 1;
      if (g.magnetizing) {
        const progress = Math.min(1, g.magnetizeTime / Math.max(g.magnetizeDuration || 0.25, 0.001));
        scale = 1.0 - (progress * 0.7);
        alpha = 1.0 - progress;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      if (scale !== 1) {
        ctx.translate(g.x, g.y);
        ctx.scale(scale, scale);
        ctx.translate(-g.x, -g.y);
      }
      ctx.fillStyle = '#7F77DD';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(191,119,255,0.8)';
      ctx.beginPath();
      ctx.arc(g.x - 1, g.y - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
    if (!getWeaponLevel(P, 'arcblade')) return;
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
    const sawRadius = getAscensionTierData(this.P, 'arcblade')?.definition?.radius || 40;
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
    ctx.arc(0, 0, sawRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FF2D9B66';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, sawRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawEnemies(perfMode) {
    const { ctx } = this;
    enemies.forEach(e => {
      if (e.type === 'titan') {
        const pulse = 0.15 + 0.08 * Math.sin(this.gt * 1.5 + e._pulseOffset);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#CC0000';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'juggernaut') {
        const crackle = 0.4 + 0.3 * Math.sin(this.gt * 8 + e.x);
        ctx.save();
        ctx.globalAlpha = crackle;
        ctx.strokeStyle = '#FF6600';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#FF8800';
        ctx.shadowBlur = 12;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const baseCol = e.type === 'leech'
        ? (e.shieldActive ? (e.protectedCol || '#2A9B5A') : e.col)
        : e.col;
      const col = e.hitFlash > 0 ? '#fff' : e.frozen ? (e.permafrost ? '#0044AA' : '#00CFFF') : e.stunned ? '#BF77FF' : e.slowT > 0 ? '#7ecfef' : baseCol;
      const waveMod = Math.min(this.surgeCount * 8, 78);
      const brightCol = brightenHexColor(col, waveMod);
      ctx.fillStyle = brightCol + 'bb';
      ctx.strokeStyle = brightCol;
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
        ctx.fillStyle = e.permafrost ? '#0044AA' : 'rgba(0, 207, 255, 0.65)';
        traceEnemyShape(ctx, e);
        ctx.fill();
        ctx.strokeStyle = e.permafrost ? '#0066CC' : 'rgba(0,207,255,0.85)';
        ctx.lineWidth = e.permafrost ? 2 : 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + (e.permafrost ? 4 : 3), 0, Math.PI * 2);
        ctx.stroke();
        if (!e.permafrost) {
          ctx.save();
          ctx.strokeStyle = 'rgba(215, 248, 255, 0.95)';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 4; i++) {
            const a = this.gt * 1.8 + e.id * 0.23 + (i / 4) * Math.PI * 2;
            const innerR = e.r + 2;
            const outerR = e.r + 8 + (i % 2) * 2;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * innerR, e.y + Math.sin(a) * innerR);
            ctx.lineTo(e.x + Math.cos(a) * outerR, e.y + Math.sin(a) * outerR);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = '#0066CC';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        if (hasAscension(this.P, 'cryo', 'shatter') && !e.permafrost) {
          const shatterDef = getAscensionTierData(this.P, 'cryo')?.definition;
          const frozenDuration = Math.max(e.frozenDuration || 1.5, 0.001);
          const freezeRatio = Math.max(0, Math.min(1, (e.frozenTimer || 0) / frozenDuration));
          const crackAlpha = (0.2 + freezeRatio * 0.55) * ((shatterDef?.maxChance || 0.15) / 0.35);
          const spokeCount = 6;

          ctx.save();
          ctx.globalAlpha = crackAlpha;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.25;
          ctx.shadowColor = '#DFF9FF';
          ctx.shadowBlur = 10;
          for (let i = 0; i < spokeCount; i++) {
            const a = this.gt * 2.4 + e.id * 0.31 + (i / spokeCount) * Math.PI * 2;
            const innerR = e.r * (0.22 + (i % 2) * 0.08);
            const midR = e.r * (0.62 + ((i + 1) % 2) * 0.08);
            const outerR = e.r + 8 + freezeRatio * 5;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * innerR, e.y + Math.sin(a) * innerR);
            ctx.lineTo(e.x + Math.cos(a) * midR, e.y + Math.sin(a) * midR);
            ctx.lineTo(e.x + Math.cos(a) * outerR, e.y + Math.sin(a) * outerR);
            ctx.stroke();
          }
          ctx.setLineDash([2, 5]);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = 'rgba(223, 249, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 10 + Math.sin(this.gt * 6 + e.id) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (!perfMode && e.stunned) {
        ctx.strokeStyle = 'rgba(191,119,255,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!perfMode || e.type === 'brute' || e.type === 'titan') {
        const shouldShowHpBar = e.hpBarVisT > 0 || e.type === 'brute' || e.type === 'titan';
        if (shouldShowHpBar) {
          const isTitan = e.type === 'titan';
          const bw = isTitan ? e.r * 2.5 : e.r * 2 + 2;
          const bh = isTitan ? 5 : 3;
          const barX = isTitan ? e.x - bw * 0.5 : e.x - e.r - 1;
          const barY = e.y - e.r - (isTitan ? 12 : 9);
          ctx.fillStyle = '#111';
          ctx.fillRect(barX, barY, bw, bh);
          ctx.fillStyle = col;
          ctx.fillRect(barX, barY, bw * Math.max(0, e.hp / e.maxHp), bh);
        }
      }

      if (e.type === 'leech' && !e.shieldActive) {
        ctx.save();
        ctx.strokeStyle = '#44FF88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r - 8, 5, Math.PI * 0.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.x - 3, e.y - e.r - 4);
        ctx.lineTo(e.x + 4, e.y - e.r - 11);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  drawLeechShields() {
    const { ctx } = this;
    enemies
      .filter(e => e.type === 'leech' && e.shieldActive)
      .forEach(leech => {
        const shieldFraction = Math.max(0, leech.shieldHp / Math.max(1, leech.maxShieldHp));
        const lowShield = shieldFraction < 0.3;
        const flicker = lowShield ? 0.08 + 0.06 * Math.sin(this.gt * 18) : 0;
        const shieldAlpha = 0.15 + 0.08 * Math.sin(this.gt * 2 + leech.x) + flicker;
        const shieldCol = lowShield ? '#FF4444' : '#44FF88';

        ctx.globalAlpha = shieldAlpha;
        ctx.fillStyle = shieldCol;
        ctx.beginPath();
        ctx.arc(leech.x, leech.y, leech.shieldR, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = shieldCol;
        ctx.lineWidth = 2;
        ctx.shadowColor = shieldCol;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(leech.x, leech.y, leech.shieldR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = lowShield ? '#FFAAAA' : '#AAFFCC';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          leech.x,
          leech.y,
          leech.shieldR + 4,
          -Math.PI / 2,
          -Math.PI / 2 + shieldFraction * Math.PI * 2
        );
        ctx.stroke();

        ctx.globalAlpha = 1;
      });
  }

  drawMolotov() {
    const { ctx } = this;
    const P = this.P;
    if (!getWeaponLevel(P, 'molotov')) return;

    P._firePools.forEach(pool => {
      const lifeRatio = pool.life / pool.maxLife;
      const alpha = lifeRatio * 0.45;
      const outerBlur = pool.isInferno ? 25 : 15;
      const innerCol = pool.isInferno ? '#FFFFFF' : '#FF88CC';

      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#FF2D9B';
      ctx.shadowColor = '#FF2D9B';
      ctx.shadowBlur = outerBlur;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = innerCol;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.r * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = lifeRatio * 0.8;
      ctx.strokeStyle = '#FF2D9B';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      if (pool.isInferno) {
        ctx.save();
        ctx.translate(pool.x, pool.y);
        ctx.rotate(this.gt * 0.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, pool.r, Math.max(12, pool.r * 0.84), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(pool.x, pool.y, pool.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      if (Math.random() < 0.3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * pool.r;
        this._spawnMolotovFireParticle(
          pool.x + Math.cos(angle) * radius,
          pool.y + Math.sin(angle) * radius
        );
      }
    });

    P._bottles.forEach(bottle => {
      bottle.trail?.forEach((pos, i) => {
        ctx.globalAlpha = (i / bottle.trail.length) * 0.4;
        ctx.fillStyle = '#FF2D9B';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#FF2D9B';
      ctx.beginPath();
      ctx.arc(bottle.x, bottle.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bottle.x - 1.5, bottle.y - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  _spawnMolotovFireParticle(x, y) {
    particles.push({
      tp: 'dot',
      x,
      y,
      vy: -30 - Math.random() * 20,
      vx: (Math.random() - 0.5) * 20,
      r: 2 + Math.random() * 2,
      col: Math.random() < 0.5 ? '#FF2D9B' : '#FFFFFF',
      life: 0.4,
      lt: 0.4,
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
      if (b.meta?.isCryoShard) {
        const angle = b.meta.angle || Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.shadowColor = '#E8FCFF';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#DFFDFF';
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(3, 4);
        ctx.lineTo(-1, 5);
        ctx.lineTo(-5, 2);
        ctx.lineTo(-6, -2);
        ctx.lineTo(-1, -5);
        ctx.lineTo(3, -4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = '#00CFFF';
        ctx.shadowBlur = 22;
        ctx.fillStyle = '#7FEFFF';
        ctx.beginPath();
        ctx.moveTo(4.5, 0);
        ctx.lineTo(1.5, 2.6);
        ctx.lineTo(-1.5, 2.8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-1.5, -2.8);
        ctx.lineTo(1.5, -2.6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(-2.5, -4.5);
        ctx.lineTo(2.5, 4.5);
        ctx.moveTo(-2.5, 4.5);
        ctx.lineTo(2.5, -4.5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (b.meta?.isCryoOverload) {
        const angle = Math.atan2(b.vy, b.vx);
        const tailX = b.x - Math.cos(angle) * 16;
        const tailY = b.y - Math.sin(angle) * 16;
        ctx.save();
        ctx.shadowColor = '#FFE98A';
        ctx.shadowBlur = ultraMode ? 0 : 26;
        ctx.strokeStyle = 'rgba(255,214,96,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#FFF6B8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,192,64,0.95)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x - 7, b.y);
        ctx.lineTo(b.x + 7, b.y);
        ctx.moveTo(b.x, b.y - 7);
        ctx.lineTo(b.x, b.y + 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
        return;
      }

      if (b.meta?.type === 'cryo' && hasAscension(this.P, 'cryo', 'cryo_storm')) {
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.shadowColor = '#F2FEFF';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#E8FCFF';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(3, 4.5);
        ctx.lineTo(-2, 5.5);
        ctx.lineTo(-6, 1.8);
        ctx.lineTo(-6, -1.8);
        ctx.lineTo(-2, -5.5);
        ctx.lineTo(3, -4.5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = '#00CFFF';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#8BF4FF';
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(1.5, 2.6);
        ctx.lineTo(-2.2, 2.8);
        ctx.lineTo(-4.3, 0);
        ctx.lineTo(-2.2, -2.8);
        ctx.lineTo(1.5, -2.6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5.5, 0);
        ctx.moveTo(-1.8, -3.8);
        ctx.lineTo(1.8, 3.8);
        ctx.moveTo(-1.8, 3.8);
        ctx.lineTo(1.8, -3.8);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (b.meta?.type === 'pulse' && b.meta?.chainReaction && !b.meta?.isOverload) {
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.shadowColor = '#FFE3A0';
        ctx.shadowBlur = ultraMode ? 0 : 20;
        ctx.fillStyle = '#FF6A2A';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(1, 6.5);
        ctx.lineTo(-8, 0);
        ctx.lineTo(1, -6.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFF3C1';
        ctx.beginPath();
        ctx.moveTo(4.5, 0);
        ctx.lineTo(0, 2.8);
        ctx.lineTo(-3.6, 0);
        ctx.lineTo(0, -2.8);
        ctx.closePath();
        ctx.fill();
        if (!ultraMode) {
          ctx.strokeStyle = 'rgba(255,227,160,0.9)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-2, 0);
          ctx.stroke();
        }
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

    if (this._barrierRipple) {
      this._barrierRipple.life -= this.dt;
      const progress = 1 - this._barrierRipple.life / this._barrierRipple.maxLife;
      const rippleR = P.r + 8 + progress * 28;
      const alpha = (1 - progress) * 0.95;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#C6FF00';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#C6FF00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(P.x, P.y, rippleR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(P.x, P.y, rippleR - 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (this._barrierRipple.life <= 0) this._barrierRipple = null;
    }

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

    if (this.overloadFlash > 0) {
      ctx.fillStyle = `rgba(255,182,39,${0.15 * Math.min(1, this.overloadFlash / 0.15)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.chainFlash > 0) {
      ctx.fillStyle = `rgba(255,106,42,${0.1 * Math.min(1, this.chainFlash / 0.1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.novaFlashT > 0) {
      ctx.fillStyle = `rgba(29,255,208,${0.05 * Math.min(1, this.novaFlashT / 0.1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this._screenFlash) {
      const flashLife = this._screenFlash.maxLife || 0.3;
      const alpha = this._screenFlash.alpha * Math.max(0, this._screenFlash.life / flashLife);
      ctx.fillStyle = hexToRgba(this._screenFlash.col || '#FF4444', alpha);
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
    this.drawLeechShields();
    this.drawMolotov();
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
      const x = quadBezierPoint(start.x, cx, tx, t);
      const y = quadBezierPoint(start.y, cy, targetY, t);
      const trailT = Math.max(0, t - 0.16);
      const trailX = quadBezierPoint(start.x, cx, tx, trailT);
      const trailY = quadBezierPoint(start.y, cy, targetY, trailT);
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
    this.P._splitDrones.forEach((sd) => {
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

function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
