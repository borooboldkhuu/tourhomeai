import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { Logo } from "@/components/shared/logo";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";

export const metadata: Metadata = { title: "Нууц үг сэргээх" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label={SITE.name} className="mb-10 flex justify-center">
          <Logo size="lg" />
        </Link>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Нууц үгээ мартсан уу?</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Бүртгэлтэй и-мэйл хаягаа оруулбал сэргээх холбоос илгээнэ.
        </p>
        <ForgotPasswordForm />
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Нэвтрэх рүү буцах
          </Link>
        </p>
      </div>
    </main>
  );
}
