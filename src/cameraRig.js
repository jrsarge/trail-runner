// FOLLOW / STACK camera shots and the one-way blend between them. See DESIGN.md
// "Camera" and ticket 06.

import { CAMERA } from './constants.js';
import { DEFAULT_COURSE } from './courses/index.js';

function smoothstep01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createCameraRig(camera, path, course = DEFAULT_COURSE) {
  const sStackStart = path.segmentStartS(course.firstLegIndex);

  // FOLLOW's own exponentially-eased center; starts at the start-line target so there's
  // no snap-in on the very first frame.
  const startP = path.pointAt(0);

  let followX;
  let followY;
  let stackEntered;
  let blendT; // 0 -> 1 over CAMERA.STACK_BLEND once entered, then locked (held)

  // Ticket 07: restart must put the camera back on the FOLLOW shot at the start line --
  // a rig that forgets it already entered STACK is the classic second-run bug.
  function reset() {
    followX = startP.x + CAMERA.LOOKAHEAD;
    followY = startP.y + CAMERA.LOOKAHEAD_Y;
    stackEntered = false;
    blendT = 0;
  }
  reset();

  function update(dt, runner) {
    // FOLLOW target: runner position + lookahead. Use the runner's *ground* y (position
    // minus the current hop offset) plus a damped fraction of the hop offset, so the
    // camera drifts with the hop instead of pogo-ing 1:1 with every small trot arc.
    const groundY = runner.group.position.y - runner.hopOffset;
    const dampedY = groundY + runner.hopOffset * CAMERA.HOP_DAMP;
    const targetX = runner.group.position.x + CAMERA.LOOKAHEAD * runner.facing;
    const targetY = dampedY + CAMERA.LOOKAHEAD_Y;

    const followFactor = 1 - Math.exp(-CAMERA.FOLLOW_LAMBDA * dt);
    followX += (targetX - followX) * followFactor;
    followY += (targetY - followY) * followFactor;

    if (!stackEntered && runner.s >= sStackStart - CAMERA.STACK_LEAD) {
      stackEntered = true;
    }
    if (stackEntered && blendT < 1) {
      blendT = Math.min(1, blendT + dt / CAMERA.STACK_BLEND);
    }

    let centerX;
    let centerY;
    let halfHeight;

    if (!stackEntered) {
      centerX = followX;
      centerY = followY;
      halfHeight = CAMERA.HALF_HEIGHT;
    } else if (blendT >= 1) {
      // Held static through the finish -- no longer tracks the runner at all.
      centerX = CAMERA.STACK_X;
      centerY = CAMERA.STACK_Y;
      halfHeight = CAMERA.STACK_HALF_HEIGHT;
    } else {
      const t = smoothstep01(blendT);
      centerX = lerp(followX, CAMERA.STACK_X, t);
      centerY = lerp(followY, CAMERA.STACK_Y, t);
      halfHeight = lerp(CAMERA.HALF_HEIGHT, CAMERA.STACK_HALF_HEIGHT, t);
    }

    const aspect = window.innerWidth / window.innerHeight;
    // Floor so a narrow/portrait window still shows the whole stack + banner width-wise.
    // Raising halfHeight only ever adds vertical coverage, so the y requirement still holds.
    if (halfHeight * aspect < CAMERA.STACK_MIN_WIDTH / 2) {
      halfHeight = CAMERA.STACK_MIN_WIDTH / 2 / aspect;
    }

    const halfW = halfHeight * aspect;
    camera.position.x = centerX;
    camera.position.y = centerY;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  return { update, reset };
}
