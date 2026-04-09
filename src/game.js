import { initHUD, updateHUD, showOverlay, hideOverlay, setSurge, setBossBar } from './hud.js';
import { initInput, initJoystick, jDir } from './input.js';
import { CHARACTERS, getOwnedWeaponIds, getWeaponLevel, mkPlayer } from './player.js';
import { enemies, resetEnemies, spawnEnemy, pruneEnemies, dist2, setExtraTarget, clearExtraTarget, tickEnemyStatus } from './enemies.js';
import { WDEFS, bullets, resetBullets, resetPulseClusters, handleCryoImpact, updateCryoFields, getPulseHitDamage, triggerPulseExplosion } from './weapons.js';
import { buildPool, applyUpgrade } from './upgrades.js';
import { updateParticles, addRing, addBurst, addDot, drawParticles } from './particles.js';
import { mkBoss, updateBoss, drawBoss, hitBoss, BOSS_SPAWN_TIME, BOSS_RESPAWN_DELAY } from './boss.js';
import {
  initAudio, resumeAudio,
  playCryoFire, playPulseFire, playEmpFire,
  playHit, playEnemyDeath, playPlayerHit, playDodge,
  playLevelUp, playXp, playSurge, playDeath,
  playBossWarning, playBossPhaseTwo, playBossDeath,
  startBossMusic, stopBossMusic,
} from './audio.js';

export class Game {
  constructor() {
    this.P = null;
    this.selectedCharId = 'ghost';
    this.gt = 0;
    this.lt = 0;
    this.running = false;
    this.paused = false;
    this.killCount = 0;
    this.gems = [];
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
  }

  start() {
    initHUD();
    const canvas = document.getElementById('c');
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('touchstart', resumeAudio, { passive: true });
    initInput();
    initJoystick(
      document.getElementById('joystick-zone'),
      document.getElementById('joystick'),
      document.getElementById('jknob')
    );
    this.showStart();
  }

  resize() {
    const canvas = document.getElementById('c');
    this.W = canvas.width = window.innerWidth;
    this.H = canvas.height = window.innerHeight;
  }

  newRun(char = CHARACTERS.ghost) {
    this.selectedCharId = char.id;
    initAudio();
    resumeAudio();
    resetEnemies();
    resetBullets();
    resetPulseClusters();
    this.gems = [];
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
    this.P = mkPlayer(this.W, this.H, char);
    this.shake.x = 0;
    this.shake.y = 0;
    this.shake.t = 0;
    this.shake.mag = 22;
    this.running = true;
    this.paused = false;
    clearExtraTarget();
    setBossBar(null);
    hideOverlay();
    this.lt = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lt) / 1000, 0.033);
    this.lt = ts;
    if (!this.paused) { this.gt += dt; this.update(dt); }
    this.draw();
    requestAnimationFrame(ts => this.loop(ts));
  }

  update(dt) {
    const { P, W, H } = this;
    const sh = this.shake;
    sh.t = Math.max(0, sh.t - dt);
    sh.x = sh.t > 0 ? (Math.random() - .5) * sh.t * sh.mag : 0;
    sh.y = sh.t > 0 ? (Math.random() - .5) * sh.t * sh.mag : 0;

    P.x = cl(P.x + jDir.x * P.spd * dt, P.r, W - P.r);
    P.y = cl(P.y + jDir.y * P.spd * dt, P.r, H - P.r);
    if (P.invT > 0) P.invT -= dt;
    if (P.hurtFlash > 0) P.hurtFlash = Math.max(0, P.hurtFlash - dt * 2.8);
    if (P.hpLag > P.hp) P.hpLag = Math.max(P.hp, P.hpLag - dt * Math.max(35, (P.hpLag - P.hp) * 3.2));
    else P.hpLag = P.hp;

    this._updateSurge(dt);
    this._spawnEnemies(dt);
    this._updateBoss(dt);
    this._fireWeapons(dt);
    this._updateBullets(dt);
    updateCryoFields(this, dt);
    this._updateEnemies(dt);
    this._updateGems(dt);

    updateParticles(dt);
    this.dmgNums = this.dmgNums.filter(d => { d.y -= 40 * dt; d.life -= dt; return d.life > 0; });
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
    P.hp -= dmg;
    P.invT = 0.7;
    P.hurtFlash = 1;
    P.hpLag = Math.max(P.hpLag, P.hp + dmg);
    this.setShake(shakeDur, shakeMag);
    playPlayerHit();
    if (P.hp <= 0) { P.hp = 0; this.endGame(); }
    return true;
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
      for (let i = 0; i < batch; i++) spawnEnemy(this.gt, this.W, this.H);
    }
  }

  _updateBoss(dt) {
    const { W, H } = this;

    // warning 5s before intro
    if (!this.bossWarned && this.gt >= this.nextBossTime - 5 && !this.boss && !this.bossIntro) {
      this.bossWarned = true;
      this.addDN(W / 2, H / 2 - 60, '⚠ SIGNAL INCOMING', '#E24B4A', 2.5, true);
      playBossWarning();
    }

    // trigger intro — clear field, start music and countdown
    if (!this.boss && !this.bossIntro && this.gt >= this.nextBossTime) {
      this.bossIntro = true;
      this.bossIntroT = 3.5;
      this.bossWarned = false;
      resetEnemies();
      for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].enemy) bullets.splice(i, 1);
      }
      startBossMusic();
    }

    // tick intro countdown
    if (this.bossIntro) {
      this.bossIntroT -= dt;
      if (this.bossIntroT <= 0) {
        this.bossIntro = false;
        this.boss = mkBoss(this.gt, W, H);
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

    updateBoss(
      this.boss, this.P, dt, bullets,
      // onHitPlayer
      (dmg) => {
        this.hitPlayer(dmg, 0.32, 30);
      },
      // onSpawnBullet
      (x, y, vx, vy, r, dmg, col) => {
        bullets.push({ x, y, vx, vy, r, dmg, col, life: 3.5, pl: 0, enemy: true, meta: {} });
      },
      // onPhaseTwo
      () => {
        this.setShake(0.5, 32);
        this.addDN(W / 2, H / 2 - 60, '!! SIGNAL ENRAGED !!', '#D4537E', 2.5, true);
        playBossPhaseTwo();
      }
    );

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
        w.fire(P, onHit, { addText: (...args) => this.addDN(...args) });
        if (wid === 'cryo') playCryoFire();
        else if (wid === 'pulse') playPulseFire();
        else if (wid === 'emp') playEmpFire();
      }
    });
    if (getWeaponLevel(P, 'swarm')) WDEFS.swarm.tick(P, dt, onHit);
  }

  _updateBullets(dt) {
    const { P, W, H } = this;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life < 0 || b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) { bullets.splice(i, 1); continue; }

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
      if (this.boss?.alive && !b.hitBoss && dist2(b, this.boss) < (b.r + this.boss.r) ** 2) {
        const syn = b.meta?.type === 'pulse' && this.boss.frozen;
        let dmg = syn ? b.dmg * 3.5 : b.dmg;
        if (b.meta?.type === 'pulse') dmg = getPulseHitDamage(b, dmg);
        this._doBossHit(dmg, b.col, syn);
        if (b.meta?.type === 'cryo') handleCryoImpact(this, b, this.boss, b.x, b.y, true);
        if (b.meta?.type === 'pulse') {
          triggerPulseExplosion(this, b, b.x, b.y, (target, splash, col) => this.hitEnemy(target, splash, col), (splash, col) => this._doBossHit(splash, col));
        }
        b.hitBoss = true;
        b.pl = (b.pl || 0) - 1;
        if (b.pl < 0) { alive = false; }
      }

      if (alive) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (b.hitIds?.has(e.id)) continue;
          if (dist2(b, e) < (b.r + e.r) ** 2) {
            let dmg = b.dmg;
            const syn = b.meta?.type === 'pulse' && e.frozen;
            if (syn) dmg *= 3.5;
            if (b.meta?.type === 'pulse') dmg = getPulseHitDamage(b, dmg);
            const result = this.hitEnemy(e, dmg, b.col, syn);
            if (b.meta?.type === 'cryo') handleCryoImpact(this, b, e, e.x, e.y, false);
            if (b.meta?.type === 'pulse') {
              triggerPulseExplosion(this, b, e.x, e.y, (target, splash, col) => this.hitEnemy(target, splash, col), (splash, col) => this._doBossHit(splash, col));
            }
            b.hitIds?.add(e.id);
            b.pl = (b.pl || 0) - 1;
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
      tickEnemyStatus(e, dt);
      if (e.overloadMarkT > 0) e.overloadMarkT -= dt;
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
    const P = this.P;
    const now = performance.now();
    let collectedXp = 0;
    this.gems = this.gems.filter(g => {
      const dx = P.x - g.x, dy = P.y - g.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < P.mag) { g.x += (P.x - g.x) * 5 * dt; g.y += (P.y - g.y) * 5 * dt; }
      if (d < P.r + g.r) {
        collectedXp += g.val;
        return false;
      }
      return true;
    });
    if (collectedXp > 0) {
      this.addXp(collectedXp);
      if (now - this._lastXpSound > 80) { playXp(); this._lastXpSound = now; }
    }
  }

  _doBossHit(dmg, col, isSynergy = false) {
    if (this.P.char === 'bruiser' && this.P.hp < this.P.maxHp * 0.5) dmg *= 1.35;
    const now = performance.now();
    hitBoss(this.boss, dmg, col, isSynergy);
    const numCol = isSynergy ? '#FFB627' : col;
    this.addDN(this.boss.x, this.boss.y - this.boss.r, Math.round(dmg), numCol, 0.7, isSynergy);
    if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
    return { killed: false, target: this.boss, damage: dmg };
  }

  hitEnemy(e, dmg, col, isSynergy = false) {
    if (this.P.char === 'bruiser' && this.P.hp < this.P.maxHp * 0.5) dmg *= 1.35;
    e.hp -= dmg; e.hitFlash = 0.1;
    const numCol = isSynergy ? '#FFB627' : col === '#00CFFF' ? '#00CFFF' : col === '#BF77FF' ? '#BF77FF' : '#fff';
    this.addDN(e.x, e.y - e.r, Math.round(dmg), numCol, 0.7, isSynergy);
    addBurst(e.x, e.y, col, isSynergy ? 6 : 3, isSynergy ? 90 : 60, 2.5, 0.32);
    const now = performance.now();
    if (now - this._lastHitSound > 80) { playHit(isSynergy); this._lastHitSound = now; }
    if (e.hp <= 0) {
      this.killCount++;
      const xpVal = (this.P.char === 'hacker' && e.stunned) ? e.xp * 2 : e.xp;
      this.spawnGem(e.x, e.y, xpVal);
      this.spawnDeath(e.x, e.y, e.col, e.frozen);
      playEnemyDeath(e.frozen);
      return { killed: true, target: e, damage: dmg };
    }
    return { killed: false, target: e, damage: dmg };
  }

  spawnDeath(x, y, col, frozen) {
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
    stopBossMusic();
    playDeath();
    const m = Math.floor(this.gt / 60), s = Math.floor(this.gt % 60);
    const wList = formatWeaponList(this.P);
    showOverlay(`
      <div class="ov-title" style="color:#E24B4A;font-size:22px">FLATLINED</div>
      <div class="ov-sub">// connection terminated //</div>
      <div style="text-align:center;margin-bottom:22px;line-height:2.2;font-size:12px">
        <div>Time &nbsp;<span style="color:#1DFFD0">${m}:${s < 10 ? '0' : ''}${s}</span></div>
        <div>Level &nbsp;<span style="color:#BF77FF">${this.P.level}</span></div>
        <div>Kills &nbsp;<span style="color:#FFB627">${this.killCount}</span></div>
        <div style="margin-top:6px;color:#555;font-size:10px">${wList}</div>
      </div>
      <div class="menu-actions">
        <button class="btn" onclick="window.__game.newRun(window.__game.getSelectedCharacter())">RUN AGAIN</button>
        <button class="btn btn-secondary" onclick="window.__game.showStart()">MAIN MENU</button>
      </div>`);
  }

  showStart() {
    this.running = false;
    const char = this.getSelectedCharacter();
    const cards = Object.values(CHARACTERS).map(c => {
      const active = c.id === char.id ? ' active' : '';
      const weapon = WDEFS[c.startWeapon];
      const passive = c.id === 'ghost'
        ? '20% dodge chance. Freeze setups and kite hard.'
        : c.id === 'bruiser'
          ? '+35% damage under 50% HP. Heavy close-range pressure.'
          : 'Stunned enemies drop extra XP. Fast snowball control.';
      return `<button class="char-card${active}" onclick="window.__game.selectCharacter('${c.id}')">
        <div class="char-card-top">
          <span class="char-sigil" style="color:${c.col}">◆</span>
          <span class="char-name">${c.name}</span>
        </div>
        <div class="char-weapon" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</div>
        <div class="char-passive">${passive}</div>
      </button>`;
    }).join('');
    const weapon = WDEFS[char.startWeapon];
    const passiveLabel = char.id === 'ghost'
      ? 'GHOST STEP'
      : char.id === 'bruiser'
        ? 'LOW HP RAMP'
        : 'DATA LEECH';
    const passiveValue = char.id === 'ghost'
      ? '20% dodge chance'
      : char.id === 'bruiser'
        ? '+35% damage below 50% HP'
        : '2x XP from stunned kills';
    showOverlay(`
      <div class="menu-shell">
        <div class="menu-brand">
          <div class="menu-kicker">NEURAL SURVIVAL ROGUELITE</div>
          <div class="menu-title">INFINITE<br>ROGUE</div>
          <div class="menu-sub">// discover builds // survive the swarm //</div>
        </div>
        <div class="menu-grid">
          <section class="menu-panel">
            <div class="panel-label">OPERATORS</div>
            <div class="char-grid">${cards}</div>
          </section>
          <section class="menu-panel menu-panel-feature">
            <div class="panel-label">ACTIVE LOADOUT</div>
            <div class="feature-head">
              <div class="feature-name" style="color:${char.col}">${char.name}</div>
              <div class="feature-speed">SPD ${char.spd}</div>
            </div>
            <div class="feature-meta">
              <div><span>START</span><strong style="color:${weapon.col}">${weapon.icon} ${weapon.name}</strong></div>
              <div><span>PASSIVE</span><strong>${passiveLabel}</strong></div>
              <div><span>EFFECT</span><strong>${passiveValue}</strong></div>
            </div>
            <div class="feature-copy">
              Aggressive waves start immediately. Runs are built around fast weapon drafting, emergent synergies, and lasting until the board collapses on you.
            </div>
            <div class="intel-grid">
              <div class="intel-card"><span>RUNS</span><strong>3-5 MIN</strong></div>
              <div class="intel-card"><span>FLOW</span><strong>ENDLESS</strong></div>
              <div class="intel-card"><span>STYLE</span><strong>DISCOVERY</strong></div>
              <div class="intel-card"><span>SURGES</span><strong>+40 SEC</strong></div>
            </div>
            <div class="menu-actions">
              <button class="btn" onclick="window.__game.newRun(window.__game.getSelectedCharacter())">JACK IN</button>
            </div>
          </section>
        </div>
      </div>`, 'main-menu');
    window.__game = this;
  }

  getSelectedCharacter() {
    return CHARACTERS[this.selectedCharId] || CHARACTERS.ghost;
  }

  selectCharacter(id) {
    if (!CHARACTERS[id]) return;
    this.selectedCharId = id;
    this.showStart();
  }

  draw() {
    const { ctx, W, H, P, shake } = this;
    const perfMode = this.surgeActive && enemies.length > 70;
    const ultraMode = this.surgeActive && enemies.length > 110;
    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.fillStyle = '#08080f'; ctx.fillRect(-8, -8, W + 16, H + 16);

    // surge vignette — red pulsing edge glow
    if (this.surgeActive) {
      const pulse = 0.13 + 0.07 * Math.sin(this.gt * 9);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(200,20,20,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-8, -8, W + 16, H + 16);
    }

    // boss intro vignette — more aggressive, deep red
    if (this.bossIntro) {
      const pulse = 0.22 + 0.14 * Math.sin(this.gt * 11);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(220,10,10,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-8, -8, W + 16, H + 16);
    }

    const hpRatio = P.hp / P.maxHp;
    if (hpRatio <= 0.3) {
      const pulse = 0.14 + (0.3 - hpRatio) * 0.6 + 0.09 * Math.sin(this.gt * 10);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.88);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(226,75,74,${Math.max(0.16, pulse)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(-8, -8, W + 16, H + 16);
    }

    if (!ultraMode) {
      ctx.strokeStyle = 'rgba(0,207,255,0.035)'; ctx.lineWidth = 1;
      const gs = 52;
      for (let x = 0; x < W + gs; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H + gs; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }

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

    drawParticles(ctx);

    this.gems.forEach(g => {
      ctx.fillStyle = '#7F77DD'; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(191,119,255,0.8)'; ctx.beginPath(); ctx.arc(g.x - 1, g.y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    drawBoss(ctx, this.boss);

    enemies.forEach(e => {
      const col = e.hitFlash > 0 ? '#fff' : e.frozen ? '#00CFFF' : e.stunned ? '#BF77FF' : e.slowT > 0 ? '#7ecfef' : e.col;
      ctx.fillStyle = col + 'bb'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (e.shape === 'sq') ctx.rect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      else if (e.shape === 'tri') { ctx.moveTo(e.x, e.y - e.r); ctx.lineTo(e.x + e.r, e.y + e.r); ctx.lineTo(e.x - e.r, e.y + e.r); ctx.closePath(); }
      else ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (!perfMode && e.frozen) { ctx.strokeStyle = 'rgba(0,207,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (!perfMode && e.stunned) { ctx.strokeStyle = 'rgba(191,119,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (!perfMode && e.empMarkT > 0) {
        const pulse = 0.45 + 0.55 * Math.sin(this.gt * 10 + e.id * 0.7);
        ctx.strokeStyle = `rgba(255,255,255,${0.18 + pulse * 0.22})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 5 + pulse * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(191,119,255,${0.28 + pulse * 0.32})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 9 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!perfMode && e.overloadMarkT > 0) {
        const pulse = 0.55 + 0.45 * Math.sin(this.gt * 14 + e.id);
        ctx.strokeStyle = `rgba(255,255,255,${0.22 + pulse * 0.28})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(191,119,255,${0.38 + pulse * 0.34})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 11 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = this.gt * 7 + e.id + (i / 4) * Math.PI * 2;
          const px = e.x + Math.cos(a) * (e.r + 10);
          const py = e.y + Math.sin(a) * (e.r + 10);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      if (!perfMode || e.type === 'brute') {
        const bw = e.r * 2 + 2;
        ctx.fillStyle = '#111'; ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw, 3);
        ctx.fillStyle = col; ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw * Math.max(0, e.hp / e.maxHp), 3);
      }
    });

    bullets.filter(b => b.enemy).forEach(b => {
      ctx.fillStyle = '#FFB62766'; ctx.strokeStyle = '#FFB627'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    bullets.filter(b => !b.enemy).forEach(b => {
      const tier = b.meta?.tier || 1;
      const glow = b.meta?.type === 'cryo' ? '#9af3ff' : b.meta?.type === 'pulse' ? '#ffd16f' : b.col;
      const drawR = b.meta?.type === 'cryo'
        ? b.r
        : b.r + (tier >= 2 ? 1 : 0) + (b.meta?.type === 'pulse' && tier >= 2 ? 1 : 0);
      ctx.shadowColor = glow; ctx.shadowBlur = ultraMode ? 0 : 10 + tier * 2;
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(b.x, b.y, drawR, 0, Math.PI * 2); ctx.fill();
      if (!ultraMode && tier >= 2) {
        ctx.strokeStyle = tier >= 3 ? '#ffffff' : glow;
        ctx.lineWidth = tier >= 3 ? 1.8 : 1.2;
        ctx.beginPath(); ctx.arc(b.x, b.y, drawR + 2.2, 0, Math.PI * 2); ctx.stroke();
      }
      if (!ultraMode && b.meta?.type === 'pulse' && tier >= 2) {
        ctx.strokeStyle = `rgba(255,182,39,${0.35 + (b.pierceDmgMult || 1) * 0.25})`;
        ctx.lineWidth = tier >= 3 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    });

    const drawDrone = (drone, mini = false) => {
      const r = mini ? 4 : 7;
      const fill = mini ? '#d7fff3' : '#1DFFD0';
      const stroke = mini ? '#FFB627' : '#a2ffeb';
      ctx.shadowColor = stroke;
      ctx.shadowBlur = mini ? 10 : 14;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = mini ? 1.4 : 1.8;
      ctx.beginPath();
      ctx.arc(drone.x, drone.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (mini) {
        ctx.strokeStyle = 'rgba(255,182,39,0.45)';
        ctx.beginPath();
        ctx.arc(drone.x, drone.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };
    (P._dr || []).forEach(drone => drawDrone(drone, false));
    (P._miniDr || []).forEach(drone => drawDrone(drone, true));

    const fl = P.invT > 0 && Math.floor(P.invT * 12) % 2 === 0;
    ctx.shadowColor = fl ? '#fff' : P.col; ctx.shadowBlur = 14;
    ctx.fillStyle = fl ? '#fff' : P.col;
    ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,200,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    this.dmgNums.forEach(d => {
      ctx.globalAlpha = Math.min(1, d.life / 0.35);
      ctx.fillStyle = d.col;
      const isStr = typeof d.val === 'string';
      ctx.font = `bold ${d.big ? (isStr ? 14 : 15) : (isStr ? 11 : 12)}px Courier New`;
      if (d.big) { ctx.shadowColor = d.col; ctx.shadowBlur = 8; }
      ctx.fillText(d.val, d.x, d.y);
      ctx.shadowBlur = 0;
    });
    // boss intro flash — "BOSS FIGHT" pulses for 3.5s
    if (this.bossIntro) {
      const flash = Math.sin(this.gt * 7) > 0; // fast strobe
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

    // big surge flash — fades out over 1.8s
    if (this.surgeFlashT > 0) {
      const t = this.surgeFlashT / 1.8;
      // fast in, slow fade
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

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function wStats(wid, lvl, p) {
  const rb = p.rateBonus || 1;
  const rates = {
    cryo: (1.9 + lvl * 0.35) * rb,
    pulse: 0.45 * rb,
    emp: 0.4 * rb,
    swarm: 0,
  };
  const r = (rates[wid] || 0).toFixed(1);
  if (wid === 'cryo') return [`Rate: ${r}/s`, `Projectiles: ${Math.min(5, Math.max(1, lvl))}`, lvl >= 2 ? 'Spread: widening fan' : 'Slow: 50% for 2s', 'Pierce: 1 enemy'];
  if (wid === 'pulse') return [`Rate: ${r}/s`, `Dmg: ${Math.round(p.dmg * (28 + lvl * 10))}`, 'Impact: heavy explosive shot', lvl >= 2 ? 'Cluster: splits on impact' : 'Cooldown: long', lvl >= 5 ? 'Cluster: four split layers' : lvl >= 4 ? 'Cluster: three split layers' : lvl >= 3 ? 'Cluster: bomblets split again' : ''];
  if (wid === 'emp') return [`Rate: ${r}/s`, `Radius: ${[0, 160, 220, 280, 340, 400][Math.min(lvl, 5)]}px`, `Stun: ${(2.0 + lvl * 0.5).toFixed(1)}s`, lvl >= 5 ? 'Affected enemies emit shockwaves' : ''];
  if (wid === 'swarm') return [`Drones: ${Math.min(6, 1 + lvl)}`, `Dmg/hit: ${Math.round(p.dmg * (28 + lvl * 14))}`, 'Orbit: auto-seek', lvl >= 2 ? 'Upgrade: +1 drone' : ''];
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
      1: 'Releases a 160px radial stun burst with a 2 second disable window.',
      2: 'EMP expands into a larger 220px control burst.',
      3: 'EMP grows again into a 280px stun field.',
      4: 'EMP grows again into a 340px stun field.',
      5: 'EMP reaches a massive 400px burst, and affected enemies emit small shockwaves into nearby targets.'
    },
    swarm: {
      1: 'Deploys 2 orbiting drones that seek targets and strike automatically.',
      2: 'Adds a third orbiting swarm drone.',
      3: 'Adds a fourth orbiting swarm drone.',
      4: 'Adds a fifth orbiting swarm drone.',
      5: 'Adds a sixth orbiting swarm drone.'
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
    swarm: 'Deploys orbiting drones that keep scaling by adding more swarm bodies.'
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

function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }



