"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, FileAudio, Pencil, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VoicePreviewButton } from "@/components/admin/voice-preview-button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { setQuestionActive, setQuestionAudio, updateQuestionText } from "./actions";

type Question = { id: string; topic_id: string; text: string; audio_url: string | null; active: boolean };

export function QuestionList({ questions }: { questions: Question[] }) {
  const t = useTranslations("admin");
  if (questions.length === 0) return <p className="text-muted-foreground">{t("topic.noQuestions")}</p>;
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
      {questions.map((q, i) => (
        <QuestionRow key={q.id} q={q} index={i + 1} />
      ))}
    </ol>
  );
}

function QuestionRow({ q, index }: { q: Question; index: number }) {
  const t = useTranslations("admin");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function save() {
    startTransition(async () => {
      const res = await updateQuestionText(q.id, text);
      if (res.error) setError(t("errors.generic", { message: res.error }));
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${q.topic_id}/${q.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("question-audio").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("question-audio").getPublicUrl(path);
      const res = await setQuestionAudio(q.id, data.publicUrl);
      if (res.error) throw new Error(res.error);
    } catch (e) {
      setError(t("errors.generic", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li className={cn("flex flex-col gap-2 px-4 py-3", !q.active && "bg-muted")}>
      <div className="flex items-start gap-3">
        <span className="mt-2.5 w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index}.</span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {editing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={text} onChange={(e) => setText(e.target.value)} aria-label={t("question.edit")} autoFocus />
              <div className="flex gap-2">
                <Button type="button" onClick={save} disabled={pending}>
                  {t("question.save")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setText(q.text);
                  }}
                >
                  {t("question.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p className={cn("py-2", !q.active && "text-muted-foreground line-through")}>{q.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!q.active && <Badge variant="destructive">{t("question.disabled")}</Badge>}
            {q.audio_url && (
              <Badge variant="surface">
                <FileAudio className="size-3.5" aria-hidden />
                {t("question.hasAudio")}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end">
          <VoicePreviewButton text={q.text} audioUrl={q.audio_url} />
          {!editing && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label={t("question.edit")} title={t("question.edit")}>
              <Pencil aria-hidden />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            onClick={() => startTransition(() => setQuestionActive(q.id, !q.active))}
            aria-label={q.active ? t("topic.disable") : t("topic.restore")}
            title={q.active ? t("topic.disable") : t("topic.restore")}
          >
            {q.active ? <EyeOff aria-hidden /> : <RotateCcw aria-hidden />}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-9">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          id={`audio-${q.id}`}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          {uploading ? t("question.uploading") : t("question.uploadAudio")}
        </Button>
        {q.audio_url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(async () => void (await setQuestionAudio(q.id, null)))}
          >
            <X aria-hidden />
            {t("question.removeAudio")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="pl-9 text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
