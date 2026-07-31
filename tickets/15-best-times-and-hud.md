# Ticket 15 — Best times, HUD update, and the lean tutorial

**Depends on:** 12, 14.

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
| dist | `123 / 191 m` | as now |
| elev | `↑ 18 / 28 m` | as now |
| **pace** | `7.4 m/s` | new — pace varies now, and this is the feedback that leaning forward is working |
| **best** | `0:25.81` or `—` | new |

Keep `tabular-nums` so nothing jitters. Pace should be lightly smoothed (~0.2 s) or the last
digit will be unreadable noise.

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
export const STORAGE = { BEST_PREFIX: 'trailhop.best.', TAUGHT: 'trailhop.taught' };
```

## Acceptance criteria

- First ever run (clear localStorage first): tutorial prompt appears, fades once you lean,
  finish card shows a time and **no** delta, best row goes from `—` to that time.
- Second run: no tutorial prompt. Beat the time → `NEW BEST` and a negative delta. Lose to
  it → positive delta and the stored best is unchanged.
- Reload the page: best time persists.
- Pace readout tracks reality — rises leaning forward, drops on the climb, collapses during
  a stumble.
- Distance still ends at 191 m and elevation at 28 m.
- **Disable localStorage** (private window, or stub it to throw) and confirm the game still
  runs start to finish with best showing `—` and no console errors. This is the most likely
  crash in this ticket.
- `npm test` 8/8.

## Out of scope

Leaderboards, splits, ghosts, per-section times, sound.
