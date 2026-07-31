import * as THREE from 'three';
import { FIXED_DT, MAX_FRAME_DT, COLORS } from './constants.js';
import { buildPath } from './trailPath.js';
import { buildWorld } from './world.js';
import { createRunner } from './runner.js';
import { createLocomotion } from './locomotion.js';
import { createCameraRig } from './cameraRig.js';
import { createDust } from './dust.js';
import { createRace } from './race.js';
import { createHud } from './hud.js';

const container = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.SKY_BOTTOM);

const camera = new THREE.OrthographicCamera();
camera.position.z = 10;
// Camera sits at z = 10 looking down -Z; scene content spans z in [-10, 10], i.e. depth
// (cameraZ - objectZ) in [0, 20]. near/far cover that with margin.
camera.near = -10;
camera.far = 30;

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  // The camera rig recomputes the frustum from window.innerWidth/innerHeight on every
  // update() tick, so a resize is picked up on the next animation frame automatically.
}

window.addEventListener('resize', resize);
resize();

const path = buildPath();
const world = buildWorld(path);
scene.add(world.group);

const runner = createRunner(path);
scene.add(runner.group);

const dust = createDust();
scene.add(dust.group);

const locomotion = createLocomotion(path, runner, (x, y, facing) => dust.emit(x, y, facing));
const cameraRig = createCameraRig(camera, path);
const race = createRace(locomotion, runner, cameraRig);

const hud = createHud(document.getElementById('hud'), {
  race,
  locomotion,
  path,
  onRestart: () => race.requestRestart(),
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    race.requestHop();
  } else if (event.code === 'KeyR') {
    race.requestRestart();
  }
});

renderer.domElement.addEventListener('pointerdown', () => {
  race.requestHop();
});

/**
 * Fixed-timestep simulation: race.update() gates locomotion by state (no advance during
 * READY/COUNTDOWN, idle bob during FINISHED), eases the runner's facing/tilt, and drives
 * the camera rig. Dust is independent of race state -- it only ever animates particles
 * that locomotion's onBigLand callback already emitted.
 */
function update(dt) {
  race.update(dt);
  dust.update(dt);
}

// Prime the camera before the first render so frame 1 isn't framed by the browser
// default frustum.
race.update(0);

let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
  last = now;
  acc += dt;
  while (acc >= FIXED_DT) {
    update(FIXED_DT);
    acc -= FIXED_DT;
  }
  world.updateParallax(camera.position.x);
  hud.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
