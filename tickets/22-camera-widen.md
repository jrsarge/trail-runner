# Ticket 22 — Widen the camera

**First ticket of v4.** Small, immediate, and worth doing before anything else in v4.

## Why

Ticket 14 tightened `CAMERA.HALF_HEIGHT` from 9 to 7.0 so the runner's lean angle would be
readable. That optimised for one thing and lost another: **you cannot see the terrain**, and
terrain is what drives stamina cost in v3. Playtest verdict — too tight.

Lean is a *large* angle (up to `LEAN.MAX_FWD_DEG` = 45°), so it stays readable much further
out than ticket 14 assumed. Widening costs less than it looks.

## 1. Widen

Raise `CAMERA.HALF_HEIGHT`. **Try 10 and 12, screenshot both on each course, and report
which you'd pick and why** — this is a judgement call the human will make from your
screenshots, so give them a real comparison, not a single option.

Scale `CAMERA.STACK_HALF_HEIGHT` (currently 10.5) proportionally — it is the switchback
pull-back and must stay meaningfully wider than the FOLLOW shot, or the pull-back stops
reading as a pull-back at all.

## 2. THE TRAP: `WORLD.FLOOR_MARGIN` depends on the camera

Read the comment on `WORLD.FLOOR_MARGIN` in `constants.js` before you touch anything. The
floor is derived from the course's lowest point minus this margin, and the margin must
exceed the camera's worst-case downward view:

```
FLOOR_MARGIN > CAMERA.STACK_HALF_HEIGHT + CAMERA.LOOKAHEAD_Y
```

At 10.5 + 1.2 the current margin of 12 barely clears. **Widen the camera without raising
this and sky appears under the ground** at the low point — a bug this project has already
fixed twice (tickets 03 and 19). Raise `FLOOR_MARGIN` to keep headroom, and verify it at
summit's y = −14 low point, which is the case that actually exercises it.

`WORLD.SKY_MARGIN` (150) is generous enough already, but confirm the sky quad still covers
the frustum at the widest zoom.

## Acceptance criteria

- Screenshots at both candidate values, on **both** courses (`?course=alpine` and the
  default summit), including the flat start, a climb, and the switchback stack.
- **You can read the runner's lean at a glance** at the chosen value — check on a leftward
  switchback leg, where lean is easiest to misread.
- **You can see enough terrain ahead to anticipate a grade change.** That is the point of
  the ticket.
- No sky beneath the ground at summit's low point, at either candidate value.
- The switchback pull-back still reads as a distinct widening, not a barely-perceptible one.
- `npm test` 8/8, `npm run build` clean, no console errors.

## Out of scope

The progress strip (23), rivals (24), anything else. Do not retune stamina, lean, or speed.
