import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadRow } from "@/components/dashboard/lead-row";
import { Card } from "@/components/ui/card";
import type { Lead } from "@/types/database.types";

export const metadata: Metadata = { title: "Хүсэлтүүд" };

type LeadWithProperty = Lead & { properties: { title: string; slug: string } | null };

export default async function LeadsPage() {
  const { userId } = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("*, properties(title, slug)")
    .eq("agent_id", userId)
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as unknown as LeadWithProperty[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Хүсэлтүүд</h1>
        <p className="mt-1 text-muted-foreground">
          Танилцуулга хуудсаар дамжуулан ирсэн {leads.length} хүсэлт
        </p>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Хүсэлт байхгүй"
          description="Зараа нийтэлж холбоосоо хуваалцсаны дараа сонирхогчдын хүсэлт энд харагдана."
        />
      ) : (
        <Card className="divide-y divide-border">
          {leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} propertyTitle={lead.properties?.title ?? "—"} />
          ))}
        </Card>
      )}
    </div>
  );
}
