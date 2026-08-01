"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, createPaymentIntent, toMinor } from "@/lib/wire";
import { PLAN_BY_ID, type PlanId } from "@/lib/constants";
import { absoluteUrl } from "@/lib/utils";

export type CheckoutState = { error?: string } | null;

/**
 * Creates a wire.mn PaymentIntent + hosted checkout session and sends the
 * agent to pay.wire.mn. The subscription itself is only granted by the
 * webhook, never by the browser coming back.
 */
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const planId = String(formData.get("plan")) as PlanId;
  const plan = PLAN_BY_ID[planId];
  if (!plan || planId === "trial") return { error: "Багц буруу байна" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нэвтрэх шаардлагатай" };

  if (!process.env.WIRE_API_KEY) {
    return { error: "Төлбөрийн систем тохируулагдаагүй байна. Дансаар шилжүүлнэ үү." };
  }

  const admin = createAdminClient();
  let checkoutUrl: string;

  try {
    // one idempotency key per user+plan+minute — safe to retry, no double charge
    const stamp = Math.floor(Date.now() / 60_000);
    const idem = `th-${user.id.slice(0, 8)}-${planId}-${stamp}`;

    const intent = await createPaymentIntent({
      amountMinor: toMinor(plan.price),
      metadata: { user_id: user.id, plan: planId, app: "tourhome" },
      idempotencyKey: idem,
    });

    const session = await createCheckoutSession({
      paymentIntent: intent.id,
      successUrl: absoluteUrl(`/dashboard/billing/success?pi=${intent.id}`),
      idempotencyKey: `sess-${idem}`,
    });

    const { error } = await admin.from("payments").upsert(
      {
        user_id: user.id,
        plan: planId,
        amount_minor: toMinor(plan.price),
        currency: "MNT",
        status: "pending",
        provider: "wire",
        payment_intent_id: intent.id,
        checkout_session_id: session.id,
        checkout_url: session.url,
        livemode: intent.livemode,
        raw: intent as unknown as Record<string, unknown>,
      },
      { onConflict: "payment_intent_id" },
    );
    if (error) return { error: "Төлбөрийг бүртгэхэд алдаа гарлаа" };

    checkoutUrl = session.url;
  } catch (e) {
    console.error("[wire] checkout failed", e);
    return { error: "Төлбөрийн хуудас нээхэд алдаа гарлаа. Дахин оролдоно уу." };
  }

  redirect(checkoutUrl);
}
