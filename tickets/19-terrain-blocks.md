# Ticket 19 — Terrain blocks and course-derived world bounds

**Depends on:** 18. Prerequisite for ticket 20 (the long course).

## Why

Ticket 16's measurements showed pacing is worth under a second on the 190 m course, and
that ~3.5% is a structural ceiling no tuning moves. The course, not the tuning, is the
limit. Ticket 20 builds an ~825 m course — but three things in the codebase assume the
alpine course's specific shape and would silently break. Fix them first, with alpine still
in place as the control.

**No player-visible change in this ticket.** Alpine must play identically when you're done.

## 1. Terrain blocks

`src/courses/blocks.js` — a small vocabulary that emits segments in the existing format
(`{ type, to, samples?, technical?, ... }`) given a running cursor. A course becomes a short
readable recipe instead of a wall of coordinates.

```js
flat(cursor, { x, y, technical })
climb(cursor, { x, y, samples, technical })          // smoothstep S-curve
descent(cursor, { x, y, samples, technical })        // same, downward
rollers(cursor, { dx, dy, count, amp, technical })   // `count` undulations, net rise dy
switchbacks(cursor, { legs, run, rise, technical })  // alternating direction, marks ledges
```

`rollers` emits `count * 2` smooth segments alternating a `+amp` bump against a linear base
from the current point to `+dx, +dy`. `switchbacks` emits `legs` alternating-direction
segments and **marks each with `ledge: true`** (see §2).

Blocks are pure functions returning segment arrays — no three.js, no globals — so ticket
20's course and the tests can both use them.

## 2. Replace `firstLegIndex` with a per-segment flag

`world.js` (ground bed banking) and `cameraRig.js` (the STACK pull-back) both call
`path.segmentStartS(course.firstLegIndex)`. That hardcodes "the stack is segment 3", which
is only true for alpine. The long course's stack is at a different index, and a future
course could have two stacks.

Mark ledge segments with `ledge: true` and derive what's needed from the path:

- `path.ledgeRanges()` → array of `{ startS, endS }` for contiguous runs of ledge segments.
- `world.js` banks the bed over those ranges (blending in over `WORLD.BED_BLEND` as now).
- `cameraRig.js` enters its pull-back approaching any ledge range and returns to normal
  FOLLOW after leaving one.

Delete `firstLegIndex` from the course objects once nothing reads it.

## 3. World bounds must derive from the course — this one is a real bug waiting

`WORLD.FLOOR_Y` is a global `-12` and the sky quad is a global `y ∈ [-40, 80]`. The long
course dips to **y = -14** and summits at **y = 85.4**. As written, the trail would run
*below the ground floor* and off the top of the sky quad.

Derive both from the course's actual point range at build time:

```js
floorY = minY - WORLD.FLOOR_MARGIN;     // must clear the camera's lowest view
skyY0  = minY - WORLD.SKY_MARGIN;
skyY1  = maxY + WORLD.SKY_MARGIN;
skyX0  = minX - WORLD.SKY_MARGIN;
skyX1  = maxX + WORLD.SKY_MARGIN;
```

`FLOOR_MARGIN` must exceed the camera's half-height plus lookahead, or sky shows under the
ground at the lowest point — the exact bug fixed once already in ticket 03. `SKY_MARGIN`
should be generous (100+); the quad is one untextured mesh and costs nothing.

Replace the fixed `FLOOR_Y` / `SKY_*` constants with these margins.

## 4. Rebuild alpine on blocks

Express the existing course as block calls. This is the ticket's correctness gate.

## Acceptance criteria

- **Alpine, rebuilt from blocks, produces a path of length `190.6311` and exactly 4 filleted
  corners** — identical to today. Print both and compare. Any drift means the blocks emit
  different segments than the hand table, and that must be fixed rather than accepted.
- `npm test` 8/8 — the existing tests read the alpine course and must pass untouched.
- Alpine looks and plays exactly as before: five banked ledges, camera pull-back on the
  stack, ground solid under the rolling hills, no sky beneath the floor at the start line.
- `ledgeRanges()` returns exactly one range for alpine, covering the five legs.
- A throwaway course dipping to y = −30 and summiting at y = +90 builds with correct floor
  and sky (verify by temporarily pointing the default at it, then revert).
- `npm run build` clean, no console errors.

## Out of scope

The long course itself (20), camera (14), HUD (15), tuning (16). Do not change alpine's
geometry, its `technical` values, or any gameplay constant.
