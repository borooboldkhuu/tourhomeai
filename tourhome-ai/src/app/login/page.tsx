import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/shared/login-form";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = { title: "Нэвтрэх" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center text-[15px] font-semibold tracking-tight">
          {SITE.name}
        </Link>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Тавтай морил</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Бүртгэлдээ нэвтэрч зараа удирдаарай
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Бүртгэлгүй юу?{" "}
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Бүртгүүлэх
          </Link>
        </p>
      </div>
    </main>
  );
}
