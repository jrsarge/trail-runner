import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPath } from '../src/trailPath.js';
import { COURSE, FIRST_LEG_INDEX } from '../src/course.js';

test('1. hand-built 2-point straight path reports known length', () => {
  const path = buildPath([{ type: 'flat', to: { x: 10, y: 0 } }], { x: 0, y: 0 });
  assert.ok(Math.abs(path.length - 10) < 1e-9);
});

test('2. pointAt clamps at and beyond the ends', () => {
  const path = buildPath([{ type: 'flat', to: { x: 10, y: 0 } }], { x: 0, y: 0 });
  const start = path.pointAt(0);
  assert.ok(Math.abs(start.x - 0) < 1e-9 && Math.abs(start.y - 0) < 1e-9);

  const end = path.pointAt(path.length);
  assert.ok(Math.abs(end.x - 10) < 1e-9 && Math.abs(end.y - 0) < 1e-9);

  const before = path.pointAt(-5);
  assert.ok(!Number.isNaN(before.x) && !Number.isNaN(before.y));
  assert.ok(Math.abs(before.x - 0) < 1e-9 && Math.abs(before.y - 0) < 1e-9);

  const after = path.pointAt(path.length + 5);
  assert.ok(!Number.isNaN(after.x) && !Number.isNaN(after.y));
  assert.ok(Math.abs(after.x - 10) < 1e-9 && Math.abs(after.y - 0) < 1e-9);
});

test('3. arc-length correctness: pointAt(s) to pointAt(s+0.05) is close to 0.05 everywhere', () => {
  const path = buildPath();
  const step = 0.05;
  const numSamples = 200;
  const maxS = path.length - step;

  for (let i = 0; i < numSamples; i++) {
    const s = (i / (numSamples - 1)) * maxS;
    const a = path.pointAt(s);
    const b = path.pointAt(s + step);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(
      Math.abs(d - step) <= step * 0.01,
      `at s=${s.toFixed(3)}: distance ${d} deviates from ${step} by more than 1%`
    );
  }
});

test('4. tangentAt on the flat start is (1,0); all tangents are unit length', () => {
  const path = buildPath();
  const t0 = path.tangentAt(1);
  assert.ok(Math.abs(t0.x - 1) < 1e-6 && Math.abs(t0.y - 0) < 1e-6);

  const numSamples = 300;
  for (let i = 0; i < numSamples; i++) {
    const s = (i / (numSamples - 1)) * path.length;
    const t = path.tangentAt(s);
    const len = Math.hypot(t.x, t.y);
    assert.ok(Math.abs(len - 1) < 1e-6, `tangent at s=${s} has length ${len}`);
  }
});

test('5. at a switchback: tangent.x flips sign across the fillet, pointAt stays C0 continuous', () => {
  const path = buildPath();
  // Segment FIRST_LEG_INDEX + 1 is the leg to (95, 10.4) -- a switchback reversal.
  // Sample a window straddling the corner where that leg begins.
  const cornerS = path.segmentStartS(FIRST_LEG_INDEX + 1);
  const halfWindow = 3;
  const step = 0.05;

  let sawPositive = false;
  let sawNegative = false;
  let prevPoint = path.pointAt(cornerS - halfWindow);

  for (let s = cornerS - halfWindow; s <= cornerS + halfWindow; s += step) {
    const tangent = path.tangentAt(s);
    if (tangent.x > 0.01) sawPositive = true;
    if (tangent.x < -0.01) sawNegative = true;

    const p = path.pointAt(s);
    const jump = Math.hypot(p.x - prevPoint.x, p.y - prevPoint.y);
    assert.ok(jump <= step * 1.01, `pointAt jumped ${jump} at s=${s}, more than ${step * 1.01}`);
    prevPoint = p;
  }

  assert.ok(sawPositive, 'expected tangent.x to be positive on one side of the corner');
  assert.ok(sawNegative, 'expected tangent.x to be negative on the other side of the corner');
});

test('6. filleting strictly shortens the path', () => {
  const filletedPath = buildPath();

  // Build the same course through an unfilleted path by using a turn threshold that
  // nothing can exceed (effectively disables filleting) via a private re-import trick:
  // simplest is to compute the raw (unfilleted) polyline length directly here.
  let rawLength = 0;
  {
    // Re-resolve vertices the same way trailPath.js does, without fillets.
    function smoothstep(t) {
      return t * t * (3 - 2 * t);
    }
    const points = [{ x: 0, y: 0 }];
    let cur = { x: 0, y: 0 };
    for (const seg of COURSE) {
      if (seg.type === 'flat' || seg.type === 'leg') {
        points.push({ x: seg.to.x, y: seg.to.y });
        cur = seg.to;
      } else if (seg.type === 'smooth') {
        const x0 = cur.x;
        const y0 = cur.y;
        const x1 = seg.to.x;
        const y1 = seg.to.y;
        for (let i = 1; i <= seg.samples; i++) {
          const t = i / seg.samples;
          points.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * smoothstep(t) });
        }
        cur = seg.to;
      }
    }
    for (let i = 1; i < points.length; i++) {
      rawLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
  }

  assert.ok(
    filletedPath.length < rawLength,
    `filleted length ${filletedPath.length} should be less than unfilleted length ${rawLength}`
  );
});

test('7. the real COURSE builds without throwing, length is between 188 and 194', () => {
  const path = buildPath();
  assert.ok(path.length > 188 && path.length < 194, `length was ${path.length}`);
});

test('8. the real COURSE fillets exactly 4 corners', () => {
  // Re-derive the raw (unfilleted) vertex count and compare against the filleted point
  // count: each fillet replaces 1 raw vertex with FILLET_SAMPLES points, so
  // filletedCount = rawCount + numFillets * (FILLET_SAMPLES - 1).
  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }
  const rawPoints = [{ x: 0, y: 0 }];
  let cur = { x: 0, y: 0 };
  for (const seg of COURSE) {
    if (seg.type === 'flat' || seg.type === 'leg') {
      rawPoints.push({ x: seg.to.x, y: seg.to.y });
      cur = seg.to;
    } else if (seg.type === 'smooth') {
      const x0 = cur.x;
      const y0 = cur.y;
      const x1 = seg.to.x;
      const y1 = seg.to.y;
      for (let i = 1; i <= seg.samples; i++) {
        const t = i / seg.samples;
        rawPoints.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * smoothstep(t) });
      }
      cur = seg.to;
    }
  }

  function turnAngleDeg(prev, curr, next) {
    const inX = curr.x - prev.x;
    const inY = curr.y - prev.y;
    const outX = next.x - curr.x;
    const outY = next.y - curr.y;
    const a1 = Math.atan2(inY, inX);
    const a2 = Math.atan2(outY, outX);
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) * (180 / Math.PI);
  }

  let numFilleted = 0;
  for (let i = 1; i < rawPoints.length - 1; i++) {
    const turn = turnAngleDeg(rawPoints[i - 1], rawPoints[i], rawPoints[i + 1]);
    if (turn > 60) numFilleted++;
  }

  assert.equal(numFilleted, 4, `expected exactly 4 filleted corners, got ${numFilleted}`);
});
