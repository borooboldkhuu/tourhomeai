import Link from "next/link";
import { AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Entitlement } from "@/lib/billing";

/** Shown above the dashboard when the trial is spent or a plan is about to lapse. */
export function PlanBanner({ entitlement }: { entitlement: Entitlement }) {
  const paused = !entitlement.toursLive;
  const expiringSoon = entitlement.toursLive && (entitlement.daysLeft ?? 99) <= 7;
  const blocked = paused || (!entitlement.active && entitlement.trialUsed);

  if (!blocked && !expiringSoon) return null;

  return (
    <div
      className={
        blocked
          ? "mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/60 dark:bg-amber-950/40"
          : "mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-muted px-5 py-4"
      }
    >
      <div className="flex items-start gap-3">
        {blocked ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        ) : (
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="text-sm">
          <p className={blocked ? "font-medium text-amber-900 dark:text-amber-200" : "font-medium"}>
            {paused
              ? "Турууд тань түр зогссон"
              : blocked
                ? "Үнэгүй туршилт дууссан"
                : `${entitlement.daysLeft} хоногийн дараа хугацаа дуусна`}
          </p>
          <p className={blocked ? "text-amber-800 dark:text-amber-300/90" : "text-muted-foreground"}>
            {paused
              ? "Нийтэлсэн зарууд тань үзэгчид харагдахгүй байна. Багц идэвхжүүлмэгц яг тэр холбоос, QR кодоор дахин нээгдэнэ."
              : blocked
                ? "Шинэ зар нийтлэхийн тулд багц идэвхжүүлнэ үү."
                : "Тасалдалгүй үргэлжлүүлэхийн тулд урьдчилан сунгаарай."}
          </p>
        </div>
      </div>
      <Button size="sm" asChild>
        <Link href="/dashboard/billing">Багц үзэх</Link>
      </Button>
    </div>
  );
}
