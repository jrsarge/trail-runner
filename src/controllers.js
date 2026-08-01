// Controllers decide what a racer *wants* to do; the racer decides what happens. The split
// exists so an AI opponent is a later feature rather than a later rewrite -- an
// AiController returning scripted lean input drops in with no changes to racer or race
// (DESIGN.md "Architecture: racers are instantiable").
//
// Contract:  update(dt, view) -> { lean: -1 | 0 | +1 }
//
// `view` is read-only racer state (s, speed, slope...). It exists so an AI can see what
// it's reacting to; the player controller ignores it.
//
// PlayerController reads ArrowLeft/ArrowRight (and A/D), ticket 11. Both held cancels to 0.
// preventDefault() on the arrow keys -- same page-scroll trap as Space (see main.js).
// Keyboard only: pointerdown stays start/restart, touch is an explicit non-goal for v2.

const LEFT_CODES = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_CODES = new Set(['ArrowRight', 'KeyD']);

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
