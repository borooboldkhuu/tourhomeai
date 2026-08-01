import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Тохиргоо" };

export default async function SettingsPage() {
  const { profile } = await requireUser();
  const ent = getEntitlement(profile);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Тохиргоо</h1>
        <p className="mt-1 text-muted-foreground">Танилцуулга хуудсанд харагдах мэдээлэл</p>
      </div>

      <ProfileForm profile={profile} />

      <Card>
        <CardHeader>
          <CardTitle>Бүртгэл</CardTitle>
          <CardDescription>Системийн мэдээлэл</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">И-мэйл</span>
            <span>{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Эрх</span>
            <span>{profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Бүртгүүлсэн</span>
            <span>{formatDate(profile.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Багц</span>
            <Link href="/dashboard/billing" className="underline-offset-4 hover:underline">
              {ent.label}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
