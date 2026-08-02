# Ticket 23 — Course progress strip

**Depends on:** 22.

## Why

With the camera framing a few dozen metres of an 826 m course, rivals (ticket 24) will be
off-screen most of the time — and a rival you cannot see cannot bait you. The strip solves
that, doubles as the position readout, and is useful solo as a "where am I on this course"
reference.

Built before rivals deliberately: it de-risks the multi-racer plumbing with one moving part.

## Spec

A thin horizontal strip in the HUD, representing the **whole course** from start to finish.

- **Elevation profile as the backdrop.** Render the course's own y-profile against arc
  length as a filled silhouette — the player should recognise the grind and the stack by
  shape. Build it once at startup from `path.points` / `path.cumulative`; it never changes.
- **Section shading** using the same course data the game already has (`technicalAt`, or
  ledge ranges from `path.ledgeRanges()`), so the switchback stack is visibly distinct.
- **A marker per racer** at its `s / path.length`. The player's marker must be unmistakably
  different — larger, brighter, outlined — not merely a different hue.
- Ticket 24 will add more markers. **Take a list of racers, not a single racer**, even
  though only one exists today. That is the whole point of building this first.

Keep it minimal and quiet: this sits on screen for two minutes, so it must not compete with
the terrain for attention.

## Constants

```js
export const STRIP = { HEIGHT: 34, MARKER_SIZE: 7, PLAYER_MARKER_SIZE: 10 };
```

## Acceptance criteria

- The strip's profile is recognisably the course — screenshot it next to a wide camera shot
  of summit and confirm the grind and the stack are identifiable in both.
- The player marker tracks smoothly from 0 to 100% across a full race, ending exactly at the
  finish end of the strip.
- Works on both courses (`?course=alpine` and summit) with no per-course constants.
- Legible over both sky and ground; does not obscure the terrain.
- Built once at startup — confirm the profile geometry is not rebuilt per frame.
- `npm test` 8/8, `npm run build` clean, no console errors.

## Out of scope

Rivals (24), animal shapes (25), the post-race graph (26). Do not add gap-in-seconds
readouts — that is a rival-era decision and may not be wanted at all.
