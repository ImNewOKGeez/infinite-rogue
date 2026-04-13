# Records Polish — Two Medium Improvements

## Prerequisites
- Read `CLAUDE.md` at session start and keep it in context
- Both changes are data-driven and UI-focused; no new game logic
- After completing both, follow the CLAUDE.md update checklist (lint, check, build, verify, etc.)

---

## Improvement 1: Empty weapon slots show hints (#10)

**What:** Players don't know there are other weapons available beyond their starting weapon. Empty weapon slots should show visual hints — silhouettes, "?", or labels — so players understand that more weapons exist and can be discovered.

**Where:** 
1. `src/hud.js` — HUD weapon slot rendering during gameplay
2. `src/gameUi.js` — Weapon card display logic (if applicable)

**How:**

### Part A: Modify the HUD weapon slot display

1. Find the code that renders the four weapon slots on the HUD (look for weapon slot DOM creation or canvas drawing)
2. Currently, empty slots probably show nothing or are blank
3. Add a visual hint for empty slots:
   - **Option A (Simple):** Show a `"?"` in a muted color (e.g., `#444` or `#666`) instead of blank space
   - **Option B (Better):** Show a faint weapon silhouette outline — e.g., a gray-50% version of a weapon icon
   - **Option C (Best UI):** Combine a `"?"` with a label like `"[LOCKED]"` or `"[?]"` to make it obvious that slots are discoverable

4. Styling: 
   - Keep empty slots visually distinct from owned weapons (duller, smaller, or grayed out)
   - Maintain the existing weapon-slot layout and spacing
   - Match the monospace/cyberpunk tone

5. **Optional enhancement:** If you want to hint at what weapon comes next, you could show a small label like `"[NEXT: PULSE]"` but that might spoil discovery — keep it vague with just `"?"` first

### Part B: Consider records/loadout display

1. If the death screen or records overlay shows weapon loadouts, apply the same visual hint
2. Empty slots in the "run summary" should also show `"?"` or `"[EMPTY]"` so it's clear what the player had vs. didn't have

**Testing:**
- Start a new run as Ghost (who starts with Cryo)
- HUD should show: `[Cryo L1] [?] [?] [?]`
- As you unlock weapons, the `?` slots should fill with weapon names/levels
- On the death screen, empty slots should show `[EMPTY]` or `[?]` consistently
- Check all three characters — each starts with a different weapon

---

## Improvement 2: Rating system for records (#15)

**What:** The records screen shows best times (e.g., "5:23") but they mean nothing without context. Add a simple rating tier (DEAD ON ARRIVAL / SURVIVOR / VETERAN / GHOST) based on survival time so players can see at a glance what kind of runs they've had.

**Where:**
1. `src/progression.js` — Save schema (if needed) and rating logic
2. `src/hud.js` — Records overlay display

**How:**

### Part A: Define rating thresholds

1. Add a helper function in `progression.js` or near the records logic:
   ```js
   function getRatingTier(timeInSeconds) {
     const minutes = timeInSeconds / 60;
     // Define thresholds based on the target run shape from CLAUDE.md
     if (minutes < 2) return 'DEAD ON ARRIVAL';
     if (minutes < 4) return 'SURVIVOR';
     if (minutes < 6) return 'VETERAN';
     return 'GHOST';  // 6+ minutes
   }
   ```

2. **Reasoning behind these thresholds** (from CLAUDE.md):
   - 2 min: Poor/sloppy run, weak direction
   - 4 min: Decent run, decent build
   - 6 min: Strong run, still under pressure
   - 8+ min: Exceptional runs

3. Optionally define colors for each tier:
   ```js
   const RATING_COLORS = {
     'DEAD ON ARRIVAL': '#666666',   // gray
     'SURVIVOR': '#FFB627',          // amber
     'VETERAN': '#00CFFF',           // cyan
     'GHOST': '#FF2D9B'              // magenta/pink
   };
   ```

### Part B: Apply ratings to saved records

1. When you save a run's time to `progression.js` (likely in the death handling), compute the rating:
   ```js
   const rating = getRatingTier(runTime);
   // Store or apply it somehow
   ```

2. You don't need to change the save schema — just compute the rating dynamically when displaying records (no save bloat)

### Part C: Display ratings on the records screen

1. Find the records overlay in `hud.js` (look for `showRecordsScreen()` or similar)
2. Next to each time, display the rating tier:
   ```
   GLOBAL BESTS
   Time:     5:23  [VETERAN]
   Kills:     142
   Level:      23
   
   PER CHARACTER
   Ghost
     Time:   4:47  [SURVIVOR]
     Kills:    98
   Bruiser
     Time:   5:23  [VETERAN]
     Kills:   142
   ```

3. Format it consistently with the existing records layout
4. Color-code the rating label if you defined `RATING_COLORS` (optional but nice)
5. Alternatively: Show the rating as a small badge or tag to the right of the time

**Testing:**
- **New save:** First run ever should show times under 2 min (DEAD ON ARRIVAL)
- **Progress through playtesting:** Survive until 4 min (SURVIVOR), 6 min (VETERAN), 8 min (GHOST)
- **Records screen:** All ratings should appear correctly next to times
- **Per-character:** Each character's best time should show its own rating
- **Edge cases:** Times right at thresholds (e.g., 3:59.9 vs 4:00.1) should have correct ratings

---

## Implementation Notes

**Empty slots (#10):**
- Search for where HUD weapon slots are rendered (might be DOM in `hud.js` or canvas in `game.js`)
- If slots are rendered as text/labels, just add `"?"` when `P.ws[i]` is undefined/null
- If slots are visual boxes, add a simple `"?"` character centered in the box
- Keep the styling consistent with owned weapon slots (same size/positioning, just different color/opacity)

**Rating system (#15):**
- Thresholds are tuning constants — if playtesting shows 4 min is too easy, adjust them
- The rating is computed on-the-fly, not stored, so zero save complexity
- Colors are optional — monospace `[TIER NAME]` works fine without color coding
- Consider adding a small desc on hover or in a tooltip explaining the tier system, but simple labels are enough for now

---

## After both are done

Run the full update checklist from CLAUDE.md:
1. `npm run lint`
2. `npm run check`
3. `npm run build`
4. `npm run verify`
5. Drag `dist/` → Netlify
6. `npx cap sync`
7. Play in Android Studio (optional)
8. Commit with a clear message: `"Add weapon slot discovery hints and run rating tiers to records"`

**Update CLAUDE.md:**
- Add a new changelog entry describing both improvements
- Format: `- YYYY-MM-DD: Added visual hints (?) to empty weapon slots for discovery, and added run rating tiers (DEAD ON ARRIVAL/SURVIVOR/VETERAN/GHOST) to records screen based on survival time`
- Keep it consistent with existing entries

---

## Difficulty breakdown

- **#10 (weapon slot hints):** 5–10 lines (UI text/styling)
- **#15 (rating system):** 15–20 lines (rating logic + records display)

**Total implementation time:** ~2–4 hours including testing.

---

## Optional enhancements for later

- **Unlocks hint:** If a weapon unlocks during a run, show `[NEW: PULSE]` on the next level-up screen
- **Rating color coding:** Apply weapon colors or tier colors to the rating badges
- **Tier progression visual:** Show a progress bar toward the next tier on the records screen
- **Tier descriptions:** Add flavor text explaining what each tier means
