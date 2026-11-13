import { getTranslations } from "next-intl/server";
import { Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export async function ComingSoon({ title, lead }: { title: string; lead?: string }) {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{title}</h1>
        {lead && <p className="text-muted-foreground">{lead}</p>}
      </div>
      <Card>
        <CardContent className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-surface-foreground">
            <Hammer className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-primary">{t("comingSoon")}</p>
            <p className="text-sm text-muted-foreground">{t("comingSoonText")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
