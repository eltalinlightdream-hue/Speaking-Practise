import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LeaderboardRow = { place: number; display_name: string | null; seconds: number; is_me: boolean };

/** Ranked list of students with their practice minutes. Your own row is highlighted and labelled "You". */
export function LeaderboardList({ rows }: { rows: LeaderboardRow[] }) {
  const t = useTranslations("leaderboard");
  return (
    <Card>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-5 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((row, i) => {
              const minutes = Math.floor(row.seconds / 60);
              // Thicker line before your own row when you are below the top list.
              const gap = i > 0 && row.is_me && row.place - rows[i - 1].place > 1;
              return (
                <li
                  key={`${row.place}-${i}`}
                  className={cn("flex min-h-14 items-center gap-3 px-4 py-2", gap && "border-t-4", row.is_me && "bg-surface")}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      row.place <= 3 ? "bg-accent text-accent-foreground" : "bg-background text-primary",
                    )}
                  >
                    <span className="sr-only">{t("place")} </span>
                    {row.place}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="truncate font-semibold">{row.display_name ?? t("noName")}</span>
                    {row.is_me && <span className="shrink-0 text-sm text-primary">({t("you")})</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-primary">{t("minutes", { minutes })}</span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
