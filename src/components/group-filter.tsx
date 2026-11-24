import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { groupFilterParams, groupsByTeacher, groupSlotLabel, selectedTeacher, shortTime, type GroupFilterValue, type LessonGroup } from "@/lib/groups";

/**
 * Group filter for admin lists, in two steps so 30+ groups stay tidy:
 * 1) chips with teacher names only ("All groups", "Abduraimov Erkinjon", …);
 * 2) after picking a teacher, that teacher's groups: an "Even days" and an
 *    "Odd days" row of start times.
 * Every chip is a plain link (?teacher= or ?group=), so it works without JavaScript
 * and keeps the other search params (search text, week).
 */
export function GroupFilter({
  groups,
  value,
  path,
  params,
}: {
  groups: LessonGroup[];
  value: GroupFilterValue;
  path: string;
  params: Record<string, string>;
}) {
  const t = useTranslations("admin.reports");
  const tg = useTranslations("groups");
  const day = (p: "even" | "odd") => tg(p);

  const href = (f: GroupFilterValue) => {
    const qs = new URLSearchParams({ ...params, ...groupFilterParams(f) }).toString();
    return qs ? `${path}?${qs}` : path;
  };

  const buckets = groupsByTeacher(groups);
  const openTeacher = selectedTeacher(groups, value);
  const teacherGroups = buckets.find((b) => b.teacher !== null && b.teacher === openTeacher)?.groups ?? [];
  // Old groups (no teacher) are shown as their own chips next to the teachers.
  const oldGroups = buckets.find((b) => b.teacher === null)?.groups ?? [];
  const rows = [
    { key: "even", label: tg("even"), groups: teacherGroups.filter((g) => g.day_pattern === "even") },
    { key: "odd", label: tg("odd"), groups: teacherGroups.filter((g) => g.day_pattern === "odd") },
    { key: "other", label: tg("other"), groups: teacherGroups.filter((g) => !g.day_pattern) },
  ].filter((r) => r.groups.length > 0);

  const allSelected = !value.group && !openTeacher;

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("teacher")} className="flex flex-wrap gap-2">
        <Chip href={href({ group: null, teacher: null })} selected={allSelected}>
          {t("allGroups")}
        </Chip>
        {buckets
          .filter((b) => b.teacher !== null)
          .map((b) => (
            <Chip
              key={b.teacher}
              href={href({ group: null, teacher: b.teacher })}
              selected={b.teacher === openTeacher && !value.group}
              open={b.teacher === openTeacher}
            >
              {b.teacher}
            </Chip>
          ))}
        {oldGroups.map((g) => (
          <Chip key={g.id} href={href({ group: g.id, teacher: null })} selected={g.id === value.group}>
            {g.name}
          </Chip>
        ))}
      </nav>

      {openTeacher && rows.length > 0 && (
        <nav aria-label={`${t("group")}: ${openTeacher}`} className="flex flex-col gap-3 rounded-card border border-border bg-card p-3 sm:p-4">
          {rows.map((r) => (
            <div key={r.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-semibold text-muted-foreground sm:w-28 sm:shrink-0">{r.label}</span>
              <div className="flex flex-wrap gap-2">
                {r.groups.map((g) => (
                  <Chip
                    key={g.id}
                    href={href({ group: g.id, teacher: null })}
                    selected={g.id === value.group}
                    label={`${openTeacher} · ${groupSlotLabel(g, day)}`}
                    small
                  >
                    {r.key === "other" ? groupSlotLabel(g, day) : shortTime(g.start_time)}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

function Chip({
  href,
  selected,
  open = false,
  small = false,
  label,
  children,
}: {
  href: string;
  selected: boolean;
  /** The teacher whose groups are shown below (one of their groups is chosen). */
  open?: boolean;
  small?: boolean;
  /** Full name for screen readers when the chip only shows a time. */
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "page" : undefined}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border-2 text-sm font-semibold transition-colors",
        small ? "min-w-16 justify-center px-3 tabular-nums" : "px-4",
        selected || open ? "border-primary bg-surface text-surface-foreground" : "border-border bg-card text-primary hover:bg-muted",
        open && !selected && "bg-card",
      )}
    >
      {children}
    </Link>
  );
}
