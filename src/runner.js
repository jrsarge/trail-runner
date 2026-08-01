// Two-square runner: a Group whose origin sits at the feet, placed and posed from arc
// length. See DESIGN.md "Motion model" and ticket 04.

import * as THREE from 'three';
import { COLORS, Z, RUNNER } from './constants.js';

// Below this magnitude, group.scale.x === 0 can produce a degenerate (non-invertible)
// matrix; nudge away from exactly zero while still reading as fully squashed.
const FLIP_EPSILON = 0.02;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createRunner(path, palette = {}) {
  const bodyColor = palette.body ?? COLORS.RUNNER_BODY;
  const headColor = palette.head ?? COLORS.RUNNER_HEAD;
  const group = new THREE.Group();
  group.position.z = Z.RUNNER;

  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNNER.BODY_W, RUNNER.BODY_H),
    new THREE.MeshBasicMaterial({ color: bodyColor })
  );
  body.position.set(0, RUNNER.BODY_H / 2, 0); // center y = 0.475, feet at group origin
  group.add(body);

  const headCenterY = RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S / 2; // 1.30
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNNER.HEAD_S, RUNNER.HEAD_S),
    new THREE.MeshBasicMaterial({ color: headColor })
  );
  head.position.set(0, headCenterY, 0);
  group.add(head);

  let flip = 1; // animated; eases toward flipTarget, drives scale.x and rotation sign
  let flipTarget = 1; // facing starts at +1
  let hopDy = 0;
  let currentS = 0;
  // The full composed body angle in degrees, travel frame, + = forward -- set by locomotion
  // each frame via setLean(). Ticket 11: this was just lean. Tickets 12/13: locomotion now
  // composes lean + wobble here (normal running), OR the stumble pitch REPLACING lean +
  // wobble entirely (mid-stumble a runner going down is not also holding a lean/wobble) --
  // see DESIGN.md "Rendered lean" and locomotion.js. Either way this module just renders
  // whatever single angle it's handed.
  let leanDeg = 0;

  function setLean(deg) {
    leanDeg = deg;
  }

  function setGroundS(s) {
    currentS = s;
    const p = path.pointAt(s);
    group.position.x = p.x;
    group.position.y = p.y + hopDy;

    const d = path.tangentAt(s);

    // Deadband + hysteresis: only retarget facing when the tangent is clearly one way
    // or the other. Mid-corner (near-vertical tangent) holds the last known facing, so
    // sign(tangent.x) never gets read right at the undefined point of a sharp vertex.
    if (Math.abs(d.x) > RUNNER.FACING_DEADBAND) {
      flipTarget = d.x > 0 ? 1 : -1;
    }

    // Player lean REPLACES the v1 terrain-derived tilt (ticket 11) -- idealLean already
    // encodes the slope (see locomotion.js), so a separate terrain-tilt term here would
    // double-count it. leanDeg here is locomotion's already-composed body angle: normally
    // lean + wobble, or the stumble pitch replacing both while going down (ticket 12/13).
    // Defensively clamped to TILT_MAX_DEG (75 -- see constants.js), which now has to cover
    // STUMBLE.PITCH_DEG (70) as well as lean + wobble, not just lean alone.
    const bodyAngleDeg = clamp(leanDeg, -RUNNER.TILT_MAX_DEG, RUNNER.TILT_MAX_DEG);
    const bodyAngleRad = (bodyAngleDeg * Math.PI) / 180;
    // Composing as T·R·S: mirroring (scale.x = -1) then rotating negates the rotation,
    // so multiplying by flip here cancels that and keeps the lean sign correct on
    // leftward legs. Also means the runner is briefly upright mid-pivot, when flip ~ 0.
    //
    // The overall sign (-bodyAngleRad, not +) carries over unchanged from v1's tilt: a
    // PlaneGeometry-based figure with three.js's rotation.z convention leans its head
    // toward -sin(rotation.z)*height, and this sign was verified in-browser via
    // matrixWorld on both a rightward leg and a leftward leg to lean in the direction of
    // travel, not backward (see ticket 04 and the ticket 11 report for the leftward-leg
    // verification specifically).
    group.rotation.z = -bodyAngleRad * flip;

    const appliedFlip = Math.abs(flip) < FLIP_EPSILON
      ? (flip < 0 ? -FLIP_EPSILON : FLIP_EPSILON)
      : flip;
    group.scale.x = appliedFlip;
  }

  function setHopOffset(dy) {
    hopDy = dy;
  }

  // Ease `flip` toward `flipTarget` at a constant rate that crosses the full [-1, 1]
  // range in RUNNER.FLIP_TIME seconds, frame-rate independent via dt.
  function update(dt) {
    const maxStep = (2 / RUNNER.FLIP_TIME) * dt;
    if (flip < flipTarget) {
      flip = Math.min(flipTarget, flip + maxStep);
    } else if (flip > flipTarget) {
      flip = Math.max(flipTarget, flip - maxStep);
    }
  }

  // Ticket 07: restart must put the runner back exactly as it was on page load --
  // facing right, no lean, no hop offset, standing at s = 0.
  function reset() {
    flip = 1;
    flipTarget = 1;
    hopDy = 0;
    leanDeg = 0;
    setHopOffset(0);
    setGroundS(0);
  }

  return {
    group,
    setGroundS,
    setHopOffset,
    setLean,
    update,
    reset,
    get facing() {
      return flip;
    },
    get hopOffset() {
      return hopDy;
    },
    get s() {
      return currentS;
    },
  };
}
