// The Alpine Switchbacks course. Only this file may contain these numbers -- every other
// module reads the built path (see src/trailPath.js).
//
// `technical` narrows the trip margin independently of gradient (ticket 12). It exists
// because grade alone puts the tension in the wrong place: the climb is the steepest
// terrain on the course (~24 deg) while the switchback legs are the gentlest (~10 deg),
// yet the switchbacks are the dramatic climax. See DESIGN.md "Why `technical` exists".
// Absent means 1.0.
//
// Ticket 19 §4: rebuilt from src/courses/blocks.js instead of a hand-written segment
// table. This is the ticket's correctness gate -- the block calls below must emit exactly
// the same segments the old hand table did, so the built path is byte-for-byte identical
// (length 190.6311, 4 filleted corners). Verified in test/trailPath.test.js and by hand
// against DESIGN.md's course table.

import { flat, climb, descent, switchbacks } from './blocks.js';

const start = { x: 0, y: 0 };
const cursor = { x: start.x, y: start.y };

const segments = [
  ...flat(cursor, { x: 20, y: 0.0 }),
  ...climb(cursor, { x: 60, y: 12.0, samples: 24 }),
  ...descent(cursor, { x: 95, y: 4.0, samples: 20, technical: 1.15 }),
  ...switchbacks(cursor, { legs: 5, run: 18, rise: 3.2, technical: 1.6 }),
  ...flat(cursor, { x: 120, y: 20.4 }),
];

export const alpine = {
  id: 'alpine',
  name: 'Alpine Switchbacks',

  start,
  segments,

  // Decorative only (ticket 03). Has no geometric relationship to the course.
  backdrop: {
    // Sawtooth ridgelines, deliberately overlong in x so they never run out of view.
    ridgeFar: {
      parallax: 0.12,
      color: 'RIDGE_FAR',
      baseY: -10,
      points: [[-150, 14], [-40, 26], [30, 12], [90, 30], [150, 16], [230, 32], [400, 18]],
    },
    ridgeNear: {
      parallax: 0.3,
      color: 'RIDGE_NEAR',
      baseY: -10,
      points: [[-150, 4], [-30, 14], [40, 2], [110, 20], [180, 6], [260, 18], [400, 8]],
    },
    // World-fixed (no parallax) so it stays put behind the switchback stack.
    mountain: {
      color: 'MOUNTAIN',
      points: [
        [76, -10], [80, 4], [87, 12], [93, 20], [100, 25], [109, 24], [117, 20],
        [126, 12], [132, -10],
      ],
    },
  },
};
