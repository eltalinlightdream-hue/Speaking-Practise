"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ImportSummary = {
  dry_run: boolean;
  topics_created: number;
  topics_updated: number;
  questions_created: number;
  questions_updated: number;
  mock_sets_created: number;
  mock_sets_updated: number;
  problems: string[];
};

export type ImportResult = { summary?: ImportSummary; error?: "invalidJson" | "wrongFormat" | string };

const MAX_BYTES = 5 * 1024 * 1024;

export async function runImport(text: string, dryRun: boolean): Promise<ImportResult> {
  await requireAdmin();
  if (text.length > MAX_BYTES) return { error: "file too large (max 5 MB)" };

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { error: "invalidJson" };
  }
  if (!payload || typeof payload !== "object" || (payload as { format?: unknown }).format !== "speaking-easy-content/v2") {
    return { error: "wrongFormat" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_content", { p_payload: payload, p_dry_run: dryRun });
  if (error) return { error: error.message };
  if (!dryRun) revalidatePath("/admin", "layout");
  return { summary: data as ImportSummary };
}
