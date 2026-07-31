# Trail Hop — Proof of Concept

A 2D side-view trail running game in three.js. One short race: flat start, up a hill,
down a hill, up a switchback stack, finish line at the top.

## Decisions (locked)

| Question | Answer |
| --- | --- |
| Controls | **One-button hop.** Space / click / tap. Fixed height. Constant pace. |
| Switchbacks | **True zig-zag.** Runner reverses and runs left on alternating legs. |
| Stakes | **No fail state.** Timer only. You cannot miss, fall, or die. |
| Terrain | **Continuous ground line.** No gaps, no rocks, no obstacles. |
| Character | Two squares: small square head above a larger square body. No limbs. |
| Stack | Vite + three.js, ES modules, `MeshBasicMaterial` only, **no lights**. |

### Open design question (do not resolve in the POC)

Because pace is constant and the hop can't be missed, **the hop button is currently the
gait, not a skill check.** Pressing it produces a big, satisfying leap instead of the
default trot, but it cannot make you faster or slower. That is what was asked for and it
is the right POC scope — it proves out terrain, motion, camera, and feel.

If the game should reward *skill*, that's the next design decision, and it's the user's
call. The likely candidates: rhythm/momentum (chain hops on landing for speed), obstacles
to clear, or stamina spent on climbs. Do not build any of these yet.

## World

Units are meters. Y is up. The runner is 1.55 m tall. The camera is orthographic.

### Canonical course

**This is the single source of truth for course geometry.** Only `src/course.js` may
contain these numbers. Every other module reads the built path.

Path starts at `(0, 0)`. Each segment names its end point.

| # | Type | End point | Meaning |
| --- | --- | --- | --- |
| 1 | `flat` | `(20, 0.0)` | start straight |
| 2 | `smooth` | `(60, 12.0)` | the climb (smoothstep S-curve, 24 samples) |
| 3 | `smooth` | `(95, 4.0)` | the descent (smoothstep S-curve, 20 samples) |
| 4 | `leg` | `(113, 7.2)` | switchback 1 → right |
| 5 | `leg` | `(95, 10.4)` | switchback 2 → **left** |
| 6 | `leg` | `(113, 13.6)` | switchback 3 → right |
| 7 | `leg` | `(95, 16.8)` | switchback 4 → **left** |
| 8 | `leg` | `(113, 20.0)` | switchback 5 → right |
| 9 | `flat` | `(120, 20.4)` | finish spur; the finish line is the path end |

Derived, for reference (compute at runtime, never hardcode):

- Total path length ≈ **190.6 m** (196.6 before corner fillets) → ≈ **27 s** at 7 m/s.
- Elevation gain = 12.0 + 16.4 = **28.4 m**.
- Exactly **4 corners** get filleted — the 4 interior switchback reversals. The valley at
  `(95, 4)` and the summit at `(113, 20)` are gentle enough to stay sharp. If your build
  fillets a different number of corners, the turn-angle test is wrong.
- Switchback stack occupies x ∈ [95, 113] (center **104**), y ∈ [4, 20.4].
- Leg vertical spacing = **3.2 m**.

`smooth` segments interpolate x linearly and y by smoothstep, so hills are flat at the
bottom and top and steepest in the middle. `flat` and `leg` segments are straight lines.

### Two geometry constraints that must hold

1. **Mid-leg hop clearance.** Runner height (1.55) + hop apex (0.9) = 2.45 must stay under
   the leg spacing (3.2). Margin: 0.75 m. If you raise `HOP_APEX` or the runner's height,
   raise the leg rise too.

   **This is a mid-leg guarantee only.** Consecutive legs are not 3.2 m apart everywhere —
   they fold together. For legs 1 and 2, the vertical gap at a given x is
   `3.2 + 0.1778·(208 − 2x)`: **6.4 m at x = 95** and **exactly 0 at x = 113**, the fold
   itself. Every switchback converges like this; it's unavoidable in a zig-zag.

   So near a fold the runner *will* overlap the ledge above, and that is fine and expected:
   `Z.RUNNER` (1) sits in front of `Z.BED` (0), so the runner draws over the hillside and
   reads as passing in front of the slope — correct for a flat layered scene. Do not try to
   eliminate near-fold overlap by changing the course table.
2. **Corner facing.** `sign(tangent.x)` is undefined exactly at a sharp vertex. Two
   mitigations, both required: sharp vertices are **filleted** in the path itself
   (`CORNER_RADIUS`), and facing is tracked with a **deadband plus hysteresis** (see
   ticket 05). A one-frame facing snap reads as a glitch.

### Rendering the ground (the non-obvious part)

Switchback legs overlap in x. A naive "fill from the trail down to the floor" would make
each leg's fill cover the trail ribbon of the leg below it. So the ground bed is built
per-path-point with a variable bottom:

- Before the switchback stack: bottom = `FLOOR_Y` (solid ground under the rolling hills).
- On the stack: bottom = `pathY - BED_THICKNESS` (2.2 m banked ledges, less than the
  3.2 m leg spacing, so the leg below stays visible).
- Blend between the two over ~3 m of arc length so there's no hard step.

A purely decorative mountain silhouette sits behind the stack at a lower render order to
fill the 1 m gaps between ledges. It is authored by hand and has **no** geometric
relationship to the course — do not try to make it contain the path.

Render order: backdrop (−2, −1) → ground bed (1) → trail ribbon (2) → runner (3).

## Motion model

No physics engine, no collision detection, no gravity integration. The runner's ground
position is always exactly on the path, parameterized by arc length `s`:

```
s += RUN_SPEED * dt          // constant, always
ground = path.pointAt(s)
```

A hop is a **parametric arc over the chord**, not a ballistic simulation:

```
hop from s0 to s0 + hopDistance over duration = hopDistance / RUN_SPEED
u = elapsed / duration                       // 0 → 1
chord = lerp(path.pointAt(s0), path.pointAt(s0 + hopDistance), u)
y = chord.y + apex * 4 * u * (1 - u)         // parabola, 0 at both ends
```

This reads as a real arc uphill, downhill, and flat, needs zero collision detection, and
can never miss a landing. That is deliberate — see the no-fail decision.

Two hop sizes, same code path:

- **Gait hop** (automatic, always looping): distance 1.6, apex 0.22. This is the trot —
  "they just kind of hop."
- **Big hop** (Space): distance 3.5, apex 0.9. Overrides the gait. Cannot be re-triggered
  mid-air; a press during a hop is ignored (no buffering in the POC).

## Camera

Two shots, blended. The switchback climb is the money shot and a tight follow ruins it.

- **FOLLOW** — center on the runner + `LOOKAHEAD * facing`, `halfHeight = 9`.
- **STACK** — static wide shot of the whole switchback stack: center `(104, 12.5)`,
  `halfHeight = 11`. Entered when `s >= sStackStart - 6`, blended over 1.2 s, then **held
  through the finish**. You watch the runner work up the zig-zag.

Orthographic width follows the viewport aspect ratio.

## Race flow

`READY` → `COUNTDOWN` (3 / 2 / 1 / GO, 0.6 s each) → `RUNNING` → `FINISHED`

Timer starts on GO, stops at the path end. HUD shows elapsed time, distance, elevation
gain. Finish card shows the final time and `R` to run again.

## Module map

```
index.html
src/
  main.js         bootstrap, fixed-timestep loop, wiring
  constants.js    ALL tuning numbers. Nothing tunable lives anywhere else.
  course.js       the canonical segment table above
  trailPath.js    polyline + fillets + arc-length parameterization  ← unit tested
  world.js        ground bed, trail ribbon, backdrop, start/finish markers
  runner.js       two-square mesh, facing flip, hop state
  cameraRig.js    FOLLOW / STACK shots and the blend
  race.js         state machine, timer
  hud.js          DOM overlay
test/
  trailPath.test.js   node --test, no test deps
```

## Ticket order

01 → 02 → 03 → 04 → 05 → 06 → 07 → 08. Each ticket is browser-verifiable on its own,
except 02 which is verified by unit tests.
