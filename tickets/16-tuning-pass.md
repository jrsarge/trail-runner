# Ticket 16 — Balance pass and docs

**Depends on:** 17, 18, 14, 21, 15. Last ticket of v3.

This ticket is mostly **playing the game and reporting what you find**, not writing
features. Change numbers where numbers need changing; do not invent mechanics to fix a feel
problem, and do not re-enable the stumble.

## 1. The rule that must hold

**Retargeted by ticket 21 §4.** This used to be framed around pacing *allocation* (timid /
flat-out / uniform / paced — where along the course you spend). Ticket 21 measured that
allocation is worth under 1% of race time on either course, at any tuning tried — a
structural ceiling, not a bug (see DESIGN.md "Measured: pacing is worth ~1%") — and retuned
the tank and the knee (`STAMINA.BUDGET_MULT`, `MARGIN.BASE_DEG`) so the decision is **effort
level** instead: how hard you can hold, continuously, without blowing up. Run four lines and
report all four times plus where the tank ran out:

| Line | How |
| --- | --- |
| passive | ride the terrain's ideal lean the whole course — no push, no ease-off |
| all-out | maximum lean from the gun, holding it straight through the bonk |
| best sustained | the hardest *uniform* effort level you can hold without emptying the tank before the line |
| best paced | best sustained, plus allocation — conserve on the climbs/legs, spend on the flat/descent |

Required: **best sustained < all-out < passive**, and **best paced ≈ best sustained** (paced
is expected to beat sustained by roughly the ~1% allocation still buys — DESIGN.md's
finding — not by a lot; if it beats it by much more than that, something about this retune
changed the allocation ceiling and that is worth reporting as a new finding, not silently
tuning past).

- If all-out wins (ties or beats best sustained), the tank is too big relative to the
  redline term for this course, or the redline term is too cheap — the retune has failed and
  blowing up is not being punished.
- If passive wins, `SPEED.COMMIT_BONUS` is too small or the tank too small to reward pushing
  at all.
- Ticket 21 measured, on the tuning it shipped (`MARGIN.BASE_DEG: 20`,
  `STAMINA.BUDGET_MULT: 2.7`): summit passive 126.3 s, best sustained 85.5 s, all-out 111.4 s
  (bonks at t≈50 s / s≈510 m of 826 m); alpine passive 29.2 s, best sustained 20.3 s, all-out
  26.8 s (bonks at t≈10.5 s / s≈107 m of 191 m). Confirm or refute these with your own play —
  they were measured with a scripted servo holding a constant offset above ideal lean, not a
  human, so real play may find a different (likely slightly worse) best-sustained time.

## 2. Report a pacing table

Per section (flat / climb / descent / switchbacks): what lean felt right, what fraction of
the tank it consumed, and whether the section felt like a decision or an autopilot stretch.
Be specific — "the climb feels expensive" is useless; "the climb eats 40% of the tank for
23% of the distance, so I back off to +2° there and it costs me about a second" is useful.

Flag any section that is pure autopilot. Those are where the design is currently thin.

## 3. Known issue inherited from v2: `technical` doesn't bite

Measured after ticket 12: on a switchback leg the *margin* narrows correctly (~7.2° versus
14° on the flat), but `idealLean` is higher there too, so the **absolute** lean at which you
hit the knee mid-leg is ~15.2° — slightly looser than the flat's 14°. The legs only play
tight in a transient window near each fold.

So the switchback stack is currently not the hardest terrain on the course, which was the
entire point of `technical`. Either raise the leg values or narrow the margin by a term that
doesn't move with `idealLean`. Report what you changed and whether the stack finally plays
as the climax.

## 3a. Remove the wobble

Playtested and rejected as annoying — the same verdict the stumble got, and the same
pattern: twitchy, high-frequency things happening *to* the character read as irritating,
while steady things under the player's control (lean, speed, the tank) read as good.

Disable it behind `WOBBLE.ENABLED = false`, exactly as the stumble was retired in ticket 17.
**Keep the code and the constants** — including the `FULL_EFFORT` ramp fix — so it is a
one-line restore.

The burn band is also being removed (§3b), so after this ticket the stamina bar's **level and
colour** are the only cost feedback. See §3b's closing note — if that turns out to be too
little, report it; do not reinstate the wobble.

## 3b. Replace the burn band with a three-state stamina bar

**Supersedes the earlier "make the burn band contrast" instruction.** Playtested: the burn
band plus the orange warning fill was two warm colours competing on a 7 px strip, and the
simpler design below reads better. Do this instead.

**1. Delete the burn band entirely.** Remove the `.hud-stamina-burn` element, its CSS, the
rate-derivation code in `hud.js` (the `prevStaminaFraction` / `easedBurnFraction` /
`burnLookahead` block), and the now-unused `HUD.BURN_LOOKAHEAD_FRACTION` and
`HUD.BURN_EASE_TIME` constants. Keep `HUD.PACE_SMOOTH_TIME`.

**2. Three colour states, driven by tank level alone:**

| tank remaining | colour |
| --- | --- |
| above 60% | green |
| 60% down to 25% | yellow |
| 25% and below | red |

Thresholds go in constants (`HUD.STAMINA_YELLOW: 0.60`, `HUD.STAMINA_RED: 0.25`) — not
inlined in CSS — since they are tuning values. Pick colours that stay legible against both
the light sky and the dark ground the HUD floats over. A hard switch at each threshold is
fine and probably clearer than a gradient; do not animate the transition.

This replaces the old `.hud-stamina-fill.warning` orange state, which keyed off
`STAMINA.TIRED_FRACTION` (0.35). Leave `STAMINA.TIRED_FRACTION` itself alone — it drives the
runner's posture/gait tell (ticket 18 §4), which is a separate signal and should stay at
0.35.

**3. Add a `Stamina` label** above the bar, styled like the existing `TIME` / `DIST` row
labels (same size, weight and muted colour) so the block reads as one unit.

### Note the consequence, don't fix it

With the wobble removed (§3a) and the burn band gone, **nothing displays burn *rate* any
more** — only level. The bar shrinking quickly is still visible, and the colour states tell
you where you stand, so this is likely fine. But if during play you find you cannot tell
you are overcooking until the colour flips, **report that as a finding**. Do not reinstate
the wobble or the band.

## 4. Housekeeping

- **All tuning numbers in `src/constants.js`**, grouped, each group commented. Grep `src/`
  for stray look/feel literals. Leave pure math alone (`1e-4`, `180/Math.PI`, the
  parabola's `4`).
- Keep the switchback-clearance `console.assert`. Add one asserting the render clamp can
  express the largest body angle the game produces: `RUNNER.TILT_MAX_DEG` must cover
  `LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG`. This is the saturation trap from ticket 11 — when it
  bites, the symptom is "the mechanic feels dead" and it points nowhere near the cause.
- Do **not** delete the disabled stumble constants or code (DESIGN.md explains why).
- No unused constants otherwise.

## 5. Docs

- **`README.md`** — rewrite for v3: how to run, ← → controls lean, stamina is one tank you
  spend and never refill, the skill is arriving at the line empty. Delete the v1 one-button
  framing and any v2 stumble language.
- **`DESIGN.md`** — mark v3 as built. Where implementation differs from spec, fix the doc to
  match reality rather than leaving it aspirational. Update the calibration table with
  measured values if tuning moved them.
- Add **"What v3 deliberately does not have"**: no obstacles, no AI opponents, one course,
  desktop keyboard only, stumble disabled but restorable.

## Acceptance criteria

- All four timed lines reported with real numbers, in the required order.
- The per-section pacing table reported.
- A statement on whether *where* you spend genuinely matters, with evidence.
- `npm test` 8/8, `npm run build` clean, no console errors across several full races
  including a bonk and a restart.
- README and DESIGN.md describe the game that actually exists.

## Out of scope

New mechanics. Obstacles, AI, extra courses, sound, longer courses — all later. If the
balance pass makes one feel necessary, say so in the report and leave it to the human.
**A longer course is the most likely genuine finding here** — at ~25 s there may simply not
be room for spending decisions to compound. That is worth reporting as a conclusion.
