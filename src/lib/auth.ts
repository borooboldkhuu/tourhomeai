import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/database.types";

/** Returns the signed-in user + profile, or redirects to /login. */
export async function requireUser(): Promise<{ userId: string; profile: UserProfile }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (!profile) {
    // Trigger may not have fired (e.g. pre-existing user) — self-heal.
    const { data: created } = await supabase
      .from("users")
      .insert({ id: user.id, email: user.email!, full_name: user.user_metadata?.full_name ?? null })
      .select("*")
      .single();
    return { userId: user.id, profile: created as unknown as UserProfile };
  }

  return { userId: user.id, profile: profile as UserProfile };
}
