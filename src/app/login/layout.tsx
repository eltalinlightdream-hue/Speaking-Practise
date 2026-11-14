import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

// Shared frame for /login, /login/join and /login/owner.
export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="Speaking Easy">
          <Logo className="text-primary" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 sm:items-center sm:pt-0">{children}</main>
      <SiteFooter className="mt-12" />
    </div>
  );
}
