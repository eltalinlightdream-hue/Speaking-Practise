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
