# Instructions for Claude Code

- Read this file at the start of every session and keep it in mind throughout.
- Treat this file as the single source of truth for project intent, current state, and guardrails.
- When a design decision is made, a feature ships, or something here becomes outdated, update this file in the same session if possible.
- Do not delete historical context. Move outdated guidance to `## Changelog` with a short note.
- If a requested change conflicts with this document in a meaningful way, pause and flag it before overwriting the rule.

# Infinite Rogue - Project Operating Brief

## One-paragraph summary
Infinite Rogue is a mobile-first cyberpunk survivor roguelite inspired by Magic Survival. Runs are short, aggressive, and discovery-driven: the player auto-attacks, kites through dense waves, drafts upgrades during the run, assembles weapon interactions, and eventually dies. The fantasy is not random chaos; it is the feeling of becoming clever through build understanding and seeing that understanding pay off.

## Session startup checklist
Any new session should be able to answer these quickly:
- What is the game? Mobile-first endless survivor roguelite with emergent weapon synergies.
- What matters most? Discovery, fast runs, aggressive pressure, readable build decisions, future expandability.
- What is in code today? Ghost, core combat loop, enemy waves, upgrades, boss fight, HUD, main menu, audio.
- What is not settled yet? Final gameplay loop details, long-term progression shape, additional characters, save/meta systems.
- What must not happen? No hand-holding, no grind-based permanent stat power, no architecture that makes future content painful to add.

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

## Finalising the gameplay loop
This is the target loop we should now treat as the default design direction unless explicitly changed.

### Macro loop
1. Enter main menu.
2. Pick a character.
3. Start a run.
4. Survive escalating waves while auto-attacking and repositioning.
5. Level up through XP pickups and choose one of three upgrades.
6. Discover stronger weapon combinations and build-defining synergies.
7. Survive periodic surges and boss encounters.
8. Die.
9. Review run summary.
10. Return to menu and try again, now with more player knowledge.

### Minute-to-minute loop
- Move constantly to control spacing, avoid chip damage, and herd enemies.
- Auto-fire weapons create pressure without requiring aim input.
- XP drops reward risk and routing.
- Level-up choices define the build.
- Synergies emerge from weapon interactions rather than explicit combo labels.
- Difficulty spikes create tempo changes: normal flow, surge, boss, recovery, repeat.

### What makes a good run
- The player understands why a build is working.
- Weapon identities stay distinct.
- Synergy payoffs are noticeable and satisfying.
- The board state becomes overwhelming because the run lost control, not because the game became unreadable.

### What makes a bad run
- Early game feels empty or slow.
- Upgrade choices feel fake or interchangeable.
- Damage sources blur together and lose identity.
- Systems explain too much and kill discovery.
- New content requires touching too many unrelated files or special cases.

## Gameplay tuning spec
This is the practical balancing target for current development. Weapons, enemies, upgrades, bosses, and character tuning should be judged against this section first.

### Target run shape
- A weak or sloppy run should usually die between 2 and 4 minutes.
- A decent run should usually reach 4 to 6 minutes.
- A strong run should feel under real pressure by 6+ minutes, not comfortably stable forever.
- The player should feel threatened within the first 5 to 10 seconds.
- The first minute should already require movement discipline and route decisions.

### Run pacing beats

#### 0 to 30 seconds
- Immediate pressure.
- Player learns the spawn texture and their starting weapon rhythm.
- Enough kills and XP should drop to create early movement routing decisions.
- The player should not be allowed to stand still or coast.

#### 30 to 90 seconds
- Build identity starts to form.
- First meaningful weapon or passive choices should appear.
- Shooters entering the mix should change movement patterns.
- The player should begin seeing whether their current build is solving crowd control, burst, or survival.

#### 90 to 180 seconds
- Build commitment becomes obvious.
- Synergies should begin becoming visible through play, even if unnamed.
- Surges should feel like stress tests, not just denser versions of normal play.
- Brutes and mixed waves should punish overly narrow builds.

#### 180 seconds onward
- The game should be asking "how long can you hold this together?"
- Bosses, surges, and dense mixed waves should expose weaknesses in sustain, control, or mobility.
- Strong builds may still look impressive, but they should feel near failure rather than solved.

### Upgrade cadence targets
- First level-up should happen quickly enough to reward the opening scramble and signal that build decisions start early.
- Early levels should come fast enough to hook the player into shaping a build.
- Mid-run levels should slow enough that choices feel valuable, not constant noise.
- Upgrade density should support discovery without making every run fully assembled too early.
- A typical decent run should offer enough upgrade events for a recognizable build to emerge, but not enough to max everything important.

### Boss timing targets
- First boss should arrive late enough that the player has started building, but early enough to break autopilot.
- Bosses should act as build checks, not purely attrition walls.
- Boss encounters should interrupt the normal wave rhythm and create a memorable tempo shift.
- A player who has ignored survivability, control, or single-target pressure should feel that weakness clearly during boss fights.

### Surge tuning targets
- Surges should be feared events, not cosmetic intensity spikes.
- The player should feel the approach of each surge as a pacing landmark in the run.
- Surges should test space management, not just raw DPS.
- A build that is amazing at single-target but weak at crowd control should noticeably struggle during surges.

### Build clarity rules
- Every run should answer "what kind of build did I become?" in one sentence.
- Each chosen weapon should earn its slot through a distinct tactical role.
- Passive upgrades should support a build direction, not blur all builds toward the same outcome.
- The best runs should feel authored by player decisions, not granted by lucky stat inflation.

### Character tuning targets

#### Ghost
- Should feel safest at the edge of danger rather than in the center of chaos.
- Should reward positioning, kiting, and setting enemies up for payoff.
- Should feel strongest when a player understands control and timing.

#### Bruiser
- Should feel dangerous when wounded, not simply tankier.
- Should tempt the player into risky play without making low-HP play mandatory every run.
- Should perform best when the player can hold pressure and convert short openings into heavy damage.

#### Hacker
- Should feel smartest when manipulating wave state rather than brute-forcing damage.
- Should level a little faster when played well, but not to the point of invalidating other characters.
- Should reward control, tempo, and chaining value out of stunned groups.

### Weapon upgrade targets
- Tier 1 should establish the weapon's base purpose immediately.
- Tier 2 should deepen the same purpose, not change the weapon into something unrelated.
- Tier 3 should create a satisfying power expression or synergy breakpoint.
- No weapon should feel mandatory in all builds.
- No weapon should be so niche that it only works in one exact combo.

### Failure-state rules
- Death should usually feel traceable to a build weakness, movement mistake, greed for XP, or loss of board control.
- Death should not usually feel random, unreadable, or caused by hidden information.
- When a run collapses, the player should usually understand what they might try differently next time.

## Non-negotiable design pillars
- Discovery over instruction.
- Short punchy runs, usually 3 to 5 minutes before collapse.
- Aggressive from second one.
- Emergent strategy through weapon interaction.
- Endless structure: no run "win", only survival time.
- Mobile-first readability and controls.

## Current implementation snapshot
This section should stay brutally current and concise.

### Built now
- Main menu overlay with character selection and run-intel presentation.
- Core real-time gameplay loop in canvas.
- Ghost, Bruiser, and Hacker are selectable in menu and playable in code.
- Auto-firing weapons, XP, level-ups, upgrade cards, surges, boss encounter, death screen.
- HUD, joystick input, particles, audio hooks and boss music flow.
- Phase 1 weapon-state refactor is in place: player weapons now have per-weapon state containers instead of relying only on raw level values.
- Live Cryo has been rolled back to the simpler original model: Tier 1 slow, Tier 2 freeze, Tier 3 3-shot spread.
- Level-up cadence has been accelerated and normal level-ups still try to provide both weapon-side and passive-side scaling.
- Player damage feedback has been strengthened with low-health danger pulses, screen flash, stronger shake, and a trailing damage segment on the HP bar.

### Built but still likely to change
- Character roster structure.
- Weapon tuning and upgrade pacing.
- Boss cadence and exact timings.
- Upgrade pool shape and stat numbers.
- Long-term weapon progression structure is undecided again after rolling back the Cryo path experiment.

### Not built yet
- Discovery codex / meta-progression.
- Save data and persistence.
- Character unlock flow.
- Additional characters beyond current three.
- Additional weapons beyond current four.
- Capacitor wrapper and mobile store prep.
- Analytics / crash reporting.

## Current character roster
Characters must feel mechanically and visually distinct. Shared weapon pool is fine; starting weapon and passive should meaningfully change run texture.

### Ghost
- Start weapon: Cryo Lance
- Passive: 20% dodge chance, upgradeable, cap 65%
- Playstyle: kiting, freeze setup, synergy play
- Visual identity: cyan / evasive / sleek
- Status: primary reference character

### Bruiser
- Start weapon: Pulse Cannon
- Passive: +35% damage when HP below 50%
- Playstyle: risk-reward aggression
- Visual identity: amber / heavy / brutal
- Status: implemented in code, design still subject to tuning

### Hacker
- Start weapon: EMP Burst
- Passive: stunned enemies drop 2x XP
- Playstyle: crowd control and level snowball
- Visual identity: purple / technical / cerebral
- Status: implemented in code, design still subject to tuning

## Weapon progression model
Current live model is the simple one:
- Weapons upgrade through Tier 1, Tier 2, and Tier 3.
- The more complex stat-plus-path system was prototyped and rolled back.
- If revisited later, it should be treated as a fresh design pass rather than assumed current direction.

### Current implementation note
- Code currently uses the simpler tier model.
- Any future deeper weapon system is exploratory, not active.

## Current weapon roster
Current in-code roster:

| Weapon | Colour | Role | Current tier identity |
|---|---|---|---|
| Cryo Lance | `#00CFFF` | Setup / control | Slow pierce -> freeze spread -> cryo field |
| Pulse Cannon | `#FFB627` | Burst / line clear | Heavy shot -> overpenetration -> kill shockwave |
| EMP Burst | `#BF77FF` | Crowd control | Stun burst -> faster cooldown -> overload |
| Nano Swarm | `#1DFFD0` | Sustained seek damage | 2 drones -> drone kill burst -> mini-drone split |

## Finalized live weapon trees

### Cryo Lance
- Tier 1: single projectile, slows 50% for 2 seconds, pierces 1 enemy.
- Tier 2: when a Cryo shot freezes an enemy, that freeze spreads to the nearest unfrozen enemy within 120px.
- Tier 3: Cryo hits still freeze directly, still spread freeze, and also create an 80px Cryo field for 2.5 seconds.
- Cryo field rule: enemies inside are slowed to 45% speed immediately and freeze after 1 second of continuous exposure.

### Pulse Cannon
- Tier 1: single heavy projectile with no pierce.
- Tier 2: overpenetrates through the full line with 30% damage falloff per enemy hit.
- Tier 3: Pulse kills trigger a 90px shockwave worth 50% of the killing blow.
- Shockwave rule: Pulse shockwaves do not chain into more Pulse shockwaves.

### EMP Burst
- Tier 1: 160px radial stun burst, 2.0 second stun, 0.4 base fire rate.
- Tier 2: base fire rate increases to 0.75 and the burst expands to a larger 220px control pulse.
- Tier 3: stunned enemies overload into the existing white/purple double-ring explosion, and affected enemies should be visually marked clearly.

### Nano Swarm
- Tier 1: 2 drones orbit and seek targets.
- Tier 2: 3 drones, and drone kills trigger a 70px amber explosion worth 30% of the dead enemy's max HP.
- Tier 3: 4 drones, and each full drone hit has a 25% chance to spawn 2 temporary mini-drones.
- Mini-drone rule: mini-drones last 3 seconds, orbit at half radius, deal 60% damage, cannot split or trigger explosions, and should be visually distinct from the main drones.

## Current emergent synergies
These should remain hidden from the player as authored systems. They are for design reference, not UI.

- Cryo + Pulse: frozen enemies take 3.5x Pulse damage.
- EMP T3: stunned enemies trigger overload explosion.
- Cryo + EMP: freeze or lock groups, then overload them.
- Swarm + freeze: drones gain value against immobile targets.

Rule: do not add combo tooltips, combo names, or discovery popups during runs unless the broader product direction changes.

## Cryo weapon design notes (inactive exploration)
This section is no longer the live target. Cryo was rolled back to the simpler tier-based version. Keep these notes only as archived exploration if the weapon is redesigned again later.

### Weapon identity
- Role: control, setup, freezing, chain interactions
- Fantasy: methodical battlefield lockdown that escalates into cascading control and shatter payoffs
- Best owner: Ghost, but should remain valuable on all characters

### Core mechanic
- Cryo applies Freeze Meter buildup on hit.
- When the Freeze Meter is filled, the enemy becomes Frozen.
- Frozen means full movement and attack lockout.
- Freeze duration scales from the weapon's duration-oriented stat.
- Cryo should feel like "I am preparing enemies to lock, then exploiting that lock."

### Cryo stat upgrades
These are stackable and can continue scaling after Tier 3.
- Attack Speed: reduces time between shots.
- Projectile Count: +1 projectile per level, spread evenly.
- Damage: flat percentage increase.
- Slow Duration: increases slow timer and contributes to freeze duration feel.
- Freeze Buildup: increases buildup applied per hit.
- Status Radius: increases spread, pulse, contagion, shatter, and network-style effect radius.

### Cryo progression loop
1. 3 stat upgrades.
2. 1 Tier 1 path upgrade.
3. 3 stat upgrades.
4. 1 Tier 2 path upgrade.
5. 3 stat upgrades.
6. 1 Tier 3 path upgrade.
7. Infinite stat scaling afterward.

### Tier 1 paths

#### Absolute Zero I - Cryo Lock
- Each hit applies Freeze Buildup.
- When the meter fills, the target is fully frozen and cannot move or attack.
- This is the most direct control-first route.

#### Cryo Spread I - Frost Contagion
- When an enemy is slowed, that same slow is applied to all enemies within radius.
- Radius scales with Status Radius.
- No cooldown by default; the limiting factor should be enemy positioning and spread coverage.
- This is the first large-scale propagation route.

#### Piercing Frost I - Glacial Pierce
- Projectiles pierce 1 additional enemy.
- Each hit still applies slow and freeze buildup.
- Projectile continues on the same line.
- This is the line-control and scaling-hit route.

### Tier 2 paths

#### Absolute Zero II - Shatter Core
- When a frozen enemy dies, it explodes in an AoE.
- Explosion deals a percentage of base Cryo damage.
- Explosion also applies slow and freeze buildup to enemies hit.
- This is the freeze-control route's first conversion of lockdown into area payoff.

#### Cryo Spread II - Chain Freeze
- If 3 or more slowed enemies exist within a radius, they trigger a Freeze Pulse.
- Freeze Pulse applies a large instant chunk of freeze buildup.
- Freeze Pulse deals a small AoE damage hit.
- Freeze Pulse reapplies slow.
- Each cluster should have its own cooldown, roughly 2 seconds.
- Radius scales with Status Radius.
- This route should reward clustering and wave shaping.

#### Piercing Frost II - Cold Momentum
- Each time a projectile pierces an enemy, it gains:
- +15% damage
- A small freeze buildup bonus
- These buffs stack per hit.
- Buffs reset when the projectile expires.
- This route should create satisfying projectile ramp moments and reward firing through aligned enemies.

### Tier 3 paths

#### Absolute Zero III - Fracture Storm
- Frozen enemies periodically emit ice shards at nearby enemies.
- Shards deal damage and apply slow plus freeze buildup.
- If combined with Spread effects, shard-applied slows should help trigger wider propagation.
- If combined with Pierce effects, shards may also pierce and produce multi-hit shard waves.
- Build outcome: control engine that grows into repeated shatter and shard chains.

#### Cryo Spread III - Frozen Network
- Slowed enemies become dynamically linked.
- A percentage of damage dealt to one linked enemy is shared to all linked enemies.
- Link range scales with Status Radius.
- Links update dynamically as enemies move.
- If paired with Freeze-heavy effects, one freeze should spike buildup on linked enemies and enable chain freezing.
- If paired with Pierce-heavy effects, piercing projectiles should rapidly seed links through whole waves.
- Build outcome: large-scale wave sharing and chain freeze propagation.

#### Piercing Frost III - Permafrost Barrage
- After piercing, projectiles split into 2.
- Split projectiles travel at slight angles.
- Split projectiles retain slow and freeze buildup effects.
- If paired with Freeze-heavy effects, split shots should prioritize frozen enemies for focused payoff loops.
- If paired with Spread-heavy effects, split shots should trigger more slow propagation and larger area scaling.
- Build outcome: projectile-scaling Cryo build with strong wave coverage and repeated hit conversion.

### Cryo build outcomes
- Freeze build: control plus shatter explosions.
- Spread build: screen-wide slow and freeze chain reactions.
- Pierce build: scaling projectile damage and repeated buildup application.
- Hybrid builds: best-case emergent interactions and the intended high-skill payoff space.

### Cryo implementation principles
- Cryo should not be only "apply slow." The Freeze Meter system is the core.
- Freeze payoff should come from setup, not random instant proc feeling.
- Spread should reward enemy positioning and clumping.
- Pierce should reward lineups and projectile routing.
- Tier 3 outcomes should feel qualitatively different, not just numerically larger.
- Cryo should remain readable even when many interactions are chaining.

### Cryo implementation plan
This is the intended build order for code work. It is designed to get Cryo in cleanly without forcing every other weapon to be rewritten at the same time.

#### Phase 1 - Data model refactor
- Replace Cryo's current simple weapon-level assumption with per-weapon state on the player.
- Add a weapon-state structure for Cryo that can hold:
- owned
- stat levels
- chosen Tier 1 path
- chosen Tier 2 path
- chosen Tier 3 path
- any runtime-only counters or cooldowns
- Keep legacy support for other weapons during the transition so Pulse, EMP, and Swarm can continue using the older model until rewritten.

#### Phase 2 - Enemy status refactor
- Add Freeze Meter fields to enemies.
- Add helper logic for:
- current freeze meter
- max freeze meter
- freeze meter decay rules, if any
- applying freeze buildup
- entering frozen state
- clearing or reducing buildup after freeze
- Slow, frozen, and stun state handling should move toward helpers rather than scattered inline mutation.

#### Phase 3 - Upgrade schema refactor
- Split weapon upgrades into two categories:
- stat upgrades
- path upgrades
- `buildPool()` should become aware of weapon-specific upgrade generation instead of only:
- new weapon
- generic weapon tier increase
- global passive
- Cryo should generate upgrades in the sequence:
- 3 stat picks
- Tier 1 path pick
- 3 stat picks
- Tier 2 path pick
- 3 stat picks
- Tier 3 path pick
- infinite stat picks
- UI cards should show whether the choice is:
- stat
- path
- passive

#### Phase 4 - Cryo fire logic refactor
- Move Cryo from a simple tier-based projectile definition to a state-based definition driven by:
- Attack Speed
- Projectile Count
- Damage
- Slow Duration
- Freeze Buildup
- Status Radius
- Projectile metadata should carry enough context for on-hit behavior without hardcoding every case in `game.js`.
- Prefer Cryo-specific on-hit helpers over growing generic bullet collision branches indefinitely.

#### Phase 5 - Path implementation order
- Implement in this order:
1. Core Freeze Meter
2. Absolute Zero I
3. Piercing Frost I
4. Cryo Spread I
5. Shatter Core
6. Cold Momentum
7. Chain Freeze
8. Tier 3 path layer
- This order gives useful playable checkpoints and keeps debugging manageable.

#### Phase 6 - Readability and feedback pass
- Add clear visual feedback for:
- freeze buildup progress, if needed
- frozen state
- shatter explosions
- spread pulses / network links
- piercing split behavior
- Feedback should stay readable on mobile and must not overwhelm normal hit feedback.

### Cryo code impact map
These are the files expected to change when Cryo implementation starts.

#### `src/player.js`
- Add future-proof weapon-state container on the player.
- Keep character starting weapon assignment compatible with the new structure.

#### `src/upgrades.js`
- Refactor upgrade generation to support weapon-specific stat and path nodes.
- Introduce Cryo upgrade definitions and progression sequencing.
- Preserve global passives as a separate system.

#### `src/weapons.js`
- Rewrite Cryo around stateful stats and path flags.
- Add Cryo-specific helpers for freeze buildup, shard spawning, split logic, and path behaviors.
- Avoid making Pulse, EMP, and Swarm depend on Cryo-specific helpers.

#### `src/game.js`
- Reduce weapon-specific collision logic where possible.
- Route Cryo on-hit effects through helper functions instead of growing inline condition chains.
- Hook Cryo death-trigger effects like Shatter Core into enemy death handling in a controlled way.

#### `src/enemies.js`
- Add enemy freeze-meter and status-related fields or helper builders.
- Potentially centralize enemy status initialization.

#### `src/hud.js` and `src/style.css`
- May need upgrade card presentation changes for stat/path cards.
- Any Cryo-specific run feedback should be minimal and readable.

### Cryo-specific architecture guardrails
- Do not model Cryo path choices as a fake weapon level.
- Do not hardcode path progression directly into generic `p.w[wid]++` style logic.
- Do not spread Cryo status logic across `weapons.js`, `game.js`, and `enemies.js` with duplicated rules.
- Prefer helper functions for status application and path-trigger checks.
- The Cryo implementation should make the future EMP, Pulse, and Swarm redesign easier, not harder.

## Enemy roster and pressure model

### Enemy types
| Type | Shape | Colour | Behaviour |
|---|---|---|---|
| Runner | Triangle | `#E24B4A` | Fast, low HP, cluster pressure |
| Shooter | Circle | `#FFB627` | Holds range and fires slow projectiles |
| Brute | Square | `#D4537E` | Slow, tanky, punishing contact |

### Pressure rules
- Runners show up immediately.
- Shooters enter around 45s.
- Brutes enter around 80s.
- Surges happen every 40s.
- Boss fights interrupt normal surge rhythm.
- Runs should feel dangerous instantly and denser over time.

## Upgrade system rules
- Upgrade moments should feel meaningful, not filler.
- Always present exactly 3 options.
- Normal level-ups should include both:
- at least 1 weapon-side upgrade option
- at least 1 passive upgrade option
- Show exact stat changes, not vague flavor.
- Weapon cards should clearly communicate what the next weapon upgrade does.
- Front-facing upgrade text should read as an action, for example `INCREASE ATTACK SPEED` or `UNLOCKS WEAPON EMP`.
- Detailed hover/focus text should explain what the upgrade does in play and show the exact numerical gain where applicable.
- Passive upgrade cards should not repeat generic subtitle text like `RUN-WIDE STATS` if the title already communicates the action clearly.
- Current slot cap: 4 weapons.
- Current live weapon progression is still the simple tier model.

## Combat readability rules
- Low health must be unmistakable within a fraction of a second.
- Taking damage should trigger multiple layers of feedback: screen response, HUD response, and health-bar response.
- HP bar changes should show both current health and recent damage taken.
- Feedback should feel urgent without obscuring bullets, enemies, or joystick readability.
- Weapon tier upgrades should become visible in live combat through projectile, pulse, field, or drone presentation changes, not only through numbers.

### Current passive upgrades
| ID | Label | Effect |
|---|---|---|
| `spd` | SPRINT | Speed x1.22 |
| `dmg` | OVERCLOCK | Damage x1.25 |
| `mag` | MAGNET | XP radius x1.6 |
| `hp` | NANO-REPAIR | Max HP +30 and heal up to 30 |
| `dg` | GHOST STEP | Dodge +12%, cap 65% |
| `rt` | OVERCLOCK FIRE | Fire rates x1.25 |

## Long-term progression rules
This is important and easy to accidentally break later.

### Allowed direction
- Meta-progression based on discovery, unlock knowledge, codex completion, character access, or build planning.

### Disallowed direction
- Permanent stat grind.
- Power creep that makes future runs easier just because the player played more.
- Monetised power.

### Intended meta layer
- Discover a synergy for the first time.
- Persist that discovery between runs.
- Let the player use that knowledge intentionally later.
- Reward curiosity, not repetition.

## Architecture priorities
This project is expected to change a lot. Expandability matters as much as shipping features.

### Core principles
- Prefer data-driven content over hardcoded one-off branches.
- New characters, weapons, enemies, and upgrades should be addable with minimal edits.
- Avoid circular dependencies.
- Keep run state centralized and understandable.
- Separate content definitions from runtime orchestration where practical.
- Keep UI systems modular enough that overlays, HUD panels, and future menus can evolve independently.

### Desired future-proofing direction
- Characters should be definable mostly through config plus a small set of passive hooks.
- Weapons should continue moving toward declarative definitions for stats, tier data, and effect hooks.
- Upgrade generation should remain deterministic and inspectable.
- Systems with future content scale should avoid hidden coupling to Ghost-only assumptions.
- If a new feature requires touching unrelated files "everywhere", stop and refactor first.

### Refactor smell list
If any of these appear, prefer cleanup before more content:
- Character logic duplicated in several files.
- Weapon tier behavior spread across too many switch statements.
- UI text duplicated in multiple places.
- Progression logic mixed into combat logic.
- Menu code and run code depending on each other in fragile ways.

## Current code map
Use this as the fast onboarding map.

```text
src/
  main.js        - app entry, creates and starts Game
  game.js        - core orchestration, loop, overlays, run flow, boss flow
  player.js      - character roster and player factory
  weapons.js     - weapon definitions, bullets, fire logic, overload
  enemies.js     - enemy roster, spawn logic, targeting helpers
  upgrades.js    - passive definitions, buildPool, applyUpgrade
  boss.js        - boss definition, update and render helpers
  particles.js   - particles and screen-space combat feedback
  hud.js         - DOM HUD creation and overlay helpers
  input.js       - keyboard + virtual joystick
  audio.js       - audio init and playback helpers
  style.css      - all UI styling
```

## Technical conventions
- Vanilla JS only.
- HTML5 Canvas 2D for gameplay rendering.
- Vite for dev/build.
- Game state primarily lives on the `Game` instance.
- Weapon code should use callbacks/hooks rather than import `game.js` directly where possible.
- Arrays for active entities are fine; prune/filter dead entries.
- Keep naming short but readable.
- Prefer explicit values and readable formulas over clever abstractions.

## UI and tone
- UI text should be terse, uppercase, monospace, cyberpunk.
- Font remains Courier New for now.
- No tutorialization, no tooltip spam, no hand-holding.
- Menu and overlays should feel intentional, bold, and readable on mobile.
- The current main menu is a stylized full-screen overlay with character select and run overview.
- Death screen should show run summary clearly.
- Upgrade cards should stay visually clean by default and reveal deeper stat detail on hover/focus.
- Weapon fork cards should have stronger, branch-specific colour identity than normal upgrade cards.
- Upgrade card titles and subtitles should explicitly say what is being upgraded, not rely on icons or colour alone.
- Weapon fork expanded details should explain what the path actually does, how it behaves, and what kind of outcome the player should expect.

## Visual language
- Background: `#08080f`
- Grid lines: subtle cyan
- Player default tone: teal glow with white damage flash
- Damage numbers are source-coded
- Frozen enemies get cyan ring
- Stunned enemies get purple ring
- Synergy hits should feel bigger and brighter than normal hits
- Cyberpunk base aesthetic is correct, but future characters can introduce sub-themes without breaking the world

## Naming and marketing notes
- "Infinite Rogue" is still a working title, not sacred.
- The name should imply replayability, strategy, sci-fi tone, and mobile-friendly punch.
- Current alternative exploration: SYNAPSE, GHOST.EXE, NULL RUN, OVERCLOCK, CIPHER, JACK IN
- Marketing angle should emphasize satisfying build moments and synergy payoffs.

## Documentation rules
This section exists to keep future token usage low.

### When updating this file
- Keep the `Current implementation snapshot` section accurate.
- Prefer short factual bullets over long prose.
- Preserve stable design rules near the top.
- Keep volatile tuning details lower down.
- Add a changelog note for meaningful design or architecture shifts.

### What should live here
- Game vision and non-negotiables.
- Current gameplay loop.
- Current roster and system rules.
- Architecture direction and expansion guardrails.
- Code map and high-level state of the build.

### What should not bloat this file
- Long speculative brainstorming.
- Patch-by-patch implementation detail.
- Exhaustive tuning notes that change daily.
- Temporary debugging context.

## Open priorities
These are the current likely next focus areas.

1. Rebalance the updated weapon roster around the finalized simple Tier 1 / Tier 2 / Tier 3 identities.
2. Tune the finalized live weapon trees around pacing, readability, and power breakpoints.
3. Refine characters so each one changes decision-making, not just numbers.
4. Continue moving systems toward easier future content expansion.

## Changelog
- 2026-04-08: Finalized the live weapon trees again around simple Tier 1/Tier 2/Tier 3 behavior and implemented Cryo freeze spread plus cryo fields, Pulse overpenetration plus kill shockwaves, EMP faster T2 cooldown, and Swarm kill bursts plus mini-drone splits.
- 2026-04-08: Rolled live Cryo back to the original simple tiered version and removed the active stat/path upgrade flow from gameplay.
- 2026-04-08: Refined upgrade-card copy so stat cards use clearer action-oriented titles, passive cards explicitly state they upgrade run-wide stats, and weapon fork details are more descriptive about behavior and expected outcomes.
- 2026-04-08: Refined upgrade-card presentation so cards stay clean by default, reveal detailed stats on hover/focus, and give weapon fork choices stronger branch-based colour treatment.
- 2026-04-08: Changed upgrade-pool rules so normal level-ups provide both weapon-side and passive-side scaling options when available, and weapon path upgrades now appear as dedicated 3-choice fork moments with stronger UI emphasis.
- 2026-04-08: Lowered level-up thresholds to accelerate upgrade cadence and implemented first-pass Cryo Tier 2 behaviors for Shatter Core, Chain Freeze, and Cold Momentum.
- 2026-04-08: Implemented enemy Freeze Meter support and Cryo-specific upgrade generation, including Cryo stat cards, Tier 1 path picks, and stat-driven Cryo projectile values.
- 2026-04-08: Implemented Phase 1 of the Cryo groundwork by moving player weapons to per-weapon state containers and updating the current runtime, HUD, and upgrade flow to read through weapon-state helpers.
- 2026-04-08: Added a staged Cryo implementation plan covering player weapon-state refactor, enemy Freeze Meter support, upgrade-schema changes, and file-by-file code impact.
- 2026-04-08: Locked the future Cryo weapon system including Freeze Meter, stat-upgrade loop, path structure, and Tier 1-3 specializations as the first full weapon design target.
- 2026-04-08: Added a concrete gameplay tuning spec covering target run length, pacing beats, upgrade cadence, boss timing, surge role, and character/weapon balancing goals.
- 2026-04-08: Rewrote this file into a compact operating brief with a fixed gameplay-loop section, implementation snapshot, architecture guardrails, and documentation rules so future sessions can onboard faster with less token usage.
- 2026-04-08: Added a proper main menu overlay with selectable operators and loadout/run summary, replacing the previous single-character start prompt.
