import { CHARACTERS, getOwnedWeaponIds, getWeaponLevel } from './player.js';
import { getSave, SYNERGIES, isDiscovered } from './progression.js';
import { WDEFS } from './weapons.js';

const discoveryQueue = [];
let discoveryActive = false;

export function initHUD() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="danger-vignette"></div>
    <div id="damage-flash"></div>
    <div id="topbar">
      <span class="stat" id="stat-hp">■ 100/100</span>
      <span class="stat" id="stat-time">0:00</span>
      <span class="stat" id="stat-info">LVL 1 · DODGE 20%</span>
    </div>
    <div id="hpbar-wrap"><div id="hpbar-damage" style="width:100%"></div><div id="hpbar-heal"></div><div id="hpbar" style="width:100%"></div></div>
    <div id="xpbar-wrap"><div id="xpbar"></div></div>
    <div id="surge">!! SURGE !!</div>
    <div id="bossbar-wrap">
      <div id="bossbar-label">◆ SIGNAL</div>
      <div id="bossbar-track"><div id="bossbar"></div></div>
    </div>
    <div id="discovery-banner-root"></div>
    <canvas id="c"></canvas>
    <div id="wbar">
      <div class="ws" id="ws0"></div>
      <div class="ws" id="ws1"></div>
      <div class="ws" id="ws2"></div>
      <div class="ws" id="ws3"></div>
    </div>
    <div id="joystick-zone">
      <div id="joystick"><div id="jknob"></div></div>
    </div>
    <button id="playtest-toggle" onclick="window.__game?.openPlaytestLab()" style="display:none">LAB</button>
    <div id="overlay"></div>`;
}

export function updateHUD(P, gt, WDEFS) {
  const hp = Math.ceil(Math.max(0, P.hp));
  const hpRatio = Math.max(0, P.hp / P.maxHp);
  document.getElementById('stat-hp').textContent = '■ ' + hp + '/' + P.maxHp;
  const app = document.getElementById('app');
  app.classList.toggle('low-health', hpRatio <= 0.3);
  app.classList.toggle('taking-damage', P.hurtFlash > 0.01);
  app.classList.toggle('barrier-heal-impact', (P.barrierHealImpactT || 0) > 0.01);
  const hpbar = document.getElementById('hpbar');
  const hpbarDamage = document.getElementById('hpbar-damage');
  const hpbarHeal = document.getElementById('hpbar-heal');
  hpbar.style.width = (hpRatio * 100) + '%';
  hpbarDamage.style.width = (Math.max(0, P.hpLag) / P.maxHp * 100) + '%';
  hpbar.style.background = P.hp < P.maxHp * 0.3 ? '#E24B4A' : P.hp < P.maxHp * 0.6 ? '#FFB627' : '#1DFFD0';
  if (hpbarHeal) {
    const healFrom = Math.max(0, P.barrierHealFrom || 0);
    const healTo = Math.max(healFrom, P.barrierHealTo || 0);
    hpbarHeal.style.left = (healFrom / P.maxHp * 100) + '%';
    hpbarHeal.style.width = ((healTo - healFrom) / P.maxHp * 100) + '%';
    hpbarHeal.style.opacity = `${Math.max(0, P.barrierHealT || 0)}`;
  }
  document.getElementById('damage-flash').style.opacity = Math.min(0.38, P.hurtFlash * 0.45);
  document.getElementById('danger-vignette').style.opacity = hpRatio <= 0.3 ? `${0.18 + (0.3 - hpRatio) * 1.35}` : '0';
  const m = Math.floor(gt / 60);
  const s = Math.floor(gt % 60);
  document.getElementById('stat-time').textContent = m + ':' + (s < 10 ? '0' : '') + s;
  document.getElementById('stat-info').textContent = 'LVL ' + P.level + ' · DODGE ' + Math.round(P.dodge * 100) + '%';
  document.getElementById('xpbar').style.width = (P.xp / P.xpNext * 100) + '%';
  const wids = getOwnedWeaponIds(P);
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('ws' + i);
    if (!el) continue;
    if (wids[i]) {
      const w = WDEFS[wids[i]];
      const ascended = !!P.ascensions?.[wids[i]];
      const isPulseOverload = wids[i] === 'pulse' && P.ascensions?.pulse === 'overload_round';
      const overloadCounter = isPulseOverload ? Math.max(0, Math.min(2, P._pulseOverloadCounter || 0)) : 0;
      const overloadGlow = isPulseOverload && overloadCounter === 2
        ? 'box-shadow:0 0 0 1px rgba(255,182,39,0.9), 0 0 14px rgba(255,182,39,0.55), inset 0 0 14px rgba(255,182,39,0.18);'
        : '';
      const tierLabel = ascended
        ? '<span style="color:#00CFFF">ASC</span>'
        : `T${getWeaponLevel(P, wids[i])}`;
      const overloadDots = isPulseOverload ? `
        <div style="display:flex;justify-content:center;gap:6px;margin-top:5px;min-height:8px">
          ${Array.from({ length: 3 }, (_, idx) => {
            const filled = idx < overloadCounter;
            return `<span style="width:8px;height:8px;border-radius:999px;display:block;background:${filled ? '#FFB627' : '#FFB62733'}"></span>`;
          }).join('')}
        </div>
      ` : '';
      el.className = 'ws on';
      el.style.cssText = overloadGlow;
      el.innerHTML = `<div class="wi" style="color:${w.col}">${w.icon}</div><div class="wn" style="color:${w.col}">${w.name}</div><div class="wt">${tierLabel}</div>${overloadDots}`;
    } else {
      el.className = 'ws';
      el.style.cssText = '';
      el.innerHTML = `<div class="wi" style="color:#282828">-</div><div class="wn" style="color:#282828">EMPTY</div>`;
    }
  }
}

export function showOverlay(html, className = '') {
  const ov = document.getElementById('overlay');
  ov.style.display = 'flex';
  ov.className = className ? className : '';
  ov.innerHTML = html;
}

export function hideOverlay() {
  const ov = document.getElementById('overlay');
  ov.style.display = 'none';
  ov.className = '';
}

export function setSurge(visible) {
  document.getElementById('surge').style.opacity = visible ? '1' : '0';
}

export function setBossBar(boss) {
  const wrap = document.getElementById('bossbar-wrap');
  if (!boss || !boss.alive) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  const bar = document.getElementById('bossbar');
  const pct = Math.max(0, boss.hp / boss.maxHp * 100);
  bar.style.width = pct + '%';
  const col = boss.phase === 3 ? '#8A2BE2' : boss.phase === 2 ? '#D4537E' : '#E24B4A';
  bar.style.background = col;
  const label = document.getElementById('bossbar-label');
  label.style.color = col;
  label.textContent = boss.phase === 3 ? '◆ SIGNAL // OVERCLOCK' : boss.phase === 2 ? '◆ SIGNAL // ENRAGED' : '◆ SIGNAL';
}

export function showDiscoveryBanner(synergy) {
  if (!synergy) return;
  discoveryQueue.push(synergy);
  if (!discoveryActive) drainDiscoveryQueue();
}

function drainDiscoveryQueue() {
  const synergy = discoveryQueue.shift();
  if (!synergy) {
    discoveryActive = false;
    return;
  }

  discoveryActive = true;
  const root = document.getElementById('discovery-banner-root');
  if (!root) {
    discoveryActive = false;
    return;
  }

  const splitIndex = Math.ceil(synergy.label.length / 2);
  const banner = document.createElement('div');
  banner.className = 'discovery-banner';
  banner.innerHTML = `
    <div class="discovery-kicker">// SYNERGY UNLOCKED //</div>
    <div class="discovery-label">
      <span style="color:${synergy.colours[0]}">${synergy.label.slice(0, splitIndex)}</span><span style="color:${synergy.colours[1]}">${synergy.label.slice(splitIndex)}</span>
    </div>
    <div class="discovery-desc">${synergy.description}</div>`;
  root.appendChild(banner);

  requestAnimationFrame(() => banner.classList.add('show'));

  window.setTimeout(() => {
    banner.classList.add('hide');
    window.setTimeout(() => {
      banner.remove();
      discoveryActive = false;
      drainDiscoveryQueue();
    }, 400);
  }, 2300);
}

export function showDiscoveryOverlay(synergy, onContinue) {
  if (!synergy) return;
  window.__hudDiscoveryContinue = () => {
    if (typeof onContinue === 'function') onContinue();
  };
  const splitIndex = Math.ceil(synergy.label.length / 2);
  showOverlay(`
    <div class="discovery-shell">
      <div class="discovery-panel">
        <div class="discovery-kicker">// SYNERGY DISCOVERED //</div>
        <div class="discovery-title">
          <span style="color:${synergy.colours[0]}">${synergy.label.slice(0, splitIndex)}</span><span style="color:${synergy.colours[1]}">${synergy.label.slice(splitIndex)}</span>
        </div>
        <div class="discovery-copy">This interaction has been recorded in your run history.</div>
        <div class="discovery-detail">
          <div class="discovery-detail-label">UNLOCKED EFFECT</div>
          <div class="discovery-detail-text">${synergy.description}</div>
        </div>
        <div class="menu-actions">
          <button class="btn" onclick="window.__hudDiscoveryContinue()">CONTINUE</button>
        </div>
      </div>
    </div>`, 'discovery-screen');
}

export function showAscensionDraft(weaponId, options, onPick) {
  const weapon = WDEFS[weaponId];
  window.__hudAscensionPick = ascensionId => {
    if (typeof onPick === 'function') onPick(ascensionId);
  };

  const cards = options.map(option => `
    <button
      class="uc wep"
      style="border:1px solid rgba(0,207,255,0.85);box-shadow:0 0 0 2px rgba(0,207,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08);background:linear-gradient(180deg, rgba(5,14,20,0.98), rgba(11,19,28,0.98));text-align:left"
      onclick="window.__hudAscensionPick('${option.id}')">
      <div class="ut" style="color:#00CFFF">ASCENSION</div>
      <div class="un" style="color:${weapon.col};font-size:18px">${option.name}</div>
      <div class="us" style="color:#9aa8b5;line-height:1.5">${option.description}</div>
    </button>
  `).join('');

  showOverlay(`
    <div style="width:min(1100px,92vw);text-align:center">
      <div style="color:#00CFFF;font-size:10px;letter-spacing:4px;margin-bottom:8px">// ASCENSION UNLOCKED //</div>
      <div style="font-size:18px;letter-spacing:2px;color:${weapon.col};margin-bottom:6px">${weapon.icon} ${weapon.name}</div>
      <div style="font-size:10px;letter-spacing:2px;color:#5f6d7a;margin-bottom:20px">// THIS WEAPON HAS REACHED ITS LIMIT. CHOOSE ITS TRANSFORMATION. //</div>
      <div class="upg-grid">${cards}</div>
    </div>
  `, 'ascension-screen');
}

export function showRecordsScreen(onBack) {
  const save = getSave();
  const global = save.personalBests.global;
  const perCharacter = save.personalBests.perCharacter;
  const discoveredCount = SYNERGIES.filter(s => isDiscovered(s.id)).length;
  window.__hudRecordsBack = () => {
    if (typeof onBack === 'function') onBack();
  };

  const charBlocks = Object.values(CHARACTERS).map(char => {
    const bests = perCharacter[char.id];
    if (!bests?.totalRuns) {
      return `
        <div class="records-char-block">
          <div class="records-char-name" style="color:${char.col}">${char.name}</div>
          <div class="records-empty">- no runs yet -</div>
        </div>`;
    }

    return `
      <div class="records-char-block">
        <div class="records-char-name" style="color:${char.col}">${char.name}</div>
        <div class="records-list">
          <div><span>BEST TIME</span><strong>${formatTime(bests.bestTime)}</strong></div>
          <div><span>MOST KILLS</span><strong>${bests.mostKills}</strong></div>
          <div><span>HIGHEST LEVEL</span><strong>${bests.highestLevel}</strong></div>
          <div><span>TOTAL RUNS</span><strong>${bests.totalRuns}</strong></div>
        </div>
      </div>`;
  }).join('');

  const synergyBlocks = SYNERGIES.map(synergy => {
    if (isDiscovered(synergy.id)) {
      return `
        <div class="records-synergy">
          <div class="records-synergy-label">${synergy.label}</div>
          <div class="records-synergy-desc">${synergy.description}</div>
        </div>`;
    }

    return `
      <div class="records-synergy records-synergy-unknown">
        <div class="records-synergy-label">??? UNKNOWN SYNERGY</div>
        <div class="records-synergy-desc">// trigger this combination to unlock //</div>
      </div>`;
  }).join('');

  showOverlay(`
    <div class="records-shell">
      <div class="records-head">
        <div class="ov-title">RECORDS</div>
        <div class="ov-sub">// run history // build discoveries //</div>
      </div>
      <div class="records-grid">
        <section class="records-panel">
          <div class="panel-label">GLOBAL BESTS</div>
          <div class="records-list">
            <div><span>BEST TIME</span><strong>${formatTime(global.bestTime)}</strong></div>
            <div><span>MOST KILLS</span><strong>${global.mostKills}</strong></div>
            <div><span>HIGHEST LEVEL</span><strong>${global.highestLevel}</strong></div>
            <div><span>TOTAL RUNS</span><strong>${global.totalRuns}</strong></div>
          </div>
        </section>
        <section class="records-panel">
          <div class="panel-label">SYNERGIES ${discoveredCount} / ${SYNERGIES.length}</div>
          <div class="records-synergy-list">${synergyBlocks}</div>
        </section>
      </div>
      <section class="records-panel">
        <div class="panel-label">PER CHARACTER</div>
        <div class="records-char-grid">${charBlocks}</div>
      </section>
      <div class="menu-actions">
        <button class="btn btn-secondary" onclick="window.__hudRecordsBack()">BACK</button>
      </div>
    </div>`, 'records-screen');
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
