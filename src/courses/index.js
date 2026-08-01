// Course registry (DESIGN.md "Non-goals for v2": adding a course is data, not a refactor).
//
// Ticket 20: the default becomes `summit`, the long course stamina needs. `alpine` stays
// registered -- it is still useful as a quick-iteration course, and it is the control for
// ticket 19's golden-path check (see test/trailPath.test.js). Select it with `?course=
// alpine` in the URL (see src/main.js); an unknown id falls back to the default.

import { alpine } from './alpine.js';
import { summit } from './summit.js';

export const COURSES = { alpine, summit };

export const DEFAULT_COURSE = COURSES.summit;
