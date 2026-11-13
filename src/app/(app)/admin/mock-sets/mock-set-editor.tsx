"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXAMS, type ExamCode } from "@/config/exams";
import { saveMockSet } from "./actions";

type Option = { id: string; title: string; active: boolean };

export function MockSetEditor({
  initial,
  options,
}: {
  initial: { id?: string; exam: ExamCode; name: string; active: boolean; sort_order: number; parts: Record<number, string[]> };
  /** All topics of this exam, per part. */
  options: Record<number, Option[]>;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [active, setActive] = useState(initial.active);
  const [order, setOrder] = useState(initial.sort_order);
  const [parts, setParts] = useState<Record<number, string[]>>(initial.parts);
  const [picker, setPicker] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const titleOf = (part: number, id: string) => options[part]?.find((o) => o.id === id)?.title ?? id;

  function move(part: number, index: number, delta: number) {
    setParts((prev) => {
      const list = [...(prev[part] ?? [])];
      const j = index + delta;
      if (j < 0 || j >= list.length) return prev;
      [list[index], list[j]] = [list[j], list[index]];
      return { ...prev, [part]: list };
    });
  }

  function remove(part: number, index: number) {
    setParts((prev) => ({ ...prev, [part]: (prev[part] ?? []).filter((_, i) => i !== index) }));
  }

  function add(part: number) {
    const id = picker[part];
    if (!id) return;
    setParts((prev) => ({ ...prev, [part]: [...(prev[part] ?? []).filter((x) => x !== id), id] }));
    setPicker((p) => ({ ...p, [part]: "" }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveMockSet({ id: initial.id, exam: initial.exam, name, active, sort_order: order, parts });
      if (res.error) {
        setMessage({
          ok: false,
          text:
            res.error === "required"
              ? t("errors.required")
              : res.error === "duplicateTitle"
                ? t("errors.duplicateTitle")
                : t("errors.generic", { message: res.error }),
        });
        return;
      }
      setMessage({ ok: true, text: t("topic.saved") });
      if (!initial.id && res.id) router.replace(`/admin/mock-sets/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-name">{t("mocks.name")}</Label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-order">{t("mocks.order")}</Label>
          <Input id="m-order" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value) || 0)} />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-primary" />
        {t("mocks.active")}
      </label>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg">{t("mocks.topicsInSet")}</h2>
        {EXAMS[initial.exam].parts.map(({ part }) => {
          const list = parts[part] ?? [];
          const available = (options[part] ?? []).filter((o) => !list.includes(o.id));
          return (
            <fieldset key={part} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
              <legend className="px-1 font-semibold text-primary">{t("stats.part", { part })}</legend>
              {list.length === 0 && <p className="text-sm text-warning">{t("mocks.missingPart", { part })}</p>}
              <ol className="flex flex-col gap-2">
                {list.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-button bg-muted px-3 py-1">
                    <span className="min-w-0 flex-1 py-2">{titleOf(part, id)}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(part, i, -1)} disabled={i === 0} aria-label={t("mocks.moveUp")}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(part, i, 1)}
                      disabled={i === list.length - 1}
                      aria-label={t("mocks.moveDown")}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(part, i)} aria-label={t("mocks.remove")}>
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ol>
              <div className="flex flex-col gap-2 sm:flex-row">
                <NativeSelect
                  aria-label={t("mocks.chooseTopic")}
                  value={picker[part] ?? ""}
                  onChange={(e) => setPicker((p) => ({ ...p, [part]: e.target.value }))}
                >
                  <option value="">{t("mocks.chooseTopic")}</option>
                  {available.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                      {o.active ? "" : ` (${t("topic.disabled")})`}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="button" variant="secondary" onClick={() => add(part)} disabled={!picker[part]}>
                  <Plus aria-hidden />
                  {t("mocks.addTopic")}
                </Button>
              </div>
            </fieldset>
          );
        })}
      </div>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={
            message.ok
              ? "rounded-button bg-surface px-3 py-2 text-sm font-semibold text-surface-foreground"
              : "rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      )}

      <Button type="button" onClick={save} disabled={pending} className="self-start">
        {initial.id ? t("mocks.save") : t("mocks.create")}
      </Button>
    </div>
  );
}
