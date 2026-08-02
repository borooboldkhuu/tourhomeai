import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CreditCard, Eye, TrendingUp, Users } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/utils";
import { PLAN_BY_ID } from "@/lib/constants";
import type { Payment, PlanId } from "@/types/database.types";

export const metadata: Metadata = { title: "Админ" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [users, properties, published, leads, paid, monthPaid, views] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("properties").select("id", { count: "exact", head: true }),
    admin.from("properties").select("id", { count: "exact", head: true }).eq("status", "published"),
    admin.from("leads").select("id", { count: "exact", head: true }),
    admin.from("payments").select("amount_minor").eq("status", "paid"),
    admin.from("payments").select("amount_minor").eq("status", "paid").gte("paid_at", monthStart),
    admin.from("analytics").select("id", { count: "exact", head: true }).eq("event_type", "view"),
  ]);

  const total = (paid.data ?? []).reduce((s, p) => s + Number(p.amount_minor ?? 0), 0) / 100;
  const thisMonth = (monthPaid.data ?? []).reduce((s, p) => s + Number(p.amount_minor ?? 0), 0) / 100;

  const { data: activeSubs } = await admin
    .from("users")
    .select("plan")
    .gt("plan_expires_at", new Date().toISOString());

  const { data: recent } = await admin
    .from("payments")
    .select("*, users(email)")
    .order("created_at", { ascending: false })
    .limit(8);

  const byPlan = (activeSubs ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.plan] = (acc[r.plan] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Тойм</h1>
        <p className="mt-1 text-muted-foreground">Платформын өнөөдрийн байдал</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Хэрэглэгч" value={formatNumber(users.count ?? 0)}
          hint={`${(activeSubs ?? []).length} идэвхтэй багцтай`} />
        <StatCard icon={Building2} label="Зар" value={formatNumber(properties.count ?? 0)}
          hint={`${published.count ?? 0} нийтлэгдсэн`} />
        <StatCard icon={Eye} label="Үзэлт" value={formatNumber(views.count ?? 0)} />
        <StatCard icon={Users} label="Хүсэлт" value={formatNumber(leads.count ?? 0)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={TrendingUp} label="Энэ сарын орлого" value={`₮${formatNumber(thisMonth)}`} />
        <StatCard icon={CreditCard} label="Нийт орлого" value={`₮${formatNumber(total)}`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Идэвхтэй багц</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["m1", "m3", "m12"] as PlanId[]).map((id) => (
            <Card key={id} className="p-5">
              <p className="text-sm text-muted-foreground">
                {PLAN_BY_ID[id]?.name} {PLAN_BY_ID[id]?.badge ?? ""}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{byPlan[id] ?? 0}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Сүүлийн төлбөрүүд</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/payments">Бүгдийг харах</Link>
          </Button>
        </div>
        <Card className="divide-y divide-border">
          {(recent ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Одоогоор төлбөр алга.</p>
          )}
          {((recent ?? []) as unknown as (Payment & { users: { email: string } | null })[]).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.users?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {PLAN_BY_ID[p.plan]?.name ?? p.plan} · {formatDate(p.created_at)}
                </p>
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
      </section>
    </div>
  );
}
