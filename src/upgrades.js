export const PASSIVES = [
  { id: 'spd', label: 'SPRINT',       apply: p => { const w = p.spd; p.spd = Math.round(p.spd * 1.22); return [`Speed: ${w} → ${p.spd}`]; } },
  { id: 'dmg', label: 'OVERCLOCK',    apply: p => { const w = p.dmg.toFixed(1); p.dmg *= 1.25; return [`Dmg mult: ×${w} → ×${p.dmg.toFixed(1)}`]; } },
  { id: 'mag', label: 'MAGNET',       apply: p => { const w = Math.round(p.mag); p.mag = Math.round(p.mag * 1.6); return [`Magnet: ${w} → ${p.mag}px`]; } },
  { id: 'hp',  label: 'NANO-REPAIR',  apply: p => { const oldMax = p.maxHp; p.maxHp += 30; const healed = Math.min(30, p.maxHp - p.hp); p.hp = Math.min(p.maxHp, p.hp + 30); return [`Max HP: ${oldMax} → ${p.maxHp}`, `Restored: +${Math.round(healed)}`]; } },
  { id: 'dg',  label: 'GHOST STEP',   apply: p => { const w = Math.round(p.dodge * 100); p.dodge = Math.min(0.65, p.dodge + 0.12); return [`Dodge: ${w}% → ${Math.round(p.dodge * 100)}%`]; } },
  { id: 'rt',  label: 'OVERCLOCK FIRE', apply: p => { const w = (p.rateBonus || 1).toFixed(1); p.rateBonus = (p.rateBonus || 1) * 1.25; return [`Fire rate: ×${w} → ×${p.rateBonus.toFixed(1)}`]; } },
];

export function buildPool(p, WDEFS) {
  const weps = [];
  ['cryo', 'pulse', 'emp', 'swarm'].forEach(wid => {
    const lvl = p.w[wid] || 0, slots = Object.keys(p.w).length;
    if (lvl > 0 && lvl < 3) weps.push({ id: 'wu_' + wid, type: 'wep', wid, lvl: lvl + 1 });
    else if (lvl === 0 && slots < 4) weps.push({ id: 'wn_' + wid, type: 'wep', wid, lvl: 1, isNew: true });
  });
  const pas = [...PASSIVES].sort(() => Math.random() - 0.5);
  const pool = [];
  if (weps.length) pool.push(weps[Math.floor(Math.random() * weps.length)]);
  while (pool.length < 3 && pas.length) pool.push({ ...pas.shift(), id: 'p_' + pas[0]?.id, type: 'pas' });
  while (pool.length < 3 && weps.length) {
    const w = weps.splice(Math.floor(Math.random() * weps.length), 1)[0];
    if (!pool.find(x => x.id === w.id)) pool.push(w);
  }
  return pool.slice(0, 3);
}

export function applyUpgrade(id, p) {
  if (id.startsWith('wu_')) { const wid = id.slice(3); p.w[wid]++; if (wid === 'swarm') p._dr = null; }
  else if (id.startsWith('wn_')) { const wid = id.slice(3); p.w[wid] = 1; if (wid === 'swarm') p._dr = null; }
  else if (id.startsWith('p_')) { const pid = id.slice(2); const u = PASSIVES.find(x => x.id === pid); if (u) u.apply(p); }
}
