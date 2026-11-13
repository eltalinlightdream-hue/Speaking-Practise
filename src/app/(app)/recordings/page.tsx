import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export default async function RecordingsPage() {
  const t = await getTranslations("nav");
  return <ComingSoon title={t("recordings")} />;
}
