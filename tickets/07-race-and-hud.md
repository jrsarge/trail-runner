# Ticket 07 — Race state machine and HUD

**Depends on:** 06.

## Goal

It's a race: a countdown, a running clock, live stats, a finish time, and a restart. This is
the ticket that turns the motion demo into something you play.

## Files

- `src/race.js` — state machine and timer.
- `src/hud.js` — DOM overlay inside `#hud` (plain DOM, no framework).
- `src/main.js` — own the wiring.
- `index.html` — HUD styles.

## State machine

```
READY ──(hop input)──> COUNTDOWN ──(after 4 beats)──> RUNNING ──(s >= length)──> FINISHED
  ^                                                                                 │
  └────────────────────────────── R / click ────────────────────────────────────────┘
```

- **READY** — runner stands at the start line, no automatic gait hop, clock at `0.00`.
  Prompt: "Press Space to race".
- **COUNTDOWN** — beats `3`, `2`, `1`, `GO!` at `RACE.COUNT_BEAT` (0.6 s) each. Runner does
  not advance. Show each beat large and centered, fading out.
- **RUNNING** — locomotion active, **timer starts on the GO beat**, not on the first input.
- **FINISHED** — clock stops, runner stops at the finish line (keep the gait hop going in
  place, it reads as catching their breath), finish card appears.

  **Resolve a mid-hop finish.** Ticket 05 clamps `s` at `path.length` and stops advancing,
  which freezes any in-progress hop's vertical offset — the runner can end the race hovering
  up to one hop apex above the trail. On entering FINISHED, ease the hop offset to 0 (over
  ~0.15 s) so the runner settles onto the finish line before the gait-in-place takes over.

Gate `requestHop()` from ticket 05 by state: in READY it starts the countdown; in COUNTDOWN
it does nothing; in RUNNING it hops; in FINISHED it restarts.

Restart resets `s`, the timer, the camera rig, and the hop state — everything back to READY
with no page reload. Verify a second run behaves exactly like the first (a camera rig or hop
state that doesn't reset is the usual bug here).

## HUD

Top-left stat block, `tabular-nums`, semi-transparent dark panel, rounded, readable over
both sky and ground:

| Stat | Format | Source |
| --- | --- | --- |
| time | `M:SS.CC` | race timer |
| distance | `123 / 191 m` | `locomotion.s` / `path.length`, both rounded |
| elevation | `↑ 18 / 28 m` | gain so far / total gain |

**Elevation gain** = sum of positive y deltas along the path, accumulated up to the current
`s`. Compute the per-vertex cumulative gain array once at startup from the path points and
interpolate, the same way arc length works — do not recompute the sum every frame. Total
gain should come out ≈ 28.4 m; if it doesn't, you're double-counting the descent.

**Finish card** — centered panel: "FINISH", the final time large, elevation gain and
distance beneath, and "Press R to run it again".

The HUD is DOM, positioned over the canvas with `pointer-events: none` so canvas clicks
still register — except the finish card, which may take pointer events for a restart click.

## Constants to add

```js
export const RACE = { COUNT_BEAT: 0.6, COUNT_FROM: 3 };
```

## Acceptance criteria

In the browser:

- Load → runner waits at the start line, clock reads `0:00.00`, prompt visible.
- Space → `3`, `2`, `1`, `GO!` — the runner does not move until GO, and the clock starts on
  GO, not on the keypress.
- During the run, all three stats update live; distance ends at exactly the total, elevation
  ends at the total gain (≈28 m).
- The time is legible and stable while running — no jitter from a variable-width font.
- Crossing the finish: clock stops on a plausible time (≈27 s), finish card shows that same
  time, runner is at the banner.
- `R` (and clicking the card) restarts cleanly: back to READY, clock zeroed, runner at the
  start, camera back to the FOLLOW shot. **Run it twice and confirm the second run is
  identical to the first.**
- No console errors across a full race and restart.

## Out of scope

Best-time persistence, leaderboards, splits, sound, difficulty settings.
