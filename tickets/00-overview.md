# Ticket 00 — Overview & rules for all tickets

Read [DESIGN.md](../DESIGN.md) first. It is the spec. These tickets implement it.

## Rules that apply to every ticket

1. **All tuning numbers live in `src/constants.js`.** If you need a number that affects
   look or feel, add it there and import it. Do not inline magic numbers in modules.
2. **`MeshBasicMaterial` only. No lights, no shadows, no `MeshStandardMaterial`.** This is
   a flat 2D scene; a lit material with no light in the scene renders black.
3. **Orthographic camera, XY plane, Z used only for layering.** Nothing is perspective.
4. **Course geometry appears in `src/course.js` and nowhere else.** Read the built path.
5. **No physics engine, no collision detection.** Motion is parametric (see DESIGN.md).
6. **No new runtime dependencies beyond `three`.** Tests use built-in `node --test`.
7. **Do not add a fail state, obstacles, gaps, stamina, or a speed/momentum model.** These
   were explicitly excluded. See the open design question in DESIGN.md.
8. Stop when the acceptance criteria pass. Don't gold-plate past the ticket.

## Verifying in the browser

`npm run dev`, then open the served URL. Every ticket except 02 has acceptance criteria
you can see on screen — actually look at it before calling the ticket done. Check the
browser console for errors too; a silent WebGL or module failure looks like a blank page.
