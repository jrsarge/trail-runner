# Ticket 06 — Camera rig

**Depends on:** 05.

## Goal

Two shots and a blend between them. **This ticket is what makes or breaks the demo** — the
switchback climb is the thing worth showing, and a tight follow through a 16 m vertical
stack reads as an illegible scribble. So the camera pulls back and frames the whole climb.

## Files

- `src/cameraRig.js` — exports `createCameraRig(camera, path)` with `update(dt, runner)`.
- `src/main.js` — replace the fixed camera framing with the rig; pass `camera.position.x`
  to `world.updateParallax`.

## The two shots

**FOLLOW** — used from the start line until the runner approaches the stack.

- Target center = runner position + `(LOOKAHEAD * facing, LOOKAHEAD_Y)`.
- `halfHeight = CAMERA.HALF_HEIGHT` (9).
- Ease center toward the target exponentially and **frame-rate independently**:
  `current += (target - current) * (1 - Math.exp(-CAMERA.FOLLOW_LAMBDA * dt))`.
  Do not use a raw `lerp(current, target, k)` — it makes camera feel depend on frame rate.
- Do **not** ease out the hop bob. Following the vertical hop arc 1:1 makes the camera
  bounce; scale the runner's hop offset by `CAMERA.HOP_DAMP` (0.35) before feeding it in so
  the camera drifts rather than pogos.

**STACK** — a static wide shot of the whole switchback stack.

- Center `(CAMERA.STACK_X, CAMERA.STACK_Y)` = `(107, 14.8)`,
  `halfHeight = CAMERA.STACK_HALF_HEIGHT` (11.8).
- Entered when `s >= sStackStart - CAMERA.STACK_LEAD` (6 m), where
  `sStackStart = path.segmentStartS(FIRST_LEG_INDEX)`.
- Blend from FOLLOW over `CAMERA.STACK_BLEND` (1.2 s), easing center **and** halfHeight
  together with a smoothstep on the blend parameter.
- Then **hold it through the finish.** Do not blend back to FOLLOW.

### The framing requirement (state it, don't just trust the numbers)

The STACK frame must contain, with margin:

- **y ∈ [4, 23.2]** — the stack base at y=4 up to the **top of the finish banner**. The
  banner is not at the path end's y: it hangs from a 2.6 m post at `(120, 20.4)` and spans
  y ≈ 21.9 → 23.0. Framing to y=20.4 clips it.
- **x ∈ [95, 120.2]** — the stack's left edge to the finish post.

The values above satisfy this: y ∈ [3.0, 26.6], and at 16:9 x ∈ [86, 128]. Keep this
requirement in a comment next to the constants — it's the thing later tuning will break.

## Aspect handling

`halfWidth = halfHeight * aspect`. On a portrait or very narrow window the stack shot is too
tight horizontally: at 1:1, halfWidth 11.8 gives x ∈ [95.2, 118.8], which clips the banner.
So add a floor — the frame must always cover at least `CAMERA.STACK_MIN_WIDTH` (34 m):

```js
if (halfHeight * aspect < CAMERA.STACK_MIN_WIDTH / 2)
  halfHeight = (CAMERA.STACK_MIN_WIDTH / 2) / aspect;
```

Raising halfHeight only ever adds vertical coverage, so the y requirement still holds.

## Constants to add

```js
export const CAMERA = {
  HALF_HEIGHT: 9,
  LOOKAHEAD: 4.0, LOOKAHEAD_Y: 1.2,
  FOLLOW_LAMBDA: 6.0,
  HOP_DAMP: 0.35,
  // STACK frame must contain y ∈ [4, 25.4] (stack base → top of finish banner)
  // and x ∈ [95, 120.2]. See ticket 06 before changing these.
  STACK_X: 107, STACK_Y: 14.8, STACK_HALF_HEIGHT: 11.8,
  STACK_LEAD: 6, STACK_BLEND: 1.2, STACK_MIN_WIDTH: 34,
};
```

## Acceptance criteria

Watch a full run in the browser, and watch it at a couple of window sizes:

- The runner stays comfortably in frame on the flat, the climb, and the descent, positioned
  slightly behind center so you can see where they're going.
- The camera does not visibly bounce with each hop.
- Approaching the switchbacks the camera **smoothly pulls back** — no snap, no jolt in
  either center or zoom — and settles on a shot where **all five ledges and the finish
  banner are visible at once**, with the runner clearly working up the zig-zag.
- The shot holds steady through the finish. **The whole finish banner — including its top
  edge at y ≈ 23.0, not just the post — is on screen.** Check this one specifically; it's
  the easiest thing in this ticket to get subtly wrong.
- Resize the window mid-run, including to a tall narrow window: nothing distorts, and the
  stack shot still contains both the full stack and the whole banner.
- Parallax ridges still move with the camera (they read from `camera.position.x`).

## Out of scope

HUD, race state, screen shake, any camera work beyond these two shots.
