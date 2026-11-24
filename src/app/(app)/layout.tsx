import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { BottomNav, TopNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { CompactFooter, SiteFooter } from "@/components/site-footer";
import { FooterByPage } from "@/components/footer-by-page";
import { Connectivity } from "@/components/offline/connectivity";

// Every page in this group needs a signed-in user who finished first-time setup.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground" style={{ viewTransitionName: "app-header" }}>
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/home" aria-label="Speaking Easy" className="rounded-button">
            <Logo inverted />
          </Link>
          <TopNav role={profile.role} />
        </div>
      </header>
      <Connectivity userId={profile.id} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-12 sm:px-6">{children}</main>
      {/* On phones the fixed bottom tab bar would cover the end of the footer. */}
      <FooterByPage
        full={<SiteFooter className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" />}
        compact={<CompactFooter className="pb-[calc(4rem+env(safe-area-inset-bottom))]" />}
      />
      <BottomNav role={profile.role} />
    </div>
  );
}
