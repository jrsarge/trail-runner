// Pacing plans (ticket 24): pure, stateless functions from (progress, terrain) to a target
// lean offset above idealLean, in degrees. See DESIGN.md "v4 -- Rivals (planned)" and
// tickets/24-rivals.md.
//
// Each plan is a *factory*: createXPlan(sustainableOffsetDeg) returns the actual pure
// function that createAiController (controllers.js) calls every tick. Binding the course's
// sustainable offset once, at creation, keeps the returned function's signature exactly
// `(progress, terrain) -> targetOffsetDeg` with no hidden state and nothing course-specific
// baked into the function body itself -- statelessness is what makes determinism structural
// here rather than something merely tested. `terrain = { slopeSigned, technical }` is
// carried by every plan even though none of the five below read it yet, so a future
// terrain-aware specialist (strong on climbs, ordinary on the flat) is a new plan, not a
// controller change.
//
// Every magnitude below is a ratio of sustainableOffsetDeg (see constants.js AI block),
// never a hardcoded degree value -- so a plan authored against summit's +21.3 transfers to
// alpine's +15.9 unchanged, per the ticket's explicit warning against hardcoding degrees.

import { AI } from './constants.js';

const TAU = Math.PI * 2;

// All-out from the gun. A constant, high offset -- no progress-conditional logic needed:
// locomotion's own bonk/commit clamp does the rest. Once the tank empties, `commit` is
// capped at 0 regardless of how hard the plan keeps asking (see locomotion.js's `bonked`
// branch), so "blows up ~50-60%, runs bonked thereafter" falls out of the existing stamina
// model rather than needing this plan to know where it is on the course.
export function createRabbitPlan(sustainableOffsetDeg) {
  const target = sustainableOffsetDeg * AI.RABBIT_MULT;
  return function rabbit(_progress, _terrain) {
    return target;
  };
}

// A few degrees above sustainable -- close enough that matching it "almost works," which is
// what makes it cruel (bonks around 85%, per the ticket table).
export function createOverreachPlan(sustainableOffsetDeg) {
  const target = sustainableOffsetDeg * AI.OVERREACH_MULT;
  return function overreach(_progress, _terrain) {
    return target;
  };
}

// Oscillates hard/easy on a fixed DISTANCE period. This function receives no clock -- only
// `progress` (s / path.length) -- so it is structurally impossible for the cycle to be
// time-based no matter how AI.SURGER_PERIOD_FRAC is tuned; the period is always a fraction
// of the course, exactly what the ticket requires ("never a time period").
export function createSurgerPlan(sustainableOffsetDeg) {
  const amplitude = sustainableOffsetDeg * AI.SURGER_AMPLITUDE_MULT;
  return function surger(progress, _terrain) {
    return sustainableOffsetDeg + amplitude * Math.sin((progress / AI.SURGER_PERIOD_FRAC) * TAU);
  };
}

// The sustainable optimum -- ticket 16's measured best-sustained offset, held constant for
// the whole course. Never bonks by construction: it's the exact offset the course's tank
// was calibrated against (see locomotion.js's computeStaminaMax).
export function createMetronomePlan(sustainableOffsetDeg) {
  return function metronome(_progress, _terrain) {
    return sustainableOffsetDeg;
  };
}

// Conserves early (below sustainable, banking stamina), spends hard in the last third
// (above sustainable, cashing it in for a late push).
export function createCloserPlan(sustainableOffsetDeg) {
  const conserve = sustainableOffsetDeg * AI.CLOSER_CONSERVE_MULT;
  const surge = sustainableOffsetDeg * AI.CLOSER_SURGE_MULT;
  return function closer(progress, _terrain) {
    return progress < AI.CLOSER_SPLIT ? conserve : surge;
  };
}

// Keyed by the `plan` string course data uses (courses/summit.js, courses/alpine.js), e.g.
// `{ shape: 'tortoise', plan: 'metronome', palette: {...} }` -- see createAiController.
export const PLAN_FACTORIES = {
  rabbit: createRabbitPlan,
  overreach: createOverreachPlan,
  surger: createSurgerPlan,
  metronome: createMetronomePlan,
  closer: createCloserPlan,
};
