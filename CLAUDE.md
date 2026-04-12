# Instructions for Claude Code

- Read this file at the start of every session and keep it in mind throughout.
- Treat this file as the single source of truth for project intent, current state, and guardrails.
- When a design decision is made, a feature ships, or something here becomes outdated, update this file in the same session if possible.
- Do not delete historical context. Move outdated guidance to `## Changelog` with a short note.
- If a requested change conflicts with this document in a meaningful way, pause and flag it before overwriting the rule.
- If at any point the user is required to do any of the following please inform them at the end of your message.
EVERY UPDATE:
1. npm run build
2. Drag dist/ → Netlify
3. npx cap sync
4. Play in Android Studio
5. commit git

# Infinite Rogue - Project Operating Brief

## One-paragraph summary
Infinite Rogue is a mobile-first cyberpunk survivor roguelite inspired by Magic Survival. Runs are short, aggressive, and discovery-driven: the player auto-attacks, kites through dense waves, drafts upgrades during the run, assembles weapon interactions, and eventually dies. The fantasy is not random chaos; it is the feeling of becoming clever through build understanding and seeing that understanding pay off.

## Session startup checklist
- What is the game? Mobile-first endless survivor roguelite with auto-attacks, aggressive wave pressure, weapon drafting, and score-by-survival-time.
- What matters most? Discovery, fast starts, readable combat, distinct weapon identities, and future expandability.
- What is in code today? Three playable characters, six weapons, four weapon slots per run, six generic passives, a scrolling world camera, surge events, a three-phase recurring boss, heal-orb sustain, records, persistent synergy discovery tracking, menu/death/records overlays, a playtest lab, joystick input, procedural audio, and Capacitor Android packaging.
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
- Main menu overlay with character selection, records access, and active-loadout presentation.
- Canvas-based core gameplay loop with keyboard plus virtual joystick support.
- Scrolling `3000 x 3000` world with player-follow camera, world-edge clamping, and boundary-pressure feedback.
- Three playable characters: Ghost, Bruiser, Hacker.
- Six total weapons in the pool, but only four weapon slots can be owned in a run.
- Weapon upgrades currently run from level 1 to level 5.
- Six run-wide passive upgrades.
- XP gems with magnet pickup behavior and merge logic.
- Heal orbs that restore 5% max HP and are globally throttled.
- Surge events every 40 seconds outside boss flow, with `Game.surgeCount` expanding the enemy roster after each surge completes.
- Six live enemy types in the normal pool: Runner, Shooter, Brute, Titan, Juggernaut, and Shield Leech.
- Recurring three-phase boss with warning, intro, boss bar, phase announcements, and post-kill reward draft.
- Level-up-pool weapon Ascension draft injection for eligible level-5 weapons, with live pools for Cryo, Pulse, EMP, Swarm, and Arc Blade.
- Death screen with run stats, equipped weapons, and run synergies.
- Save-backed records screen with global and per-character bests.
- Persistent synergy discovery tracking with first-discovery pause overlay.
- Procedural audio for weapons, hits, XP, surges, boss warning/phases/death, and boss music.
- Stronger damage feedback including screen flash, low-health vignette, HP lag bar, and barrier-heal HP bar segment.
- Cryo freeze buildup is live with per-enemy freeze meters, thaw cooldowns, frost visuals, and thaw burst feedback.
- Playtest lab overlay with instant weapon/passive tier editing, ascension selection, world/camera debug readouts, time skip controls, instant loadout injection, and one-click late-game/boss/max-weapon presets.
- Capacitor configuration plus committed Android project are live in-repo.

### Built but still likely to change
- Weapon tuning and upgrade text.
- Character balance and differentiation depth.
- Boss numbers and some pattern density.
- Save schema growth beyond current bests plus discovery storage.
- Exact freeze thresholds, spread pacing, and boss anti-freeze tuning.

### Not built yet
- Character unlock flow.
- Additional characters beyond the current three.
- Additional weapons beyond the current six.
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
| Barrier | `#C6FF00` | Defensive sustain | Cycling absorb shield with recharge and heal refund based on absorbed damage |

### Live per-weapon detail

#### Cryo
- Level 1: one projectile, pierce 1, fast fire rate.
- Level 2: two-projectile spread.
- Level 3: three-projectile spread.
- Level 4: four-projectile spread.
- Level 5: five-projectile widest spread.
- Current implementation note: Cryo slows on hit, builds a freeze meter by weapon level, freezes targets for 1.5s at threshold, and can spread partial freeze buildup from newly frozen targets.
- `ASCENSIONS.cryo` currently defines `cryo_storm`, `permafrost`, `cryo_nova`, `glacial_lance`, `frost_field`, and `shatter`.

#### Pulse
- Level 1: heavy shell with impact explosion.
- Level 2: impact explosion also spawns first-generation cluster bombs.
- Level 3: cluster bombs can split one generation deeper.
- Level 4: cluster chain extends another generation.
- Level 5: cluster chain extends to four total generations.
- Frozen-target bonus damage logic is wired, but depends on freeze being active.

#### EMP
- EMP is now a clean scaling weapon with no baked-in per-level special rules.
- Level 1: 160px burst, 1.2s stun, x1.0 damage multiplier.
- Level 2: 200px burst, 1.4s stun, x1.3 damage multiplier.
- Level 3: 245px burst, 1.6s stun, x1.7 damage multiplier.
- Level 4: 295px burst, 1.8s stun, x2.2 damage multiplier.
- Level 5: 350px burst, 2.0s stun, x2.8 damage multiplier.
- `ASCENSIONS.emp` currently defines `cascade_pulse`, `triple_pulse`, and `arc_discharge`.

#### Swarm
- Level 1: 2 drones.
- Level 2: 3 drones.
- Level 3: 4 drones.
- Level 4: 5 drones.
- Level 5: 6 drones.
- Drones orbit, acquire nearby targets, seek, hit, and return.
- `FRENZY` now grants 3s of 2x speed and 2x damage, then applies a 3s per-drone cooldown before that drone can frenzy again.
- `ASCENSIONS.swarm` currently defines `nova_swarm`, `frenzy`, and `split_swarm`.

#### Arc Blade
- Display name: `JAC'S BOOMERANG`.
- Live behavior: curved boomerang discs orbit out and back around the player; runtime logic lives in `game.js`.
- Current implementation note: Arc Blade has a live Ascension pool entry but only one option right now.
- `ASCENSIONS.arcblade` currently defines `saw_blade`.

#### Barrier
- Level 1: absorb 40, active 4.2s, recharge 8s.
- Level 2: absorb 65, active 5.1s, recharge 7s.
- Level 3: absorb 95, active 5.9s, recharge 6s.
- Level 4: absorb 130, active 6.8s, recharge 5s.
- Level 5: absorb 175, active 8.5s, recharge 4s.
- When the shield cycle ends or breaks, the player heals for absorbed damage, capped at 40% of missing HP for that cycle.

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
- Boss kills currently reuse the same pool structure in a dedicated reward draft.
- Upgrade text should stay explicit and numeric wherever practical.

## Current Ascension pools
- Cryo: `cryo_storm`, `permafrost`, `cryo_nova`, `glacial_lance`, `frost_field`, `shatter`
- Pulse: `chain_reaction`, `collapsed_round`, `overload_round`, `proximity_mine`, `fragmentation`
- EMP: `cascade_pulse`, `triple_pulse`, `arc_discharge`
- Swarm: `nova_swarm`, `frenzy`, `split_swarm`
- Arc Blade: `saw_blade`

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
| Juggernaut | Pentagon | `#FF6600` | Large control-breaker with high contact damage, full stun/slow/knock immunity, a permanent orange crackle aura, and a doubled freeze threshold |
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
  game.js        - core loop, world camera, menus, overlays, playtest lab, run flow, combat orchestration
  player.js      - character roster, player factory, weapon-state helpers
  weapons.js     - weapon defs, bullets, ascension defs, cryo ascension hooks, pulse clusters, and shield logic hooks
  enemies.js     - enemy roster, surge-based spawn logic, targeting/status helpers, freeze-state updates, and freeze spread
  upgrades.js    - passive defs, upgrade pool generation, Ascension card injection, `applyUpgrade`, and `applyAscension`
  boss.js        - boss creation, update logic, rendering, phase behavior
  particles.js   - particles and combat feedback primitives
  hud.js         - HUD DOM creation, overlay helpers, and temporary warning banners
  input.js       - keyboard and virtual joystick
  audio.js       - procedural SFX and boss music helpers
  style.css      - all HUD/menu/overlay styling
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
- 2026-04-12: Expanded the playtest lab with dev-only Time Skip and Instant Loadout panels, added late-game/boss/max-weapon presets, and documented the new lab controls here.
- 2026-04-12: Softened the latest difficulty spike by restoring player damage i-frames to 0.6s, delaying and flattening the late-game damage multiplier, slowing post-2-minute wave growth, reducing the shared enemy damage bump from 25% to 15%, and restoring the lighter surge density floor and batch ramp.
- 2026-04-12: Moved surge-count progression to the end of each surge so new enemy types first appear in the calm window after their introduction surge, upgraded Juggernaut readability with a larger frame plus permanent orange crackle aura and louder IMMUNE feedback, and simplified Shield Leech performance with nearest-enemy movement, a cap of 2 active Leeches, and a precomputed `_activeShields` cache.
- 2026-04-12: Replaced time-threshold enemy introductions with surge-count gating, removed the separate Titan spawn timer and warning flow, added Juggernaut as a control-immune pentagon elite, and added Shield Leech as a cluster-seeking support enemy with a shared shield bubble and shield-break bonus XP.
- 2026-04-12: Reworked Titan cadence into an escalating spawn interval with a 4-second warning window, pushed overall enemy threat harder after 2 minutes with faster wave growth and denser surges, removed the boss transition HP tax in favor of a telegraphed avoidable shockwave, and increased boss damage, charge pressure, mine pressure, barrage density, and time-based HP scaling.
- 2026-04-12: Reduced shared player damage i-frames to 0.4s, rebalanced Barrier around shorter uptime and heal capped at 40% of missing HP, nerfed Swarm Frenzy to 2x speed with 3s duration plus per-drone cooldown, increased late-game enemy scaling and base damage, added the Titan elite with warning/aura/control resistance, and moved Ascensions from boss-kill gating into 40%-chance level-up card injection.
- 2026-04-12: Reconciled this document against the live codebase: documented Arc Blade (`JAC'S BOOMERANG`), the current Pulse/EMP/Swarm/Cryo/Arc Blade Ascension pools, EMP's pure scaling table, the scrolling world camera, the playtest lab, and the Capacitor-plus-Android setup; removed stale "Cryo-only Ascensions live" and five-weapon wording.
- 2026-04-09: Added the Ascension system, including boss-gated level-5 weapon transformations, a dedicated Ascension draft overlay, HUD `ASC` indicators, and the first full Cryo Ascension pool with Storm, Permafrost, Nova, Glacial Lance, Frost Field, and Shatter behaviors.
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
