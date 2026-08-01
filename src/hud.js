// DOM overlay inside #hud: the stat panel, the stamina bar, the countdown, the ready
// prompt, the lean tutorial, and the finish card. See DESIGN.md "Race flow" and ticket 07;
// the stat block's pace/best rows, the stamina bar, and the tutorial are ticket 15.

import { RaceState } from './race.js';
import { STAMINA, HUD, TUTORIAL, STORAGE, SPEED } from './constants.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(x) {
  return clamp(x, 0, 1);
}

function formatTime(seconds) {
  const totalCentis = Math.max(0, Math.round(seconds * 100));
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

// Signed delta, e.g. "−1.42" (faster / a negative number) or "+0.87" (slower). Uses a true
// minus sign (U+2212), not a hyphen, to match the ticket's example.
function formatDelta(deltaSeconds) {
  const sign = deltaSeconds < 0 ? '−' : '+';
  return `${sign}${Math.abs(deltaSeconds).toFixed(2)}`;
}

// --- localStorage: throws in private browsing and some embedded webviews (ticket 15).
// Every read and write is wrapped so the race still runs start to finish with best times
// simply not recorded, rather than crashing. ---
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Degrade to "no best time recorded" -- see ticket 15.
  }
}

function loadBestMs(courseId) {
  const raw = safeGet(STORAGE.BEST_PREFIX + courseId);
  const ms = raw == null ? NaN : Number(raw);
  return Number.isFinite(ms) ? ms : null;
}

// Per-vertex cumulative elevation gain, parallel to path.cumulative (arc length). Built
// once at startup, then interpolated by s the same way path.pointAt() interpolates
// position -- never recomputed as a per-frame sum (that's how you'd double-count the
// descent and land on ~56 instead of ~28.4).
function buildGainTable(path) {
  const points = path.points;
  const gain = [0];
  for (let i = 1; i < points.length; i++) {
    gain.push(gain[i - 1] + Math.max(0, points[i].y - points[i - 1].y));
  }
  return gain;
}

function gainAt(path, gain, s) {
  const cumulative = path.cumulative;
  const n = cumulative.length;
  if (s <= 0) return 0;
  if (s >= path.length) return gain[n - 1];

  let lo = 0;
  let hi = n - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulative[mid] <= s) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const i = lo;
  const segLen = cumulative[i + 1] - cumulative[i];
  const t = segLen > 0 ? (s - cumulative[i]) / segLen : 0;
  return gain[i] + (gain[i + 1] - gain[i]) * t;
}

export function createHud(container, { race, racer, path, course, onRestart }) {
  const gain = buildGainTable(path);
  const totalGain = gain[gain.length - 1];
  const totalDistance = path.length;
  const courseId = course?.id ?? 'default';

  const stats = document.createElement('div');
  stats.className = 'hud-stats';
  stats.innerHTML = `
    <div class="hud-row"><span class="hud-label">TIME</span><span class="hud-value" data-field="time"></span></div>
    <div class="hud-row"><span class="hud-label">DIST</span><span class="hud-value" data-field="dist"></span></div>
    <div class="hud-row"><span class="hud-label">ELEV</span><span class="hud-value" data-field="elev"></span></div>
    <div class="hud-row"><span class="hud-label">PACE</span><span class="hud-value" data-field="pace"></span></div>
    <div class="hud-row"><span class="hud-label">BEST</span><span class="hud-value" data-field="best"></span></div>
    <div class="hud-stamina" data-field="stamina-track">
      <div class="hud-stamina-fill" data-field="stamina-fill">
        <div class="hud-stamina-burn" data-field="stamina-burn"></div>
      </div>
    </div>
  `;
  container.appendChild(stats);
  const timeEl = stats.querySelector('[data-field="time"]');
  const distEl = stats.querySelector('[data-field="dist"]');
  const elevEl = stats.querySelector('[data-field="elev"]');
  const paceEl = stats.querySelector('[data-field="pace"]');
  const bestEl = stats.querySelector('[data-field="best"]');
  const staminaFillEl = stats.querySelector('[data-field="stamina-fill"]');
  const staminaBurnEl = stats.querySelector('[data-field="stamina-burn"]');

  const ready = document.createElement('div');
  ready.className = 'hud-ready';
  ready.textContent = 'Press Space to race';
  container.appendChild(ready);

  const tutorial = document.createElement('div');
  tutorial.className = 'hud-tutorial';
  tutorial.textContent = '← → to lean';
  container.appendChild(tutorial);

  const countdown = document.createElement('div');
  countdown.className = 'hud-countdown';
  container.appendChild(countdown);

  const finish = document.createElement('div');
  finish.className = 'hud-finish';
  finish.innerHTML = `
    <div class="hud-finish-title">FINISH</div>
    <div class="hud-finish-time" data-field="finish-time"></div>
    <div class="hud-finish-newbest" data-field="finish-newbest">NEW BEST</div>
    <div class="hud-finish-delta" data-field="finish-delta"></div>
    <div class="hud-finish-stats" data-field="finish-stats"></div>
    <div class="hud-finish-prompt">Press R to run it again</div>
  `;
  finish.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    onRestart();
  });
  container.appendChild(finish);
  const finishTimeEl = finish.querySelector('[data-field="finish-time"]');
  const finishStatsEl = finish.querySelector('[data-field="finish-stats"]');
  const finishDeltaEl = finish.querySelector('[data-field="finish-delta"]');
  const finishNewBestEl = finish.querySelector('[data-field="finish-newbest"]');

  // --- best time (ticket 15 §1): per course, guarded against a throwing localStorage. ---
  let bestMs = loadBestMs(courseId);
  let taught = safeGet(STORAGE.TAUGHT) === '1';

  // Finish-card delta state, computed once at the RUNNING->FINISHED edge (a genuine finish)
  // and held for as long as the finish card is showing -- NOT recomputed every frame, which
  // would compare the just-written best against itself.
  let finishHasPrevBest = false;
  let finishDeltaSeconds = 0;
  let finishIsNewBest = false;

  // --- pace smoothing (ticket 15 §2, HUD.PACE_SMOOTH_TIME) ---
  let smoothedSpeed = 0;

  // --- stamina burn zone (ticket 15 §2b, THE headline of this ticket) ---
  // The bar only ever shrinks, so the "rate" isn't stored anywhere in locomotion -- it's
  // derived here, frame to frame, from staminaFraction alone: how much fraction was lost
  // since the last HUD update, projected `burnLookahead` seconds ahead at that rate, then
  // eased over HUD.BURN_EASE_TIME so it reads as a band, not per-frame jitter. Negative
  // deltas (stamina rising, e.g. a restart snapping it back to full) are clamped to zero --
  // there is no such thing as a negative burn rate.
  let prevStaminaFraction = racer.staminaFraction;
  let easedBurnFraction = 0;
  // Scaled to the course's own expected duration rather than a fixed number of seconds --
  // a fixed 5 s read as 44-48% of the bar at max lean on alpine but only 7% on summit,
  // whose tank is ~4.4x larger. See the HUD comment in constants.js.
  const burnLookahead = (path.length / SPEED.BASE) * HUD.BURN_LOOKAHEAD_FRACTION;

  // --- tutorial (ticket 15 §3) ---
  let leanHeldTime = 0;
  let tutorialSatisfied = false;

  let lastRaceState = race.state;

  function update(dt) {
    const s = Math.min(racer.s, totalDistance);
    const g = gainAt(path, gain, s);

    const displayTime =
      race.state === RaceState.FINISHED
        ? race.finishTime
        : race.state === RaceState.RUNNING
          ? race.elapsed
          : 0;
    timeEl.textContent = formatTime(displayTime);
    distEl.textContent = `${Math.round(s)} / ${Math.round(totalDistance)} m`;
    elevEl.textContent = `↑ ${Math.round(g)} / ${Math.round(totalGain)} m`;

    // --- pace (ticket 15 §2): lightly smoothed so the last digit isn't per-frame noise. ---
    const paceAlpha = dt > 0 ? 1 - Math.exp(-dt / HUD.PACE_SMOOTH_TIME) : 1;
    smoothedSpeed += (racer.speed - smoothedSpeed) * paceAlpha;
    paceEl.textContent = `${Math.max(0, smoothedSpeed).toFixed(1)} m/s`;

    bestEl.textContent = bestMs != null ? formatTime(bestMs / 1000) : '—';

    // --- stamina bar (ticket 15 §2b) ---
    const fraction = clamp01(racer.staminaFraction);
    if (dt > 1e-4) {
      const fractionDrop = Math.max(0, prevStaminaFraction - fraction);
      const instRate = fractionDrop / dt; // fraction of the tank per second
      const targetBurn = clamp(instRate * burnLookahead, 0, fraction);
      const burnAlpha = 1 - Math.exp(-dt / HUD.BURN_EASE_TIME);
      easedBurnFraction += (targetBurn - easedBurnFraction) * burnAlpha;
    }
    easedBurnFraction = clamp(easedBurnFraction, 0, fraction);
    prevStaminaFraction = fraction;

    // Width/left are set directly every frame (no CSS transition on the fill) -- stamina
    // only ever decreases, so an eased/transitioned width could visually suggest it refills
    // on a restart snap-back. The burn band's own smoothing is done above, in JS, against
    // the rate, not against its own rendered width.
    staminaFillEl.style.width = `${fraction * 100}%`;
    staminaFillEl.classList.toggle('warning', fraction < STAMINA.TIRED_FRACTION);
    staminaBurnEl.style.width = `${(fraction > 0 ? easedBurnFraction / fraction : 0) * 100}%`;

    ready.style.display = race.state === RaceState.READY ? 'block' : 'none';

    if (race.state === RaceState.COUNTDOWN) {
      countdown.style.display = 'block';
      countdown.textContent = race.countdownLabel;
      countdown.style.opacity = String(1 - race.countdownProgress);
    } else {
      countdown.style.display = 'none';
    }

    // --- tutorial (ticket 15 §3) ---
    if (race.state === RaceState.RUNNING) {
      if (racer.leanInput !== 0) leanHeldTime += dt;
      if (leanHeldTime >= TUTORIAL.SATISFIED_TIME) tutorialSatisfied = true;
    }
    const showTutorial =
      !taught && race.state === RaceState.RUNNING && s < TUTORIAL.DISTANCE && !tutorialSatisfied;
    tutorial.classList.toggle('visible', showTutorial);

    // --- run-start / finish-edge bookkeeping ---
    // COUNTDOWN -> RUNNING is the start of a genuine run: reset the tutorial's per-run
    // timer here rather than at READY/restart, since a restart from FINISHED passes through
    // READY and COUNTDOWN again before RUNNING resumes.
    if (lastRaceState === RaceState.COUNTDOWN && race.state === RaceState.RUNNING) {
      leanHeldTime = 0;
      tutorialSatisfied = false;
    }

    // RUNNING -> FINISHED is the only genuine finish (race.js only ever enters FINISHED
    // from RUNNING) -- times recorded any other way are not written. Computed once here,
    // not every frame, so the delta is against the best as it stood BEFORE this run.
    if (lastRaceState === RaceState.RUNNING && race.state === RaceState.FINISHED) {
      const finishMs = Math.round(race.finishTime * 1000);
      finishHasPrevBest = bestMs != null;
      finishDeltaSeconds = finishHasPrevBest ? (finishMs - bestMs) / 1000 : 0;
      finishIsNewBest = !finishHasPrevBest || finishMs < bestMs;
      if (finishIsNewBest) {
        bestMs = finishMs;
        safeSet(STORAGE.BEST_PREFIX + courseId, String(finishMs));
      }
      if (!taught) {
        taught = true;
        safeSet(STORAGE.TAUGHT, '1');
      }
    }
    lastRaceState = race.state;

    const finished = race.state === RaceState.FINISHED;
    finish.style.display = finished ? 'flex' : 'none';
    if (finished) {
      finishTimeEl.textContent = formatTime(race.finishTime);
      finishStatsEl.textContent = `↑ ${Math.round(totalGain)} m · ${Math.round(totalDistance)} m`;

      if (finishHasPrevBest) {
        finishDeltaEl.style.display = 'block';
        finishDeltaEl.textContent = formatDelta(finishDeltaSeconds);
        finishDeltaEl.classList.toggle('good', finishDeltaSeconds < 0);
        finishDeltaEl.classList.toggle('bad', finishDeltaSeconds > 0);
      } else {
        finishDeltaEl.style.display = 'none';
      }
      finishNewBestEl.style.display = finishHasPrevBest && finishIsNewBest ? 'block' : 'none';
    }
  }

  update(0);

  return { update };
}
