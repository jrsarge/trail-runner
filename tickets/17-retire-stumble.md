# Ticket 17 — Retire the stumble, decouple speed from cost

**First ticket of v3. Read DESIGN.md v3 before starting.**
**Execution order: 17 → 18 → 14 → 15 → 16.**

## Goal

Turn off the stumble and re-point the machinery it was built for. No stamina yet — ticket 18
does that. After this ticket the game is playable but has *no* ceiling at all: leaning
harder is simply faster. That is expected and temporary.

## 1. Disable the stumble — do not delete it

Add `STUMBLE.ENABLED = false`. Gate the trip check, the slip check, the stumble state
machine, the pitch pose, the input lock, and the stumble dust burst behind it.

**Keep the code.** It was playtested and rejected as "more annoying than tense", but if
stamina proves thin on a 25 s course it should be cheap to get back. Leave it reachable by
flipping one constant, and leave the constants in place.

Delete nothing; make it dead-but-restorable. Verify that flipping `ENABLED` back to `true`
restores v2 behavior before you call this done.

## 2. Decouple speed from the cost margin — this is the important one

Today `commit = balance / margin`, and `margin` shrinks with `technical`. In v3 `margin`
becomes the *cost* knee, so if speed keeps sharing that denominator the runner goes **faster
on technical ground at identical lean** — technical terrain becomes a speed bonus, the exact
opposite of the intent.

Split them:

```js
// SPEED — fixed reference, never scaled by technical or grace.
commit = balance / SPEED.REF_DEG;

// COST — technical-scaled; ticket 18 consumes this.
costMargin = clamp(MARGIN.BASE_DEG - MARGIN.SLOPE_NARROW * Math.abs(slopeDeg),
                   MARGIN.MIN_DEG, MARGIN.BASE_DEG) / path.technicalAt(s);
effort = balance / costMargin;
```

Expose `locomotion.effort` alongside `commit`. Nothing consumes `effort` yet.

`SPEED.REF_DEG` is 14 — the same number `MARGIN.BASE_DEG` happens to hold, so this change is
behaviour-neutral on flat, non-technical ground. That is deliberate: it makes the diff easy
to sanity-check.

## 3. Uncap the sprint

Remove the upper clamp on commit so leaning further always goes faster, with diminishing
returns above the knee:

```js
gain = c <= 1 ? c : 1 + SPEED.SPRINT_GAIN * (1 - Math.exp(-(c - 1) / SPEED.SPRINT_FALLOFF));
speed = Math.min(SPEED.MAX, SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * gain));
```

Keep the **lower** clamp at `-1` — leaning back should not go arbitrarily slow.

## 4. Repurpose the wobble

The wobble stays, driven by `effort` (the cost knee) rather than the old trip threshold. Its
meaning changes from "you are about to fall" to "this is costing you". Same `** 1.5` curve,
same onset, same zero-during-stumble rule (moot while disabled).

## 5. Retire transition grace

`TRANSITION` grace existed solely to stop the switchback folds producing unfair *trips*.
With no trips it would only make the folds briefly cheaper and faster — a perk exactly where
the game should be hardest. Remove its application; keep the constants next to the disabled
stumble.

**Slope smoothing stays.** It keeps `idealLean` coherent through the folds and is not about
fairness.

## Constants

```js
export const SPEED = {
  BASE: 7.0, GRADE_DRAG: 0.5, MIN_FACTOR: 0.8, MAX_FACTOR: 1.2,
  COMMIT_BONUS: 0.35,
  REF_DEG: 14,          // fixed speed reference — NEVER scale this by technical
  SPRINT_GAIN: 0.8, SPRINT_FALLOFF: 1.0,
  MAX: 11.5,            // hard cap; uncapped sprint is unreadable
};

export const STUMBLE = { ENABLED: false, /* ...existing values kept... */ };
```

## Acceptance criteria

- A full race runs start to finish with **no stumble ever**, at any lean, on any terrain.
  Hold ← hard down the descent and → hard up the climb and confirm neither drops you.
- Setting `STUMBLE.ENABLED = true` restores v2 behavior — verify, then set it back.
- **Identical lean on a switchback leg and on the flat produces the same speed.** This is
  the decoupling working; before this ticket the leg was faster. Measure both.
- Leaning beyond the old margin still accelerates, with visibly diminishing returns, and
  never exceeds `SPEED.MAX`.
- The wobble still appears when pushing hard and is driven by `effort`.
- No trip occurs at a switchback fold with no input held.
- `npm test` 8/8, `npm run build` clean, no console errors.

## Out of scope

Stamina (18), camera (14), HUD (15), tuning (16).
