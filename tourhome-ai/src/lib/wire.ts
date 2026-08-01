import crypto from "node:crypto";

/**
 * Minimal wire.mn (Buildry) Merchant API client — server only.
 * Docs: https://docs.wire.mn/docs
 *
 * Money is always in MINOR units: 100 minor = 1 ₮.
 */

const API_BASE = process.env.WIRE_API_BASE ?? "https://api.wire.mn/v1";
export const SIGNATURE_HEADER = "wirepayment-signature";

export interface WirePaymentIntent {
  id: string;
  object: "payment_intent";
  amount: number;
  currency: string;
  status: "new" | "processing" | "succeeded" | "canceled" | "failed" | "expired" | string;
  allowed_operators?: string[];
  selected_operator?: string | null;
  metadata?: Record<string, string>;
  livemode: boolean;
  created: number;
  expires_at?: number;
}

export interface WireCheckoutSession {
  id: string;
  object: "checkout.session";
  url: string;
  payment_intent: string;
}

export interface WireEvent {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
  [key: string]: unknown;
}

function apiKey(): string {
  const key = process.env.WIRE_API_KEY;
  if (!key) throw new Error("WIRE_API_KEY is not set");
  return key;
}

/** True while a `sk_test_` key is configured. */
export function isTestMode() {
  return (process.env.WIRE_API_KEY ?? "").startsWith("sk_test_");
}

/** Operators the hosted checkout may offer. Test mode must use `sandbox`. */
export function allowedOperators(): string[] {
  const raw = process.env.WIRE_OPERATORS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return isTestMode() ? ["sandbox"] : [];
}

async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: BodyInit; contentType?: string; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey()}` };
  if (init.contentType) headers["Content-Type"] = init.contentType;
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers,
    body: init.body,
    cache: "no-store",
  });

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    throw new Error(`wire ${res.status}: ${err?.message ?? err?.code ?? text.slice(0, 200)}`);
  }
  return json as T;
}

export async function createPaymentIntent(params: {
  amountMinor: number;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}): Promise<WirePaymentIntent> {
  const operators = allowedOperators();
  return request<WirePaymentIntent>("/payment_intents", {
    method: "POST",
    contentType: "application/json",
    idempotencyKey: params.idempotencyKey,
    body: JSON.stringify({
      amount: params.amountMinor,
      currency: "MNT",
      ...(operators.length ? { allowed_operators: operators } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    }),
  });
}

export async function createCheckoutSession(params: {
  paymentIntent: string;
  successUrl: string;
  idempotencyKey: string;
}): Promise<WireCheckoutSession> {
  const form = new URLSearchParams({
    payment_intent: params.paymentIntent,
    success_url: params.successUrl,
  });
  return request<WireCheckoutSession>("/checkout/sessions", {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    idempotencyKey: params.idempotencyKey,
    body: form.toString(),
  });
}

export async function retrievePaymentIntent(id: string): Promise<WirePaymentIntent> {
  return request<WirePaymentIntent>(`/payment_intents/${encodeURIComponent(id)}`, { method: "GET" });
}

/**
 * Verifies `WirePayment-Signature: t=<unix>,v1=<hex>` where
 * v1 = HMAC_SHA256(secret, `${t}.${rawBody}`).
 * Throws if the signature is missing, malformed, stale or wrong.
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): WireEvent {
  if (!signatureHeader) throw new Error("missing signature header");

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) throw new Error("malformed signature header");

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) throw new Error("malformed signature timestamp");
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    throw new Error("signature timestamp outside tolerance");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parts.v1, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("signature mismatch");
  }

  return JSON.parse(rawBody) as WireEvent;
}

/** Pulls the payment_intent id out of an event whatever shape it arrives in. */
export function paymentIntentIdFromEvent(event: WireEvent): string | null {
  const obj = event.data?.object as Record<string, unknown> | undefined;
  if (obj) {
    if (typeof obj.id === "string" && obj.id.startsWith("pi_")) return obj.id;
    if (typeof obj.payment_intent === "string") return obj.payment_intent;
  }
  const flat = event as Record<string, unknown>;
  if (typeof flat.payment_intent === "string") return flat.payment_intent;
  if (typeof flat.id === "string" && flat.id.startsWith("pi_")) return flat.id;
  return null;
}

/** ₮ → minor units. */
export function toMinor(mnt: number) {
  return Math.round(mnt * 100);
}
