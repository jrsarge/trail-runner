# Ticket 15 — Best times, HUD update, and the lean tutorial

**Depends on:** 18 and 14. (Execution order is 17 → 18 → 14 → 15 → 16 — this must come
after 18 so the stamina meter gets built once.)

## Goal

Give the player a reason to run it again, feedback on how they're doing, and thirty seconds
of teaching so the mechanic isn't a mystery on the first run.

## 1. Best time in localStorage

- Key: `trailhop.best.<courseId>` — per course, since the registry exists.
- Store milliseconds as a number. Guard the whole thing: `localStorage` throws in private
  browsing and on some embedded webviews. **Wrap reads and writes in try/catch** and degrade
  to "no best time recorded" rather than breaking the race.
- Ignore times recorded before the run finished; only a genuine FINISH writes.

## 2. HUD

Stat block gains two rows:

| Stat | Format | Notes |
| --- | --- | --- |
| time | `M:SS.CC` | as now |
| dist | `412 / 826 m` | as now |
| elev | `↑ 61 / 132 m` | as now |
| **pace** | `7.4 m/s` | new — pace varies now, and this is the feedback that leaning forward is working |
| **best** | `0:25.81` or `—` | new |

Keep `tabular-nums` so nothing jitters. Pace should be lightly smoothed (~0.2 s) or the last
digit will be unreadable noise.

## 2b. The stamina meter (v3)

A budget cannot be read from a pose the way balance can, so this one **does** get a UI
element — the only one in the game. Keep it minimal:

- A single thin horizontal bar, directly under the stat block. No numbers, no percentage,
  no segments.
- Fills from `locomotion.staminaFraction`. It only ever shrinks — do not animate it as if it
  could refill.
- Shifts to a warning tone below `STAMINA.TIRED_FRACTION`, and reads clearly as empty at
  zero. Colour is the only state it needs; do not add text.
- The character's own posture/gait tell (ticket 18) carries part of the information. The bar
  is the precision; the runner is the feel. Do not let the bar become the whole readout.

### It must show burn *rate*, not just level

The wobble is slated for removal — playtested as annoying, same verdict as the stumble
(DESIGN.md "Telegraphing"). Once it goes, **this bar is the only feedback that effort costs
anything.** Level alone doesn't cover it: it tells you how much is left, never how fast
you're spending it, so there'd be nothing to connect leaning harder to paying more.

Add a **burn zone**: a brighter band at the depleting edge of the bar, whose width is the
stamina that would drain over the next `HUD.BURN_LOOKAHEAD` seconds (5) at the *current*
rate. Ease its width (~0.2 s) so it reads as a band, not a jitter.

- Easing off → the band nearly vanishes.
- Sustainable effort → a modest, steady band.
- Overcooking → a wide band visibly eating into the bar.

That is the wobble's job — "this is costing you" — moved somewhere it can't be annoying,
and it answers the question the player actually has: *can I hold this to the line?*

Show it in READY too, full, so the player knows it exists before it starts draining.

**Finish card** gains a delta against the best: `−1.42` in a positive color when faster,
`+0.87` when slower, and a **`NEW BEST`** flourish when beaten. First-ever run shows the
time with no delta.

## 3. Lean tutorial on the flat start

The flat 20 m opening was dead time in v1 and is now the natural place to teach:

- During the first `TUTORIAL.DISTANCE` (18 m) of a run, show a prompt: `← → to lean`.
- Fade it out once the player has held a lean for `TUTORIAL.SATISFIED_TIME` (0.6 s
  cumulative), or when the distance is passed, whichever comes first.
- Show it only until the player has finished a race once — persist a
  `trailhop.taught` flag in localStorage (same try/catch guard).

Keep it to one line of text. No arrows-diagram, no modal, nothing that blocks the start.

## Constants

```js
export const TUTORIAL = { DISTANCE: 18, SATISFIED_TIME: 0.6 };
export const HUD = { BURN_LOOKAHEAD: 5.0, BURN_EASE_TIME: 0.2, PACE_SMOOTH_TIME: 0.2 };
export const STORAGE = { BEST_PREFIX: 'trailhop.best.', TAUGHT: 'trailhop.taught' };
```

## Acceptance criteria

- First ever run (clear localStorage first): tutorial prompt appears, fades once you lean,
  finish card shows a time and **no** delta, best row goes from `—` to that time.
- Second run: no tutorial prompt. Beat the time → `NEW BEST` and a negative delta. Lose to
  it → positive delta and the stored best is unchanged.
- Reload the page: best time persists.
- Pace readout tracks reality — rises leaning forward, drops on the climb.
- The stamina bar drains visibly faster on the climb than on the descent at the same lean,
  and **never grows**, at any lean, in any state.
- **The burn zone tracks effort**: nearly gone when easing off, modest at a sustainable
  lean, wide and obvious at maximum lean. Check all three by eye — this is the feedback that
  replaces the wobble, so it has to be legible without being twitchy.
- The bar reads as empty at a bonk, and the runner's own posture/gait tell is noticeable
  before the bar runs out.
- Distance and elevation still end at the course totals (summit 826 m / 132 m;
  alpine 191 m / 28 m via `?course=alpine`).
- **Disable localStorage** (private window, or stub it to throw) and confirm the game still
  runs start to finish with best showing `—` and no console errors. This is the most likely
  crash in this ticket.
- `npm test` 8/8.

## Out of scope

Leaderboards, splits, ghosts, per-section times, sound.
