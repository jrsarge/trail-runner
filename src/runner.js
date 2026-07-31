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

export function createRunner(path) {
  const group = new THREE.Group();
  group.position.z = Z.RUNNER;

  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNNER.BODY_W, RUNNER.BODY_H),
    new THREE.MeshBasicMaterial({ color: COLORS.RUNNER_BODY })
  );
  body.position.set(0, RUNNER.BODY_H / 2, 0); // center y = 0.475, feet at group origin
  group.add(body);

  const headCenterY = RUNNER.BODY_H + RUNNER.HEAD_GAP + RUNNER.HEAD_S / 2; // 1.30
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNNER.HEAD_S, RUNNER.HEAD_S),
    new THREE.MeshBasicMaterial({ color: COLORS.RUNNER_HEAD })
  );
  head.position.set(0, headCenterY, 0);
  group.add(head);

  const maxTiltRad = (RUNNER.TILT_MAX_DEG * Math.PI) / 180;

  let flip = 1; // animated; eases toward flipTarget, drives scale.x and tilt sign
  let flipTarget = 1; // facing starts at +1
  let hopDy = 0;
  let currentS = 0;

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

    // Tilt to the slope in the travel frame (facing-invariant), not the raw tangent
    // angle -- see ticket 04 for why a raw angle would stand the runner on its head on
    // leftward legs. The max(|d.x|, eps) guard keeps this finite inside a fillet, where
    // d.x passes through ~0 and slope would otherwise blow up.
    const slope = d.y / Math.max(Math.abs(d.x), 1e-4);
    const tilt = clamp(Math.atan(slope) * RUNNER.TILT_FACTOR, -maxTiltRad, maxTiltRad);
    // Composing as T·R·S: mirroring (scale.x = -1) then rotating negates the rotation,
    // so multiplying by flip here cancels that and keeps the lean sign correct on
    // leftward legs. Also means the runner is briefly upright mid-pivot, when flip ~ 0.
    //
    // The overall sign (-tilt, not +tilt) was picked empirically, not from the raw
    // formula: a PlaneGeometry-based figure with three.js's rotation.z convention leans
    // its head toward -sin(rotation.z)*height. Verified in-browser via matrixWorld on
    // both a rightward leg (leg 3) and a leftward leg (leg 4): with `+tilt * flip` the
    // head shifts opposite the travel direction on *both* legs (a backward lean); with
    // `-tilt * flip` it shifts the same direction as travel on both, matching the
    // ticket's acceptance criterion ("leans in the direction of travel ... not
    // backward"). See the final report for the measured numbers.
    group.rotation.z = -tilt * flip;

    const appliedFlip = Math.abs(flip) < FLIP_EPSILON
      ? (flip < 0 ? -FLIP_EPSILON : FLIP_EPSILON)
      : flip;
    group.scale.x = appliedFlip;
  }

  function setHopOffset(dy, squash = 0) {
    hopDy = dy;
    // Squash the body only, vertically, keeping its bottom edge (the feet) pinned at
    // the group origin -- shift the mesh's center up by half the height it lost.
    const scaleY = 1 - squash;
    body.scale.y = scaleY;
    body.position.y = (RUNNER.BODY_H * scaleY) / 2;
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
    setHopOffset(0, 0);
    setGroundS(0);
  }

  return {
    group,
    setGroundS,
    setHopOffset,
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
