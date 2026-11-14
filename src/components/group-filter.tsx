"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { GroupSelect } from "@/components/group-select";
import type { LessonGroup } from "@/lib/groups";

/**
 * Group filter for admin lists: picking a group opens the same page with
 * ?group=<id> (keeping the other search params). Works for 30+ groups on a phone.
 */
export function GroupFilter({
  groups,
  value,
  path,
  params,
}: {
  groups: LessonGroup[];
  value: string | null;
  path: string;
  params: Record<string, string>;
}) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  return (
    <div className="flex max-w-md flex-col gap-2">
      <Label htmlFor="group-filter">{t("group")}</Label>
      <GroupSelect
        id="group-filter"
        groups={groups}
        placeholder={t("allGroups")}
        value={value ?? ""}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          if (e.target.value) p.set("group", e.target.value);
          else p.delete("group");
          const qs = p.toString();
          router.push(qs ? `${path}?${qs}` : path);
        }}
      />
    </div>
  );
}
