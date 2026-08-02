"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { leadSchema } from "@/lib/validations";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { leadEmail, sendMail } from "@/lib/mail";
import { absoluteUrl } from "@/lib/utils";
import type { LeadStatus } from "@/types/database.types";

export type LeadState = { error?: string; success?: string } | null;

/** Public: called from the tour page by anonymous visitors. */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  // Bots fill in every field they can see; humans never see this one.
  if (String(formData.get("website") ?? "")) {
    return { success: "Хүсэлт илгээгдлээ. Зуучлагч тантай удахгүй холбогдоно." };
  }

  const ip = clientIp(await headers());
  if (!(await allowRequest(`lead:${ip}`, 5, 3600))) {
    return { error: "Хэт олон хүсэлт илгээлээ. 1 цагийн дараа дахин оролдоно уу." };
  }

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
    .select("id, agent_id, status, title, slug")
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

  // Tell the agent straight away — a lead that sits unseen for a day is lost.
  const { data: agent } = await admin
    .from("users")
    .select("email, full_name")
    .eq("id", property.agent_id)
    .single();

  if (agent?.email) {
    void sendMail({
      to: agent.email,
      subject: `Шинэ хүсэлт · ${property.title ?? "зар"}`,
      replyTo: parsed.data.email || undefined,
      html: leadEmail({
        agentName: agent.full_name ?? "",
        propertyTitle: property.title ?? "",
        propertyUrl: absoluteUrl(`/tour/${property.slug ?? ""}`),
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        message: parsed.data.message || null,
      }),
    });
  }

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
