import type { Metadata } from "next";
import { BarChart3, Eye, MousePointerClick, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ViewsChart } from "@/components/dashboard/views-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { AnalyticsEvent, Property } from "@/types/database.types";

export const metadata: Metadata = { title: "Статистик" };

export default async function AnalyticsPage() {
  const { userId } = await requireUser();
  const supabase = await createClient();

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: events }, { data: properties }, { count: leadCount }] = await Promise.all([
    supabase.from("analytics").select("*").eq("agent_id", userId).gte("created_at", since),
    supabase.from("properties").select("*").eq("agent_id", userId),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("agent_id", userId),
  ]);

  const list = (events ?? []) as AnalyticsEvent[];
  const props = (properties ?? []) as Property[];

  const views = list.filter((e) => e.event_type === "view");
  const contacts = list.filter((e) => e.event_type === "contact_click");
  const conversion = views.length ? ((contacts.length / views.length) * 100).toFixed(1) : "0.0";

  // 30-day daily series
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    return { date: key, count: views.filter((v) => v.created_at.slice(0, 10) === key).length };
  });

  const byProperty = props
    .map((p) => ({
      title: p.title,
      total: p.view_count,
      last30: views.filter((v) => v.property_id === p.id).length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const maxTotal = Math.max(1, ...byProperty.map((b) => b.total));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Статистик</h1>
        <p className="mt-1 text-muted-foreground">Сүүлийн 30 хоногийн үзүүлэлт</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Eye} label="Үзэлт (30 хоног)" value={formatNumber(views.length)} />
        <StatCard icon={BarChart3} label="Нийт үзэлт" value={formatNumber(props.reduce((s, p) => s + p.view_count, 0))} />
        <StatCard icon={Users} label="Нийт хүсэлт" value={formatNumber(leadCount ?? 0)} />
        <StatCard icon={MousePointerClick} label="Хөрвөлт" value={`${conversion}%`} hint="үзэлт → холбогдох" />
      </div>

      {views.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Мэдээлэл хараахан алга"
          description="Зараа нийтлээд холбоосоо хуваалцсаны дараа үзэлтийн статистик энд харагдана."
        />
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Өдрийн үзэлт</CardTitle></CardHeader>
            <CardContent><ViewsChart data={daily} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Хамгийн их үзэгдсэн зарууд</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {byProperty.map((row) => (
                <div key={row.title} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="truncate">{row.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatNumber(row.total)} нийт · {row.last30} (30х)
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${(row.total / maxTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
