"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadSchema } from "@/lib/validations";
import type { LeadStatus } from "@/types/database.types";

export type LeadState = { error?: string; success?: string } | null;

/** Public: called from the tour page by anonymous visitors. */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const parsed = leadSchema.safeParse({
    propertyId: formData.get("propertyId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  // Only accept leads for published properties.
  const { data: property } = await admin
    .from("properties")
    .select("id, agent_id, status")
    .eq("id", parsed.data.propertyId)
    .single();

  if (!property || property.status !== "published") return { error: "Зар олдсонгүй" };

  const { error } = await admin.from("leads").insert({
    property_id: property.id,
    agent_id: property.agent_id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    message: parsed.data.message || null,
    source: "tour_page",
  });
  if (error) return { error: "Илгээхэд алдаа гарлаа. Дахин оролдоно уу." };

  await admin.from("analytics").insert({
    property_id: property.id,
    agent_id: property.agent_id,
    event_type: "contact_click",
  });

  return { success: "Хүсэлт илгээгдлээ. Зуучлагч тантай удахгүй холбогдоно." };
}

/** Dashboard: agent updates the pipeline stage. */
export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("leads").update({ status }).eq("id", leadId).eq("agent_id", user.id);
  revalidatePath("/dashboard/leads");
}

export async function deleteLead(leadId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("leads").delete().eq("id", leadId).eq("agent_id", user.id);
  revalidatePath("/dashboard/leads");
}
