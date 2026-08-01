"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { signUp, type ActionState } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(signUp, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Овог нэр</Label>
        <Input id="fullName" name="fullName" placeholder="Батын Болд" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="ta@company.mn" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Утас</Label>
          <Input id="phone" name="phone" inputMode="tel" placeholder="99112233" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Байгууллага</Label>
          <Input id="companyName" name="companyName" placeholder="Сонголтоор" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Нууц үг</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="Доод тал нь 6 тэмдэгт" required />
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {state.success}
        </p>
      )}

      <SubmitButton className="w-full" size="lg">Бүртгүүлэх</SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        Бүртгүүлснээр үйлчилгээний нөхцөлийг зөвшөөрч байна.
      </p>
    </form>
  );
}
