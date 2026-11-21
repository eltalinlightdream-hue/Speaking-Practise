"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", key: "overview", exact: true },
  { href: "/admin/reports", key: "reports" },
  { href: "/admin/students", key: "students" },
  { href: "/admin/content", key: "content" },
  { href: "/admin/add", key: "add" },
  { href: "/admin/mock-sets", key: "mockSets" },
  { href: "/admin/import-export", key: "importExport" },
] as const;

export function AdminTabs() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-[3px] px-3 text-sm font-semibold transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
