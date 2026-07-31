# Ticket 05 — Locomotion, hopping, and input

**Depends on:** 04.

## Goal

The runner runs the course start to finish at a constant pace, trotting in small automatic
hops, and leaps in a big arc when the player presses the button.

## Files

- `src/locomotion.js` — exports `createLocomotion(path, runner)`.
- `src/main.js` — wire input and call `locomotion.update(dt)`.

## Read this before writing code

**No physics. No gravity integration. No collision detection.** Arc length advances at a
constant rate and a hop is a parametric arc over the chord between takeoff and landing:

```js
s += RUN_SPEED * dt;                        // constant. Always. Never modulated.

// during a hop that started at s0 and covers `dist` with apex `apex`:
const u = clamp01(elapsed / (dist / RUN_SPEED));
const a = path.pointAt(s0), b = path.pointAt(s0 + dist);
const chordY = a.y + (b.y - a.y) * u;
const y = chordY + apex * 4 * u * (1 - u);  // parabola, zero at u=0 and u=1
```

The runner's x follows `path.pointAt(s)` as usual; only y is overridden while airborne.
Feed the result to `runner.setGroundS(s)` / `runner.setHopOffset(...)` — the offset being
`y - path.pointAt(s).y`.

Why parametric: it reads as a real arc uphill, downhill, and on the leftward legs, needs no
collision detection, and **can never miss a landing**. That last part is the point — the
locked design has no fail state.

## Two hop sizes, one code path

| | distance | apex | trigger |
| --- | --- | --- | --- |
| gait hop | 1.6 | 0.22 | automatic, loops forever |
| big hop | 3.5 | 0.9 | Space / click / tap |

- The gait hop is the trot — "they just kind of hop." When one gait hop ends the next begins
  immediately, so the runner is always in a small arc.
- A big hop **replaces** the current hop: on press, start a big hop from the current `s`.
- **A press while already in a big hop is ignored.** No input buffering, no double hop, no
  queued hops in the POC.
- Add a small squash on landing: `runner.setHopOffset(dy, squash)` where `squash` eases from
  `HOP.LAND_SQUASH` (0.18) back to 0 over `HOP.LAND_SQUASH_TIME` (0.12 s) after a big hop
  lands. Apply it as a y-scale on the body only, feet pinned.

## Input

- `keydown` Space **and** ArrowUp → hop. `event.preventDefault()` on Space so the page
  doesn't scroll.
- `pointerdown` anywhere on the canvas → hop (covers mouse, touch, trackpad).
- Ignore key repeat (`event.repeat`).
- Input is routed through a single `requestHop()` function; ticket 07 will gate it by race
  state, so keep that entry point clean and side-effect-free besides starting a hop.

## Reaching the end

When `s >= path.length`, clamp `s` to `path.length` and stop advancing. Expose
`locomotion.isFinished` and `locomotion.s`. Do not implement the timer or the finish card
here — ticket 07 owns race state and will read these.

## Constants to add

```js
export const RUN_SPEED = 7.0;               // m/s, constant

export const HOP = {
  GAIT_DIST: 1.6, GAIT_APEX: 0.22,
  BIG_DIST: 3.5,  BIG_APEX: 0.9,
  LAND_SQUASH: 0.18, LAND_SQUASH_TIME: 0.12,
};
```

## Acceptance criteria

In the browser:

- The runner travels from the start line to the finish banner on its own, at a **visibly
  constant pace** — it does not speed up on the descent or bog down on the climb. (Constant
  pace is the locked decision, not an oversight.)
- Left to itself, the runner trots in continuous small hops the entire way.
- Space produces an obviously bigger, longer arc that lands back on the trail. It works
  identically on the flat, on the climb, on the descent, and on the leftward switchback legs.
- **At mid-leg on a switchback, a big hop stays clear of the ledge above.** Hold Space
  repeatedly through the whole stack and watch for it.

  **Near a fold, overlapping the ledge above is expected — do not treat it as a bug.**
  Consecutive legs converge to a 0 m gap at the fold (see DESIGN.md, constraint 1), so
  overlap there is geometrically unavoidable. Z-order handles it: the runner draws in front
  of the hillside and reads as passing in front of the slope. Do not "fix" this by changing
  the course table or shrinking the hop.
- Mashing Space does not stack hops, launch the runner, or desync it from the trail.
- One full run takes roughly **27 s** (190.6 m at 7 m/s).
- Space does not scroll the page. Clicking the canvas hops.

## Out of scope

Timer, HUD, camera, dust particles, any speed or momentum model, obstacles.
