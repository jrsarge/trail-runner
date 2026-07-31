# Trail Hop

A short, one-button trail-running race in the browser. Flat start, up a hill, down a hill,
up a switchback stack, finish line at the top. Built with [three.js](https://threejs.org/)
and Vite.

## Run it

```
npm install
npm run dev
```

Open the printed local URL. `npm run build` produces a static production build in `dist/`;
`npm test` runs the path-geometry unit tests (`node --test`, no test framework).

## How to play

One button: **Space**, **click**, or **tap**. Press it to start the countdown, then press it
during the race for a big hop over the trail. Left alone, the runner trots along on its own
at a constant pace — the button doesn't move you faster, it just makes a bigger leap.

- `3, 2, 1, GO!` — the clock starts on GO.
- Live HUD: elapsed time, distance covered, elevation gained.
- Cross the finish line for your time, then **R** (or click the finish card) to run it
  again.

## The course

One race, about 190 m and 28 m of climbing, roughly 27 seconds at a full run: a flat
start, a smoothstep climb, a smoothstep descent, then a five-leg switchback stack up to
the finish banner. The camera follows you on the flat and the hills, then pulls back to a
wide static shot for the whole switchback climb — that's the part worth watching.

## Where to tune things

Every number that affects look or feel — speeds, sizes, durations, colors, camera
framing — lives in `src/constants.js`. The course geometry itself (the actual path shape)
lives only in `src/course.js`; see `DESIGN.md` for the full module map and the geometry
constraints that later tuning can accidentally break.

## What this POC deliberately does not have

- **No fail state.** You cannot miss a landing, fall, or die. Timer only.
- **No obstacles or gaps.** The ground is a continuous line under the trail.
- **Constant pace.** The hop button cannot make you faster or slower — pace is fixed.

Because of the above, **the hop button is currently the gait, not a skill check.** Pressing
it produces a bigger, more satisfying leap than the automatic trot, but it never changes
your time. That's the right scope for this POC — it proves out terrain, motion, camera, and
feel — but it's an open question, not a finished decision. See "Open design question" in
`DESIGN.md` for the candidates (rhythm/momentum, obstacles, stamina) if the game should
reward skill next. That's a new design decision and it's the user's call, not something
this POC resolves on its own.
