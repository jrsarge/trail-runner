// Terrain-block vocabulary (ticket 19). A course becomes a short, readable recipe of block
// calls instead of a wall of hand-picked coordinates. Pure functions, no three.js, no
// globals -- both course files and the tests can use them (DESIGN.md "Architecture",
// ticket 19 §1).
//
// Every block takes a mutable `cursor` ({ x, y }) holding the current end-of-path position,
// advances it in place, and returns an array of segments in the existing course-segment
// format ({ type, to, samples?, technical?, ledge? }) consumed by src/trailPath.js. Blocks
// never touch trailPath.js's geometry resolution themselves -- they only emit the same
// segment shapes src/courses/alpine.js used to write by hand, so rebuilding a course from
// blocks is required to be byte-for-byte identical to the hand-written table (ticket 19 §4).

// Sub-segment sample count for each half of a roller's bump (the rise to the peak, and the
// fall back to the base line). Not exposed in constants.js: unlike alpine's climb/descent
// samples (authored per-course, inline in the segment table), this is an internal detail of
// how a roller bump is tessellated, not a course- or feel-tuning number a designer would
// reach for.
const ROLLER_SUB_SAMPLES = 8;

function withTechnical(seg, technical) {
  if (technical !== undefined) seg.technical = technical;
  return seg;
}

// A straight, flat-in-grade segment (the ground may still rise/fall linearly -- "flat"
// names the segment shape, not zero slope) from the cursor to an absolute point.
export function flat(cursor, { x, y, technical } = {}) {
  const seg = withTechnical({ type: 'flat', to: { x, y } }, technical);
  cursor.x = x;
  cursor.y = y;
  return [seg];
}

// A smoothstep S-curve from the cursor to an absolute point. `climb` and `descent` are the
// same math (trailPath.js's 'smooth' resolver just interpolates y with smoothstep(t) between
// the current point and `to`, whichever direction that is) -- two names for readability in a
// course recipe, not two code paths.
export function climb(cursor, { x, y, samples, technical } = {}) {
  const seg = withTechnical({ type: 'smooth', to: { x, y }, samples }, technical);
  cursor.x = x;
  cursor.y = y;
  return [seg];
}

export function descent(cursor, opts) {
  return climb(cursor, opts);
}

// `count` undulations against a linear base line from the cursor to `(cursor.x + dx,
// cursor.y + dy)`. Each undulation is two smoothstep segments -- cursor/base(i) up to a peak
// (+amp above the base line's midpoint) then down to base(i+1) -- so this emits `count * 2`
// segments total, net displacement exactly `(dx, dy)`.
export function rollers(cursor, { dx, dy, count, amp, technical } = {}) {
  const segs = [];
  const x0 = cursor.x;
  const y0 = cursor.y;
  const stepX = dx / count;
  const stepY = dy / count;

  for (let i = 0; i < count; i++) {
    const baseX0 = x0 + stepX * i;
    const baseY0 = y0 + stepY * i;
    const baseX1 = x0 + stepX * (i + 1);
    const baseY1 = y0 + stepY * (i + 1);
    const midX = (baseX0 + baseX1) / 2;
    const midY = (baseY0 + baseY1) / 2 + amp;

    segs.push(
      withTechnical({ type: 'smooth', to: { x: midX, y: midY }, samples: ROLLER_SUB_SAMPLES }, technical)
    );
    segs.push(
      withTechnical(
        { type: 'smooth', to: { x: baseX1, y: baseY1 }, samples: ROLLER_SUB_SAMPLES },
        technical
      )
    );
  }

  cursor.x = x0 + dx;
  cursor.y = y0 + dy;
  return segs;
}

// `legs` alternating-direction straight segments, each `run` away horizontally (direction
// flips every leg, starting +x) and `rise` higher, marked `ledge: true` so world.js (bed
// banking) and cameraRig.js (the STACK pull-back) can find the stack via
// `path.ledgeRanges()` without knowing anything about a specific course (ticket 19 §2).
export function switchbacks(cursor, { legs, run, rise, technical } = {}) {
  const segs = [];
  let dir = 1;

  for (let i = 0; i < legs; i++) {
    const x = cursor.x + dir * run;
    const y = cursor.y + rise;
    const seg = withTechnical({ type: 'leg', to: { x, y }, ledge: true }, technical);
    segs.push(seg);
    cursor.x = x;
    cursor.y = y;
    dir *= -1;
  }

  return segs;
}
