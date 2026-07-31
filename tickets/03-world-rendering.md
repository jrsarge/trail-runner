# Ticket 03 — World rendering: ground bed, trail ribbon, backdrop, markers

**Depends on:** 02.

## Goal

The whole course is visible and reads as a trail cut into a hillside. Temporarily frame the
camera wide enough to see the entire course at once so you can check it, then leave the
camera helper alone (ticket 06 takes it over).

## Files

- `src/world.js` — exports `buildWorld(path)` returning `{ group, updateParallax(camX) }`.
- `src/course.js` — fill in the `BACKDROP` export.
- `src/main.js` — add the world group to the scene, call `updateParallax` each frame.

## Z layers

Depth ordering is by z position; distinct z values plus the default depth test is enough,
no `renderOrder` needed. Add to constants:

```js
export const Z = {
  SKY: -5, RIDGE_FAR: -4, RIDGE_NEAR: -3, MOUNTAIN: -2,
  BED: 0, TRAIL: 0.5, MARKER: 0.8, RUNNER: 1,
};
```

## 1. Sky gradient

One large quad, x ∈ [−150, 400], y ∈ [−40, 80], at `Z.SKY`. `BufferGeometry` with
`vertexColors: true` on a `MeshBasicMaterial`: bottom vertices `SKY_BOTTOM`, top vertices
`SKY_TOP`. World-fixed — the sky legitimately gets deeper as the runner climbs.

## 2. Ground bed — read this carefully

The switchback legs overlap in x, so filling every leg down to the floor would bury the
stack in one solid slab of green. The bottom edge of the bed is therefore **variable**,
giving the stack banked ledges with hillside showing between them:

(Ribbon *visibility* is guaranteed separately by z-order — all trail ribbons sit at
`Z.TRAIL` 0.5, in front of every bed at `Z.BED` 0. The bed thickness is about the look:
distinct ledges rather than a slab.)

```js
const sStack = path.segmentStartS(FIRST_LEG_INDEX);   // where the zig-zag begins
// per path point i, at arc length s:
const t = smoothstep01((s - (sStack - WORLD.BED_BLEND)) / WORLD.BED_BLEND); // 0→1
const bottomY = lerp(WORLD.FLOOR_Y, p.y - WORLD.BED_THICKNESS, t);
```

Solid ground under the rolling hills; 2.2 m banked ledges on the stack (less than the 3.2 m
leg spacing, so the ledge below stays visible); a smooth 3 m transition between them.

Build as one triangle strip: two vertices per path point (`{p.x, p.y}` and
`{p.x, bottomY}`), `COLORS.GROUND`, at `Z.BED`.

### Apron: the bed must extend past both ends of the path

The path starts at x=0 and ends at x=120, but the camera sees beyond both. Without an
apron, the ground just stops in mid-air at the start line — which is the very first thing
the player sees. Extend the bed by `WORLD.APRON` (20 m) before the start and after the
finish, held flat at the respective end's height, down to `FLOOR_Y`. The trail ribbon does
**not** get an apron — only the ground.

## 3. Trail ribbon

Triangle strip offsetting each path point by `±TRAIL_WIDTH / 2` along the path **normal**
(perpendicular to `tangentAt`), `COLORS.TRAIL`, at `Z.TRAIL`. Covers the full path
including the switchbacks, which is what makes the zig-zag legible.

## 4. Backdrop (decorative — no geometric constraints)

Two parallax ridge polygons plus one mountain silhouette behind the stack. **These are
hand-authored art. Do not try to make the mountain "contain" the switchbacks** — the ledge
bed already handles that; the mountain just fills the ~1 m gaps between ledges so they read
as cut into a hillside.

Add to `src/course.js`:

```js
export const BACKDROP = {
  // Sawtooth ridgelines, deliberately overlong in x so they never run out of view.
  ridgeFar: {
    parallax: 0.12, color: 'RIDGE_FAR', baseY: -10,
    points: [[-150, 14], [-40, 26], [30, 12], [90, 30], [150, 16], [230, 32], [400, 18]],
  },
  ridgeNear: {
    parallax: 0.30, color: 'RIDGE_NEAR', baseY: -10,
    points: [[-150, 4], [-30, 14], [40, 2], [110, 20], [180, 6], [260, 18], [400, 8]],
  },
  // World-fixed (no parallax) so it stays put behind the switchback stack.
  mountain: {
    color: 'MOUNTAIN',
    points: [[76, -10], [80, 4], [87, 12], [93, 20], [100, 25], [109, 24], [117, 20],
             [126, 12], [132, -10]],
  },
};
```

Each ridge is a filled polygon: its `points` as the top edge, closed down to `baseY`.
Parallax: `mesh.position.x = camX * (1 - parallax)`, so `parallax` is how much the layer
appears to move (0 = pinned to camera, 1 = world-fixed). That's the whole of
`updateParallax(camX)`.

## 5. Start and finish markers

- **Start:** thin vertical post, 0.12 × 2.0, at `path.pointAt(0)`, `COLORS.FINISH`.
- **Finish:** at `path.pointAt(path.length)` = `(120, 20.4)`, a post 0.14 × 2.6, plus a
  checkered flag panel **2.2 wide × 1.1 tall** — a 6-column × 3-row grid alternating
  `COLORS.FINISH` and `COLORS.FINISH_DARK`. The panel hangs from the top of the post and
  extends in **−x**, i.e. back over the trail the runner arrives along, spanning
  x ∈ [117.8, 120] and y ∈ [21.9, 23.0]. Both at `Z.MARKER`.

  It must be **wider than it is tall** and hang over the trail, so it reads as a finish
  gate the runner passes under. A narrow vertical strip just reads as a striped pole.

Make the checker a single geometry with vertex colors, or 18 small quads in one group —
either is fine, don't reach for a texture.

## Constants to add

```js
export const WORLD = {
  // FLOOR_Y must sit below the lowest the camera can ever see. The FOLLOW shot at the
  // start line centers on y = 1.2 with halfHeight 9, so its bottom edge is y = -7.8;
  // a floor at -6 leaves sky showing under the ground. -12 gives margin.
  FLOOR_Y: -12,
  BED_THICKNESS: 2.2,
  BED_BLEND: 3.0,
  TRAIL_WIDTH: 0.36,
  APRON: 20,
};
```

## Acceptance criteria

Look at it in the browser:

- Framed wide, the full course silhouette is recognizable: flat start, a rounded hill up, a
  hill down, then a zig-zag stack of five ledges with a checkered finish banner at the top.
- **All five switchback legs read as distinct banked ledges**, with hillside/backdrop
  visible in the gaps between them — not one solid green slab with ribbons drawn on it. If
  you get the slab, `BED_THICKNESS` or the blend is wrong.
- The bed transition into the stack is smooth — solid ground under the hills, ledges on the
  stack, no visible hard step where the two meet.
- **At the start line, framed as the game will frame it** (center `(0, 1.2)`, halfHeight 9):
  ground fills the bottom of the screen edge to edge. No sky below the ground, and no
  vertical cliff where the bed begins. Same at the finish.
- The finish marker reads as a **banner hanging over the trail**, wider than tall — not a
  thin striped pole.
- The trail ribbon is continuous with rounded corners at each switchback — no gaps, no
  self-intersecting spikes at the turns.
- Scrolling the camera x by hand moves the two ridge layers at visibly different rates, and
  the mountain silhouette does not move relative to the stack.
- No console errors. Nothing renders black (that would mean a lit material sneaked in).

## Out of scope

The runner, input, the real camera behavior, the HUD.
