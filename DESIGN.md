# Trail Hop — Design

A 2D side-view trail running game in three.js. One short race: flat start, up a hill, down
a hill, up a switchback stack, finish line at the top.

**Status: v1 (proof of concept) is built and playable. v2 is specified below and is what
tickets 09–16 implement.**

---

# v2 — Lean is the game

## The core mechanic

The player does not control *when* to hop. Hopping is the gait, automatic and continuous.
The player controls **lean**, with ← and →.

The terrain demands a certain lean. Leaning *past* what it demands makes you faster, and
keeps making you faster right up until you lose it and go down. Leaning short of it is slow
but safe. **The skill is riding as close to the edge as you dare, on terrain that keeps
changing under you.**

### The single most important design rule

**The optimum must sit past safe.** If the terrain's ideal lean were both the fastest and
the safest place to be, you would find it once, hold it, and the game would be inert. So:

- Speed rises monotonically with forward lean, all the way to the trip threshold.
- Risk rises too, and the threshold narrows as terrain gets steeper or more technical.
- There is no "correct" lean to match — only an edge to crowd.

If a tuning change ever makes the safe lean also the fastest, the game is broken, however
good the numbers look.

### Uphill and downhill are different, deliberately

Slope is **signed** in the travel frame (`+` climbing, `−` descending). Do not use `abs()` —
the asymmetry is the point:

| | Lean too far forward | Lean too far back |
| --- | --- | --- |
| **Climbing** | trip — you go down | just slow. No risk. |
| **Descending** | trip — you go down | **slip out.** Heels skid, you go down. |

Descents are two-sided and therefore scarier: there is no safe passive option, you have to
commit down the fall line. This is real descending technique — leaning back is the beginner
instinct and it both brakes you and makes you slide. The backward slip threshold applies
only on descents steeper than `MARGIN.SLIP_ONSET_DEG`.

### Fairness: the threshold moves, so it must move gently

The trip threshold is a function of terrain, and this course has sharp transitions — the
hill crest, and especially the switchback folds where the grade reverses outright. An
instantly-snapping threshold produces trips the player cannot read or predict, which is the
fastest way to make this feel cheap. Three mitigations, all required:

1. **Smoothed slope.** `idealLean` is computed from slope low-passed over
   `LEAN.SLOPE_SMOOTH_TIME`, not the raw per-frame tangent.
2. **Transition grace.** When ideal lean is changing faster than
   `TRANSITION.SPIKE_DEG_PER_S`, widen the margin by `TRANSITION.GRACE_MARGIN_MULT` for
   `TRANSITION.GRACE_TIME`.
3. **Trigger dwell.** You trip only after exceeding the threshold for
   `STUMBLE.TRIGGER_TIME` (0.12 s), so a single-frame spike never takes you down.

### Telegraphing

The player must feel the edge before going over it. Past `WOBBLE.ONSET` (55% of margin) the
runner **wobbles**, amplitude scaling to `WOBBLE.MAX_DEG` at the threshold. No UI meter —
the character is the readout.

### Stumbling

Tripping is not failing. You stumble, lose about a second and a half, and keep going. The
timer is the score; there is no death and no restart-on-error.

Sequence: pitch forward, speed collapses to `STUMBLE.SKID_SPEED`, camera shakes, input
locks briefly, then you recover with lean reset to ideal and `STUMBLE.GRACE_TIME` of
widened margin so you don't instantly re-trip on the same steep ground.

## Rendered lean — read this before touching the runner's pose

There is exactly **one** body angle, and player lean **replaces** the v1 terrain-derived
tilt. Do not add them: `idealLean` already encodes the slope, so keeping the v1
`TILT_FACTOR` term as well would double-count it.

```
bodyAngleDeg = lean + wobble + stumblePitch   // all signed in the TRAVEL frame, + = forward
group.rotation.z = -degToRad(bodyAngleDeg) * flip
```

Two traps, both of which have already bitten this project once:

- **Compose in the travel frame, before the `* flip` multiply.** Lean is signed relative to
  the direction of travel, exactly as tilt was.
- **`RUNNER.TILT_MAX_DEG` was 22°, which is now far too small.** Lean reaches
  `IDEAL_MAX_DEG` (26) plus a margin of up to 14 ≈ 40°. Left at 22, the body angle stops
  responding precisely in the high-commit region where the entire game lives — and the
  symptom ("the mechanic feels dead") points nowhere near the cause. Raise it to 48 and
  leave a comment saying why.

## Speed

```
balance     = lean - idealLean
commit      = balance / margin                // 0 = at ideal, 1 = at the trip edge
gradeFactor = clamp(1 - SPEED.GRADE_DRAG * sin(slopeSigned), MIN_FACTOR, MAX_FACTOR)
speed       = SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * clamp(commit, -1, 1))
```

Two factors only. Resist adding a third — that is the point at which this becomes
untunable.

**Constant pace is dead.** v1's fixed 7 m/s was a locked decision and v2 deliberately
reverses it. Consequences: the timer becomes a real score, camera lookahead must scale with
speed, and the gait hop must be driven by **arc length, not elapsed time** (below).

## Motion model

Unchanged from v1 in kind: no physics engine, no collision detection, no gravity
integration. Arc length is the independent variable.

```
s += speed * dt          // speed now varies
ground = path.pointAt(s)
```

The gait hop is a parametric arc over the chord, **parameterized by arc length**:

```
u = (s - s0) / GAIT_DIST                      // NOT elapsed / duration
chord = lerp(pointAt(s0), pointAt(s0 + GAIT_DIST), u)
y = chord.y + GAIT_APEX * 4 * u * (1 - u)
```

Driving `u` from `s` rather than from a timer is what makes variable speed free — the arc
stays correct when speed changes mid-hop, with no special handling.

## Architecture: racers are instantiable

v1 assumed exactly one runner throughout. v2 splits a **racer** into three pieces so AI
opponents become a later feature rather than a later rewrite:

```
racer = { runner (mesh + pose), locomotion (s, speed, lean, stumble state), controller }
controller.update(dt, view) -> { lean: -1 | 0 | +1 }
```

`PlayerController` reads the keyboard. An `AiController` returning scripted lean input drops
in later with no changes to racer or race. `race.js` owns an array of racers with one
flagged as the player. **v2 ships exactly one racer** — build the shape, not the AI.

Courses likewise become a registry keyed by id rather than one canonical `COURSE`.

## Course

Geometry unchanged from v1. Path starts at `(0, 0)`; each segment names its end point.

| # | Type | End point | Meaning | `technical` |
| --- | --- | --- | --- | --- |
| 1 | `flat` | `(20, 0.0)` | start straight | 1.0 |
| 2 | `smooth` | `(60, 12.0)` | the climb (smoothstep, 24 samples) | 1.0 |
| 3 | `smooth` | `(95, 4.0)` | the descent (smoothstep, 20 samples) | 1.15 |
| 4 | `leg` | `(113, 7.2)` | switchback 1 → right | 1.6 |
| 5 | `leg` | `(95, 10.4)` | switchback 2 → **left** | 1.6 |
| 6 | `leg` | `(113, 13.6)` | switchback 3 → right | 1.6 |
| 7 | `leg` | `(95, 16.8)` | switchback 4 → **left** | 1.6 |
| 8 | `leg` | `(113, 20.0)` | switchback 5 → right | 1.6 |
| 9 | `flat` | `(120, 20.4)` | finish spur | 1.0 |

**Why `technical` exists.** Grade alone puts the tension in the wrong place: the climb is
the steepest terrain (~24°) while the switchback legs are the gentlest (~10°) — yet the
switchbacks are the visual and dramatic climax. `technical` narrows the trip margin
independently of grade, so the switchbacks play as tight, rocky, committing terrain despite
a shallow gradient. It is course *data*, not geometry, so the course table and every piece
of camera framing that depends on it stay untouched.

Derived (compute at runtime, never hardcode):

- Total path length **190.63 m** filleted (196.57 unfilleted). At v1's fixed 7 m/s this was
  27.23 s; in v2 the time varies with skill.
- Elevation gain **28.4 m**. Exactly **4** corners get filleted — the switchback reversals.
- Switchback stack: x ∈ [95, 113], y ∈ [4, 20.4]. Leg vertical spacing 3.2 m.

### Mid-leg hop clearance

Runner height (1.55) plus gait apex (0.22) sits comfortably under the 3.2 m leg spacing.
This is a **mid-leg** guarantee only — consecutive legs converge to a 0 m gap at each fold,
and near-fold overlap is expected and correct: `Z.RUNNER` draws in front of `Z.BED`, so the
runner reads as passing in front of the slope. Do not change the course table to "fix" it.

## Camera

v2 trades away v1's static wide shot. A lean mechanic needs the character big enough to read
their body angle, and in the v1 STACK shot they were a small mark on screen.

- **FOLLOW** — centers on the runner, `halfHeight = 7.0` (tighter than v1's 9). Lookahead
  scales with speed: `LOOKAHEAD_BASE * (speed / SPEED.BASE)`.
- **STACK** — a *moderate* pull-back that still **follows the runner**,
  `halfHeight = 10.5`, eased in over the switchback section. Not v1's static framing, and
  the v1 containment requirement no longer applies.
- **SHAKE** — on stumble, applied as an offset **after** the framing computation so it never
  interacts with framing logic.

## Dust

Dust puffs on **every gait-hop landing, continuously** — it's the visual signature of the
run and it should always be kicking up. A bigger burst on a stumble. Pooled and recycled,
never allocated per frame.

## Race flow

`READY` → `COUNTDOWN` (3 / 2 / 1 / GO) → `RUNNING` → `FINISHED`, with `R` or a click to
restart. Best time per course persists in `localStorage`.

## Module map

```
src/
  main.js         bootstrap, fixed-timestep loop, wiring
  constants.js    ALL tuning numbers
  courses/        course registry; alpine.js is the v1 course plus technical data
  trailPath.js    polyline + fillets + arc-length parameterization  ← unit tested
  world.js        ground bed, trail ribbon, backdrop, markers
  racer.js        runner mesh + locomotion + lean/stumble state
  controllers.js  PlayerController (keyboard); AiController later
  cameraRig.js    FOLLOW / STACK / shake
  race.js         state machine, timer, racer list
  hud.js          DOM overlay, best times
  dust.js         pooled particles
test/
  trailPath.test.js
```

## Non-goals for v2

Multiple courses, AI opponents, obstacles, and steeper terrain variants are all wanted
*later*, and the architecture above is shaped for them — but none of them ship in v2. Touch
input is also out of scope: v2 is desktop keyboard only, and `pointerdown` is start/restart
only, never a gameplay input.

---

# v1 — what shipped (historical)

One-button hop, fixed height, constant 7 m/s pace, no fail state, continuous ground line.
Every race took exactly 27.23 s. It proved out terrain, motion, camera, and feel — and made
it obvious that the hop button carried no decision, which is what v2 fixes.
