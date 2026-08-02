import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanCheckout } from "@/components/dashboard/plan-checkout";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Багц" };

export default async function BillingPage() {
  const { profile } = await requireUser();
  const ent = getEntitlement(profile);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Багц</h1>
        <p className="mt-1 text-muted-foreground">Захиалгын төлөв, үнийн санал</p>
      </div>

      {/* current status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Одоогийн төлөв</CardTitle>
              <CardDescription className="mt-1">{ent.label}</CardDescription>
            </div>
            <Badge variant={ent.active ? "success" : ent.trialUsed ? "warning" : "muted"}>
              {ent.active ? "Идэвхтэй" : ent.trialUsed ? "Дууссан" : "Туршилт"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {ent.active && ent.expiresAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Дуусах огноо</span>
              <span>{formatDate(ent.expiresAt)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Шинэ зар нийтлэх</span>
            <span>{ent.canPublish ? "Боломжтой" : "Хаагдсан"}</span>
          </div>
          {!ent.active && !ent.trialUsed && (
            <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-muted-foreground">
              <Sparkles className="h-4 w-4 shrink-0" />
              Танд 1 зар үнэгүй нийтлэх эрх байна.
            </p>
          )}
        </CardContent>
      </Card>

      {/* plans */}
      <div>
        <h2 className="mb-4 text-lg font-medium">Багц сонгох</h2>
        <PlanCheckout activePlan={ent.active ? profile.plan : undefined} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Төлбөрийг wire.mn аюулгүй гарцаар хийнэ — банкны апп, цахим хэтэвч, QR төлбөр.
        Асуудал гарвал {profile.email} хаягаасаа бидэн рүү бичээрэй.
      </p>

    </div>
  );
}
