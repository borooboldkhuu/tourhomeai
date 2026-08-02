import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Төлбөр" };
export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ pi?: string }>;
}) {
  const { pi } = await searchParams;
  const { profile } = await requireUser();
  const ent = getEntitlement(profile);

  const supabase = await createClient();
  const { data: payment } = pi
    ? await supabase.from("payments").select("*").eq("payment_intent_id", pi).maybeSingle()
    : { data: null };

  const paid = payment?.status === "paid" || ent.active;

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          {paid ? (
            <>
              <div className="rounded-full bg-emerald-50 p-3 dark:bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Төлбөр амжилттай</h1>
              <p className="text-muted-foreground">
                Багц идэвхжлээ
                {ent.expiresAt && <> · {formatDate(ent.expiresAt)} хүртэл</>}.
              </p>
              <Button asChild className="mt-2">
                <Link href="/dashboard/properties/new">Шинэ зар үүсгэх</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-full bg-muted p-3">
                <Clock className="h-7 w-7 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Баталгаажуулж байна</h1>
              <p className="text-muted-foreground">
                Банкнаас баталгаажилт ирэхийг хүлээж байна. Ихэвчлэн хэдхэн секунд.
                Энэ хуудсыг сэргээж шалгаарай.
              </p>
              <Button variant="outline" asChild className="mt-2">
                <Link href="/dashboard/billing">Багц хуудас</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
