# Trail Hop

A short trail-running race in the browser, built with [three.js](https://threejs.org/) and
Vite. Flat start, up a hill, down a hill, up a switchback stack, finish line at the top.

## Run it

```
npm install
npm run dev
```

Open the printed local URL. `npm run build` produces a static production build in `dist/`;
`npm test` runs the path-geometry unit tests (`node --test`, no test framework).

## How to play

**← and → lean you forward and back.** There is no hop button — hopping is the automatic
gait, running by itself the whole race. Leaning forward is faster and costs stamina; leaning
back is slower and costs less.

**Stamina is one tank for the whole course.** It starts full, only ever decreases, and never
refills — backing off slows the burn, it doesn't undo it. The bar under the stats panel
shows what's left, colour-coded (green / yellow / red as the tank empties). Push too hard
for too long and you **bonk**: you can no longer lean above the terrain's ideal line, and
your speed drops, for the rest of the race. The skill is holding the hardest pace you can
sustain — arriving at the line with the tank as close to empty as possible without going
dry early.

- `3, 2, 1, GO!` — the clock starts on GO.
- Live HUD: elapsed time, distance covered, elevation gained, pace, your best time on this
  course, and the stamina bar.
- Cross the finish line for your time, then **R** (or click the finish card) to run it
  again. Best times are saved per course in your browser.

## The courses

Two courses, selected by URL:

- **`summit`** (the default) — "Summit Traverse," ~826 m and ~130 m of climbing: a long
  grind with a false summit, rolling terrain, then a switchback climax. Built for stamina to
  matter over a race long enough for it to compound — roughly a minute and a half at a hard,
  sustainable pace.
- **`alpine`** (`?course=alpine`) — "Alpine Switchbacks," the original short course: ~191 m,
  a smoothstep climb and descent, then a five-leg switchback stack. Good for quick
  iteration; roughly 20–30 seconds.

On both, the switchback stack is the hardest terrain on the course — it costs stamina far
out of proportion to its length, and the camera pulls back to a wider shot for the whole
climb so you can see it coming.

## Where to tune things

Every number that affects look or feel — speeds, sizes, durations, colors, stamina drain,
camera framing — lives in `src/constants.js`. Course geometry itself (the actual path shape,
per course) lives only in `src/courses/*.js`; see `DESIGN.md` for the full module map and
the geometry constraints that later tuning can accidentally break.

## What v3 deliberately does not have

- **No obstacles, no gaps, no AI opponents.** One racer, a continuous ground line under the
  trail.
- **Only two courses.** The architecture supports more (courses are a registry keyed by id),
  but only `summit` and `alpine` ship.
- **Desktop keyboard only.** ← → lean; there is no touch or gamepad input. Clicking/tapping
  only starts or restarts a race, never steers.
- **No stumble.** v2 tripped the runner for over-leaning; playtesting found it read as
  annoying rather than tense, and it's been replaced by the stamina cost above. The code is
  disabled, not deleted (`STUMBLE.ENABLED = false` in `src/constants.js`), so it's a
  one-line restore if stamina ever proves too thin on its own.
