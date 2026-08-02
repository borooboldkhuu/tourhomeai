import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/database.types";

/**
 * Guards every admin route. Non-admins are sent back to their dashboard
 * rather than shown a 403, so the section stays invisible.
 */
export async function requireAdmin(): Promise<UserProfile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!profile || (profile as UserProfile).role !== "admin") redirect("/dashboard");

  return profile as UserProfile;
}
