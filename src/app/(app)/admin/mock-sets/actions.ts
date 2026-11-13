"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isExamCode } from "@/config/exams";

export type MockSetInput = {
  id?: string;
  exam: string;
  name: string;
  active: boolean;
  sort_order: number;
  /** Topic ids in order, per part. */
  parts: Record<number, string[]>;
};

export async function saveMockSet(input: MockSetInput): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  if (!isExamCode(input.exam)) return { error: "invalid exam" };
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return { error: "required" };

  const supabase = await createClient();
  let id = input.id;
  if (id) {
    const { error } = await supabase
      .from("mock_sets")
      .update({ name, active: input.active, sort_order: input.sort_order })
      .eq("id", id);
    if (error) return { error: error.code === "23505" ? "duplicateTitle" : error.message };
  } else {
    const { data, error } = await supabase
      .from("mock_sets")
      .insert({ exam: input.exam, name, active: input.active, sort_order: input.sort_order })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? "duplicateTitle" : error.message };
    id = data.id;
  }

  // Replace the topic list.
  const rows = Object.entries(input.parts).flatMap(([part, ids]) =>
    ids.map((topic_id, i) => ({ mock_set_id: id!, topic_id, part: Number(part), sort_order: i + 1 })),
  );
  const del = await supabase.from("mock_set_topics").delete().eq("mock_set_id", id!);
  if (del.error) return { error: del.error.message };
  if (rows.length) {
    const ins = await supabase.from("mock_set_topics").insert(rows);
    if (ins.error) return { error: ins.error.message };
  }

  revalidatePath("/admin", "layout");
  return { id };
}

export async function setMockSetActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("mock_sets").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}
