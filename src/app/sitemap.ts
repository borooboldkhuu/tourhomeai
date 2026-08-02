import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

/** Static pages plus every published tour that is currently visible. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/register"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("properties")
      .select("slug, updated_at, agent_id")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(1000);

    const tours: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
      url: absoluteUrl(`/tour/${p.slug}`),
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...tours];
  } catch {
    return staticPages;
  }
}
