import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/track
 * Body: { propertyId, eventType, sceneKey?, sessionId? }
 * Fire-and-forget analytics beacon from the public tour page.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, eventType = "view", sceneKey, sessionId } = body ?? {};
    if (!propertyId) return NextResponse.json({ ok: false }, { status: 400 });

    const admin = createAdminClient();
    const { data: property } = await admin
      .from("properties")
      .select("id, agent_id, slug, status")
      .eq("id", propertyId)
      .single();

    if (!property || property.status !== "published") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const ua = request.headers.get("user-agent") ?? "";
    const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";

    await admin.from("analytics").insert({
      property_id: property.id,
      agent_id: property.agent_id,
      event_type: eventType,
      scene_key: sceneKey ?? null,
      referrer: request.headers.get("referer"),
      country: request.headers.get("x-vercel-ip-country"),
      device,
      session_id: sessionId ?? null,
    });

    if (eventType === "view") {
      await admin.rpc("increment_property_view", { p_slug: property.slug });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
