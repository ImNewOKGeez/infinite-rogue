import { BOSS_SPAWN_TIME } from './boss.js';
import { wStats, weaponUnlockDesc } from './gameUi.js';
import { addWeapon, mkPlayer, mkWeaponState } from './player.js';
import { PASSIVES, applyAscension, applyAscensionTier } from './upgrades.js';
import { ASCENSIONS, WDEFS } from './weapons.js';

export const LAB_WEAPON_INPUTS = {
  cryo: { inputId: 'lab-w-cryo', label: 'Cryo', min: 0, max: 5, step: 1 },
  pulse: { inputId: 'lab-w-pulse', label: 'Pulse', min: 0, max: 5, step: 1 },
  emp: { inputId: 'lab-w-emp', label: 'EMP', min: 0, max: 5, step: 1 },
  swarm: { inputId: 'lab-w-swarm', label: 'Swarm', min: 0, max: 5, step: 1 },
  molotov: { inputId: 'lab-w-molotov', label: 'Molotov', min: 0, max: 5, step: 1 },
  barrier: { inputId: 'lab-w-barrier', label: 'Barrier', min: 0, max: 5, step: 1 },
  arcblade: { inputId: 'lab-w-arcblade', label: 'Arc Blade', min: 0, max: 5, step: 1 },
};

export const LAB_PASSIVE_INPUTS = {
  spd: { inputId: 'lab-p-spd', label: 'Sprint (speed)', min: 0, max: 8, step: 1 },
  dmg: { inputId: 'lab-p-dmg', label: 'Overclock (damage)', min: 0, max: 8, step: 1 },
  mag: { inputId: 'lab-p-mag', label: 'Magnet', min: 0, max: 8, step: 1 },
  hp: { inputId: 'lab-p-hp', label: 'Nano-Repair (HP)', min: 0, max: 8, step: 1 },
  dg: { inputId: 'lab-p-dg', label: 'Ghost Step (dodge)', min: 0, max: 8, step: 1 },
  rt: { inputId: 'lab-p-rt', label: 'Overclock Fire', min: 0, max: 8, step: 1 },
};

export const PLAYTEST_LAB_PRESETS = {
  lategame: {
    'lab-timeskip': 300,
    'lab-surgecount': 7,
    'lab-w-cryo': 3,
    'lab-w-pulse': 3,
    'lab-w-emp': 2,
    'lab-w-swarm': 0,
    'lab-w-molotov': 0,
    'lab-w-barrier': 0,
    'lab-w-arcblade': 0,
    'lab-p-dmg': 2,
    'lab-p-spd': 1,
    'lab-p-mag': 0,
    'lab-p-hp': 0,
    'lab-p-dg': 0,
    'lab-p-rt': 1,
    'lab-stat-hp': 160,
    'lab-stat-level': 15,
  },
  bosstest: {
    'lab-timeskip': 110,
    'lab-surgecount': 2,
    'lab-w-cryo': 3,
    'lab-w-pulse': 2,
    'lab-w-emp': 0,
    'lab-w-swarm': 0,
    'lab-w-molotov': 0,
    'lab-w-barrier': 0,
    'lab-w-arcblade': 0,
    'lab-p-dmg': 1,
    'lab-p-spd': 1,
    'lab-p-mag': 0,
    'lab-p-hp': 0,
    'lab-p-dg': 0,
    'lab-p-rt': 0,
    'lab-stat-hp': 130,
    'lab-stat-level': 8,
  },
  maxweapon: {
    'lab-timeskip': 180,
    'lab-surgecount': 4,
    'lab-w-cryo': 5,
    'lab-w-pulse': 0,
    'lab-w-emp': 0,
    'lab-w-swarm': 0,
    'lab-w-molotov': 0,
    'lab-w-barrier': 0,
    'lab-w-arcblade': 0,
    'lab-p-dmg': 3,
    'lab-p-spd': 2,
    'lab-p-mag': 0,
    'lab-p-hp': 0,
    'lab-p-dg': 0,
    'lab-p-rt': 2,
    'lab-stat-hp': 190,
    'lab-stat-level': 12,
  },
};

export function createPlaytestBuild(char) {
  const build = {
    charId: char.id,
    weapons: Object.fromEntries(Object.keys(WDEFS).map(wid => [wid, 0])),
    passives: Object.fromEntries(PASSIVES.map(passive => [passive.id, 0])),
    ascensions: Object.fromEntries(Object.keys(WDEFS).map(wid => [wid, null])),
    ascensionTiers: Object.fromEntries(Object.keys(WDEFS).map(wid => [wid, 0])),
  };
  build.weapons[char.startWeapon] = 1;
  return build;
}

export function sanitizePlaytestBuild(build, char) {
  const base = createPlaytestBuild(char);
  const next = {
    charId: char.id,
    weapons: { ...base.weapons, ...(build?.weapons || {}) },
    passives: { ...base.passives, ...(build?.passives || {}) },
    ascensions: { ...base.ascensions, ...(build?.ascensions || {}) },
    ascensionTiers: { ...base.ascensionTiers, ...(build?.ascensionTiers || {}) },
  };

  Object.keys(next.weapons).forEach(wid => {
    next.weapons[wid] = clamp(Math.round(next.weapons[wid] || 0), 0, 5);
  });

  Object.keys(next.passives).forEach(pid => {
    next.passives[pid] = clamp(Math.round(next.passives[pid] || 0), 0, 8);
  });

  Object.keys(next.ascensions).forEach(wid => {
    const options = ASCENSIONS[wid] || [];
    const chosen = next.ascensions[wid];
    if ((next.weapons[wid] || 0) < 5) {
      next.ascensions[wid] = null;
      next.ascensionTiers[wid] = 0;
      return;
    }
    next.ascensions[wid] = options.some(option => option.id === chosen) ? chosen : null;
    next.ascensionTiers[wid] = next.ascensions[wid]
      ? clamp(Math.round(next.ascensionTiers[wid] || 1), 1, 5)
      : 0;
  });

  return next;
}

export function previewPlaytestPlayer(char, build) {
  const player = mkPlayer(0, 0, char);
  const safeBuild = sanitizePlaytestBuild(build, char);
  Object.keys(player.ws).forEach(wid => {
    player.ws[wid] = mkWeaponState();
  });

  Object.entries(safeBuild.weapons).forEach(([wid, lvl]) => {
    if (lvl > 0) addWeapon(player, wid, lvl);
  });

  PASSIVES.forEach(passive => {
    const count = safeBuild.passives[passive.id] || 0;
    for (let i = 0; i < count; i++) passive.apply(player);
  });

  Object.entries(safeBuild.ascensions || {}).forEach(([wid, ascensionId]) => {
    if (!ascensionId) return;
    if ((safeBuild.weapons[wid] || 0) < 5) return;
    applyAscension(player, wid, ascensionId, { preview: true });
    applyAscensionTier(player, wid, safeBuild.ascensionTiers?.[wid] || 1);
  });

  player.hp = player.maxHp;
  player.hpLag = player.maxHp;
  return player;
}

export function renderPlaytestLab(build, char, isRunActive, worldDebug, labState) {
  const safeBuild = sanitizePlaytestBuild(build, char);
  const safeState = labState || createPlaytestLabState();
  const summary = previewPlaytestPlayer(char, safeBuild);

  const ascensionCards = Object.entries(ASCENSIONS).map(([wid, options]) => {
    const weapon = WDEFS[wid];
    const lvl = safeBuild.weapons[wid] || 0;
    const selected = safeBuild.ascensions?.[wid] || null;
    const ascTier = safeBuild.ascensionTiers?.[wid] || 0;
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
        <div class="playtest-item-copy">${selected ? `Selected: ${options.find(option => option.id === selected)?.name || 'None'} T${ascTier || 1}` : 'No ascension selected'}</div>
        ${selected ? `<div class="playtest-card-top"><div class="playtest-item-copy">Ascension tier</div><div class="playtest-stepper"><button class="playtest-step" ${(ascTier || 1) > 1 ? '' : 'disabled'} onclick="window.__game.playtestSetAscensionTier('${wid}', -1)">-</button><span class="playtest-value">${ascTier || 1}</span><button class="playtest-step" ${(ascTier || 1) < 5 ? '' : 'disabled'} onclick="window.__game.playtestSetAscensionTier('${wid}', 1)">+</button></div></div>` : ''}
        <div class="playtest-ascension-list">${optionButtons}</div>
      </div>`;
  }).join('');

  const weaponCards = Object.keys(WDEFS).map(wid => {
    const weapon = WDEFS[wid];
    const lvl = safeBuild.weapons[wid] || 0;
    const stats = lvl > 0 ? wStats(wid, lvl, summary) : [weaponUnlockDesc(wid)];
    return `
      <div class="playtest-card">
        <div class="playtest-card-top">
          <div>
            <div class="playtest-item-name" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</div>
            <div class="playtest-item-copy">${lvl > 0 ? `Tier ${lvl}` : 'Not equipped'}</div>
          </div>
          <div class="playtest-stepper">
            <button class="playtest-step" ${lvl > 0 ? '' : 'disabled'} onclick="window.__game.playtestAdjustWeapon('${wid}', -1)">-</button>
            <span class="playtest-value">${lvl}</span>
            <button class="playtest-step" ${lvl < 5 ? '' : 'disabled'} onclick="window.__game.playtestAdjustWeapon('${wid}', 1)">+</button>
          </div>
        </div>
        <div class="playtest-item-copy">Tap to slot in or remove this weapon instantly.</div>
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

  const weaponInputRows = renderInputRows(LAB_WEAPON_INPUTS, safeState.weapons);
  const passiveInputRows = renderInputRows(LAB_PASSIVE_INPUTS, safeState.passives);
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
      <section class="records-panel">
        <div class="lab-section">
          <div class="lab-label">// TIME SKIP //</div>
          <div class="lab-row">
            <label for="lab-timeskip">Jump to (seconds):</label>
            <input type="number" id="lab-timeskip" value="${safeState.timeSkipSeconds}" min="0" max="600" step="30">
          </div>
          <div class="lab-row">
            <label for="lab-surgecount">Surge count override:</label>
            <input type="number" id="lab-surgecount" value="${safeState.surgeCount}" min="0" max="10" step="1">
          </div>
          <button type="button" id="lab-apply-time">APPLY TIME SKIP</button>
          <div class="lab-hint">Sets game clock and surge count. Enemies scale to the new time immediately.</div>
        </div>
        <div class="lab-section">
          <div class="lab-label">// INSTANT LOADOUT //</div>
          <div class="lab-label-sub">Weapons (level 0 = not equipped)</div>
          ${weaponInputRows}
          <div class="lab-label-sub">Passives (number of times applied)</div>
          ${passiveInputRows}
          <div class="lab-label-sub">Player stats</div>
          <div class="lab-row"><label for="lab-stat-hp">HP:</label><input type="number" id="lab-stat-hp" value="${safeState.stats.hp}" min="1" max="999" step="10"></div>
          <div class="lab-row"><label for="lab-stat-level">Player level:</label><input type="number" id="lab-stat-level" value="${safeState.stats.level}" min="1" max="50" step="1"></div>
          <button type="button" id="lab-apply-loadout">APPLY LOADOUT</button>
          <div class="lab-hint">Applies instantly to current run. Start a run first.</div>
        </div>
        <div class="lab-section">
          <div class="lab-label">// PRESETS //</div>
          <button type="button" id="lab-preset-lategame">LATE GAME (5 min)</button>
          <button type="button" id="lab-preset-bosstest">BOSS TEST</button>
          <button type="button" id="lab-preset-maxweapon">MAX SINGLE WEAPON</button>
        </div>
      </section>
      <div class="menu-actions">${actions}</div>
      ${isRunActive ? '<div class="playtest-hint">Tap LAB or press L during a test run to reopen this panel.</div>' : ''}
    </div>`;
}

export function createPlaytestLabState() {
  return {
    timeSkipSeconds: 0,
    surgeCount: 0,
    weapons: Object.fromEntries(Object.keys(LAB_WEAPON_INPUTS).map(wid => [wid, 0])),
    passives: Object.fromEntries(Object.keys(LAB_PASSIVE_INPUTS).map(pid => [pid, 0])),
    stats: {
      hp: 100,
      level: 1,
    },
  };
}

export function getXpTargetForLevel(level) {
  let xpNext = 14;
  for (let current = 1; current < Math.max(1, level); current++) {
    xpNext = Math.floor(xpNext * 1.22);
  }
  return xpNext;
}

export function getNextSurgeTime(time) {
  return (Math.floor(Math.max(0, time) / 40) + 1) * 40;
}

export function getLabNextBossTime(time) {
  if (time < BOSS_SPAWN_TIME) return BOSS_SPAWN_TIME;
  return time + 10;
}

function renderInputRows(configs, values) {
  return Object.entries(configs).map(([id, config]) => `
    <div class="lab-row">
      <label for="${config.inputId}">${config.label}:</label>
      <input
        type="number"
        id="${config.inputId}"
        value="${values[id] ?? 0}"
        min="${config.min}"
        max="${config.max}"
        step="${config.step}">
    </div>
  `).join('');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
