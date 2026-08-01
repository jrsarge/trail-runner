# Ticket 16 — Balance pass and docs

**Depends on:** 09–15. Last ticket of v2.

This one is different from the others: most of it is **playing the game and reporting what
you find**, not writing features. Where a number needs changing, say so and change it, but
do not invent new mechanics to fix a feel problem.

## 1. The one rule that must hold

**The optimum must sit past safe.** Verify empirically, not by reading the code:

- Run the course leaning conservatively (stay well inside the margin) and record the time.
- Run it riding the wobble as close to the edge as you can and record the time.
- **The aggressive run must be meaningfully faster** — target at least 2 s over ~27 s, even
  after paying for a stumble or two.

If conservative running is as fast, or if one stumble wipes out the entire gain from a
whole race of aggression, the risk/reward is broken. Report the numbers either way. The
dials are `SPEED.COMMIT_BONUS` (raise to reward aggression) and `STUMBLE` durations (lower
to make stumbles cheaper).

## 2. Report a tuning table

Play the course several times and report, per section (flat / climb / descent / switchbacks):

- Roughly what lean feels right, and whether the margin feels too tight or too loose there.
- Whether any section is trivially safe or unfairly punishing.
- Whether the descent's two-sided risk (slip when leaning back) actually reads as scarier
  than the climb. It should — that's the design.

This is the input the human will tune from, so be specific and honest. "The switchbacks
feel punishing" is useless; "the switchbacks trip me at about 8° of forward lean, which is
less than it takes to feel like I'm pushing" is useful.

## 3. Housekeeping

- **All tuning numbers in `src/constants.js`**, grouped, each group with a one-line comment.
  Grep `src/` for stray look/feel literals. Leave pure math alone (`1e-4`, `180/Math.PI`,
  the parabola's `4`).
- Remove dead v1 constants: big-hop values, `RUN_SPEED`, `TILT_FACTOR`, the deleted camera
  `STACK_X` / `STACK_Y` / `STACK_MIN_WIDTH`.
- Keep the startup `console.assert` for switchback clearance; add one asserting the render
  clamp can express the largest body angle the game produces — `RUNNER.TILT_MAX_DEG` must
  cover `LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG` and, separately, `STUMBLE.PITCH_DEG` (see
  ticket 12's clamp note). This is the saturation trap from ticket 11: when it bites, the
  symptom is "the mechanic feels dead" and it points nowhere near the cause.
- No unused constants.

## 4. Docs

- **`README.md`** — rewrite for v2: how to run, that ← → controls lean, that the skill is
  riding the edge, and where to tune (`src/constants.js`). Delete the v1 "one-button hop"
  framing entirely; it is now wrong.
- **`DESIGN.md`** — mark v2 as built. If anything was implemented differently from the
  spec, fix the doc to match reality rather than leaving it aspirational.
- Add a short **"What v2 deliberately does not have"** section: no obstacles, no AI
  opponents, one course, desktop keyboard only. Note these are shaped-for but not built,
  and point at the racer/controller and course-registry seams.

## Acceptance criteria

- The conservative-vs-aggressive timing comparison is reported with real numbers, and the
  aggressive line is faster.
- The per-section tuning table is reported.
- `npm test` 8/8, `npm run build` clean, no console errors or failed assertions across
  several full races including stumbles and restarts.
- README and DESIGN.md describe the game that actually exists.

## Out of scope

New mechanics. Obstacles, AI, extra courses, sound, and steeper terrain variants are all
**later** — if the balance pass makes one of them feel necessary, say so in the report and
leave it for the human to decide.
