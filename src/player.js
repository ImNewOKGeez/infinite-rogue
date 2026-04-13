import { WORLD_H, WORLD_W } from './constants.js';

export const CHARACTERS = {
  ghost: {
    id: 'ghost', name: 'GHOST', col: '#1DFFD0',
    startWeapon: 'cryo',
    dodge: 0.2, spd: 158,
  },
  bruiser: {
    id: 'bruiser', name: 'BRUISER', col: '#FFB627',
    startWeapon: 'pulse',
    dodge: 0.05, spd: 130,
  },
  hacker: {
    id: 'hacker', name: 'HACKER', col: '#BF77FF',
    startWeapon: 'emp',
    dodge: 0.12, spd: 145,
  },
};

export function mkWeaponState(lvl = 0) {
  return {
    owned: lvl > 0,
    lvl,
    runtime: {},
  };
}

export function getWeaponState(p, wid) {
  return p.ws[wid] || null;
}

export function getWeaponLevel(p, wid) {
  return getWeaponState(p, wid)?.lvl || 0;
}

export function hasAscension(p, weaponId, ascensionId) {
  return p.ascensions?.[weaponId] === ascensionId;
}

export function getAscension(p, weaponId) {
  return p.ascensions?.[weaponId] || null;
}

export function getAscensionTier(p, weaponId) {
  if (!getAscension(p, weaponId)) return 0;
  return Math.max(1, Math.min(5, p.ascensionTiers?.[weaponId] || 1));
}

export function getOwnedWeaponIds(p) {
  return Object.entries(p.ws)
    .filter(([, state]) => state.owned && state.lvl > 0)
    .map(([wid]) => wid);
}

export function addWeapon(p, wid, lvl = 1) {
  const state = p.ws[wid] || mkWeaponState();
  state.owned = true;
  if (state.lvl < lvl) state.lvl = lvl;
  p.ws[wid] = state;
  return state;
}

export function upgradeWeaponLevel(p, wid, nextLvl = null) {
  const state = addWeapon(p, wid, 1);
  state.lvl = nextLvl ?? (state.lvl + 1);
  return state;
}

export function mkPlayer(_W, _H, char = CHARACTERS.ghost) {
  const ws = {
    cryo: mkWeaponState(),
    pulse: mkWeaponState(),
    emp: mkWeaponState(),
    swarm: mkWeaponState(),
    molotov: mkWeaponState(),
    barrier: mkWeaponState(),
    arcblade: mkWeaponState(),
  };
  ws[char.startWeapon] = mkWeaponState(1);
  return {
    x: WORLD_W / 2, y: WORLD_H / 2, r: 13,
    hp: 100, maxHp: 100,
    hpLag: 100,
    spd: char.spd, dmg: 1,
    mag: 85, dodge: char.dodge,
    rateBonus: 1,
    ws,
    ascensions: {},
    ascensionTiers: {},
    _arcDiscs: [],
    _sawBlade: null,
    _lanceCounter: 0,
    _molotovTimer: 0,
    _firePools: [],
    _bottles: [],
    _pulseOverloadCounter: 0,
    _pulseMines: [],
    _novaDrones: [],
    _splitDrones: [],
    ft: {}, _dr: null,
    level: 1, xp: 0, xpNext: 14,
    invT: 0,
    hurtFlash: 0,
    char: char.id, col: char.col,
  };
}
