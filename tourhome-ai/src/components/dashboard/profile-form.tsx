"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateProfile, type ActionState } from "@/app/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import type { UserProfile } from "@/types/database.types";

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateProfile, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профайл</CardTitle>
        <CardDescription>Энэ мэдээлэл нийтийн танилцуулга хуудсанд харагдана.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="full_name">Овог нэр</Label>
            <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} required />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Утас</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} placeholder="99112233" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Байгууллага</Label>
              <Input id="company_name" name="company_name" defaultValue={profile.company_name ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Товч танилцуулга</Label>
            <Textarea id="bio" name="bio" rows={4} defaultValue={profile.bio ?? ""}
              placeholder="Ажлын туршлага, мэргэшсэн чиглэл…" />
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

          <SubmitButton>Хадгалах</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
