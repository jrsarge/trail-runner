# Trail Hop — Design

A 2D side-view trail running game in three.js. One short race: flat start, up a hill, down
a hill, up a switchback stack, finish line at the top.

**Status:** v1 (one-button hop) shipped. v2 (lean) shipped through ticket 13. **v3 is built
and complete**: it replaces the stumble with stamina (tickets 17–18), adds the terrain-block
vocabulary and the long `summit` course (19–20), retunes the camera (14), retunes the tank
and the knee around sustained **effort level** rather than pacing **allocation** (21), builds
the HUD (15), and closes with the balance pass and doc pass (16) — the wobble telegraph is
now retired alongside the stumble, the switchback stack's `technical` value was raised so it
plays as the intended climax, and this document has been brought back in sync with what
actually shipped.

**Execution order — the numbers no longer imply it:**

```
17 → 18 → 19 → 20 → 14 → 21 → 15 → 16
```

17 and 18 changed the model (done). 19 and 20 build the terrain-block vocabulary and the
long course, because measurements on the 190 m course showed pacing *allocation* is worth
under a second there and ~3.5% is a **structural ceiling no tuning moves** — the course, not
the tuning, is the limit (see "Measured: pacing is worth ~1%" below). 14 (camera) is
independent. That finding held even on the longer `summit` course — allocation stayed worth
~1% regardless of length — so 21 changes what's being measured: instead of chasing where you
spend a small tank, it derives a much bigger tank per course and asks how hard you can hold
effort without emptying it, which the same measurements showed is worth **~40 s**, not ~1%.
15 (HUD) must follow 18 so the stamina meter is built once; 16 (balance pass) is last, with
both courses and 21's retune in hand.

---

# v3 — Stamina is the game

## The core loop

The player controls **lean** with ← and →. Hopping is the automatic gait; there is no hop
button. Leaning forward is faster and costs stamina; leaning back is slower and costs less.

**Stamina is a one-way budget.** It starts full, only ever decreases, and never refills.
Backing off does not recover it — it only slows the burn. You have one tank for the whole
course, and every input decides how fast you are spending it. The tank is **derived per
course** at build time, not a fixed number — see "Effort and cost" below — so this holds for
a 191 m course and an 826 m course alike.

**The skill is holding the hardest effort you can sustain, not choosing where to spend it**
(ticket 21). Early tuning aimed the player at arriving with the tank at exactly zero through
*allocation* — pacing yourself section to section. Measured, that turned out to be worth
under 1% of race time regardless of course length or tuning (see "Measured: pacing is worth
~1%" below) — a structural dead end, not a bug. What the same measurements found instead: a
tank sized to afford roughly a minute of maximum-lean running rewards **engaged, sustained
effort** by ~40 s over passive play, while still making an all-out sprint-to-empty-then-bonk
line clearly slower than holding just under your limit. Pacing *within* that — conserving on
the expensive climbs, spending on the cheap descents — still helps a little (allocation adds
roughly another 1%, same structural ceiling as before), but it is no longer the point. The
question the game asks every second is "how hard can I hold this without blowing up," not
"where should I spend."

### Why the stumble is gone

v2 punished over-leaning by tripping the runner. Built and playtested, it read as annoying
rather than tense, and the numbers agreed: a stumble cheap enough not to feel punishing
(~0.4 s) was too cheap to shape play, and one expensive enough to shape play felt bad. That
is not a tuning problem you can escape.

Stamina replaces it with a cost rather than a punishment. **Do not delete the stumble code —
disable it behind `STUMBLE.ENABLED = false`** (ticket 17). If stamina proves thin, it should
be cheap to get back.

## Effort and cost

The margin (which shrinks on steep and technical ground) stops being a trip threshold and
becomes the **knee in the drain curve**. Under it, effort is cheap. Past it, stamina pours
out.

```
balance    = lean - idealLean            // degrees above what the terrain wants
effort     = balance / costMargin        // 1.0 = at the knee
costMargin = clamp(MARGIN.BASE_DEG - MARGIN.SLOPE_NARROW * |slopeDeg|,
                   MARGIN.MIN_DEG, MARGIN.BASE_DEG) / path.technicalAt(s)

drain = (STAMINA.FLOOR
       + STAMINA.PUSH    * max(0, effort)
       + STAMINA.REDLINE * max(0, effort - 1)^2) * terrainFactor
```

The squared redline term is what makes sprinting self-limiting: it is affordable in bursts
and ruinous if held.

There is a **floor drain at all times**, even leaning back. You can prolong the tank; you
can never preserve it.

### Speed must NOT use the same denominator

This is the trap. `costMargin` shrinks with `technical`, so if speed also divided by it, the
runner would go **faster** on technical ground at identical lean — technical terrain would
become a speed bonus, the exact opposite of the intent.

Speed uses a **fixed reference**, cost uses the technical-scaled margin:

```
commit = balance / SPEED.REF_DEG         // fixed constant, never scaled by technical
speed  = SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * gain(commit))
speed  = min(speed, SPEED.MAX)

gain(c) = c                                                   for c <= 1
        = 1 + SPRINT_GAIN * (1 - exp(-(c - 1) / SPRINT_FALLOFF))  for c > 1
```

Leaning further always goes faster — you can **sprint** — but with sharply diminishing
returns above the knee, while cost rises quadratically. So a sprint is a real decision, not
a free win.

### Terrain: where you spend

Effort is not "how far forward you lean" — it is how far you are from what the terrain
wants, in the expensive direction. Which direction is expensive flips:

| | Expensive | Cheap |
| --- | --- | --- |
| **Climbing** | leaning forward, scaled by grade | easing off |
| **Descending** | leaning back — braking against the fall line | riding the fall line |

```
terrainFactor = slope > 0 ? 1 + STAMINA.CLIMB_COST * sin(slope)
                          : max(STAMINA.DESCENT_MIN, 1 - STAMINA.DESCENT_RELIEF * sin(-slope))
```

Braking on a steep descent adds `STAMINA.BRAKE_COST * |effort| * sin(|slope|)` — so there is
still no free safe option going downhill, which was v2's best idea and survives intact.

**This produces the strategy the game is about:** climbs are expensive and slow, descents
are cheap and fast. Conserve up, spend down. The switchback stack, being 91 m of climbing,
is where the race is won or lost.

### Calibration (integrated over the real course, not estimated)

There is no fixed `STAMINA.MAX` (ticket 21 §1 deleted it). The tank is **derived per
course** at build time: integrate the drain an ideal-lean runner (balance = 0, so just the
floor term) would burn over the whole path, then scale by `STAMINA.BUDGET_MULT` (2.7) — see
`computeStaminaMax` in `locomotion.js`. Measured baselines and derived tanks:

| course | length | baseline spend | tank (`× 2.7`) |
| --- | --- | --- | --- |
| alpine | 191 m | ~84 | ~225 |
| summit | 826 m | ~365 | ~987 |

Holding a constant lean above ideal for the whole course (real engine, current tuning —
`MARGIN.BASE_DEG: 20`, switchback `technical: 2.0` as of ticket 16 §3, up from 1.6):

| lean above ideal | alpine finish | alpine spent | summit finish | summit spent |
| --- | --- | --- | --- | --- |
| +0° (ride ideal) | 29.0 s | 83.5 | 126.1 s | 365.4 |
| +10° | 23.2 s | 147.7 | 100.8 s | 563.8 |
| +15.90° (best, alpine) | **20.95 s** | 225.1 | — | — |
| +21.32° (best, summit) | — | — | **86.42 s** | 986.8 |
| past best | bonks | 225.4 (empty) | bonks | 987.0 (empty) |

(Ticket 21 shipped this table at +19.5°/20.3 s and +23°/85.5 s, against the original
switchback `technical: 1.6`. Raising it to 2.0 in ticket 16 §3 tightened the switchback
stack's cost margin, which lowers the globally-uniform offset a "best sustained" line can
hold everywhere — including the now-harder stack — without bonking. Both courses are ~1-3%
slower at their best-sustained line than before; see the ticket 16 report for the full
before/after comparison.)

The best sustainable uniform line on each course spends nearly the whole tank without
emptying it before the line; anything harder bonks, anything easier leaves speed on the
table. **Non-uniform pacing (allocation) still beats every uniform line** — spending on the
cheap descent and conserving on the expensive climb remains worth roughly another 1% (see
"Measured: pacing is worth ~1%" below). If a flat line is optimal, the terrain factors are
too weak. Ticket 21 does not chase that 1% further; it is not where the game's decision
lives — see "The core loop" above.

## Running out

Hitting zero does not stop you and does not trip you. You **bonk**: `commit` is capped at 0
(you can no longer lean above ideal — no pushing, no sprinting) and speed is multiplied by
`STAMINA.EXHAUSTED_MULT`.

A hard crawl was considered and rejected: at 1.5 m/s, emptying at 60% distance leaves ~50
seconds of shuffling — longer than the entire race, and far worse than a clean failure. The
penalty is losing your **upside**, not being frozen. Both values are constants, so a harsher
bonk is one number away.

## Telegraphing

v3 originally gave the wobble a **new meaning**: past `WOBBLE.ONSET` of the knee it would say
"this is costing you" instead of "you are about to fall." Built and playtested (ticket 16
§3a), it got the same verdict as the stumble it descended from — a twitchy, high-frequency
thing happening *to* the character read as annoying rather than tense. **Retired, not
deleted**: `WOBBLE.ENABLED = false` in `src/constants.js`, same pattern as
`STUMBLE.ENABLED`, so it is a one-line restore (including the `FULL_EFFORT` ramp fix, kept
working for exactly that reason).

What replaced it was a **stamina meter with a burn-rate band** — a bright band at the
depleting edge sized to the stamina that would drain over the next few seconds at the
current rate — but playtesting that (ticket 16 §3b) found it competed for attention with the
bar's own low-tank warning colour on the same 7 px strip. It too is gone. What's left is
deliberately plain: a **three-colour tank-level readout** (green above
`HUD.STAMINA_YELLOW`, yellow down to `HUD.STAMINA_RED`, red at or below it, hard-switched,
no gradient) plus the **posture/gait tell** as the tank empties (a slumping stance and a
flattened gait apex, driven by `STAMINA.TIRED_FRACTION` — unrelated to the HUD's colour tiers
and left at 0.35 throughout this ticket). Bar level and colour are the only cost feedback
left in the game. Ticket 16's playtesting found this sufficient — a hard push toward the
lower tiers is legible from the bar shrinking and the colour dropping a step — with the
caveat that **burn *rate*, specifically, is no longer telegraphed**: nothing tells you
*right now* that a lean is expensive the instant you commit to it, only that the tank is at
whatever level it's at. See the ticket 16 report for how that read in play.

`TRANSITION` grace is **retired** with the stumble. It existed to prevent unfair trips at
the switchback folds; with no trips it would only make the folds briefly cheaper and faster,
which is a perk exactly where the game should be hardest. Slope smoothing stays — it keeps
`idealLean` coherent through the folds.

## Rendered lean

One body angle, in the **travel frame**, composed before the `* flip` multiply:

```
bodyAngleDeg = lean + wobble + slump
group.rotation.z = -degToRad(bodyAngleDeg) * flip
```

`wobble` is currently always 0 (`WOBBLE.ENABLED = false`, ticket 16 §3a) and `slump` is the
posture/gait tell's small forward lean as the tank empties (ticket 18 §4, `STAMINA.
TIRED_SLUMP_MAX_DEG`) — both compose the same way, so re-enabling the wobble needs no change
here.

The leading minus is required: the body extends along local +Y, so a positive `rotation.z`
tips the head *backward* for a rightward runner. Compose before `* flip` or the lean inverts
on the leftward legs. This project has shipped a sign bug here once already.

`RUNNER.TILT_MAX_DEG` is 75 — headroom for the retired stumble pitch. With the stumble off
it only needs to clear `LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG` (~48.5), but leave it while the
stumble can be re-enabled.

## Motion model

No physics engine, no collision detection, no gravity integration. Arc length is the
independent variable; `s += speed * dt`. The gait hop is a parametric arc over the chord,
**parameterized by arc length** (`u = (s - s0) / GAIT_DIST`), which is what makes variable
speed free.

## Architecture

A **racer** is `runner` (mesh + pose) + `locomotion` (s, speed, lean, stamina) +
`controller` (intent). `race.js` owns an array with one flagged as the player, so AI
opponents are a later feature rather than a later rewrite. Courses are a registry keyed by
id (`src/courses/index.js`) — v3 ships two, `summit` (the default) and `alpine` — but still
exactly one racer; AI opponents remain unbuilt.

**The one-tick trap in `race.js`:** `advance` is computed from `stateAtTickStart`, captured
before the state machine runs, because racers must not advance on the tick COUNTDOWN flips
to RUNNING. Simplifying it silently shaves a hundredth off every finish time. It has been
hit once.

## Course

Path starts at `(0, 0)`; each segment names its end point.

| # | Type | End point | Meaning | `technical` |
| --- | --- | --- | --- | --- |
| 1 | `flat` | `(20, 0.0)` | start straight | 1.0 |
| 2 | `smooth` | `(60, 12.0)` | the climb (smoothstep, 24 samples) | 1.0 |
| 3 | `smooth` | `(95, 4.0)` | the descent (smoothstep, 20 samples) | 1.15 |
| 4–8 | `leg` | `(113, 7.2)` … `(113, 20.0)` | five switchbacks, alternating | 2.0 |
| 9 | `flat` | `(120, 20.4)` | finish spur | 1.0 |

Length **190.63 m** filleted (196.57 raw). Elevation gain **28.4 m**. Exactly **4** corners
fillet — the switchback reversals. Stack: x ∈ [95, 113], legs 3.2 m apart.

`technical` makes ground **expensive**, not dangerous. Ticket 12's measurements (v2 tuning)
found it didn't actually bite: the legs' *margin* narrowed correctly but `idealLean` grew
with slope at nearly the same rate, so the **absolute** lean at which a leg hit the knee came
out looser than the flat's, not tighter. Re-measured under v3's current tuning
(`MARGIN.BASE_DEG: 20`) with the original `technical: 1.6`, the problem persisted in a
milder form — legs settled at an absolute knee of ~18.9°/20.1° (alpine/summit) against the
flat's 20°, i.e. barely tighter on alpine and actually *looser* on summit, the default
course. Ticket 16 §3 raised `technical` to **2.0** on both courses' switchback legs: legs
now settle at an absolute knee of ~16.7° (alpine) / ~18.0° (summit), unambiguously the
tightest terrain on the course (the climb and descent stay loose — up to ~33°/28° — because
their difficulty comes from `terrainFactor`, a separate multiplier, not from margin). A
higher value (3.0) was tried and rejected: it over-tightened the legs enough that pacing
*allocation* (conserving on the stack, spending elsewhere) jumped from ~1% to ~6% of race
time, undoing ticket 21's finding that allocation isn't supposed to be the decision (see
"Measured: pacing is worth ~1%" below). 2.0 keeps the stack the tightest terrain while
keeping that allocation gain close to its original ~1-2% ceiling.

**Mid-leg hop clearance:** runner height 1.55 + gait apex 0.22 is well under the 3.2 m leg
spacing. Near-fold overlap is expected and correct — `Z.RUNNER` draws in front of `Z.BED`.

## Camera

FOLLOW centers on the runner at `halfHeight 7.0` with lookahead scaled by speed. STACK is a
*moderate* pull-back that still follows the runner (`halfHeight 10.5`) — v2 traded away v1's
static wide shot because a lean mechanic needs a character big enough to read.

## Race flow

`READY` → `COUNTDOWN` (3/2/1/GO) → `RUNNING` → `FINISHED`, `R` or click to restart. Best
time per course in `localStorage`.

## Measured: pacing is worth ~1% of race time, and length does not change that

**Ticket 21 responds to this finding.** It does not falsify it — allocation is still worth
about 1% on both courses under the current tuning (see the calibration table above) — it
answers the "what this means" question below differently than the speculation originally
did: instead of adding a discrete-surge mechanic, ticket 21 resizes the tank so *effort
level* (not allocation) is the decision, worth ~40 s instead of ~1 s. See "The core loop".

Solved offline by coordinate ascent over six equal-arc-length zones against the real path,
with the tank sized per course so the best uniform line runs dry near the finish:

| course | length | tank | best uniform | best paced | gain |
| --- | --- | --- | --- | --- | --- |
| alpine | 191 m | 85 | 28.97 s | 28.44 s | 0.53 s — **1.8%** |
| summit | 826 m | 640 | 106.24 s | 105.22 s | 1.03 s — **1.0%** |

A 4.3× longer course roughly doubled the absolute gain but *lowered* it as a fraction of
race time. **Course length was not the limiting factor.**

Re-checked in ticket 16 §1 against the current engine (a seeded local zone search, not the
six-zone offline solve above — likely an under-report, the same method found 0.6%/0.3% at
the original `technical: 1.6` against this offline solve's 1.8%/1.0%) after raising the
switchback `technical` (§3, 1.6 → 2.0): the gain is still small and still in the same
ballpark — at least ~2.0% on alpine, ~0.5% on summit — confirming the tighter switchback
margin didn't quietly turn allocation into the game's real decision. The *comparative* read
is the reliable part, since it's the same search method throughout: raising `technical` to
3.0 instead of 2.0 roughly tripled the gain on both courses (to ~6% / ~3.7%) with the exact
same search — which is why 3.0 was rejected. See the "Course" section above.

Two dial sweeps closing off the obvious fixes:

- **`STAMINA.FLOOR`** (with `MAX` rescaled): lowering it makes the gap *worse* — 2.4 → 0.3
  took alpine's gain from 0.68 s down to 0.20 s.
- **Terrain differential** on summit: `CLIMB_COST`/`DESCENT_MIN` at 1.5/0.45 → 3.0/0.25 →
  5.0/0.12 gives 1.03 s → 1.03 s → 1.31 s. Tripling the climb cost buys 0.2%.
- **`SPEED.COMMIT_BONUS`** peaks around 0.55 and *falls* above it.

**Why it is structural.** Cost is convex in effort (the squared redline) and speed is
concave (diminishing returns above the knee). Optimising that pair equalises marginal cost
per second saved, which lands on near-uniform effort unless terrain multipliers differ
enormously — and the sweep shows even 3× doesn't qualify. This is a property of the model's
shape, not of its constants.

### What this means

A 1% optimum-vs-naive spread means the game is **forgiving**, not broken — nobody plays
optimally, and the open question is whether minute-to-minute play is fun, which only
playtesting answers.

If pacing *allocation* should be a decision the player can *feel*, the likely direction is
**discrete rather than continuous**: a small number of "surges" to spend where you choose. A
continuous optimum 1% better than naive is imperceptible; choosing where to spend three
limited surges is a decision you can get wrong. That is a different mechanic, not a retune —
do not attempt it as tuning.

**This is no longer the open question ticket 21 needed to answer.** A tuning-only fix existed
after all — not for allocation (still ~1%, still would need a new mechanic like surges if it
mattered), but for a different axis entirely: how hard to hold effort. Resizing the tank
turns that into a ~40 s decision without adding anything. The surges idea above is still on
the table if allocation itself is ever the thing that needs to feel like a decision, but nothing
in v3 needs it now.

## What v3 deliberately does not have

- **No obstacles, no AI opponents.** The architecture is shaped for them (`race.js`'s racer
  array, the controller split) — none ship.
- **Two courses, not more.** `summit` (default) and `alpine` — a longer course than alpine
  was the ticket 19/20 hypothesis for giving pacing room to compound, and it shipped; a
  third course is not currently planned.
- **Desktop keyboard only.** `pointerdown` is start/restart, never gameplay; ← → lean is the
  entire input surface.
- **No stumble, no wobble.** Both were built, playtested, and retired as "annoying rather
  than tense" (tickets 17 and 16 §3a respectively). Both are disabled, not deleted —
  `STUMBLE.ENABLED` / `WOBBLE.ENABLED` in `src/constants.js` — so restoring either is a
  one-line change if stamina and the plain stamina-bar colour tiers ever prove insufficient
  on their own.

---

---

# v4 — Rivals (planned)

Opponents whose job is to **bait you into overcooking**. Pace-target CPUs only measure you;
bait rivals weaponise the mistake the whole game is built around, by making it socially
tempting rather than merely possible.

## Pacing plans

A rival is a **pacing plan**: a function from race state to a target lean offset above
ideal. Plans read terrain (slope, `technical`), not just progress, so specialists are
possible — a rival who genuinely beats you up the stack and gives it back on the descent is
far more interesting than one uniformly faster.

| Plan | Line | Punishes |
| --- | --- | --- |
| `rabbit` | all-out from the gun, blows up ~50-60% | chasing early |
| `overreach` | slightly above sustainable, bonks ~85% | matching them *almost* works |
| `surger` | repeated accelerate/back-off cycles | responding to every move |
| `metronome` | the true optimum, never bonks | nothing — the benchmark |
| `closer` | conserves early, comes past late | your own early overspending |

**Rivals run the identical stamina model. No cheating, and no rubber-banding.** A rival that
adapts to the player is not demonstrating a mistake, and the teaching effect evaporates.
Plans are deterministic: a rival blows up in the same place every run, so the course can be
learned.

## Roles are course data, not species

**The animal does NOT telegraph the plan.** If it did, you would solve the field once and
every future course would inherit a solved cast. Instead each course assigns its own
`shape → plan` pairs, fixed for that course:

```js
summit.rivals = [ { shape: 'tortoise', plan: 'metronome' },
                  { shape: 'hare', plan: 'closer' }, ... ]
```

So the field becomes part of **course knowledge** — the same thing the player accumulates
across attempts, like knowing where the grind starts. The Aesop expectation still does work,
as the *setup*: a tortoise winning only lands because you expected it to plod.

## Learning is retrospective, not telegraphed

The design deliberately does not warn the player mid-race that they are overspending. The
player is expected to fail a course several times and close in on it. What that *does*
require is that failure be legible **afterwards** — hence the post-race stamina graph
(ticket 26): stamina against **distance** (not time, so runs are comparable), overlaying the
player's run, their best run, and the winner's, with course sections shaded and the bonk
point marked. "The tortoise was at 40% here and I was at 10%" is the whole lesson in one
glance.

## Ticket order

```
22 (camera) → 23 (progress strip) → 24 (rivals) → 25 (animal shapes) → 26 (graph)
```

22 is one constant and immediate. 23 de-risks multi-racer work and is useful solo. 24 ships
rivals as recoloured squares so the mechanic can be played before any art exists.

# History

- **v1** — one-button hop, fixed 7 m/s, no fail state. Every race took exactly 27.23 s.
  Proved out terrain, motion, and camera; showed the hop button carried no decision.
- **v2** — lean replaces the hop; speed varies with commit. Tickets 09–13 built the racer
  split, variable speed, lean control, trip/stumble, and the wobble. The stumble is retired
  in v3; everything else stands.
- **v3** — stamina replaces the stumble as the cost of over-leaning (17–18); the
  terrain-block vocabulary and the long `summit` course give pacing room to matter (19–20);
  the camera retunes for a bigger, more readable character (14); the tank and knee retune
  around sustained *effort level* rather than pacing *allocation*, the retargeted decision
  the whole mechanic is built around (21); the HUD ships — stat block, best times, tutorial,
  stamina bar (15). Ticket 16 closes it out: the wobble telegraph, built and playtested
  twice (once at knee-normalized amplitude, once re-ramped over a wider effort range), is
  retired for the same reason the stumble was — annoying, not tense; the burn-rate band that
  replaced it is *also* retired, for competing with the bar's own low-tank colour on a 7px
  strip; what ships instead is a plain three-colour tank-level readout. The switchback
  stack's `technical` value is raised (1.6 → 2.0) so it finally reads as the hardest terrain
  on the course, not just the steepest-looking one.
