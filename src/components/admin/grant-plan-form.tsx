"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { grantPlan, type AdminState } from "@/app/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import { PLANS } from "@/lib/constants";

export function GrantPlanForm() {
  const [state, formAction] = useActionState<AdminState, FormData>(grantPlan, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Багц гараар идэвхжүүлэх</CardTitle>
        <CardDescription>
          Гэрээт байгууллага, нөхөн олговор зэрэг онцгой тохиолдолд. Идэвхтэй багцтай бол
          хугацаа дээр нь нэмж сунгана.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="email">И-мэйл</Label>
            <Input id="email" name="email" type="email" placeholder="agent@example.mn" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Багц</Label>
            <select id="plan" name="plan" defaultValue="m3"
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44">
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.months} сар</option>
              ))}
            </select>
          </div>
          <SubmitButton size="lg">Идэвхжүүлэх</SubmitButton>
        </form>

        {state?.error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {state.success}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
