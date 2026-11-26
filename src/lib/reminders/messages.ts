// The reminder texts. Playful on purpose (the owner chose a Duolingo-like tone).
// Several versions of each, picked at random, so students don't get used to them.
// {name} = first name, {left} = minutes left today, {streak} = streak in days.
// Add or change lines freely: no other code needs to change.

import type { DailyVariant, ReminderDecision } from "./plan.ts";

type Lang = "uz" | "en";
type Key = DailyVariant | "streak" | "stop";

const TEXTS: Record<Lang, Record<Key, string[]>> = {
  uz: {
    keep: [
      "Salom, {name}! 🔥 {streak} kunlik streakingiz bugungi 15 daqiqani kutyapti. Mikrofon tayyor! 🎤",
      "{name}, streak oʻzi oʻsmaydi 😄 Bugun ham 15 daqiqa gapirib, {streak} kunni {streak}+1 qilamizmi?",
      "Examiner allaqachon stulda oʻtiribdi 🧑‍🏫 {name}, bugungi 15 daqiqa — va streak davom etadi! 🔥",
      "🔥 {streak} kun ketma-ket! {name}, toʻxtab qolmaymiz — bugungi mashq sizni kutyapti.",
      "{name}, ingliz tilingiz sizni sogʻindi 🥺 15 daqiqa — va {streak} kunlik streak saqlanadi.",
    ],
    almost: [
      "Deyarli tayyor, {name}! 💪 Yana atigi {left} daqiqa — va bugun hisoblanadi.",
      "{name}, marraga oz qoldi! 🏁 {left} daqiqa gapiring — bugungi kun sizniki.",
      "Yana {left} daqiqa, {name}! ⏱ Bir-ikkita Part 1 savoli — va tamom.",
      "{name}, bugun yaxshi boshladingiz 👏 Yana {left} daqiqa qoldi, xolos!",
    ],
    start: [
      "Salom, {name}! 🎤 Bugungi 15 daqiqa sizni kutyapti. Bitta Part 1 bilan boshlaymizmi?",
      "{name}, gapirish mashqi vaqti keldi! 🗣 15 daqiqa — va bugun hisoblanadi.",
      "Ding-dong! 🔔 {name}, bugungi speaking mashqingiz hali qilinmadi.",
      "{name}, IELTS oʻzi tayyorlanib qolmaydi 😄 15 daqiqa vaqt ajratamizmi?",
      "Bugun yangi streak boshlash uchun ajoyib kun, {name}! 🔥 15 daqiqa kifoya.",
    ],
    comeback: [
      "{name}, sizni sogʻindik 🥺 Bitta qisqa Part 1 bilan qaytamizmi? 5 daqiqa ham foyda.",
      "Examiner soʻrayapti: «{name} qayerda?» 🧐 Keling, bugun 15 daqiqa gaplashamiz.",
      "{name}, eng qiyini — boshlash. Bitta tugma, bitta savol — va yana yoʻldasiz! 🚀",
      "Uzoq tanaffus boʻldi, {name} 😴 Bugun yangi streakni boshlaymizmi? 🔥",
    ],
    streak: [
      "🚨 {name}! {streak} kunlik streakingiz yarim tunda yoʻqoladi! Yana {left} daqiqa — va u saqlanadi. 🔥",
      "🔥 Streak yigʻlayapti, {name}! 😭 {streak} kunlik mehnat… {left} daqiqa gapiring — qutqaring!",
      "{name}, soat tikillayapti ⏰ {streak} kunlik streak xavf ostida. Yarim tungacha {left} daqiqa yetarli!",
      "SOS! 🆘 {streak} kunlik streak sizni chaqiryapti, {name}. Bor-yoʻgʻi {left} daqiqa!",
    ],
    stop: [
      "{name}, eslatmalarimiz yordam bermayapti shekilli 🙂 Endi ularni toʻxtataman. Qaytishga tayyor boʻlsangiz, sayt sizni kutadi — eslatmalarni «Sozlamalar»dan qayta yoqishingiz mumkin. 💚",
    ],
  },
  en: {
    keep: [
      "Hi {name}! 🔥 Your {streak}-day streak is waiting for today's 15 minutes. Mic ready! 🎤",
      "{name}, streaks don't grow by themselves 😄 15 minutes today turns {streak} days into {streak}+1!",
      "The examiner is already in the chair 🧑‍🏫 {name}, 15 minutes today and your streak lives on! 🔥",
      "🔥 {streak} days in a row! {name}, let's keep going — today's practice is waiting.",
      "{name}, your English misses you 🥺 15 minutes and your {streak}-day streak is safe.",
    ],
    almost: [
      "Almost there, {name}! 💪 Just {left} more minutes and today counts.",
      "{name}, the finish line is close! 🏁 Speak for {left} minutes and today is yours.",
      "{left} more minutes, {name}! ⏱ A couple of Part 1 questions and you're done.",
      "{name}, great start today 👏 Only {left} minutes to go!",
    ],
    start: [
      "Hi {name}! 🎤 Today's 15 minutes are waiting. Start with one Part 1?",
      "{name}, it's speaking time! 🗣 15 minutes and today counts.",
      "Ding-dong! 🔔 {name}, today's speaking practice isn't done yet.",
      "{name}, IELTS won't prepare itself 😄 Got 15 minutes?",
      "A great day to start a new streak, {name}! 🔥 15 minutes is enough.",
    ],
    comeback: [
      "{name}, we miss you 🥺 Come back with one short Part 1? Even 5 minutes helps.",
      "The examiner is asking: “Where is {name}?” 🧐 Let's talk for 15 minutes today.",
      "{name}, starting is the hardest part. One tap, one question, and you're back! 🚀",
      "That was a long break, {name} 😴 Start a new streak today? 🔥",
    ],
    streak: [
      "🚨 {name}! Your {streak}-day streak ends at midnight! {left} more minutes saves it. 🔥",
      "🔥 Your streak is crying, {name}! 😭 {streak} days of work… speak for {left} minutes to save it!",
      "{name}, the clock is ticking ⏰ Your {streak}-day streak is in danger. {left} minutes before midnight is enough!",
      "SOS! 🆘 Your {streak}-day streak is calling, {name}. Just {left} minutes!",
    ],
    stop: [
      "{name}, it looks like these reminders aren't helping 🙂 I'll stop sending them. When you're ready, the site is waiting — you can turn reminders back on in Settings. 💚",
    ],
  },
};

const BUTTONS: Record<Lang, { practise: string; off: string; settings: string }> = {
  uz: { practise: "🎤 Mashq qilish", off: "🔕 Eslatmalarni oʻchirish", settings: "⚙️ Sozlamalar" },
  en: { practise: "🎤 Practise now", off: "🔕 Turn off reminders", settings: "⚙️ Settings" },
};

export const OFF_CALLBACK = "rem:off";

export const OFF_DONE: Record<Lang, string> = {
  uz: "🔕 Eslatmalar oʻchirildi. Xohlasangiz, saytdagi «Sozlamalar»dan qayta yoqishingiz mumkin.",
  en: "🔕 Reminders are off. You can turn them back on in Settings on the site.",
};

function firstName(fullName: string | null): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The text, its variant id ("keep-2") and the buttons for one reminder. */
export function buildReminder(
  decision: ReminderDecision,
  person: { fullName: string | null; language: string | null },
  site: string,
  random: () => number = Math.random,
) {
  const lang: Lang = person.language === "en" ? "en" : "uz";
  const key: Key = decision.kind === "daily" ? (decision.variant ?? "start") : decision.kind;
  const list = TEXTS[lang][key];
  const index = Math.floor(random() * list.length) % list.length;
  const name = firstName(person.fullName) || (lang === "en" ? "friend" : "doʻstim");
  const text = list[index]
    .replaceAll("{streak}+1", String(decision.streak + 1))
    .replaceAll("{name}", name)
    .replaceAll("{left}", String(decision.minutesLeft))
    .replaceAll("{streak}", String(decision.streak));
  const b = BUTTONS[lang];
  const keyboard =
    decision.kind === "stop"
      ? [[{ text: b.settings, url: `${site}/settings` }]]
      : [[{ text: b.practise, url: `${site}/home` }], [{ text: b.off, callback_data: OFF_CALLBACK }]];
  return { text, variant: `${key}-${index + 1}`, reply_markup: { inline_keyboard: keyboard } };
}
