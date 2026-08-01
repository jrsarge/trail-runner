// Pure math: turns a course segment table into a filleted polyline with arc-length
// parameterization. No three.js imports here (see ticket 02 / DESIGN.md).

import { DEFAULT_COURSE } from './courses/index.js';
import { PATH } from './constants.js';

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function smoothstep01(x) {
  return smoothstep(Math.max(0, Math.min(1, x)));
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
  constructor(points, cumulative, segmentStartArcLengths, segmentTechnical, segmentLedge) {
    this.points = points;
    this.cumulative = cumulative;
    this.length = cumulative[cumulative.length - 1];
    this._segmentStartArcLengths = segmentStartArcLengths;
    this._segmentTechnical = segmentTechnical;
    this._segmentLedge = segmentLedge;
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

  // Largest segment index whose start arc length is <= s.
  _segmentIndexAt(s) {
    const starts = this._segmentStartArcLengths;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // Per-segment terrain difficulty (ticket 09 data, consumed by ticket 12's trip margin).
  //
  // Blended across segment joins over PATH.TECHNICAL_BLEND rather than stepping. A hard
  // step would make the trip margin snap at a boundary -- exactly the unreadable, "that
  // felt cheap" trip DESIGN.md "Fairness" is about. The blend is centred on the join, so
  // difficulty ramps in over the last half-window of one segment and the first half-window
  // of the next.
  technicalAt(s) {
    const tech = this._segmentTechnical;
    if (!tech || tech.length === 0) return 1;

    const clamped = Math.max(0, Math.min(this.length, s));
    const i = this._segmentIndexAt(clamped);
    const half = PATH.TECHNICAL_BLEND / 2;

    // Near the join with the previous segment.
    const start = this._segmentStartArcLengths[i];
    if (i > 0 && clamped < start + half) {
      const t = smoothstep01((clamped - (start - half)) / PATH.TECHNICAL_BLEND);
      return tech[i - 1] + (tech[i] - tech[i - 1]) * t;
    }

    // Near the join with the next segment.
    if (i + 1 < tech.length) {
      const nextStart = this._segmentStartArcLengths[i + 1];
      if (clamped > nextStart - half) {
        const t = smoothstep01((clamped - (nextStart - half)) / PATH.TECHNICAL_BLEND);
        return tech[i] + (tech[i + 1] - tech[i]) * t;
      }
    }

    return tech[i];
  }

  // Contiguous runs of `ledge: true` segments, as arc-length ranges. Replaces the old
  // `course.firstLegIndex` hardcode (ticket 19 §2): world.js banks the ground bed over
  // these ranges, cameraRig.js pulls the camera back approaching one. A course with no
  // ledge segments returns an empty array.
  ledgeRanges() {
    const ledge = this._segmentLedge;
    const ranges = [];
    let i = 0;
    while (i < ledge.length) {
      if (!ledge[i]) {
        i++;
        continue;
      }
      const startS = this._segmentStartArcLengths[i];
      let j = i;
      while (j + 1 < ledge.length && ledge[j + 1]) j++;
      const endS = j + 1 < ledge.length ? this._segmentStartArcLengths[j + 1] : this.length;
      ranges.push({ startS, endS });
      i = j + 1;
    }
    return ranges;
  }

  // The path's own point-space bounding box (ticket 19 §3) -- world bounds (floor, sky)
  // derive from this rather than a fixed global, so a course that dips or summits beyond
  // alpine's range doesn't run the trail below the floor or off the top of the sky.
  bounds() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }
}

export function buildPath(segments = DEFAULT_COURSE.segments, start = DEFAULT_COURSE.start) {
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

  const segmentTechnical = segments.map((seg) => seg.technical ?? 1);
  const segmentLedge = segments.map((seg) => !!seg.ledge);

  return new TrailPath(
    outPoints,
    cumulative,
    segmentStartArcLengths,
    segmentTechnical,
    segmentLedge
  );
}
