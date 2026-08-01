import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PropertyForm } from "@/components/property/property-form";

export const metadata: Metadata = { title: "Шинэ зар" };

export default async function NewPropertyPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/dashboard/properties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Зарууд
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Шинэ зар үүсгэх</h1>
        <p className="mt-1 text-muted-foreground">
          Эхлээд үндсэн мэдээллийг бөглөнө үү. Дараа нь зураг, 360° панорама байршуулна.
        </p>
      </div>
      <PropertyForm />
    </div>
  );
}
