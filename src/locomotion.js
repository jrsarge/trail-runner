// Constant-pace arc-length locomotion plus parametric hop arcs. No physics, no gravity
// integration, no collision detection -- see DESIGN.md "Motion model" and ticket 05.

import { RUN_SPEED, HOP } from './constants.js';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createLocomotion(path, runner, onBigLand) {
  let s = 0;
  let finished = false;

  // Current hop: an arc over the chord from path.pointAt(hopS0) to
  // path.pointAt(hopS0 + hopDist), parameterized by u = (s - hopS0) / hopDist.
  let hopS0 = 0;
  let hopDist = HOP.GAIT_DIST;
  let hopApex = HOP.GAIT_APEX;
  let hopIsBig = false;

  // Time since the last big-hop landing; Infinity means "no landing squash pending".
  let squashTimer = Infinity;

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

  function beginHop(dist, apex, big) {
    hopS0 = s;
    hopDist = dist;
    hopApex = apex;
    hopIsBig = big;
  }

  function requestHop() {
    if (finished || hopIsBig) return; // no buffering; a press mid-big-hop is ignored
    beginHop(HOP.BIG_DIST, HOP.BIG_APEX, true);
  }

  function reset() {
    s = 0;
    finished = false;
    hopS0 = 0;
    hopDist = HOP.GAIT_DIST;
    hopApex = HOP.GAIT_APEX;
    hopIsBig = false;
    squashTimer = Infinity;
    settling = false;
    settleFrom = 0;
    settleTimer = 0;
    idleT = 0;
    runner.setHopOffset(0, 0);
    runner.setGroundS(0);
  }

  function update(dt) {
    const wasFinished = finished;
    if (!finished) {
      s = Math.min(path.length, s + RUN_SPEED * dt);
      if (s >= path.length) finished = true;
    }

    if (finished && !wasFinished) {
      // Just crossed the line, possibly mid-hop. Capture whatever offset the (now-frozen)
      // hop parabola was showing at this instant and ease from there instead of
      // recomputing it every frame after, which would hold the runner hovering.
      const u0 = clamp01((s - hopS0) / hopDist);
      const a0 = path.pointAt(hopS0);
      const b0 = path.pointAt(hopS0 + hopDist);
      const chordY0 = a0.y + (b0.y - a0.y) * u0;
      const hopY0 = chordY0 + hopApex * 4 * u0 * (1 - u0);
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
      // this is driven by elapsed time rather than the arc-length hop machinery above.
      idleT += dt;
      const period = HOP.GAIT_DIST / RUN_SPEED;
      const u = (idleT % period) / period;
      dy = HOP.GAIT_APEX * 4 * u * (1 - u);
    } else {
      const u = clamp01((s - hopS0) / hopDist);
      const a = path.pointAt(hopS0);
      const b = path.pointAt(hopS0 + hopDist);
      const chordY = a.y + (b.y - a.y) * u;
      const hopY = chordY + hopApex * 4 * u * (1 - u); // parabola, zero at u=0 and u=1
      dy = hopY - path.pointAt(s).y;

      if (u >= 1) {
        if (hopIsBig) {
          squashTimer = 0; // start the landing-squash decay
          const landing = path.pointAt(s);
          onBigLand?.(landing.x, landing.y, runner.facing);
        }
        beginHop(HOP.GAIT_DIST, HOP.GAIT_APEX, false); // gait loops forever
      }
    }

    squashTimer += dt;
    const squash = squashTimer < HOP.LAND_SQUASH_TIME
      ? HOP.LAND_SQUASH * (1 - squashTimer / HOP.LAND_SQUASH_TIME)
      : 0;

    // Order matters: setGroundS reads the runner's current hop offset to place it, so
    // the offset must be set first or position.y lags a frame behind the computed hop.
    runner.setHopOffset(dy, squash);
    runner.setGroundS(s);
  }

  return {
    update,
    requestHop,
    reset,
    get isFinished() {
      return finished;
    },
    get s() {
      return s;
    },
  };
}
