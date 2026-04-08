import { initHUD, updateHUD, showOverlay, hideOverlay, setSurge } from './hud.js';
import { initInput, initJoystick, jDir } from './input.js';
import { mkPlayer } from './player.js';
import { enemies, resetEnemies, spawnEnemy, pruneEnemies, dist2, nearest } from './enemies.js';
import { WDEFS, bullets, resetBullets, triggerOverload } from './weapons.js';
import { PASSIVES, buildPool, applyUpgrade } from './upgrades.js';
import { particles, updateParticles, addRing, addBurst, addDot, drawParticles } from './particles.js';

export class Game {
  constructor() {
    this.P = null;
    this.gt = 0;
    this.lt = 0;
    this.running = false;
    this.paused = false;
    this.killCount = 0;
    this.gems = [];
    this.dmgNums = [];
    this.shake = { x: 0, y: 0, t: 0 };
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this._st = 0;
  }

  start() {
    initHUD();
    const canvas = document.getElementById('c');
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
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

  newRun() {
    resetEnemies();
    resetBullets();
    this.gems = [];
    this.dmgNums = [];
    this.gt = 0;
    this.killCount = 0;
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.nextSurge = 40;
    this._st = 0;
    this.P = mkPlayer(this.W, this.H);
    this.running = true;
    this.paused = false;
    hideOverlay();
    this.lt = performance.now();
    requestAnimationFrame(ts => this.loop(ts));
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lt) / 1000, 0.05);
    this.lt = ts;
    if (!this.paused) { this.gt += dt; this.update(dt); }
    this.draw();
    requestAnimationFrame(ts => this.loop(ts));
  }

  update(dt) {
    const { P, W, H } = this;
    const sh = this.shake;
    sh.t = Math.max(0, sh.t - dt);
    sh.x = sh.t > 0 ? (Math.random() - .5) * sh.t * 16 : 0;
    sh.y = sh.t > 0 ? (Math.random() - .5) * sh.t * 16 : 0;

    P.x = cl(P.x + jDir.x * P.spd * dt, P.r, W - P.r);
    P.y = cl(P.y + jDir.y * P.spd * dt, P.r, H - P.r);
    if (P.invT > 0) P.invT -= dt;

    // surge
    if (this.gt >= this.nextSurge && !this.surgeActive) {
      this.surgeActive = true;
      this.surgeTimer = 8 + Math.floor(this.gt / 60) * 3;
      this.nextSurge += 40;
      setSurge(true);
    }
    if (this.surgeActive) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) { this.surgeActive = false; setSurge(false); }
    }

    // spawn
    this._st += dt;
    const wave = this.gt / 45;
    const baseRate = Math.max(0.06, 0.9 - this.gt / 110);
    const rate = this.surgeActive ? baseRate * 0.3 : baseRate;
    if (this._st >= rate) {
      this._st = 0;
      const batch = this.surgeActive ? Math.ceil(1 + wave * 0.5) : 1;
      for (let i = 0; i < batch; i++) spawnEnemy(this.gt, W, H);
    }

    // fire weapons
    Object.keys(P.w).forEach(wid => {
      const w = WDEFS[wid]; if (!w.fire) return;
      P.ft[wid] = (P.ft[wid] || 0) + dt;
      const r = w.getRate(P);
      if (r > 0 && P.ft[wid] >= 1 / r) { P.ft[wid] = 0; w.fire(P, (e, d, c, big) => this.hitEnemy(e, d, c, big)); }
    });
    if (P.w.swarm) WDEFS.swarm.tick(P, dt, (e, d, c) => this.hitEnemy(e, d, c));

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life < 0 || b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) { bullets.splice(i, 1); continue; }
      if (b.meta?.type === 'cryo') addDot(b.x, b.y, '#00CFFF44', 2.5, 0.15);
      let alive = true;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (dist2(b, e) < (b.r + e.r) ** 2) {
          let dmg = b.dmg;
          const syn = b.meta?.type === 'pulse' && e.frozen;
          if (syn) dmg *= 3.5;
          this.hitEnemy(e, dmg, b.col, syn);
          if (b.meta?.freeze) { e.frozen = true; e.frozenT = 2.0; e.slowT = 0; }
          else if (b.meta?.slow) { e.slowT = 2; e.spdMult = 0.45; }
          if (b.meta?.aoe) this.spawnRing(e.x, e.y, 75, b.col, b.dmg * 0.5);
          b.pl = (b.pl || 0) - 1;
          if (b.pl < 0) { alive = false; break; }
        }
      }
      pruneEnemies();
      if (!alive) bullets.splice(i, 1);
    }

    // enemies move + contact
    enemies.forEach(e => {
      if (e.stunned) { e.stunT -= dt; if (e.stunT <= 0) e.stunned = false; }
      if (e.frozen) { e.frozenT -= dt; if (e.frozenT <= 0) e.frozen = false; }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
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
        if (Math.random() > P.dodge) {
          P.hp -= e.dmg; P.invT = 0.7; sh.t = 0.2;
          if (P.hp <= 0) { P.hp = 0; this.endGame(); }
        } else this.addDN(P.x, P.y - 20, 'DODGE', '#1DFFD0', 0.55);
      }
    });

    // enemy bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; if (!b.enemy) continue;
      if (dist2(b, P) < (b.r + P.r) ** 2 && P.invT <= 0) {
        if (Math.random() > P.dodge) { P.hp -= b.dmg; P.invT = 0.7; sh.t = 0.18; if (P.hp <= 0) { P.hp = 0; this.endGame(); } }
        else this.addDN(P.x, P.y - 20, 'DODGE', '#1DFFD0', 0.55);
        bullets.splice(i, 1);
      }
    }

    // gems
    this.gems = this.gems.filter(g => {
      const dx = P.x - g.x, dy = P.y - g.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < P.mag) { g.x += (P.x - g.x) * 5 * dt; g.y += (P.y - g.y) * 5 * dt; }
      if (d < P.r + g.r) { this.addXp(g.val); return false; }
      return true;
    });

    updateParticles(dt);
    this.dmgNums = this.dmgNums.filter(d => { d.y -= 40 * dt; d.life -= dt; return d.life > 0; });
    updateHUD(P, this.gt, WDEFS);
  }

  hitEnemy(e, dmg, col, isSynergy = false) {
    e.hp -= dmg; e.hitFlash = 0.1;
    const numCol = isSynergy ? '#FFB627' : col === '#00CFFF' ? '#00CFFF' : col === '#BF77FF' ? '#BF77FF' : '#fff';
    this.addDN(e.x, e.y - e.r, Math.round(dmg), numCol, 0.7, isSynergy);
    addBurst(e.x, e.y, col, isSynergy ? 6 : 3, isSynergy ? 90 : 60, 2.5, 0.32);
    if (e.hp <= 0) {
      this.killCount++;
      this.gems.push({ x: e.x, y: e.y, r: 5, val: e.xp });
      this.spawnDeath(e.x, e.y, e.col, e.frozen);
    }
  }

  spawnDeath(x, y, col, frozen) {
    const c = frozen ? '#00CFFF' : col;
    addBurst(x, y, c, 10, 90, frozen ? 4 : 3, 0.5);
    if (frozen) addRing(x, y, 44, '#00CFFF', 1.5, 0.25);
  }

  spawnRing(x, y, r, col, dmg) {
    addRing(x, y, r, col, 2, 0.35);
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
      this.P.xpNext = Math.floor(this.P.xpNext * 1.3);
      this.levelUp();
    }
  }

  addDN(x, y, v, col, life = 0.65, big = false) {
    this.dmgNums.push({ x, y, val: v, life, col: col || '#fff', big });
  }

  levelUp() {
    this.paused = true;
    const pool = buildPool(this.P, WDEFS);
    const cards = pool.map(u => {
      if (u.type === 'wep') {
        const w = WDEFS[u.wid];
        const stats = wStats(u.wid, u.lvl, this.P);
        return `<div class="uc wep" onclick="window.__game.pickUpgrade('${u.id}')">
          <div class="ut">◈ WEAPON</div>
          <div class="un">${w.icon} ${w.name} T${u.lvl}</div>
          <div class="ud">${wDesc(u.wid, u.lvl)}</div>
          <div class="us">${stats.join('<br>')}</div></div>`;
      }
      const preview = u.apply ? (() => { const c = { ...this.P }; return u.apply(c); })() : [];
      return `<div class="uc pas" onclick="window.__game.pickUpgrade('${u.id}')">
        <div class="ut">◆ PASSIVE</div>
        <div class="un">${u.label}</div>
        <div class="us">${preview.join('<br>')}</div></div>`;
    }).join('');
    showOverlay(`
      <div style="color:#444;font-size:9px;letter-spacing:3px;margin-bottom:6px">// SYSTEM UPGRADE //</div>
      <div style="font-size:15px;color:#BF77FF;letter-spacing:2px;margin-bottom:18px">LEVEL ${this.P.level} — CHOOSE ONE</div>
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
    const m = Math.floor(this.gt / 60), s = Math.floor(this.gt % 60);
    const wList = Object.entries(this.P.w).map(([id, lvl]) => `${WDEFS[id].icon} ${WDEFS[id].name} T${lvl}`).join(' · ');
    showOverlay(`
      <div class="ov-title" style="color:#E24B4A;font-size:22px">FLATLINED</div>
      <div class="ov-sub">// connection terminated //</div>
      <div style="text-align:center;margin-bottom:22px;line-height:2.2;font-size:12px">
        <div>Time &nbsp;<span style="color:#1DFFD0">${m}:${s < 10 ? '0' : ''}${s}</span></div>
        <div>Level &nbsp;<span style="color:#BF77FF">${this.P.level}</span></div>
        <div>Kills &nbsp;<span style="color:#FFB627">${this.killCount}</span></div>
        <div style="margin-top:6px;color:#555;font-size:10px">${wList}</div>
      </div>
      <button class="btn" onclick="window.__game.newRun()">RUN AGAIN</button>`);
  }

  showStart() {
    showOverlay(`
      <div class="ov-title">GHOST</div>
      <div class="ov-sub">// infinite rogue //</div>
      <div style="max-width:260px;text-align:center;margin-bottom:28px;font-size:11px;color:#444;line-height:1.9">
        <span style="color:#00CFFF">❄ Cryo Lance</span> — slow · freeze · combo<br>
        Passive dodge: <span style="color:#1DFFD0">20%</span><br>
        <span style="color:#333">Unlock weapons as you level</span>
      </div>
      <button class="btn" onclick="window.__game.newRun()">JACK IN</button>`);
    window.__game = this;
  }

  draw() {
    const { ctx, W, H, P, shake } = this;
    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.fillStyle = '#08080f'; ctx.fillRect(-8, -8, W + 16, H + 16);

    ctx.strokeStyle = 'rgba(0,207,255,0.035)'; ctx.lineWidth = 1;
    const gs = 52;
    for (let x = 0; x < W + gs; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H + gs; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    drawParticles(ctx);

    this.gems.forEach(g => {
      ctx.fillStyle = '#7F77DD'; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(191,119,255,0.8)'; ctx.beginPath(); ctx.arc(g.x - 1, g.y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    enemies.forEach(e => {
      const col = e.hitFlash > 0 ? '#fff' : e.frozen ? '#00CFFF' : e.stunned ? '#BF77FF' : e.slowT > 0 ? '#7ecfef' : e.col;
      ctx.fillStyle = col + 'bb'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (e.shape === 'sq') ctx.rect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      else if (e.shape === 'tri') { ctx.moveTo(e.x, e.y - e.r); ctx.lineTo(e.x + e.r, e.y + e.r); ctx.lineTo(e.x - e.r, e.y + e.r); ctx.closePath(); }
      else ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (e.frozen) { ctx.strokeStyle = 'rgba(0,207,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (e.stunned) { ctx.strokeStyle = 'rgba(191,119,255,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2); ctx.stroke(); }
      const bw = e.r * 2 + 2;
      ctx.fillStyle = '#111'; ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw, 3);
      ctx.fillStyle = col; ctx.fillRect(e.x - e.r - 1, e.y - e.r - 9, bw * Math.max(0, e.hp / e.maxHp), 3);
    });

    bullets.filter(b => b.enemy).forEach(b => {
      ctx.fillStyle = '#FFB62766'; ctx.strokeStyle = '#FFB627'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    bullets.filter(b => !b.enemy).forEach(b => {
      ctx.shadowColor = b.col; ctx.shadowBlur = 10;
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    const fl = P.invT > 0 && Math.floor(P.invT * 12) % 2 === 0;
    ctx.shadowColor = fl ? '#fff' : '#1DFFD0'; ctx.shadowBlur = 14;
    ctx.fillStyle = fl ? '#fff' : '#1DFFD0';
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
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function wStats(wid, lvl, p) {
  const rb = p.rateBonus || 1;
  const r = ((({ cryo: 1.9, pulse: 0.65, emp: 0.4, swarm: 0 }[wid] || 0) + lvl * ({ cryo: .35, pulse: .1, emp: .1, swarm: 0 }[wid] || 0)) * rb).toFixed(1);
  if (wid === 'cryo') return [`Rate: ${r}/s`, lvl >= 2 ? 'Effect: FREEZE' : 'Effect: SLOW 50%', lvl >= 3 ? 'Shots: ×3' : 'Shots: ×1'];
  if (wid === 'pulse') return [`Rate: ${r}/s`, `Dmg: ${Math.round(p.dmg * (18 + lvl * 8))}`, lvl >= 2 ? '+ AoE on hit' : ''];
  if (wid === 'emp') return [`Rate: ${r}/s`, `Radius: ${160 + lvl * 55}px`, `Stun: ${(2 + lvl * 0.5).toFixed(1)}s`, lvl >= 3 ? '+ Stun explosion' : ''];
  if (wid === 'swarm') return [`Drones: ${1 + lvl}`, `Dmg/tick: ${Math.round(p.dmg * (7 + lvl * 3.5))}`, `Orbit: ${55 + lvl * 14}px`];
  return [];
}

function wDesc(wid, lvl) {
  return ({ cryo: { 1: 'Slows 50% for 2s', 2: 'Upgrade: full freeze 1.5s', 3: 'Upgrade: 3-shot spread' }, pulse: { 1: 'Heavy shot, high damage', 2: 'Upgrade: AoE explosion on hit', 3: 'Upgrade: pierces 1 enemy' }, emp: { 1: 'Radial shockwave, stuns all nearby', 2: 'Upgrade: wider radius', 3: 'Upgrade: stunned enemies explode' }, swarm: { 1: '2 orbiting drones', 2: 'Upgrade: 3 drones', 3: 'Upgrade: 4 drones' } }[wid] || {})[lvl] || '';
}

function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
