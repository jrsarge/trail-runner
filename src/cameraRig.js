// FOLLOW / STACK camera shots and the one-way blend between them. See DESIGN.md
// "Camera" and ticket 06.

import { CAMERA, SPEED, STUMBLE } from './constants.js';
import { DEFAULT_COURSE } from './courses/index.js';

function smoothstep01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Cheap decorrelated noise for the stumble shake (ticket 14 §3): two offset sine sums,
// not correlated with each other, so x/y don't shake in lockstep.
function noise1(t) {
  return Math.sin(t) + 0.5 * Math.sin(2.7 * t + 1.3);
}

function noise2(t) {
  return Math.sin(t + 4.1) + 0.5 * Math.sin(3.3 * t + 0.6);
}

// Past this many decay constants the shake amplitude is negligible (< 0.1% of SHAKE_AMP);
// clearing it here rather than letting exp() asymptote to 0 is what makes "returns to
// exactly the same framing" literally true rather than off by a fraction of a unit.
const SHAKE_SETTLE_MULT = 7;

export function createCameraRig(camera, path, course = DEFAULT_COURSE) {
  // Ticket 19 §2: driven by path.ledgeRanges() rather than course.firstLegIndex, so this
  // works for any course, with any number of ledge stacks, without knowing which segment
  // index they start at.
  const ledgeRanges = path.ledgeRanges();
  // Arc length at which the *last* ledge range ends. -Infinity would make "past it" true
  // immediately when there are no ranges at all; +Infinity (via no ranges) instead makes
  // "past it" never true, which is the correct default (never pull back).
  const lastRangeEndS =
    ledgeRanges.length > 0 ? ledgeRanges[ledgeRanges.length - 1].endS : Infinity;

  // FOLLOW's own exponentially-eased center; starts at the start-line target so there's
  // no snap-in on the very first frame.
  const startP = path.pointAt(0);

  let followX;
  let followY;
  let stackEntered;
  // 0 -> 1 approaching/inside a ledge range, 1 -> 0 after leaving a non-final one. After the
  // *final* range, stackEntered latches true forever (see below) so blendT only ever rises
  // and holds -- both shipped courses put their only stack right at the climax just before
  // the finish, so this reproduces the old "held static through the finish" behavior
  // exactly (there is no more course left over which to blend back).
  let blendT;

  // Stumble shake (ticket 14 §3). shakeT is null when not shaking; prevStumbling tracks the
  // rising edge of runner.isStumbling so the shake fires once per stumble, not every frame
  // the flag is held. Both are gated behind STUMBLE.ENABLED, so this stays cold while the
  // stumble is retired (STUMBLE.ENABLED = false) but is kept working for the restore path.
  let shakeT;
  let prevStumbling;

  // Ticket 07: restart must put the camera back on the FOLLOW shot at the start line --
  // a rig that forgets it already entered STACK is the classic second-run bug.
  function reset() {
    followX = startP.x + CAMERA.LOOKAHEAD_BASE;
    followY = startP.y + CAMERA.LOOKAHEAD_Y;
    stackEntered = false;
    blendT = 0;
    shakeT = null;
    prevStumbling = false;
  }
  reset();

  function update(dt, runner) {
    // FOLLOW target: runner position + lookahead. Use the runner's *ground* y (position
    // minus the current hop offset) plus a damped fraction of the hop offset, so the
    // camera drifts with the hop instead of pogo-ing 1:1 with every small trot arc.
    // Ticket 14 §1: lookahead scales with speed rather than being fixed, so the camera
    // leads further at a sprint and pulls in when the runner slows or bonks -- speed
    // varies far more in v3 (bonked crawl to full sprint) than it did in v2.
    const groundY = runner.group.position.y - runner.hopOffset;
    const dampedY = groundY + runner.hopOffset * CAMERA.HOP_DAMP;
    const lookahead = CAMERA.LOOKAHEAD_BASE * (runner.speed / SPEED.BASE);
    const targetX = runner.group.position.x + lookahead * runner.facing;
    const targetY = dampedY + CAMERA.LOOKAHEAD_Y;

    const followFactor = 1 - Math.exp(-CAMERA.FOLLOW_LAMBDA * dt);
    followX += (targetX - followX) * followFactor;
    followY += (targetY - followY) * followFactor;

    if (runner.s > lastRangeEndS) {
      // Past every ledge range for good (s only ever advances) -- latch on.
      stackEntered = true;
    } else {
      let inOrApproaching = false;
      for (const range of ledgeRanges) {
        if (runner.s >= range.startS - CAMERA.STACK_LEAD && runner.s <= range.endS) {
          inOrApproaching = true;
          break;
        }
      }
      stackEntered = inOrApproaching;
    }

    if (stackEntered && blendT < 1) {
      blendT = Math.min(1, blendT + dt / CAMERA.STACK_BLEND);
    } else if (!stackEntered && blendT > 0) {
      blendT = Math.max(0, blendT - dt / CAMERA.STACK_BLEND);
    }

    // Ticket 14 §2: STACK is a moderate pull-back that still follows the runner -- only
    // the zoom (halfHeight) changes between FOLLOW and STACK. No hardcoded STACK_X/STACK_Y
    // to lerp toward and no static-containment floor on halfHeight -- v1's static wide shot
    // (which required containing alpine's fixed switchback geometry) is gone. That shot
    // cannot work for a second course whose stack sits at different coordinates (summit's
    // is at x ~715-731, not alpine's x ~95-113); following the runner is course-agnostic by
    // construction.
    const centerX = followX;
    const centerY = followY;
    const halfHeight = lerp(CAMERA.HALF_HEIGHT, CAMERA.STACK_HALF_HEIGHT, smoothstep01(blendT));

    const aspect = window.innerWidth / window.innerHeight;
    const halfW = halfHeight * aspect;

    // Stumble shake (ticket 14 §3): computed from the framing above but applied as a final
    // translation, never fed back into it -- feeding shake into framing would fight the
    // FOLLOW/STACK easing and drift. Moot while STUMBLE.ENABLED is false (racer.isStumbling
    // is then always false), kept working for the restore path.
    const stumbling = STUMBLE.ENABLED && runner.isStumbling;
    if (stumbling && !prevStumbling) {
      shakeT = 0;
    }
    prevStumbling = stumbling;

    let shakeX = 0;
    let shakeY = 0;
    if (shakeT !== null) {
      shakeT += dt;
      if (shakeT > CAMERA.SHAKE_DECAY * SHAKE_SETTLE_MULT) {
        // Decayed to negligible amplitude -- stop entirely rather than let exp() asymptote
        // toward (never reach) 0, so the camera returns to *exactly* the same framing.
        shakeT = null;
      } else {
        const amp = CAMERA.SHAKE_AMP * Math.exp(-shakeT / CAMERA.SHAKE_DECAY);
        shakeX = amp * noise1(shakeT * CAMERA.SHAKE_FREQ);
        shakeY = amp * noise2(shakeT * CAMERA.SHAKE_FREQ);
      }
    }

    camera.position.x = centerX + shakeX;
    camera.position.y = centerY + shakeY;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  return { update, reset };
}
