# Instructions for Claude Code

- Read this file at the start of every session and keep it in mind throughout.
- Treat this file as the single source of truth for project intent, current state, and guardrails.
- When a design decision is made, a feature ships, or something here becomes outdated, update this file in the same session if possible.
- Do not delete historical context. Move outdated guidance to `## Changelog` with a short note.
- If a requested change conflicts with this document in a meaningful way, pause and flag it before overwriting the rule.
- If at any point the user is required to do any of the following please inform them at the end of your message.
EVERY UPDATE:
1. npm run lint
2. npm run check
3. npm run build
4. npm run verify
5. Drag dist/ -> Netlify
6. npx cap sync
7. Play in Android Studio
8. commit git

## Git workflow for future sessions
- Before suggesting any Git command, inspect the repo state first with `git status --short --branch` and tailor the recommendation to the actual situation.
- This is a required step, not optional: after any session that changes files, checks files, or leaves the repo in a different Git state, end the response with a `Git next step` section.
- The `Git next step` section must include:
  - the exact command the user should run next
  - a one-sentence beginner-friendly explanation of what that command does
  - if there are multiple required commands, show them in the exact order to run them
- Explain Git actions as if the user is a beginner. Use plain language, avoid jargon when possible, and briefly define terms like branch, commit, push, and pull when they matter.
- Default workflow for new work: start from updated `main`, create a short-lived branch, make the change, verify the project, commit, push, then open a Pull Request into `main`.
- Preferred command flow for a normal change:
  - `git checkout main`
  - `git pull origin main`
  - `git checkout -b short-description-of-change`
  - make changes
  - `git add -A`
  - `git commit -m "Short clear summary"`
  - `git push -u origin short-description-of-change`
- If there are modified but uncommitted files, recommend `git add -A` and `git commit -m "..."` next.
- If the branch is ahead of origin with no uncommitted files, recommend `git push` or `git push origin <branch>` next.
- If the branch is behind origin, recommend pulling and explain whether `git pull --rebase` or a normal `git pull` is safer for the current state.
- If the user already committed on `main`, do not shame them; explain that it is acceptable for a personal project, then recommend the safest next step for the current state and suggest using branches for the next change.
- Never finish a coding session without checking the live Git state first and giving the user the next Git command to run.
- If the repo is already clean and synced, still include `Git next step: no Git command needed right now` so the user is not left guessing.

# Infinite Rogue - Project Operating Brief

## One-paragraph summary
Infinite Rogue is a mobile-first cyberpunk survivor roguelite inspired by Magic Survival. Runs are short, aggressive, and discovery-driven: the player auto-attacks, kites through dense waves, drafts upgrades during the run, assembles weapon interactions, and eventually dies. The fantasy is not random chaos; it is the feeling of becoming clever through build understanding and seeing that understanding pay off.

## Session startup checklist
- What is the game? Mobile-first endless survivor roguelite with auto-attacks, aggressive wave pressure, weapon drafting, and score-by-survival-time.
- What matters most? Discovery, fast starts, readable combat, distinct weapon identities, and future expandability.
- What is in code today? Three playable characters, seven weapons, four weapon slots per run, six generic passives, a scrolling world camera, surge events, a three-phase recurring boss, heal-orb sustain, records, persistent synergy discovery tracking, menu/death/records overlays, a playtest lab, joystick input, procedural audio, clean run-start resets, and Capacitor Android packaging.
- What is not settled yet? Final weapon depth direction, freeze/boss tuning after the reactivated meter system, broader progression/codex shape, unlock flow, and long-term content scale.
- What must not happen? No permanent stat grind, no tutorial-heavy hand-holding, and no architecture that makes new content expensive to add.

## Product vision

### Core fantasy
The player should finish a run feeling satisfied and clever: "I understood what I was building and it worked."

### Player promise
- Short runs with immediate danger.
- Discovery over explanation.
- Strong moment-to-moment responsiveness on mobile.
- Simple controls, deep build outcomes.
- Endless survival as the score.

### Audience
Broad by intent. The game should be readable for casual players and strategically interesting for genre players.

## Gameplay loop

### Macro loop
1. Enter main menu.
2. Pick a character.
3. Start a run.
4. Survive escalating waves while auto-attacking and repositioning.
5. Collect XP gems and level up into one of three upgrades.
6. Fill up to four weapon slots and deepen a build through weapon levels and passives.
7. Survive periodic surges and recurring boss fights.
8. Die.
9. Review run summary, weapons used, and discovered synergies.
10. Return to menu and try again with better player knowledge.

### Minute-to-minute loop
- Move constantly to maintain spacing and dodge contact/projectile pressure.
- Auto-fire weapons create pressure without aim input.
- XP pickups reward routing and risk.
- Level-up choices shape the build quickly.
- Surges and boss fights create tempo spikes.
- Strong runs should still feel unstable, not solved forever.

### What makes a good run
- The player can summarize the build in one sentence.
- Weapons stay tactically distinct.
- Upgrade cards feel meaningfully different.
- Death feels traceable to greed, weak build direction, or loss of control.

### What makes a bad run
- Early game feels empty.
- Upgrade choices feel fake or interchangeable.
- Combat readability collapses under effects.
- Systems explain too much and flatten discovery.
- New content requires touching unrelated files all over the codebase.

## Gameplay tuning spec

### Target run shape
- A weak or sloppy run should usually die between 2 and 4 minutes.
- A decent run should usually reach 4 to 6 minutes.
- Strong runs should still feel under pressure after 6+ minutes.
- Threat should be visible within the first 5 to 10 seconds.
- The player should not be allowed to stand still safely.

### Run pacing beats

#### 0 to 30 seconds
- Immediate runner pressure.
- First XP routing decisions happen almost instantly.
- The player learns their starting weapon cadence.

#### 30 to 90 seconds
- Shooters begin changing movement patterns.
- First real build direction starts to appear.
- The player should already care about weapon slots versus passives.

#### 90 to 180 seconds
- Surges and the first boss warning break rhythm.
- Build weaknesses should become obvious.
- Sustain, crowd control, and burst should all matter.

#### 180 seconds onward
- The run becomes a stability test.
- Mixed pressure, boss repeats, and denser waves should keep exposing weaknesses.

### Upgrade cadence targets
- First level-up should happen quickly.
- Early levels should come fast enough to hook the run.
- Mid-run choices should remain meaningful rather than spammy.
- Builds should become recognizable without maxing everything too early.

### Boss timing targets
- First boss warning: 5 seconds early.
- Boss intro: 3.5 seconds.
- First boss spawn: 120 seconds.
- Boss respawn cadence after a kill: next boss 90 seconds later.
- Boss fights should interrupt normal wave and surge flow cleanly.

### Surge tuning targets
- Surges happen every 40 seconds when not suppressed by boss flow.
- Surges should feel like spacing and density tests, not only DPS checks.
- Surge pressure should be feared and readable.

### Failure-state rules
- Death should usually be attributable to positioning, routing greed, or build weakness.
- Death should not feel random or hidden.

## Non-negotiable design pillars
- Discovery over instruction.
- Short punchy runs.
- Aggressive from second one.
- Emergent strategy through weapon interaction.
- Endless structure: no run win state, only survival time.
- Mobile-first readability and controls.

## Current implementation snapshot

### Built now
- Main menu overlay with a two-screen flow: animated splash/title screen, records plus restored playtest-lab entry point, separate character-select screen, JACK IN screen-transition handoff into gameplay, and a drifting animated network background behind the overlay.
- In-run pause system with an always-visible HUD pause button during active runs, desktop `Escape` toggle support, and a dedicated pause overlay with resume and quit-run actions.
- Canvas-based core gameplay loop with keyboard plus virtual joystick support.
- Scrolling `3000 x 3000` world with player-follow camera, world-edge clamping, and boundary-pressure feedback.
- Three playable characters: Ghost, Bruiser, Hacker.
- Seven total weapons in the pool, but only four weapon slots can be owned in a run.
- Weapon upgrades currently run from level 1 to level 5.
- Ascended weapons now continue from Ascension Tier 1 to Tier 5 through normal upgrade drafts.
- Six run-wide passive upgrades.
- XP gems with magnet pickup behavior and merge logic.
- Heal orbs that restore 5% max HP and are globally throttled.
- Surge events every 40 seconds outside boss flow, with `Game.surgeCount` expanding the enemy roster after each surge completes.
- Six live enemy types in the normal pool: Runner, Shooter, Brute, Titan, Juggernaut, and Shield Leech.
- Recurring three-phase boss with warning, intro, boss bar, phase announcements, and post-kill reward draft.
- Level-up-pool weapon Ascension draft injection for eligible level-5 weapons, with live pools for Cryo, Pulse, EMP, Swarm, Arc Blade, and Molotov.
- Death screen with expanded run summary: time and kill PB comparison, level, surge wave reached, full loadout rows with level dots and Ascension tags, run synergies, and direct menu return.
- Save-backed records screen with global and per-character bests.
- Persistent synergy discovery tracking with first-discovery pause overlay.
- Procedural audio for weapons, hits, XP, surges, boss warning/phases/death, boss music, plus dedicated UI open/close/click/select/ascension/death stingers.
- Shared UI polish system for main menu, level-up, death, records, discovery, and Ascension overlays using CSS transitions/keyframes, button press feedback, a dedicated JACK IN screen-transition layer, a menu-background animation system, red death vignette lead-in, low-health pulsing vignette feedback, and Ascension screen flash/shimmer beats.
- HUD weapon slots now show per-weapon level dots in the weapon colour and swap to an `A1` to `A5` Ascension-tier tag when that weapon is Ascended.
- HUD includes a surge timer warning strip beneath the XP bar that fills over the 40-second cadence, pulses red near surge, and stays visibly active during surge windows.
- Stronger damage feedback including screen flash, low-health vignette, HP lag bar, barrier-heal HP bar segment, and Barrier absorb hit feedback via ripple plus dedicated absorb audio.
- Cryo freeze buildup is live with per-enemy freeze meters, thaw cooldowns, frost visuals, thaw burst feedback, upgraded Cryo Storm/Nova/Permafrost readability, Overload's charged volley behavior, and Frost Field's slow-first aura with minimal chip damage.
- Playtest lab overlay with instant weapon/passive tier editing, ascension selection plus Ascension-tier stepping, world/camera debug readouts, time skip controls, instant loadout injection, and one-click late-game/boss/max-weapon presets.
- Capacitor configuration plus committed Android project are live in-repo.
- Web build now uses relative asset paths plus a wired PWA manifest/icon set so the same `dist/` works for Netlify drag-drop and Capacitor sync.
- Shared UI, playtest, menu-background, Arc Blade, and render helpers are now split into dedicated modules (`gameUi.js`, `playtest.js`, `menuBackground.js`, `arcBlade.js`, `renderUtils.js`) so `game.js` carries less duplicate view/helper code.
- Repo verification now has a three-step local pass: `npm run check`, `npm run build`, then `npm run verify` to validate built manifest and asset links.

### Built but still likely to change
- Weapon tuning and upgrade text.
- Character balance and differentiation depth.
- Boss numbers and some pattern density.
- Save schema growth beyond current bests plus discovery storage.
- Exact freeze thresholds, spread pacing, and boss anti-freeze tuning.

### Not built yet
- Character unlock flow.
- Additional characters beyond the current three.
- Additional weapons beyond the current seven.
- A fuller codex/planning layer on top of records and discoveries.
- Store prep and shipping polish beyond the current Capacitor/Android setup.
- Analytics or crash reporting.

## Current character roster

### Ghost
- Start weapon: Cryo
- Base speed: 158
- Passive: 20% dodge chance
- Playstyle: safest mover, kiting-first, evasive baseline
- Status: stable reference character

### Bruiser
- Start weapon: Pulse
- Base speed: 130
- Passive: +35% damage while below 50% HP
- Playstyle: risky aggression, burst conversion while wounded
- Status: implemented and live

### Hacker
- Start weapon: EMP
- Base speed: 145
- Passive: stunned enemies drop 2x XP
- Playstyle: control and level snowball
- Status: implemented and live

## Current weapons
The live weapon system is simple and numeric right now:
- Each weapon has `maxLvl: 5`.
- Unlocking a new weapon gives level 1.
- Upgrading an owned weapon increases its level by 1.
- The run can own at most four weapons.
- Weapon identity currently comes from direct per-level behavior, not path/fork trees.

### Weapon roster
| Weapon | Colour | Role | Live behavior |
|---|---|---|---|
| Cryo | `#00CFFF` | Fast lane pressure / control setup | Fires 1 to 5 piercing lances as level rises; slows on hit and builds freeze meter |
| Pulse | `#FFB627` | Burst / explosive chain coverage | Heavy shell with impact explosion and recursive cluster-bomb scaling from level 2 onward |
| EMP | `#BF77FF` | Radial control / scaling burst | Expanding stun burst with pure per-level scaling in radius, stun duration, and damage multiplier |
| Swarm | `#1DFFD0` | Persistent seek damage | Orbiting drones that seek targets; levels mainly add more drones |
| Arc Blade | `#FF2D9B` | Orbiting boomerang pressure | `JAC'S BOOMERANG`; orbiting return-path blades managed in `game.js`, with a saw blade Ascension |
| Molotov | `#FF2D9B` | Ground denial / damage-over-time zoning | `LUKE'S MOLOTOV`; arcing bottles land in persistent fire pools managed in `game.js` |
| Barrier | `#C6FF00` | Defensive sustain | Cycling absorb shield with recharge and heal refund based on absorbed damage |

### Live per-weapon detail

#### Cryo
- Level 1: one projectile, pierce 1, fast fire rate.
- Level 2: two-projectile spread.
- Level 3: three-projectile spread.
- Level 4: four-projectile spread.
- Level 5: five-projectile widest spread.
- Current implementation note: Cryo slows on hit, builds a freeze meter by weapon level, freezes targets for 1.5s at threshold, and can spread partial freeze buildup from newly frozen targets.
- All live Cryo Ascensions now continue from `T1` to `T5`, scaling their existing fantasy through stronger shard counts, frozen-target damage, nova size/damage, overload volley count/pierce, field size/freeze speed, or shatter reliability.
- `cryo_storm`: frozen enemies that die fire bright white-cyan shard bursts, and play a distinct crystalline trigger sound once per trigger frame.
- `permafrost`: Cryo becomes a darker-blue shot that applies heavy size-scaled freeze build on hit, stays at 1 projectile through `T2`, grows to 3 projectiles at `T3-T4`, 5 at `T5`, keeps normal Cryo projectile size/speed, gains `+2` pierce each tier (`2/4/6/8/10`), uses a deeper thudding fire sound, and makes frozen enemies spread freeze faster at higher tiers.
- `cryo_nova`: frozen kills detonate for 80% of the dead enemy's max HP in a 150px radius, seed freeze buildup on survivors, and use a shortened white-plus-cyan ring pulse with a brief cyan screen flash.
- `overload`: Cryo now counts volleys toward Overload; every third Cryo volley overloads part of the 5-shot spread into double-damage piercing projectiles, scaling from 1 empowered shot at T1 to all 5 at T5.
- `frost_field`: nearby enemies are slowed immediately, freeze after 1.5s of continuous exposure, and take base damage at `P.dmg * 5` per second so the aura always contributes noticeable chip pressure.
- `shatter`: frozen enemies now gain a brittle crystal-fracture overlay so the Ascension reads differently from base Cryo, any hit can instantly shatter them with a chance that scales from freeze start down to zero before thaw, and Cryo projectile pierce rises by `+1` each tier (`2/3/4/5/6` total pierce).
- `ASCENSIONS.cryo` currently defines `cryo_storm`, `permafrost`, `cryo_nova`, `overload`, `frost_field`, and `shatter`.

#### Pulse
- Level 1: heavy shell with impact explosion.
- Level 2: impact explosion also spawns first-generation cluster bombs.
- Level 3: cluster bombs can split one generation deeper.
- Level 4: cluster chain extends another generation.
- Level 5: cluster chain extends to four total generations.
- Frozen-target bonus damage logic is wired, but depends on freeze being active.
- All live Pulse Ascensions now continue from `T1` to `T5`, scaling their existing behavior through stronger proc rates, wider pull plus extra shells, overload cadence, mine stockpile/blast size, or fragment count/blast size.
- `chain_reaction`: uses a hotter orange-red projectile/explosion treatment than base Pulse, fires 2 shells at `T1-T2` with the second shot opposite the main target line, upgrades to `3` evenly split shells at `T3-T4`, and `4` evenly split shells at `T5`, always keeping one shell aimed at the closest enemy while cluster-bomb retrigger chance steps from `35%` at `T1`, to `40%` at `T2-T3`, and `45%` at `T4-T5`.
- `collapsed_round`: now uses a brighter gravity-shell treatment than base Pulse so the Ascension reads clearly in combat, fires `1/1/2/2/3` shells from `T1-T5`, keeps one shell aimed at the closest enemy, adds the opposite-direction shell at `T3-T4`, and reaches a three-way evenly split volley at `T5`; pull radius increases only at `T2` and `T4`, while each shell still pulls enemies inward before the normal cluster chain detonates.
- `overload_round`: every third Pulse shot becomes the overloaded shell; the HUD tracks the live 3-shot counter.

#### EMP
- EMP is now a clean scaling weapon with no baked-in per-level special rules.
- Level 1: 160px burst, 1.2s stun, x1.0 damage multiplier.
- Level 2: 200px burst, 1.4s stun, x1.3 damage multiplier.
- Level 3: 245px burst, 1.6s stun, x1.7 damage multiplier.
- Level 4: 295px burst, 1.8s stun, x2.2 damage multiplier.
- Level 5: 350px burst, 2.0s stun, x2.8 damage multiplier.
- All live EMP Ascensions now continue from `T1` to `T5`, scaling their existing behavior through larger cascade bursts, wider/stronger Triple Pulse rings, and denser higher-damage Arc Discharge chains.
- `ASCENSIONS.emp` currently defines `cascade_pulse`, `triple_pulse`, and `arc_discharge`.

#### Swarm
- Level 1: 2 drones.
- Level 2: 3 drones.
- Level 3: 4 drones.
- Level 4: 5 drones.
- Level 5: 6 drones.
- Drones orbit, acquire nearby targets, seek, hit, and return.
- All live Swarm Ascensions now continue from `T1` to `T5`, scaling their existing behavior through larger nova detonations, stronger/longer frenzy states, or longer-lived harder-hitting split drones.
- `FRENZY` now grants 3s of 2x speed and 2x damage, then applies a 3s per-drone cooldown before that drone can frenzy again.
- `ASCENSIONS.swarm` currently defines `nova_swarm`, `frenzy`, and `split_swarm`.

#### Arc Blade
- Display name: `JAC'S BOOMERANG`.
- Live behavior: curved boomerang discs orbit out and back around the player; runtime logic lives in `game.js`.
- Current implementation note: Arc Blade has a live Ascension pool entry but only one option right now.
- `saw_blade` now continues from `T1` to `T5`, scaling the same orbital saw fantasy through larger orbit, radius, contact cadence, and damage.
- `ASCENSIONS.arcblade` currently defines `saw_blade`.

#### Molotov
- Display name: `LUKE'S MOLOTOV`.
- Level 1: 1 pool, 55px radius, 2.5s duration, 2.5s fire rate, x8 damage multiplier.
- Level 2: 1 pool, 70px radius, 2.5s duration, 2.2s fire rate, x9 damage multiplier.
- Level 3: 2 bottles in a fan, 80px pools, 3.0s duration, 2.0s fire rate, x10 damage multiplier.
- Level 4: 2 bottles in a fan, 90px pools, 3.0s duration, 1.8s fire rate, x11 damage multiplier.
- Level 5: 3 bottles in a fan, 100px pools, 3.0s duration, 1.6s fire rate, x12 damage multiplier.
- Live behavior: bottles use sector-based targeting, lead enemies slightly so pools land ahead of their path, land in persistent fire pools, and deal continuous damage over time to enemies inside them.
- All live Molotov Ascensions now continue from `T1` to `T5`, scaling their existing behavior through bigger Inferno pools, more Bouncing Cocktail hops/pool size, or denser Cluster Molotov sub-bottle spreads.
- `inferno`: throws one oversized bottle regardless of level count, creates one pool with radius `tier.radius * 1.8`, lasts 8 seconds, deals 50% more damage, and fires at half the normal cadence (`tier.fireRate * 2.0`).
- `ASCENSIONS.molotov` currently defines `inferno`, `bouncing_cocktail`, and `cluster_molotov`.

#### Barrier
- Level 1: absorb 40, active 4.2s, recharge 8s.
- Level 2: absorb 65, active 5.1s, recharge 7s.
- Level 3: absorb 95, active 5.9s, recharge 6s.
- Level 4: absorb 130, active 6.8s, recharge 5s.
- Level 5: absorb 175, active 8.5s, recharge 4s.
- When the shield cycle ends or breaks, the player heals for absorbed damage, capped at 40% of missing HP for that cycle.
- Barrier absorbs now trigger a clearer lime hit burst/ripple and a distinct low shield-thud audio cue before the shield actually breaks.

## Current passive upgrades
| ID | Label | Live effect |
|---|---|---|
| `spd` | SPRINT | Speed x1.22 |
| `dmg` | OVERCLOCK | Damage x1.25 |
| `mag` | MAGNET | Pickup radius x1.6 |
| `hp` | NANO-REPAIR | Max HP +30 and heal up to 30 |
| `dg` | GHOST STEP | Dodge +12%, cap 65% |
| `rt` | OVERCLOCK FIRE | Fire rates x1.25 |

## Upgrade system rules
- Always present exactly 3 options.
- Normal level-ups should usually include:
- at least 1 weapon-side option
- at least 1 passive option
- Upgrade pool logic lives in `src/upgrades.js`.
- New weapons are only offered while the player owns fewer than 4 weapons.
- Owned weapons can level up to 5.
- Eligible level-5 weapons can inject an Ascension card into normal level-up drafts at a 40% chance; the Ascension card replaces one of the three normal cards and then opens the existing three-option Ascension draft.
- Once a weapon is Ascended, that chosen Ascension can keep leveling from T1 to T5 through normal upgrade cards.
- Boss kills currently reuse the same pool structure in a dedicated reward draft.
- Upgrade text should stay explicit and numeric wherever practical.

## Current Ascension pools
- Cryo: `cryo_storm`, `permafrost`, `cryo_nova`, `overload`, `frost_field`, `shatter`
- Pulse: `chain_reaction`, `collapsed_round`, `overload_round`, `proximity_mine`, `fragmentation`
- EMP: `cascade_pulse`, `triple_pulse`, `arc_discharge`
- Swarm: `nova_swarm`, `frenzy`, `split_swarm`
- Arc Blade: `saw_blade`
- Molotov: `inferno`, `bouncing_cocktail`, `cluster_molotov`

## Current synergies and progression layer

### Save-backed systems live now
- Local save in `progression.js`.
- Global bests: best time, most kills, highest level, total runs.
- Per-character bests with the same fields.
- Persistent discovered synergy IDs.
- Records overlay in the main menu.
- First-time synergy reveal pauses the run and shows a dedicated overlay.

### Defined discoverable synergies
| ID | Label | Intended effect |
|---|---|---|
| `cryo_pulse` | CRYO + PULSE | Frozen enemies take 3.5x Pulse damage |
| `cryo_emp` | CRYO + EMP | EMP detonates frozen enemies with amplified force |
| `swarm_freeze` | SWARM + CRYO | Drones gain payoff against frozen targets |

### Important live note
- The persistence, records, and discovery UI layer is fully live.
- The freeze-based synergy definitions still exist in code and save data.
- No gameplay synergies are currently active in live combat.
- Treat synergy activation as a future gameplay task after the core weapon roster is in a stronger state.

## Enemy roster and pressure model

### Enemy types
| Type | Shape | Colour | Behaviour |
|---|---|---|---|
| Runner | Triangle | `#E24B4A` | Fast, low HP, often clustered |
| Shooter | Circle | `#FFB627` | Holds range and fires slow projectiles |
| Brute | Square | `#D4537E` | Slow, tanky, punishing contact damage |
| Titan | Hexagon | `#8B0000` | Very slow elite with huge HP, heavy contact damage, a pulsing aura, strong stun resistance, and a much higher freeze threshold |
| Juggernaut | Pentagon | `#FF6600` | Large control-breaker with high contact damage, full stun/slow/freeze/knock immunity, and a permanent orange crackle aura |
| Shield Leech | Diamond | `#1A6B3A` body / `#44FF88` shield | Slow support enemy that moves toward the nearest non-Leech enemy, redirects allied damage into a large shared shield bubble, and is capped at 2 active copies |

### Pressure rules
- Runners start immediately.
- After surge 1 completes, Shooters join the spawn pool.
- After surge 2 completes, Brutes join.
- After surge 3 completes, Titans join the normal pool with no warning banner or separate timer.
- After surge 4 completes, Juggernauts join.
- After surge 5 completes, Shield Leeches join.
- Enemy stats now accelerate after 120 seconds through a steeper wave curve and a harder late-game damage multiplier.
- Enemy scaling now ramps more gently after 120 seconds, with the damage multiplier delayed until 150 seconds and growing more slowly.
- Base enemy damage is currently 15% higher than the earlier baseline across runner contact, shooter projectiles, and brute contact.
- Surges increase spawn density by batching more enemies, but use the lighter `wave * 0.5` batch ramp again.
- Active Shield Leeches are capped at 2 simultaneously.
- No normal enemies spawn during boss intro or while the boss is alive.

## Current pickups
- XP gems are the default reward pickup.
- Gems can merge when drops are close.
- If gem counts get too high, value can be awarded directly for performance/readability reasons.
- Heal orbs use the same magnet behavior as gems.
- Heal orbs restore 5% max HP, rounded, with no overheal.
- Runner/shooter heal-orb drop chance: 1%, replacing the XP gem if it happens.
- Brute heal-orb drop chance: 4%, in addition to its normal XP gem.
- Active heal orbs are capped and globally cooldown-throttled.
- Heal-orb chance falls off over time.
- Bosses drop 3 heal orbs on death.

## Current boss encounter

### Cadence
- Boss warning appears 5 seconds before spawn.
- Boss intro lasts 3.5 seconds.
- First boss spawns at 120 seconds.
- After a boss dies, the next boss is scheduled 90 seconds later.
- Surges are cancelled or suppressed during boss intro and boss combat.
- `Game` now also tracks `bossActive`, `surgeCount`, `_activeShields`, and `_bossShockwave` for surge-based roster progression, cached Leech shield lookups, and boss transition danger.
- `Player` runtime state now also uses `_cryoOverloadCounter` for Overload's every-third-shot release cycle.

## Current runtime state

### Player runtime state
- Core stats: `x`, `y`, `r`, `hp`, `maxHp`, `hpLag`, `spd`, `dmg`, `mag`, `dodge`, `rateBonus`
- Weapon state: `ws`, `ft`, `ascensions`
- Swarm state: `_dr`, `_novaDrones`, `_splitDrones`
- Arc Blade state: `_arcDiscs`, `_sawBlade`
- Cryo state: `_cryoOverloadCounter`
- Molotov state: `_molotovTimer`, `_firePools`, `_bottles`
- Pulse state: `_pulseOverloadCounter`, `_pulseMines`
- Progression: `level`, `xp`, `xpNext`, `invT`
- HUD / feedback state: `hurtFlash`, `barrierHealFrom`, `barrierHealTo`, `barrierHealT`, `barrierHealImpactT`
- Character metadata: `char`, `col`

### Game runtime state
- Core entity arrays: `enemies`, `gems`, `healOrbs`, `bullets`, `particles`, `dmgNums`
- Run clocks / pressure: `gt`, `killCount`, `surgeCount`, `surgeActive`, `surgeTimer`, `nextSurge`
- Boss flow: `bossActive`, `boss`, `_bossShockwave`, `bossWarned`, `bossIntro`, `bossIntroT`, `nextBossTime`
- Weapon / enemy helpers: `tripleWaves`, `pendingCascades`, `slowFields`, `pendingExplosions`, `_activeShields`
- Camera / background: `camX`, `camY`, `bgNodes`, `bgConnections`, `bgPackets`
- Player-owned runtime resets on `newRun()`: `P._arcDiscs`, `P._sawBlade`, `P._pulseMines`, `P._pulseOverloadCounter`, `P._cryoOverloadCounter`, `P._novaDrones`, `P._splitDrones`, `P._dr`
- Feedback / overlays: `shake`, `runDiscoveries`, `runNewDiscoveries`, `discoveryPauseQueue`, `discoveryPauseActive`, `shatterBursts`, `overloadFlash`, `chainFlash`, `novaFlashT`, `novaImpactFlashes`, `_screenFlash`, `_cryoStormSoundPlayedThisFrame`, `_barrierRipple`

### Live behavior
- Boss is a large signal construct with aimed volleys, radial rings, contact damage, and escalating movement pressure.
- Phase 2 starts at 68% HP.
- Phase 3 starts at 33% HP.
- Phase transitions:
- clear enemy bullets
- teleport the boss opposite the player
- trigger a screen-space transition effect
- telegraph a 1.5-second avoidable shockwave from the boss position instead of applying an unavoidable HP tax
- Phase 2 adds faster movement, faster charges, denser pressure, and spiral patterns.
- Phase 3 adds denser barrages, faster and more numerous mine volleys, faster charges, and stronger bullet density.
- Boss can be slowed or status-affected, but later phases gain stronger immunity behavior.
- Boss death:
- grants large XP payout
- drops 3 heal orbs
- stops boss music
- opens a dedicated upgrade draft

## Combat readability rules
- Low health must be obvious immediately.
- Damage feedback should stack screen flash, shake, HP lag, and HUD state.
- Boss state must be legible through bar color, label, banners, and audio.
- Weapon growth should be visible in combat, not only in numbers.
- Mobile readability is more important than extra VFX density.

## Architecture priorities

### Core principles
- Prefer data-driven content over hardcoded one-offs.
- New characters, weapons, enemies, and upgrades should be addable with minimal edits.
- Keep run state centralized on `Game`.
- Avoid circular dependencies.
- Separate content definitions from runtime orchestration where practical.
- Keep overlays and HUD helpers modular.

### Desired future-proofing direction
- Characters should mostly be config plus a small passive hook surface.
- Weapons should keep moving toward declarative definitions for rates, caps, and effect helpers.
- Upgrade generation should remain inspectable and easy to reason about.
- Progression/save code should stay separate from combat resolution.
- Boss patterns should keep moving toward helper-driven attacks instead of one giant branch.

### Refactor smell list
- Character-specific logic duplicated across multiple files.
- Weapon behavior split between too many ad hoc checks in `game.js`.
- UI strings duplicated in several places.
- Progression logic leaking into combat code.
- New content requiring edits across unrelated systems.

## Current code map

```text
src/
  main.js        - app entry, loads save and starts Game
  constants.js   - world dimensions and boundary-warning constants
  progression.js - save schema, records, synergy persistence
  game.js        - core loop, world camera, menus, run flow, combat orchestration, and Molotov runtime (`updateMolotov`, `throwMolotov`, `landMolotov`, `createFirePool`, `drawMolotov`)
  player.js      - character roster, player factory, weapon-state helpers
  weapons.js     - weapon defs, bullets, ascension defs, cryo ascension hooks, pulse clusters, and shield logic hooks
  enemies.js     - enemy roster, surge-based spawn logic, targeting/status helpers, freeze-state updates, and freeze spread
  upgrades.js    - passive defs, upgrade pool generation, Ascension card injection, `applyUpgrade`, and `applyAscension`
  boss.js        - boss creation, update logic, rendering, phase behavior
  particles.js   - particles and combat feedback primitives, including run-start resets
  hud.js         - HUD DOM creation, overlay helpers, temporary warning banners, and shared overlay elements including death/low-health/transition layers plus Ascension/records/discovery markup
  input.js       - keyboard and virtual joystick
  audio.js       - procedural gameplay/UI SFX and boss music helpers
  gameUi.js      - weapon/passive card rendering, stat-preview formatting, and run-summary text helpers
  playtest.js    - playtest build sanitizing, preview player assembly, lab rendering, presets, and lab input config
  menuBackground.js - animated menu-canvas node network with lifecycle helpers
  arcBlade.js    - Arc Blade tier table plus shared orbit/curve math helpers
  renderUtils.js - shared enemy-shape tracing and hex-to-rgba helpers
  style.css      - all HUD/menu/overlay styling plus shared UI animation classes/keyframes, menu-flow styling, and damage/low-health feedback layers

scripts/
  check.mjs      - source/manifest sanity checks for local assets and wired metadata
  verify-dist.mjs - built `dist/` manifest and relative asset-path verification
```

## Technical conventions
- Vanilla JS only.
- HTML5 Canvas 2D for gameplay rendering.
- Vite for dev/build.
- Game state primarily lives on the `Game` instance.
- Arrays for active entities are acceptable; prune/filter dead entries.
- Prefer readable formulas over over-engineered abstractions.
- Weapon modules should communicate through callbacks/helpers rather than importing `game.js` directly where possible.

## UI and tone
- UI text should be terse, uppercase, monospace, cyberpunk.
- Font remains Courier New for now.
- No tutorialization or tooltip spam.
- Main menu should stay bold, clean, and mobile-readable.
- Upgrade cards should communicate exact gains clearly.
- Death and records screens should surface build identity and run outcomes quickly.

## Visual language
- Background: `#08080f`
- Core palette anchors: cyan, amber, violet, teal, lime, warning red
- Damage numbers are source-colored
- Low-health state should pulse red clearly
- Boss phases should read through strong color shifts
- The game can expand into sub-themes, but should stay inside a coherent neon-cyberpunk world

## Documentation rules

### When updating this file
- Keep `Current implementation snapshot` brutally current.
- Prefer short factual bullets over speculative prose.
- Stable design rules belong near the top.
- Volatile tuning details belong lower down.
- If a system was removed or rolled back, preserve that fact in `## Changelog`.

### What should live here
- Game vision and non-negotiables.
- Current gameplay loop.
- Current live roster and systems.
- Architecture direction and expansion guardrails.
- Known implementation mismatches worth preserving between sessions.

### What should not bloat this file
- Exhaustive daily tuning notes.
- Large speculative redesign docs.
- Temporary debugging context.
- Inactive feature trees that are no longer the live model.

## Open priorities
1. Tune live Cryo freeze thresholds, spread pacing, and boss anti-freeze behavior after playtesting.
2. Rebalance the level-1-to-5 weapon roster around clearer mid and late-run identity.
3. Tune boss fairness, duration, and phase readability after the latest escalation pass.
4. Expand records/discoveries into a fuller codex or planning surface without adding permanent stat grind.
5. Keep moving gameplay systems toward easier future content addition.

## Changelog
- 2026-04-14: Retuned Pulse Collapsed Round to the intended Ascension tier curve so it now uses a distinct brighter gravity-shell visual, fires `1/1/2/2/3` shells from `T1-T5` with one shell always aimed at the closest enemy, adds the opposite-direction shell at `T3-T4`, and raises pull radius only at `T2` and `T4` while preserving the delayed pull-then-cluster payoff.
- 2026-04-14: Retuned Pulse Chain Reaction to the intended Ascension tier curve so it now uses a distinct hotter orange-red projectile/explosion visual, fires `2/2/3/3/4` evenly split shells from `T1-T5` with one shell always aimed at the closest enemy, and raises cluster-bomb retrigger chance only at `T2` and `T4` (`35/40/40/45/45%`).
- 2026-04-13: Retuned Cryo Storm to match the intended Ascension tiers: frozen kills now emit evenly spaced shard bursts at `3/5/7/9/11` shards from `T1` to `T5`, replacing the old frozen-hit proc and denser shard-count progression.
- 2026-04-13: Added Ascension tier progression for all live Ascensions so transformed weapons now continue from T1 to T5 via normal upgrade drafts, with per-Ascension scaling hooked into combat, HUD `A1-A5` slot tags, playtest-lab tier controls, and death-summary Ascension tier readouts.
- 2026-04-13: Refined Permafrost's tier path into a heavy snowball progression: `T1-T2` fire one large projectile, `T3-T4` fire two, `T5` fires three, while keeping the darker-blue weighted projectile profile and swapping the default Cryo shot into a deeper thudding Permafrost fire sound.
- 2026-04-13: Tuned Permafrost's snowball profile further by increasing projectile size sharply, reducing its fire rate again, and changing tier pierce to `2/4/6/8/10` so each Ascension tier adds 2 more pierce.
- 2026-04-14: Retuned Shatter to the intended `T1-T5` curve so frozen enemies now start at `15/20/25/30/35%` instant-kill chance and decay to `0%` by thaw, added a brittle crystal-fracture overlay so the Ascension reads clearly apart from normal Cryo, and made Cryo projectile pierce rise by `+1` each tier (`2/3/4/5/6` total pierce).
- 2026-04-14: Reverted Permafrost projectile size and speed back to normal Cryo / T5 Cryo values while keeping the darker projectile color, higher pierce table, multi-projectile tier progression, deeper fire sound, and nearby freeze spread behavior.
- 2026-04-14: Fixed Juggernauts so they are now fully immune to freeze as intended, matching their existing immunity to slow, stun, and knockback.
- 2026-04-14: Changed Permafrost's on-hit freeze so it now scales with enemy size instead of always forcing a full freeze threshold; small enemies can still freeze quickly, while larger enemies like Brutes and Titans now require multiple hits.
- 2026-04-13: Added XP gem magnetization animation with smooth scale-down and fade-out over 0.25s for snappy visual feedback during magnet pickup, and added persistent freeze/stun visual particle trails via cyan drifting frost particles (every 3 frames from frozen enemies) and violet pulsing stun particles (every 2 frames from stunned enemies) to improve late-game readability in high-density surge scenes.
- 2026-04-13: Added visual hints (?) to empty weapon slots on HUD and death screen for discovery, and added run rating tiers (DEAD ON ARRIVAL / SURVIVOR / VETERAN / GHOST) to records screen based on survival time thresholds (< 2 min / < 4 min / < 6 min / 6+ min).
- 2026-04-13: Added three QoL improvements: extended health bar visibility to 2 seconds after last hit, added wave-based enemy color brightening to show late-game enemies are stronger, and expanded death screen with enemy kill-type breakdown showing counts for runners, shooters, brutes, titans, juggernauts, and shield leeches.
- 2026-04-13: Added three QoL UI improvements: current weapon loadout summary displayed above upgrade cards in the level-up overlay showing what weapons are equipped at each slot (or EMPTY), boss health bar now stays visible during phase transitions with a "TRANSITIONING" label and gold bar color instead of hiding, and enhanced upgrade-card stat previews to show "STARTS:" label for new weapon picks while maintaining current→new stat change display for upgrades.
- 2026-04-13: Added ESLint quality gate (`npm run lint`, now step 1 of the update checklist): flat config with browser/node globals, no-undef as errors, no-unused-vars as warnings, and catch/eqeqeq/no-console rules; cleaned up all lint findings including three dead imports in `game.js` (`getEffectiveFreezeThreshold`, `ASCENSIONS`, `playDeath`), two dead destructure variables (`W` in `update` and `_updateBoss`), the dead `newlyStunned` EMP block, a 40-line dead `cards` computation in `showMainMenu`, a dead `getPulseMaxClusterGeneration` function in `weapons.js`, and unused catch bindings in `audio.js` and `progression.js`.
- 2026-04-13: Continued the cleanup/future-proofing pass by extracting shared UI/playtest/menu-background/render/Arc Blade helpers out of `game.js`, removing the stale duplicate helper block left behind there, replacing the upgrade-pool shuffle anti-pattern with Fisher-Yates, fixing playtest Cryo ascension previews so they no longer mutate live bullets, adding source/dist verification scripts, and updating this brief plus the update checklist to match.
- 2026-04-13: Cleaned up deployment and documentation drift by switching Vite to relative asset paths, wiring the favicon plus PWA manifest to shipped webp icons, removing a stale no-op surge HUD helper and an unused public icon sprite, correcting the live Inferno/Frost Field copy, and fixing the stale "current six weapons" brief note.
- 2026-04-13: Added six QoL readability upgrades across the run HUD and overlays: an in-run pause button plus pause overlay and `Escape` toggle, weapon-slot level dots with `ASC` replacement, a more threatening surge timer strip, clearer Barrier absorb hit ripple/audio feedback, an expanded death summary with PB comparison/loadout/wave readout and direct menu return, and upgrade-card current-to-next stat previews; updated the brief to match.
- 2026-04-13: Restored the small splash-screen `// PLAYTEST LAB //` entry to the main menu and added a dedicated animated menu-background canvas with drifting cyan network nodes, live connection packets, and menu-aware start/stop lifecycle so the background runs behind menu overlays and shuts off when gameplay begins.
- 2026-04-13: Refined the new UI polish pass by converting the menu into a two-screen splash-plus-character-select flow, keeping character-card clicks DOM-only with no overlay rebuild, adding the JACK IN blackout transition layer, making normal level-up picks resume gameplay immediately while the overlay fades out, upgrading death with a freeze-frame flash/shake/vignette sequence and larger FLATLINED treatment, and strengthening damage readability with brighter player-hit screen flash, HP-bar flash, and a pulsing low-health vignette.
- 2026-04-13: Added a shared UI polish layer across the main menu, level-up draft, death screen, records/discovery overlays, and Ascension draft: dedicated UI sound exports (`playUIClick`, `playUIOpen`, `playUIClose`, `playUISelect`, `playDeathSound`, `playAscensionOpen`), reusable fade/slide/glitch/shimmer/pulse CSS animation classes, main-menu character selection transitions with staged JACK IN reveal, level-up pick exit choreography, death vignette plus staggered FLATLINED presentation, Ascension flash/shimmer/fade-to-black sequencing, and global overlay button press feedback.
- 2026-04-13: Fixed Molotov's same-frame processing bug by marking newly created main, bounce, cluster, and Inferno bottles as `justCreated` and skipping their first update pass, preventing frame-spike drops while keeping T3/T5 multi-bottle throws and follow-up bottles stable.
- 2026-04-12: Tuned Molotov follow-up spacing so Bouncing Cocktail now creates three uniform 85px pools across wider 140/120/100px hops, widened Cluster Molotov sub-bottle landing spread to 150-210px, and tightened the sector-throw fallback so multi-bottle tiers always launch their full bottle count even into empty sectors.
- 2026-04-12: Refined Molotov follow-up behavior by confirming bounce/cluster positions in world space, increasing cluster sub-bottle readability (`0.5s` flight, `60px` arc, `0.8x` radius), and retuning `INFERNO` to `tier.radius * 1.8`, 8-second duration, half-rate throws, and a more distinct render treatment.
- 2026-04-12: Reworked Molotov targeting to lead enemies with sector-based bottle selection, simplified `INFERNO` into a single oversized bottle/pool with no merge logic, and validated bounce/cluster branch execution before removing the temporary logs.
- 2026-04-12: Added `LUKE'S MOLOTOV` as a seventh weapon with arcing bottle throws, persistent fire pools, Molotov Ascensions (`INFERNO`, `BOUNCING COCKTAIL`, `CLUSTER MOLOTOV`), dedicated throw/land audio, explicit player/new-run state resets, and updated documentation for the new runtime helpers.
- 2026-04-12: Completed an audit-and-cleanup reconciliation pass with no gameplay changes: removed dead helper exports and stale debug logging, added an explicit particle reset on `newRun()`, aligned live Ascension text with implementation, cleaned unused asset/temp files, and updated this brief to match the current runtime state and file map.
- 2026-04-13: Retuned Permafrost to match the intended Ascension tiers: `T1` now slows Cryo shots, adds instant freeze-on-hit plus 1 pierce, frozen enemies stay frozen until killed, and `T2-T5` now add +1 pierce per tier while frozen enemies spread freeze to nearby enemies at increasingly faster intervals.
- 2026-04-12: Simplified Permafrost visuals down to a darker blue frozen body plus one clean ring, changed Cryo's Overload/Glacial Lance slot from a 6-second timer to an every-third-shot counter with HUD dots, raised Frost Field chip damage to `P.dmg * 5` per second while confirming dashed-line resets, and removed Shatter screen flash entirely.
- 2026-04-12: Upgraded Cryo Ascensions by brightening Cryo Storm shards plus trigger audio, making Permafrost enemies much louder visually, redesigning the Cryo Overload/Glacial Lance slot into a charged piercing payoff while preserving normal Cryo fire, fixing Frost Field to slow first and freeze after sustained exposure while adding minimal chip damage, and capping Shatter flash cadence for readability.
- 2026-04-12: Expanded the playtest lab with dev-only Time Skip and Instant Loadout panels, added late-game/boss/max-weapon presets, and documented the new lab controls here.
- 2026-04-12: Softened the latest difficulty spike by restoring player damage i-frames to 0.6s, delaying and flattening the late-game damage multiplier, slowing post-2-minute wave growth, reducing the shared enemy damage bump from 25% to 15%, and restoring the lighter surge density floor and batch ramp.
- 2026-04-12: Moved surge-count progression to the end of each surge so new enemy types first appear in the calm window after their introduction surge, upgraded Juggernaut readability with a larger frame plus permanent orange crackle aura and louder IMMUNE feedback, and simplified Shield Leech performance with nearest-enemy movement, a cap of 2 active Leeches, and a precomputed `_activeShields` cache.
- 2026-04-12: Replaced time-threshold enemy introductions with surge-count gating, removed the separate Titan spawn timer and warning flow, added Juggernaut as a control-immune pentagon elite, and added Shield Leech as a cluster-seeking support enemy with a shared shield bubble and shield-break bonus XP.
- 2026-04-12: Reworked Titan cadence into an escalating spawn interval with a 4-second warning window, pushed overall enemy threat harder after 2 minutes with faster wave growth and denser surges, removed the boss transition HP tax in favor of a telegraphed avoidable shockwave, and increased boss damage, charge pressure, mine pressure, barrage density, and time-based HP scaling.
- 2026-04-12: Reduced shared player damage i-frames to 0.4s, rebalanced Barrier around shorter uptime and heal capped at 40% of missing HP, nerfed Swarm Frenzy to 2x speed with 3s duration plus per-drone cooldown, increased late-game enemy scaling and base damage, added the Titan elite with warning/aura/control resistance, and moved Ascensions from boss-kill gating into 40%-chance level-up card injection.
- 2026-04-12: Reconciled this document against the live codebase: documented Arc Blade (`JAC'S BOOMERANG`), the current Pulse/EMP/Swarm/Cryo/Arc Blade Ascension pools, EMP's pure scaling table, the scrolling world camera, the playtest lab, and the Capacitor-plus-Android setup; removed stale "Cryo-only Ascensions live" and five-weapon wording.
- 2026-04-09: Added the Ascension system, including boss-gated level-5 weapon transformations, a dedicated Ascension draft overlay, HUD `ASC` indicators, and the first full Cryo Ascension pool with Storm, Permafrost, Nova, Overload, Frost Field, and Shatter behaviors.
- 2026-04-09: Tightened the boss again by reducing downtime, increasing bullet density, improving intercept/lane-cut pressure, adding marked charge impact bursts, and making phase escalations more demanding while keeping damage tied to visible telegraphs and avoidable positioning mistakes.
- 2026-04-09: Reactivated Cryo as a live freeze-meter system with thaw cooldowns, staged frost visuals, proportional freeze spread, and boss-specific anti-freeze handling, then removed live gameplay synergies again while keeping the progression/discovery scaffolding.
- 2026-04-09: Rewrote this file around the actual live game state, removed stale Cryo path-tree documentation from the main body, and documented that the current save/discovery layer is live while freeze-based synergies remain scaffolded rather than fully active.
- 2026-04-09: Added a screen-space Barrier transfer effect so shield refunds visibly travel from the player into the HP bar instead of only appearing as a number and bar segment.
- 2026-04-09: Added a barrier-heal segment to the HP bar so shield refunds are readable at a glance, and changed healing orb drops to a globally throttled, late-game-falling sustain source instead of scaling with enemy count.
- 2026-04-09: Lowered healing orb drop rates sharply, restored Tier 4 and Tier 5 weapon upgrades to the live pool for the full roster, and reworked Barrier into a brighter lime shield with stronger hit/break feedback plus heal-on-expiry based on absorbed damage.
- 2026-04-09: Added Barrier as a fifth weapon with a cycling absorb shield and introduced healing orb sustain drops.
- 2026-04-09: Redesigned the boss around spawn-time HP scaling, predictive intercept movement, harsher damage, violent invulnerable phase resets with a transition HP tax/teleport/shockwave, denser late-phase patterns, and escalating phase-based freeze/stun immunities.
- 2026-04-09: Removed EMP overload from the discoverable synergy list so progression only tracks cross-weapon interactions, not single-weapon upgrade payoffs.
- 2026-04-09: Changed first-time synergy discovery from a lightweight banner into a paused reveal moment so new unlocks can be examined before combat resumes.
- 2026-04-09: Changed first-time synergy discovery from a lightweight banner into a paused reveal moment so new unlocks can be examined before combat resumes.
- 2026-04-09: Added `progression.js` with persistent personal bests, synergy discovery tracking, first-discovery reveal/audio, a records screen, and death-screen run record reporting.
- 2026-04-09: Reworked the live boss into a longer three-phase encounter with higher durability, circling movement, telegraphed transitions, charge follow-ups, spiral pressure, late-fight barrages/mines, stronger boss-bar state feedback, and updated boss announcements.
- 2026-04-08: Rolled live Cryo back from the experimental path/tree direction to the simpler level-based weapon model.
