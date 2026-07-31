# Ticket 09 — Racer/controller split and course registry

**Depends on:** v1 (tickets 01–08) complete. First ticket of v2. Read DESIGN.md v2 first.

## Goal

A pure structural refactor with **zero behavior change**, done now while the codebase is
small. Nothing the player can see changes.

Right now `locomotion.js` and `race.js` assume exactly one runner, and `course.js` exports
one canonical course. Both assumptions block the roadmap (AI opponents, multiple courses)
and both are cheap to fix today and painful to fix later.

## 1. Course registry

- `src/courses/alpine.js` — the current course: `{ id: 'alpine', name: 'Alpine Switchbacks',
  start, segments, firstLegIndex, backdrop }`.
- `src/courses/index.js` — `export const COURSES = { alpine }` plus
  `export const DEFAULT_COURSE = COURSES.alpine`.
- Delete `src/course.js`; update importers.
- `buildPath(course.segments, course.start)` keeps its current signature.

**Add a `technical` field to each segment** (default 1.0 when absent), per the table in
DESIGN.md: descent 1.15, all five switchback legs 1.6, everything else 1.0. Ticket 12 reads
it; nothing consumes it yet. Expose `path.technicalAt(s)` alongside `pointAt`/`tangentAt`,
resolving through the same binary search and **smoothed the same way** as other per-segment
lookups so it doesn't step discontinuously at segment joins.

## 2. Racer

`src/racer.js` — `createRacer({ path, controller, palette })` returning an object owning
what `runner.js` + `locomotion.js` own today: the mesh group, `s`, `speed`, facing/flip,
hop state, `update(dt)`, `reset()`.

`src/controllers.js` — `createPlayerController()` exposing
`update(dt, view) -> { lean: -1 | 0 | +1 }`. It returns `{ lean: 0 }` for now; ticket 11
makes it read the keyboard. The `view` argument carries read-only racer state (`s`, `speed`,
`slope`) so an AI controller can later see what it's reacting to.

`race.js` owns `racers: []` with one flagged as the player, and iterates. **Ship exactly one
racer.** Do not write an AI controller.

Keep `runner.js` as the mesh/pose layer if that's the smaller diff — the requirement is that
race-level code stops assuming a singleton, not a specific file split.

## Acceptance criteria

- `npm test` still passes 8/8.
- **A full race still finishes at exactly `0:27.23`.** This is the whole point of doing the
  refactor as its own ticket: v1 is deterministic at a fixed 7 m/s, so any behavior drift
  shows up in that number. Anything else means the refactor changed something. Run it twice.
- Distance ends at 191 m, elevation at 28 m, restart still returns to a clean READY.
- No console errors. `npm run build` succeeds.

## Out of scope

Any gameplay change, lean, variable speed, AI. **Ticket 10 is what legitimately destroys the
27.23 number** — so this ticket must be verified against it *before* 10 lands.
