# Ticket 08 — Landing dust, tuning sweep, README

**Depends on:** 07. This is the last ticket. It has an exact item list — implement these
things and nothing else.

## 1. Landing dust puffs

`src/dust.js`, a fixed-size pool of small quads. No particle library.

- Pool of `DUST.POOL` (24) quads, 0.16 × 0.16, `COLORS.DUST` (`0xd8cbb2`),
  `transparent: true`, at `Z.RUNNER - 0.1` (just behind the runner).
- On a **big hop landing**, emit `DUST.PER_LAND` (5) puffs at the runner's feet. Do not emit
  on gait hops — the trot would bury the screen in dust.
- Each puff: initial velocity biased **backward** (opposite the runner's facing) and slightly
  up, random within `DUST.SPREAD`; rises and slows; scales up by `DUST.GROW` (1.8×) and
  fades opacity to 0 over `DUST.LIFE` (0.45 s); then returns to the pool.
- Puffs are world-space and do not follow the runner after emission.
- Recycle the oldest puff when the pool is exhausted. Never allocate per-frame.

```js
export const DUST = {
  POOL: 24, PER_LAND: 5, LIFE: 0.45, GROW: 1.8,
  SPEED: 2.2, SPREAD: 0.6, GRAVITY: 1.4,
};
```

## 2. Tuning sweep

Verify, and fix anything that fails:

- **Every tunable number lives in `src/constants.js`.** Grep the `src/` tree for bare
  numeric literals in look/feel code and hoist any you find. Geometry indices, `0`, `1`, `2`,
  and array math are fine; sizes, speeds, durations, colors, and offsets are not.
- Constants are grouped and each group has a one-line comment saying what it controls.
- `RUNNER.HEIGHT` still matches `BODY_H + HEAD_GAP + HEAD_S`, and
  `RUNNER.HEIGHT + HOP.BIG_APEX < 3.2` (the switchback clearance constraint from DESIGN.md).
  Add a `console.assert` for that at startup — it's the constraint most likely to be broken
  by later tuning.
- No unused constants left behind.

## 3. README.md

Short. How to run (`npm install`, `npm run dev`), how to play (one button), what the course
is, where to tune things (`src/constants.js`), and a **"What this POC deliberately does not
have"** section: no fail state, no obstacles, constant pace, and therefore a hop button that
is the gait rather than a skill check — pointing at the open design question in DESIGN.md.

## Acceptance criteria

- Big hops kick up a small backward puff of dust that rises, grows, fades, and disappears.
  Gait hops produce none.
- A full race start to finish with heavy Space mashing shows no frame-rate drop and no
  growing object count (dust is pooled, not allocated).
- `npm test` still passes; no console errors or failed assertions across a full race.
- `README.md` reads correctly to someone who has never seen the project.

## Out of scope

Sound, screen shake, weather, footprints, trees, birds, a second course, mobile-specific UI.
If any of those seem worth doing, they're a new ticket and the user's call.
