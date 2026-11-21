import { ViewTransition } from "react";

// A template (unlike a layout) is created fresh on every page change, so the
// ViewTransition below sees the old page leave and the new page arrive and the
// browser animates between them (a short fade + slide, see globals.css).
// Browsers without the View Transitions API simply switch pages as before.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
