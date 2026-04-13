# Quick Polish + Run Summary — Three Improvements

## Prerequisites
- Read `CLAUDE.md` at session start and keep it in context
- Changes span rendering tweaks (#7, #14) and data tracking (#1)
- After completing all three, follow the CLAUDE.md update checklist (lint, check, build, verify, etc.)

---

## Quick Win 1: Enemy health bars persist longer (#7)

**What:** Enemy health bars fade away too quickly on mobile. Players can't read them in the chaos. Keep them visible for a full 2 seconds after the last hit instead of vanishing in ~0.5s.

**Where:** `src/enemies.js`, in the enemy update or health bar visibility logic

**How:**
1. Find where enemy health bar visibility is managed — likely a timer or age check
2. Look for code like `hpBarVis` or `healthBarAge` that controls when the bar appears/disappears
3. Currently it probably shows for a short window (0.3–0.5s). Change the visible duration to **2 seconds** after the last hit
4. The bar should fade out at the end of those 2 seconds (don't snap off)
5. Each new hit should reset the 2-second timer so the bar stays visible as long as the enemy is being attacked

**The change is likely one of:**
- Change a constant like `HP_BAR_VISIBLE_TIME` from `0.5` to `2.0`
- Or modify the condition that hides the bar to use a longer timeout

**Testing:**
- Hit an enemy once and count: bar should stay visible for ~2 seconds
- Hit it again before the 2s ends: timer resets and bar stays visible
- Let it sit for 2s without hitting: bar fades out
- Verify it works during surges with lots of enemies on screen

---

## Quick Win 2: Enemy strength visual indicator (#14)

**What:** Late-game enemies look identical to early-game ones even though they're much stronger. Add a subtle visual cue (color shift or aura) so players instantly see that wave 8 enemies hit harder than wave 2 enemies.

**Where:** `src/enemies.js`, in the enemy render function

**How:**
1. Find the enemy rendering code (likely a `drawEnemy()` or similar in the render loop)
2. After the enemy's base color is set, add a subtle **color brightening or saturation shift** based on the current `Game.surgeCount` or wave number
3. **Approach:** Lighten the enemy color by ~10–20% for every 2 surges reached, OR add a faint colored aura
4. Keep it subtle — the goal is "readable" not "neon overload"
5. **Example formula:**
   ```
   const waveMod = Math.min(Game.surgeCount * 0.08, 0.3);  // cap at 30% lighter
   Apply waveMod to brighten the enemy's fill color
   ```
6. Alternatively: Draw a faint outer ring/glow that gets larger or brighter as waves increase

**Testing:**
- Start a run and observe enemies at wave 1 (should look "normal")
- Let surges happen and watch enemies brighten/shift visually
- By wave 5–6, the color change should be obvious without being distracting
- Verify it doesn't make enemies hard to see or break readability

---

## Run Summary Expansion: Track enemy type kills (#1)

**What:** The death screen shows time, level, and loadout but not *what* the player fought. Add a breakdown of kills-by-enemy-type (e.g., "Runners: 23 / Shooters: 15 / Brutes: 9") so players understand their run better and learn enemy matchups.

**Where:** Three files need changes:
1. `src/game.js` — track kills by enemy type during gameplay
2. `src/hud.js` — display the breakdown on the death screen
3. `src/gameUi.js` — format the enemy kill summary text (optional, if you want a helper)

### Step 1: Track kills during gameplay (`src/game.js`)

**Current state:** `Game.killCount` exists but is just a single number.

**What to add:**
1. Replace or supplement `killCount` with an object that tracks kills per enemy type:
   ```js
   Game.killsByType = {
     runner: 0,
     shooter: 0,
     brute: 0,
     titan: 0,
     juggernaut: 0,
     shieldLeech: 0
   };
   ```
2. Keep the old `Game.killCount` for backward compatibility if it's used elsewhere in the code

**Where to update kills:**
- Find where enemies die (somewhere in the update loop, probably when `enemy.hp <= 0`)
- Before deleting/removing the enemy, increment the appropriate counter:
  ```js
  Game.killsByType[enemy.type]++;
  Game.killCount++;  // keep for compatibility
  ```
- Make sure `enemy.type` is a lowercase string key that matches your object (e.g., `'runner'`, `'shooter'`)

**Reset on new run:**
- In the `newRun()` function, reset the tracker:
  ```js
  Game.killsByType = {
    runner: 0,
    shooter: 0,
    brute: 0,
    titan: 0,
    juggernaut: 0,
    shieldLeech: 0
  };
  ```

### Step 2: Display kills on death screen (`src/hud.js`)

**Current state:** Death screen already shows summary info (time, level, loadout, surge count)

**What to add:**
1. Find the death overlay creation code in `hud.js` (look for `showDeathScreen()` or similar)
2. Add a new section that displays the kill breakdown:
   ```
   ENCOUNTERS
   Runners:      23
   Shooters:     15
   Brutes:        9
   Titans:        2
   Juggernauts:   0
   Shield Leeches: 1
   ```
3. Format it terse and uppercase to match the existing death screen style
4. Only show enemy types that had at least 1 kill (skip zeros or show them grayed out — your choice)
5. Position it below the existing summary info, maybe in a new row or section

**Implementation:**
- Access `Game.killsByType` to build the display
- Use the same styling/layout as the existing death-screen sections
- Keep it monospace and aligned for readability

### Step 3: Optional — Format helper (`src/gameUi.js`)

If the death summary gets complex, pull the formatting into a helper:
```js
function formatKillSummary(killsByType) {
  // Return a string like "Runners: 23 | Shooters: 15 | Brutes: 9"
}
```

This keeps `hud.js` clean and reusable (e.g., if you want to show kills in the records screen later).

---

## Testing the Run Summary

1. **Start a run** and survive long enough to encounter multiple enemy types
2. **Kill enemies** and watch the counts increase (verify in playtest lab if you want instant feedback)
3. **Die or quit** and check the death screen
4. **Verify** the kill breakdown appears and shows the correct counts
5. **Test zero-kill scenarios:** If you only fought Runners, the other types should either show 0 or be hidden
6. **Test late-game:** Run to high waves and confirm all six types appear and count correctly

---

## Implementation Notes

**Health bar timing (#7):**
- The change is almost certainly a single constant or timeout value
- You might need to search for `hpBar`, `health`, `visible` in `enemies.js` to find the exact spot
- Check both the individual enemy's `update()` and the render loop

**Enemy color shift (#14):**
- The enemy color is already being set per-type in the render code
- You're just brightening/saturating it post-definition
- Use `parseInt(hex, 16)` tricks or RGB component math to lighten colors
- Test on all six enemy types: Runner, Shooter, Brute, Titan, Juggernaut, Shield Leech

**Kill tracking (#1):**
- `enemy.type` must be a lowercase string that matches your object keys
- Make sure you increment *before* the enemy is removed from the array
- If there's already a `killCount++` somewhere, just add the `killsByType` increment next to it
- Verify the reset happens in `newRun()` so counts don't carry over between runs

---

## After all three are done

Run the full update checklist from CLAUDE.md:
1. `npm run lint`
2. `npm run check`
3. `npm run build`
4. `npm run verify`
5. Drag `dist/` → Netlify
6. `npx cap sync`
7. Play in Android Studio (optional)
8. Commit with a clear message: `"Add enemy strength visuals, extend health bar visibility, and track kill-by-type breakdown on death screen"`

**Update CLAUDE.md:**
- Add a new changelog entry describing all three changes
- Format: `- YYYY-MM-DD: Extended health bar visibility to 2s, added wave-based enemy color brightening, and expanded death screen with kill-by-enemy-type breakdown`
- Keep it consistent with existing entries

---

## Difficulty breakdown

- **#7 (health bars):** 1 line (timeout constant change)
- **#14 (enemy strength):** 5–10 lines (color math in render loop)
- **#1 (kill summary):** 15–30 lines (tracking object + death-screen display)

**Total implementation time:** ~2–4 hours including testing.
