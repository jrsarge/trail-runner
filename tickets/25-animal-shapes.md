# Ticket 25 — Animal shapes

**Depends on:** 24.

## Why

Rivals are woodland creatures — simple blocky animals that hop and kick up dust exactly like
the player's runner. Pure charm plus visual identification; **the species must not telegraph
the pacing plan** (DESIGN.md "Roles are course data, not species"). A tortoise winning is a
delight precisely because you expected it to plod.

## Spec

Extend `createRunner(path, palette)` to take a `shape` — a small block layout rather than
the fixed two squares. Each animal is a handful of `PlaneGeometry` quads in the existing
group: body, head, and one or two silhouette cues (ears, shell, antlers, hump).

Shapes: `hare`, `tortoise`, `deer`, `goat`, `bear`, plus `runner` (the player's existing
two-square figure, unchanged).

Keep them blocky and flat — same visual language as the runner, `MeshBasicMaterial`, no
lights. Readable in silhouette at the ticket-22 camera distance is the bar; detail below
that is wasted.

## THE TRAP: height is load-bearing

`RUNNER.HEIGHT` (1.55) is not decorative. There is a startup `console.assert` that
`RUNNER.HEIGHT + HOP.GAIT_APEX < 3.2`, the switchback leg spacing — exceed it and heads clip
the ledge above mid-leg (DESIGN.md, mid-leg clearance).

**Every animal must respect the same ceiling.** Ears and antlers count. Either keep all
shapes within `RUNNER.HEIGHT`, or make the assert cover the tallest shape rather than the
constant. Do not silently let a deer's antlers break a constraint the project has protected
since ticket 02.

Also: the pose pipeline composes lean in the travel frame and mirrors with `scale.x = flip`.
Any asymmetric shape (a head that sticks forward, a tail) must be built so mirroring reads
correctly on the leftward switchback legs — check a deer facing left before calling this
done.

## Acceptance criteria

- Screenshot every animal at the game's actual camera distance. Each must be identifiable in
  silhouette, not just up close.
- All animals hop and kick dust identically to the player's runner — same gait, same
  landings.
- A leftward switchback leg screenshot for at least one asymmetric shape, confirming the
  mirror reads correctly.
- The height assert covers the tallest shape and passes.
- No animal's head or ears clip the ledge above mid-leg on the switchback stack — check
  visually on the stack, not just numerically.
- Frame rate holds with a full field.
- `npm test` 8/8, `npm run build` clean, no console errors.

## Out of scope

Animation beyond the existing gait, per-animal speed or stamina differences (plans own
that, ticket 24), the post-race graph (26).
