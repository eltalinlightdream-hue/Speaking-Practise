import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale } from "./config";

// No locale in the URL: the language comes from a cookie that the language
// switcher sets (and that is saved to the user's profile when signed in).
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value);
  return {
    locale,
    timeZone: "Asia/Tashkent",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
