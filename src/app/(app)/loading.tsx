// Shown instantly when a link is tapped, while the server prepares the next
// page. Without it the old page stayed on screen and the app felt frozen.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-2/3 max-w-xs skeleton rounded-button" />
      <div className="h-24 w-full skeleton rounded-card" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 skeleton rounded-card" />
        <div className="h-40 skeleton rounded-card" />
      </div>
    </div>
  );
}
