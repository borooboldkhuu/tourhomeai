import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadSchema } from "@/lib/validations";

/** POST /api/leads — REST alternative to the submitLead server action. */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id, agent_id, status")
    .eq("id", parsed.data.propertyId)
    .single();

  if (!property || property.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin.from("leads").insert({
    property_id: property.id,
    agent_id: property.agent_id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    message: parsed.data.message || null,
  });

  if (error) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
