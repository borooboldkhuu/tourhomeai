"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordReset, type ActionState } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(requestPasswordReset, null);

  if (state?.success) {
    return (
      <p className="mt-8 flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.success}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="ta@company.mn" required />
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}

      <SubmitButton className="w-full" size="lg">Холбоос илгээх</SubmitButton>
    </form>
  );
}
