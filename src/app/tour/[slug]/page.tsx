import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Bath, Building, Calendar, CheckCircle2, Layers, MapPin, Maximize2, Rotate3d, Sofa,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/billing";
import { PausedNotice } from "@/components/tour/paused-notice";
import { TourHero } from "@/components/tour/tour-hero";
import { Gallery } from "@/components/tour/gallery";
import { ContactCard } from "@/components/tour/contact-card";
import { ShareButton } from "@/components/tour/share-button";
import { VideoSection } from "@/components/tour/video-section";
import { ViewTracker } from "@/components/tour/view-tracker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PROPERTY_TYPE_LABELS, SITE } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import type { PropertyWithMedia, UserProfile } from "@/types/database.types";

export const revalidate = 60;

const SELECT = `
  *,
  property_images(*),
  property_tours(*),
  users(id, full_name, phone, email, avatar_url, company_name,
        plan, plan_expires_at, trial_used, trial_started_at)
`;

type Owner = PropertyWithMedia["users"] & {
  plan: UserProfile["plan"];
  plan_expires_at: string | null;
  trial_used: boolean;
  trial_started_at: string | null;
};

/**
 * Reads the listing regardless of the agent's access window, then decides
 * whether it may be shown. RLS also blocks paused rows for anonymous callers;
 * this pass exists so we can render a proper "on hold" page instead of a 404.
 */
async function getProperty(
  slug: string,
): Promise<{ property: PropertyWithMedia | null; live: boolean }> {
  let data: unknown = null;
  try {
    const admin = createAdminClient();
    ({ data } = await admin
      .from("properties")
      .select(SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle());
  } catch {
    // no service-role key configured — fall back to the RLS-filtered client
    const supabase = await createClient();
    ({ data } = await supabase
      .from("properties")
      .select(SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle());
  }

  const property = (data as PropertyWithMedia | null) ?? null;
  if (!property) return { property: null, live: false };

  const owner = property.users as Owner | null;
  const live = owner
    ? getEntitlement({
        ...(owner as unknown as UserProfile),
        trial_used: owner.trial_used,
        trial_started_at: owner.trial_started_at,
        plan_expires_at: owner.plan_expires_at,
        plan: owner.plan,
      }).toursLive
    : true;

  return { property, live };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { property, live } = await getProperty(slug);
  if (!property) return { title: "Зар олдсонгүй" };
  if (!live) return { title: "Тур түр зогссон", robots: { index: false, follow: false } };

  const description = `${formatPrice(property.price, property.currency)} · ${property.area ?? "—"} м² · ${property.location ?? ""}`;

  return {
    title: property.title,
    description: property.description ?? description,
    openGraph: {
      title: property.title,
      description,
      images: property.cover_image_url ? [{ url: property.cover_image_url }] : [],
      type: "website",
    },
  };
}

export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { property, live } = await getProperty(slug);
  if (!property) notFound();
  if (!live) return <PausedNotice title={property.title} />;

  const images = [...(property.property_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const photos = images.filter((i) => i.kind === "photo" || i.kind === "cover");
  const floorplans = images.filter((i) => i.kind === "floorplan");
  const tours = [...(property.property_tours ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const specs = [
    { icon: Maximize2, label: "Талбай", value: property.area ? `${property.area} м²` : null },
    { icon: Sofa, label: "Өрөө", value: property.rooms ? `${property.rooms}` : null },
    { icon: Bath, label: "Угаалгын өрөө", value: property.bathrooms ? `${property.bathrooms}` : null },
    { icon: Layers, label: "Давхар", value: property.floor ? `${property.floor}${property.total_floors ? ` / ${property.total_floors}` : ""}` : null },
    { icon: Calendar, label: "Ашиглалтад орсон", value: property.year_built ? `${property.year_built}` : null },
    { icon: Building, label: "Төрөл", value: PROPERTY_TYPE_LABELS[property.property_type] },
  ].filter((s) => s.value);

  return (
    <div className="min-h-screen bg-background">
      <ViewTracker propertyId={property.id} />

      <TourHero
        propertyId={property.id}
        tours={tours}
        coverUrl={property.cover_image_url}
        title={property.title}
      />

      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          {/* Main column */}
          <div className="space-y-14">
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{PROPERTY_TYPE_LABELS[property.property_type]}</Badge>
                {tours.length > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Rotate3d className="h-3 w-3" /> {tours.length} өрөө 360°
                  </Badge>
                )}
              </div>

              <h1 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                {property.title}
              </h1>

              <div className="flex flex-wrap items-center justify-between gap-4">
                {property.location && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {[property.location, property.district, property.city].filter(Boolean).join(", ")}
                  </p>
                )}
                <ShareButton title={property.title} propertyId={property.id} />
              </div>
            </header>

            {specs.length > 0 && (
              <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
                {specs.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-background p-5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="mt-3 text-lg font-medium">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </section>
            )}

            {property.description && (
              <section className="space-y-3">
                <h2 className="text-xl font-medium">Тайлбар</h2>
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {property.description}
                </p>
              </section>
            )}

            {property.amenities.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-medium">Тохижилт</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {property.amenities.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {photos.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-medium">Зургийн цомог</h2>
                <Gallery images={photos} />
              </section>
            )}

            {floorplans.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-medium">Байрны план</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {floorplans.map((plan) => (
                    <Card key={plan.id} className="relative aspect-[4/3] overflow-hidden bg-white dark:bg-neutral-100">
                      <Image src={plan.url} alt="Байрны план" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-4" />
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {property.video_url && (
              <section className="space-y-4">
                <h2 className="text-xl font-medium">Видео</h2>
                <VideoSection url={property.video_url} />
              </section>
            )}
          </div>

          {/* Sticky sidebar */}
          <aside>
            <ContactCard property={property} />
          </aside>
        </div>
      </div>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            Энэхүү турыг{" "}
            <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
              {SITE.name}
            </Link>{" "}
            дээр үүсгэв
          </p>
          <Link href="/register" className="transition hover:text-foreground">
            Өөрийн 360° тураа үүсгэх →
          </Link>
        </div>
      </footer>
    </div>
  );
}
