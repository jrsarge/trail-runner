# Ticket 12 — Trip, slip, and stumble recovery

> **Built, then RETIRED in v3.** Playtested and rejected as "more annoying than tense": a
> stumble cheap enough not to feel punishing (~0.4 s) was too cheap to shape play, and one
> expensive enough to shape play felt bad. Ticket 17 disables it behind `STUMBLE.ENABLED`
> and re-points the margin from a trip threshold to the stamina drain knee (ticket 18).
> The code is kept, not deleted. **Do not implement or verify against this file** — its
> acceptance criteria (stumble cost, no death spiral) are unrunnable with the stumble off.
> The signed uphill/downhill asymmetry it introduced survives, as a *cost* asymmetry.

**Depends on:** 11. Read DESIGN.md v2 "Uphill and downhill are different" and "Fairness".

## Goal

Consequence. Lean too far and you go down, lose about a second and a half, and keep running.
This is the ticket that turns the control into a game.

## 1. The real margin

```js
base      = clamp(MARGIN.BASE_DEG - MARGIN.SLOPE_NARROW * slopeDeg, MARGIN.MIN_DEG, MARGIN.BASE_DEG);
margin    = base / path.technicalAt(s) * graceMultiplier;
```

`technicalAt` comes from ticket 09's course data (switchback legs 1.6, descent 1.15). It is
what makes the switchbacks tense despite being the gentlest gradient on the course — see
DESIGN.md, "Why `technical` exists".

## 2. Two thresholds, asymmetric by design

- **Forward trip — always active.** `balance > margin` → trip.
- **Backward slip — descents only.** When `slopeSigned` is a descent steeper than
  `MARGIN.SLIP_ONSET_DEG`, `balance < -MARGIN.SLIP_MARGIN_DEG` → slip out.

Climbing, leaning back is merely slow and carries no risk. Descending, there is no safe
passive option — you have to commit down the fall line. Do not collapse these into one
symmetric threshold; the asymmetry is the design.

## 3. Fairness machinery — all three are required

1. **Smoothed slope** — already in from ticket 11.
2. **Transition grace.** Track `d(idealLean)/dt`. When it exceeds
   `TRANSITION.SPIKE_DEG_PER_S`, set a `TRANSITION.GRACE_TIME` window during which
   `graceMultiplier = TRANSITION.GRACE_MARGIN_MULT`. This is what stops the switchback folds
   — where the grade reverses outright — from producing unreadable trips.
3. **Trigger dwell.** Exceeding a threshold starts a timer; you only go down if it stays
   exceeded for `STUMBLE.TRIGGER_TIME`. Dropping back under resets it. A single-frame spike
   must never take you down.

## 4. The stumble

### First: the pose clamp will clip it if you don't handle this

`runner.setLean()` clamps the rendered body angle to `RUNNER.TILT_MAX_DEG` (48°), but
`STUMBLE.PITCH_DEG` is **70°**. Composed naively, the stumble pose renders clipped at 48
and the fall reads as a shrug.

Resolve it explicitly: **during a stumble the pitch replaces lean rather than adding to
it** — a runner going down is not also holding a lean — and the clamp must accommodate the
pitch. Either raise `TILT_MAX_DEG` to 75 (and update the ticket-16 assert accordingly), or
give the stumble pose its own clamp. State which you chose in a comment.

Wobble (ticket 13) is zero during a stumble, so it never stacks on top of this.

### The state machine

A state on the racer, blocking normal locomotion:

| Phase | Duration | Behavior |
| --- | --- | --- |
| pitch | 0.35 s | body rotates toward `STUMBLE.PITCH_DEG` (forward trip) or back (slip); speed collapses to `STUMBLE.SKID_SPEED` |
| recover | 0.45 s | body eases back to `idealLean`; speed eases back to normal |
| grace | `STUMBLE.GRACE_TIME` | normal running, but `graceMultiplier = STUMBLE.GRACE_MARGIN_MULT` |

- Input is locked for `STUMBLE.INPUT_LOCK` from the start, then the player has control again.
- `lean` resets to `idealLean` on recovery — not to 0, or you emerge already mis-leaned on
  steep ground.
- **The racer keeps moving forward throughout.** `s` never stops advancing, never reverses.
- Total cost should come out around 1.5 s of race time. Measure it and report the number.
- Fire an `onStumble` callback — ticket 13 hangs a dust burst on it, ticket 14 a camera
  shake.

The post-stumble grace exists so you don't immediately re-trip on the same steep ground and
enter a death spiral. Verify that specifically.

## Constants to add

```js
export const MARGIN = {
  BASE_DEG: 14,
  SLOPE_NARROW: 0.25,       // margin narrows as grade steepens
  MIN_DEG: 6,
  SLIP_ONSET_DEG: 8,        // descents steeper than this get a backward slip threshold
  SLIP_MARGIN_DEG: 11,
};

export const STUMBLE = {
  TRIGGER_TIME: 0.12,
  PITCH_TIME: 0.35, RECOVER_TIME: 0.45,
  INPUT_LOCK: 0.4,
  SKID_SPEED: 2.0,
  PITCH_DEG: 70,
  GRACE_TIME: 0.9, GRACE_MARGIN_MULT: 2.0,
};

export const TRANSITION = {
  SPIKE_DEG_PER_S: 60,
  GRACE_TIME: 0.5, GRACE_MARGIN_MULT: 1.8,
};
```

## Acceptance criteria

Play it, don't just reason about it:

- Holding → hard on the climb trips you. Holding a moderate lean does not.
- On the descent, holding ← hard makes you **slip out**. On the climb, holding ← hard just
  makes you slow — no stumble. Verify both explicitly; the asymmetry is the design.
- The switchback legs trip you at a **smaller** lean than the flat start does, despite being
  a gentler gradient. That's `technical` working.
- **Run the switchback folds repeatedly without touching the keys.** You must never trip
  from terrain alone. If you do, transition grace or slope smoothing is wrong — this is the
  single most likely bug in this ticket.
- A stumble costs ~1.5 s, the runner keeps moving forward, and you never get stuck in a
  repeating stumble loop on steep ground.
- After recovery the runner is leaning at roughly the terrain's ideal, not bolt upright.
- `npm test` 8/8, no console errors, no `NaN` in speed or lean at any point.

## Out of scope

Wobble telegraph (13), camera shake (14), HUD (15).
