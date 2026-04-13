import { ARC_BLADE_TIERS } from './arcBlade.js';
import { getAscensionTier, getOwnedWeaponIds, getWeaponLevel } from './player.js';
import { ASCENSIONS, EMP_SCALING, MOLOTOV_TIERS, WDEFS, getAscensionTierDefinition } from './weapons.js';

export function wStats(wid, lvl, p) {
  const rb = p.rateBonus || 1;
  const empScaling = EMP_SCALING[Math.min(Math.max(lvl, 1), 5)] || EMP_SCALING[1];
  const molotovTier = MOLOTOV_TIERS[Math.min(Math.max(lvl, 1), 5)] || MOLOTOV_TIERS[1];
  const arcTier = ARC_BLADE_TIERS[Math.min(Math.max(lvl, 1), 5)] || ARC_BLADE_TIERS[1];
  const rates = {
    cryo: (1.9 + lvl * 0.35) * rb,
    pulse: 0.45 * rb,
    emp: 0.4 * rb,
    swarm: 0,
    molotov: 1 / (molotovTier.fireRate * (1 / rb)),
    barrier: 0,
    arcblade: 0,
  };
  const rate = (rates[wid] || 0).toFixed(1);

  if (wid === 'cryo') return [`Rate: ${rate}/s`, `Projectiles: ${Math.min(5, Math.max(1, lvl))}`, lvl >= 2 ? 'Spread: widening fan' : 'Slow: 50% for 2s', 'Pierce: 1 enemy'];
  if (wid === 'pulse') return [`Rate: ${rate}/s`, `Dmg: ${Math.round(p.dmg * (28 + lvl * 10))}`, 'Impact: heavy explosive shot', lvl >= 2 ? 'Cluster: splits on impact' : 'Cooldown: long', lvl >= 5 ? 'Cluster: four split layers' : lvl >= 4 ? 'Cluster: three split layers' : lvl >= 3 ? 'Cluster: bomblets split again' : ''];
  if (wid === 'emp') return [`Rate: ${rate}/s`, `Radius: ${empScaling.radius}px`, `Stun: ${empScaling.stun.toFixed(1)}s`, `Dmg mult: x${empScaling.dmgMult.toFixed(1)}`];
  if (wid === 'swarm') return [`Drones: ${Math.min(6, 1 + lvl)}`, `Dmg/hit: ${Math.round(p.dmg * (28 + lvl * 14))}`, 'Orbit: auto-seek', lvl >= 2 ? 'Upgrade: +1 drone' : ''];
  if (wid === 'molotov') return [`Rate: ${rate}/s`, `Pools: ${molotovTier.pools}`, `Radius: ${molotovTier.radius}px`, `Duration: ${molotovTier.duration.toFixed(1)}s`, `Dmg mult: x${molotovTier.dmgMult}`];
  if (wid === 'barrier') {
    const tier = WDEFS.barrier.tiers[Math.min(lvl, 5)];
    return [`Rate: ${rate}/s`, `Absorb: ${tier.maxCap} dmg`, `Active: ${tier.activeDuration}s`, `Recharge: ${tier.rechargeTime}s`];
  }
  if (wid === 'arcblade') {
    return [
      `Blades: ${arcTier.discCount}`,
      `Orbit: ${arcTier.rx}x${arcTier.ry}`,
      `Spin: ${arcTier.thetaSpeed.toFixed(1)}`,
      `Dmg mult: x${arcTier.dmgMult.toFixed(1)}`,
    ];
  }
  return [];
}

export function renderUpgradeCard(upgrade, player, onClick) {
  if (upgrade.type === 'ascension') {
    const weapon = WDEFS[upgrade.wid];
    const optionRows = (upgrade.options || [])
      .map(option => renderStatLine(`PATH: ${option.name}`))
      .join('');
    return buildUpgradeCard({
      variant: 'asc',
      title: 'ASCENSION',
      name: `${weapon.icon} ${weapon.name}`,
      nameColor: weapon.col,
      subtitle: 'Choose an evolution path.',
      content: optionRows,
      upgrade,
      onClick,
    });
  }

  if (upgrade.type === 'wep') {
    const weapon = WDEFS[upgrade.wid];
    const currentLvl = getWeaponLevel(player, upgrade.wid) || 0;
    const currentStats = currentLvl > 0 ? wStats(upgrade.wid, currentLvl, player) : null;
    const newStats = wStats(upgrade.wid, upgrade.lvl, player);
    const isNewWeapon = currentLvl === 0;

    const statsHTML = newStats.map((stat, index) => {
      const current = currentStats?.[index];
      if (current && current !== stat) {
        return renderStatChange(current, stat);
      }
      if (isNewWeapon && stat) {
        return renderStatLine(stat);
      }
      return '';
    }).join('');

    const subLine = upgrade.isNew
      ? weaponUnlockDesc(upgrade.wid)
      : weaponUpgradeSummary(upgrade.wid, upgrade.lvl);
    return buildUpgradeCard({
      variant: 'wep',
      title: 'WEAPON',
      name: `${weapon.icon} ${weapon.name} T${upgrade.lvl}`,
      subtitle: subLine,
      content: statsHTML || renderStatLine('No numeric change'),
      upgrade,
      onClick,
    });
  }

  if (upgrade.type === 'asc_tier') {
    const weapon = WDEFS[upgrade.wid];
    const currentTier = getAscensionTier(player, upgrade.wid) || upgrade.currentTier || 1;
    const nextTier = upgrade.tier || (currentTier + 1);
    const currentDef = getAscensionTierDefinition(upgrade.ascensionId, currentTier);
    const nextDef = upgrade.tierDef || getAscensionTierDefinition(upgrade.ascensionId, nextTier);
    const detail = upgrade.tierDef?.description || 'Strengthens this ascended weapon without changing how it operates.';
    const ascensionName = (ASCENSIONS[upgrade.wid] || []).find(option => option.id === upgrade.ascensionId)?.name
      || upgrade.ascensionId?.replaceAll('_', ' ').toUpperCase()
      || 'ASCENSION';
    const statChanges = formatAscensionTierChanges(currentDef, nextDef);
    return buildUpgradeCard({
      variant: 'asc',
      title: 'ASCENSION TIER',
      name: `${weapon.icon} ${ascensionName} T${nextTier}`,
      nameColor: weapon.col,
      subtitle: detail,
      content: statChanges || renderStatLine('No numeric change'),
      upgrade,
      onClick,
    });
  }

  const preview = upgrade.apply ? (() => {
    const clone = { ...player };
    return upgrade.apply(clone);
  })() : [];
  return buildUpgradeCard({
    variant: 'pas',
    title: 'PASSIVE UPGRADE',
    name: passiveHeadline(upgrade.id),
    subtitle: passiveSummary(upgrade.id),
    content: formatPreviewLines(preview),
    upgrade,
    onClick,
  });
}

function formatPreviewLines(lines) {
  return (lines || []).map(line => {
    if (typeof line !== 'string') return '';
    const parts = line.split(' -> ');
    if (parts.length === 2) {
      return renderStatChange(parts[0], parts[1]);
    }
    return renderStatLine(line);
  }).join('');
}

function buildUpgradeCard({ variant, title, name, subtitle = '', content = '', upgrade, onClick, nameColor = '' }) {
  const nameStyle = nameColor ? ` style="color:${nameColor}"` : '';
  return `<div class="uc ${variant}" data-upgrade-id="${upgrade.id}" tabindex="0" onclick="${onClick}">
    <div class="ut">${title}</div>
    <div class="un"${nameStyle}>${name}</div>
    ${subtitle ? `<div class="ud">${subtitle}</div>` : ''}
    <div class="us">${content}</div></div>`;
}

function renderStatChange(beforeText, afterText) {
  const before = parseStatLine(beforeText);
  const after = parseStatLine(afterText);
  const hasSharedLabel = before.label && before.label === after.label;

  if (hasSharedLabel) {
    return `<div class="stat-change">
      <span class="stat-label">${before.label}</span>
      <div class="stat-values">
        <span class="stat-old">${before.value}</span>
        <span class="stat-arrow">&rarr;</span>
        <span class="stat-new">${after.value}</span>
      </div>
    </div>`;
  }

  return `<div class="stat-change">
    <div class="stat-values stat-values-full">
      <span class="stat-old">${beforeText}</span>
      <span class="stat-arrow">&rarr;</span>
      <span class="stat-new">${afterText}</span>
    </div>
  </div>`;
}

function renderStatLine(text, tone = 'default') {
  const parsed = parseStatLine(text);
  if (parsed.label) {
    return `<div class="stat-line stat-line-${tone}">
      <span class="stat-label">${parsed.label}</span>
      <span class="stat-line-value">${parsed.value}</span>
    </div>`;
  }
  return `<div class="stat-line stat-line-${tone}">
    <span class="stat-line-value">${text}</span>
  </div>`;
}

function parseStatLine(text) {
  if (typeof text !== 'string') return { label: '', value: '' };
  const separator = text.indexOf(': ');
  if (separator === -1) return { label: '', value: text };
  return {
    label: text.slice(0, separator),
    value: text.slice(separator + 2),
  };
}

const ASCENSION_TIER_FIELD_FORMATTERS = {
  shardCount: { label: 'Number of shards', format: value => `${value}` },
  shardDamageMult: { label: 'Shard damage mult', format: value => `x${Number(value).toFixed(1)}` },
  shardFreeze: { label: 'Shard freeze build', format: value => `${Number(value).toFixed(1)}` },
  shardPierce: { label: 'Shard pierce', format: value => `${value}` },
  projectileCount: { label: 'Projectile count', format: value => `${value}` },
  projectileSpeed: { label: 'Cryo speed', format: value => `${value}` },
  projectilePierce: { label: 'Cryo pierce', format: value => `${value}` },
  projectileRadius: { label: 'Projectile radius', format: value => `${Number(value).toFixed(1)}` },
  spreadRadius: { label: 'Spread radius', format: value => `${value}px` },
  spreadInterval: { label: 'Spread interval', format: value => `${Number(value).toFixed(2)}s` },
  spreadFreezePct: { label: 'Spread freeze', format: value => `${Math.round(Number(value) * 100)}% threshold` },
  novaRadius: { label: 'Nova radius', format: value => `${value}px` },
  novaDamageMult: { label: 'Nova damage', format: value => `x${Number(value).toFixed(2)}` },
  freezeSeed: { label: 'Freeze seed', format: value => `${Number(value).toFixed(1)}` },
  procEvery: { label: 'Proc every', format: value => `${value} shots` },
  beamCount: { label: 'Beam count', format: value => `${value}` },
  damageMult: { label: 'Damage mult', format: value => `x${Number(value).toFixed(2)}` },
  radius: { label: 'Radius', format: value => `${value}px` },
  dpsMult: { label: 'DPS mult', format: value => `x${Number(value).toFixed(1)}` },
  freezeTime: { label: 'Freeze time', format: value => `${Number(value).toFixed(2)}s` },
  maxChance: { label: 'Max shatter chance', format: value => `${Math.round(Number(value) * 100)}%` },
  minChance: { label: 'Min shatter chance', format: value => `${Math.round(Number(value) * 100)}%` },
};

function formatAscensionTierChanges(currentDef, nextDef) {
  if (!nextDef) return '';
  const keys = Object.keys(nextDef).filter(key => key !== 'description');
  const changed = keys
    .filter(key => currentDef?.[key] !== nextDef[key])
    .map(key => {
      const formatter = ASCENSION_TIER_FIELD_FORMATTERS[key];
      if (!formatter) return '';
      const before = formatter.format(currentDef?.[key]);
      const after = formatter.format(nextDef[key]);
      return renderStatChange(`${formatter.label}: ${before}`, `${formatter.label}: ${after}`);
    })
    .filter(Boolean);
  return changed.join('');
}

export function weaponUnlockDesc(wid) {
  return ({
    cryo: 'Fires slowing projectiles in a widening spread.',
    pulse: 'Launches explosive shots that grow into cluster bursts.',
    emp: 'Creates a stunning aura burst with scaling radius.',
    swarm: 'Deploys orbiting drones that auto-seek targets.',
    molotov: 'Throws fire bottles that leave burning pools.',
    barrier: 'Creates a shield that absorbs damage and recharges.',
    arcblade: 'Spawns orbiting blades that slice nearby enemies.',
  }[wid] || 'Unlocks a new weapon.');
}

function weaponUpgradeSummary(wid, lvl) {
  return ({
    cryo: {
      2: 'Adds another projectile.',
      3: 'Adds another projectile.',
      4: 'Adds another projectile.',
      5: 'Adds another projectile.',
    },
    pulse: {
      2: 'Adds cluster explosions.',
      3: 'Adds deeper cluster splitting.',
      4: 'Adds another split layer.',
      5: 'Maxes out cluster splitting.',
    },
    emp: {
      2: 'Increases stun radius and damage.',
      3: 'Increases stun radius and duration.',
      4: 'Increases stun radius and duration.',
      5: 'Maxes out stun radius and damage.',
    },
    swarm: {
      2: 'Adds another drone.',
      3: 'Adds another drone.',
      4: 'Adds another drone.',
      5: 'Adds another drone.',
    },
    molotov: {
      2: 'Increases pool size and burn damage.',
      3: 'Throws an extra bottle.',
      4: 'Increases pool size and duration.',
      5: 'Throws a third bottle.',
    },
    barrier: {
      2: 'Absorbs more damage and recharges faster.',
      3: 'Absorbs more damage and recharges faster.',
      4: 'Absorbs more damage and recharges faster.',
      5: 'Maxes absorb and recharge speed.',
    },
    arcblade: {
      2: 'Widens orbit and increases damage.',
      3: 'Adds a second blade.',
      4: 'Widens orbit and increases damage.',
      5: 'Adds a third blade.',
    },
  }[wid] || {})[lvl] || 'Improves this weapon.';
}

function passiveHeadline(id) {
  return ({
    p_spd: 'INCREASE MOVE SPEED',
    p_dmg: 'INCREASE ALL DAMAGE',
    p_mag: 'INCREASE XP PICKUP RANGE',
    p_hp: 'INCREASE MAX HP',
    p_dg: 'INCREASE DODGE CHANCE',
    p_rt: 'INCREASE ATTACK SPEED',
  }[id] || 'INCREASE RUN-WIDE STATS');
}

function passiveSummary(id) {
  return ({
    p_spd: 'Move faster.',
    p_dmg: 'Boost all weapon damage.',
    p_mag: 'Pull XP from farther away.',
    p_hp: 'Raise max HP and heal.',
    p_dg: 'Increase dodge chance.',
    p_rt: 'Attack more often.',
  }[id] || 'Improve run-wide stats.');
}

export function formatRunTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatWeaponList(player) {
  return getOwnedWeaponIds(player)
    .map(id => `${WDEFS[id].icon} ${WDEFS[id].name} T${getWeaponLevel(player, id)}`)
    .join(' &middot; ');
}
