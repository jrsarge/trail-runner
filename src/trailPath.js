// Pure math: turns a course segment table into a filleted polyline with arc-length
// parameterization. No three.js imports here (see ticket 02 / DESIGN.md).

import { COURSE, COURSE_START } from './course.js';
import { PATH } from './constants.js';

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(a, k) {
  return { x: a.x * k, y: a.y * k };
}

function normalize(a) {
  const len = Math.hypot(a.x, a.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

function quadBezier(p0, p1, p2, t) {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const c = t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x,
    y: a * p0.y + b * p1.y + c * p2.y,
  };
}

// Turn angle in degrees between the incoming edge (prev->cur) and outgoing edge
// (cur->next), wrapped into [-180, 180] before taking the magnitude.
function turnAngleDeg(prev, cur, next) {
  const inV = sub(cur, prev);
  const outV = sub(next, cur);
  const a1 = Math.atan2(inV.y, inV.x);
  const a2 = Math.atan2(outV.y, outV.x);
  let diff = a2 - a1;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff) * (180 / Math.PI);
}

// Resolve the segment table into a raw polyline (no fillets yet), plus the raw vertex
// index at which each segment's contribution ends (used to derive segmentStartS later).
function resolveVertices(segments, start) {
  const points = [{ x: start.x, y: start.y }];
  const segmentEndIndex = [];
  let cur = { x: start.x, y: start.y };

  for (const seg of segments) {
    if (seg.type === 'flat' || seg.type === 'leg') {
      points.push({ x: seg.to.x, y: seg.to.y });
      cur = seg.to;
    } else if (seg.type === 'smooth') {
      const samples = seg.samples;
      const x0 = cur.x;
      const y0 = cur.y;
      const x1 = seg.to.x;
      const y1 = seg.to.y;
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const s = smoothstep(t);
        points.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * s });
      }
      cur = seg.to;
    } else {
      throw new Error(`Unknown segment type: ${seg.type}`);
    }
    segmentEndIndex.push(points.length - 1);
  }

  return { points, segmentEndIndex };
}

// Walk interior vertices and replace any whose turn angle exceeds the threshold with a
// sampled quadratic Bezier fillet. Returns the filleted point list plus a mapping from
// raw vertex index to output point index (used to derive segmentStartS).
function filletPolyline(rawPoints, cornerRadius, filletSamples, minTurnDeg) {
  const outPoints = [rawPoints[0]];
  const rawIndexToOutIndex = new Array(rawPoints.length);
  rawIndexToOutIndex[0] = 0;

  for (let i = 1; i < rawPoints.length - 1; i++) {
    const prev = rawPoints[i - 1];
    const cur = rawPoints[i];
    const next = rawPoints[i + 1];
    const turn = turnAngleDeg(prev, cur, next);

    if (turn > minTurnDeg) {
      const inLen = dist(prev, cur);
      const outLen = dist(cur, next);
      const r = Math.min(cornerRadius, PATH.FILLET_MAX_FRACTION * Math.min(inLen, outLen));
      const inDir = normalize(sub(cur, prev));
      const outDir = normalize(sub(next, cur));
      const p0 = sub(cur, scale(inDir, r));
      const p1 = cur;
      const p2 = add(cur, scale(outDir, r));

      for (let k = 0; k < filletSamples; k++) {
        const t = (k + 1) / (filletSamples + 1);
        outPoints.push(quadBezier(p0, p1, p2, t));
      }
      // The raw vertex itself is cut out; the outgoing segment (segment `i` began here)
      // now truly starts at the last fillet sample (t = 1, i.e. p2).
      rawIndexToOutIndex[i] = outPoints.length - 1;
    } else {
      outPoints.push(cur);
      rawIndexToOutIndex[i] = outPoints.length - 1;
    }
  }

  outPoints.push(rawPoints[rawPoints.length - 1]);
  rawIndexToOutIndex[rawPoints.length - 1] = outPoints.length - 1;

  return { outPoints, rawIndexToOutIndex };
}

function buildCumulative(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]));
  }
  return cumulative;
}

class TrailPath {
  constructor(points, cumulative, segmentStartArcLengths) {
    this.points = points;
    this.cumulative = cumulative;
    this.length = cumulative[cumulative.length - 1];
    this._segmentStartArcLengths = segmentStartArcLengths;
  }

  // Binary search for the largest index i such that cumulative[i] <= s, clamped so that
  // points[i] and points[i + 1] both exist.
  _findIndex(s) {
    let lo = 0;
    let hi = this.cumulative.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cumulative[mid] <= s) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  pointAt(s) {
    const n = this.points.length;
    if (n === 1 || s <= 0) return { x: this.points[0].x, y: this.points[0].y };
    if (s >= this.length) return { x: this.points[n - 1].x, y: this.points[n - 1].y };

    const i = this._findIndex(s);
    const a = this.points[i];
    const b = this.points[i + 1];
    const segLen = this.cumulative[i + 1] - this.cumulative[i];
    const t = segLen > 0 ? (s - this.cumulative[i]) / segLen : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  tangentAt(s) {
    const n = this.points.length;
    if (n === 1) return { x: 1, y: 0 };
    const clamped = Math.max(0, Math.min(this.length, s));
    const i = clamped >= this.length ? this.cumulative.length - 2 : this._findIndex(clamped);
    const a = this.points[i];
    const b = this.points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  // Arc length at which resolved segment `index` begins (index into the segment table
  // passed to buildPath). Segment 0 begins at s = 0.
  segmentStartS(index) {
    if (index <= 0) return 0;
    return this._segmentStartArcLengths[index];
  }
}

export function buildPath(segments = COURSE, start = COURSE_START) {
  const { points: rawPoints, segmentEndIndex } = resolveVertices(segments, start);

  const { outPoints, rawIndexToOutIndex } = filletPolyline(
    rawPoints,
    PATH.CORNER_RADIUS,
    PATH.FILLET_SAMPLES,
    PATH.FILLET_MIN_TURN_DEG
  );

  const cumulative = buildCumulative(outPoints);

  // segmentStartArcLengths[i] = arc length where segment i begins = arc length at the
  // raw vertex that ended segment i - 1 (0 for the very first segment).
  const segmentStartArcLengths = [0];
  for (let i = 1; i < segments.length; i++) {
    const rawIdx = segmentEndIndex[i - 1];
    const outIdx = rawIndexToOutIndex[rawIdx];
    segmentStartArcLengths.push(cumulative[outIdx]);
  }

  return new TrailPath(outPoints, cumulative, segmentStartArcLengths);
}
