# Ticket 16 — Balance pass and docs

**Depends on:** 09–15. Last ticket of v2.

This one is different from the others: most of it is **playing the game and reporting what
you find**, not writing features. Where a number needs changing, say so and change it, but
do not invent new mechanics to fix a feel problem.

## 1. The rule that must hold — and it currently does NOT

**The optimum must sit past safe, but recklessness must not dominate.** Run *three* lines
and record all three times:

| Line | How |
| --- | --- |
| timid | stay well inside the margin the whole way |
| skilled | ride the wobble as close to the edge as you can without going down |
| reckless | hold maximum forward lean the entire race and just eat the stumbles |

Required ordering: **skilled < timid**, and **skilled < reckless**. The first says
aggression is rewarded; the second says control is rewarded.

### Known problem: a stumble currently costs far too little

Measured after ticket 12: **~0.4 s**, against the ~1.5 s DESIGN.md intends. The arithmetic,
at a ~9 m/s pace: `(9 − SKID_SPEED) × PITCH_TIME` ≈ 2.45 m lost in the pitch, plus ~1.6 m
through the recover ease ≈ 4 m ≈ 0.45 s.

That is cheap enough to invert the design. Maximum lean buys roughly +35% speed; tripping
every ~3 s costs only ~13%. So **the reckless line currently beats the skilled line**, which
makes the wobble, the margin, and the whole telegraph system decorative.

Getting to ~1.5 s needs roughly 13.5 m of loss. Sample combination: `PITCH_TIME` 0.8,
`RECOVER_TIME` 1.2, `SKID_SPEED` 0.5. **But do not just apply those numbers** — a ~2 s
recovery may feel sluggish and punishing to play, which is its own failure. Tune it, play
it, and report what the stumble cost *and* how it felt. If a penalty long enough to matter
also feels bad, say so plainly: that is real evidence for the stamina alternative in
DESIGN.md's open question, and it is the human's call, not yours.

Dials: `STUMBLE.PITCH_TIME` / `RECOVER_TIME` / `SKID_SPEED` (raise the cost),
`SPEED.COMMIT_BONUS` (lower to reduce what recklessness buys).

## 2. Report a tuning table

Play the course several times and report, per section (flat / climb / descent / switchbacks):

- Roughly what lean feels right, and whether the margin feels too tight or too loose there.
- Whether any section is trivially safe or unfairly punishing.
- Whether the descent's two-sided risk (slip when leaning back) actually reads as scarier
  than the climb. It should — that's the design.

### Known problem: `technical` doesn't bite where it was supposed to

Measured after ticket 12: on a switchback leg the *margin* does narrow as intended (~7.2°
versus 14° on the flat), but `idealLean` is higher there too, so the **absolute** lean at
which you trip mid-leg is ~15.2° — slightly *higher* than the flat's 14°. The legs only play
tighter than the flat in a transient window near each fold (~9–12°).

So the switchbacks are currently not the hardest terrain on the course, which was the entire
point of adding `technical`. Either raise the leg values, or narrow the margin by a term
that doesn't move with `idealLean`. Report what you changed and whether the stack finally
plays as the climax.

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
