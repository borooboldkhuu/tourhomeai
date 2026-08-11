import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { PROPERTY_TYPE_LABELS, SITE } from "@/lib/constants";
import type { Property } from "@/types/database.types";

export const runtime = "nodejs";
export const alt = "TourHome AI — 360° виртуал тур";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card Facebook, Messenger and Viber show when a tour link is shared.
 * Facebook caches this per URL — use their Sharing Debugger to refresh it.
 */
export default async function Image({ params }: { params: { slug: string } }) {
  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/og-regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/og-bold.ttf")),
  ]);

  let property: Property | null = null;
  let rooms = 0;
  try {
    const client = (() => {
      try {
        return createAdminClient();
      } catch {
        return null;
      }
    })() ?? (await createClient());

    const { data } = await client
      .from("properties")
      .select("*, property_tours(id)")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();

    property = (data as unknown as Property) ?? null;
    rooms = ((data as unknown as { property_tours?: unknown[] })?.property_tours ?? []).length;
  } catch {
    property = null;
  }

  const cover = property?.cover_image_url ?? null;
  const title = property?.title ?? SITE.name;
  const price = property ? formatPrice(property.price, property.currency) : SITE.tagline;

  const facts = [
    property?.area ? `${property.area} м²` : null,
    property?.rooms ? `${property.rooms} өрөө` : null,
    rooms ? `${rooms} өрөө 360°` : null,
    property ? PROPERTY_TYPE_LABELS[property.property_type] : null,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0a", position: "relative" }}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={1200} height={630}
            style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}

        <div style={{
          position: "absolute", inset: 0, display: "flex",
          background: "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.25) 100%)",
        }} />

        <div style={{
          position: "relative", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: 64, width: "100%",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 700, color: "#0a0a0a",
            }}>T</div>
            <div style={{ fontSize: 24, color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>{SITE.name}</div>
            <div style={{
              marginLeft: 8, padding: "6px 14px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.25)", fontSize: 18, color: "rgba(255,255,255,0.85)",
            }}>360° виртуал тур</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: "#fff", lineHeight: 1.12 }}>
              {title.length > 68 ? `${title.slice(0, 68)}…` : title}
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: "#fff" }}>{price}</div>

            {facts.length > 0 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {facts.map((f) => (
                  <div key={f} style={{
                    padding: "8px 18px", borderRadius: 999, fontSize: 22,
                    background: "rgba(255,255,255,0.14)", color: "#fff",
                  }}>{f}</div>
                ))}
              </div>
            )}

            {property?.location && (
              <div style={{ fontSize: 24, color: "rgba(255,255,255,0.72)" }}>
                {property.location.length > 60 ? `${property.location.slice(0, 60)}…` : property.location}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "OG", data: regular, weight: 400, style: "normal" },
        { name: "OG", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
