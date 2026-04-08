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

export function mkPlayer(W, H, char = CHARACTERS.ghost) {
  return {
    x: W / 2, y: H / 2, r: 13,
    hp: 100, maxHp: 100,
    spd: char.spd, dmg: 1,
    mag: 85, dodge: char.dodge,
    rateBonus: 1,
    w: { [char.startWeapon]: 1 },
    ft: {}, _dr: null,
    level: 1, xp: 0, xpNext: 18,
    invT: 0,
    char: char.id, col: char.col,
  };
}
