import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SIGNATURE_HEADER, paymentIntentIdFromEvent, retrievePaymentIntent, verifyWebhook,
} from "@/lib/wire";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/wire/webhook — the only place a subscription is granted.
 *
 * 1. verify the HMAC signature against the RAW body
 * 2. drop duplicates by event id
 * 3. re-read the PaymentIntent from the API before crediting anything
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WIRE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const rawBody = await request.text();

  let event;
  try {
    event = verifyWebhook(rawBody, request.headers.get(SIGNATURE_HEADER), secret);
  } catch (e) {
    console.warn("[wire] rejected webhook:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // idempotency — Wire may deliver the same event more than once
  const { error: dupError } = await admin
    .from("webhook_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });
  if (dupError) {
    if (dupError.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[wire] event log failed", dupError);
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const intentId = paymentIntentIdFromEvent(event);
  if (!intentId) return NextResponse.json({ error: "no payment_intent in event" }, { status: 400 });

  try {
    // never trust the payload alone for something that grants access
    const intent = await retrievePaymentIntent(intentId);
    if (intent.status !== "succeeded") {
      return NextResponse.json({ ok: true, status: intent.status });
    }

    const { data, error } = await admin.rpc("apply_payment", { p_payment_intent: intentId });
    if (error) {
      console.error("[wire] apply_payment failed", error);
      return NextResponse.json({ error: "apply failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, expires_at: data ?? "already applied" });
  } catch (e) {
    console.error("[wire] webhook processing failed", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
