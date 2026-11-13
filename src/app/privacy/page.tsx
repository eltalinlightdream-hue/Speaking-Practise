import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { Logo } from "@/components/logo";

// The full privacy text is written in Step 5.
export default async function PrivacyPage() {
  const t = await getTranslations("landing");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6">
      <Link href="/" aria-label="Speaking Easy" className="self-start">
        <Logo />
      </Link>
      <ComingSoon title={t("privacy")} />
    </div>
  );
}
