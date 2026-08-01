import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { PropertyCard } from "@/components/dashboard/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Property } from "@/types/database.types";

export const metadata: Metadata = { title: "Зарууд" };

export default async function PropertiesPage() {
  const { userId, profile } = await requireUser();
  const entitlement = getEntitlement(profile);
  const supabase = await createClient();

  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("agent_id", userId)
    .order("created_at", { ascending: false });

  const list = (data ?? []) as Property[];
  const groups = {
    all: list,
    published: list.filter((p) => p.status === "published"),
    draft: list.filter((p) => p.status === "draft"),
    archived: list.filter((p) => p.status === "archived"),
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Зарууд</h1>
          <p className="mt-1 text-muted-foreground">Нийт {list.length} зар</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/properties/new"><Plus /> Шинэ зар</Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Зар байхгүй байна"
          description="Эхний зараа үүсгээд зураг, 360° панорамаа байршуулна уу."
          action={
            <Button asChild className="mt-2">
              <Link href="/dashboard/properties/new"><Plus /> Шинэ зар үүсгэх</Link>
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Бүгд ({groups.all.length})</TabsTrigger>
            <TabsTrigger value="published">Нийтлэгдсэн ({groups.published.length})</TabsTrigger>
            <TabsTrigger value="draft">Ноорог ({groups.draft.length})</TabsTrigger>
            <TabsTrigger value="archived">Архив ({groups.archived.length})</TabsTrigger>
          </TabsList>

          {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => (
            <TabsContent key={key} value={key}>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {groups[key].map((p) => <PropertyCard key={p.id} property={p} paused={!entitlement.toursLive} />)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
