// Course progress strip (ticket 23): a thin HUD panel showing the whole course as an
// elevation silhouette, with a marker per racer at its s / path.length. See DESIGN.md
// "v4 -- Rivals (planned)" -- this shipped ahead of rivals (24) specifically to de-risk the
// multi-racer plumbing: `createProgressStrip` takes a racer LIST, never a single racer, and
// a rival added to that list needs nothing structural from this module -- it appears from
// an `{ s, isPlayer }`-shaped object alone. Ticket 24 adds one more thing rivals DO need
// from here: their own marker colour (`racer.palette`), because four identical muted dots
// fails "all racers distinguishable on the strip" the instant there's more than one rival.
// The player's marker stays visually distinct regardless (`.hud-strip-marker.player` in
// index.html) -- palette colouring only ever applies to rivals.
//
// The elevation profile + switchback-stack shading are drawn ONCE, into a <canvas>, from
// path.points/path.cumulative/path.ledgeRanges() at construction time. update() only ever
// moves marker <div>s (a style.left write per racer) -- it never touches the canvas. The
// game runs a 120 Hz fixed timestep; redrawing canvas geometry there would be the exact
// "quietly expensive" per-frame rebuild ticket 23 warns against.

import { STRIP, COLORS } from './constants.js';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// COLORS values are 0xRRGGBB numbers (three.js convention, see constants.js). Canvas wants
// CSS color strings -- converted here rather than importing three.js into a DOM-only HUD
// module (hud.js doesn't import three either; keep that boundary).
function cssColor(hex, alpha = 1) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Draws the whole-course silhouette + section shading into `canvas`, sized in CSS px from
// STRIP.WIDTH/HEIGHT (device-pixel-ratio aware so it stays crisp on hi-dpi screens). Called
// exactly once, from createProgressStrip below.
function drawProfile(canvas, path) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = STRIP.WIDTH;
  const height = STRIP.HEIGHT;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const { minY, maxY } = path.bounds();
  const span = Math.max(1e-6, maxY - minY);
  const plotTop = STRIP.PAD_TOP;
  const baseline = height - STRIP.PAD_BOTTOM;
  const plotH = Math.max(1, baseline - plotTop);

  const xAt = (s) => (s / path.length) * width;
  const yAt = (elevation) => baseline - ((elevation - minY) / span) * plotH;

  const points = path.points;
  const cumulative = path.cumulative;

  // Filled silhouette: start/end on the baseline so it reads as ground, not a floating line.
  ctx.beginPath();
  ctx.moveTo(xAt(0), baseline);
  for (let i = 0; i < points.length; i++) {
    ctx.lineTo(xAt(cumulative[i]), yAt(points[i].y));
  }
  ctx.lineTo(xAt(path.length), baseline);
  ctx.closePath();
  ctx.fillStyle = cssColor(COLORS.STRIP_PROFILE);
  ctx.fill();

  // Section shading: the switchback stack, from the same ledge-range data world.js and
  // cameraRig.js already use (path.ledgeRanges()) -- no per-course coordinates, works on
  // any course with a `ledge: true` block, and correctly draws nothing on a course with
  // none.
  ctx.fillStyle = cssColor(COLORS.STRIP_LEDGE, STRIP.LEDGE_ALPHA);
  for (const { startS, endS } of path.ledgeRanges()) {
    const x0 = xAt(startS);
    const x1 = xAt(endS);
    ctx.fillRect(x0, plotTop, Math.max(1, x1 - x0), baseline - plotTop);
  }

  // Subtle top-edge stroke so the silhouette reads as terrain, not a flat block.
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(points[0].y));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(xAt(cumulative[i]), yAt(points[i].y));
  }
  ctx.strokeStyle = cssColor(COLORS.STRIP_PROFILE_LINE);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * @param {HTMLElement} container  appended into, once
 * @param {{ racers: Array<{ s: number, isPlayer: boolean }>, path: import('./trailPath.js') }} opts
 */
export function createProgressStrip(container, { racers, path }) {
  const root = document.createElement('div');
  root.className = 'hud-strip';

  const canvas = document.createElement('canvas');
  canvas.className = 'hud-strip-canvas';
  root.appendChild(canvas);
  drawProfile(canvas, path); // once -- see the module comment

  const markersEl = document.createElement('div');
  markersEl.className = 'hud-strip-markers';
  root.appendChild(markersEl);

  container.appendChild(root);

  // One marker div per racer, created once. Ticket 24 pushing more entries onto `racers`
  // before this call means they simply appear here, each in its own colour.
  const markers = racers.map((racer) => {
    const el = document.createElement('div');
    el.className = racer.isPlayer ? 'hud-strip-marker player' : 'hud-strip-marker rival';
    // Size lives in constants.js (STRIP.MARKER_SIZE / PLAYER_MARKER_SIZE), not CSS, so it
    // stays the single source of truth the ticket's constants block calls out.
    const size = racer.isPlayer ? STRIP.PLAYER_MARKER_SIZE : STRIP.MARKER_SIZE;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    // Ticket 24: a rival's marker is coloured from its own runner palette (courses/*.js
    // `rivals[].palette`, resolved to hex by main.js before it ever reaches racer.js) --
    // "all racers distinguishable" fails outright at four identical grey dots. The player
    // marker is deliberately left alone: `.hud-strip-marker.player` in index.html already
    // makes it the one thing on the strip your eye finds first, and no palette colour
    // should compete with that.
    if (!racer.isPlayer && racer.palette?.body != null) {
      el.style.background = cssColor(racer.palette.body);
    }
    markersEl.appendChild(el);
    return { racer, el };
  });

  function update() {
    for (const { racer, el } of markers) {
      const frac = clamp01(path.length > 0 ? racer.s / path.length : 0);
      el.style.left = `${frac * 100}%`;
    }
  }

  update();

  return { update };
}
