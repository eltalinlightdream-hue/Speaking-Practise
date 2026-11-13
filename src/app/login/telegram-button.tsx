"use client";

import { useEffect, useRef } from "react";

/**
 * Telegram's official "Log in with Telegram" button. Telegram shows it in a
 * frame and, after the user agrees, sends them to /auth/telegram.
 * Only shown when the bot name is set (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME).
 */
export function TelegramButton({ bot, next }: { bot: string; next: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-auth-url", `${window.location.origin}/auth/telegram?next=${encodeURIComponent(next)}`);
    box.appendChild(script);
    return () => {
      box.innerHTML = "";
    };
  }, [bot, next]);

  return <div ref={ref} className="flex min-h-12 justify-center" />;
}
