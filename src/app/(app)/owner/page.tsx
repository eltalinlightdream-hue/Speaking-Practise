import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { requireOwner } from "@/lib/auth";

export default async function OwnerPage() {
  await requireOwner();
  const t = await getTranslations("owner");
  return <ComingSoon title={t("title")} lead={t("lead")} />;
}
