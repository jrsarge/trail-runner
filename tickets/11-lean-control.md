# Ticket 11 — Lean control and speed coupling

**Depends on:** 10. Read DESIGN.md v2 "The core mechanic" and "Rendered lean" first.

## Goal

← and → control the runner's lean; lean drives speed. **No trip and no stumble yet** — you
can lean as far as you like with no consequence. That is deliberate: it lets the control
feel be tuned on its own before risk is layered on.

## 1. Lean state

Held on the racer, in **degrees**, signed in the **travel frame** (positive = forward, into
the direction of travel). Degrees for authoring sanity; convert at the render boundary.

```js
lean += leanInput * LEAN.RATE_DEG * dt;              // leanInput from the controller
if (leanInput === 0) lean = moveToward(lean, 0, LEAN.DECAY_DEG * dt);
lean = clamp(lean, -LEAN.MAX_BACK_DEG, LEAN.MAX_FWD_DEG);
```

The decay toward upright when no key is held is important: on steep ground, **doing nothing
must be wrong.** The player has to actively hold a lean, which is what keeps them engaged.

## 2. Ideal lean and commit

```js
slopeSmoothed = lowPass(slopeSigned, LEAN.SLOPE_SMOOTH_TIME);   // seconds, frame-rate independent
idealLean     = clamp(LEAN.SLOPE_TO_IDEAL * degrees(|slopeSmoothed|), 0, LEAN.IDEAL_MAX_DEG);
balance       = lean - idealLean;
margin        = <ticket 12 computes the real one; here use MARGIN.BASE_DEG>
commit        = clamp(balance / margin, -1, 1);
speed         = SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * commit);
```

Smoothing the slope is not cosmetic — see DESIGN.md "Fairness". Use an exponential filter
with `1 - Math.exp(-dt / TIME)`, not a raw lerp.

## 3. Rendering the lean — the trap

Player lean **replaces** the v1 terrain-derived tilt. Delete the `TILT_FACTOR` term; do not
add lean on top of it. `idealLean` already encodes the slope, so keeping both double-counts.

```js
group.rotation.z = -degToRad(lean) * flip;   // composed in the travel frame, before flip
```

**Raise `RUNNER.TILT_MAX_DEG` from 22 to 48**, with a comment saying why. Lean reaches
`IDEAL_MAX_DEG` (26) plus a margin of up to 14 ≈ 40°, so at 22 the body angle saturates
exactly in the high-commit region where the whole game lives. The symptom is "the mechanic
feels dead" and it points nowhere near the cause. If you find the lean unresponsive at high
values, check this clamp first.

## 4. Input

`createPlayerController()` reads ArrowLeft/ArrowRight (and A/D) and returns
`{ lean: -1 | 0 | +1 }`; both held cancels to 0.

**`preventDefault()` on the arrow keys** — same page-scroll trap as Space. Keyboard only:
`pointerdown` stays start/restart, and touch is an explicit non-goal for v2.

## Constants to add

```js
export const LEAN = {
  RATE_DEG: 55,            // how fast the arrows move lean
  DECAY_DEG: 18,           // drift back to upright with no input
  SLOPE_TO_IDEAL: 0.8,
  IDEAL_MAX_DEG: 26,
  SLOPE_SMOOTH_TIME: 0.35,
  MAX_FWD_DEG: 45,
  MAX_BACK_DEG: 25,
};

export const MARGIN = { BASE_DEG: 14 };   // ticket 12 fills this group out
```

## Acceptance criteria

- Holding → visibly pitches the runner forward and **speeds them up**; holding ← pitches
  back and slows them down. Both are obvious without instrumentation.
- Releasing both keys drifts the runner back toward upright.
- The lean is visually correct on the **leftward** switchback legs — forward lean tips the
  body in the direction of travel, not backward. (Same `* flip` trap as v1's tilt.)
- Body angle keeps responding all the way to maximum forward lean — it does **not** stop
  moving partway. If it plateaus, `TILT_MAX_DEG` is still 22.
- Arrow keys do not scroll the page.
- Leaning hard forward for a whole race produces a noticeably faster time than leaning back
  the whole way. Report both times.
- `npm test` 8/8, no console errors.

## Out of scope

Trip, slip, stumble, wobble, the `technical` multiplier, camera, HUD.
