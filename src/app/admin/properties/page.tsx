import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminPropertyRow } from "@/components/admin/property-row";
import type { Property } from "@/types/database.types";

export const metadata: Metadata = { title: "Зарууд · Админ" };
export const dynamic = "force-dynamic";

type Row = Property & { users: { email: string } | null };

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("properties")
    .select("*, users(email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%,slug.ilike.%${q}%`);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Бүх зар</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} зар</p>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q ?? ""} placeholder="Гарчиг, байршил, slug-аар хайх…" />
      </form>

      <Card className="divide-y divide-border">
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Илэрц алга.</p>}
        {rows.map((p) => <AdminPropertyRow key={p.id} property={p} ownerEmail={p.users?.email ?? "—"} />)}
      </Card>
    </div>
  );
}
