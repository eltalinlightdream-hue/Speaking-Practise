// Telegram channels a student must join before they can sign in.
// The bot (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) must be an ADMIN in every
// channel here, otherwise Telegram does not let it check members.
// Admins and the owner skip this check.

export type RequiredChannel = {
  /** Channel username without "@", as in t.me/<username>. */
  username: string;
  /** Name shown on the "join our channels" screen. */
  name: string;
};

export const REQUIRED_CHANNELS: RequiredChannel[] = [
  { username: "abduraimov_erkinjon", name: "Erkinjon Abduraimov" },
  { username: "Hojiakbar_Odilov20", name: "Hojiakbar Odilov" },
  { username: "Murodjonielts", name: "Murodjon IELTS" },
];

export function channelUrl(username: string) {
  return `https://t.me/${username}`;
}
