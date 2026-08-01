# Ticket 14 — Camera retune for the lean mechanic

**Depends on:** 20. (Execution order: 17 → 18 → 19 → 20 → **14** → 15 → 16.)

> **Updated for v3.** Two things changed since this was written. The stumble is retired
> (ticket 17), so §3's shake must be gated behind `STUMBLE.ENABLED` — build it, but expect
> it never to fire. And there are now two courses: the pull-back must key off
> `path.ledgeRanges()` (ticket 19), never a hardcoded index or coordinate.
>
> **This ticket is currently blocking playtesting.** `CAMERA.STACK_X/STACK_Y` are still
> alpine-tuned constants, so on the `summit` course the pull-back triggers correctly but
> frames an empty region — the new course's climax is unwatchable until §2 lands.

## Goal

The camera was framed for a game about watching a runner cross terrain. It is now a game
about reading one character's body angle, and v1's static wide shot left them too small to
read. Tighten it — while keeping enough of the switchback climb to stay legible.

## 1. Tighter FOLLOW

- `CAMERA.HALF_HEIGHT` 9 → **7.0**.
- Lookahead **scales with speed**, since pace now varies:
  `lookahead = CAMERA.LOOKAHEAD_BASE * (racer.speed / SPEED.BASE)`, so the camera leads
  further when running fast and pulls in when the runner slows or stumbles.
- Keep the frame-rate-independent easing
  (`current += (target - current) * (1 - Math.exp(-λ * dt))`) and the existing
  `CAMERA.HOP_DAMP` on the hop offset so the camera doesn't pogo.

## 2. STACK becomes a moderate, *following* pull-back

**This replaces v1's static wide shot.** v1 framed x ∈ [95, 120] statically with the whole
stack in view; that shrank the runner to an unreadable mark for the last third of the race.

- Still centers on the **runner**, exactly like FOLLOW — only the zoom changes.
- `halfHeight` eases from `CAMERA.HALF_HEIGHT` (7.0) to `CAMERA.STACK_HALF_HEIGHT` (10.5)
  on entering the switchback section, over `CAMERA.STACK_BLEND`.
- **Delete** `STACK_X`, `STACK_Y`, `STACK_MIN_WIDTH` and the v1 containment requirement.
  Nothing needs to statically contain the stack or the banner any more — the camera follows
  the runner to the finish, so the banner is in frame because the runner is at it.

This is a deliberate trade: we lose v1's nice wide reveal of the whole zig-zag, and gain a
character big enough to read. If it turns out the climb is now hard to follow, raise
`STACK_HALF_HEIGHT` — that's the dial, and it's why it's a constant.

## 3. Stumble shake

On `onStumble`, a decaying shake:

```js
shake = CAMERA.SHAKE_AMP * exp(-t / CAMERA.SHAKE_DECAY);
offset = { x: shake * noise1(t * FREQ), y: shake * noise2(t * FREQ) };
```

**Apply the offset after the framing computation**, as a final translation of the computed
frame — never as an input to it. Shake that feeds back into framing logic will fight the
easing and drift.

Use cheap decorrelated noise (two offset sine sums are fine). Do not shake the HUD.

## Constants

```js
export const CAMERA = {
  HALF_HEIGHT: 7.0,               // was 9 — lean needs a readable character
  LOOKAHEAD_BASE: 3.0,            // scaled by speed / SPEED.BASE
  LOOKAHEAD_Y: 1.2,
  FOLLOW_LAMBDA: 6.0,
  HOP_DAMP: 0.35,
  STACK_HALF_HEIGHT: 10.5,        // moderate pull-back; still follows the runner
  STACK_LEAD: 6, STACK_BLEND: 1.2,
  SHAKE_AMP: 0.35, SHAKE_DECAY: 0.18, SHAKE_FREQ: 22,
};
```

## Acceptance criteria

- At default framing the runner is **large enough that lean is obvious at a glance** — the
  primary reason for this ticket. Check on the flat, the climb, and the switchbacks.
- Entering the switchbacks the camera eases back smoothly; no snap in zoom or center.
- The climb is still followable — you can tell which leg you're on and that you're gaining
  height.
- The finish banner is in frame at the finish (because the camera is on the runner).
- Lookahead visibly extends at speed and pulls in during a stumble.
- A stumble shakes the view briefly and settles cleanly with no residual drift — run three
  in a row and confirm the camera returns to exactly the same framing each time.
- Resize mid-race, including to a tall narrow window: nothing distorts.
- Parallax still tracks `camera.position.x`.

## Out of scope

HUD, best times, any change to what the world looks like.
