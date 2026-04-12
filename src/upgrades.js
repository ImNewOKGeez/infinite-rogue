import { addWeapon, getOwnedWeaponIds, getWeaponLevel, upgradeWeaponLevel } from './player.js';
import { ASCENSIONS, bullets, WDEFS } from './weapons.js';

export const PASSIVES = [
  { id: 'spd', label: 'SPRINT', apply: p => { const w = p.spd; p.spd = Math.round(p.spd * 1.22); return [`Speed: ${w} -> ${p.spd}`]; } },
  { id: 'dmg', label: 'OVERCLOCK', apply: p => { const w = p.dmg.toFixed(1); p.dmg *= 1.25; return [`Dmg mult: x${w} -> x${p.dmg.toFixed(1)}`]; } },
  { id: 'mag', label: 'MAGNET', apply: p => { const w = Math.round(p.mag); p.mag = Math.round(p.mag * 1.6); return [`Magnet: ${w} -> ${p.mag}px`]; } },
  { id: 'hp', label: 'NANO-REPAIR', apply: p => { const oldMax = p.maxHp; const oldHp = p.hp; p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); return [`Max HP: ${oldMax} -> ${p.maxHp}`, `Restored: +${Math.round(p.hp - oldHp)}`]; } },
  { id: 'dg', label: 'GHOST STEP', apply: p => { const w = Math.round(p.dodge * 100); p.dodge = Math.min(0.65, p.dodge + 0.12); return [`Dodge: ${w}% -> ${Math.round(p.dodge * 100)}%`]; } },
  { id: 'rt', label: 'OVERCLOCK FIRE', apply: p => { const w = (p.rateBonus || 1).toFixed(1); p.rateBonus = (p.rateBonus || 1) * 1.25; return [`Fire rate: x${w} -> x${p.rateBonus.toFixed(1)}`]; } },
];

export function buildPool(p, options = {}) {
  const { allowAscension = true } = options;
  const weps = [];
  const slots = getOwnedWeaponIds(p).length;
  Object.keys(WDEFS).forEach(wid => {
    const lvl = getWeaponLevel(p, wid);
    const maxLvl = WDEFS[wid]?.maxLvl || 5;
    if (lvl > 0 && lvl < maxLvl) weps.push({ id: 'wu_' + wid, type: 'wep', wid, lvl: lvl + 1 });
    else if (lvl === 0 && slots < 4) weps.push({ id: 'wn_' + wid, type: 'wep', wid, lvl: 1, isNew: true });
  });

  const pas = [...PASSIVES].sort(() => Math.random() - 0.5);
  const weaponPool = [...weps];
  const pool = [];

  if (weaponPool.length) pool.push(pickRandom(weaponPool));
  if (pas.length) {
    const item = pas.shift();
    pool.push({ ...item, id: 'p_' + item.id, type: 'pas' });
  }
  while (pool.length < 3 && weaponPool.length) {
    const next = pickRandom(weaponPool);
    if (!pool.find(x => x.id === next.id)) pool.push(next);
  }
  while (pool.length < 3 && pas.length) {
    const item = pas.shift();
    if (!pool.find(x => x.id === 'p_' + item.id)) pool.push({ ...item, id: 'p_' + item.id, type: 'pas' });
  }

  if (allowAscension) {
    const ascEligible = getOwnedWeaponIds(p).filter(wid =>
      getWeaponLevel(p, wid) >= 5 &&
      !p.ascensions?.[wid] &&
      ASCENSIONS[wid]?.length > 0
    );

    if (ascEligible.length > 0 && Math.random() < 0.40 && pool.length) {
      const wid = ascEligible[Math.floor(Math.random() * ascEligible.length)];
      const ascPool = [...ASCENSIONS[wid]].sort(() => Math.random() - 0.5);
      const ascCard = {
        id: 'asc_' + wid,
        type: 'ascension',
        wid,
        options: ascPool.slice(0, Math.min(3, ascPool.length)),
      };
      pool[pool.length - 1] = ascCard;
    }
  }

  return pool.slice(0, 3);
}

export function applyUpgrade(id, p) {
  if (id.startsWith('wu_')) {
    const wid = id.slice(3);
    upgradeWeaponLevel(p, wid);
    if (wid === 'swarm') p._dr = null;
    return;
  }
  if (id.startsWith('wn_')) {
    const wid = id.slice(3);
    addWeapon(p, wid, 1);
    if (wid === 'swarm') p._dr = null;
    return;
  }
  if (id.startsWith('p_')) {
    const pid = id.slice(2);
    const u = PASSIVES.find(x => x.id === pid);
    if (u) u.apply(p);
  }
}

export function applyAscension(p, weaponId, ascensionId) {
  if (!p.ascensions) p.ascensions = {};
  p.ascensions[weaponId] = ascensionId;

  if (weaponId === 'cryo') {
    p.ft.cryo = 0;
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].meta?.type === 'cryo') bullets.splice(i, 1);
    }
  }
}

function pickRandom(arr) {
  return arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
}
