"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/input";
import { groupSlotLabel, groupsByTeacher, type LessonGroup } from "@/lib/groups";

type Props = Omit<ComponentProps<"select">, "children"> & {
  groups: LessonGroup[];
  /** First option with value "" (e.g. "Choose your group" or "All groups"). */
  placeholder?: string;
  placeholderDisabled?: boolean;
};

/** A lesson group dropdown: one section per teacher, then "Even days · 08:00" etc. */
export function GroupSelect({ groups, placeholder, placeholderDisabled = false, ...props }: Props) {
  const t = useTranslations("groups");
  const day = (p: "even" | "odd") => t(p);
  return (
    <NativeSelect {...props}>
      {placeholder !== undefined && (
        <option value="" disabled={placeholderDisabled}>
          {placeholder}
        </option>
      )}
      {groupsByTeacher(groups).map((b) => (
        <optgroup key={b.teacher ?? "other"} label={b.teacher ?? t("other")}>
          {b.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {groupSlotLabel(g, day)}
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  );
}
