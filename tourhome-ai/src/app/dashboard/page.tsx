import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Eye, Plus, Rotate3d, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { PropertyCard } from "@/components/dashboard/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Property, Lead } from "@/types/database.types";

export const metadata: Metadata = { title: "Хяналтын самбар" };

export default async function DashboardPage() {
  const { userId, profile } = await requireUser();
  const entitlement = getEntitlement(profile);
  const supabase = await createClient();

  const [{ data: properties }, { data: leads }, { count: tourCount }] = await Promise.all([
    supabase.from("properties").select("*").eq("agent_id", userId).order("created_at", { ascending: false }),
    supabase.from("leads").select("*").eq("agent_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("property_tours").select("id", { count: "exact", head: true }),
  ]);

  const list = (properties ?? []) as Property[];
  const recentLeads = (leads ?? []) as Lead[];
  const totalViews = list.reduce((sum, p) => sum + p.view_count, 0);
  const published = list.filter((p) => p.status === "published").length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Сайн байна уу, {profile.full_name?.split(" ")[0] ?? "зуучлагч"}
        </h1>
        <p className="mt-1 text-muted-foreground">Өнөөдрийн байдлаар таны зарын тойм.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Нийт зар" value={list.length} hint={`${published} нийтлэгдсэн`} />
        <StatCard icon={Eye} label="Нийт үзэлт" value={totalViews} />
        <StatCard icon={Rotate3d} label="360° өрөө" value={tourCount ?? 0} />
        <StatCard icon={Users} label="Хүсэлт" value={recentLeads.length} hint="сүүлийн 5" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Сүүлийн зарууд</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/properties">Бүгдийг харах</Link>
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Одоогоор зар алга"
            description="Эхний зараа үүсгээд, зураг оруулаад 360° тураа хормын дотор бэлдээрэй."
            action={
              <Button asChild className="mt-2">
                <Link href="/dashboard/properties/new"><Plus /> Шинэ зар үүсгэх</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.slice(0, 6).map((p) => <PropertyCard key={p.id} property={p} paused={!entitlement.toursLive} />)}
          </div>
        )}
      </section>

      {recentLeads.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Сүүлийн хүсэлтүүд</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/leads">Бүгдийг харах</Link>
            </Button>
          </div>
          <Card className="divide-y divide-border">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{lead.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{lead.phone}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
