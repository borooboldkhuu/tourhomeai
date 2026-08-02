"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updatePassword, type ActionState } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(updatePassword, null);

  if (state?.success) {
    return (
      <div className="mt-8 space-y-4">
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.success}
        </p>
        <Button asChild className="w-full" size="lg">
          <Link href="/dashboard">Хяналтын самбар руу</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Шинэ нууц үг</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password"
          placeholder="Доод тал нь 6 тэмдэгт" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Дахин оруулах</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>

      {state?.error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {state.error}
        </p>
      )}

      <SubmitButton className="w-full" size="lg">Хадгалах</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Холбоосын хугацаа дууссан бол{" "}
        <Link href="/forgot-password" className="font-medium text-foreground underline-offset-4 hover:underline">
          дахин илгээнэ үү
        </Link>
      </p>
    </form>
  );
}
