# Ticket 18 — Stamina

**Depends on:** 17. Read DESIGN.md v3 "The core loop", "Effort and cost", "Terrain: where
you spend", "Calibration", and "Running out".

## Goal

The mechanic. One tank for the whole course, spent by leaning, never refilled.

## 1. The tank

```js
stamina = STAMINA.MAX;                 // on reset
stamina = Math.max(0, stamina - drain * dt);
```

**It only ever decreases.** There is no recovery, no regen, no refill — backing off slows
the burn, it does not restore anything. If you find yourself writing a `+=` on stamina, stop
and re-read the design; that is the single thing this mechanic is built around.

## 2. Drain

```js
drain = (STAMINA.FLOOR
       + STAMINA.PUSH    * Math.max(0, effort)
       + STAMINA.REDLINE * Math.max(0, effort - 1) ** 2) * terrainFactor;
```

- `effort` comes from ticket 17 (`balance / costMargin`) — the technical-scaled knee.
- The **squared** redline term is what makes sprinting self-limiting: affordable in bursts,
  ruinous held. Do not linearise it.
- `FLOOR` applies always, even leaning back. You can prolong the tank; never preserve it.

### Terrain

```js
terrainFactor = slopeSigned > 0
  ? 1 + STAMINA.CLIMB_COST * Math.sin(slopeSigned)
  : Math.max(STAMINA.DESCENT_MIN, 1 - STAMINA.DESCENT_RELIEF * Math.sin(-slopeSigned));
```

Plus a braking cost, so descents keep having no free safe option:

```js
if (slopeSigned < -radians(MARGIN.SLIP_ONSET_DEG) && effort < 0)
  drain += STAMINA.BRAKE_COST * Math.abs(effort) * Math.sin(-slopeSigned);
```

Climbs are expensive and slow; descents are cheap and fast. **Conserve up, spend down** —
that is the strategy the whole game is about.

## 3. Bonking

At zero: **cap `commit` at 0** (no leaning above ideal, no pushing, no sprinting) and
multiply speed by `STAMINA.EXHAUSTED_MULT`. The runner keeps moving and finishes.

The penalty is losing your **upside**, not being frozen. A hard crawl was considered and
rejected — at 1.5 m/s, emptying at 60% distance leaves ~50 s of shuffling, longer than the
whole race. Both values are constants so a harsher bonk is one number away.

Bonking is not a state to recover from: once empty, it is empty for the rest of the race.

## 4. Feedback (mechanical only — the meter is ticket 15)

- Expose `locomotion.stamina` and `locomotion.staminaFraction`.
- Fire `onBonk` once when the tank first empties.
- Add a **posture/gait tell**: as `staminaFraction` falls below `STAMINA.TIRED_FRACTION`,
  scale the gait hop apex down toward `STAMINA.TIRED_APEX_MULT` and add a small forward
  slump. It should be visible without reading the meter.

## Constants

```js
export const STAMINA = {
  MAX: 130,               // see the calibration table below
  FLOOR: 2.4,             // per second, always, even leaning back
  PUSH: 3.2,              // per second per unit of effort, under the knee
  REDLINE: 6.0,           // per second per (effort - 1)^2, above the knee
  CLIMB_COST: 1.5,
  DESCENT_RELIEF: 1.2, DESCENT_MIN: 0.45,
  BRAKE_COST: 2.0,
  EXHAUSTED_MULT: 0.8,    // speed multiplier once empty (commit is also capped at 0)
  TIRED_FRACTION: 0.35, TIRED_APEX_MULT: 0.6,
};
```

### Calibration — integrated over the real course, not estimated

Holding a constant lean above ideal the whole way:

| lean above ideal | finish | tank spent |
| --- | --- | --- |
| +0° | 29.0 s | 83.5 |
| +2° | 27.6 s | 105.3 |
| +4° | 26.4 s | 125.1 |
| +6° | 25.2 s | 143.9 |
| +10° | 23.2 s | 195.5 |
| max | 19.0 s | 1350.8 |

`MAX: 130` puts the sustainable *uniform* line at about +4.5°. Harder bonks, easier wastes.

**Reproduce this table as part of your verification.** Walk the path in small `ds` steps
evaluating slope, `gradeFactor`, `terrainFactor` and drain — the numbers above came from
exactly that. If yours disagree materially, your implementation differs from the spec and
that is the bug.

## Acceptance criteria

- Holding roughly +4–5° above ideal for the whole course finishes with the tank near empty.
  Report the actual finish time and remaining stamina.
- **Non-uniform pacing beats every uniform line.** Conserve on the climb, spend on the
  descent, and report a time faster than the best constant-lean run. If a flat line wins,
  the terrain factors are too weak — say so, don't quietly retune.
- Sprinting is affordable in bursts and ruinous held: report how many seconds of maximum
  lean the full tank buys.
- Stamina **never increases**, in any state, at any lean. Assert it in your own testing.
- Bonking caps you at conservative pace, the runner still finishes, and the tell is visible
  before the tank empties.
- Leaning back on a steep descent costs *more* than riding the fall line — verify.
- `npm test` 8/8, `npm run build` clean, no console errors, no `NaN` in stamina or speed.

## Out of scope

The meter (15), camera (14), balance tuning (16). Do not re-enable the stumble.
