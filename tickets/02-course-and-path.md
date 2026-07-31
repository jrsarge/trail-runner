# Ticket 02 — Course data and the arc-length path module

**Depends on:** 01.

This is the foundation every other ticket reads from. It is pure math with no three.js
imports, and it is the one ticket verified by unit tests rather than by eye.

## Goal

`src/course.js` holds the canonical course. `src/trailPath.js` turns it into a filleted
polyline with arc-length parameterization: given a distance `s` along the trail, return
the world position and the unit tangent.

**Arc length — not x — is the independent variable.** The switchbacks double back, so x is
not monotonic and `heightAt(x)` is not a well-defined function. Everything downstream
tracks `s`.

## Files

- `src/course.js`
- `src/trailPath.js`
- `test/trailPath.test.js`

## `src/course.js`

Transcribe the canonical table from DESIGN.md exactly. No other file may contain these
numbers.

```js
export const COURSE_START = { x: 0, y: 0 };

export const COURSE = [
  { type: 'flat',   to: { x:  20, y:  0.0 } },
  { type: 'smooth', to: { x:  60, y: 12.0 }, samples: 24 },
  { type: 'smooth', to: { x:  95, y:  4.0 }, samples: 20 },
  { type: 'leg',    to: { x: 113, y:  7.2 } },
  { type: 'leg',    to: { x:  95, y: 10.4 } },
  { type: 'leg',    to: { x: 113, y: 13.6 } },
  { type: 'leg',    to: { x:  95, y: 16.8 } },
  { type: 'leg',    to: { x: 113, y: 20.0 } },
  { type: 'flat',   to: { x: 120, y: 20.4 } },
];

// Index of the first `leg` segment. Camera and ground-bed code need to know where the
// switchback stack begins; derive the arc length at runtime, don't hardcode it.
export const FIRST_LEG_INDEX = 3;

// Decorative only. See ticket 03. Has no geometric relationship to the course.
export const BACKDROP = { /* ticket 03 fills this in */ };
```

## `src/trailPath.js`

### Resolving segments to raw vertices

- `flat` and `leg`: straight line, just the end point.
- `smooth`: `samples` intermediate points, x linear, y by
  `smoothstep(t) = t*t*(3 - 2*t)`. Hills are flat at the bottom and top, steepest in the
  middle.

### Filleting sharp corners

Walk interior vertices. Compute the turn angle between the incoming and outgoing edges. If
the direction changes by more than `PATH.FILLET_MIN_TURN_DEG` (60°), replace the vertex
with a quadratic Bézier:

- `r = min(PATH.CORNER_RADIUS, 0.45 * shorterAdjacentEdgeLength)` — the 0.45 guard stops
  fillets on adjacent short edges from overlapping each other.
- Trim `r` back along each adjacent edge to get `p0` and `p2`; the original vertex is the
  control point `p1`.
- Splice in `p0`, then `PATH.FILLET_SAMPLES` (8) **interior** Bézier samples at
  `t = k / (FILLET_SAMPLES + 1)` for k = 1..8 (so t runs 1/9 … 8/9, excluding the
  endpoints), then `p2`. The endpoints are added explicitly and are not among the 8 —
  this is what makes the 190.63 reference length reproducible.

This exists so `tangentAt` never has to evaluate at an undefined corner. The switchback
vertices are ~170° turns and are the reason for it.

### API

```js
export function buildPath(segments = COURSE, start = COURSE_START) -> TrailPath
```

`TrailPath` exposes:

| Member | Behavior |
| --- | --- |
| `points` | resolved polyline, array of `{x, y}`, fillets applied |
| `cumulative` | `cumulative[i]` = arc length from the start to `points[i]`; `[0] === 0` |
| `length` | total arc length |
| `pointAt(s)` | `{x, y}`, linear interpolation within the containing segment. Clamps: `s <= 0` → first point, `s >= length` → last point |
| `tangentAt(s)` | **unit** `{x, y}` of the containing segment's direction. Clamped like `pointAt` |
| `segmentStartS(index)` | arc length at which resolved segment `index` begins — used to find where the switchback stack starts |

Find the containing segment with a **binary search** over `cumulative`, not a linear scan —
`pointAt` is called several times per frame.

## Constants to add

```js
export const PATH = {
  CORNER_RADIUS: 1.6,
  FILLET_SAMPLES: 8,
  FILLET_MIN_TURN_DEG: 60,
};
```

## Acceptance criteria

`npm test` passes, covering:

1. A hand-built 2-point straight path of known length reports that `length`.
2. `pointAt(0)` equals the start point; `pointAt(path.length)` equals the last point;
   both `pointAt(-5)` and `pointAt(length + 5)` clamp rather than returning `NaN`.
3. **Arc-length correctness:** for ~200 sample values of `s`, the distance between
   `pointAt(s)` and `pointAt(s + 0.05)` is within 1% of `0.05`. This is the property the
   whole motion model depends on — if it fails, the runner's speed varies with terrain.
4. `tangentAt` on the flat start segment is `(1, 0)`; every returned tangent has unit
   length (within 1e-6).
5. **At a switchback:** sampling `tangentAt` across a filleted corner, `tangent.x` goes
   from positive to negative, and consecutive `pointAt` samples across the corner are C0
   continuous (no jump larger than the sample step × 1.01).
6. Filleting strictly shortens the path: filleted `length` < unfilleted `length`.
7. The real `COURSE` builds without throwing, and its `length` is between 188 and 194.
   The reference implementation gives **190.63 m** filleted (196.57 unfilleted) — if you're
   outside that window, something in the segment table was transcribed wrong.
8. The real `COURSE` fillets exactly **4** corners — the interior switchback reversals. The
   valley at `(95, 4)` and the summit at `(113, 20)` are under the 60° threshold and stay
   sharp. A different count means the turn-angle computation is wrong (a common bug is not
   wrapping the angle difference into ±180°).

## Out of scope

Any rendering. Any three.js import in these two files. Elevation-gain math (ticket 07).
