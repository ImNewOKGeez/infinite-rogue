# Claude Session Handoff

Use this to start a fresh Claude chat for continued development on `infinite-rogue`.

## Project Snapshot

- `Infinite Rogue` is a mobile-first cyberpunk survivor roguelite built with vanilla JS + Canvas + Vite, with Capacitor Android packaging already in-repo.
- Core loop is live: menu -> character select -> run -> auto-fire survival -> level-up drafts -> surges -> recurring boss -> death summary -> records/discoveries.
- Current live roster: 3 characters (`Ghost`, `Bruiser`, `Hacker`), 7 weapons (`Cryo`, `Pulse`, `EMP`, `Swarm`, `Arc Blade`, `Molotov`, `Barrier`), 6 passive upgrades, 4 weapon slots per run, weapon levels 1-5, Ascension drafts for eligible maxed weapons.
- Current live support systems: records screen, synergy discovery tracking, playtest lab, pause overlay, menu animations, PWA assets, Netlify-ready `dist/`, Capacitor Android project.

## What Was Just Finished

- UI/QoL polish pass is already reflected in `CLAUDE.md` changelog.
- Recently completed items include:
- pause button + pause overlay
- stronger HUD/death/readability polish
- menu flow + animated menu background + JACK IN transition
- Molotov weapon + ascensions
- playtest lab expansion
- ESLint + verification scripts
- empty weapon slot hints
- records rating tiers
- longer enemy HP bar visibility
- enemy wave-strength color brightening
- death-screen kill breakdown by enemy type
- XP gem magnetization animation
- freeze/stun status VFX trails

## Current Priorities

- Keep using `CLAUDE.md` as the single source of truth and update it whenever live behavior changes.
- Next likely work is tuning/polish rather than missing core scaffolding:
- Cryo freeze thresholds, spread pacing, and boss anti-freeze behavior
- overall weapon balance from level 1-5
- boss fairness/duration/readability
- longer-term codex/planning layer on top of records/discoveries
- future-proofing so new content is easier to add

## Important Guardrails

- No permanent stat-grind progression.
- Discovery over tutorialization.
- Mobile readability matters more than flashy VFX density.
- Prefer data-driven additions and modular helpers over stuffing more one-off logic into `src/game.js`.
- Run the checklist from `CLAUDE.md` after any real change:
- `npm run lint`
- `npm run check`
- `npm run build`
- `npm run verify`
- then deploy/sync/playtest/commit as noted there

## Files To Give The New Claude Chat

- `CLAUDE.md` — required; this is the real operating brief and latest changelog.
- `CLAUDE_SESSION_HANDOFF.md` — this compact handoff.


## Optional Extra Context Files

- `src/game.js` if the next task is gameplay/runtime work
- `src/hud.js`, `src/gameUi.js`, `src/progression.js` if the next task is UI/records/death-screen work

## Paste-In Prompt

Please read `CLAUDE.md` first and treat it as the source of truth. Then use `CLAUDE_SESSION_HANDOFF.md` as the concise project summary. We are continuing development on Infinite Rogue, a mobile-first cyberpunk survivor roguelite in vanilla JS/Canvas/Vite with Capacitor Android packaging. Most recent polish passes are already implemented and logged in `CLAUDE.md`, including records/UI/QoL/final VFX polish. Before making changes, confirm the current implementation against the brief, keep changes mobile-readable and future-proof, and update `CLAUDE.md` if anything live changes.
