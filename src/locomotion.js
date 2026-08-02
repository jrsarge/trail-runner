// Variable-speed arc-length locomotion plus a parametric gait hop, player lean, and stamina
// (the v3 mechanic). No physics, no gravity integration, no collision detection -- see
// DESIGN.md "Motion model", "The core loop", "Effort and cost", "Terrain: where you spend",
// "Running out", "Telegraphing", and tickets 11/17/18.
//
// v2 removed the manual big hop entirely (ticket 10): the gait hop now runs continuously,
// forever, driven by arc length so it stays correct even while speed varies mid-hop.
//
// v3 (ticket 17) retired the trip/slip/stumble state machine that used to live here -- it
// was playtested and read as annoying rather than tense. It is NOT deleted: every part of
// it (dwell timers, pitch/recover clock, input lock, dust burst) is still here, gated behind
// `STUMBLE.ENABLED` so it stays cheap to restore. `commit` (which speed reads) and `effort`
// (which stamina drain reads) used to share one denominator, `margin`; ticket 17 splits them
// so technical terrain costs more without also going faster at the same lean.

import { SPEED, LEAN, MARGIN, HOP, STUMBLE, STAMINA, WOBBLE } from './constants.js';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(x) {
  return clamp(x, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function moveToward(cur, target, maxDelta) {
  if (cur < target) return Math.min(target, cur + maxDelta);
  if (cur > target) return Math.max(target, cur - maxDelta);
  return cur;
}

// Ticket 21 §1: derive the tank from what the course actually costs instead of hardcoding
// STAMINA.MAX (deleted -- see constants.js). Integrates the drain an ideal-lean runner
// (balance = 0, so effort = 0 -- no PUSH, no REDLINE, just the floor term) would burn over
// the whole path, using the same terrainFactor/gradeFactor shapes as the real per-frame
// drain/speed below, then scales by STAMINA.BUDGET_MULT. This runs once at racer creation,
// not per frame -- it is a build-time property of the course, not a live simulation value.
// Exported for tests/tooling that want to check a course's derived tank without spinning up
// a full racer.
const BASELINE_STEP = 0.5; // m -- terrain factors are smooth enough that this is plenty

export function computeStaminaMax(path) {
  let spend = 0;
  let s = 0;
  while (s < path.length) {
    const ds = Math.min(BASELINE_STEP, path.length - s);
    const tangent = path.tangentAt(s + ds / 2);
    const slopeSigned = Math.atan2(tangent.y, Math.abs(tangent.x));

    const terrainFactor =
      slopeSigned > 0
        ? 1 + STAMINA.CLIMB_COST * Math.sin(slopeSigned)
        : Math.max(STAMINA.DESCENT_MIN, 1 - STAMINA.DESCENT_RELIEF * Math.sin(-slopeSigned));
    const gradeFactor = clamp(
      1 - SPEED.GRADE_DRAG * Math.sin(slopeSigned),
      SPEED.MIN_FACTOR,
      SPEED.MAX_FACTOR
    );
    // Ideal-lean baseline: commit = 0 (balance = 0), so gain = 0 and speed carries no
    // COMMIT_BONUS -- just base speed scaled by grade, same as the real formula below with
    // commit clamped to 0.
    const speed = Math.min(SPEED.MAX, SPEED.BASE * gradeFactor);

    spend += ((STAMINA.FLOOR * terrainFactor) / speed) * ds;
    s += ds;
  }
  return STAMINA.BUDGET_MULT * spend;
}

export function createLocomotion(path, runner, callbacks = {}) {
  // callbacks.onGaitLand(x, y, facing) -- every gait-hop landing (ticket 13 hangs
  // continuous dust on this).
  // callbacks.onStumble(x, y, facing) -- once, at the moment a trip/slip triggers. Moot
  // while STUMBLE.ENABLED is false (ticket 17), kept working for the restore path.
  // callbacks.onBonk() -- once, the instant stamina first hits zero (ticket 18).
  const { onGaitLand, onStumble, onBonk } = callbacks;

  // Ticket 21 §1: this course's derived tank -- computed once here, not per frame.
  const staminaMax = computeStaminaMax(path);

  let s = 0;
  let finished = false;

  // Player lean, degrees, signed in the travel frame (+ = forward). Ticket 11.
  let lean = 0;
  // Exponentially low-passed slopeSigned (radians), so idealLean doesn't snap at sharp
  // grade transitions -- see DESIGN.md "Fairness" (v2) / slope smoothing (v3, which keeps
  // this specifically -- see DESIGN.md "Telegraphing").
  let slopeSmoothed = 0;
  let slopeSigned = 0;
  let speed = 0;
  // `commit` (feeds speed) and `effort` (feeds stamina drain) used to be the same ratio
  // over the same margin; ticket 17 splits them. Hoisted so they're readable between
  // frames via the getters below.
  let commit = 0;
  let effort = 0;

  // Ticket 18: the tank. Only ever decreases -- see DESIGN.md "The core loop" and
  // "Running out". `bonkFired` makes onBonk a one-shot at the instant it first hits zero.
  let stamina = staminaMax;
  let bonkFired = false;

  // --- ticket 12: trip/slip/stumble state machine ---
  // stumblePhase is 'pitch' | 'recover' | null. null covers both "never stumbled" and
  // "grace" -- grace is normal running (input works, gait/dust/wobble all normal), just
  // with a widened margin, so it does not need its own phase value here.
  let stumblePhase = null;
  let stumbleClock = 0; // seconds since this stumble triggered (spans pitch + recover)
  let stumbleKind = 'trip'; // 'trip' (pitch forward) | 'slip' (pitch backward)
  let pitchStartSpeed = 0;
  let pitchStartAngle = 0;

  // Dwell timers: a threshold must stay exceeded for STUMBLE.TRIGGER_TIME before it counts,
  // so a single-frame spike (terrain or input) never takes you down.
  let tripDwell = 0;
  let slipDwell = 0;

  // Post-stumble grace: widens the trip margin for STUMBLE.GRACE_TIME after recovery so you
  // don't immediately re-trip on the same steep ground. (TRANSITION/fold grace, the other
  // v2 grace source, is retired outright per ticket 17 §5 -- not gated, removed -- so it no
  // longer has a timer here at all.)
  let stumbleGraceTimer = 0;

  // Ticket 13: telegraphs an approaching edge (forward trip OR backward slip) in the
  // pose before it's crossed. Local clock, not tied to the race timer.
  let wobbleClock = 0;
  let wobbleDeg = 0;

  // Current hop: an arc over the chord from path.pointAt(hopS0) to
  // path.pointAt(hopS0 + HOP.GAIT_DIST), parameterized by u = (s - hopS0) / HOP.GAIT_DIST.
  // No size variation now that the big hop is gone -- dist/apex are always the gait's.
  let hopS0 = 0;

  // Ticket 07: `s` clamps at path.length and stops advancing once finished, which would
  // otherwise freeze whatever hop offset was in flight -- the runner ending the race
  // hovering above the trail. `settling` eases that frozen offset down to 0 over
  // HOP.FINISH_EASE_TIME; once settled, `idleT` drives a small breathing bob in place
  // (same shape as the gait hop) so the finish reads as catching their breath, not
  // freezing solid.
  let settling = false;
  let settleFrom = 0;
  let settleTimer = 0;
  let idleT = 0;

  function reset() {
    s = 0;
    finished = false;
    lean = 0;
    slopeSmoothed = 0;
    slopeSigned = 0;
    speed = 0;
    hopS0 = 0;
    settling = false;
    settleFrom = 0;
    settleTimer = 0;
    idleT = 0;
    stumblePhase = null;
    stumbleClock = 0;
    stumbleKind = 'trip';
    pitchStartSpeed = 0;
    pitchStartAngle = 0;
    tripDwell = 0;
    slipDwell = 0;
    stumbleGraceTimer = 0;
    wobbleClock = 0;
    wobbleDeg = 0;
    stamina = staminaMax;
    bonkFired = false;
    commit = 0;
    effort = 0;
    runner.setLean(0);
    runner.setHopOffset(0);
    runner.setGroundS(0);
  }

  function update(dt, leanInput) {
    // --- slope, ideal lean (DESIGN.md "Speed" / "Fairness") ---
    // Signed in the travel frame: + climbing, - descending. Do NOT Math.abs() this --
    // ticket 12's two-sided descent behavior depends on the sign surviving to here.
    const tangent = path.tangentAt(s);
    slopeSigned = Math.atan2(tangent.y, Math.abs(tangent.x));

    // Exponential low-pass, frame-rate independent, not a raw lerp (ticket 11 §2). Feeds
    // idealLean, the trip margin's slope narrowing, and slip eligibility below -- using the
    // same smoothed value everywhere is part of what keeps the fold transitions fair.
    const alpha = 1 - Math.exp(-dt / LEAN.SLOPE_SMOOTH_TIME);
    slopeSmoothed += (slopeSigned - slopeSmoothed) * alpha;
    const slopeSmoothedDeg = Math.abs(slopeSmoothed) * DEG_PER_RAD;

    const idealLean = clamp(
      LEAN.SLOPE_TO_IDEAL * Math.abs(slopeSmoothed) * DEG_PER_RAD,
      0,
      LEAN.IDEAL_MAX_DEG
    );

    // --- stumble phase clock (ticket 12, gated: ticket 17 §1) ---
    // Advances (and can complete) BEFORE this frame's lean integration/render, so a
    // recover->grace transition this frame resets `lean` to idealLean in time to matter
    // this same frame, and so the pitch/recover render branch below sees an up-to-date
    // stumbleClock. Dead code while STUMBLE.ENABLED is false: stumblePhase can never become
    // non-null (see the trigger block below), so this block never runs.
    if (STUMBLE.ENABLED && stumblePhase) {
      stumbleClock += dt;
      if (stumblePhase === 'pitch' && stumbleClock >= STUMBLE.PITCH_TIME) {
        stumblePhase = 'recover';
      }
      if (
        stumblePhase === 'recover' &&
        stumbleClock >= STUMBLE.PITCH_TIME + STUMBLE.RECOVER_TIME
      ) {
        stumblePhase = null;
        stumbleGraceTimer = STUMBLE.GRACE_TIME;
        // "lean resets to idealLean on recovery -- not to 0, or you emerge already
        // mis-leaned on steep ground" (ticket 12).
        lean = idealLean;
      }
    }
    if (STUMBLE.ENABLED && stumbleGraceTimer > 0) {
      stumbleGraceTimer = Math.max(0, stumbleGraceTimer - dt);
    }

    // --- lean integration (ticket 11), gated by ticket 12's input lock ---
    // Doing nothing must be wrong on steep ground: with no input, lean decays back toward
    // upright instead of holding, so the player has to actively commit. Input is locked for
    // STUMBLE.INPUT_LOCK from the moment a stumble triggers (treated as leanInput === 0, so
    // lean still decays rather than freezing); the player has control again after that even
    // though the rendered body angle keeps following the pitch/recover curve, not `lean`,
    // until recover completes and snaps it back to idealLean above. Always false while
    // STUMBLE.ENABLED is false.
    const inputLocked =
      STUMBLE.ENABLED && stumblePhase !== null && stumbleClock < STUMBLE.INPUT_LOCK;
    const effectiveLeanInput = inputLocked ? 0 : leanInput;
    lean += effectiveLeanInput * LEAN.RATE_DEG * dt;
    if (effectiveLeanInput === 0) lean = moveToward(lean, 0, LEAN.DECAY_DEG * dt);
    lean = clamp(lean, -LEAN.MAX_BACK_DEG, LEAN.MAX_FWD_DEG);

    // --- margins (ticket 17 §2: speed and cost stop sharing a denominator) ---
    // marginBase is the same slope-narrowed base v2 always had; `technical` still scales it
    // (that part of "margin" survives as the *cost* knee). What's gone is `commit` (speed)
    // reading this at all -- see below.
    const marginBase = clamp(
      MARGIN.BASE_DEG - MARGIN.SLOPE_NARROW * slopeSmoothedDeg,
      MARGIN.MIN_DEG,
      MARGIN.BASE_DEG
    );
    const technical = path.technicalAt(s);
    // COST margin: technical-scaled, no grace (grace was a trip-fairness concept; stamina
    // has no trips). Ticket 18 consumes this as the drain knee.
    const costMargin = marginBase / technical;

    // Post-stumble grace still exists for the stumble-only trip/slip threshold below (NOT
    // for costMargin -- ticket 17 §5 retires TRANSITION/fold grace outright, and stumble's
    // own post-recovery grace never applied to cost, only to the trip check). Moot while
    // STUMBLE.ENABLED is false.
    const graceMultiplier =
      STUMBLE.ENABLED && stumbleGraceTimer > 0 ? STUMBLE.GRACE_MARGIN_MULT : 1;
    const tripMargin = costMargin * graceMultiplier;

    const balance = lean - idealLean;

    // SPEED: fixed reference, never scaled by technical or grace (ticket 17 §2 -- the trap
    // this ticket exists to avoid). Upper end is uncapped (ticket 17 §3, sprinting); lower
    // end stays clamped at SPEED.MIN_COMMIT so leaning back can't go arbitrarily slow.
    commit = Math.max(SPEED.MIN_COMMIT, balance / SPEED.REF_DEG);

    // COST: technical-scaled margin, no grace. Ticket 18 turns this into stamina drain.
    effort = balance / costMargin;

    // --- wobble telegraph -- repurposed (ticket 17 §4), retired (ticket 16 §3a) ---
    // Used to track "how close to whichever edge is live" (forward trip margin or backward
    // slip margin). With no edges left to trip on, it tracked `effort`, the cost knee: past
    // WOBBLE.ONSET of the knee it meant "this is costing you," not "you're about to fall."
    // Gated behind WOBBLE.ENABLED, exactly like STUMBLE.ENABLED above -- playtested and
    // rejected as annoying (DESIGN.md "Telegraphing", ticket 16 §3a). The HUD's stamina bar
    // (level + three-colour tier, ticket 16 §3b) is the only cost feedback left -- no burn
    // rate signal survives either. Kept computing wobbleDeg = 0 in the disabled branch
    // rather than skipping the block so bodyAngleDeg below never needs its own gate.
    const stumbling = STUMBLE.ENABLED && stumblePhase !== null;
    if (!WOBBLE.ENABLED || stumbling) {
      wobbleDeg = 0; // "Wobble is zero during a stumble" (DESIGN.md "Telegraphing"), or off.
    } else {
      // Normalized over [ONSET, FULL_EFFORT], NOT [ONSET, 1]. Sustainable effort sits just
      // past the knee (ticket 21), so normalizing to the knee would peg this at full
      // amplitude for the whole race -- see the WOBBLE comment in constants.js.
      const wobbleT = clamp(
        (Math.max(0, effort) - WOBBLE.ONSET) / (WOBBLE.FULL_EFFORT - WOBBLE.ONSET),
        0,
        1
      );
      const amp = WOBBLE.MAX_DEG * Math.pow(wobbleT, WOBBLE.RAMP_POWER);
      wobbleClock += dt;
      wobbleDeg = amp * Math.sin(wobbleClock * WOBBLE.FREQ_HZ * TAU);
    }

    // --- stamina (ticket 18) ---
    // `bonked` reflects the tank as it stood at the start of this frame (stamina only
    // decreases, so "was it already empty" and "is it empty now, pre-drain" are the same
    // question). Bonking caps commit at 0 -- no leaning above ideal, no pushing, no
    // sprinting -- and separately scales speed down; it does not touch `effort`/drain, so a
    // bonked runner still holding a hard lean burns nothing further only because drain was
    // already clamping stamina at 0, not because effort stops being computed.
    const bonked = stamina <= 0;
    if (bonked) commit = Math.min(commit, 0);

    // Terrain: climbing is expensive scaled by grade; descending is cheap, floored so it's
    // never free (DESIGN.md "Terrain: where you spend"). Uses raw slopeSigned, not smoothed
    // -- unlike idealLean/margin, drain should track the ground under your feet right now.
    const terrainFactor =
      slopeSigned > 0
        ? 1 + STAMINA.CLIMB_COST * Math.sin(slopeSigned)
        : Math.max(STAMINA.DESCENT_MIN, 1 - STAMINA.DESCENT_RELIEF * Math.sin(-slopeSigned));

    let drain =
      (STAMINA.FLOOR +
        STAMINA.PUSH * Math.max(0, effort) +
        STAMINA.REDLINE * Math.max(0, effort - 1) ** 2) *
      terrainFactor;

    // Braking cost: leaning back against a steep descent's fall line still costs, so there
    // is no free safe option going downhill (DESIGN.md, and v2's best idea surviving intact
    // as a cost instead of a slip risk).
    if (slopeSigned < -MARGIN.SLIP_ONSET_DEG * RAD_PER_DEG && effort < 0) {
      drain += STAMINA.BRAKE_COST * Math.abs(effort) * Math.sin(-slopeSigned);
    }

    // --- posture/gait tell (ticket 18 §4) ---
    // Uses the tank level entering this frame, same timing basis as `bonked` above.
    const staminaFraction = stamina / staminaMax;
    const tiredT = clamp(
      (STAMINA.TIRED_FRACTION - staminaFraction) / STAMINA.TIRED_FRACTION,
      0,
      1
    );
    const gaitApexMult = lerp(1, STAMINA.TIRED_APEX_MULT, tiredT);
    const slumpDeg = STAMINA.TIRED_SLUMP_MAX_DEG * tiredT;

    // --- speed ---
    const gradeFactor = clamp(
      1 - SPEED.GRADE_DRAG * Math.sin(slopeSigned),
      SPEED.MIN_FACTOR,
      SPEED.MAX_FACTOR
    );
    // Diminishing returns above the knee (ticket 17 §3): linear up to commit === 1, then an
    // exponential falloff so leaning further always helps, just less and less.
    const gain =
      commit <= 1
        ? commit
        : 1 + SPEED.SPRINT_GAIN * (1 - Math.exp(-(commit - 1) / SPEED.SPRINT_FALLOFF));
    let targetSpeed = Math.min(
      SPEED.MAX,
      SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * gain)
    );
    if (bonked) targetSpeed *= STAMINA.EXHAUSTED_MULT;

    // --- trip/slip trigger (ticket 12 §2/§3.3, gated: ticket 17 §1) ---
    // Only while not already stumbling; dwell timers reset the instant either condition
    // stops holding, so a single-frame spike never takes you down. The whole block is a
    // no-op while STUMBLE.ENABLED is false -- stumblePhase can then never leave null.
    if (STUMBLE.ENABLED && !stumbling && !finished) {
      // Backward slip eligibility (ticket 12 §2): descents only, and only once smoothed
      // slope is steeper than SLIP_ONSET_DEG.
      const isDescent = slopeSmoothed < 0;
      const slipActive = isDescent && slopeSmoothedDeg > MARGIN.SLIP_ONSET_DEG;
      const slipMargin = MARGIN.SLIP_MARGIN_DEG * graceMultiplier;

      if (balance > tripMargin) {
        tripDwell += dt;
      } else {
        tripDwell = 0;
      }
      if (slipActive && balance < -slipMargin) {
        slipDwell += dt;
      } else {
        slipDwell = 0;
      }

      if (tripDwell >= STUMBLE.TRIGGER_TIME || slipDwell >= STUMBLE.TRIGGER_TIME) {
        stumblePhase = 'pitch';
        stumbleClock = 0;
        stumbleKind = tripDwell >= STUMBLE.TRIGGER_TIME ? 'trip' : 'slip';
        pitchStartSpeed = targetSpeed;
        pitchStartAngle = lean;
        tripDwell = 0;
        slipDwell = 0;
        onStumble?.(path.pointAt(s).x, path.pointAt(s).y, runner.facing);
      }
    }

    // --- resolve this frame's speed and rendered body angle ---
    let bodyAngleDeg;
    if (STUMBLE.ENABLED && stumblePhase === 'pitch') {
      const t = clamp01(stumbleClock / STUMBLE.PITCH_TIME);
      const pitchTarget = stumbleKind === 'trip' ? STUMBLE.PITCH_DEG : -STUMBLE.PITCH_DEG;
      speed = lerp(pitchStartSpeed, STUMBLE.SKID_SPEED, t);
      bodyAngleDeg = lerp(pitchStartAngle, pitchTarget, t);
    } else if (STUMBLE.ENABLED && stumblePhase === 'recover') {
      const t = clamp01((stumbleClock - STUMBLE.PITCH_TIME) / STUMBLE.RECOVER_TIME);
      const pitchTarget = stumbleKind === 'trip' ? STUMBLE.PITCH_DEG : -STUMBLE.PITCH_DEG;
      speed = lerp(STUMBLE.SKID_SPEED, targetSpeed, t);
      bodyAngleDeg = lerp(pitchTarget, idealLean, t);
    } else {
      // Normal running -- the only reachable branch while STUMBLE.ENABLED is false. Adds
      // the tired slump (ticket 18 §4) on top of lean + wobble.
      speed = targetSpeed;
      bodyAngleDeg = lean + wobbleDeg + slumpDeg;
    }

    // --- stamina drain applied (ticket 18 §1: only ever decreases) ---
    // Uses `finished` as it stood before this frame's arc-length advance below, so the tank
    // stops draining once truly finished but still drains on the exact frame the runner
    // crosses the line (consistent with speed still being applied that same frame).
    if (!finished) {
      stamina = Math.max(0, stamina - drain * dt);
      if (!bonkFired && stamina <= 0) {
        bonkFired = true;
        onBonk?.();
      }
    }

    // --- arc-length advance ---
    // "The racer keeps moving forward throughout" (ticket 12) -- s never stops or reverses
    // during a stumble, it just advances at whatever `speed` the pitch/recover lerp above
    // is producing this frame.
    const wasFinished = finished;
    if (!finished) {
      s = Math.min(path.length, s + speed * dt);
      if (s >= path.length) finished = true;
    }

    if (finished && !wasFinished) {
      // Just crossed the line, possibly mid-hop. Capture whatever offset the (now-frozen)
      // hop parabola was showing at this instant and ease from there instead of
      // recomputing it every frame after, which would hold the runner hovering.
      const u0 = clamp01((s - hopS0) / HOP.GAIT_DIST);
      const a0 = path.pointAt(hopS0);
      const b0 = path.pointAt(hopS0 + HOP.GAIT_DIST);
      const chordY0 = a0.y + (b0.y - a0.y) * u0;
      const hopY0 = chordY0 + HOP.GAIT_APEX * gaitApexMult * 4 * u0 * (1 - u0);
      settleFrom = hopY0 - path.pointAt(s).y;
      settling = true;
      settleTimer = 0;
    }

    let dy;

    if (settling) {
      settleTimer += dt;
      const t = clamp01(settleTimer / HOP.FINISH_EASE_TIME);
      dy = lerp(settleFrom, 0, t);
      if (t >= 1) {
        settling = false;
        idleT = 0;
      }
    } else if (finished) {
      // Settled: keep a small gait-shaped bob going in place -- s no longer advances, so
      // this is driven by elapsed time rather than the arc-length hop machinery below.
      idleT += dt;
      const period = HOP.GAIT_DIST / SPEED.BASE;
      const u = (idleT % period) / period;
      dy = HOP.GAIT_APEX * gaitApexMult * 4 * u * (1 - u);
    } else {
      // Gait hop, parameterized by arc length (not elapsed time) so it stays correct even
      // when speed changes mid-hop -- see DESIGN.md "Motion model". Apex is scaled down as
      // the tank empties (ticket 18 §4's posture/gait tell).
      const u = clamp01((s - hopS0) / HOP.GAIT_DIST);
      const a = path.pointAt(hopS0);
      const b = path.pointAt(hopS0 + HOP.GAIT_DIST);
      const chordY = a.y + (b.y - a.y) * u;
      const hopY = chordY + HOP.GAIT_APEX * gaitApexMult * 4 * u * (1 - u); // parabola, zero at u=0,1
      dy = hopY - path.pointAt(s).y;

      if (u >= 1) {
        hopS0 = s; // land and immediately begin the next hop -- the gait loops forever
        const landing = path.pointAt(s); // dy is exactly 0 here -- feet are on the ground
        onGaitLand?.(landing.x, landing.y, runner.facing);
      }
    }

    // Order matters: setLean/setHopOffset before setGroundS, which reads both to place
    // and pose the runner -- setting them after would lag the pose a frame.
    //
    // bodyAngleDeg is the fully composed body angle resolved above: lean + wobble in
    // normal running, or the stumble pitch REPLACING both while going down. Ticket 12: "a
    // runner going down is not also holding a lean" -- adding them would double up on top
    // of the clamp trap (see RUNNER.TILT_MAX_DEG in constants.js and runner.js).
    runner.setLean(bodyAngleDeg);
    runner.setHopOffset(dy);
    runner.setGroundS(s);
  }

  return {
    update,
    reset,
    get isFinished() {
      return finished;
    },
    get s() {
      return s;
    },
    get speed() {
      return speed;
    },
    get slopeSigned() {
      return slopeSigned;
    },
    get lean() {
      return lean;
    },
    // Ticket 17: commit (speed's fixed-reference ratio) and effort (the technical-scaled
    // cost ratio ticket 18's drain reads) -- exposed side by side per ticket 17 §2.
    get commit() {
      return commit;
    },
    get effort() {
      return effort;
    },
    // Ticket 18: the tank. HUD meter is ticket 15's job -- this is just the state.
    get stamina() {
      return stamina;
    },
    get staminaFraction() {
      return stamina / staminaMax;
    },
    // Ticket 21 §1: this course's derived tank, exposed alongside the live `stamina` value
    // for HUD/debugging consumers -- not read anywhere in ticket 21 itself.
    get staminaMax() {
      return staminaMax;
    },
    get isBonked() {
      return stamina <= 0;
    },
    // Exposed for HUD/camera consumers and for debugging the stumble machinery -- moot
    // (always false/null) while STUMBLE.ENABLED is false.
    get isStumbling() {
      return STUMBLE.ENABLED && stumblePhase !== null;
    },
    get stumblePhase() {
      return STUMBLE.ENABLED ? stumblePhase : null;
    },
  };
}
