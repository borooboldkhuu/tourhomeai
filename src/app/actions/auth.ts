"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, profileSchema } from "@/lib/validations";
import { absoluteUrl } from "@/lib/utils";

export type ActionState = { error?: string; success?: string } | null;

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "И-мэйл эсвэл нууц үг буруу байна" };

  const next = (formData.get("next") as string) || "/dashboard";
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        company_name: parsed.data.companyName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) return { error: "Энэ и-мэйл аль хэдийн бүртгэлтэй байна" };
    return { error: error.message };
  }

  // Email confirmation ON → no session yet.
  if (!data.session) {
    return { success: "Баталгаажуулах холбоосыг и-мэйлээр илгээлээ. Шалгана уу." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    company_name: formData.get("company_name"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("users").update(parsed.data).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Хадгаллаа" };
}

/* ------------------------------------------------------- password recovery -- */

/** Sends the recovery link. Always reports success so nobody can probe emails. */
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Зөв и-мэйл хаяг оруулна уу" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl("/auth/callback?next=/reset-password"),
  });

  return {
    success: "Хэрэв энэ хаягаар бүртгэлтэй бол сэргээх холбоос илгээгдлээ. И-мэйлээ шалгана уу.",
  };
}

/** Runs on /reset-password, where the recovery link has already signed the user in. */
export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) return { error: "Нууц үг доод тал нь 6 тэмдэгт байна" };
  if (password !== confirm) return { error: "Нууц үг хоорондоо таарахгүй байна" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сэргээх холбоосны хугацаа дууссан байна. Дахин хүсэлт илгээнэ үү." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Нууц үг шинэчлэгдлээ." };
}
