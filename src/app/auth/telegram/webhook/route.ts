import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REQUEST_TTL_SECONDS,
  confirmData,
  isStartCommand,
  parseConfirmData,
  parseStartCode,
  safeEqual,
  webhookSecret,
} from "@/lib/telegram-auth";
import { telegramApi, telegramLoginInfo } from "@/lib/telegram-bot";
import { checkChannels } from "@/lib/telegram-channels";
import { REQUIRED_CHANNELS, channelUrl } from "@/config/telegram-channels";

// Telegram calls this for every message to the bot (set up once on /owner).
// The secret header proves the call really comes from Telegram.
//
// "/start <code>"  -> the bot asks "Confirm sign-in?" with a button.
// button pressed   -> students must have joined every channel in
//                     src/config/telegram-channels.ts (admins and the owner skip
//                     this). If they have not, the bot shows "Join" buttons and
//                     "Check again" (the same Confirm button). Once they have,
//                     the request is marked as confirmed for that Telegram user;
//                     the login page notices and signs the browser in.

type TgUser = { id: number; is_bot?: boolean; first_name: string; last_name?: string; username?: string };
type Update = {
  message?: { message_id: number; text?: string; from?: TgUser; chat: { id: number; type: string } };
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
};

const TEXT = {
  confirm:
    "Speaking Easy saytiga kirishni tasdiqlaysizmi?\nConfirm sign-in to Speaking Easy?\n\n" +
    "Agar hozirgina saytda tugmani bosmagan boʻlsangiz, bu xabarni eʼtiborsiz qoldiring.\n" +
    "If you did not just tap the button on the site, ignore this message.",
  button: "✅ Tasdiqlash / Confirm",
  done: "✅ Tayyor! Saytga qayting — u sizni oʻzi kiritadi.\n✅ Done! Go back to the site — it will sign you in.",
  expired:
    "⏳ Bu havola eskirgan. Saytga qaytib, qaytadan urinib koʻring.\n⏳ This link has expired. Go back to the site and try again.",
  join:
    "Kirish uchun quyidagi Telegram kanallarimizga aʼzo boʻling, soʻng «Tekshirish» tugmasini bosing.\n" +
    "To sign in, join our Telegram channels below, then tap “Check again”.",
  joinButton: (name: string) => `➕ ${name}`,
  checkAgain: "🔄 Tekshirish / Check again",
  notYet: "Hali hammasiga aʼzo boʻlmagansiz / Not all joined yet",
  hello: (site: string) =>
    "Salom! Kirish uchun saytda «Telegram orqali kirish» tugmasini bosing.\n" +
    "Hi! To sign in, tap “Continue with Telegram” on the site.\n\n" +
    `${site}/login`,
};

const freshSince = () => new Date(Date.now() - REQUEST_TTL_SECONDS * 1000).toISOString();

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!token || !safeEqual(given, webhookSecret(token))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const update = (await request.json().catch(() => ({}))) as Update;
  const site = new URL(request.url).origin;

  try {
    const msg = update.message;
    if (msg && msg.chat.type === "private" && isStartCommand(msg.text)) {
      const code = parseStartCode(msg.text);
      if (!code) {
        await telegramApi("sendMessage", { chat_id: msg.chat.id, text: TEXT.hello(site), link_preview_options: { is_disabled: true } });
      } else {
        const { data: row } = admin
          ? await admin
              .from("telegram_login_requests")
              .select("code")
              .eq("code", code)
              .is("confirmed_at", null)
              .gte("created_at", freshSince())
              .maybeSingle()
          : { data: null };
        if (row) {
          await telegramApi("sendMessage", {
            chat_id: msg.chat.id,
            text: TEXT.confirm,
            reply_markup: { inline_keyboard: [[{ text: TEXT.button, callback_data: confirmData(code) }]] },
          });
        } else {
          await telegramApi("sendMessage", { chat_id: msg.chat.id, text: TEXT.expired });
        }
      }
    }

    const cb = update.callback_query;
    if (cb) {
      const code = parseConfirmData(cb.data);
      let confirmed = false;
      if (code && admin && !cb.from.is_bot && cb.message?.chat.type === "private") {
        // Is the request still open? (Do not check channels for old buttons.)
        const { data: open } = await admin
          .from("telegram_login_requests")
          .select("code")
          .eq("code", code)
          .is("confirmed_at", null)
          .gte("created_at", freshSince())
          .maybeSingle();

        let missing: string[] = [];
        if (open) {
          const info = await telegramLoginInfo(cb.from.id);
          const staff = info?.role === "admin" || info?.role === "owner";
          if (!staff) missing = (await checkChannels(cb.from.id, REQUIRED_CHANNELS, token)).missing;
        }

        if (open && missing.length > 0) {
          await telegramApi("answerCallbackQuery", { callback_query_id: cb.id, text: TEXT.notYet });
          const rows = REQUIRED_CHANNELS.filter((c) => missing.includes(c.username)).map((c) => [
            { text: TEXT.joinButton(c.name), url: channelUrl(c.username) },
          ]);
          await telegramApi("editMessageText", {
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            text: TEXT.join,
            reply_markup: { inline_keyboard: [...rows, [{ text: TEXT.checkAgain, callback_data: confirmData(code) }]] },
          });
          return NextResponse.json({ ok: true });
        }

        if (open) {
          const { data } = await admin
            .from("telegram_login_requests")
            .update({
              telegram_id: cb.from.id,
              first_name: cb.from.first_name,
              last_name: cb.from.last_name ?? null,
              username: cb.from.username ?? null,
              confirmed_at: new Date().toISOString(),
            })
            .eq("code", code)
            .is("confirmed_at", null)
            .gte("created_at", freshSince())
            .select("code");
          confirmed = (data?.length ?? 0) > 0;
        }
      }
      await telegramApi("answerCallbackQuery", { callback_query_id: cb.id, text: confirmed ? "✅" : "⏳" });
      if (cb.message) {
        await telegramApi("editMessageText", {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: confirmed ? TEXT.done : TEXT.expired,
        });
      }
    }
  } catch (e) {
    console.warn("telegram webhook error:", e instanceof Error ? e.message : e);
  }

  // Always 200, or Telegram keeps re-sending the same update.
  return NextResponse.json({ ok: true });
}
