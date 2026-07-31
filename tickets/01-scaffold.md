# Ticket 01 — Project scaffold and render loop

**Depends on:** nothing.

## Goal

A Vite project that opens in the browser and shows an empty orthographic three.js scene
with a sky-colored background, resizing correctly, running a fixed-timestep loop.

## Files

- `package.json` — `three` as the only runtime dep, `vite` as the only dev dep. Scripts:
  `dev`, `build`, `preview`, `test` (`node --test test/`). `"type": "module"`.
- `.gitignore` — `node_modules`, `dist`, `.DS_Store`.
- `index.html` — full-viewport canvas container `#app`, plus an empty `#hud` overlay div
  (ticket 07 fills it). Page margin 0, `overflow: hidden`, background = `SKY_BOTTOM`.
- `src/main.js` — bootstrap and loop.
- `src/constants.js` — created here, populated as later tickets need it. Seed it with the
  values in the table below.

## Spec

`src/main.js`:

- `WebGLRenderer({ antialias: true })`, append to `#app`, `setPixelRatio` clamped to 2.
- `Scene` with `background` = `new Color(COLORS.SKY_BOTTOM)`.
- `OrthographicCamera`. Compute frustum from a half-height plus the viewport aspect:
  `halfW = halfH * aspect`, so `left/right = ∓halfW`, `top/bottom = ±halfH`. Near/far
  wide enough for z ∈ [−10, 10]. Camera at `z = 10`.
- Export a small helper `setCameraFrame(camera, centerX, centerY, halfHeight, aspect)` that
  ticket 06 will drive. For now call it with `(0, 4, CAMERA.HALF_HEIGHT, aspect)`.
- Resize handler on `window` that updates renderer size and re-derives the frustum.
- **Fixed-timestep loop.** Accumulate real elapsed time and step simulation in
  `FIXED_DT` (1/120 s) increments, clamping the accumulator to `MAX_FRAME_DT` (0.1 s) so a
  background tab doesn't cause a huge catch-up. Render once per animation frame. Shape:

  ```js
  function frame(now) {
    let dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
    last = now; acc += dt;
    while (acc >= FIXED_DT) { update(FIXED_DT); acc -= FIXED_DT; }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  ```

  `update(dt)` is an empty hook other tickets extend.

## Seed `src/constants.js`

```js
export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export const COLORS = {
  SKY_TOP:    0x9fd4e8,
  SKY_BOTTOM: 0xe7f3f7,
  GROUND:     0x5a7247,
  TRAIL:      0xc9a86a,
  RIDGE_FAR:  0xbcd3d8,
  RIDGE_NEAR: 0x7f9c86,
  MOUNTAIN:   0x4b6140,
  RUNNER_BODY: 0xe4572e,
  RUNNER_HEAD: 0xf2c49b,
  FINISH:     0xffffff,
};

export const CAMERA = { HALF_HEIGHT: 9 };
```

## Acceptance criteria

- `npm install && npm run dev` serves a page with **no console errors**.
- The viewport is filled with a flat sky color, no scrollbars.
- Resizing the window keeps the view undistorted (squares stay square in later tickets —
  for now confirm the reported ortho width/height ratio matches the canvas aspect).
- `npm test` runs and passes with zero tests found (or a trivial placeholder).

## Out of scope

Sky gradient (ticket 03), any geometry, any input, the HUD's contents.
