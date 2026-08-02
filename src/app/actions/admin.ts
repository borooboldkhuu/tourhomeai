"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import type { PlanId, PropertyStatus } from "@/types/database.types";
import { DEMO_SETTINGS_KEY, type DemoRoom } from "@/lib/site-settings";

export type AdminState = { error?: string; success?: string } | null;

/** Give an account a paid plan. Extends an existing one rather than replacing it. */
export async function grantPlan(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const plan = String(formData.get("plan") ?? "") as PlanId;
  if (!email) return { error: "И-мэйл оруулна уу" };
  if (!["m1", "m3", "m12"].includes(plan)) return { error: "Багц буруу байна" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("activate_plan", {
    p_email: email,
    p_plan: plan,
    p_note: "admin",
  });

  if (error) return { error: error.message.replace("no user with email", "Ийм и-мэйлтэй хэрэглэгч алга:") };

  revalidatePath("/admin/users");
  return { success: `${email} — багц ${data ? new Date(String(data)).toLocaleDateString("mn-MN") : ""} хүртэл идэвхжлээ` };
}

/** Cancel a subscription immediately. */
export async function revokePlan(email: string): Promise<AdminState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_plan", { p_email: email });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: `${email} — багц цуцлагдлаа` };
}

/** Moderation: take a listing off the public site or put it back. */
export async function setPropertyStatus(id: string, status: PropertyStatus): Promise<AdminState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("properties")
    .update({ status, ...(status === "published" ? {} : { published_at: null }) })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/properties");
  return { success: status === "published" ? "Нийтэллээ" : "Нийтлэлээс хаслаа" };
}

/** Promote or demote an account. */
export async function setRole(userId: string, role: "agent" | "company" | "admin"): Promise<AdminState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "Эрх шинэчлэгдлээ" };
}

/* --------------------------------------------------------- landing sample -- */

/** Replaces the 360° rooms shown on the landing page. */
export async function saveDemoRooms(rooms: DemoRoom[]): Promise<AdminState> {
  const profile = await requireAdmin();

  const clean = rooms
    .filter((r) => r.url && r.name.trim())
    .map((r, i) => ({
      key: (r.key || `room-${i}`).trim(),
      name: r.name.trim(),
      url: r.url,
    }));

  if (clean.length === 0) return { error: "Дор хаяж нэг өрөө үлдээнэ үү" };

  const admin = createAdminClient();
  const { error } = await admin.from("site_settings").upsert(
    { key: DEMO_SETTINGS_KEY, value: { rooms: clean }, updated_by: profile.id },
    { onConflict: "key" },
  );
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/landing");
  return { success: "Нүүр хуудасны жишээ шинэчлэгдлээ" };
}

/** Puts the bundled sample back. */
export async function resetDemoRooms(): Promise<AdminState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("site_settings").delete().eq("key", DEMO_SETTINGS_KEY);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin/landing");
  return { success: "Анхны жишээ сэргээгдлээ" };
}
