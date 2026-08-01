// A racer is one competitor: a pose (the two-square runner mesh), locomotion along the
// path, and a controller supplying intent. race.js owns an array of these with one flagged
// as the player, so adding AI opponents later touches neither this file nor race.js
// (DESIGN.md "Architecture: racers are instantiable").
//
// v2 ships exactly one racer. Do not add an AI controller here.

import { createRunner } from './runner.js';
import { createLocomotion } from './locomotion.js';
import { createPlayerController } from './controllers.js';
import { DUST } from './constants.js';

export function createRacer({
  path,
  controller = createPlayerController(),
  palette,
  isPlayer = false,
  // Optional: the shared dust pool (see main.js). Continuous gait-landing dust and the
  // bigger stumble burst are both driven from locomotion's callbacks (ticket 12/13) --
  // racer.js is just the wiring between them and dust.js, so a racer with no `dust` passed
  // (e.g. a future AI opponent that doesn't kick up dust) still works.
  dust,
} = {}) {
  const runner = createRunner(path, palette);
  const locomotion = createLocomotion(path, runner, {
    onGaitLand: (x, y, facing) => dust?.emit(x, y, facing),
    onStumble: (x, y, facing) =>
      dust?.emit(x, y, facing, {
        count: DUST.PER_STUMBLE,
        speed: DUST.STUMBLE_SPEED,
        spread: DUST.STUMBLE_SPREAD,
      }),
    // Unconsumed for now -- no HUD to flash yet (ticket 15). Wired here so that ticket
    // stays a HUD-only change.
    onBonk: () => {},
  });

  // Read-only state handed to the controller each tick. Reused rather than reallocated --
  // this runs at 120 Hz per racer.
  const view = { s: 0, speed: 0, slope: 0 };

  // Latest controller intent -- ticket 11 turns this into lean via locomotion.
  let input = { lean: 0 };

  /**
   * @param {number} dt
   * @param {boolean} advance  false during READY/COUNTDOWN: pose still eases (so facing is
   *                           settled before the gun) but the racer must not move.
   */
  function update(dt, advance) {
    view.s = locomotion.s;
    view.speed = locomotion.speed;
    const tangent = path.tangentAt(locomotion.s);
    view.slope = Math.atan2(tangent.y, Math.abs(tangent.x));
    input = controller.update(dt, view) ?? input;

    // Order matters and matches v1: locomotion places the runner, then the pose update
    // eases facing/tilt from that placement. Swapping these lags the pose a frame.
    if (advance) locomotion.update(dt, input.lean);
    runner.update(dt);
  }

  function reset() {
    locomotion.reset();
    runner.reset();
    controller.reset?.();
    input = { lean: 0 };
    view.s = 0;
    view.speed = 0;
    view.slope = 0;
  }

  return {
    group: runner.group,
    isPlayer,
    update,
    reset,

    // Read by cameraRig (group.position, hopOffset, facing, s) and hud (s, isFinished).
    get s() {
      return locomotion.s;
    },
    get isFinished() {
      return locomotion.isFinished;
    },
    get facing() {
      return runner.facing;
    },
    get hopOffset() {
      return runner.hopOffset;
    },
    get leanInput() {
      return input.lean;
    },
    // Exposed for the HUD, camera, and ticket 11 (ticket 10 §3).
    get speed() {
      return locomotion.speed;
    },
    get slopeSigned() {
      return locomotion.slopeSigned;
    },
    // Exposed for ticket 14's camera shake. Moot while STUMBLE.ENABLED is false.
    get isStumbling() {
      return locomotion.isStumbling;
    },
    // Exposed for the HUD (ticket 15) and for balance tuning (ticket 16); not consumed
    // anywhere in tickets 17/18 themselves.
    get stamina() {
      return locomotion.stamina;
    },
    get staminaFraction() {
      return locomotion.staminaFraction;
    },
    get isBonked() {
      return locomotion.isBonked;
    },
    get commit() {
      return locomotion.commit;
    },
    get effort() {
      return locomotion.effort;
    },
  };
}
