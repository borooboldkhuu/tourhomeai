import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { PropertyForm } from "@/components/property/property-form";
import { ImageUploader } from "@/components/property/image-uploader";
import { TourManager } from "@/components/property/tour-manager";
import { SharePanel } from "@/components/property/share-panel";
import { DeletePropertyButton } from "@/components/property/delete-property-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Property, PropertyImage, PropertyTour } from "@/types/database.types";

export const metadata: Metadata = { title: "Зар засах" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, profile } = await requireUser();
  const entitlement = getEntitlement(profile);
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("agent_id", userId)
    .single();

  if (!property) notFound();

  const [{ data: images }, { data: tours }] = await Promise.all([
    supabase.from("property_images").select("*").eq("property_id", id).order("sort_order"),
    supabase.from("property_tours").select("*").eq("property_id", id).order("sort_order"),
  ]);

  const p = property as Property;
  const all = (images ?? []) as PropertyImage[];
  const photos = all.filter((i) => i.kind === "photo");
  const floorplans = all.filter((i) => i.kind === "floorplan");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Зарууд
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{p.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> {p.view_count} үзэлт
          </p>
        </div>
        <DeletePropertyButton propertyId={p.id} title={p.title} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="info">
          <TabsList className="w-full max-w-full justify-start overflow-x-auto no-scrollbar sm:w-auto">
            <TabsTrigger value="info">Мэдээлэл</TabsTrigger>
            <TabsTrigger value="photos">Зураг ({photos.length})</TabsTrigger>
            <TabsTrigger value="tour">360° ({(tours ?? []).length})</TabsTrigger>
            <TabsTrigger value="plan">План</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <PropertyForm property={p} />
          </TabsContent>

          <TabsContent value="photos">
            <ImageUploader propertyId={p.id} images={photos} coverUrl={p.cover_image_url} kind="photo" />
          </TabsContent>

          <TabsContent value="tour">
            <TourManager propertyId={p.id} tours={(tours ?? []) as PropertyTour[]} />
          </TabsContent>

          <TabsContent value="plan">
            <ImageUploader
              propertyId={p.id}
              images={floorplans}
              coverUrl={null}
              kind="floorplan"
              title="Байрны план"
              hint="Байрны зураг төслийн PNG/JPG."
            />
          </TabsContent>
        </Tabs>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <SharePanel propertyId={p.id} slug={p.slug} status={p.status} paused={!entitlement.toursLive} />
        </aside>
      </div>
    </div>
  );
}
