// Dust puffs: a fixed-size pool of small quads, recycled, never allocated per frame. See
// ticket 08. v1 emitted only on big-hop landings; v2 removed the big hop (ticket 10) and
// ticket 13 rewires this as continuous gait-landing dust, plus a bigger burst on a stumble.

import * as THREE from 'three';
import { COLORS, Z, DUST } from './constants.js';

export function createDust() {
  const group = new THREE.Group();

  const pool = [];
  for (let i = 0; i < DUST.POOL; i++) {
    const geometry = new THREE.PlaneGeometry(DUST.SIZE, DUST.SIZE);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.DUST,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    group.add(mesh);
    pool.push({ mesh, active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0 });
  }

  // Ring buffer: always hand out the next slot in insertion order, so once the pool is
  // full the next emit() naturally recycles the oldest live puff.
  let cursor = 0;

  // count/speed/spread default to the continuous gait-landing puff; racer.js passes the
  // wider, faster PER_STUMBLE/STUMBLE_SPEED/STUMBLE_SPREAD trio for the stumble burst.
  function emit(x, y, facing, { count = DUST.PER_GAIT, speed = DUST.SPEED, spread = DUST.SPREAD } = {}) {
    const backward = facing < 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % pool.length;

      p.x = x;
      p.y = y;
      p.vx = backward * speed + (Math.random() * 2 - 1) * spread;
      // Slightly up: a smaller kick than the backward speed, reusing spread as its scale.
      p.vy = spread + Math.random() * spread;
      p.age = 0;
      p.active = true;

      p.mesh.visible = true;
      p.mesh.position.set(p.x, p.y, Z.DUST);
      p.mesh.scale.set(1, 1, 1);
      p.mesh.material.opacity = 1;
    }
  }

  function update(dt) {
    for (const p of pool) {
      if (!p.active) continue;

      p.age += dt;
      const t = p.age / DUST.LIFE;
      if (t >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.vy -= DUST.GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const scale = 1 + (DUST.GROW - 1) * t;
      p.mesh.position.set(p.x, p.y, Z.DUST);
      p.mesh.scale.set(scale, scale, 1);
      p.mesh.material.opacity = 1 - t;
    }
  }

  return { group, emit, update };
}
