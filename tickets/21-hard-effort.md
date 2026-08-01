# Ticket 21 — Hard effort: retune the tank and the knee

**Depends on:** 18, 19, 20. Do before 15 and 16.

## Why

Measured after ticket 20: optimal *pacing allocation* is worth ~1% of race time on any
course length, at any tuning (DESIGN.md "Measured: pacing is worth ~1%"). Allocation is a
dead end.

But the same measurements found something better. With a tank big enough to afford ~60 s of
maximum-lean running in a ~106 s race:

| line | time |
| --- | --- |
| passive (no input) | 126.0 s |
| all-out until empty, then bonk | 102.5 s |
| optimal | **85.1 s** |

**A ~41 s reward for engaged play**, versus ~1 s under the shipped tuning. And all-out is
still **17.3 s slower than optimal**, so blowing up is genuinely punished.

The skill stops being *"where do I spend"* and becomes **"how hard can I hold all the way to
the line without blowing up."** That is legible, continuously felt, and it is the game the
player actually wants: running hard for as long as possible, with the tank punishing greed.

**The lever is tank size, not the redline penalty.** Sweeping `REDLINE` 6.0 → 0.25 (24×)
moved the reward only 41 s → 37 s. Keep the redline steep; just afford far more of it.

## 1. Derive the tank per course

A fixed `STAMINA.MAX` cannot serve both a 191 m and an 826 m course. Derive it at build time
from what the course actually costs:

```js
// Integrate drain along the path at ideal lean (balance = 0) — the passive baseline.
baselineSpend = ∫ (STAMINA.FLOOR * terrainFactor(s)) / speed(s) ds
staminaMax    = STAMINA.BUDGET_MULT * baselineSpend
```

Measured: summit's baseline is **365**, and `BUDGET_MULT = 2.7` gives a tank of ~980, which
affords ~61 s of maximum-lean running. Alpine's baseline is ~84, so it lands near ~225 —
automatically, with no per-course constant.

Delete the fixed `STAMINA.MAX: 130`. Any future course scales for free; that is the point of
deriving rather than hardcoding.

## 2. Widen the knee so the wobble still means something

`MARGIN.BASE_DEG: 14` puts sustainable effort at **1.68** — permanently above the knee, so
the wobble would be pinned on for the whole race and stop conveying anything.

Set `MARGIN.BASE_DEG: 20`. Calibration, all at ~61 s of max-lean effort:

| `BASE_DEG` | tank | sustainable lean | sustainable effort | passive | best | reward |
| --- | --- | --- | --- | --- | --- | --- |
| 14 | 2700 | +23.5° | 1.68 | 126 s | 85 s | 41 s |
| **20** | **980** | **+22.5°** | **1.13** | 126 s | 86 s | **40 s** |
| 26 | 580 | +18.25° | 0.70 | 126 s | 89 s | 37 s |
| 32 | 460 | +19° | 0.59 | 126 s | 93 s | 33 s |

At 20, sustainable effort sits at 1.13 — just past the knee. The wobble is *barely* on when
you are at your limit and unmistakable when you overcook, which is exactly what a telegraph
should do. At 26 it never fires at sustainable pace, and the reward drops.

## 3. Do not change

`REDLINE` (6.0), `FLOOR` (2.4), `PUSH` (3.2), `CLIMB_COST`, `DESCENT_RELIEF`,
`SPEED.COMMIT_BONUS`. All were swept and none is the lever. Leave the stumble disabled.

## Acceptance criteria

On **summit**, report measured numbers for all of these:

- A passive run (no input) finishes around **126 s**.
- Your best sustained-effort run finishes around **85–90 s**. The gap between them is the
  whole point — report it explicitly.
- Holding maximum lean from the gun gives roughly **60 s** before the tank empties, and
  finishes around **100–105 s** — i.e. **clearly slower than a sustainable line**. If
  all-out is optimal, the tank is too big and the game has no decision left.
- At the sustainable effort level the wobble is only just perceptible; leaning harder makes
  it unmistakable. Check by eye, not just numerically.
- On **alpine** (`?course=alpine`), the derived tank produces a sensible race — no bonk in
  the first third, no finishing with most of the tank unused. Report its derived value.
- Stamina still never increases, in any state, at any lean.
- `npm test` 8/8, `npm run build` clean, no console errors.

## 4. Re-target ticket 16

Ticket 16's rule is written around pacing *allocation* (timid / uniform / paced). Rewrite it
around effort **level**: the four lines become **passive**, **all-out**, **best sustained**,
and **best paced**, with the required ordering `best sustained < all-out < passive` and
`paced ≈ sustained` (allocation is expected to add ~1%, and that is fine — it is no longer
the point). Update DESIGN.md's core-loop framing to match: the skill is holding the hardest
effort you can sustain, not choosing where to spend.

## Out of scope

New mechanics. Discrete surges, obstacles, AI. Do not re-enable the stumble.
