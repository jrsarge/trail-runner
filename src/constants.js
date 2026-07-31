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
  TILT_FACTOR: 0.5,
  TILT_MAX_DEG: 22,
  FACING_DEADBAND: 0.30,
  FLIP_TIME: 0.15,
};

export const RUN_SPEED = 7.0; // m/s, constant

export const HOP = {
  GAIT_DIST: 1.6,
  GAIT_APEX: 0.22,
  BIG_DIST: 3.5,
  BIG_APEX: 0.9,
  LAND_SQUASH: 0.18,
  LAND_SQUASH_TIME: 0.12,
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

// Landing dust puffs (ticket 08) — a fixed-size pool, recycled, never allocated per frame.
export const DUST = {
  POOL: 24, // total quads ever created
  PER_LAND: 5, // puffs spawned on a single big-hop landing
  SIZE: 0.16, // quad width/height
  LIFE: 0.45, // seconds until a puff fully fades and returns to the pool
  GROW: 1.8, // scale multiplier reached at LIFE
  SPEED: 2.2, // backward kick speed
  SPREAD: 0.6, // random velocity jitter (also reused as the smaller upward kick)
  GRAVITY: 1.4, // downward acceleration applied to puffs in flight
};

// Switchback mid-leg clearance (DESIGN.md constraint 1): a big hop's apex, on top of the
// runner's full height, must stay under the 3.2 m leg spacing or the runner's head would
// clip the ledge above mid-leg. This is the constraint most likely to be broken by later
// tuning, so it's checked at startup rather than left as a comment.
console.assert(
  RUNNER.HEIGHT + HOP.BIG_APEX < 3.2,
  `Switchback clearance violated: RUNNER.HEIGHT (${RUNNER.HEIGHT}) + HOP.BIG_APEX ` +
    `(${HOP.BIG_APEX}) = ${RUNNER.HEIGHT + HOP.BIG_APEX} must stay under the 3.2 m leg ` +
    'spacing (see DESIGN.md constraint 1).'
);

console.assert(
  Math.abs(RUNNER.HEIGHT - (RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S)) < 1e-9,
  `RUNNER.HEIGHT (${RUNNER.HEIGHT}) is out of sync with BODY_H + HEAD_GAP + HEAD_S ` +
    `(${RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S}).`
);
