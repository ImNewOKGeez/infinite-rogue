# Instructions for Claude Code

- Read this file at the start of every session and keep it in mind throughout
- When a design decision is made, a feature is built, or something in this document becomes outdated, update this file to reflect the current state of the project
- When updating, don't delete history — move outdated items to a ## Changelog section at the bottom with a brief note of what changed and why
- If the player or you make a decision that contradicts something in this document, flag it and ask before overwriting

# Infinite Rogue — Project Brief for Claude Code

## What this is
A mobile-first cyberpunk roguelite survivor game in the style of Magic Survival (Android).
Built in vanilla JS + HTML5 Canvas, using Vite as the dev server.
Target platform: iOS and Android via Capacitor (not yet implemented).
Solo developer project. Early access launch strategy — ship when functional, iterate publicly.

## The core fantasy
The player should feel **satisfied and clever** at the end of a run — like they figured something out, built something that clicked, and watched it pay off. Not just "that was chaotic" but "I understood what I was doing and it worked."

## Design pillars
- **Discovery over instruction** — synergies, unlock paths and combos are found, not told. Never hand-hold.
- **Short punchy runs** — 3 to 5 minutes before being overwhelmed. Pick up, play, put down.
- **Aggressive from the start** — danger from minute one. No slow warm-up.
- **Emergent strategy** — weapons interact in ways players discover themselves. No named combo tooltips.
- **Endless** — no win condition. Runs end when you die. Survival is the score.

## Aesthetic
Cyberpunk is the foundation — dark backgrounds, neon weapon colours, geometric enemies, monospace UI text. However the aesthetic is intentionally open to evolving as new characters are added. Each character can bring a distinct visual sub-theme while staying within the broader cyberpunk/sci-fi world. Don't lock every future character into the same palette.

## Audience
Intentionally broad. The game should be approachable enough for casual players but have enough depth to satisfy players who know the roguelite genre well. Magic Survival is the closest reference — simple on the surface, deep in practice.

## Platform
Android is likely the path of least resistance for initial launch. iOS to follow. Both via Capacitor wrapping the HTML5/Canvas game. The game is built mobile-first — virtual joystick, touch-friendly UI, portrait or landscape.

## Current character: Ghost
- **Start weapon:** Cryo Lance
- **Passive:** 20% dodge chance (increases with upgrades, caps at 65%)
- **Playstyle:** Kiting, positioning, freeze setup, synergy combos
- **Visual identity:** Cyan (#00CFFF) colour scheme, fast and evasive feel

## Planned characters (not yet built)
### Bruiser
- Start weapon: Pulse Cannon
- Passive: +35% damage when HP below 50%
- Playstyle: High risk / high reward, aggressive, gets stronger when hurt
- Visual identity: Amber/orange, heavy and brutal feel

### Hacker
- Start weapon: EMP Burst
- Passive: Stunned enemies drop 2x XP
- Playstyle: Crowd control, levels fast, snowballs through XP advantage
- Visual identity: Purple (#BF77FF), technical and cerebral feel

Characters should feel **mechanically and visually distinct**. Same weapons are available to all characters but starting weapon and passive create fundamentally different playstyles.

## Weapons
All weapons have 3 tiers. Tiers are unlocked via the upgrade screen during a run.

| Weapon | Icon | Colour | Role |
|--------|------|--------|------|
| Cryo Lance | ❄ | #00CFFF | Setup — slows (T1), freezes (T2), 3-shot spread (T3) |
| Pulse Cannon | ◈ | #FFB627 | Burst damage — heavy shot (T1), AoE (T2), pierce (T3) |
| EMP Burst | ⚡ | #BF77FF | Crowd control — stuns (T1), wider radius (T2), overload explosion (T3) |
| Nano Swarm | ◉ | #1DFFD0 | Sustained DPS — 2 drones (T1), 3 drones (T2), 4 drones (T3) |

More weapons planned as content expands.

## Key synergies (emergent — never labelled in UI)
- **Cryo + Pulse** — frozen enemies take 3.5x damage from Pulse shots
- **EMP T3 Overload** — stunned enemies explode with white/purple burst, splash damage nearby
- **Cryo + EMP** — freeze enemies then detonate with overload
- **Swarm + any freeze** — drones deal bonus sustained damage to immobile frozen targets

Players discover these themselves. This is intentional. Do not add tooltips or synergy notifications.

## Enemy types
| Type | Shape | Colour | Behaviour |
|------|-------|--------|-----------|
| Runner | Triangle | #E24B4A | Fast, low HP, spawns in clusters of 2–4 |
| Shooter | Circle | #FFB627 | Holds range 110–400px, fires slow projectiles |
| Brute | Square | #D4537E | Slow, very high HP, massive contact damage |

Runners appear immediately. Shooters from ~45s. Brutes from ~80s. All scale with wave number.

## Difficulty
- Aggressive from second one — no grace period
- Surge every 40 seconds — spawn rate triples for 8–17s (gets longer as run progresses)
- Spawn rate floor: 0.06s between spawns at peak
- During surges, enemies spawn in batches scaling with time

## Passive upgrades
| ID | Label | Effect |
|----|-------|--------|
| spd | SPRINT | Speed ×1.22 |
| dmg | OVERCLOCK | Damage mult ×1.25 |
| mag | MAGNET | XP pickup radius ×1.6 |
| hp | NANO-REPAIR | Max HP +30, restore up to 30 |
| dg | GHOST STEP | Dodge +12% (cap 65%) |
| rt | OVERCLOCK FIRE | All fire rates ×1.25 |

## Upgrade screen rules
- Always shows exactly 3 options
- Always guarantees at least 1 weapon option if one is available
- Each card shows exact stat changes (e.g. "Speed: 158 → 193") — not vague descriptions
- Weapon cards show current tier upgrading to next tier
- Max 4 weapon slots, max tier 3 per weapon

## Meta-progression (discovery-based — not yet built)
This is a key differentiator. Players do NOT earn permanent stat boosts between runs. Instead:
- Discovering a weapon synergy combo for the first time **unlocks** it as a known combo
- Unlocked combos are saved and can be intentionally built toward in future runs
- This rewards curiosity and replayability without making the game easier over time
- Think of it as a "codex" of discovered interactions the player builds up

Do not implement grind-based permanent stat upgrades. The meta layer is about knowledge, not power.

## Character unlock system (not yet built)
- Some characters unlocked through gameplay (e.g. survive X minutes, discover Y combos)
- Some characters purchasable via IAP
- Monetisation model not fully decided — lean toward player-friendly (no pay-to-win)

## File structure
```
src/
  main.js       — entry point, creates Game instance
  game.js       — Game class, main loop, update, draw, all core orchestration
  player.js     — mkPlayer() factory function
  weapons.js    — WDEFS, bullets array, all weapon fire logic, triggerOverload
  enemies.js    — enemies array, spawnEnemy, pruneEnemies, nearest, dist2
  upgrades.js   — PASSIVES array, buildPool, applyUpgrade
  particles.js  — particles array, updateParticles, addRing, addBurst, addDot, drawParticles
  hud.js        — initHUD (DOM creation), updateHUD, showOverlay, hideOverlay, setSurge
  input.js      — keyboard state, virtual joystick, jDir export
  style.css     — all styles
```

## Coding conventions
- Vanilla JS only — no frameworks, no libraries
- HTML5 Canvas 2D for all rendering
- Vite for dev server and build
- Game state lives on the Game class instance in game.js
- Weapon fire functions receive an onHitEnemy callback rather than importing game.js (avoids circular deps)
- Arrays for enemies, bullets, particles, gems — filter to remove dead entries
- All colours defined as hex constants matching the weapon/character they belong to

## UI and tone
- All UI text: terse, uppercase, monospace, cyberpunk
- Font: Courier New throughout
- No tutorials, no tooltips, no hand-holding
- Death screen shows: time survived, level reached, kill count, weapons equipped
- Overlay system: single #overlay div, shown/hidden via showOverlay/hideOverlay

## Visual language
- Background: #08080f (near black)
- Grid lines: rgba(0,207,255,0.035) — subtle cyan
- Player: #1DFFD0 teal with glow, flashes white on damage
- Damage numbers: colour-coded by source (cyan=cryo, purple=emp, gold=synergy, white=normal)
- Synergy hits: larger number, glow effect
- Frozen enemies: cyan outline ring
- Stunned enemies: purple outline ring
- Hit flash: enemies turn white for 0.1s on damage
- EMP Overload: double expanding ring (white then purple) + 18 burst particles + "OVERLOAD!" text

## What is NOT built yet
- Sound effects and music
- Additional characters (Bruiser, Hacker)
- Discovery-based meta-progression / combo codex
- Save data between sessions (localStorage or similar)
- Capacitor mobile wrapper
- Boss enemies
- App store assets (icon, screenshots, description)
- Analytics / crash reporting

## Marketing direction
- Platform: TikTok and Instagram Reels — short gameplay clips
- Angle: satisfying build moments, synergy payoffs, chaos clips
- Development will eventually be documented publicly once there is something worth showing
- Name "Infinite Rogue" is not finalised — open to alternatives that better capture the discovery/strategy angle

## Name exploration notes
The name should convey:
- Replayability / endless nature
- Strategic depth / build-crafting
- Cyberpunk/sci-fi tone
- Mobile-friendly (short, punchy)
Alternatives worth considering: SYNAPSE, GHOST.EXE, NULL RUN, OVERCLOCK, CIPHER, JACK IN