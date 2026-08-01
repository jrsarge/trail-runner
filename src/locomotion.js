// Variable-speed arc-length locomotion plus a parametric gait hop, player lean, and the
// trip/slip/stumble state machine with its wobble telegraph. No physics, no gravity
// integration, no collision detection -- see DESIGN.md "Motion model", "Speed", "The core
// mechanic", "Fairness", "Telegraphing", "Stumbling", and tickets 10/11/12/13.
//
// v2 removed the manual big hop entirely (ticket 10): the gait hop now runs continuously,
// forever, driven by arc length so it stays correct even while speed varies mid-hop. The
// gait hop is NOT suspended during a stumble -- it's arc-length driven (see HOP comment
// below) so it stays correct however speed is behaving, and continuing to bob while
// pitched forward reads fine (ticket 12/13 don't ask for it to stop either).

import { SPEED, LEAN, MARGIN, HOP, STUMBLE, TRANSITION, WOBBLE } from './constants.js';

const DEG_PER_RAD = 180 / Math.PI;
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

export function createLocomotion(path, runner, callbacks = {}) {
  // callbacks.onGaitLand(x, y, facing) -- every gait-hop landing (ticket 13 hangs
  // continuous dust on this).
  // callbacks.onStumble(x, y, facing) -- once, at the moment a trip/slip triggers (ticket
  // 13 hangs a dust burst here, ticket 14 a camera shake).
  const { onGaitLand, onStumble } = callbacks;

  let s = 0;
  let finished = false;

  // Player lean, degrees, signed in the travel frame (+ = forward). Ticket 11.
  let lean = 0;
  // Exponentially low-passed slopeSigned (radians), so idealLean doesn't snap at sharp
  // grade transitions -- see DESIGN.md "Fairness".
  let slopeSmoothed = 0;
  let slopeSigned = 0;
  let speed = 0;

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

  // Transition grace: widens the margin while idealLean is changing fast (the switchback
  // folds, where the grade reverses outright). Counts down; refreshed to full whenever a
  // spike is currently happening, so grace persists through a sustained fast transition.
  let transitionGraceTimer = 0;
  let prevIdealLean = 0;

  // Post-stumble grace: widens the margin for STUMBLE.GRACE_TIME after recovery so you
  // don't immediately re-trip on the same steep ground.
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
    transitionGraceTimer = 0;
    prevIdealLean = 0;
    stumbleGraceTimer = 0;
    wobbleClock = 0;
    wobbleDeg = 0;
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

    // --- stumble phase clock (ticket 12) ---
    // Advances (and can complete) BEFORE this frame's lean integration/render, so a
    // recover->grace transition this frame resets `lean` to idealLean in time to matter
    // this same frame, and so the pitch/recover render branch below sees an up-to-date
    // stumbleClock.
    if (stumblePhase) {
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
    if (stumbleGraceTimer > 0) stumbleGraceTimer = Math.max(0, stumbleGraceTimer - dt);

    // --- lean integration (ticket 11), gated by ticket 12's input lock ---
    // Doing nothing must be wrong on steep ground: with no input, lean decays back toward
    // upright instead of holding, so the player has to actively commit. Input is locked for
    // STUMBLE.INPUT_LOCK from the moment a stumble triggers (treated as leanInput === 0, so
    // lean still decays rather than freezing); the player has control again after that even
    // though the rendered body angle keeps following the pitch/recover curve, not `lean`,
    // until recover completes and snaps it back to idealLean above.
    const inputLocked = stumblePhase !== null && stumbleClock < STUMBLE.INPUT_LOCK;
    const effectiveLeanInput = inputLocked ? 0 : leanInput;
    lean += effectiveLeanInput * LEAN.RATE_DEG * dt;
    if (effectiveLeanInput === 0) lean = moveToward(lean, 0, LEAN.DECAY_DEG * dt);
    lean = clamp(lean, -LEAN.MAX_BACK_DEG, LEAN.MAX_FWD_DEG);

    // --- transition grace (ticket 12 §3.2) ---
    // Widen the margin while idealLean is changing fast -- the switchback folds reverse the
    // grade outright and would otherwise spike the trip margin unreadably.
    const idealLeanRate = dt > 0 ? Math.abs(idealLean - prevIdealLean) / dt : 0;
    if (idealLeanRate > TRANSITION.SPIKE_DEG_PER_S) {
      transitionGraceTimer = TRANSITION.GRACE_TIME;
    } else if (transitionGraceTimer > 0) {
      transitionGraceTimer = Math.max(0, transitionGraceTimer - dt);
    }
    prevIdealLean = idealLean;

    // Two grace sources can be active at once (e.g. recovering right as terrain spikes);
    // take the wider of the two rather than stacking them multiplicatively.
    let graceMultiplier = 1;
    if (transitionGraceTimer > 0) {
      graceMultiplier = Math.max(graceMultiplier, TRANSITION.GRACE_MARGIN_MULT);
    }
    if (stumbleGraceTimer > 0) {
      graceMultiplier = Math.max(graceMultiplier, STUMBLE.GRACE_MARGIN_MULT);
    }

    // --- the real margin (ticket 12 §1) ---
    const marginBase = clamp(
      MARGIN.BASE_DEG - MARGIN.SLOPE_NARROW * slopeSmoothedDeg,
      MARGIN.MIN_DEG,
      MARGIN.BASE_DEG
    );
    const technical = path.technicalAt(s);
    const margin = (marginBase / technical) * graceMultiplier;

    const balance = lean - idealLean;
    // Feeds the speed formula below (DESIGN.md "Speed") -- note this means graceMultiplier
    // (widened margin) slightly *lowers* speed at a constant lean, since commit shrinks
    // toward 0 as margin widens. That's a side effect of margin being the one shared knob,
    // not a separate tuning decision.
    const commit = clamp(balance / margin, -1, 1);

    // --- backward slip eligibility (ticket 12 §2) ---
    // Descents only, and only once smoothed slope is steeper than SLIP_ONSET_DEG. Climbing,
    // leaning back is merely slow and carries no risk -- there is no backward threshold at
    // all in that case (not even a wide one).
    const isDescent = slopeSmoothed < 0;
    const slipActive = isDescent && slopeSmoothedDeg > MARGIN.SLIP_ONSET_DEG;
    // Not scaled by `technical` (the ticket's formula for the slip threshold is a flat
    // constant, and every switchback leg is a climb, not a descent, so it never applies
    // there anyway) but IS widened by the same graceMultiplier as the forward margin --
    // otherwise a terrain-driven idealLean spike could produce an unreadable slip exactly
    // the way DESIGN.md's fairness section warns about for trips.
    const slipMargin = MARGIN.SLIP_MARGIN_DEG * graceMultiplier;

    // --- wobble telegraph (ticket 13) ---
    // A distinct "how close to whichever edge is live" measure from `commit` above: `commit`
    // is symmetric around the forward margin and feeds speed; wobble needs to track the
    // actual live threshold on each side, forward margin on the positive side, the slip
    // margin (only when active) on the negative side -- otherwise leaning back hard on a
    // descent would wobble against the wrong (looser) number, or not at all.
    let edgeFactor = 0;
    if (balance >= 0) {
      edgeFactor = margin > 0 ? balance / margin : 0;
    } else if (slipActive) {
      edgeFactor = -balance / slipMargin;
    }
    edgeFactor = Math.max(0, edgeFactor);

    const stumbling = stumblePhase !== null;
    if (stumbling) {
      wobbleDeg = 0; // "Wobble is zero during a stumble" (DESIGN.md "Telegraphing")
    } else {
      const wobbleT = clamp((edgeFactor - WOBBLE.ONSET) / (1 - WOBBLE.ONSET), 0, 1);
      const amp = WOBBLE.MAX_DEG * Math.pow(wobbleT, 1.5);
      wobbleClock += dt;
      wobbleDeg = amp * Math.sin(wobbleClock * WOBBLE.FREQ_HZ * TAU);
    }

    // --- speed (DESIGN.md "Speed") ---
    const gradeFactor = clamp(
      1 - SPEED.GRADE_DRAG * Math.sin(slopeSigned),
      SPEED.MIN_FACTOR,
      SPEED.MAX_FACTOR
    );
    const targetSpeed = SPEED.BASE * gradeFactor * (1 + SPEED.COMMIT_BONUS * commit);

    // --- trip/slip trigger (ticket 12 §2/§3.3) ---
    // Only while not already stumbling; dwell timers reset the instant either condition
    // stops holding, so a single-frame spike never takes you down.
    if (!stumbling && !finished) {
      if (balance > margin) {
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
    if (stumblePhase === 'pitch') {
      const t = clamp01(stumbleClock / STUMBLE.PITCH_TIME);
      const pitchTarget = stumbleKind === 'trip' ? STUMBLE.PITCH_DEG : -STUMBLE.PITCH_DEG;
      speed = lerp(pitchStartSpeed, STUMBLE.SKID_SPEED, t);
      bodyAngleDeg = lerp(pitchStartAngle, pitchTarget, t);
    } else if (stumblePhase === 'recover') {
      const t = clamp01((stumbleClock - STUMBLE.PITCH_TIME) / STUMBLE.RECOVER_TIME);
      const pitchTarget = stumbleKind === 'trip' ? STUMBLE.PITCH_DEG : -STUMBLE.PITCH_DEG;
      speed = lerp(STUMBLE.SKID_SPEED, targetSpeed, t);
      bodyAngleDeg = lerp(pitchTarget, idealLean, t);
    } else {
      // Normal running, including the post-stumble grace window -- grace only widens the
      // margin, it doesn't change how lean/wobble render.
      speed = targetSpeed;
      bodyAngleDeg = lean + wobbleDeg;
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
      const hopY0 = chordY0 + HOP.GAIT_APEX * 4 * u0 * (1 - u0);
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
      dy = HOP.GAIT_APEX * 4 * u * (1 - u);
    } else {
      // Gait hop, parameterized by arc length (not elapsed time) so it stays correct even
      // when speed changes mid-hop -- see DESIGN.md "Motion model".
      const u = clamp01((s - hopS0) / HOP.GAIT_DIST);
      const a = path.pointAt(hopS0);
      const b = path.pointAt(hopS0 + HOP.GAIT_DIST);
      const chordY = a.y + (b.y - a.y) * u;
      const hopY = chordY + HOP.GAIT_APEX * 4 * u * (1 - u); // parabola, zero at u=0, u=1
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
    // Exposed for HUD/camera consumers (ticket 14/15) and for debugging the fairness
    // machinery -- not read anywhere in tickets 12/13 themselves.
    get isStumbling() {
      return stumblePhase !== null;
    },
    get stumblePhase() {
      return stumblePhase;
    },
  };
}
