// Race state machine and timer. See DESIGN.md "Race flow" and ticket 07.
//
//   READY --(start input)--> COUNTDOWN --(after 4 beats)--> RUNNING --(s >= length)--> FINISHED
//     ^                                                                                    |
//     +------------------------------------ R / click -----------------------------------+
//
// Owns exactly what's needed to answer "what state are we in and for how long" -- distance
// and elevation are derived from racer.s / path elsewhere (see hud.js). This module also
// owns the per-tick decision of *whether* racers advance at all: they must not move or
// gait-hop during READY or COUNTDOWN.

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

export function createRace(racers, cameraRig) {
  // v2 ships one racer; the array + player flag is the seam AI opponents drop into
  // (DESIGN.md "Architecture: racers are instantiable").
  const player = racers.find((r) => r.isPlayer) ?? racers[0];

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
    for (const racer of racers) racer.reset();
    cameraRig.reset();
    state = RaceState.READY;
    countdownIndex = 0;
    countdownT = 0;
    elapsed = 0;
    finishTime = 0;
    cameraRig.update(0, player); // prime the FOLLOW frame so there's no stale STACK frame
  }

  // Gated by state, per ticket 07: READY starts the countdown, FINISHED restarts. v2
  // removed the manual hop (ticket 10) -- Space/click do nothing during COUNTDOWN or
  // RUNNING, on purpose, rather than forwarding to the player racer.
  function requestStart() {
    if (state === RaceState.READY) {
      startCountdown();
    } else if (state === RaceState.FINISHED) {
      restart();
    }
    // COUNTDOWN, RUNNING: no-op.
  }

  // A dedicated restart trigger (the R key, the finish card) -- unlike requestStart(), this
  // never starts a countdown; it only ever fires from FINISHED.
  function requestRestart() {
    if (state === RaceState.FINISHED) restart();
  }

  function update(dt) {
    // Captured before the state machine runs. The COUNTDOWN branch below can flip us to
    // RUNNING mid-tick, and racers must NOT advance on that transition tick -- the timer
    // doesn't either, so advancing would hand the racer one free 1/120 s of ground and
    // shave a hundredth off every finish time.
    const stateAtTickStart = state;

    if (state === RaceState.COUNTDOWN) {
      countdownT += dt;
      while (countdownT >= RACE.COUNT_BEAT && state === RaceState.COUNTDOWN) {
        countdownT -= RACE.COUNT_BEAT;
        countdownIndex += 1;
        if (countdownIndex >= BEATS.length) {
          // The GO! beat has finished playing out -- timer and racers start together,
          // here, not at the keypress that opened the countdown.
          state = RaceState.RUNNING;
          elapsed = 0;
        }
      }
    } else if (state === RaceState.RUNNING) {
      elapsed += dt;
    }

    // Racers advance in RUNNING (racing) and FINISHED (settle-ease into the in-place gait
    // bob), but not in READY/COUNTDOWN -- though their pose still eases in every state, so
    // facing is settled and the FOLLOW shot correctly framed before the gun.
    const advance =
      stateAtTickStart === RaceState.RUNNING || stateAtTickStart === RaceState.FINISHED;
    for (const racer of racers) racer.update(dt, advance);

    if (state === RaceState.RUNNING && player.isFinished) {
      state = RaceState.FINISHED;
      finishTime = elapsed;
    }

    cameraRig.update(dt, player);
  }

  return {
    update,
    requestStart,
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
