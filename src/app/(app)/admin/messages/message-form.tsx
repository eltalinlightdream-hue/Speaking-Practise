"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { sendMessage, type SendState } from "./actions";
import { MAX_LENGTH } from "./limits";

const DRAFT_KEY = "admin-message-draft";

/**
 * Write a message, send a test to yourself, then send it to the chosen students.
 * Sending to students needs a second tap ("Yes, send"). The draft is kept in this
 * browser tab, so changing the audience (a page link) does not lose the text.
 */
export function MessageForm({
  recipients,
  audience,
  hidden,
  senderName,
}: {
  recipients: number;
  audience: string;
  hidden: Record<string, string>;
  senderName: string;
}) {
  const t = useTranslations("admin.messages");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<SendState, FormData>(async (prev, fd) => {
    const next = await sendMessage(prev, fd);
    setConfirming(false);
    if (next.done && !next.done.test) {
      setBody("");
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
    }
    return next;
  }, {});

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved draft once after the page opens
      if (saved) setBody(saved);
    } catch {}
  }, []);

  const change = (value: string) => {
    setBody(value);
    try {
      sessionStorage.setItem(DRAFT_KEY, value);
    } catch {}
  };

  const empty = body.trim().length === 0;
  const tooLong = body.length > MAX_LENGTH;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">{t("messageLabel")}</Label>
        <Textarea
          id="body"
          name="body"
          rows={6}
          value={body}
          onChange={(e) => change(e.target.value)}
          placeholder={t("placeholder")}
          aria-describedby="body-help"
          aria-invalid={tooLong || undefined}
        />
        <p id="body-help" className={tooLong ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {t("help", { name: senderName })} · {body.length} / {MAX_LENGTH}
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t(`errors.${state.error}`)}
          {state.message ? ` (${state.message})` : ""}
        </p>
      )}
      {state.done && (
        <p role="status" className="flex items-start gap-2 rounded-card bg-surface p-3 text-sm font-semibold text-surface-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          {state.done.test
            ? state.done.delivered
              ? t("testSent")
              : t("testFailed")
            : t("sent", { delivered: state.done.delivered, failed: state.done.failed })}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-card border border-primary/30 bg-card p-4" role="group" aria-label={t("confirmTitle")}>
          <p className="font-semibold text-primary">{t("confirmTitle")}</p>
          <p className="text-sm">{t("confirmText", { count: recipients, audience })}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="mode" value="send" disabled={pending}>
              <Send aria-hidden />
              {pending ? t("sending") : t("confirmYes")}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" disabled={empty || tooLong || recipients === 0 || pending} onClick={() => setConfirming(true)}>
            <Send aria-hidden />
            {t("sendTo", { count: recipients })}
          </Button>
          <Button type="submit" name="mode" value="test" variant="outline" disabled={empty || tooLong || pending}>
            {pending ? t("sending") : t("sendTest")}
          </Button>
        </div>
      )}
    </form>
  );
}
