# Instructions for Claude Code

- Read this file at the start of every session and keep it in mind throughout.
- Treat this file as the single source of truth for project intent, current state, and guardrails.
- When a design decision is made, a feature ships, or something here becomes outdated, update this file in the same session if possible.
- Do not delete historical context. Move outdated guidance to `## Changelog` with a short note.
- If a requested change conflicts with this document in a meaningful way, pause and flag it before overwriting the rule.
- If you notice architectural debt, dead code, or discrepancies between this document and the live codebase, flag them explicitly in your response rather than silently working around them. Do not fix architectural issues without explicit instruction — document them and continue.

# Infinite Rogue - Project Operating Brief

## One-paragraph summary
Infinite Rogue is a mobile-first cyberpunk survivor roguelite inspired by Magic Survival. Runs are short, aggressive, and discovery-driven: the player auto-attacks, kites through dense waves, drafts upgrades during the run, assembles weapon interactions, and eventually dies. The fantasy is not random chaos; it is the feeling of becoming clever through build understanding and seeing that understanding pay off.

## Session startup checklist
- What is the game? Mobile-first endless survivor roguelite with auto-attacks, aggressive wave pressure, weapon drafting, and score-by-survival-time.
- What matters most? Discovery, fast starts, readable combat, distinct weapon identities, and future expandability.
- What is in code today? Three playable characters, five weapons, four weapon slots per run, six generic passives, surge events, a three-phase recurring boss, heal-orb sustain, records, persistent synergy discovery tracking, menu/death/records overlays, a playtest lab overlay, joystick input, and procedural audio.
- What is not settled yet? Final weapon depth direction, freeze/boss tuning after the reactivated meter system, broader progression/codex shape, unlock flow, whether the playtest lab remains dev-only, and long-term content scale.
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
- Playtest lab overlay with instant weapon/passive/ascension editing, optional in-run reopening, and lab-specific restart/refill actions.
- Canvas-based core gameplay loop with keyboard plus virtual joystick support.
- Camera-centred world-space rendering across a fixed `3000 x 3000` arena, with the player moving through the world instead of staying inside screen bounds.
- Capacitor is configured with a generated Android project, mobile viewport/safe-area handling, touch hardening, and placeholder native app assets.
- Three playable characters: Ghost, Bruiser, Hacker.
- Five total weapons in the pool, but only four weapon slots can be owned in a run.
- Weapon upgrades currently run from level 1 to level 5.
- Six run-wide passive upgrades.
- XP gems with magnet pickup behavior and merge logic.
- Heal orbs that restore 5% max HP and are globally throttled.
- Surge events every 40 seconds outside boss flow.
- Recurring three-phase boss with warning, intro, boss bar, phase announcements, and post-kill reward draft.
- Boss-gated weapon Ascension draft for level-5 weapons, with Cryo transformations currently live.
- Death screen with run stats, equipped weapons, and run synergies.
- Save-backed records screen with global and per-character bests.
- Persistent synergy discovery tracking with first-discovery pause overlay.
- Procedural audio for weapons, hits, XP, surges, boss warning/phases/death, and boss music.
- Stronger damage feedback including screen flash, low-health vignette, HP lag bar, and barrier-heal HP bar segment.
- Data-network background nodes, links, and packet motion generated once per run and culled to the current camera view.
- Red world-boundary warning overlays plus hard player clamping at the arena edge.
- Cryo freeze buildup is live with per-enemy freeze meters, thaw cooldowns, frost visuals, and thaw burst feedback.
- Bruiser low-HP damage bonus and Hacker stunned-enemy XP bonus are live, but still implemented as `game.js` checks rather than as clean character passive hooks.

### Playtest lab
- Developer-facing overlay for quickly assembling a test build, previewing resulting player stats, and starting or reopening a run in that test state.
- Accessed from the main menu through the `PLAYTEST LAB` button. During a playtest run, it can also be reopened through the on-screen `LAB` button, and `L` reopens it while a playtest run is active if no other overlay or discovery pause is up.
- Exposes direct weapon tier editing for every weapon, passive stack editing, Ascension selection for weapons that are set to Tier 5, and run actions including start test session, resume test, refill HP, reset build, restart test, and return to menu.
- Any newly added feature that materially affects gameplay should also be made available in the playtest lab so it can be exercised quickly without needing a full progression path or long run setup.
- The selected playtest build itself is only kept in runtime memory, but playtest runs are not isolated from progression: deaths still write run records through `recordRun()`, and any first-time synergy discoveries still persist through `recordDiscovery()`.
- It should be hidden or disabled before public release or store submission unless that save/progression coupling is intentionally made player-facing, because it currently exposes direct build editing from the main menu and during test runs.

### Built but still likely to change
- Weapon tuning and upgrade text.
- Character balance and differentiation depth.
- Boss numbers and some pattern density.
- Save schema growth beyond current bests plus discovery storage.
- Exact freeze thresholds, spread pacing, and boss anti-freeze tuning.
- Native packaging/store prep is in progress through Capacitor; Android scaffolding exists, while iOS project generation still requires a Mac with Xcode.

### Not built yet
- Character unlock flow.
- Additional characters beyond the current three.
- Additional weapons beyond the current five.
- A fuller codex/planning layer on top of records and discoveries.
- Analytics or crash reporting.

## Current character roster

### Ghost
- Start weapon: Cryo
- Base speed: 158
- Passive: 20% dodge chance
- Playstyle: safest mover, kiting-first, evasive baseline
- Status: stable reference character; passive is data-defined on the character config

### Bruiser
- Start weapon: Pulse
- Base speed: 130
- Passive: +35% damage while below 50% HP
- Playstyle: risky aggression, burst conversion while wounded
- Status: implemented and live; passive currently enforced in `game.js` combat hit paths

### Hacker
- Start weapon: EMP
- Base speed: 145
- Passive: stunned enemies drop 2x XP
- Playstyle: control and level snowball
- Status: implemented and live; passive currently enforced in `game.js` enemy death/XP logic

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
| EMP | `#BF77FF` | Radial control / overload payoff | Expanding stun burst with larger radius and longer stun each level; overload payoff active at level 3+ |
| Swarm | `#1DFFD0` | Persistent seek damage | Orbiting drones that seek targets; levels mainly add more drones |
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
- Level 1: 160px burst, 18 damage scaling base, 2.5s stun.
- Level 2: 220px burst, 3.0s stun.
- Level 3: 280px burst, 3.5s stun and marked-kill overload explosions become relevant in `game.js`.
- Level 4: 340px burst, 4.0s stun.
- Level 5: 400px burst, 4.5s stun, plus small shockwaves from affected targets.

#### Swarm
- Level 1: 2 drones.
- Level 2: 3 drones.
- Level 3: 4 drones.
- Level 4: 5 drones.
- Level 5: 6 drones.
- Drones orbit, acquire nearby targets, seek, hit, and return.

#### Barrier
- Level 1: absorb 40, active 5s, recharge 8s.
- Level 2: absorb 65, active 6s, recharge 7s.
- Level 3: absorb 95, active 7s, recharge 6s.
- Level 4: absorb 130, active 8s, recharge 5s.
- Level 5: absorb 175, active 10s, recharge 4s.
- When the shield cycle ends or breaks, the player heals for absorbed damage up to missing HP.

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
- Boss kills currently reuse the same pool structure in a dedicated reward draft.
- Upgrade text should stay explicit and numeric wherever practical.

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

### Pressure rules
- Runners start immediately.
- Shooters begin after 40 seconds.
- Brutes begin after 80 seconds.
- Enemy stats scale by wave, where wave is roughly `floor(gt / 45)`.
- Surges increase spawn density by batching multiple spawns.
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

### Live behavior
- Boss is a large signal construct with aimed volleys, radial rings, contact damage, and escalating movement pressure.
- Phase 2 starts at 68% HP.
- Phase 3 starts at 33% HP.
- Phase transitions:
- clear enemy bullets
- teleport the boss opposite the player
- trigger a screen-space transition effect
- apply a 25% current-HP tax to the player, leaving at least 1 HP
- Phase 2 adds faster movement, charge attacks, denser pressure, and spiral patterns.
- Phase 3 adds mines, barrages, faster charges, and stronger bullet density.
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
- Character passives still partly live as ad hoc `game.js` conditionals instead of a shared hook surface.
- Bruiser and Hacker passives are hardcoded checks in `game.js` rather than data-driven hooks on the character definition. Before adding a fourth character, refactor to a passive hook surface so new characters can define their passive behaviour without editing `game.js`.
- Weapon behavior split between too many ad hoc checks in `game.js`.
- UI strings duplicated in several places.
- Progression logic leaking into combat code.
- New content requiring edits across unrelated systems.

## Current code map

```text
android/       - generated Capacitor Android project
ios/           - generated Capacitor iOS project when created on a Mac; absent on this Windows machine

src/
  main.js        - app entry, loads save and starts Game
  progression.js - save schema, records, synergy persistence
  game.js        - core loop, menus, overlays, run flow, combat orchestration, world camera state, and background/boundary rendering via `initBackground`, `updateBackground`, `drawBackground`, and `drawBoundaryWarning`
  player.js      - character roster, player factory, weapon-state helpers
  weapons.js     - weapon defs, bullets, ascension defs, cryo ascension hooks, pulse clusters, shield logic hooks
  enemies.js     - enemy roster, spawn logic, targeting and status helpers, freeze-state updates, and freeze spread
  upgrades.js    - passive defs, upgrade pool generation, `buildAscensionPool`, `applyUpgrade`, and `applyAscension`
  boss.js        - boss creation, update logic, rendering, phase behavior
  particles.js   - particles and combat feedback primitives
  hud.js         - HUD DOM creation and overlay helpers
  input.js       - keyboard and virtual joystick
  audio.js       - procedural SFX and boss music helpers
  style.css      - all HUD/menu/overlay styling
```

### Important implementation mismatches to remember
- Ghost's passive is currently represented directly on character data, while Bruiser and Hacker passives are still hardcoded in `game.js`.
- The playtest lab is fully implemented in the menu/runtime flow, but it is still a developer-facing tool rather than a settled player-facing feature.

## Technical conventions
- Vanilla JS only.
- HTML5 Canvas 2D for gameplay rendering.
- Vite for dev/build.
- Mobile update workflow is `npm run build` -> `npx cap sync` -> open the Android project in Android Studio.
- Game state primarily lives on the `Game` instance.
- `WORLD_W` and `WORLD_H` currently define a shared fixed arena size of `3000`.
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
6. Refactor character passives from hardcoded `game.js` checks into a hook surface on the character definition object in `player.js`. This is required before the roster expands beyond three characters.

## Changelog
- 2026-04-10: Fixed the first world-space regression by changing bullet pruning to use arena coordinates instead of screen bounds, clamped the camera to the arena edges, strengthened the world-boundary warning with deeper reach plus pulse/edge-line cues, and exposed world/camera debug values in the playtest lab.
- 2026-04-10: Added a camera-centred world-space arena (`WORLD_W`/`WORLD_H` = `3000`), moved enemies and boss spawning into world coordinates, added the data-network background pass with packet animation and culling, and added boundary warning overlays.
- 2026-04-10: Clarified in this brief that new gameplay-affecting features should be surfaced through the playtest lab, and updated the playtest lab overlay styling so it supports visible touch scrolling on mobile devices.
- 2026-04-10: Reworked the main menu for small mobile screens by collapsing the separate loadout panel into the selected character card, tightening card spacing, shrinking the records control into a compact text button, and reserving a persistent bottom action area so `JACK IN` stays visible on short Android displays without scrolling.
- 2026-04-09: Documented the live playtest lab and passive-hook debt, removed legacy weapon `stats`/`paths` state from `player.js`, added the Claude Code architecture-flagging instruction, set up Capacitor with Android scaffolding plus mobile viewport/audio/touch hardening, generated placeholder native assets, and updated `.gitignore` plus this brief to match the current repo state.
- 2026-04-09: Updated this brief to match the live code more closely by documenting the playtest lab, recording that Bruiser/Hacker passive hooks still live in `game.js`, and preserving the remaining legacy weapon-state fields from the older path-tree experiment as an active architecture concern.
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
- 2026-04-09: Added `progression.js` with persistent personal bests, synergy discovery tracking, first-discovery reveal/audio, a records screen, and death-screen run record reporting.
- 2026-04-09: Reworked the live boss into a longer three-phase encounter with higher durability, circling movement, telegraphed transitions, charge follow-ups, spiral pressure, late-fight barrages/mines, stronger boss-bar state feedback, and updated boss announcements.
- 2026-04-08: Rolled live Cryo back from the experimental path/tree direction to the simpler level-based weapon model.
