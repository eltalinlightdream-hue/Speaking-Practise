// Dates like "13-noy, 14:30" (Uzbek) or "13 Nov, 14:30" (English).
//
// Browsers (especially on phones) often ship without Uzbek date names and
// print things like "M11 13". So the month names are written out here and
// Intl is only used for the numbers, which every browser has.

const MONTHS = {
  uz: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
} as const;

type Locale = keyof typeof MONTHS;

function parts(date: Date, timeZone?: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { day: Number(p.day), month: Number(p.month) - 1, time: `${p.hour}:${p.minute}` };
}

/** Day, short month and time. Pass a timeZone for a fixed zone (e.g. Tashkent); leave it out for the device's zone. */
export function formatDayTime(date: Date, locale: string, timeZone?: string): string {
  const lang: Locale = locale === "uz" ? "uz" : "en";
  const { day, month, time } = parts(date, timeZone);
  return lang === "uz" ? `${day}-${MONTHS.uz[month]}, ${time}` : `${day} ${MONTHS.en[month]}, ${time}`;
}

const MONTHS_LONG = {
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

/** "9–15-noyabr 2026" / "9–15 November 2026" for two YYYY-MM-DD days (any months). */
export function formatDayRange(from: string, to: string, locale: string): string {
  const lang: Locale = locale === "uz" ? "uz" : "en";
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const month = (m: number) => MONTHS_LONG[lang][m - 1];
  const one = (d: number, m: number) => (lang === "uz" ? `${d}-${month(m)}` : `${d} ${month(m)}`);
  if (y1 === y2 && m1 === m2) return lang === "uz" ? `${d1}–${d2}-${month(m1)} ${y1}` : `${d1}–${d2} ${month(m1)} ${y1}`;
  if (y1 === y2) return `${one(d1, m1)} – ${one(d2, m2)} ${y1}`;
  return `${one(d1, m1)} ${y1} – ${one(d2, m2)} ${y2}`;
}

/** "13-noyabr 2026" / "13 November 2026" for a YYYY-MM-DD day. */
export function formatDay(day: string, locale: string): string {
  const lang: Locale = locale === "uz" ? "uz" : "en";
  const [y, m, d] = day.split("-").map(Number);
  return lang === "uz" ? `${d}-${MONTHS_LONG.uz[m - 1]} ${y}` : `${d} ${MONTHS_LONG.en[m - 1]} ${y}`;
}
