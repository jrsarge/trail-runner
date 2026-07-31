// Race state machine and timer. See DESIGN.md "Race flow" and ticket 07.
//
//   READY --(hop input)--> COUNTDOWN --(after 4 beats)--> RUNNING --(s >= length)--> FINISHED
//     ^                                                                                 |
//     +----------------------------------- R / click ---------------------------------+
//
// Owns exactly what's needed to answer "what state are we in and for how long" -- distance
// and elevation are derived from locomotion.s / path elsewhere (see hud.js). This module
// also owns the per-tick decision of *whether* locomotion/runner/cameraRig advance at all:
// the runner must not move or gait-hop during READY or COUNTDOWN.

import { RACE } from './constants.js';

export const RaceState = Object.freeze({
  READY: 'READY',
  COUNTDOWN: 'COUNTDOWN',
  RUNNING: 'RUNNING',
  FINISHED: 'FINISHED',
});

// '3', '2', '1', ..., 'GO!' -- COUNT_FROM + 1 beats total.
const BEATS = [
  ...Array.from({ length: RACE.COUNT_FROM }, (_, i) => String(RACE.COUNT_FROM - i)),
  'GO!',
];

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createRace(locomotion, runner, cameraRig) {
  let state = RaceState.READY;
  let countdownIndex = 0;
  let countdownT = 0;
  let elapsed = 0;
  let finishTime = 0;

  function startCountdown() {
    state = RaceState.COUNTDOWN;
    countdownIndex = 0;
    countdownT = 0;
  }

  function restart() {
    locomotion.reset();
    runner.reset();
    cameraRig.reset();
    state = RaceState.READY;
    countdownIndex = 0;
    countdownT = 0;
    elapsed = 0;
    finishTime = 0;
    cameraRig.update(0, runner); // prime the FOLLOW frame so there's no stale STACK frame
  }

  // Gated by state, per ticket 07: READY starts the countdown, COUNTDOWN swallows the
  // input, RUNNING forwards it to locomotion as a hop, FINISHED restarts.
  function requestHop() {
    if (state === RaceState.READY) {
      startCountdown();
    } else if (state === RaceState.RUNNING) {
      locomotion.requestHop();
    } else if (state === RaceState.FINISHED) {
      restart();
    }
    // COUNTDOWN: no-op.
  }

  // A dedicated restart trigger (the R key, the finish card) -- unlike requestHop(), this
  // never starts a countdown; it only ever fires from FINISHED.
  function requestRestart() {
    if (state === RaceState.FINISHED) restart();
  }

  function update(dt) {
    if (state === RaceState.COUNTDOWN) {
      countdownT += dt;
      while (countdownT >= RACE.COUNT_BEAT && state === RaceState.COUNTDOWN) {
        countdownT -= RACE.COUNT_BEAT;
        countdownIndex += 1;
        if (countdownIndex >= BEATS.length) {
          // The GO! beat has finished playing out -- timer and locomotion start together,
          // here, not at the keypress that opened the countdown.
          state = RaceState.RUNNING;
          elapsed = 0;
        }
      }
    } else if (state === RaceState.RUNNING) {
      locomotion.update(dt);
      elapsed += dt;
      if (locomotion.isFinished) {
        state = RaceState.FINISHED;
        finishTime = elapsed;
      }
    } else if (state === RaceState.FINISHED) {
      locomotion.update(dt); // keep the settle-ease / in-place gait bob running
    }

    // Facing ease and the camera track the runner in every state, including READY /
    // COUNTDOWN, so the FOLLOW shot is already correctly framed before the race starts.
    runner.update(dt);
    cameraRig.update(dt, runner);
  }

  return {
    update,
    requestHop,
    requestRestart,
    get state() {
      return state;
    },
    get elapsed() {
      return elapsed;
    },
    get finishTime() {
      return finishTime;
    },
    get countdownLabel() {
      return state === RaceState.COUNTDOWN ? BEATS[countdownIndex] : '';
    },
    // 0 -> 1 fraction through the current beat's display time, for the HUD's fade-out.
    get countdownProgress() {
      return state === RaceState.COUNTDOWN ? clamp01(countdownT / RACE.COUNT_BEAT) : 0;
    },
  };
}
