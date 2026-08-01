// DOM overlay inside #hud: the stat panel, the countdown, the ready prompt, and the
// finish card. See DESIGN.md "Race flow" and ticket 07.

import { RaceState } from './race.js';

function formatTime(seconds) {
  const totalCentis = Math.max(0, Math.round(seconds * 100));
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
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

export function createHud(container, { race, racer, path, onRestart }) {
  const gain = buildGainTable(path);
  const totalGain = gain[gain.length - 1];
  const totalDistance = path.length;

  const stats = document.createElement('div');
  stats.className = 'hud-stats';
  stats.innerHTML = `
    <div class="hud-row"><span class="hud-label">TIME</span><span class="hud-value" data-field="time"></span></div>
    <div class="hud-row"><span class="hud-label">DIST</span><span class="hud-value" data-field="dist"></span></div>
    <div class="hud-row"><span class="hud-label">ELEV</span><span class="hud-value" data-field="elev"></span></div>
  `;
  container.appendChild(stats);
  const timeEl = stats.querySelector('[data-field="time"]');
  const distEl = stats.querySelector('[data-field="dist"]');
  const elevEl = stats.querySelector('[data-field="elev"]');

  const ready = document.createElement('div');
  ready.className = 'hud-ready';
  ready.textContent = 'Press Space to race';
  container.appendChild(ready);

  const countdown = document.createElement('div');
  countdown.className = 'hud-countdown';
  container.appendChild(countdown);

  const finish = document.createElement('div');
  finish.className = 'hud-finish';
  finish.innerHTML = `
    <div class="hud-finish-title">FINISH</div>
    <div class="hud-finish-time" data-field="finish-time"></div>
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

  function update() {
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

    ready.style.display = race.state === RaceState.READY ? 'block' : 'none';

    if (race.state === RaceState.COUNTDOWN) {
      countdown.style.display = 'block';
      countdown.textContent = race.countdownLabel;
      countdown.style.opacity = String(1 - race.countdownProgress);
    } else {
      countdown.style.display = 'none';
    }

    const finished = race.state === RaceState.FINISHED;
    finish.style.display = finished ? 'flex' : 'none';
    if (finished) {
      finishTimeEl.textContent = formatTime(race.finishTime);
      finishStatsEl.textContent =
        `↑ ${Math.round(totalGain)} m · ${Math.round(totalDistance)} m`;
    }
  }

  update();

  return { update };
}
