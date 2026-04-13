# Quick QOL UI Pass — Three Easy Wins

## Prerequisites
- Read `CLAUDE.md` at session start and keep it in context
- These changes are UI-only; no game logic changes
- After completing all three, follow the CLAUDE.md update checklist (lint, check, build, verify, etc.)

## Change 1: Level-up screen shows current loadout (#12)

**What:** Add a small summary of the player's current weapon lineup above the three upgrade options on the level-up overlay. Helps players make informed decisions.

**Where:** `src/hud.js`, in or near the level-up overlay creation code

**How:**
1. Find the level-up overlay DOM that renders the three upgrade cards
2. Add a brief text block above the cards that displays current weapon state: `Current: [WEAPON1 (L#)] · [WEAPON2 (L#)] · etc`
3. If the player has empty slots, show `[EMPTY]` in their place
4. Style it to match the existing HUD monospace/cyberpunk tone (terse, uppercase, color-coded by weapon)
5. Keep it compact — one line max — so it doesn't clutter the overlay

**Testing:**
- Level up several times and verify the summary updates correctly
- Check it displays the right weapon names and levels
- Verify it appears consistently above the three cards

---

## Change 2: Boss bar stays visible during phase transitions (#13)

**What:** The boss health bar currently disappears during the invulnerability window when the boss transitions between phases. Keep it visible with a "TRANSITIONING" label so it doesn't look broken.

**Where:** `src/hud.js` (boss bar rendering/visibility) and `src/boss.js` (boss state tracking)

**How:**
1. Find the boss bar DOM rendering code in `hud.js` — look for where it sets opacity/visibility
2. Currently the bar likely hides during `bossIntroT` or similar windows. Instead, keep it visible.
3. When the boss is in a transition phase (check `boss.phase` or a new `bossTransitioning` flag), render the bar label as `TRANSITIONING` instead of the current HP text
4. Keep the bar itself visible and show the current HP (don't reset visually, just change the label)
5. Alternatively: add a small state indicator badge ("PHASE 2" → "TRANSITIONING →" → "PHASE 2") so the bar never "blinks out"

**Testing:**
- Trigger a boss kill and watch the transition window — bar should stay on screen
- Health number should update smoothly without a visibility flicker
- Verify it works for all three phase transitions

---

## Change 3: Upgrade cards show current→new stats (#3)

**What:** Upgrade cards currently show what the upgrade does but not the player's current weapon stats. Add a line showing `Current: X → New: Y` for every numeric stat so players know where they're starting from.

**Where:** `src/gameUi.js`, in the upgrade card rendering code (likely `cardEl` or card-text formatting)

**How:**
1. Find the function that renders upgrade card text/labels in `gameUi.js`
2. For weapon upgrades, gather the current weapon's stats:
   - Current level, damage, fire rate, and any special numeric traits
   - Use the player's current weapon state (`P.ws`, `P.dmg`, etc.) and the weapon tier definition
3. For each stat that the upgrade will change, add a preview line:
   - Format: `DAMAGE: 12 → 15` or `FIRE RATE: 1.2s → 0.96s`
   - Keep it terse and aligned with existing card layout
4. Passive upgrades are simpler — just show the current stat and the new value after upgrade
5. **Important:** Show the stats *before* upgrade, then show what they become *after* picking this card

**Tricky bit:** You need to know which weapon is being upgraded in the card. The upgrade data should already track this — look at how `applyUpgrade` or the card generation code identifies the target weapon.

**Testing:**
- Pick a weapon upgrade and verify it shows current level and new level
- Pick damage/speed cards and verify the stat preview is correct
- Pick a weapon you already own and verify it shows the right current level
- Pick a new weapon (level 1) and verify it shows the new starting stats

---

## After all three are done

Run the full update checklist from CLAUDE.md:
1. `npm run lint`
2. `npm run check`
3. `npm run build`
4. `npm run verify`
5. Drag `dist/` → Netlify
6. `npx cap sync`
7. Play in Android Studio (optional if you have it configured)
8. Commit with a clear message: `"Add level-up loadout summary, boss-bar phase visibility, and upgrade card stat previews"`

**Update CLAUDE.md:**
- Add a new entry in the `## Changelog` section at the top describing these three changes (follow the existing 2026-04-13 format)
- Note the specific HUD/card improvements made
- Keep the format: `- YYYY-MM-DD: Brief description of changes`

---

## Notes
- All three changes live in `hud.js` and `gameUi.js` — minimal file churn
- No new game state is needed; you're just displaying existing data differently
- If you run into color/spacing issues, check `style.css` for the HUD class definitions
- Questions? The CLAUDE.md brief has detailed HUD/UI tone rules in the "UI and tone" section
