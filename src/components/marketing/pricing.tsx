import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import { formatNumber, cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border bg-muted/40 py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Энгийн, ойлгомжтой үнэ</h2>
          <p className="mt-4 text-muted-foreground">
            Эхлээд <b className="text-foreground">1 удаа үнэгүй</b> туршиж үзээрэй. Таалагдвал багцаа сонгоно.
          </p>
        </div>

        {/* free trial */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-dashed border-border bg-background p-7">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <h3 className="text-lg font-medium">Үнэгүй туршилт</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <b className="text-foreground">1 удаа</b> зар нийтэлж, бүх боломжийг шалгаж үзнэ.
                Карт шаардахгүй.
              </p>
            </div>
            <Button size="lg" asChild className="shrink-0">
              <Link href="/register">Үнэгүй эхлэх</Link>
            </Button>
          </div>
        </div>

        {/* paid plans */}
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-background p-7 transition-shadow",
                plan.popular
                  ? "border-foreground shadow-[0_18px_50px_-24px_rgba(0,0,0,.55)] dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,.9)]"
                  : "border-border hover:shadow-lg",
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background">
                  Хамгийн ашигтай
                </span>
              )}

              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-medium">{plan.name}</h3>
                {plan.badge && <span className="text-base">{plan.badge}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <div className="mt-6">
                <span className="text-3xl font-semibold tracking-tight">
                  ₮{formatNumber(plan.price)}
                </span>
                {plan.perMonth && plan.months > 1 && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    сард ₮{formatNumber(plan.perMonth)}
                    {plan.saveText && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {plan.saveText}
                      </span>
                    )}
                  </p>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> {f}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-7"
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                asChild
              >
                <Link href={`/register?plan=${plan.id}`}>Сонгох</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Үнэ НӨАТ багтсан. Багц дуусахад зарууд тань устахгүй — үзүүлэлт нь түр зогсоод,
          сунгамагц яг тэр холбоос, QR кодоор дахин нээгдэнэ.
        </p>
      </div>
    </section>
  );
}
