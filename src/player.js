export function mkPlayer(W, H) {
  return {
    x: W / 2, y: H / 2, r: 13,
    hp: 100, maxHp: 100,
    spd: 158, dmg: 1,
    mag: 85, dodge: 0.2,
    rateBonus: 1,
    w: { cryo: 1 },
    ft: {}, _dr: null,
    level: 1, xp: 0, xpNext: 18,
    invT: 0,
  };
}
