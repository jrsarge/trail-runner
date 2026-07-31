# Ticket 10 — Variable speed foundation

**Depends on:** 09, verified at 0:27.23 before you start.

## Goal

Rip out the manual hop and make speed a per-frame quantity instead of a constant. No lean
yet — this is the plumbing that ticket 11 plugs into.

**This ticket legitimately changes the finish time.** 27.23 s is no longer the target and
old ticket 07's "≈27 s" criterion is retired.

## 1. Remove the manual hop

The clean version of the design: hopping is the gait, always automatic. The player never
triggers a hop.

- Delete the big hop entirely: `HOP.BIG_DIST`, `HOP.BIG_APEX`, `LAND_SQUASH`, the
  mid-air-ignore logic, and `requestHop()` as a gameplay input.
- Space / ArrowUp / click no longer hop. `pointerdown` and Space remain **start and restart
  only** (READY → countdown, FINISHED → restart). Do not leave a dead listener that fires
  during RUNNING.
- The gait hop now runs continuously, forever, with no size variation.

## 2. Drive the gait hop by arc length, not time

Currently `u = elapsed / (dist / RUN_SPEED)`. With variable speed that goes wrong the moment
speed changes mid-hop. Replace with:

```js
u = (s - s0) / HOP.GAIT_DIST;      // s0 = arc length at takeoff
```

Chord and parabola are otherwise unchanged (DESIGN.md, "Motion model"). When `u >= 1`, land
and immediately begin the next hop from the new `s`. This one change is what makes variable
speed free everywhere else — no other code needs to care.

## 3. Speed becomes a function

```js
gradeFactor = clamp(1 - SPEED.GRADE_DRAG * Math.sin(slopeSigned),
                    SPEED.MIN_FACTOR, SPEED.MAX_FACTOR);
speed = SPEED.BASE * gradeFactor;          // ticket 11 adds the commit term
s += speed * dt;
```

`slopeSigned` is the **signed** slope angle in the travel frame — positive climbing,
negative descending. `Math.atan2(d.y, Math.abs(d.x))` from the unit tangent. Do **not** use
`Math.abs()` on the result; ticket 12 depends on the sign.

Expose `racer.speed` and `racer.slopeSigned` for the HUD, camera, and ticket 11.

Replace `RUN_SPEED` with the `SPEED` group:

```js
export const SPEED = {
  BASE: 7.0,
  GRADE_DRAG: 0.5,
  MIN_FACTOR: 0.8,
  MAX_FACTOR: 1.2,
  COMMIT_BONUS: 0.35,   // unused until ticket 11
};
```

## Acceptance criteria

- The runner completes the course with a continuous automatic gait, no input required.
- Pressing Space or clicking mid-race does **nothing** — no hop, no console error.
- Space/click from READY still starts the race; from FINISHED still restarts.
- **Speed visibly varies with terrain**: slower up the climb, faster down the descent. The
  finish time lands somewhere near 26–29 s (it will not be 27.23 and should not be).
- The gait arc still looks correct where speed changes fastest — the crest of the climb and
  the switchback folds. No stutter, no hop that visibly stretches or snaps.
- Feet stay on the trail throughout. `npm test` 8/8. No console errors.

## Out of scope

Lean, trip, stumble, wobble, camera changes, HUD changes.
