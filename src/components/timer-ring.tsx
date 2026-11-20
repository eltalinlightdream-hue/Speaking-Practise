import { cn } from "@/lib/utils";

function format(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Round countdown timer in the accent colour. Purely visual: the parent owns the time. */
export function TimerRing({
  remaining,
  total,
  label,
  size = 160,
  className,
}: {
  remaining: number;
  total: number;
  label?: string;
  size?: number;
  className?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={label ? `${label}: ${format(remaining)}` : format(remaining)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          className="fill-none stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{format(remaining)}</span>
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
