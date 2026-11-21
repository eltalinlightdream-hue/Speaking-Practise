import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { CueCardStep } from "@/lib/practice/types";
import { cn } from "@/lib/utils";
import { ExamPictures } from "./exam-pictures";

type Card = Pick<CueCardStep, "title" | "bullets" | "explain" | "style" | "images" | "pointsFor" | "pointsAgainst">;

/**
 * One card, as the student sees it (also the admin preview):
 * - "ielts":     title, "You should say:" bullets, "and explain" line;
 * - "questions": CEFR Part 2, picture and three numbered questions;
 * - "debate":    CEFR Part 3, the statement and two lists, For and Against.
 * Exam text stays in English (lang="en"), like the real exam.
 */
export function CueCardView({ card, className }: { card: Card; className?: string }) {
  const t = useTranslations("practice.session");
  const style = card.style ?? "ielts";

  if (style === "debate") {
    return (
      <div lang="en" className={cn("flex w-full max-w-2xl flex-col gap-3 text-left", className)}>
        <p className="rounded-card border border-border bg-card p-4 text-center text-xl font-semibold text-primary shadow-sm sm:p-5 sm:text-2xl">
          {card.title}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PointList label={t("for")} points={card.pointsFor ?? []} icon={<ThumbsUp className="size-5" aria-hidden />} headClass="bg-surface text-surface-foreground" />
          <PointList label={t("against")} points={card.pointsAgainst ?? []} icon={<ThumbsDown className="size-5" aria-hidden />} headClass="bg-muted text-foreground" />
        </div>
      </div>
    );
  }

  if (style === "questions") {
    return (
      <div lang="en" className={cn("w-full max-w-xl rounded-card border border-border bg-card p-4 text-left shadow-sm sm:p-6", className)}>
        <p className="text-sm font-semibold text-muted-foreground">{card.title}</p>
        {card.images && <ExamPictures pictures={card.images} className="mt-3" />}
        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 text-lg leading-snug font-semibold sm:text-xl">
          {card.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div lang="en" className={cn("w-full max-w-xl rounded-card border border-border bg-card p-6 text-left shadow-sm", className)}>
      <p className="text-xl font-semibold text-primary sm:text-2xl">{card.title}</p>
      {card.images && <ExamPictures pictures={card.images} className="mt-3" />}
      <p className="mt-4 font-semibold">{t("youShouldSay")}</p>
      <ul className="mt-1 list-disc pl-6">
        {card.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {card.explain && <p className="mt-1">{card.explain}</p>}
    </div>
  );
}

function PointList({ label, points, icon, headClass }: { label: string; points: string[]; icon: ReactNode; headClass: string }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <h2 className={cn("flex items-center gap-2 px-4 py-2 text-base font-semibold tracking-wide uppercase", headClass)}>
        {icon}
        {label}
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 py-3 pr-4 pl-8">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}
