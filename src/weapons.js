import { enemies, nearest, dist2, pruneEnemies, getExtraTarget, applySlow, ensureFreezeState, applyStun, getEffectiveFreezeThreshold } from './enemies.js';
import { addRing, addBurst, addDot } from './particles.js';
import { getAscension, getAscensionTier, getWeaponLevel } from './player.js';

export const bullets = [];
export const pulseClusters = [];

export const ASCENSIONS = {
  cryo: [
    {
      id: 'cryo_storm',
      name: 'CRYO STORM',
      description: 'Frozen enemies that die release freeze-building shards in all directions.',
    },
    {
      id: 'permafrost',
      name: 'PERMAFROST',
      description: 'Frozen enemies never thaw. They remain frozen until killed. High burst damage required.',
    },
    {
      id: 'cryo_nova',
      name: 'CRYO NOVA',
      description: 'Frozen enemies that die explode for 80% max-HP damage in a 150px ice nova and seed freeze buildup on survivors.',
    },
    {
      id: 'overload',
      name: 'OVERLOAD',
      description: 'Every third Cryo volley overloads part of the 5-shot spread into double-damage piercing shots.',
    },
    {
      id: 'frost_field',
      name: 'FROST FIELD',
      description: 'Removes Cryo projectiles. Generates a 150px frost aura that slows instantly, freezes after sustained exposure, and deals chip damage over time.',
    },
    {
      id: 'shatter',
      name: 'SHATTER',
      description: 'Frozen enemies have a chance to instantly die on any hit. Chance scales with freeze time remaining - max 25% at moment of freeze, drops to zero as timer expires.',
    },
  ],
  pulse: [
    {
      id: 'chain_reaction',
      name: 'CHAIN REACTION',
      description: 'Cluster bomb explosions have a 35% chance to trigger a full new Pulse shell impact at that location, complete with its own cluster generation.',
    },
    {
      id: 'collapsed_round',
      name: 'COLLAPSED ROUND',
      description: 'Pulse shells pull all enemies within 180px sharply toward the impact point for 0.3 seconds before the explosion fires. Cluster chain follows as normal.',
    },
    {
      id: 'overload_round',
      name: 'OVERLOAD ROUND',
      description: 'Every 3rd Pulse shot is an Overload Round - 5x damage, pierces all enemies, explosion radius doubled. Counter resets on death.',
    },
    {
      id: 'proximity_mine',
      name: 'PROXIMITY MINE',
      description: 'Pulse shells drop at the player\'s feet as proximity mines. Enemies walking over a mine trigger it. Up to 6 mines active at once.',
    },
    {
      id: 'fragmentation',
      name: 'FRAGMENTATION',
      description: 'Pulse shells split into 8 fragments before impact. Each deals 40% damage and triggers a smaller explosion with one fewer cluster generation.',
    },
  ],
  emp: [
    {
      id: 'cascade_pulse',
      name: 'CASCADE PULSE',
      description: 'Stunning an enemy causes it to emit a secondary pulse that stuns all enemies within 80px. Secondary stuns do not cascade further.',
    },
    {
      id: 'triple_pulse',
      name: 'TRIPLE PULSE',
      description: 'EMP releases a single expanding shockwave with three strength thresholds. Inner hits deal full damage and stun, outer hits deal less.',
    },
    {
      id: 'arc_discharge',
      name: 'ARC DISCHARGE',
      description: 'Electrical arcs jump between all stunned enemies within 200px of each other. Each arc deals 40% of EMP burst damage.',
    },
  ],
  swarm: [
    {
      id: 'nova_swarm',
      name: 'NOVA SWARM',
      description: 'Drone kills detonate at the kill point in an 80px explosion. A temporary drone spawns at the detonation and orbits for 8 seconds. Temporary drones can Nova but only explode - no further drone spawning.',
    },
    {
      id: 'frenzy',
      name: 'FRENZY',
      description: 'A drone kill triggers a 3-second frenzy on that drone - 2x speed, 2x damage, continuous target seeking with no orbit return between hits. Each drone has a 3-second cooldown before it can frenzy again.',
    },
    {
      id: 'split_swarm',
      name: 'SPLIT SWARM',
      description: 'Each drone splits into two on first contact with an enemy. The split drone seeks a different target independently for 5 seconds then expires. Split drones cannot split again.',
    },
  ],
  arcblade: [
    {
      id: 'saw_blade',
      name: 'SAW BLADE',
      description: 'All boomerangs merge into a single large orbital saw. Continuously damages all enemies within its radius.',
    },
  ],
  molotov: [
    {
      id: 'inferno',
      name: 'INFERNO',
      description: 'Throws one oversized bottle regardless of level count. Creates a single pool at 1.8x radius, lasts 8 seconds, deals 50% more damage, and fires at half rate.',
    },
    {
      id: 'bouncing_cocktail',
      name: 'BOUNCING COCKTAIL',
      description: 'Bottles bounce 3 times, leaving diminishing fire pools at each landing point.',
    },
    {
      id: 'cluster_molotov',
      name: 'CLUSTER MOLOTOV',
      description: 'Each bottle shatters into 3 sub-bottles on impact, each creating a smaller fire pool.',
    },
  ]
};

export const ASCENSION_TIER_DEFS = {
  cryo_storm: {
    weaponId: 'cryo',
    tiers: {
      1: { shardCount: 3, shardDamageMult: 3.0, shardFreeze: 0.8, shardPierce: 0, description: 'Frozen kills release 3 shards in an even circle.' },
      2: { shardCount: 5, shardDamageMult: 3.0, shardFreeze: 0.8, shardPierce: 0, description: 'Frozen kills release 5 shards.' },
      3: { shardCount: 7, shardDamageMult: 3.0, shardFreeze: 0.8, shardPierce: 0, description: 'Frozen kills release 7 shards.' },
      4: { shardCount: 9, shardDamageMult: 3.0, shardFreeze: 0.8, shardPierce: 0, description: 'Frozen kills release 9 shards.' },
      5: { shardCount: 11, shardDamageMult: 3.0, shardFreeze: 0.8, shardPierce: 0, description: 'Frozen kills release 11 shards.' },
    },
  },
  permafrost: {
    weaponId: 'cryo',
    tiers: {
      1: {
        projectileSpeed: 430,
        projectilePierce: 2,
        projectileColor: '#007DCC',
        projectileRadius: 5,
        projectileCount: 1,
        fireRateMult: 0.78,
        spreadRadius: 120,
        spreadInterval: 0,
        spreadFreezePct: 0,
        description: 'Cryo condenses into one large snowball shot that instantly freezes on hit. Frozen enemies never thaw.',
      },
      2: {
        projectileSpeed: 430,
        projectilePierce: 4,
        projectileColor: '#007DCC',
        projectileRadius: 5,
        projectileCount: 1,
        fireRateMult: 0.78,
        spreadRadius: 120,
        spreadInterval: 1.2,
        spreadFreezePct: 0.35,
        description: 'The heavy single shot remains. Frozen enemies slowly spread freeze to nearby enemies. Cryo pierce increases to 2.',
      },
      3: {
        projectileSpeed: 430,
        projectilePierce: 6,
        projectileColor: '#007DCC',
        projectileRadius: 5,
        projectileCount: 3,
        spreadStepMult: 1.55,
        fireRateMult: 0.78,
        spreadRadius: 120,
        spreadInterval: 0.9,
        spreadFreezePct: 0.35,
        description: 'Permafrost now fires 3 heavy shots. Freeze spread rate increases and Cryo pierce increases to 3.',
      },
      4: {
        projectileSpeed: 430,
        projectilePierce: 8,
        projectileColor: '#007DCC',
        projectileRadius: 5,
        projectileCount: 3,
        fireRateMult: 0.78,
        spreadRadius: 120,
        spreadInterval: 0.65,
        spreadFreezePct: 0.35,
        description: 'The 3-shot pattern remains. Freeze spread rate increases again and Cryo pierce increases to 4.',
      },
      5: {
        projectileSpeed: 430,
        projectilePierce: 10,
        projectileColor: '#007DCC',
        projectileRadius: 5,
        projectileCount: 5,
        spreadStepMult: 1.55,
        fireRateMult: 0.78,
        spreadRadius: 120,
        spreadInterval: 0.45,
        spreadFreezePct: 0.35,
        description: 'Permafrost now fires 5 heavy shots. Freeze spread reaches its fastest rate and Cryo pierce increases to 5.',
      },
    },
  },
  cryo_nova: {
    weaponId: 'cryo',
    tiers: {
      1: { novaRadius: 150, novaDamageMult: 0.8, freezeSeed: 2.0, description: 'Frozen kills detonate for 80% max-HP damage in a 150px nova.' },
      2: { novaRadius: 170, novaDamageMult: 0.85, freezeSeed: 2.1, description: 'Nova radius and damage increase slightly.' },
      3: { novaRadius: 190, novaDamageMult: 0.9, freezeSeed: 2.3, description: 'Nova reaches farther and seeds more freeze.' },
      4: { novaRadius: 210, novaDamageMult: 0.95, freezeSeed: 2.5, description: 'Nova becomes a larger, harder-hitting ice blast.' },
      5: { novaRadius: 230, novaDamageMult: 1.0, freezeSeed: 2.8, description: 'Nova peaks at full max-HP damage with the largest freeze spread.' },
    },
  },
  overload: {
    weaponId: 'cryo',
    tiers: {
      1: { procEvery: 3, empoweredShots: 1, damageMult: 2.0, pierce: 2, description: 'Every third Cryo volley overloads 1 of 5 shots into a double-damage piercing projectile.' },
      2: { procEvery: 3, empoweredShots: 2, damageMult: 2.0, pierce: 2, description: 'Every third Cryo volley overloads 2 of 5 shots.' },
      3: { procEvery: 3, empoweredShots: 3, damageMult: 2.0, pierce: 3, description: 'Every third Cryo volley overloads 3 of 5 shots and increases their pierce to 3.' },
      4: { procEvery: 3, empoweredShots: 4, damageMult: 2.0, pierce: 3, description: 'Every third Cryo volley overloads 4 of 5 shots.' },
      5: { procEvery: 3, empoweredShots: 5, damageMult: 2.0, pierce: 4, description: 'Every third Cryo volley overloads all 5 shots and increases their pierce to 4.' },
    },
  },
  frost_field: {
    weaponId: 'cryo',
    tiers: {
      1: { radius: 150, dpsMult: 5, freezeTime: 1.5, description: 'Creates a 150px frost aura that slows, freezes, and chips nearby enemies.' },
      2: { radius: 170, dpsMult: 6, freezeTime: 1.35, description: 'Frost Field expands and freezes a little faster.' },
      3: { radius: 190, dpsMult: 7, freezeTime: 1.2, description: 'Frost Field grows again and burns colder.' },
      4: { radius: 210, dpsMult: 8, freezeTime: 1.0, description: 'Frost Field becomes a larger fast-freezing aura.' },
      5: { radius: 230, dpsMult: 9, freezeTime: 0.85, description: 'Frost Field reaches maximum size and fastest freeze cadence.' },
    },
  },
  shatter: {
    weaponId: 'cryo',
    tiers: {
      1: { maxChance: 0.25, minChance: 0.0, description: 'Frozen enemies can instantly shatter on hit.' },
      2: { maxChance: 0.3, minChance: 0.0, description: 'Raises the maximum shatter chance to 30%.' },
      3: { maxChance: 0.35, minChance: 0.05, description: 'Raises the maximum shatter chance and leaves a small late-window chance.' },
      4: { maxChance: 0.4, minChance: 0.1, description: 'Shatter remains dangerous for longer into the freeze.' },
      5: { maxChance: 0.45, minChance: 0.15, description: 'Shatter peaks at 45% and never fully decays while the target stays frozen.' },
    },
  },
  chain_reaction: {
    weaponId: 'pulse',
    tiers: {
      1: { procChance: 0.35, maxProcs: 3, chainClusterBonus: 0, description: 'Cluster explosions have a 35% chance to retrigger a full Pulse impact.' },
      2: { procChance: 0.45, maxProcs: 3, chainClusterBonus: 0, description: 'Chain Reaction proc chance rises to 45%.' },
      3: { procChance: 0.55, maxProcs: 4, chainClusterBonus: 0, description: 'Chain Reaction can proc one extra time per chain.' },
      4: { procChance: 0.65, maxProcs: 4, chainClusterBonus: 1, description: 'Retriggered impacts generate one extra cluster layer.' },
      5: { procChance: 0.75, maxProcs: 5, chainClusterBonus: 1, description: 'Chain Reaction becomes highly reliable and can sustain longer chains.' },
    },
  },
  collapsed_round: {
    weaponId: 'pulse',
    tiers: {
      1: { pullRadius: 180, pullTime: 0.3, pullSpeed: 400, description: 'Pulse impacts pull enemies inward before exploding.' },
      2: { pullRadius: 200, pullTime: 0.32, pullSpeed: 450, description: 'Collapsed Round pulls from slightly farther out.' },
      3: { pullRadius: 220, pullTime: 0.34, pullSpeed: 520, description: 'Collapsed Round pulls harder and longer.' },
      4: { pullRadius: 240, pullTime: 0.36, pullSpeed: 590, description: 'Collapsed Round becomes a stronger vacuum detonation.' },
      5: { pullRadius: 260, pullTime: 0.4, pullSpeed: 660, description: 'Collapsed Round reaches maximum pull radius and strength.' },
    },
  },
  overload_round: {
    weaponId: 'pulse',
    tiers: {
      1: { procEvery: 3, damageMult: 5, radiusScale: 2.0, description: 'Every third Pulse shot becomes an Overload Round.' },
      2: { procEvery: 3, damageMult: 6, radiusScale: 2.2, description: 'Overload Round damage and blast radius increase.' },
      3: { procEvery: 3, damageMult: 7, radiusScale: 2.4, description: 'Overload Round grows even more explosive.' },
      4: { procEvery: 2, damageMult: 7, radiusScale: 2.6, description: 'Overload Round now triggers every second Pulse shot.' },
      5: { procEvery: 2, damageMult: 8, radiusScale: 3.0, description: 'Every second Pulse shot becomes a maximum-power Overload Round.' },
    },
  },
  proximity_mine: {
    weaponId: 'pulse',
    tiers: {
      1: { maxMines: 6, triggerRadius: 18, blastRadius: 120, damageMult: 3.0, description: 'Pulse shells become proximity mines with up to 6 active.' },
      2: { maxMines: 8, triggerRadius: 20, blastRadius: 135, damageMult: 3.2, description: 'More mines can stay active and their blast grows.' },
      3: { maxMines: 10, triggerRadius: 22, blastRadius: 150, damageMult: 3.4, description: 'Proximity Mine stores more charges and hits harder.' },
      4: { maxMines: 12, triggerRadius: 26, blastRadius: 165, damageMult: 3.7, description: 'Mine trigger range and blast radius both increase.' },
      5: { maxMines: 14, triggerRadius: 30, blastRadius: 180, damageMult: 4.0, description: 'Proximity Mine reaches maximum stockpile and explosion size.' },
    },
  },
  fragmentation: {
    weaponId: 'pulse',
    tiers: {
      1: { fragmentCount: 8, fragmentDamageMult: 0.4, fragmentRadius: 48, description: 'Pulse shells split into 8 explosive fragments.' },
      2: { fragmentCount: 10, fragmentDamageMult: 0.42, fragmentRadius: 54, description: 'Fragmentation releases more fragments with a larger blast.' },
      3: { fragmentCount: 12, fragmentDamageMult: 0.44, fragmentRadius: 60, description: 'Fragmentation spreads even more bomblets.' },
      4: { fragmentCount: 14, fragmentDamageMult: 0.47, fragmentRadius: 66, description: 'Fragmentation becomes denser and more damaging.' },
      5: { fragmentCount: 16, fragmentDamageMult: 0.5, fragmentRadius: 72, description: 'Fragmentation peaks at 16 fragments and the largest sub-blast.' },
    },
  },
  cascade_pulse: {
    weaponId: 'emp',
    tiers: {
      1: { radius: 100, damageMult: 8, stun: 1.0, description: 'Freshly stunned enemies emit a secondary cascade burst.' },
      2: { radius: 115, damageMult: 8.8, stun: 1.1, description: 'Cascade Pulse grows in radius and damage.' },
      3: { radius: 130, damageMult: 9.6, stun: 1.2, description: 'Cascade Pulse expands again with stronger stuns.' },
      4: { radius: 145, damageMult: 10.4, stun: 1.3, description: 'Cascade Pulse becomes a heavy follow-up wave.' },
      5: { radius: 160, damageMult: 11.2, stun: 1.4, description: 'Cascade Pulse reaches maximum radius, damage, and stun time.' },
    },
  },
  triple_pulse: {
    weaponId: 'emp',
    tiers: {
      1: { radiusMult: 1.0, midDamageMult: 0.6, outerDamageMult: 0.3, midStunMult: 0.0, outerStunMult: 0.0, description: 'EMP fires three expanding shockwave bands.' },
      2: { radiusMult: 1.08, midDamageMult: 0.65, outerDamageMult: 0.35, midStunMult: 0.0, outerStunMult: 0.0, description: 'Triple Pulse bands expand farther and hit a little harder.' },
      3: { radiusMult: 1.16, midDamageMult: 0.7, outerDamageMult: 0.4, midStunMult: 0.35, outerStunMult: 0.0, description: 'The middle ring now applies a brief stun.' },
      4: { radiusMult: 1.24, midDamageMult: 0.75, outerDamageMult: 0.45, midStunMult: 0.45, outerStunMult: 0.2, description: 'Triple Pulse strengthens all three rings and adds a light outer stun.' },
      5: { radiusMult: 1.32, midDamageMult: 0.8, outerDamageMult: 0.5, midStunMult: 0.55, outerStunMult: 0.3, description: 'Triple Pulse reaches maximum ring size and strongest outer-band payoff.' },
    },
  },
  arc_discharge: {
    weaponId: 'emp',
    tiers: {
      1: { arcRange: 250, maxArcsPerEnemy: 3, maxTotalArcs: 20, damageRatio: 0.12, stun: 0.5, description: 'Stunned enemies fire damaging arcs into nearby targets.' },
      2: { arcRange: 280, maxArcsPerEnemy: 3, maxTotalArcs: 24, damageRatio: 0.14, stun: 0.55, description: 'Arc Discharge jumps farther and deals more damage.' },
      3: { arcRange: 310, maxArcsPerEnemy: 4, maxTotalArcs: 28, damageRatio: 0.16, stun: 0.6, description: 'Arc Discharge can link to more targets per source.' },
      4: { arcRange: 340, maxArcsPerEnemy: 4, maxTotalArcs: 32, damageRatio: 0.18, stun: 0.7, description: 'Arc Discharge intensifies with stronger damage and stun.' },
      5: { arcRange: 380, maxArcsPerEnemy: 5, maxTotalArcs: 36, damageRatio: 0.2, stun: 0.8, description: 'Arc Discharge reaches maximum network range and arc density.' },
    },
  },
  nova_swarm: {
    weaponId: 'swarm',
    tiers: {
      1: { blastRadius: 110, blastDamageMult: 0.4, novaLife: 8.0, description: 'Drone kills detonate and spawn temporary nova drones.' },
      2: { blastRadius: 125, blastDamageMult: 0.45, novaLife: 8.5, description: 'Nova Swarm explosions grow and nova drones last longer.' },
      3: { blastRadius: 140, blastDamageMult: 0.5, novaLife: 9.0, description: 'Nova Swarm hits harder and sustains more temporary drones.' },
      4: { blastRadius: 155, blastDamageMult: 0.55, novaLife: 9.5, description: 'Nova Swarm becomes a larger kill explosion.' },
      5: { blastRadius: 170, blastDamageMult: 0.6, novaLife: 10.0, description: 'Nova Swarm reaches maximum blast size and nova-drone lifespan.' },
    },
  },
  frenzy: {
    weaponId: 'swarm',
    tiers: {
      1: { speedMult: 2.0, damageMult: 2.0, duration: 3.0, cooldown: 3.0, description: 'Drone kills trigger a brief frenzy on that drone.' },
      2: { speedMult: 2.15, damageMult: 2.15, duration: 3.25, cooldown: 2.8, description: 'Frenzy lasts a little longer and hits harder.' },
      3: { speedMult: 2.3, damageMult: 2.3, duration: 3.5, cooldown: 2.6, description: 'Frenzy strengthens again and recharges faster.' },
      4: { speedMult: 2.45, damageMult: 2.45, duration: 3.75, cooldown: 2.4, description: 'Frenzy becomes a stronger sustained chase state.' },
      5: { speedMult: 2.6, damageMult: 2.6, duration: 4.0, cooldown: 2.2, description: 'Frenzy peaks in duration, damage, and pursuit speed.' },
    },
  },
  split_swarm: {
    weaponId: 'swarm',
    tiers: {
      1: { life: 3.0, speed: 220, damageMult: 0.6, hitCooldown: 0.3, description: 'Drones split on first contact and the clone attacks independently.' },
      2: { life: 3.5, speed: 240, damageMult: 0.68, hitCooldown: 0.28, description: 'Split drones last longer and move faster.' },
      3: { life: 4.0, speed: 260, damageMult: 0.76, hitCooldown: 0.26, description: 'Split drones grow more dangerous on contact.' },
      4: { life: 4.5, speed: 280, damageMult: 0.84, hitCooldown: 0.24, description: 'Split drones stay active longer and cycle hits faster.' },
      5: { life: 5.0, speed: 300, damageMult: 0.92, hitCooldown: 0.22, description: 'Split Swarm reaches maximum clone lifespan and hit output.' },
    },
  },
  saw_blade: {
    weaponId: 'arcblade',
    tiers: {
      1: { orbitR: 80, thetaSpeed: 2.2, radius: 40, tickRate: 0.1, damageMult: 0.25, description: 'All boomerangs merge into a single orbital saw.' },
      2: { orbitR: 88, thetaSpeed: 2.35, radius: 44, tickRate: 0.095, damageMult: 0.28, description: 'Saw Blade grows in orbit size and contact damage.' },
      3: { orbitR: 96, thetaSpeed: 2.5, radius: 48, tickRate: 0.09, damageMult: 0.31, description: 'Saw Blade spins faster and covers more space.' },
      4: { orbitR: 104, thetaSpeed: 2.7, radius: 52, tickRate: 0.085, damageMult: 0.34, description: 'Saw Blade becomes a larger, faster orbital cutter.' },
      5: { orbitR: 112, thetaSpeed: 2.9, radius: 56, tickRate: 0.08, damageMult: 0.38, description: 'Saw Blade reaches maximum orbit, size, and damage cadence.' },
    },
  },
  inferno: {
    weaponId: 'molotov',
    tiers: {
      1: { radiusMult: 1.8, duration: 8.0, damageMult: 1.5, fireRateMult: 2.0, description: 'Throws one oversized bottle that leaves a giant Inferno pool.' },
      2: { radiusMult: 1.95, duration: 8.5, damageMult: 1.6, fireRateMult: 1.95, description: 'Inferno pool grows and burns longer.' },
      3: { radiusMult: 2.1, duration: 9.0, damageMult: 1.7, fireRateMult: 1.9, description: 'Inferno becomes a larger, hotter burn zone.' },
      4: { radiusMult: 2.25, duration: 9.5, damageMult: 1.8, fireRateMult: 1.85, description: 'Inferno expands again with more persistent damage.' },
      5: { radiusMult: 2.4, duration: 10.0, damageMult: 1.9, fireRateMult: 1.8, description: 'Inferno reaches maximum pool size, duration, and heat.' },
    },
  },
  bouncing_cocktail: {
    weaponId: 'molotov',
    tiers: {
      1: { maxBounces: 3, bouncePoolRadius: 85, bounceDistanceBase: 140, bounceDistanceStep: 20, description: 'Bottles bounce three times, leaving smaller pools.' },
      2: { maxBounces: 4, bouncePoolRadius: 90, bounceDistanceBase: 145, bounceDistanceStep: 18, description: 'Bouncing Cocktail gains an extra hop and slightly larger pools.' },
      3: { maxBounces: 4, bouncePoolRadius: 95, bounceDistanceBase: 150, bounceDistanceStep: 16, description: 'Bounce pools grow and spread farther.' },
      4: { maxBounces: 5, bouncePoolRadius: 100, bounceDistanceBase: 155, bounceDistanceStep: 14, description: 'Bouncing Cocktail adds another hop and wider flame patches.' },
      5: { maxBounces: 5, bouncePoolRadius: 110, bounceDistanceBase: 160, bounceDistanceStep: 12, description: 'Bouncing Cocktail reaches maximum hop count and pool size.' },
    },
  },
  cluster_molotov: {
    weaponId: 'molotov',
    tiers: {
      1: { subBottleCount: 3, subDistanceMin: 150, subDistanceMax: 210, subRadiusMult: 0.8, description: 'Molotovs split into 3 sub-bottles on impact.' },
      2: { subBottleCount: 4, subDistanceMin: 155, subDistanceMax: 220, subRadiusMult: 0.82, description: 'Cluster Molotov gains one extra sub-bottle.' },
      3: { subBottleCount: 5, subDistanceMin: 160, subDistanceMax: 230, subRadiusMult: 0.84, description: 'Cluster Molotov releases a denser spread of fire.' },
      4: { subBottleCount: 6, subDistanceMin: 165, subDistanceMax: 240, subRadiusMult: 0.86, description: 'Cluster Molotov fills the landing zone with more sub-bottles.' },
      5: { subBottleCount: 7, subDistanceMin: 170, subDistanceMax: 250, subRadiusMult: 0.9, description: 'Cluster Molotov reaches maximum shatter count and pool coverage.' },
    },
  },
};

export function getAscensionTierDefinition(ascensionId, tier = 1) {
  if (ascensionId === 'glacial_lance') ascensionId = 'overload';
  const def = ASCENSION_TIER_DEFS[ascensionId];
  if (!def) return null;
  return def.tiers[Math.max(1, Math.min(5, tier))] || def.tiers[1];
}

export function getAscensionTierData(p, weaponId) {
  const ascensionId = getAscension(p, weaponId);
  if (!ascensionId) return null;
  const tier = getAscensionTier(p, weaponId);
  return {
    ascensionId,
    tier,
    definition: getAscensionTierDefinition(ascensionId, tier),
  };
}

export function resetBullets() { bullets.length = 0; }
export function resetPulseClusters() { pulseClusters.length = 0; }

function mkBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  const pl = meta?.pierce || 0;
  bullets.push({ x, y, vx, vy, r, dmg, col, life, pl, meta, hitIds: pl > 0 ? new Set() : null });
}

export function spawnBullet(x, y, vx, vy, r, dmg, col, life, meta) {
  mkBullet(x, y, vx, vy, r, dmg, col, life, meta);
}

function getCryoProjectileCount(lvl) {
  return Math.min(5, Math.max(1, lvl));
}

function getCryoSpreadStep(count) {
  return count >= 5 ? 0.34 : count >= 4 ? 0.22 : count >= 3 ? 0.12 : count >= 2 ? 0.08 : 0;
}

function getCryoOverloadIndices(count, empoweredShots) {
  const center = (count - 1) * 0.5;
  return Array.from({ length: count }, (_, idx) => idx)
    .sort((a, b) => {
      const distanceDiff = Math.abs(a - center) - Math.abs(b - center);
      return distanceDiff !== 0 ? distanceDiff : a - b;
    })
    .slice(0, Math.max(0, Math.min(count, empoweredShots)));
}

export const EMP_SCALING = {
  1: { radius: 160, stun: 1.2, dmgMult: 1.0 },
  2: { radius: 200, stun: 1.4, dmgMult: 1.3 },
  3: { radius: 245, stun: 1.6, dmgMult: 1.7 },
  4: { radius: 295, stun: 1.8, dmgMult: 2.2 },
  5: { radius: 350, stun: 2.0, dmgMult: 2.8 },
};

export const MOLOTOV_TIERS = {
  1: { pools: 1, radius: 55, duration: 2.5, fireRate: 2.5, dmgMult: 8 },
  2: { pools: 1, radius: 70, duration: 2.5, fireRate: 2.2, dmgMult: 9 },
  3: { pools: 2, radius: 80, duration: 3.0, fireRate: 2.0, dmgMult: 10 },
  4: { pools: 2, radius: 90, duration: 3.0, fireRate: 1.8, dmgMult: 11 },
  5: { pools: 3, radius: 100, duration: 3.0, fireRate: 1.6, dmgMult: 12 },
};

function getEmpScaling(lvl) {
  return EMP_SCALING[Math.min(Math.max(lvl, 1), 5)] || EMP_SCALING[1];
}

function getSwarmCount(lvl) {
  return Math.min(6, 1 + lvl);
}

function mkSwarmDrone(angle) {
  return {
    a: angle,
    state: 'orbit',
    sx: 0, sy: 0,
    tx: 0, ty: 0,
    target: null,
    cooldown: 0,
    ht: 0,
    frenzy: false,
    frenzyT: 0,
    frenzyCD: 0,
    pulseOffset: 0,
    hasSplitThisContact: false,
  };
}

function mkNovaDrone() {
  return {
    a: Math.random() * Math.PI * 2,
    ht: 0,
    life: 8.0,
    isNova: true,
    state: 'orbit',
    sx: 0, sy: 0,
    tx: 0, ty: 0,
    target: null,
    cooldown: 0,
    pulseOffset: 0,
  };
}

function acquireSwarmTarget(allTargets, x, y, seekR, excludedTarget = null) {
  let bestT = null;
  let bestDist = seekR * seekR;
  allTargets.forEach(target => {
    if (!target || target.hp <= 0) return;
    if (target === excludedTarget) return;
    const dd = dist2({ x, y }, target);
    if (dd < bestDist) {
      bestDist = dd;
      bestT = target;
    }
  });
  return bestT;
}

function getBarrierTier(lvl) {
  const tier = Math.min(Math.max(lvl, 1), 5);
  return {
    1: { maxCap: 40, activeDuration: 4.2, rechargeTime: 8 },
    2: { maxCap: 65, activeDuration: 5.1, rechargeTime: 7 },
    3: { maxCap: 95, activeDuration: 5.9, rechargeTime: 6 },
    4: { maxCap: 130, activeDuration: 6.8, rechargeTime: 5 },
    5: { maxCap: 175, activeDuration: 8.5, rechargeTime: 4 },
  }[tier];
}

function getCryoFreezeAmount(lvl) {
  return [0, 1.0, 1.5, 2.0, 2.5, 3.0][Math.min(Math.max(lvl, 1), 5)] || 1.0;
}

function getPermafrostFreezeAmount(target) {
  const effectiveThreshold = getEffectiveFreezeThreshold(target);
  const targetRadius = Math.max(10, target?.r || 10);
  const t = Math.max(0, Math.min(1, (targetRadius - 10) / 22));
  const freezePct = 0.75 - t * 0.6;
  return effectiveThreshold * freezePct;
}

function getCryoDamage(lvl, dmgMult) {
  return dmgMult * (4 + lvl * 1.5);
}

function getPulseClusterGeneration(lvl) {
  return Math.max(0, lvl - 1);
}

function getPulseBaseDamage(p, lvl) {
  return p.dmg * (28 + lvl * 10);
}

function getEmpBaseDamage(p) {
  return p.dmg * 4.6;
}

function firePulseShell(p, angle, dmg, lvl, overrides = {}) {
  const radius = overrides.radius ?? 9;
  const speed = overrides.speed ?? 300;
  const color = overrides.col ?? '#FFB627';
  const life = overrides.life ?? 2.8;
  mkBullet(
    p.x,
    p.y,
    Math.cos(angle) * speed,
    Math.sin(angle) * speed,
    radius,
    dmg,
    color,
    life,
    {
      type: 'pulse',
      tier: lvl,
      pulseLvl: lvl,
      pierce: overrides.pierce ?? 0,
      explosive: true,
      clusterGen: overrides.clusterGen ?? getPulseClusterGeneration(lvl),
      isOverload: !!overrides.isOverload,
      isFragment: !!overrides.isFragment,
      ...overrides.meta,
    }
  );
}

export const WDEFS = {
  cryo: {
    id: 'cryo', name: 'CRYO', icon: '❄', col: '#00CFFF',
    maxLvl: 5,
    baseRate: 1.9,
    getRate: p => {
      const lvl = getWeaponLevel(p, 'cryo');
      const base = 1.9 + lvl * 0.35;
      const rate = base * (p.rateBonus || 1);
      const ascension = getAscension(p, 'cryo');
      const ascensionTier = getAscensionTierData(p, 'cryo');
      if (ascension === 'permafrost') {
        return rate * (ascensionTier?.definition?.fireRateMult || 1);
      }
      return rate;
    },
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = getWeaponLevel(p, 'cryo');
      const ascension = getAscension(p, 'cryo');
      const ascensionTier = getAscensionTierData(p, 'cryo');
      if (ascension === 'frost_field') return;
      const dmg = getCryoDamage(lvl, p.dmg);
      let overloadDef = null;
      if (ascension === 'overload') {
        p._cryoOverloadCounter = (p._cryoOverloadCounter || 0) + 1;
        overloadDef = ascensionTier?.definition;
      }
      const permafrostDef = ascension === 'permafrost' ? ascensionTier?.definition : null;
      const count = permafrostDef?.projectileCount || getCryoProjectileCount(lvl);
      const spreadStep = getCryoSpreadStep(count) * (permafrostDef?.spreadStepMult || 1);
      const startOffset = -spreadStep * (count - 1) * 0.5;
      const projectileSpeed = permafrostDef?.projectileSpeed || 430;
      const projectilePierce = permafrostDef?.projectilePierce ?? 1;
      const projectileColor = permafrostDef?.projectileColor || '#00CFFF';
      const projectileRadius = permafrostDef?.projectileRadius || 5;
      const freezeOnHit = ascension === 'permafrost';
      const overloadProcEvery = overloadDef?.procEvery || 3;
      const isOverloadVolley = ascension === 'overload' && (p._cryoOverloadCounter || 0) >= overloadProcEvery;
      const overloadIndices = isOverloadVolley
        ? new Set(getCryoOverloadIndices(count, overloadDef?.empoweredShots || 1))
        : null;
      if (isOverloadVolley) p._cryoOverloadCounter = 0;

      for (let i = 0; i < count; i++) {
        const angle = a + startOffset + i * spreadStep;
        const isOverloadShot = !!overloadIndices?.has(i);
        mkBullet(
          p.x,
          p.y,
          Math.cos(angle) * projectileSpeed,
          Math.sin(angle) * projectileSpeed,
          isOverloadShot ? projectileRadius + 1 : projectileRadius,
          isOverloadShot ? dmg * (overloadDef?.damageMult || 2) : dmg,
          isOverloadShot ? '#E8FCFF' : projectileColor,
          2.2,
          {
            type: 'cryo',
            tier: lvl,
            cryoLevel: lvl,
            pierce: isOverloadShot ? (overloadDef?.pierce ?? projectilePierce) : projectilePierce,
            freeze: freezeOnHit,
            permafrostFreeze: freezeOnHit,
            projectileColor: isOverloadShot ? '#E8FCFF' : projectileColor,
            isCryoOverload: isOverloadShot,
          }
        );
      }
    },
    tick(p, dt, _onHitEnemy, helpers = {}) {
      tickCryoAscension(
        p,
        helpers.enemies || enemies,
        dt,
        helpers.addParticle,
        helpers.applyFreezeMeter || applyFreezeMeter,
        helpers.onTickDamage
      );
    }
  },
  pulse: {
    id: 'pulse', name: 'PULSE', icon: '◈', col: '#FFB627',
    maxLvl: 5,
    baseRate: 0.45,
    getRate: p => 0.45 * (p.rateBonus || 1),
    fire(p) {
      const t = nearest(p); if (!t) return;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      const lvl = getWeaponLevel(p, 'pulse');
      const dmg = getPulseBaseDamage(p, lvl);
      const ascension = getAscension(p, 'pulse');
      const ascensionTier = getAscensionTierData(p, 'pulse');

      if (ascension === 'proximity_mine') {
        const mineDef = ascensionTier?.definition;
        p._pulseMines ||= [];
        const maxMines = mineDef?.maxMines || 6;
        if (p._pulseMines.length >= maxMines) p._pulseMines.shift();
        p._pulseMines.push({
          x: p.x,
          y: p.y,
          r: mineDef?.triggerRadius || 18,
          armed: false,
          armTimer: 0.5,
          triggered: false,
          dmg: dmg * (mineDef?.damageMult || 3),
          col: '#FFB627',
          life: 30,
          blastRadius: mineDef?.blastRadius || 120,
        });
        return;
      }

      if (ascension === 'fragmentation') {
        const fragDef = ascensionTier?.definition;
        const fragmentCount = fragDef?.fragmentCount || 8;
        const spread = (50 * Math.PI) / 180;
        const startOffset = -spread * 0.5;
        const step = fragmentCount > 1 ? spread / (fragmentCount - 1) : 0;
        const fragmentClusterGen = Math.max(0, getPulseClusterGeneration(lvl) - 1);
        for (let i = 0; i < fragmentCount; i++) {
          const angle = a + startOffset + i * step;
          firePulseShell(p, angle, dmg * (fragDef?.fragmentDamageMult || 0.4), lvl, {
            radius: 5,
            speed: 340,
            clusterGen: fragmentClusterGen,
            isFragment: true,
            meta: {
              fragmentDamageMult: fragDef?.fragmentDamageMult || 0.4,
              fragmentRadius: fragDef?.fragmentRadius || 48,
            },
          });
        }
        return;
      }

      if (ascension === 'overload_round') {
        const overloadDef = ascensionTier?.definition;
        p._pulseOverloadCounter = (p._pulseOverloadCounter || 0) + 1;
        if (p._pulseOverloadCounter >= (overloadDef?.procEvery || 3)) {
          p._pulseOverloadCounter = 0;
          firePulseShell(p, a, dmg * (overloadDef?.damageMult || 5), lvl, {
            radius: 14,
            pierce: 999,
            col: '#FFD56A',
            isOverload: true,
            meta: {
              glowCol: '#FFE6A6',
              overloadRadiusScale: overloadDef?.radiusScale || 2.0,
            },
          });
          return;
        }
      }

      firePulseShell(p, a, dmg, lvl, {
        meta: ascension === 'chain_reaction' ? { chainState: { procs: 0 } } : undefined,
      });
    }
  },
  emp: {
    id: 'emp', name: 'EMP', icon: '⚡', col: '#BF77FF',
    maxLvl: 5,
    baseRate: 0.4,
    getRate: p => 0.4 * (p.rateBonus || 1),
    fire(p, onHitEnemy) {
      const lvl = getWeaponLevel(p, 'emp');
      const ascension = getAscension(p, 'emp');
      const ascensionTier = getAscensionTierData(p, 'emp');
      const scaling = getEmpScaling(lvl);
      const r = scaling.radius;
      const dmg = getEmpBaseDamage(p) * scaling.dmgMult;
      const stunDur = scaling.stun;

      if (ascension === 'triple_pulse') {
        const tripleDef = ascensionTier?.definition;
        const radiusMult = tripleDef?.radiusMult || 1;
        this.tripleWaves = this.tripleWaves || [];
        this.tripleWaves.push({
          x: p.x,
          y: p.y,
          r1: 0,
          r2: 0,
          r3: 0,
          maxR1: (160 + lvl * 38) * 1.0 * radiusMult,
          maxR2: (160 + lvl * 38) * 1.5 * radiusMult,
          maxR3: (160 + lvl * 38) * 2.2 * radiusMult,
          speed1: 500,
          speed2: 350,
          speed3: 220,
          dmg,
          stunBase: stunDur,
          midDamageMult: tripleDef?.midDamageMult || 0.6,
          outerDamageMult: tripleDef?.outerDamageMult || 0.3,
          midStunMult: tripleDef?.midStunMult || 0,
          outerStunMult: tripleDef?.outerStunMult || 0,
          hitEnemies: new Set(),
          hitBoss: false,
          life: 1.8,
          r1Sound: false,
          r2Sound: false,
          r3Sound: false,
        });
        return;
      }

      addRing(p.x, p.y, r, '#BF77FF', 2.5, 0.45);

      enemies.forEach(e => {
        if (dist2(p, e) < r * r) {
          if (ascension) this.hitEnemy(e, dmg, '#BF77FF');
          else onHitEnemy(e, dmg, '#BF77FF');
          applyStun(e, stunDur);
        }
      });

      const boss = getExtraTarget();
      if (boss?.alive && dist2(p, boss) < r * r) {
        onHitEnemy(boss, dmg, '#BF77FF');
        if (!boss.stunImmune) {
          boss.stunT = stunDur * 0.5;
          boss.stunned = true;
        }
      }
      pruneEnemies();
    }
  },
  swarm: {
    id: 'swarm', name: 'SWARM', icon: '◉', col: '#1DFFD0',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
    tick(p, dt, onHitEnemy, helpers = {}) {
      const lvl = getWeaponLevel(p, 'swarm');
      const ascension = getAscension(p, 'swarm');
      const ascensionTier = getAscensionTierData(p, 'swarm');
      const cnt = getSwarmCount(lvl);
      const orR = 85 + lvl * 15;
      const seekR = 190 + lvl * 30;
      const seekSpd = 320 + lvl * 40;
      const dmgPer = p.dmg * (28 + lvl * 14);

      if (!p._dr || p._dr.length !== cnt) {
        p._dr = Array.from({ length: cnt }, (_, i) => mkSwarmDrone((i / cnt) * Math.PI * 2));
      }
      p._novaDrones ||= [];
      p._splitDrones ||= [];

      const boss = getExtraTarget();
      const allTargets = [...enemies, ...(boss?.alive ? [boss] : [])];

      const processDrone = (d, options = {}) => {
        const isNova = !!options.isNova;
        const canFrenzy = !isNova && ascension === 'frenzy';
        const canSplit = !isNova && ascension === 'split_swarm';
        const frenzyDef = ascension === 'frenzy' ? ascensionTier?.definition : null;
        const speedMult = isNova ? 2 : (canFrenzy && d.frenzy ? (frenzyDef?.speedMult || 2) : 1);
        const damageMult = canFrenzy && d.frenzy ? (frenzyDef?.damageMult || 2) : 1;
        const hitCooldown = d.frenzy ? 0.08 : 0.55;
        const droneOrbitR = isNova ? orR * 1.3 : orR;

        d.a += dt * 2.2;
        d.pulseOffset = 0;
        if (d.cooldown > 0) d.cooldown -= dt;
        if (typeof d.ht === 'number' && d.ht > 0) d.ht -= dt;
        if (typeof d.frenzyCD !== 'number') d.frenzyCD = 0;
        if (canFrenzy) {
          if (d.frenzyCD > 0) d.frenzyCD = Math.max(0, d.frenzyCD - dt);
          d.frenzyT = Math.max(0, (d.frenzyT || 0) - dt);
          if (d.frenzy && d.frenzyT <= 0) {
            d.frenzy = false;
            d.frenzyCD = frenzyDef?.cooldown || 3.0;
          }
        }

        if (d.state === 'orbit') {
          d.sx = p.x + Math.cos(d.a) * droneOrbitR;
          d.sy = p.y + Math.sin(d.a) * droneOrbitR;
          addDot(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', isNova ? 6 : 7, 0.12);

          if (d.cooldown <= 0) {
            const bestT = acquireSwarmTarget(allTargets, d.sx, d.sy, seekR);
            if (bestT) {
              d.state = 'seek';
              d.target = bestT;
              d.tx = bestT.x;
              d.ty = bestT.y;
              addBurst(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', 4, 60, 2.5, 0.2);
            }
          }
        } else if (d.state === 'seek') {
          if (d.target && (d.target.hp > 0 || d.target === boss)) {
            d.tx = d.target.x;
            d.ty = d.target.y;
          }
          const ddx = d.tx - d.sx;
          const ddy = d.ty - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * speedMult * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, isNova ? '#5DFFE0' : '#1DFFD0', isNova ? 6 : 7, 0.14);

          const hitR = d.target === boss ? boss.r : (d.target?.r || 12);
          if (dist < hitR + 10) {
            if (canSplit && !d.hasSplitThisContact) {
              d.hasSplitThisContact = true;
              if (d.target) helpers.spawnSplitDrone?.(p, d, d.target, orR);
            }
            const prevTarget = d.target;
            const hit = prevTarget ? onHitEnemy(prevTarget, dmgPer * damageMult, '#1DFFD0') : null;
            pruneEnemies();
            addBurst(d.sx, d.sy, '#1DFFD0', 7, 100, 3.5, 0.35);
            addRing(d.sx, d.sy, 28, '#1DFFD0', 1.5, 0.2);
            d.cooldown = hitCooldown;
            d.ht = hitCooldown;

            if (hit?.killed && ascension === 'nova_swarm' && hit.target) {
              helpers.onNovaDroneKill?.(hit.target.x, hit.target.y, hit.target, {
                isNova,
                drone: d,
              });
            }

            if (canFrenzy && hit?.killed && prevTarget !== boss && !d.frenzy && d.frenzyCD <= 0) {
              d.frenzy = true;
              d.frenzyT = frenzyDef?.duration || 3.0;
              helpers.onFrenzyStart?.(d);
            }

            if (canFrenzy && d.frenzy) {
              d.target = acquireSwarmTarget(allTargets, d.sx, d.sy, seekR, prevTarget);
              if (d.target) {
                d.tx = d.target.x;
                d.ty = d.target.y;
                d.state = 'seek';
              } else {
                d.state = 'return';
                d.target = null;
              }
            } else {
              d.state = 'return';
              d.target = null;
            }
          }

          if (d.target && d.target !== boss && d.target.hp <= 0) {
            d.state = 'return';
            d.target = null;
            d.cooldown = 0.2;
          }
        } else {
          const homeX = p.x + Math.cos(d.a) * droneOrbitR;
          const homeY = p.y + Math.sin(d.a) * droneOrbitR;
          const ddx = homeX - d.sx;
          const ddy = homeY - d.sy;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          const move = Math.min(dist, seekSpd * 1.4 * dt);
          d.sx += (ddx / dist) * move;
          d.sy += (ddy / dist) * move;
          addDot(d.sx, d.sy, isNova ? '#5DFFE099' : '#1DFFD055', isNova ? 4 : 5, 0.1);
          if (dist < 12) {
            d.state = 'orbit';
            d.hasSplitThisContact = false;
          }
        }
      };

      p._dr.forEach(d => processDrone(d, { allowPulseVisual: true }));

      for (let i = p._novaDrones.length - 1; i >= 0; i--) {
        const d = p._novaDrones[i];
        d.life -= dt;
        if (d.life <= 0) {
          helpers.onNovaDroneExpire?.(d.sx ?? p.x, d.sy ?? p.y);
          p._novaDrones.splice(i, 1);
          continue;
        }
        if (typeof d.state !== 'string') {
          Object.assign(d, mkNovaDrone(), d);
        }
        processDrone(d, { isNova: true, allowPulseVisual: false });
      }
    }
  },
  arcblade: {
    id: 'arcblade', name: "JAC'S BOOMERANG", icon: '◈', col: '#FF2D9B',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
    tick(_p, _dt, _onHitEnemy, _helpers = {}) {
      // ARC BLADE runtime is managed directly in game.js.
    }
  },
  molotov: {
    id: 'molotov', name: "LUKE'S MOLOTOV", icon: '🔥', col: '#FF2D9B',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire() {},
  },
  barrier: {
    id: 'barrier', name: 'BARRIER', icon: '◎', col: '#C6FF00',
    maxLvl: 5,
    baseRate: 0,
    getRate: () => 0,
    fire: () => {},
    tiers: {
      1: getBarrierTier(1),
      2: getBarrierTier(2),
      3: getBarrierTier(3),
      4: getBarrierTier(4),
      5: getBarrierTier(5),
    },
    tick(p, dt, _onHitEnemy, helpers = {}) {
      const lvl = getWeaponLevel(p, 'barrier');
      if (!lvl) return;
      const tier = getBarrierTier(lvl);

      p._shieldMaxCap = tier.maxCap;
      p._shieldFlashT = Math.max(0, p._shieldFlashT || 0);
      p._shieldHitT = Math.max(0, p._shieldHitT || 0);

      if (typeof p._shieldActive !== 'boolean') p._shieldActive = true;
      if (typeof p._shieldCap !== 'number') p._shieldCap = tier.maxCap;
      if (typeof p._shieldRechargeT !== 'number') p._shieldRechargeT = 0;
      if (typeof p._shieldActiveT !== 'number') p._shieldActiveT = tier.activeDuration;
      if (typeof p._shieldAbsorbedCycle !== 'number') p._shieldAbsorbedCycle = 0;

      if (p._shieldFlashT > 0) p._shieldFlashT = Math.max(0, p._shieldFlashT - dt);
      if (p._shieldHitT > 0) p._shieldHitT = Math.max(0, p._shieldHitT - dt);

      if (p._shieldActive) {
        p._shieldCap = Math.min(p._shieldCap, p._shieldMaxCap);
        p._shieldActiveT -= dt;
        if (p._shieldActiveT <= 0 || p._shieldCap <= 0) {
          helpers.onShieldBreak?.(p, tier);
        }
        return;
      }

      p._shieldRechargeT -= dt;
      if (p._shieldRechargeT <= 0) {
        p._shieldActive = true;
        p._shieldCap = p._shieldMaxCap;
        p._shieldActiveT = tier.activeDuration;
        p._shieldRechargeT = 0;
        p._shieldAbsorbedCycle = 0;
        helpers.onShieldRestore?.(p, tier);
      }
    }
  }
};

export function handleCryoImpact(game, bullet, target) {
  if (bullet.meta?.isCryoShard) {
    addBurst(target.x, target.y, '#A6F7FF', 5, 36, 1.8, 0.16);
    addRing(target.x, target.y, 16, '#7BE9FF', 1.2, 0.12);
  } else if (!target.frozen) {
    applySlow(target, 2.0, 0.5);
  }
  const cryoLevel = bullet.meta?.cryoLevel || 1;
  target._freezeSourceLevel = cryoLevel;
  const freezeAmount = bullet.meta?.permafrostFreeze
    ? getPermafrostFreezeAmount(target)
    : bullet.meta?.freeze
      ? getEffectiveFreezeThreshold(target)
    : (bullet.meta?.freezeAmount || getCryoFreezeAmount(cryoLevel));
  applyFreezeMeter(target, freezeAmount);
}

export function tickCryoAscension(P, enemyList, dt, addParticle, applyFreezeMeterFn, onTickDamage) {
  const ascension = getAscension(P, 'cryo');
  if (ascension !== 'frost_field') return;
  const fieldDef = getAscensionTierData(P, 'cryo')?.definition;
  const radius = fieldDef?.radius || 150;
  const freezeTime = fieldDef?.freezeTime || 1.5;
  const dpsMult = fieldDef?.dpsMult || 5;

  enemyList.forEach(e => {
    if (!e || e.hp <= 0) return;
    const dx = e.x - P.x;
    const dy = e.y - P.y;
    if (dx * dx + dy * dy > radius * radius) {
      e._frostFieldTime = 0;
      return;
    }
    applySlow(e, 0.4, 0.4);
    e._frostFieldTime = (e._frostFieldTime || 0) + dt;
    onTickDamage?.(e, P.dmg * dpsMult * dt, '#00CFFF');
    if (e._frostFieldTime >= freezeTime) {
      applyFreezeMeterFn(e, getEffectiveFreezeThreshold(e));
    }
  });
  addParticle?.(P.x, P.y, radius, 'rgba(0, 207, 255, 0.22)', 1.5, 0.18);
}

export function applyFreezeMeter(e, amount) {
  ensureFreezeState(e);
  if (e.frozen) return;
  if (e.freezeCooldown > 0) return;
  if (e.freezeImmune) return;
  if (e.isBoss && e.bossFreezeCooldown > 0) return;

  const effectiveThreshold = getEffectiveFreezeThreshold(e);
  e.freezeMeter = Math.min(effectiveThreshold, e.freezeMeter + amount);

  if (e.isBoss && e.freezeMeter > effectiveThreshold * 0.3) {
    e.freezeMeter = 0;
    e.bossFreezeCooldown = 8;
  }
}

export function updateCryoFields(game, dt) {
  updatePulseClusters(game, dt);
  game.cryoFields = [];
}

export function getPulseHitDamage(b, dmg) {
  return dmg;
}

export function triggerPulseShockwave(e, dmg, onHitEnemy) {
  const x = e.x, y = e.y, r = 80;
  const splash = dmg * 0.6;
  addRing(x, y, r, '#FFB627', 2.5, 0.5);
  addBurst(x, y, '#FFB627', 8, 90, 3.5, 0.4);
  enemies.forEach(f => {
    if (f !== e && (f.x - x) ** 2 + (f.y - y) ** 2 < r * r) {
      onHitEnemy(f, splash, '#FFB627', false);
    }
  });
  pruneEnemies();
}

export function triggerPulseExplosion(game, bullet, x, y, onHitEnemy, onHitBoss) {
  const radius = bullet.meta?.isOverload
    ? 78 * (bullet.meta?.overloadRadiusScale || 2)
    : bullet.meta?.chainProc
      ? 117
      : bullet.meta?.isFragment
        ? (bullet.meta?.fragmentRadius || 48)
        : 78;
  const splash = bullet.dmg * 0.65;
  const ringMr = bullet.meta?.isOverload ? radius * 2.5 : bullet.meta?.chainProc ? radius * 1.5 : radius;
  addRing(x, y, ringMr, '#FFB627', 2.8, 0.5);
  addBurst(x, y, '#FFB627', 10, 95, 4, 0.45);
  if (bullet.meta?.isOverload && game) game.overloadFlash = Math.max(game.overloadFlash || 0, 0.15);
  if (bullet.meta?.chainProc && game) game.chainFlash = Math.max(game.chainFlash || 0, 0.1);
  applyPulseExplosionDamage(x, y, radius, splash, onHitEnemy, onHitBoss);
  const clusterGen = Math.max(0, bullet.meta?.clusterGen ?? getPulseClusterGeneration(bullet.meta?.pulseLvl || 1));
  if (clusterGen > 0) {
    spawnPulseClusterBombs(x, y, bullet.dmg * 0.45, 1, clusterGen, {
      chainState: bullet.meta?.chainState || null,
      isChainProc: !!bullet.meta?.isChainProc,
    });
  }
}

function spawnPulseClusterBombs(x, y, dmg, generation, maxGeneration, options = {}) {
  const count = generation === 1 ? 4 : 3;
  const speed = generation === 1 ? 180 : 140;
  const life = generation === 1 ? 0.32 : 0.24;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
    pulseClusters.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      dmg,
      life,
      maxLife: life,
      generation,
      maxGeneration,
      canRecluster: generation < maxGeneration,
      chainState: options.chainState || null,
      isChainProc: !!options.isChainProc,
    });
  }
}

export function spawnPulseClusters(x, y, dmg, maxGeneration, options = {}) {
  if (maxGeneration <= 0) return;
  spawnPulseClusterBombs(x, y, dmg, 1, maxGeneration, options);
}


function updatePulseClusters(game, dt) {
  for (let i = pulseClusters.length - 1; i >= 0; i--) {
    const cluster = pulseClusters[i];
    cluster.x += cluster.vx * dt;
    cluster.y += cluster.vy * dt;
    cluster.life -= dt;
    addDot(
      cluster.x,
      cluster.y,
      cluster.generation === 1 ? '#FFB627' : '#FFE4A3',
      cluster.generation === 1 ? 4 : 3,
      0.12
    );
    if (cluster.life > 0) continue;
    detonatePulseCluster(cluster, game);
    pulseClusters.splice(i, 1);
  }
}

function detonatePulseCluster(cluster, game) {
  const chainReactionActive = game && getAscension(game.P, 'pulse') === 'chain_reaction';
  const radiusBase = cluster.generation === 1 ? 56 : 42;
  const radius = chainReactionActive ? radiusBase * 1.3 : radiusBase;
  const color = cluster.generation === 1 ? '#FFB627' : '#FFE4A3';
  addRing(cluster.x, cluster.y, radius, color, 1.8, 0.35);
  const burstCount = (cluster.generation === 1 ? 6 : 4) + (chainReactionActive ? 4 : 0);
  const burstSpeed = (chainReactionActive ? 1.3 : 1) * 70;
  addBurst(cluster.x, cluster.y, color, burstCount, burstSpeed, 2.8, 0.35);
  applyPulseExplosionDamage(
    cluster.x,
    cluster.y,
    radius,
    cluster.dmg,
    (target, dmg, col) => game.hitEnemy(target, dmg, col),
    (dmg, col) => game._doBossHit(dmg, col)
  );
  if (cluster.canRecluster) {
    spawnPulseClusterBombs(
      cluster.x,
      cluster.y,
      cluster.dmg * 0.55,
      cluster.generation + 1,
      cluster.maxGeneration,
      {
        chainState: cluster.chainState,
        isChainProc: cluster.isChainProc,
      }
    );
  }
  if (game?.handlePulseClusterExplosion) game.handlePulseClusterExplosion(cluster, radius, color);
}

function applyPulseExplosionDamage(x, y, radius, dmg, onHitEnemy, onHitBoss) {
  enemies.forEach(f => {
    const dx = f.x - x;
    const dy = f.y - y;
    if (dx * dx + dy * dy < radius * radius) onHitEnemy(f, dmg, '#FFB627');
  });
  const boss = getExtraTarget();
  if (boss?.alive) {
    const dx = boss.x - x;
    const dy = boss.y - y;
    if (dx * dx + dy * dy < radius * radius) onHitBoss(dmg, '#FFB627');
  }
  pruneEnemies();
}
