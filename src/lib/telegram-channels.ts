// Checks whether a Telegram user has joined the required channels.
// Uses the Bot API method getChatMember: https://core.telegram.org/bots/api#getchatmember
//
// No "server-only" import so the unit tests can load the pure parts.

import type { RequiredChannel } from "../config/telegram-channels.ts";

/** Telegram member statuses that count as "joined". */
export function isMemberStatus(status: string | undefined, isMember?: boolean) {
  if (status === "creator" || status === "administrator" || status === "member") return true;
  // "restricted" users may or may not still be in the channel.
  if (status === "restricted") return isMember === true;
  return false; // "left", "kicked", unknown
}

export type ChannelCheck = {
  /** Channels the user has NOT joined. */
  missing: string[];
  /** Channels the bot could not check (bot not admin, network error...). */
  unchecked: string[];
};

type Fetch = typeof fetch;

/**
 * Asks Telegram about each channel. A channel the bot cannot check is NOT
 * counted as missing (so a setup mistake never locks every student out);
 * it is logged on the server instead.
 */
export async function checkChannels(
  userId: number,
  channels: RequiredChannel[],
  botToken: string,
  fetchFn: Fetch = fetch,
): Promise<ChannelCheck> {
  const results = await Promise.all(
    channels.map(async (channel) => {
      try {
        const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent("@" + channel.username)}&user_id=${userId}`;
        const res = await fetchFn(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const body = (await res.json()) as { ok: boolean; result?: { status?: string; is_member?: boolean }; description?: string };
        if (!body.ok) {
          // "user not found" means they never joined; anything else is a setup problem.
          if (/user not found|participant_id_invalid/i.test(body.description ?? "")) return { channel, state: "missing" as const };
          console.warn(`telegram channel check failed for @${channel.username}: ${body.description}`);
          return { channel, state: "unchecked" as const };
        }
        return { channel, state: isMemberStatus(body.result?.status, body.result?.is_member) ? ("ok" as const) : ("missing" as const) };
      } catch (e) {
        console.warn(`telegram channel check error for @${channel.username}:`, e);
        return { channel, state: "unchecked" as const };
      }
    }),
  );
  return {
    missing: results.filter((r) => r.state === "missing").map((r) => r.channel.username),
    unchecked: results.filter((r) => r.state === "unchecked").map((r) => r.channel.username),
  };
}
