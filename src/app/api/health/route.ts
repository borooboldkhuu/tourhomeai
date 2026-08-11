import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — for an uptime monitor.
 *
 * It touches the database on purpose: a free Supabase project pauses after a
 * week without traffic, which would take every published tour offline. A
 * monitor hitting this every few minutes keeps the project awake and tells
 * you the moment the database stops answering.
 */
export async function GET() {
  const started = Date.now();

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, database: "error", detail: error.message, ms: Date.now() - started },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: true, database: "up", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, database: "unreachable", detail: e instanceof Error ? e.message : "unknown" },
      { status: 503 },
    );
  }
}
