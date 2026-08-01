// Course registry. v2 ships one course; the registry exists so adding more is data rather
// than a refactor (DESIGN.md "Non-goals for v2").

import { alpine } from './alpine.js';

export const COURSES = { alpine };

export const DEFAULT_COURSE = COURSES.alpine;
