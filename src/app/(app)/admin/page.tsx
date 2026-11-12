import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  return <ComingSoon title={t("title")} lead={t("lead")} />;
}
