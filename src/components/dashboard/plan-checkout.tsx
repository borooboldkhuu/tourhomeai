"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { startCheckout, type CheckoutState } from "@/app/actions/billing";
import { SubmitButton } from "@/components/shared/submit-button";
import { PLANS } from "@/lib/constants";
import { formatNumber, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function PlanCheckout({ activePlan }: { activePlan?: string }) {
  const [state, formAction] = useActionState<CheckoutState, FormData>(startCheckout, null);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn("flex flex-col p-6", plan.popular && "border-foreground")}>
            <div className="flex items-baseline gap-2">
              <h3 className="font-medium">{plan.name}</h3>
              {plan.badge && <span>{plan.badge}</span>}
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">₮{formatNumber(plan.price)}</p>
            {plan.months > 1 && plan.perMonth && (
              <p className="mt-1 text-xs text-muted-foreground">
                сард ₮{formatNumber(plan.perMonth)} · {plan.saveText}
              </p>
            )}

            <form action={formAction} className="mt-5">
              <input type="hidden" name="plan" value={plan.id} />
              <SubmitButton
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                pendingText="Түр хүлээнэ үү…"
              >
                {activePlan === plan.id ? "Сунгах" : "Худалдаж авах"}
              </SubmitButton>
            </form>
          </Card>
        ))}
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Төлбөрийг wire.mn аюулгүй хуудсаар хийнэ — банкны апп, цахим хэтэвч, QR.
        Багц төлбөр баталгаажсан даруйд автоматаар идэвхжинэ.
      </p>
    </div>
  );
}
