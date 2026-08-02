// All tuning numbers live here. Nothing tunable lives anywhere else.

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;

export const COLORS = {
  SKY_TOP: 0x9fd4e8,
  SKY_BOTTOM: 0xe7f3f7,
  GROUND: 0x5a7247,
  TRAIL: 0xc9a86a,
  RIDGE_FAR: 0xbcd3d8,
  RIDGE_NEAR: 0x7f9c86,
  MOUNTAIN: 0x4b6140,
  RUNNER_BODY: 0xe4572e,
  RUNNER_HEAD: 0xf2c49b,
  FINISH: 0xffffff,
  // Not in the DESIGN.md/ticket palette table; added for the finish banner's checker
  // pattern (ticket 03 asks for FINISH alternating with "a dark tone").
  FINISH_DARK: 0x2a2a2a,
  // Landing dust puffs (ticket 08).
  DUST: 0xd8cbb2,
};

export const CAMERA = {
  HALF_HEIGHT: 12.0, // CANDIDATE B for ticket 22 (was 7.0, ticket 14) -- widened so terrain reads
  // v3 (ticket 14): lookahead scales with speed rather than being a flat constant, since
  // pace now varies from a bonked crawl to a full sprint -- see cameraRig.js.
  LOOKAHEAD_BASE: 3.0,
  LOOKAHEAD_Y: 1.2,
  FOLLOW_LAMBDA: 6.0,
  HOP_DAMP: 0.35,
  // v3 (ticket 14): STACK is a moderate pull-back that still follows the runner -- only
  // the zoom changes, driven by path.ledgeRanges() (ticket 19) rather than a hardcoded
  // segment/coordinate, so it works for any course. The old static STACK_X/STACK_Y/
  // STACK_MIN_WIDTH containment constants (tuned to alpine's switchback stack geometry)
  // are gone -- they cannot work for a second course with a stack at different coordinates
  // (see DESIGN.md "Camera").
  STACK_HALF_HEIGHT: 18.0, // moderate pull-back; still follows the runner (scaled with HALF_HEIGHT, ticket 22)
  STACK_LEAD: 6,
  STACK_BLEND: 1.2,
  // Stumble shake (ticket 14 §3). Gated behind STUMBLE.ENABLED in cameraRig.js -- retired
  // along with the stumble (STUMBLE.ENABLED = false), kept working for the restore path.
  SHAKE_AMP: 0.35,
  SHAKE_DECAY: 0.18,
  SHAKE_FREQ: 22,
};

export const PATH = {
  CORNER_RADIUS: 1.6,
  FILLET_SAMPLES: 8,
  FILLET_MIN_TURN_DEG: 60,
  // A fillet radius is capped at this fraction of the shorter adjacent edge, so a fillet
  // never eats more than half of a short segment.
  FILLET_MAX_FRACTION: 0.45,
  // Arc length over which per-segment `technical` blends across a segment join, centred on
  // the join. Stepping it would snap ticket 12's trip margin at boundaries.
  TECHNICAL_BLEND: 3.0,
};

export const Z = {
  SKY: -5,
  RIDGE_FAR: -4,
  RIDGE_NEAR: -3,
  MOUNTAIN: -2,
  BED: 0,
  TRAIL: 0.5,
  MARKER: 0.8,
  DUST: 0.9, // just behind the runner
  RUNNER: 1,
};

export const WORLD = {
  // Ticket 19 §3: the floor and sky are derived from the *built path's* own point range
  // (see TrailPath#bounds in trailPath.js and world.js), not a fixed global -- a course
  // that dips or summits beyond alpine's range must not run the trail below the floor or
  // off the top of the sky (the exact bug ticket 03 already fixed once, for alpine, with a
  // hardcoded FLOOR_Y).
  //
  // FLOOR_MARGIN must exceed the camera's worst-case view below the lowest course point.
  // STACK is the wider shot (ticket 14), so it's the binding case: CAMERA.STACK_HALF_HEIGHT
  // + CAMERA.LOOKAHEAD_Y (10.5 + 1.2 = 11.7), or sky shows under the ground at the low
  // point. 12 reproduces alpine's old floorY (-12, since alpine's own
  // minY is 0) exactly, so this is behavior-neutral for alpine.
  FLOOR_MARGIN: 21,
  BED_THICKNESS: 2.2,
  BED_BLEND: 3.0,
  TRAIL_WIDTH: 0.36,
  APRON: 20,
  // Full-screen background quad; deliberately oversized so it never runs out at the edges
  // of the camera's frustum across the whole course + resize range. The quad is one
  // untextured mesh and costs nothing, so this can be generous.
  SKY_MARGIN: 150,
};

// Start/finish post + finish banner geometry (ticket 03). Not course geometry — these are
// purely decorative marker sizes, unrelated to src/course.js.
export const MARKERS = {
  START_POST_WIDTH: 0.12,
  START_POST_HEIGHT: 2.0,
  FINISH_POST_WIDTH: 0.14,
  FINISH_POST_HEIGHT: 2.6,
  FINISH_PANEL_WIDTH: 2.2,
  FINISH_PANEL_HEIGHT: 1.1,
  FINISH_PANEL_COLS: 6,
  FINISH_PANEL_ROWS: 3,
};

export const RUNNER = {
  BODY_W: 0.62,
  BODY_H: 0.95,
  HEAD_S: 0.50,
  HEAD_GAP: 0.10,
  HEIGHT: 1.55, // derived; keep in sync with the above
  // v1's terrain-derived TILT_FACTOR term is gone (ticket 11) -- player lean replaces it
  // entirely, composed straight into rotation.z. Do not re-add a separate terrain tilt
  // term; idealLean (constants LEAN) already encodes the slope, so keeping both would
  // double-count it (DESIGN.md "Rendered lean").
  //
  // Was 22, then 48 (ticket 11: lean alone reaches LEAN.MAX_FWD_DEG (45) + wobble). Ticket
  // 12 raises it again to 75: during a stumble, STUMBLE.PITCH_DEG (70) REPLACES lean rather
  // than adding to it (see locomotion.js and DESIGN.md "Rendered lean" -- a runner going
  // down is not also holding a lean), but it is still composed through this same clamp, and
  // 48 would clip the fall to a shrug. 75 covers both LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG
  // (~48.5) and STUMBLE.PITCH_DEG (70) with margin, so neither ever saturates before the
  // underlying value does.
  TILT_MAX_DEG: 75,
  FACING_DEADBAND: 0.30,
  FLIP_TIME: 0.15,
};

// v3 (ticket 17): speed and cost no longer share a denominator. REF_DEG is a fixed speed
// reference -- NEVER scale it by `technical` or by any grace multiplier, or technical
// terrain becomes a speed bonus (the exact trap DESIGN.md "Speed must NOT use the same
// denominator" warns about). REF_DEG was originally set equal to MARGIN.BASE_DEG (14) so
// ticket 17's split was behaviour-neutral on flat, non-technical ground at the time. Ticket
// 21 §2 has since widened MARGIN.BASE_DEG to 20 without moving REF_DEG (not ticket 21's
// dial to tune) -- the two are no longer equal, and commit and effort now diverge even on
// flat ground. That's fine (they're deliberately separate ratios, see above); just don't
// assume the old equality still holds when reading this constant.
export const SPEED = {
  BASE: 7.0,
  GRADE_DRAG: 0.5,
  MIN_FACTOR: 0.8,
  MAX_FACTOR: 1.2,
  COMMIT_BONUS: 0.35,
  REF_DEG: 14,
  SPRINT_GAIN: 0.8,
  SPRINT_FALLOFF: 1.0,
  MAX: 11.5, // hard cap; an uncapped sprint is unreadable
  // Ticket 16 §4: hoisted out of locomotion.js's `commit` clamp. Lower end of `commit`'s
  // domain -- leaning back can't drag it below this, so backing off can't go arbitrarily
  // slow. Upper end is deliberately uncapped (ticket 17 §3, sprinting).
  MIN_COMMIT: -1,
};

// Player lean, in degrees, signed in the travel frame (+ = forward). See DESIGN.md "The
// core mechanic" and ticket 11.
export const LEAN = {
  RATE_DEG: 55, // how fast the arrows move lean
  DECAY_DEG: 18, // drift back to upright with no input
  SLOPE_TO_IDEAL: 0.8,
  IDEAL_MAX_DEG: 26,
  SLOPE_SMOOTH_TIME: 0.35, // seconds; exponential low-pass on slopeSigned
  MAX_FWD_DEG: 45,
  MAX_BACK_DEG: 25,
};

// Trip/slip margin, in degrees, around idealLean. See DESIGN.md "Fairness" and ticket 12.
//
// v3 (ticket 21 §2): BASE_DEG widened 14 -> 20. At 14, the tank ticket 21 needs (big enough
// to afford ~60 s of max-lean running) put sustainable effort at 1.68 -- permanently past
// the knee, so the wobble (which reads off `effort`, see locomotion.js) would be pinned on
// for the entire race and stop telegraphing anything. At 20, sustainable effort lands at
// 1.13, just barely past the knee -- but ticket 21's own verification found this does NOT
// make the wobble itself read as "barely perceptible": WOBBLE's onset->full ramp is
// normalized over effort in [ONSET, 1.0] (see WOBBLE below), so it saturates to full
// amplitude AT the knee and stays there for any effort past it, whether 1.01 or 4.0. A
// sustained-effort race (1.13) and an all-out one both spend the overwhelming majority of
// their distance at full wobble amplitude, near-indistinguishable from each other on that
// axis. Widening the margin is still correct and load-bearing -- it's what makes
// BUDGET_MULT land the tank where the tank-size lever actually works (see the reward table
// in tickets/21-hard-effort.md) -- it just doesn't also restore wobble as a sustained-vs-
// overcooked telegraph. That would need WOBBLE's own shape changed (e.g. normalizing over a
// wider effort range than [ONSET, 1.0]), which is not this ticket's dial -- see DESIGN.md
// "Telegraphing" and ticket 16.
// This is coupled to STAMINA.BUDGET_MULT below -- widening the margin lowers `effort` at a
// given lean, which lowers drain, which changes how long the tank lasts; the two were tuned
// together, in this order (margin first, then tank), not independently.
export const MARGIN = {
  BASE_DEG: 20,
  SLOPE_NARROW: 0.25, // margin narrows as grade steepens
  MIN_DEG: 6,
  SLIP_ONSET_DEG: 8, // descents steeper than this get a backward slip threshold
  SLIP_MARGIN_DEG: 11,
};

// Stumble state machine: trip/slip -> pitch -> recover -> grace. See DESIGN.md
// "Stumbling" and ticket 12.
//
// v3 (ticket 17): playtested and rejected as "more annoying than tense" -- replaced by
// stamina. RETIRED, NOT DELETED: ENABLED gates the trip check, the slip check, the whole
// pitch/recover state machine, the input lock, and the stumble dust burst in locomotion.js.
// Flip it back to true to restore v2 behavior if stamina proves thin. Every other value
// below is untouched v2 tuning, kept so the restore is a one-line change.
export const STUMBLE = {
  ENABLED: false,
  TRIGGER_TIME: 0.12, // dwell past the margin before it counts as a trip/slip
  PITCH_TIME: 0.35,
  RECOVER_TIME: 0.45,
  INPUT_LOCK: 0.4,
  SKID_SPEED: 2.0,
  PITCH_DEG: 70,
  GRACE_TIME: 0.9,
  GRACE_MARGIN_MULT: 2.0,
};

// Widened the trip/slip margin while idealLean was changing fast (the switchback folds,
// where the grade reverses outright) so a sharp terrain transition never read as a cheap
// trip. See DESIGN.md "Fairness" and ticket 12.
//
// v3 (ticket 17 §5): RETIRED along with the stumble it protected. With no trips, this grace
// would only make the folds briefly cheaper and faster -- a perk exactly where the game
// should be hardest. Its application is removed from locomotion.js; the constants stay here,
// unused, beside the disabled stumble.
export const TRANSITION = {
  SPIKE_DEG_PER_S: 60,
  GRACE_TIME: 0.5,
  GRACE_MARGIN_MULT: 1.8,
};

// Stamina: the v3 mechanic. One tank for the whole course, spent by leaning, never refilled.
// See DESIGN.md "Effort and cost", "Terrain: where you spend", "Calibration", "Running out",
// and tickets 18/21.
//
// v3 (ticket 21 §1): the fixed MAX is gone. A single number cannot serve both a 191 m and an
// 826 m course, so the tank is derived per course at build time instead: integrate the drain
// an ideal-lean runner (balance = 0, effort = 0, so just the floor term) would burn over the
// whole path -- see `computeStaminaMax` in locomotion.js -- and scale that baseline by
// BUDGET_MULT. Measured baselines: summit ~365 (tank ~980, ~61 s of max-lean running),
// alpine ~84 (tank ~225). Any future course scales for free.
export const STAMINA = {
  BUDGET_MULT: 2.7, // tank = BUDGET_MULT * the ideal-lean baseline spend integrated per course
  FLOOR: 2.4, // per second, always, even leaning back
  PUSH: 3.2, // per second per unit of effort, under the knee
  REDLINE: 6.0, // per second per (effort - 1)^2, above the knee -- squared, do not linearise
  CLIMB_COST: 1.5,
  DESCENT_RELIEF: 1.2,
  DESCENT_MIN: 0.45,
  BRAKE_COST: 2.0,
  EXHAUSTED_MULT: 0.8, // speed multiplier once empty (commit is also capped at 0)
  TIRED_FRACTION: 0.35,
  TIRED_APEX_MULT: 0.6,
  // Not specified numerically by ticket 18's constants block beyond TIRED_APEX_MULT; the
  // ticket asks for "a small forward slump" as part of the posture/gait tell, so this adds
  // the degree value that drives it (rule 1: tuning numbers live here, not inlined).
  TIRED_SLUMP_MAX_DEG: 5,
};

// Telegraphs the approaching edge in the runner's pose before it's crossed -- no UI meter,
// the character is the readout. See DESIGN.md "Telegraphing" and ticket 13.
// Wobble telegraph, read off `effort` (ticket 17 §4).
//
// FULL_EFFORT exists because the ramp used to normalize over effort in [ONSET, 1.0], which
// saturated the wobble AT the knee and pinned it there for any effort past it. Ticket 21
// deliberately puts *sustainable* effort at 1.13 -- just past the knee -- so a sustained
// race and an all-out one both sat at full amplitude for ~99% of the distance and the
// telegraph conveyed nothing. Widening MARGIN.BASE_DEG cannot fix that; the ramp's range is
// the culprit. Normalizing over [ONSET, FULL_EFFORT] instead spreads it across the range
// actually played: sustainable (1.13) reads ~0.7 deg -- just perceptible -- and all-out
// (~1.8-2.25 depending on grade) reads 2.4-3.5 deg -- unmistakable.
// v3 (ticket 16 §3a): playtested and rejected -- same verdict, same reason as the stumble
// (ticket 17): a twitchy, high-frequency thing happening *to* the character read as
// annoying, not tense. RETIRED, NOT DELETED, exactly like STUMBLE.ENABLED above -- flip
// ENABLED back to true to restore, including the FULL_EFFORT ramp fix, with no other code
// changes. Ticket 16 §3b also removes the burn-rate band, so after this ticket the stamina
// bar's LEVEL and three-colour TIER (see HUD.STAMINA_YELLOW/STAMINA_RED below) are the only
// cost feedback left -- see the ticket 16 report for whether that reads as sufficient in
// play with the wobble off.
export const WOBBLE = {
  ENABLED: false,
  ONSET: 0.55,
  FULL_EFFORT: 2.2,
  MAX_DEG: 3.5,
  FREQ_HZ: 14,
  // Ticket 16 §4: hoisted out of locomotion.js -- the ease-in exponent shaping how sharply
  // amplitude ramps up between ONSET and FULL_EFFORT (amp = MAX_DEG * wobbleT ** RAMP_POWER).
  RAMP_POWER: 1.5,
};

export const HOP = {
  GAIT_DIST: 1.6,
  GAIT_APEX: 0.22,
  // How long a mid-air hop offset takes to ease to 0 when the race ends mid-hop
  // (ticket 07 — locomotion clamps s at the finish and would otherwise freeze the runner
  // hovering above the trail).
  FINISH_EASE_TIME: 0.15,
};

// Countdown timing (ticket 07). Beats are COUNT_FROM, COUNT_FROM-1, ..., 1, GO! — that's
// COUNT_FROM + 1 beats total, each shown for COUNT_BEAT seconds.
export const RACE = {
  COUNT_BEAT: 0.6,
  COUNT_FROM: 3,
};

// Dust puffs (ticket 08 landing dust; ticket 13 makes it continuous) — a fixed-size pool,
// recycled, never allocated per frame.
//
// v1/ticket 08 emitted only on big-hop landings and suppressed gait hops -- that rule is
// superseded (see ticket 08's banner). v2 has no big hop; dust now fires on every gait-hop
// landing, all the time, plus a bigger PER_STUMBLE burst on a stumble.
export const DUST = {
  POOL: 40, // was 24 -- gait dust is continuous now, several puffs alive at once
  PER_GAIT: 3, // puffs spawned on every gait-hop landing
  PER_STUMBLE: 9, // puffs spawned on a stumble -- a visible eruption
  SIZE: 0.16, // quad width/height
  LIFE: 0.45, // seconds until a puff fully fades and returns to the pool
  GROW: 1.8, // scale multiplier reached at LIFE
  SPEED: 2.2, // backward kick speed (gait)
  SPREAD: 0.6, // random velocity jitter (also reused as the smaller upward kick)
  GRAVITY: 1.4, // downward acceleration applied to puffs in flight
  STUMBLE_SPEED: 3.4, // backward kick speed (stumble burst) -- faster
  STUMBLE_SPREAD: 1.1, // random velocity jitter (stumble burst) -- wider
};

// HUD (ticket 15): the lean tutorial on the flat start, the stamina bar's tank-level colour
// tiers, pace smoothing, and the localStorage keys for best times / the tutorial-taught
// flag. See tickets/15-best-times-and-hud.md and ticket 16 §3b.
export const TUTORIAL = { DISTANCE: 18, SATISFIED_TIME: 0.6 };
// v3 (ticket 16 §3b): replaces the earlier burn-rate band (BURN_LOOKAHEAD_FRACTION,
// BURN_EASE_TIME -- deleted, along with the .hud-stamina-burn element and its hud.js
// derivation code) with a plain three-colour tank-LEVEL readout: green above
// STAMINA_YELLOW, yellow down to STAMINA_RED, red at or below it. Hard switches, no
// animated transition -- see index.html's .hud-stamina-fill rules. This also replaces the
// old .warning class, which keyed off STAMINA.TIRED_FRACTION (0.35); that constant is left
// alone since it still drives the runner's separate posture/gait tell (ticket 18 §4).
export const HUD = {
  STAMINA_YELLOW: 0.6,
  STAMINA_RED: 0.25,
  PACE_SMOOTH_TIME: 0.2,
};
export const STORAGE = { BEST_PREFIX: 'trailhop.best.', TAUGHT: 'trailhop.taught' };

// Switchback mid-leg clearance (DESIGN.md constraint 1): the gait hop's apex, on top of
// the runner's full height, must stay under the 3.2 m leg spacing or the runner's head
// would clip the ledge above mid-leg. v2 removed the big hop (ticket 10), so the gait hop
// is the only apex left to check. This is the constraint most likely to be broken by later
// tuning, so it's checked at startup rather than left as a comment.
console.assert(
  RUNNER.HEIGHT + HOP.GAIT_APEX < 3.2,
  `Switchback clearance violated: RUNNER.HEIGHT (${RUNNER.HEIGHT}) + HOP.GAIT_APEX ` +
    `(${HOP.GAIT_APEX}) = ${RUNNER.HEIGHT + HOP.GAIT_APEX} must stay under the 3.2 m leg ` +
    'spacing (see DESIGN.md constraint 1).'
);

console.assert(
  Math.abs(RUNNER.HEIGHT - (RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S)) < 1e-9,
  `RUNNER.HEIGHT (${RUNNER.HEIGHT}) is out of sync with BODY_H + HEAD_GAP + HEAD_S ` +
    `(${RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S}).`
);

// Ticket 16 §4 (the saturation trap from ticket 11): runner.js clamps the rendered body
// angle to RUNNER.TILT_MAX_DEG. In normal running (wobble on) that angle is
// LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG; if TILT_MAX_DEG ever fell under that, extra lean would
// stop visibly registering while the underlying mechanic (and stamina drain) kept working
// exactly as before -- the symptom is "the mechanic feels dead," and it points nowhere near
// this clamp as the cause. Checked even with WOBBLE.ENABLED false (see constants.js above)
// so a wobble restore can't silently reintroduce the saturation.
console.assert(
  RUNNER.TILT_MAX_DEG >= LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG,
  `RUNNER.TILT_MAX_DEG (${RUNNER.TILT_MAX_DEG}) must cover LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG ` +
    `(${LEAN.MAX_FWD_DEG + WOBBLE.MAX_DEG}) or extra lean stops visibly registering ` +
    '(see DESIGN.md "Rendered lean" and ticket 16 §4).'
);
