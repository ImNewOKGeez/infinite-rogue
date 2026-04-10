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

export function hasWeapon(p, wid) {
  return getWeaponLevel(p, wid) > 0;
}

export function hasAscension(p, weaponId, ascensionId) {
  return p.ascensions?.[weaponId] === ascensionId;
}

export function getAscension(p, weaponId) {
  return p.ascensions?.[weaponId] || null;
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

export function mkPlayer(W, H, char = CHARACTERS.ghost) {
  const ws = {
    cryo: mkWeaponState(),
    pulse: mkWeaponState(),
    emp: mkWeaponState(),
    swarm: mkWeaponState(),
    barrier: mkWeaponState(),
  };
  ws[char.startWeapon] = mkWeaponState(1);
  return {
    x: W / 2, y: H / 2, r: 13,
    hp: 100, maxHp: 100,
    hpLag: 100,
    spd: char.spd, dmg: 1,
    mag: 85, dodge: char.dodge,
    rateBonus: 1,
    ws,
    ascensions: {},
    ft: {}, _dr: null, _miniDr: [],
    level: 1, xp: 0, xpNext: 14,
    invT: 0,
    hurtFlash: 0,
    char: char.id, col: char.col,
  };
}
