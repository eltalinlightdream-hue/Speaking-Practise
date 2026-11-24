import Image from "next/image";
import type { Picture } from "@/lib/practice/types";
import { cn } from "@/lib/utils";

/**
 * The pictures of a CEFR question or card: two side by side (Part 1.2, even
 * on small phones, like the real exam) or one picture (Part 2, at most 28rem wide
 * so the questions and the timer stay on the screen).
 * The files are already small WebP pictures, so Next.js does not resize them.
 */
export function ExamPictures({ pictures, className }: { pictures: Picture[]; className?: string }) {
  if (pictures.length === 0) return null;
  return (
    <div className={cn("grid w-full gap-2 sm:gap-3", pictures.length > 1 ? "grid-cols-2" : "mx-auto max-w-md grid-cols-1", className)}>
      {pictures.map((p, i) => (
        <Image
          key={`${p.url}-${i}`}
          src={p.url}
          alt={p.alt}
          width={960}
          height={640}
          unoptimized
          priority
          className="aspect-[3/2] h-auto w-full rounded-card border border-border bg-muted object-cover"
        />
      ))}
    </div>
  );
}
