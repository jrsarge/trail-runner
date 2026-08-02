# Ticket 24 — Rivals

**Depends on:** 23. Read DESIGN.md "v4 — Rivals" first.

## Why

Opponents whose job is to **bait you into overcooking**. Pace-target CPUs only measure the
player; bait rivals weaponise the mistake the game is built around by making it socially
tempting.

Ships with rivals as **recoloured squares** — animal shapes are ticket 25. That way the
mechanic can be playtested before any art exists, and if the pacing plans are wrong you find
out cheaply.

## 1. Pacing plans

`src/plans.js` — each plan is a pure function returning a target lean offset above ideal:

```js
plan(progress, terrain) -> targetOffsetDeg
// progress: s / path.length, 0..1
// terrain:  { slopeSigned, technical }
```

Reading terrain, not just progress, is what makes specialists possible — a rival strong on
climbs and ordinary on the flat is far more interesting than one uniformly faster.

| Plan | Line |
| --- | --- |
| `rabbit` | max offset from the gun; blows up around 50-60% and runs bonked thereafter |
| `overreach` | a few degrees above sustainable; bonks around 85% — the cruellest, because matching *almost* works |
| `surger` | oscillates between hard and easy on a fixed distance period |
| `metronome` | the sustainable optimum; never bonks |
| `closer` | conserves early, spends hard in the last third |

Sustainable offsets measured in ticket 16: **+15.9°** (alpine), **+21.3°** (summit). Derive
each plan's numbers from the course's own sustainable level rather than hardcoding degrees,
or the plans will not transfer between courses.

`AiController` in `controllers.js` converts a target offset into the same
`{ lean: -1 | 0 | +1 }` the player controller emits — steer toward the target, do not write
lean directly. Rivals must go through the identical locomotion path.

## 2. Three rules that are not negotiable

- **Identical stamina model.** No cheating, no bigger tank, no reduced drain. A rival's
  blow-up must be a real consequence of its own line.
- **No rubber-banding.** A rival that adapts to the player is not demonstrating a mistake;
  the teaching effect evaporates and the bait becomes a lie.
- **Deterministic.** Same plan, same course, same blow-up point every run — that is what
  makes a course learnable. Any randomness must be seeded per course, not per run.

## 3. Roles are course data

**The animal must not telegraph the plan.** Each course assigns its own pairs, fixed for
that course:

```js
summit.rivals = [
  { shape: 'tortoise', plan: 'metronome', palette: {...} },
  { shape: 'hare',     plan: 'closer',    palette: {...} },
];
```

Ticket 25 consumes `shape`; for now every rival renders as the existing two-square runner in
its own palette. Give each course 3-4 rivals with **different** plans — including at least
one that bonks visibly ahead of the player, since that is the whole point.

## 4. Integration

- `race.js` already holds a racer array with one flagged player — add rivals to it.
- Camera and HUD follow the **player**, never a rival.
- Finish: the race ends when the *player* finishes. Record each rival's finish time and
  the player's placing.
- The progress strip (23) shows every racer; the player's marker stays distinct.
- Rivals kick up dust like the player (`racer.js` already passes a `dust` pool through).

## Acceptance criteria

- On summit, report each rival's finish time and where it bonked, plus the player's placing
  for a sustained-effort run.
- **The rabbit visibly leads early and is visibly reeled in after blowing up** — screenshot
  the strip at ~30% and ~70% showing the order change. This is the ticket's headline.
- Two identical player runs produce identical rival times. Determinism, verified.
- No rival finishes with an impossible time — cross-check the winner against ticket 16's
  best-sustained figures (alpine 20.95 s, summit 86.42 s). A rival beating those means it is
  cheating somewhere.
- All racers visible and distinguishable on the progress strip.
- Frame rate holds with 4-5 racers; confirm the dust pool is still fixed-size.
- `npm test` 8/8, `npm run build` clean, no console errors across a full race and restart.

## Out of scope

Animal shapes (25), post-race graph (26). Do not add difficulty settings — the roster *is*
the difficulty. Do not warn the player mid-race that a rival is unsustainable; failure is
meant to teach retrospectively.
