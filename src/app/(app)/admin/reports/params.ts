import { isDay, weekStart } from "@/lib/practice/calendar";
import { tashkentDay } from "@/lib/practice/streak";

/** Read ?week= and ?group= safely. The week is never later than this week. */
export function readReportParams(sp: { week?: string | string[]; group?: string | string[] }) {
  const thisMonday = weekStart(tashkentDay());
  const rawWeek = typeof sp.week === "string" ? sp.week : "";
  const monday = isDay(rawWeek) ? weekStart(rawWeek) : thisMonday;
  const group = typeof sp.group === "string" && /^[0-9a-f-]{36}$/i.test(sp.group) ? sp.group : null;
  return { monday: monday > thisMonday ? thisMonday : monday, thisMonday, group };
}

export function reportHref(path: string, monday: string, group: string | null) {
  const q = new URLSearchParams({ week: monday });
  if (group) q.set("group", group);
  return `${path}?${q.toString()}`;
}
