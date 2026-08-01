// "Summit Traverse" -- the long course (ticket 20). Stamina needs a race long enough for
// spending decisions to compound; the 190 m alpine course measured pacing worth under a
// second, a structural ceiling no tuning moves (DESIGN.md, ticket 16). This is that race:
// rolling terrain into a sustained grind with a false summit, then a switchback climax.
//
// Authored with src/courses/blocks.js (ticket 19). Only this file (plus alpine.js) may
// contain these numbers -- every other module reads the built path (see src/trailPath.js).
//
// Profile (see the ticket 20 table for the intent behind each block):
//   1. flat      settle in
//   2. rollers   small spend-or-save decisions
//   3. descent   steep technical descent -- fast, cheap, tempts overspending
//   4. rollers   recover the rhythm
//   5. climb     THE GRIND -- 220 m of sustained climb, ~16 deg. The centrepiece.
//   6. flat      false summit -- it eases, and you think you're done
//   7. climb     ...and it keeps going, ~17 deg
//   8. descent   relief before the finish
//   9. switchbacks  the climax
//  10. flat      finish spur

import { flat, climb, descent, rollers, switchbacks } from './blocks.js';

const start = { x: 0, y: 0 };
const cursor = { x: start.x, y: start.y };

const segments = [
  ...flat(cursor, { x: 25, y: 0 }),
  ...rollers(cursor, { dx: 140, dy: 8, count: 4, amp: 3.0 }),
  ...descent(cursor, { x: 235, y: -14, samples: 40, technical: 1.5 }),
  ...rollers(cursor, { dx: 100, dy: 5, count: 3, amp: 2.5 }),
  ...climb(cursor, { x: 555, y: 53, samples: 120 }),
  ...flat(cursor, { x: 590, y: 55 }),
  ...climb(cursor, { x: 670, y: 80, samples: 50 }),
  ...descent(cursor, { x: 715, y: 68, samples: 30, technical: 1.25 }),
  ...switchbacks(cursor, { legs: 5, run: 16, rise: 3.4, technical: 1.6 }),
  ...flat(cursor, { x: 741, y: 85.4 }),
];

export const summit = {
  id: 'summit',
  name: 'Summit Traverse',

  start,
  segments,

  // Decorative only (ticket 03/19 §4). Alpine's backdrop is positioned for x in
  // [-150, 400] with a mountain at x in [76, 132]; this course spans x in [0, 741], so a
  // fresh backdrop is authored here rather than reused. Has no geometric relationship to
  // the path -- do not try to make it contain anything.
  backdrop: {
    // Sawtooth ridgelines spanning well past the course's x range at both ends so parallax
    // scrolling never runs out of geometry. The near ridge trends upward across x so the
    // world visibly climbs alongside the runner.
    ridgeFar: {
      parallax: 0.12,
      color: 'RIDGE_FAR',
      baseY: -24,
      points: [
        [-200, 10], [-50, 18], [100, 14], [250, 26], [400, 22],
        [550, 38], [700, 44], [850, 58], [1000, 52],
      ],
    },
    ridgeNear: {
      parallax: 0.3,
      color: 'RIDGE_NEAR',
      baseY: -24,
      points: [
        [-200, 0], [-50, 8], [100, 4], [250, 18], [400, 12],
        [550, 32], [700, 38], [850, 54], [1000, 46],
      ],
    },
    // World-fixed (no parallax) so it stays put behind the switchback stack (x in
    // [715, 731]); positioned at x in [690, 780] per the ticket 20 table, peak well above
    // the finish height (85.4) so it reads behind the ledges rather than under them.
    mountain: {
      color: 'MOUNTAIN',
      points: [
        [690, -24], [700, 20], [712, 50], [722, 80], [735, 102],
        [748, 96], [758, 80], [770, 48], [780, -24],
      ],
    },
  },
};
