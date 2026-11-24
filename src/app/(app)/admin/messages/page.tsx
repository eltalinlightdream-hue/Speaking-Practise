import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { GroupFilter } from "@/components/group-filter";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadGroups } from "@/lib/admin/queries";
import { groupFilterParams, groupIdsFor, readGroupFilter, selectedTeacher } from "@/lib/groups";
import { formatDayTime } from "@/lib/format-date";
import { MessageForm } from "./message-form";

// Sending to every student takes a few seconds (Telegram's speed limit).
export const maxDuration = 120;

type Sent = {
  id: string;
  sender_name: string | null;
  audience: string;
  body: string;
  recipients: number;
  delivered: number;
  failed: number;
  created_at: string;
};

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const viewer = await requireAdmin();
  const t = await getTranslations("admin.messages");
  const locale = await getLocale();
  const filter = readGroupFilter(await searchParams);

  const supabase = await createClient();
  const groups = await loadGroups();
  const ids = groupIdsFor(groups, filter);
  const teacher = selectedTeacher(groups, filter);
  const audience = filter.group ? (groups.find((g) => g.id === filter.group)?.name ?? t("allStudents")) : (teacher ?? t("allStudents"));

  const [recipients, history] = await Promise.all([
    supabase.rpc("admin_message_recipients", { p_group_ids: ids }),
    supabase
      .from("telegram_messages")
      .select("id, sender_name, audience, body, recipients, delivered, failed, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const count = recipients.data?.length ?? 0;
  const sent = (history.data ?? []) as Sent[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="who">
        <h2 id="who" className="text-lg">
          {t("step1")}
        </h2>
        <GroupFilter groups={groups.filter((g) => g.active || g.id === filter.group)} value={filter} path="/admin/messages" params={{}} />
        <p className="text-sm">{t("audience", { audience, count })}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="what">
        <h2 id="what" className="text-lg">
          {t("step2")}
        </h2>
        <MessageForm
          recipients={count}
          audience={audience}
          hidden={groupFilterParams({ group: filter.group, teacher })}
          senderName={viewer.full_name ?? "Speaking Easy"}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="history">
        <h2 id="history" className="text-lg">
          {t("history")}
        </h2>
        {sent.length === 0 ? (
          <p className="text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sent.map((m) => (
              <li key={m.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {formatDayTime(new Date(m.created_at), locale, "Asia/Tashkent")} · {m.sender_name ?? "—"} → {m.audience}
                    </p>
                    <p className="line-clamp-4 whitespace-pre-line break-words">{m.body}</p>
                    <p className="text-sm font-semibold text-primary">
                      {t("historyCounts", { delivered: m.delivered, recipients: m.recipients, failed: m.failed })}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
