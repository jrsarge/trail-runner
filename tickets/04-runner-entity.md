# Ticket 04 — Runner entity

**Depends on:** 02, 03.

## Goal

The two-square character exists on the trail, sits correctly on the ground at any arc
length, and faces the direction of travel — including a readable turn at the switchbacks.
Ticket 05 makes it move; here you place and pose it.

## Files

- `src/runner.js` — exports `createRunner(path)` returning a runner object.
- `src/main.js` — create the runner, add to scene, drive it from `update`.

## Anatomy

Two `PlaneGeometry` quads in a `Group`, `MeshBasicMaterial`, at `Z.RUNNER`. The group's
origin is at the **feet** — that's the point that sits on the trail.

| Part | Size | Color | Center y (feet at 0) |
| --- | --- | --- | --- |
| body | 0.62 × 0.95 | `RUNNER_BODY` | 0.475 |
| head | 0.50 × 0.50 | `RUNNER_HEAD` | 0.95 + 0.10 + 0.25 = 1.30 |

Total height 1.55 m. This number is load-bearing: 1.55 + `HOP_APEX` (0.9) = 2.45 must stay
under the 3.2 m switchback leg spacing. If you change the runner's height, say so.

## Placement

```js
runner.setGroundS(s)    // position from arc length, plus an optional vertical hop offset
```

- `group.position.x/y` = `path.pointAt(s)`, plus the hop offset ticket 05 supplies.

### Tilt to the slope — and the mirror sign trap

Do **not** set `rotation.z` to the raw angle of the tangent. On a leftward leg that angle is
~170°, which would stand the runner on their head. Use the slope in the *travel frame*,
which is naturally facing-invariant:

```js
const d = path.tangentAt(s);                       // unit, points along travel
const slope = d.y / Math.max(Math.abs(d.x), 1e-4); // >0 = uphill ahead, either direction
const tilt  = clamp(Math.atan(slope) * RUNNER.TILT_FACTOR,
                    -maxRad, maxRad);              // RUNNER.TILT_MAX_DEG = 22°
group.rotation.z = -tilt * flip;                   // ← both the minus and the flip matter
```

**Why `* flip`:** three.js composes as `T·R·S`, so mirroring with `scale.x = -1` and *then*
rotating is equivalent to rotating by the negated angle. Without the `* flip`, the lean
inverts on the leftward legs. (Bonus: mid-turn `flip` passes through 0, so the runner is
briefly upright during the pivot, which looks right.)

**Why the leading minus:** the runner's body extends along local **+Y**, and that's the
axis whose lean you see. Local up `(0,1)` maps to `(-sin θ, cos θ)`, so a *positive*
`rotation.z` tips the head toward −x — backward, for a rightward runner. The minus makes an
uphill `tilt` lean the head into the direction of travel. Verify by measuring the head's
world x-offset against the tangent's x-sign, on **both** a rightward and a leftward leg.

The `max(|d.x|, 1e-4)` guard matters — `d.x` reaches ~0 inside a filleted corner, where
`slope` explodes and the clamp is what saves you. The clamp is not optional.

## Facing — the part that goes wrong if rushed

`sign(tangent.x)` is undefined at a corner and flips discontinuously either side of one, so
a raw read produces a one-frame snap that looks like a rendering bug. Three pieces:

1. **Deadband + hysteresis.** Only update the facing target when
   `|tangent.x| > RUNNER.FACING_DEADBAND` (0.30). Inside the deadband — i.e. mid-corner,
   where the path is briefly near-vertical — hold the last known facing.
2. **Animated flip.** Keep a `flip` value that eases toward the target (`-1` or `+1`) over
   `RUNNER.FLIP_TIME` (0.15 s) and set `group.scale.x = flip`. Passing through zero
   squashes the runner briefly, which reads as planting and pivoting. Guard against exactly
   `scale.x === 0` (use a small epsilon) — a zero scale can produce a degenerate matrix.
3. Facing starts at `+1`.

## Gait bob (placeholder only)

Add a `runner.setHopOffset(dy, squash)` setter now and leave it at zero. Ticket 05 owns all
vertical motion. Do **not** add a sine-wave bob here; it will fight the hop system.

## Constants to add

```js
export const RUNNER = {
  BODY_W: 0.62, BODY_H: 0.95,
  HEAD_S: 0.50, HEAD_GAP: 0.10,
  HEIGHT: 1.55,               // derived; keep in sync with the above
  TILT_FACTOR: 0.5, TILT_MAX_DEG: 22,
  FACING_DEADBAND: 0.30, FLIP_TIME: 0.15,
};
```

## Acceptance criteria

Add a temporary debug control (e.g. left/right arrow keys scrubbing `s`, removed or kept
behind a flag in ticket 05) and check in the browser:

- The runner's feet stay planted on the trail ribbon at every point along the course — not
  floating above it, not sunk into it, including on the steep middle of the climb.
- Scrubbing through a switchback corner, the runner **turns** — squashes horizontally and
  comes out facing the other way — with no single-frame snap or flicker.
- Held stationary inside a corner, the facing does not oscillate.
- The runner leans into the climb, noticeably but not lying flat against the slope.
- **On a leftward switchback leg, the runner leans in the direction of travel — leftward and
  forward — not backward.** Test this explicitly on a leftward leg, not just on the climb: a
  wrong-sign tilt still looks plausible on rightward segments and still keeps the head above
  the body, so the other criteria will not catch it. This is the `* flip` above.
- The head stays above the body on the leftward legs (facing flips x only, never y).

## Out of scope

Hopping, input, automatic motion, dust, camera.
