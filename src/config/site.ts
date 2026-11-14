// Facts shown in the footer. Change them here; no other code needs to change.

export type SiteLink = { kind: "telegram" | "youtube"; href: string; handle: string };
export type Person = { name: string; links: SiteLink[] };

/** The day the project started (YYYY-MM-DD). */
export const SITE_STARTED = "2026-11-12";

export const ENGINEER: Person = {
  name: "Abduraimov Erkinjon",
  links: [
    { kind: "telegram", href: "https://t.me/abduraimov_erkinjon", handle: "@abduraimov_erkinjon" },
    { kind: "youtube", href: "https://www.youtube.com/@erkinjon_writes", handle: "@erkinjon_writes" },
  ],
};

export const CONTRIBUTORS: Person[] = [
  { name: "Hojiakbar Odilov", links: [{ kind: "telegram", href: "https://t.me/Hojiakbar_Odilov20", handle: "@Hojiakbar_Odilov20" }] },
  { name: "Murodjon Maʼmurjonov", links: [{ kind: "telegram", href: "https://t.me/Murodjonielts", handle: "@Murodjonielts" }] },
];
