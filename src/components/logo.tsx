import { cn } from "@/lib/utils";

// Simple mark: a speech bubble with sound waves.
// `inverted` is for dark backgrounds (the Forest top bar).
export function Logo({
  className,
  withText = true,
  inverted = false,
  text = "Speaking Easy",
}: {
  className?: string;
  withText?: boolean;
  inverted?: boolean;
  text?: string;
}) {
  const bubble = inverted ? "fill-primary-foreground" : "fill-primary";
  const waves = inverted ? "stroke-primary" : "stroke-surface";
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", inverted ? "text-primary-foreground" : "text-primary", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect x="2" y="3" width="28" height="22" rx="8" className={bubble} />
        <path d="M9 24 L9 30 L15 24 Z" className={bubble} />
        <path d="M10 14v0M14 10.5v7M18 8v12M22 11.5v5" className={waves} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </svg>
      {withText && <span className="text-lg leading-none">{text}</span>}
    </span>
  );
}
