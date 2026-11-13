import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { RecordingsList } from "./recordings-list";

export default async function RecordingsPage() {
  await requireProfile();
  const t = await getTranslations("recordings");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("title")}</h1>
      <RecordingsList />
    </div>
  );
}
