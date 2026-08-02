// Controllers decide what a racer *wants* to do; the racer decides what happens. The split
// exists so an AI opponent is a later feature rather than a later rewrite -- an
// AiController returning scripted lean input drops in with no changes to racer or race
// (DESIGN.md "Architecture: racers are instantiable").
//
// Contract:  update(dt, view) -> { lean: -1 | 0 | +1 }
//
// `view` is read-only racer state (s, progress, speed, slopeSigned, technical, lean,
// idealLean...). It exists so an AI can see what it's reacting to; the player controller
// ignores it.
//
// PlayerController reads ArrowLeft/ArrowRight (and A/D), ticket 11. Both held cancels to 0.
// preventDefault() on the arrow keys -- same page-scroll trap as Space (see main.js).
// Keyboard only: pointerdown stays start/restart, touch is an explicit non-goal for v2.

import { LEAN, AI } from './constants.js';
import { PLAN_FACTORIES } from './plans.js';

const LEFT_CODES = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD']);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createPlayerController() {
  const input = { lean: 0 };
  let leftHeld = false;
  let rightHeld = false;

  function recompute() {
    input.lean = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
  }

  function onKeyDown(event) {
    if (LEFT_CODES.has(event.code)) {
      leftHeld = true;
      event.preventDefault();
      recompute();
    } else if (RIGHT_CODES.has(event.code)) {
      rightHeld = true;
      event.preventDefault();
      recompute();
    }
  }

  function onKeyUp(event) {
    if (LEFT_CODES.has(event.code)) {
      leftHeld = false;
      recompute();
    } else if (RIGHT_CODES.has(event.code)) {
      rightHeld = false;
      recompute();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function update(_dt, _view) {
    return input;
  }

  function reset() {
    // Intentionally does NOT clear leftHeld/rightHeld: if the player is still physically
    // holding a key across a restart, lean should keep reflecting that, not freeze at 0
    // until they release and re-press.
    recompute();
  }

  return { update, reset };
}

// AiController (ticket 24): converts a pacing plan's target lean OFFSET into the same
// { lean: -1 | 0 | +1 } contract the player controller emits above. It steers toward
// `idealLean + targetOffset`, reading idealLean straight off `view` (which racer.js filled
// from locomotion's own getter this frame) -- never recomputed from raw slope, which would
// disagree with the value locomotion actually used to compute `balance` this frame.
//
// No rubber-banding: this never reads the player, or any other racer -- only its own
// `view`. Identical stamina model: this writes lean INPUT, same as the player, and
// locomotion's stamina drain reads the resulting `lean` exactly the same way regardless of
// which controller produced it.
//
// The servo is pure bang-bang -- sign(target - lean), never 0 -- deliberately with NO dead
// zone (AI.LEAN_DEADBAND_DEG is 0; see constants.js for why a dead zone would be worse, not
// safer, here). `view.lean` starts at 0 each race and locomotion integrates lean at
// LEAN.RATE_DEG/s, so there is a real, physical startup ramp before a high target is first
// reached -- that is correct behaviour, not a servo bug, and it is the same ramp ticket 16's
// own scripted-servo baseline paid.
export function createAiController({ plan, sustainableOffsetDeg }) {
  const planFn = PLAN_FACTORIES[plan](sustainableOffsetDeg);
  const input = { lean: 0 };

  function update(_dt, view) {
    const terrain = { slopeSigned: view.slopeSigned, technical: view.technical };
    const targetOffset = planFn(view.progress, terrain);
    const target = clamp(view.idealLean + targetOffset, -LEAN.MAX_BACK_DEG, LEAN.MAX_FWD_DEG);
    const error = target - view.lean;
    if (error > AI.LEAN_DEADBAND_DEG) input.lean = 1;
    else if (error < -AI.LEAN_DEADBAND_DEG) input.lean = -1;
    else input.lean = 0;
    return input;
  }

  function reset() {
    input.lean = 0;
  }

  return { update, reset };
}
