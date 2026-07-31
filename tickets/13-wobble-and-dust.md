# Ticket 13 — Wobble telegraph and continuous dust

**Depends on:** 12.

## Goal

Make the edge *feelable* before you go over it, and make the run kick up dust the whole way.

## 1. Wobble

Ticket 12 made tripping possible; without a tell it is unfair. The character is the readout
— **no UI meter**.

```js
t   = (|commit| - WOBBLE.ONSET) / (1 - WOBBLE.ONSET);   // 0 at onset, 1 at the threshold
amp = WOBBLE.MAX_DEG * clamp(t, 0, 1) ** 1.5;           // ramps in gently, bites near the edge
wobbleDeg = amp * Math.sin(elapsed * WOBBLE.FREQ_HZ * TAU);
```

- Added to the body angle **in the travel frame**, alongside lean, before the `* flip`
  multiply (DESIGN.md, "Rendered lean").
- Applies to the **backward slip threshold on descents too**, not just forward trips — any
  approach to any edge wobbles.
- Zero while stumbling.

The `** 1.5` curve matters: a linear ramp reads as constant background jitter, which trains
players to ignore it. It should be barely perceptible at onset and unmistakable at the edge.

## 2. Dust — now continuous

**Changed from v1:** v1 emitted only on big-hop landings and explicitly suppressed gait
hops. Big hops no longer exist, and dust should now kick up **on every gait-hop landing, all
the time**. It's the visual signature of running.

- `DUST.PER_GAIT` (3) puffs on every gait landing, biased backward from the direction of
  travel and slightly up, as v1 already does.
- `DUST.PER_STUMBLE` (9) puffs in a wider, faster spread on `onStumble` — a visible eruption
  that reads as scuffing out.
- **Raise `DUST.POOL` from 24 to 40.** Gait hops land roughly every 1.6 m — about 4 per
  second at speed, more downhill — and with a 0.45 s life several landings are alive at
  once. Too small a pool recycles visibly and the trail of dust flickers.
- Still pooled and recycled. **Never allocate per frame**, and never grow the pool at
  runtime. Recycle oldest-first when exhausted.

## Constants to change/add

```js
export const WOBBLE = { ONSET: 0.55, MAX_DEG: 3.5, FREQ_HZ: 14 };

export const DUST = {
  POOL: 40,                 // was 24 — gait dust is continuous now
  PER_GAIT: 3,
  PER_STUMBLE: 9,
  LIFE: 0.45, GROW: 1.8, SPEED: 2.2, SPREAD: 0.6, GRAVITY: 1.4,
  STUMBLE_SPEED: 3.4, STUMBLE_SPREAD: 1.1,
};
```

## Acceptance criteria

- Leaning gradually toward the edge, the runner starts to wobble noticeably **before**
  tripping — you can feel the trip coming and back off in time. Confirm you can deliberately
  ride the wobble without going down.
- Wobble also appears when approaching the backward slip edge on a descent.
- No wobble at all at a comfortable lean, and none during a stumble.
- Dust kicks up continuously the entire race, from the start line to the finish.
- A stumble throws a visibly bigger burst.
- Run a full race leaning hard the whole way: no frame-rate drop, and the mesh count stays
  fixed at `DUST.POOL`. Verify the count directly, don't assume.
- `npm test` 8/8, no console errors.

## Out of scope

Camera shake (14), HUD (15). Do not add a UI balance meter — the wobble is the meter.
