// Lesson groups: shared helpers for the browser and the server.
//
// A group belongs to a teacher and meets on even or odd days at a start time.
// Old groups made before that (teacher = null) only have a name.

export type DayPattern = "even" | "odd";

export type LessonGroup = {
  id: string;
  name: string;
  active: boolean;
  teacher: string | null;
  day_pattern: DayPattern | null;
  start_time: string | null;
};

/** Columns to select for a LessonGroup, sorted with GROUP_ORDER. */
export const GROUP_COLUMNS = "id, name, active, teacher, day_pattern, start_time, sort_order";

/** "13:00:00" -> "13:00" */
export function shortTime(time: string | null) {
  return time ? time.slice(0, 5) : "";
}

/** "Even days · 08:00" (without the teacher), or the plain name for old groups. */
export function groupSlotLabel(g: LessonGroup, dayLabel: (p: DayPattern) => string) {
  if (!g.teacher || !g.day_pattern) return g.name;
  return `${dayLabel(g.day_pattern)} · ${shortTime(g.start_time)}`;
}

/** "Abduraimov Erkinjon · Even days · 08:00", or the plain name for old groups. */
export function groupLabel(g: LessonGroup, dayLabel: (p: DayPattern) => string) {
  if (!g.teacher || !g.day_pattern) return g.name;
  return `${g.teacher} · ${groupSlotLabel(g, dayLabel)}`;
}

/** Groups by teacher, in the order they came (the query sorts them). Old groups go last under null. */
export function groupsByTeacher<T extends LessonGroup>(groups: T[]): { teacher: string | null; groups: T[] }[] {
  const out: { teacher: string | null; groups: T[] }[] = [];
  for (const g of groups) {
    let bucket = out.find((b) => b.teacher === g.teacher);
    if (!bucket) {
      bucket = { teacher: g.teacher, groups: [] };
      out.push(bucket);
    }
    bucket.groups.push(g);
  }
  return out.sort((a, b) => (a.teacher === null ? 1 : 0) - (b.teacher === null ? 1 : 0));
}
