import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GrantPlanForm } from "@/components/admin/grant-plan-form";
import { UserRow } from "@/components/admin/user-row";
import type { UserProfile } from "@/types/database.types";

export const metadata: Metadata = { title: "Хэрэглэгчид · Админ" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const admin = createAdminClient();

  let query = admin.from("users").select("*").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,company_name.ilike.%${q}%`);

  const { data } = await query;
  const users = (data ?? []) as UserProfile[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Хэрэглэгчид</h1>
        <p className="mt-1 text-muted-foreground">{users.length} бүртгэл</p>
      </div>

      <GrantPlanForm />

      <form className="max-w-sm">
        <Input name="q" defaultValue={q ?? ""} placeholder="И-мэйл, нэр, байгууллагаар хайх…" />
      </form>

      <Card className="divide-y divide-border">
        {users.length === 0 && <p className="p-6 text-sm text-muted-foreground">Илэрц алга.</p>}
        {users.map((u) => <UserRow key={u.id} user={u} />)}
      </Card>
    </div>
  );
}
