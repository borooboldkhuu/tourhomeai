import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata: Metadata = { title: "Шинэ нууц үг" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label={SITE.name} className="mb-10 flex justify-center">
          <Logo size="lg" />
        </Link>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Шинэ нууц үг</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Шинэ нууц үгээ хоёр удаа оруулна уу.
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
