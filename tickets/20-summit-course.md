# Ticket 20 — "Summit Traverse", the long course

**Depends on:** 19.

## Why

Pacing is worth under a second on the 190 m alpine course, and ~3.5% is a structural
ceiling that no tuning moves (ticket 16). Stamina needs a race long enough for spending
decisions to compound. This is that race.

## The course

`src/courses/summit.js` — `{ id: 'summit', name: 'Summit Traverse', start: {x:0,y:0},
segments, backdrop }`, authored with ticket 19's blocks.

Rolling, with a summit finish. Measured with the real path builder:

| | |
| --- | --- |
| length | **~825 m** (alpine: 190.6) |
| elevation gain | **~132 m** (alpine: 28.4) |
| y range | **−14 … 85.4** |
| x range | 0 … 741 |
| est. time | **~118 s** at 7 m/s |

### Profile

| # | Block | To | Purpose | `technical` |
| --- | --- | --- | --- | --- |
| 1 | `flat` | `(25, 0)` | settle in | 1.0 |
| 2 | `rollers` | `+140, +8`, 4 undulations, amp 3.0 | small spend-or-save decisions | 1.0 |
| 3 | `descent` | `(235, −14)` | **steep technical descent** — fast, cheap, tempts overspending | 1.5 |
| 4 | `rollers` | `+100, +5`, 3 undulations, amp 2.5 | recover the rhythm | 1.0 |
| 5 | `climb` | `(555, 53)` | **THE GRIND** — 220 m of sustained climb, ~16°. The centrepiece. | 1.0 |
| 6 | `flat` | `(590, 55)` | **false summit** — it eases, and you think you're done | 1.0 |
| 7 | `climb` | `(670, 80)` | …and it keeps going, ~17° | 1.0 |
| 8 | `descent` | `(715, 68)` | relief before the finish | 1.25 |
| 9 | `switchbacks` | 5 legs, run 16, rise 3.4, from `(715, 68)` | the climax, to `(731, 85.0)` | 1.6 |
| 10 | `flat` | `(741, 85.4)` | finish spur | 1.0 |

Blocks 5–7 are the point of the course: ~340 m of near-continuous climbing with a false
summit in the middle. Spending the tank on the grind leaves nothing for the second pitch,
and nothing at all for the switchbacks.

**Leg vertical spacing is 3.4 m**, comfortably over runner height (1.55) + gait apex (0.22).
Do not reduce it below 2.5.

### Backdrop

Author a new one — alpine's is positioned for x ∈ [−150, 400] with a mountain silhouette at
x ∈ [76, 132], and would run out entirely. The new course spans x ∈ [0, 741], y ∈ [−14, 85].

- Two sawtooth ridgelines spanning at least x ∈ [−200, 1000], with the near ridge rising
  across the course so the world reads as climbing.
- A mountain silhouette behind the switchback stack around x ∈ [690, 780].
- Decorative only — no geometric relationship to the path. Do not try to make it contain
  anything.

## Course selection

`DEFAULT_COURSE` becomes `summit`. Keep `alpine` in the registry — it stays useful as a
quick-iteration course and as the control for the ticket 19 golden check.

Allow `?course=alpine` in the URL to select one, falling back to the default on an unknown
id. Two lines, and it makes A/B testing pacing trivial.

## Acceptance criteria

- Course builds; report **length, elevation gain, and y range** and compare against the
  table above. Within ~2% is fine; materially off means a transcription error.
- A full race completes in roughly **110–125 s** at a moderate lean, and the runner's feet
  stay on the trail the whole way.
- **Ground and sky are correct at both extremes** — no sky beneath the floor at the y = −14
  low point, no missing sky at the y = 85 summit. This is what ticket 19's derived bounds
  are for; verify it here on the course that actually exercises them.
- All five switchback ledges read as distinct banked ledges, and the camera pull-back
  triggers on the stack via `ledgeRanges()`.
- The parallax ridges never run out of geometry anywhere along x ∈ [0, 741] — scrub the
  whole course and check both ends.
- `?course=alpine` still loads and plays the old course correctly.
- `npm test` 8/8, `npm run build` clean, no console errors across a full 2-minute race.

## Report

Beyond pass/fail, report **whether pacing now matters**: run your best uniform-lean line and
your best paced line (conserve the grind, spend the descent and rollers) and give both
times. On alpine the gap was 0.68 s / 2.6%. If it hasn't grown substantially here, that is
the single most important finding in this ticket — say so plainly.

## Out of scope

Camera (14), HUD (15), balance tuning (16). Do not retune stamina constants here — a longer
course will need different ones, but that is ticket 16's job with both courses in hand.
Do not delete or modify alpine.
