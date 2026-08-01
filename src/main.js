import * as THREE from 'three';
import { FIXED_DT, MAX_FRAME_DT, COLORS } from './constants.js';
import { buildPath } from './trailPath.js';
import { DEFAULT_COURSE } from './courses/index.js';
import { buildWorld } from './world.js';
import { createRacer } from './racer.js';
import { createPlayerController } from './controllers.js';
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

const course = DEFAULT_COURSE;
const path = buildPath(course.segments, course.start);
const world = buildWorld(path, course);
scene.add(world.group);

const dust = createDust();
scene.add(dust.group);

// v2 ships exactly one racer. Additional racers (AI opponents) would be pushed onto this
// array with their own controllers; nothing else needs to change.
const player = createRacer({
  path,
  controller: createPlayerController(),
  isPlayer: true,
  dust,
});
scene.add(player.group);

const racers = [player];

const cameraRig = createCameraRig(camera, path, course);
const race = createRace(racers, cameraRig);

const hud = createHud(document.getElementById('hud'), {
  race,
  racer: player,
  path,
  onRestart: () => race.requestRestart(),
});

// Space and pointerdown are start/restart only in v2 -- there is no manual hop to trigger
// (ticket 10). ArrowLeft/ArrowRight are handled separately, by the player controller, as
// lean input (ticket 11).
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    race.requestStart();
  } else if (event.code === 'KeyR') {
    race.requestRestart();
  }
});

renderer.domElement.addEventListener('pointerdown', () => {
  race.requestStart();
});

/**
 * Fixed-timestep simulation: race.update() gates racers by state (no advance during
 * READY/COUNTDOWN, idle bob during FINISHED), eases each runner's facing/lean, and drives
 * the camera rig. dust.update() only ever animates particles already emitted elsewhere --
 * the emitting itself happens inside locomotion.js's onGaitLand/onStumble callbacks (wired
 * in racer.js), continuously, every gait-hop landing plus a bigger burst on a stumble
 * (ticket 13).
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
