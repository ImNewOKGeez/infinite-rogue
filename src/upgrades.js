import { addWeapon, getOwnedWeaponIds, getWeaponLevel, upgradeWeaponLevel } from './player.js';

export const PASSIVES = [
  { id: 'spd', label: 'SPRINT', apply: p => { const w = p.spd; p.spd = Math.round(p.spd * 1.22); return [`Speed: ${w} -> ${p.spd}`]; } },
  { id: 'dmg', label: 'OVERCLOCK', apply: p => { const w = p.dmg.toFixed(1); p.dmg *= 1.25; return [`Dmg mult: x${w} -> x${p.dmg.toFixed(1)}`]; } },
  { id: 'mag', label: 'MAGNET', apply: p => { const w = Math.round(p.mag); p.mag = Math.round(p.mag * 1.6); return [`Magnet: ${w} -> ${p.mag}px`]; } },
  { id: 'hp', label: 'NANO-REPAIR', apply: p => { const oldMax = p.maxHp; const oldHp = p.hp; p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); return [`Max HP: ${oldMax} -> ${p.maxHp}`, `Restored: +${Math.round(p.hp - oldHp)}`]; } },
  { id: 'dg', label: 'GHOST STEP', apply: p => { const w = Math.round(p.dodge * 100); p.dodge = Math.min(0.65, p.dodge + 0.12); return [`Dodge: ${w}% -> ${Math.round(p.dodge * 100)}%`]; } },
  { id: 'rt', label: 'OVERCLOCK FIRE', apply: p => { const w = (p.rateBonus || 1).toFixed(1); p.rateBonus = (p.rateBonus || 1) * 1.25; return [`Fire rate: x${w} -> x${p.rateBonus.toFixed(1)}`]; } },
];

export function buildPool(p) {
  const weps = [];
  ['cryo', 'pulse', 'emp', 'swarm'].forEach(wid => {
    const lvl = getWeaponLevel(p, wid);
    const slots = getOwnedWeaponIds(p).length;
    const maxLvl = { cryo: 5, pulse: 5, emp: 5, swarm: 5 }[wid] || 3;
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
  return pool.slice(0, 3);
}

export function applyUpgrade(id, p) {
  if (id.startsWith('wu_')) {
    const wid = id.slice(3);
    upgradeWeaponLevel(p, wid);
    if (wid === 'swarm') { p._dr = null; p._miniDr = []; }
    return;
  }
  if (id.startsWith('wn_')) {
    const wid = id.slice(3);
    addWeapon(p, wid, 1);
    if (wid === 'swarm') { p._dr = null; p._miniDr = []; }
    return;
  }
  if (id.startsWith('p_')) {
    const pid = id.slice(2);
    const u = PASSIVES.find(x => x.id === pid);
    if (u) u.apply(p);
  }
}

function pickRandom(arr) {
  return arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
}
