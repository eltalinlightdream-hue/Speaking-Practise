"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChartNoAxesColumn, Crown, House, Mic, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

type Item = { href: string; key: "home" | "progress" | "recordings" | "settings" | "admin" | "owner"; icon: typeof House };

function itemsFor(role: Role): Item[] {
  const items: Item[] = [
    { href: "/home", key: "home", icon: House },
    { href: "/progress", key: "progress", icon: ChartNoAxesColumn },
    { href: "/recordings", key: "recordings", icon: Mic },
    { href: "/settings", key: "settings", icon: Settings },
  ];
  if (role === "admin" || role === "owner") items.push({ href: "/admin", key: "admin", icon: ShieldCheck });
  if (role === "owner") items.push({ href: "/owner", key: "owner", icon: Crown });
  return items;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Top navigation for tablet and desktop. */
export function TopNav({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {itemsFor(role).map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-button px-3 text-sm font-semibold transition-colors",
            isActive(href) ? "bg-surface text-surface-foreground" : "text-primary-foreground/90 hover:bg-primary-foreground/10",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar for phones. */
export function BottomNav({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const isActive = useIsActive();
  const items = itemsFor(role);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, key, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold leading-tight",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-surface")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="max-w-full truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
