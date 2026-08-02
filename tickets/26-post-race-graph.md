# Ticket 26 — Post-race stamina graph

**Depends on:** 24. Last ticket of v4.

## Why

The design deliberately gives **no mid-race warning** that you are overspending — the player
is meant to fail a course several times and close in on it. That only works if failure is
legible **afterwards**. Right now the finish card gives a time and nothing else, so a bonk at
60% teaches nothing: was it the grind, or the surge you chased thirty seconds earlier?

This is the ticket that makes each failure teach something, without telegraphing anything
live.

## Spec

An SVG line chart on the finish card.

**Axes: stamina remaining (y) against DISTANCE along the course (x).** Not time — distance
makes runs directly comparable regardless of how long each took, and it is the axis the
player's course knowledge is organised around.

Lines to draw:

| Line | Why |
| --- | --- |
| **This run** | the subject |
| **Your best run** | the gap between them is the lesson — "I was 20 points down entering the stack" |
| **The winner's run**, if a rival beat you | "the tortoise was at 40% here and I was at 10%" — the whole insight in one glance |

Plus:

- **Course sections shaded as background bands** (reuse the progress strip's section data
  from ticket 23). This turns "I bonked at 500 m" into "I bonked *on the grind*", which is
  the actionable version.
- **A marker at each bonk point.**

## Sampling

Record **by distance, not per frame**: sample stamina every `GRAPH.SAMPLE_METRES` (4 m), so
the series is a fixed size regardless of race duration and two runs are directly comparable
index-for-index. Roughly 200 points for summit, 50 for alpine — trivial to store.

Persist the best run's series alongside its time in `localStorage`, under the existing
per-course key scheme. **Wrap it in the same try/catch guard** — a stored series must never
break the finish card, and a missing one just means no comparison line.

Watch the storage size: a 200-point series of rounded numbers is fine, but do not store raw
floats per frame.

## Constants

```js
export const GRAPH = { SAMPLE_METRES: 4, WIDTH: 320, HEIGHT: 140 };
```

## Acceptance criteria

- Finish a race and screenshot the card: the graph shows your line, correctly shaped —
  monotonically decreasing, since stamina never rises.
- Run again and finish slower: the best-run line appears, and the two are visually
  distinguishable.
- Lose to a rival: the winner's line appears and is distinguishable from both.
- First-ever run on a course shows just your line, no comparison, and does not error.
- The bonk marker lands where the bar actually hit zero — cross-check against the distance
  the HUD showed at the bonk.
- Section bands line up with the real course sections; confirm the stack band matches
  `path.ledgeRanges()`.
- **Stub `localStorage` to throw and confirm the finish card still renders** with just the
  current run. Same failure mode ticket 15 guarded — a saved series must not become a new
  way to crash.
- `npm test` 8/8, `npm run build` clean, no console errors.

## Out of scope

Splits, sector times, replay/ghost playback, sharing. Do not add live in-race charting —
the whole point is that this is retrospective.
