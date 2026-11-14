"use client";

import { createContext, use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, MoreVertical, PencilLine, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GroupSelect } from "@/components/group-select";
import type { LessonGroup } from "@/lib/groups";
import { deleteStudentFromList, editStudentFromList, type RowResult } from "./actions";

// The group list is sent to the browser once for the whole list, not once per row.
const GroupsContext = createContext<LessonGroup[]>([]);

export function StudentMenuGroups({ groups, children }: { groups: LessonGroup[]; children: React.ReactNode }) {
  return <GroupsContext value={groups}>{children}</GroupsContext>;
}

type Dialogs = "name" | "group" | "delete" | null;

/**
 * ⋮ next to a name in the Students list: change name, change group, delete.
 * Items the viewer may not use are not shown (the database checks again).
 */
export function StudentRowMenu({
  userId,
  displayName,
  fullName,
  groupId,
  canEdit,
  canDelete,
}: {
  userId: string;
  displayName: string;
  fullName: string;
  groupId: string | null;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("admin.students");
  const [open, setOpen] = useState<Dialogs>(null);
  if (!canEdit && !canDelete) return <span className="size-11 shrink-0" aria-hidden />;

  const close = () => setOpen(null);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("menu", { name: displayName })} title={t("menuShort")}>
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <>
              <DropdownMenuItem onSelect={() => setOpen("name")}>
                <PencilLine aria-hidden />
                {t("changeName")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpen("group")}>
                <Users aria-hidden />
                {t("changeGroup")}
              </DropdownMenuItem>
            </>
          )}
          {canEdit && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
              <Trash2 aria-hidden />
              {t("deleteButton")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open !== null} onOpenChange={(o) => !o && close()}>
        {open === "name" && <NameDialog userId={userId} fullName={fullName} groupId={groupId} onDone={close} />}
        {open === "group" && <GroupDialog userId={userId} displayName={displayName} fullName={fullName} groupId={groupId} onDone={close} />}
        {open === "delete" && <DeleteDialog userId={userId} displayName={displayName} onDone={close} />}
      </Dialog>
    </>
  );
}

function useSave(onDone: () => void) {
  const t = useTranslations("admin.students");
  const to = useTranslations("onboarding");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<RowResult>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onDone();
        router.refresh();
      } else setError(res.error === "name" ? to("errorName") : t("error", { message: res.message ?? "" }));
    });
  return { pending, error, run };
}

function ErrorText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {text}
    </p>
  );
}

function Actions({ pending, submit, destructive = false, disabled = false }: { pending: boolean; submit: React.ReactNode; destructive?: boolean; disabled?: boolean }) {
  const ts = useTranslations("settings");
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
      <DialogClose asChild>
        <Button type="button" variant="outline" disabled={pending}>
          {ts("deleteCancel")}
        </Button>
      </DialogClose>
      <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending || disabled}>
        {submit}
      </Button>
    </div>
  );
}

function NameDialog({ userId, fullName, groupId, onDone }: { userId: string; fullName: string; groupId: string | null; onDone: () => void }) {
  const t = useTranslations("admin.students");
  const to = useTranslations("onboarding");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");
  const { pending, error, run } = useSave(onDone);
  const [name, setName] = useState(fullName);
  return (
    <DialogContent closeLabel={ts("deleteCancel")}>
      <DialogTitle>{t("changeName")}</DialogTitle>
      <DialogDescription className="sr-only">{t("changeNameHelp")}</DialogDescription>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => editStudentFromList(userId, name, groupId));
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`name-${userId}`}>{to("fullName")}</Label>
          <Input id={`name-${userId}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={100} aria-invalid={!!error || undefined} autoFocus />
        </div>
        <ErrorText text={error} />
        <Actions pending={pending} submit={pending ? tc("saving") : tc("save")} />
      </form>
    </DialogContent>
  );
}

function GroupDialog({
  userId,
  displayName,
  fullName,
  groupId,
  onDone,
}: {
  userId: string;
  displayName: string;
  fullName: string;
  groupId: string | null;
  onDone: () => void;
}) {
  const t = useTranslations("admin.students");
  const tc = useTranslations("common");
  const tr = useTranslations("admin.reports");
  const ts = useTranslations("settings");
  const groups = use(GroupsContext);
  const { pending, error, run } = useSave(onDone);
  const [group, setGroup] = useState(groupId ?? "");
  const shown = groups.filter((g) => g.active || g.id === groupId);
  return (
    <DialogContent closeLabel={ts("deleteCancel")}>
      <DialogTitle>{t("changeGroup")}</DialogTitle>
      <DialogDescription>{displayName}</DialogDescription>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => editStudentFromList(userId, fullName, group || null));
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`group-${userId}`}>{t("group")}</Label>
          <GroupSelect id={`group-${userId}`} groups={shown} placeholder={tr("noGroup")} value={group} onChange={(e) => setGroup(e.target.value)} />
        </div>
        {!fullName && <ErrorText text={t("needNameFirst")} />}
        <ErrorText text={error} />
        <Actions pending={pending} submit={pending ? tc("saving") : tc("save")} disabled={!fullName} />
      </form>
    </DialogContent>
  );
}

function DeleteDialog({ userId, displayName, onDone }: { userId: string; displayName: string; onDone: () => void }) {
  const t = useTranslations("admin.students");
  const ts = useTranslations("settings");
  const { pending, error, run } = useSave(onDone);
  const [checked, setChecked] = useState(false);
  return (
    <DialogContent closeLabel={ts("deleteCancel")} role="alertdialog">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-destructive">{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription className="text-foreground">{t("deleteConfirmText", { name: displayName })}</DialogDescription>
        </div>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => deleteStudentFromList(userId, checked));
        }}
      >
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="size-5 shrink-0 accent-destructive" />
          {ts("deleteConfirmCheck")}
        </label>
        <ErrorText text={error} />
        <Actions
          pending={pending}
          destructive
          disabled={!checked}
          submit={
            <>
              <Trash2 aria-hidden />
              {t("deleteConfirmButton")}
            </>
          }
        />
      </form>
    </DialogContent>
  );
}
