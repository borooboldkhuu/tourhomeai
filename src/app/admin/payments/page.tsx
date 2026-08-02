import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_BY_ID } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import type { Payment } from "@/types/database.types";

export const metadata: Metadata = { title: "Төлбөр · Админ" };
export const dynamic = "force-dynamic";

type Row = Payment & { users: { email: string; full_name: string | null } | null };

export default async function AdminPaymentsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("payments")
    .select("*, users(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Row[];
  const paid = rows.filter((r) => r.status === "paid");
  const revenue = paid.reduce((s, r) => s + Number(r.amount_minor), 0) / 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Төлбөр</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} гүйлгээ · {paid.length} амжилттай · нийт ₮{formatNumber(revenue)}
        </p>
      </div>

      <Card className="divide-y divide-border">
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Гүйлгээ алга.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.users?.email ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {PLAN_BY_ID[p.plan]?.name ?? p.plan} · {formatDate(p.created_at)}
                {p.paid_at ? ` · төлсөн ${formatDate(p.paid_at)}` : ""}
                {p.livemode ? "" : " · test"}
              </p>
              {p.payment_intent_id && (
                <p className="truncate font-mono text-[11px] text-muted-foreground">{p.payment_intent_id}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-medium">₮{formatNumber(Number(p.amount_minor) / 100)}</span>
              <Badge variant={p.status === "paid" ? "success" : p.status === "pending" ? "muted" : "warning"}>
                {p.status}
              </Badge>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
