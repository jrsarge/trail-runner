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
  HALF_HEIGHT: 9,
  LOOKAHEAD: 4.0,
  LOOKAHEAD_Y: 1.2,
  FOLLOW_LAMBDA: 6.0,
  HOP_DAMP: 0.35,
  // STACK frame must contain y ∈ [4, 25.4] (stack base → top of finish banner)
  // and x ∈ [95, 120.2]. See ticket 06 before changing these.
  STACK_X: 107,
  STACK_Y: 14.8,
  STACK_HALF_HEIGHT: 11.8,
  STACK_LEAD: 6,
  STACK_BLEND: 1.2,
  STACK_MIN_WIDTH: 34,
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
  // FLOOR_Y must sit below the lowest the camera can ever see. The FOLLOW shot at the
  // start line centers on y = 1.2 with halfHeight 9, so its bottom edge is y = -7.8;
  // a floor at -6 leaves sky showing under the ground. -12 gives margin.
  FLOOR_Y: -12,
  BED_THICKNESS: 2.2,
  BED_BLEND: 3.0,
  TRAIL_WIDTH: 0.36,
  APRON: 20,
  // Full-screen background quad; deliberately oversized so it never runs out at the
  // edges of the camera's frustum across the whole course + resize range.
  SKY_X0: -150,
  SKY_X1: 400,
  SKY_Y0: -40,
  SKY_Y1: 80,
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

export const SPEED = {
  BASE: 7.0,
  GRADE_DRAG: 0.5,
  MIN_FACTOR: 0.8,
  MAX_FACTOR: 1.2,
  COMMIT_BONUS: 0.35,
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
export const MARGIN = {
  BASE_DEG: 14,
  SLOPE_NARROW: 0.25, // margin narrows as grade steepens
  MIN_DEG: 6,
  SLIP_ONSET_DEG: 8, // descents steeper than this get a backward slip threshold
  SLIP_MARGIN_DEG: 11,
};

// Stumble state machine: trip/slip -> pitch -> recover -> grace. See DESIGN.md
// "Stumbling" and ticket 12.
export const STUMBLE = {
  TRIGGER_TIME: 0.12, // dwell past the margin before it counts as a trip/slip
  PITCH_TIME: 0.35,
  RECOVER_TIME: 0.45,
  INPUT_LOCK: 0.4,
  SKID_SPEED: 2.0,
  PITCH_DEG: 70,
  GRACE_TIME: 0.9,
  GRACE_MARGIN_MULT: 2.0,
};

// Widens the trip/slip margin while idealLean is changing fast (the switchback folds, where
// the grade reverses outright) so a sharp terrain transition never reads as a cheap trip.
// See DESIGN.md "Fairness" and ticket 12.
export const TRANSITION = {
  SPIKE_DEG_PER_S: 60,
  GRACE_TIME: 0.5,
  GRACE_MARGIN_MULT: 1.8,
};

// Telegraphs the approaching edge in the runner's pose before it's crossed -- no UI meter,
// the character is the readout. See DESIGN.md "Telegraphing" and ticket 13.
export const WOBBLE = { ONSET: 0.55, MAX_DEG: 3.5, FREQ_HZ: 14 };

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
