import { isDay, weekStart } from "@/lib/practice/calendar";
import { tashkentDay } from "@/lib/practice/streak";
import { groupFilterParams, readGroupFilter, type GroupFilterValue } from "@/lib/groups";

/** Read ?week=, ?group= and ?teacher= safely. The week is never later than this week. */
export function readReportParams(sp: { week?: string | string[]; group?: string | string[]; teacher?: string | string[] }) {
  const thisMonday = weekStart(tashkentDay());
  const rawWeek = typeof sp.week === "string" ? sp.week : "";
  const monday = isDay(rawWeek) ? weekStart(rawWeek) : thisMonday;
  return { monday: monday > thisMonday ? thisMonday : monday, thisMonday, filter: readGroupFilter(sp) };
}

export function reportHref(path: string, monday: string, filter: GroupFilterValue) {
  const q = new URLSearchParams({ week: monday, ...groupFilterParams(filter) });
  return `${path}?${q.toString()}`;
}
