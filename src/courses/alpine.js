// The Alpine Switchbacks course. Only this file may contain these numbers -- every other
// module reads the built path (see src/trailPath.js).
//
// `technical` narrows the trip margin independently of gradient (ticket 12). It exists
// because grade alone puts the tension in the wrong place: the climb is the steepest
// terrain on the course (~24 deg) while the switchback legs are the gentlest (~10 deg),
// yet the switchbacks are the dramatic climax. See DESIGN.md "Why `technical` exists".
// Absent means 1.0.

export const alpine = {
  id: 'alpine',
  name: 'Alpine Switchbacks',

  start: { x: 0, y: 0 },

  segments: [
    { type: 'flat', to: { x: 20, y: 0.0 } },
    { type: 'smooth', to: { x: 60, y: 12.0 }, samples: 24 },
    { type: 'smooth', to: { x: 95, y: 4.0 }, samples: 20, technical: 1.15 },
    { type: 'leg', to: { x: 113, y: 7.2 }, technical: 1.6 },
    { type: 'leg', to: { x: 95, y: 10.4 }, technical: 1.6 },
    { type: 'leg', to: { x: 113, y: 13.6 }, technical: 1.6 },
    { type: 'leg', to: { x: 95, y: 16.8 }, technical: 1.6 },
    { type: 'leg', to: { x: 113, y: 20.0 }, technical: 1.6 },
    { type: 'flat', to: { x: 120, y: 20.4 } },
  ],

  // Index of the first `leg` segment. Camera and ground-bed code need to know where the
  // switchback stack begins; derive the arc length at runtime, don't hardcode it.
  firstLegIndex: 3,

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
