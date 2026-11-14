"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Phones: the full footer (names, links) only on the home page; every other page
 * gets the one-line footer so it does not take a whole screen of scrolling.
 * Computers (md and up): always the full footer.
 */
export function FooterByPage({ full, compact }: { full: ReactNode; compact: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/home") return full;
  return (
    <>
      <div className="md:hidden">{compact}</div>
      <div className="hidden md:block">{full}</div>
    </>
  );
}
