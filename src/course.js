// The canonical course. Only this file may contain these numbers — every other module
// reads the built path (see src/trailPath.js).

export const COURSE_START = { x: 0, y: 0 };

export const COURSE = [
  { type: 'flat', to: { x: 20, y: 0.0 } },
  { type: 'smooth', to: { x: 60, y: 12.0 }, samples: 24 },
  { type: 'smooth', to: { x: 95, y: 4.0 }, samples: 20 },
  { type: 'leg', to: { x: 113, y: 7.2 } },
  { type: 'leg', to: { x: 95, y: 10.4 } },
  { type: 'leg', to: { x: 113, y: 13.6 } },
  { type: 'leg', to: { x: 95, y: 16.8 } },
  { type: 'leg', to: { x: 113, y: 20.0 } },
  { type: 'flat', to: { x: 120, y: 20.4 } },
];

// Index of the first `leg` segment. Camera and ground-bed code need to know where the
// switchback stack begins; derive the arc length at runtime, don't hardcode it.
export const FIRST_LEG_INDEX = 3;

// Decorative only (ticket 03). Has no geometric relationship to the course.
export const BACKDROP = {
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
};
