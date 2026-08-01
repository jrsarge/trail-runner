import * as THREE from 'three';
import { COLORS, Z, WORLD, MARKERS } from './constants.js';
import { DEFAULT_COURSE } from './courses/index.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function colorRGB(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

// Two vertices per path point (top + bottom), stitched into a strip of indexed
// triangles. Winding flips on the switchback legs since the path reverses direction, so
// the caller must use a DoubleSide material.
function buildVariableBottomStrip(topBottomPairs, colorHex, z) {
  const positions = [];
  const colors = [];
  const indices = [];
  const [r, g, b] = colorRGB(colorHex);

  for (const [top, bottom] of topBottomPairs) {
    positions.push(top.x, top.y, z);
    colors.push(r, g, b);
    positions.push(bottom.x, bottom.y, z);
    colors.push(r, g, b);
  }

  const n = topBottomPairs.length;
  for (let i = 0; i < n - 1; i++) {
    const a = 2 * i;
    const b2 = 2 * i + 1;
    const c = 2 * i + 2;
    const d = 2 * i + 3;
    indices.push(a, b2, c);
    indices.push(b2, d, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

function buildGroundBed(path, course) {
  const sStack = path.segmentStartS(course.firstLegIndex);
  const pairs = path.points.map((p, i) => {
    const s = path.cumulative[i];
    const t = smoothstep01((s - (sStack - WORLD.BED_BLEND)) / WORLD.BED_BLEND);
    const bottomY = lerp(WORLD.FLOOR_Y, p.y - WORLD.BED_THICKNESS, t);
    return [{ x: p.x, y: p.y }, { x: p.x, y: bottomY }];
  });

  // Apron: extend the ground (not the trail ribbon) flat and down to FLOOR_Y past both
  // ends, so the bed never stops in mid-air at the start/finish. The path starts well
  // before the switchback blend, so the first pair's bottom is already FLOOR_Y; the last
  // pair (on the stack) has a shallower ledge bottom, so the apron tapers it to FLOOR_Y.
  const first = path.points[0];
  const last = path.points[path.points.length - 1];
  const startApron = [{ x: first.x - WORLD.APRON, y: first.y }, { x: first.x - WORLD.APRON, y: WORLD.FLOOR_Y }];
  const endApron = [{ x: last.x + WORLD.APRON, y: last.y }, { x: last.x + WORLD.APRON, y: WORLD.FLOOR_Y }];

  return buildVariableBottomStrip([startApron, ...pairs, endApron], COLORS.GROUND, Z.BED);
}

function buildTrailRibbon(path) {
  const half = WORLD.TRAIL_WIDTH / 2;
  const n = path.points.length;

  // Per-point normal from the average of the incoming and outgoing edge directions, so
  // the ribbon doesn't hard-flip at the switchback apex the way a single forward tangent
  // would.
  const pairs = path.points.map((p, i) => {
    const prev = path.points[Math.max(0, i - 1)];
    const next = path.points[Math.min(n - 1, i + 1)];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    } else {
      dx = 1;
      dy = 0;
    }
    // Perpendicular (normal) to the direction.
    const nx = -dy;
    const ny = dx;
    return [
      { x: p.x + nx * half, y: p.y + ny * half },
      { x: p.x - nx * half, y: p.y - ny * half },
    ];
  });

  return buildVariableBottomStrip(pairs, COLORS.TRAIL, Z.TRAIL);
}

function buildSky() {
  const x0 = WORLD.SKY_X0;
  const x1 = WORLD.SKY_X1;
  const y0 = WORLD.SKY_Y0;
  const y1 = WORLD.SKY_Y1;
  const z = Z.SKY;

  const positions = [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z];
  const [br, bg, bb] = colorRGB(COLORS.SKY_BOTTOM);
  const [tr, tg, tb] = colorRGB(COLORS.SKY_TOP);
  const colors = [br, bg, bb, br, bg, bb, tr, tg, tb, tr, tg, tb];
  const indices = [0, 1, 2, 0, 2, 3];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

// Filled polygon: `points` (array of [x, y]) as the top edge, closed down to `baseY`.
// Built as one quad per consecutive pair of top points — every backdrop layer (both
// ridges and the mountain) is x-monotone, so this single code path covers all three; no
// triangulator needed.
function buildRidgePolygon(points, baseY, colorHex, z) {
  const positions = [];
  const indices = [];

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const base = positions.length / 3;
    positions.push(x0, y0, z, x1, y1, z, x1, baseY, z, x0, baseY, z);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

function buildBackdrop(BACKDROP) {
  const ridgeFar = buildRidgePolygon(
    BACKDROP.ridgeFar.points,
    BACKDROP.ridgeFar.baseY,
    COLORS[BACKDROP.ridgeFar.color],
    Z.RIDGE_FAR
  );
  const ridgeNear = buildRidgePolygon(
    BACKDROP.ridgeNear.points,
    BACKDROP.ridgeNear.baseY,
    COLORS[BACKDROP.ridgeNear.color],
    Z.RIDGE_NEAR
  );
  // The mountain's own first/last points already sit at y = -10; reuse that as its base.
  const mountainBaseY = BACKDROP.mountain.points[0][1];
  const mountain = buildRidgePolygon(
    BACKDROP.mountain.points,
    mountainBaseY,
    COLORS[BACKDROP.mountain.color],
    Z.MOUNTAIN
  );

  return { ridgeFar, ridgeNear, mountain };
}

// A simple vertical quad "post". Bottom sits at (x, y), extends up by `height`.
function buildPost(x, y, width, height, colorHex, z) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y + height / 2, z);
  return mesh;
}

// `cols` x `rows` checkerboard, one BufferGeometry with per-vertex colors. Bottom-left
// of the banner is at (x - width / 2, y).
function buildCheckerBanner(x, y, width, height, colorA, colorB, cols, rows, z) {
  const positions = [];
  const colors = [];
  const indices = [];
  const cellW = width / cols;
  const cellH = height / rows;
  const [ar, ag, ab] = colorRGB(colorA);
  const [dr, dg, db] = colorRGB(colorB);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = x - width / 2 + col * cellW;
      const x1 = x0 + cellW;
      const y0 = y + row * cellH;
      const y1 = y0 + cellH;
      const useA = (col + row) % 2 === 0;
      const [cr, cg, cb] = useA ? [ar, ag, ab] : [dr, dg, db];
      const base = positions.length / 3;
      positions.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
      for (let k = 0; k < 4; k++) colors.push(cr, cg, cb);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

function buildMarkers(path) {
  const group = new THREE.Group();

  const start = path.pointAt(0);
  group.add(
    buildPost(
      start.x,
      start.y,
      MARKERS.START_POST_WIDTH,
      MARKERS.START_POST_HEIGHT,
      COLORS.FINISH,
      Z.MARKER
    )
  );

  // Finish: a 2.6 m post plus a checkered panel that hangs from the post's top and
  // extends back over the trail (-x), so it reads as a finish gate rather than a pole.
  // Post spans y in [finish.y, finish.y + 2.6] = [20.4, 23.0]. Panel spans
  // x in [117.8, 120], y in [21.9, 23.0] -- wider (2.2) than tall (1.1).
  const finish = path.pointAt(path.length);
  const postHeight = MARKERS.FINISH_POST_HEIGHT;
  const panelWidth = MARKERS.FINISH_PANEL_WIDTH;
  const panelHeight = MARKERS.FINISH_PANEL_HEIGHT;
  group.add(
    buildPost(finish.x, finish.y, MARKERS.FINISH_POST_WIDTH, postHeight, COLORS.FINISH, Z.MARKER)
  );
  group.add(
    buildCheckerBanner(
      finish.x - panelWidth / 2,
      finish.y + postHeight - panelHeight,
      panelWidth,
      panelHeight,
      COLORS.FINISH,
      COLORS.FINISH_DARK,
      MARKERS.FINISH_PANEL_COLS,
      MARKERS.FINISH_PANEL_ROWS,
      Z.MARKER
    )
  );

  return group;
}

export function buildWorld(path, course = DEFAULT_COURSE) {
  const group = new THREE.Group();

  const sky = buildSky();
  const groundBed = buildGroundBed(path, course);
  const trailRibbon = buildTrailRibbon(path);
  const { ridgeFar, ridgeNear, mountain } = buildBackdrop(course.backdrop);
  const markers = buildMarkers(path);

  group.add(sky, ridgeFar, ridgeNear, mountain, groundBed, trailRibbon, markers);

  function updateParallax(camX) {
    ridgeFar.position.x = camX * (1 - course.backdrop.ridgeFar.parallax);
    ridgeNear.position.x = camX * (1 - course.backdrop.ridgeNear.parallax);
    // mountain is world-fixed: position.x stays 0, no update needed.
  }

  return { group, updateParallax };
}
