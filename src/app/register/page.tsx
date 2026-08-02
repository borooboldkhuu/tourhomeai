import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/shared/register-form";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = { title: "Бүртгүүлэх" };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 block text-center text-[15px] font-semibold tracking-tight">
          {SITE.name}
        </Link>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Бүртгэл үүсгэх</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Хэдхэн минутын дотор эхний 360° тураа үүсгээрэй
        </p>
        <RegisterForm />
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Бүртгэлтэй юу?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </div>
    </main>
  );
}
