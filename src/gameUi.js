import { ARC_BLADE_TIERS } from './arcBlade.js';
import { getOwnedWeaponIds, getWeaponLevel } from './player.js';
import { EMP_SCALING, MOLOTOV_TIERS, WDEFS } from './weapons.js';

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

function wDesc(wid, lvl) {
  return ({
    cryo: {
      1: 'Fires a single Cryo lance that slows enemies by 50% for 2 seconds and pierces 1 target.',
      2: 'Adds a second Cryo lance and starts spreading the volley into a light fan.',
      3: 'Adds a third Cryo lance, giving the weapon a wider spread for better lane coverage.',
      4: 'Adds a fourth Cryo lance and widens the spread again to cover more of the screen.',
      5: 'Adds a fifth Cryo lance with the widest spread version of the weapon.',
    },
    pulse: {
      1: 'Launches a slow-cycling heavy Pulse round that explodes for strong burst damage on impact.',
      2: 'The main Pulse detonation now throws cluster bombs outward when it lands.',
      3: 'Cluster bombs now split again when they detonate, pushing the blast pattern much farther outward.',
      4: 'Those secondary cluster bombs now split again, creating a third outward wave of explosions.',
      5: 'Pulse reaches full cluster saturation, with yet another recursive split layer for a huge blast web.',
    },
    emp: {
      1: 'Releases a 160px EMP burst that lightly damages and stuns enemies for 1.2 seconds.',
      2: 'EMP grows to 200px, hits harder, and stuns for 1.4 seconds.',
      3: 'EMP reaches 245px with stronger damage and a 1.6 second stun.',
      4: 'EMP expands to 295px with a 1.8 second stun and higher control damage.',
      5: 'EMP peaks at a 350px burst with a 2.0 second stun and 2.8x damage scaling.',
    },
    swarm: {
      1: 'Deploys 2 orbiting drones that seek targets and strike automatically.',
      2: 'Adds a third orbiting swarm drone.',
      3: 'Adds a fourth orbiting swarm drone.',
      4: 'Adds a fifth orbiting swarm drone.',
      5: 'Adds a sixth orbiting swarm drone.',
    },
    molotov: {
      1: 'Throws a Molotov toward the nearest enemy, creating one burning pool that deals continuous damage over time.',
      2: 'The fire pool grows wider and burns harder while keeping a single throw target.',
      3: 'Throws two bottles in a fan, creating two separate fire pools on landing.',
      4: 'Those two pools grow larger and burn longer between throws.',
      5: 'Throws three bottles in a wider fan, covering a broad zone in overlapping fire.',
    },
    barrier: {
      1: 'Absorbs 40 damage per cycle. Active 4.2s, recharge 8s.',
      2: 'Absorbs 65 damage per cycle. Active 5.1s, recharge 7s.',
      3: 'Absorbs 95 damage per cycle. Active 5.9s, recharge 6s.',
      4: 'Absorbs 130 damage per cycle. Active 6.8s, recharge 5s.',
      5: 'Absorbs 175 damage per cycle. Active 8.5s, recharge 4s.',
    },
    arcblade: {
      1: 'Throws a single orbiting boomerang blade that loops out and back around the player.',
      2: 'The blade travels in a wider orbit and hits harder on each pass.',
      3: 'Adds a second boomerang blade for mirrored orbit pressure.',
      4: 'Both blades widen their orbit and gain more hit strength.',
      5: 'Adds a third blade and reaches the weapon\'s fullest orbiting coverage.',
    },
  }[wid] || {})[lvl] || '';
}

export function renderUpgradeCard(upgrade, player, onClick) {
  if (upgrade.type === 'ascension') {
    const weapon = WDEFS[upgrade.wid];
    const optionNames = (upgrade.options || []).map(option => option.name).join(' &middot; ');
    return `<div class="uc wep" data-upgrade-id="${upgrade.id}" tabindex="0" onclick="${onClick}" style="border:1px solid rgba(0,207,255,0.85);box-shadow:0 0 0 2px rgba(0,207,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08);background:linear-gradient(180deg, rgba(5,14,20,0.98), rgba(11,19,28,0.98))">
      <div class="ut" style="color:#00CFFF">ASCENSION</div>
      <div class="un" style="color:${weapon.col}">${weapon.icon} ${weapon.name}</div>
      <div class="ud">THIS L5 WEAPON CAN TRANSFORM</div>
      <div class="us">${optionNames}</div></div>`;
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
        return `<div class="stat-change">
          <span class="stat-old">${current}</span>
          <span class="stat-arrow">&rarr;</span>
          <span class="stat-new">${stat}</span>
        </div>`;
      }
      if (isNewWeapon && stat) {
        return `<div class="stat-new-only" style="color:#8ab">STARTS: ${stat}</div>`;
      }
      return `<div class="stat-new-only">${stat}</div>`;
    }).join('');

    const subLine = upgrade.isNew ? `UNLOCKS WEAPON ${weapon.name}` : `UPGRADES ${weapon.name} TO T${upgrade.lvl}`;
    const detailLines = [upgrade.isNew ? weaponUnlockDesc(upgrade.wid) : wDesc(upgrade.wid, upgrade.lvl)].filter(Boolean);
    return `<div class="uc wep" data-upgrade-id="${upgrade.id}" tabindex="0" onclick="${onClick}">
      <div class="ut">WEAPON</div>
      <div class="un">${weapon.icon} ${weapon.name} T${upgrade.lvl}</div>
      <div class="ud">${subLine}</div>
      <div class="us">${statsHTML}${detailLines.map(line => `<div class="stat-copy">${line}</div>`).join('')}</div></div>`;
  }

  const preview = upgrade.apply ? (() => {
    const clone = { ...player };
    return upgrade.apply(clone);
  })() : [];
  return `<div class="uc pas" data-upgrade-id="${upgrade.id}" tabindex="0" onclick="${onClick}">
    <div class="ut">PASSIVE UPGRADE</div>
    <div class="un">${passiveHeadline(upgrade.id)}</div>
    <div class="us">${formatPreviewLines(preview)}</div></div>`;
}

function formatPreviewLines(lines) {
  return (lines || []).map(line => {
    if (typeof line !== 'string') return '';
    const parts = line.split(' -> ');
    if (parts.length === 2) {
      return `<div class="stat-change">
        <span class="stat-old">${parts[0]}</span>
        <span class="stat-arrow">&rarr;</span>
        <span class="stat-new">${parts[1]}</span>
      </div>`;
    }
    return `<div class="stat-new-only">${line}</div>`;
  }).join('');
}

export function weaponUnlockDesc(wid) {
  return ({
    cryo: 'Fires slowing Cryo lances that scale by adding more projectiles and wider spread.',
    pulse: 'Launches a heavy explosive Pulse shell that upgrades into cluster-bomb bursts.',
    emp: 'Sends a radial EMP stun that upgrades mostly through larger and larger control radius.',
    swarm: 'Deploys orbiting drones that keep scaling by adding more swarm bodies.',
    molotov: 'Lobs arcing bottles that burst into persistent fire pools for area denial and damage-over-time.',
    barrier: 'Wraps the player in a cycling shield that absorbs damage, then recharges after breaking.',
    arcblade: 'Throws orbiting boomerang blades that loop out and back around the player.',
  }[wid] || 'Unlocks a new weapon.');
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
