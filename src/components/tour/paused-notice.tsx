import Link from "next/link";
import { Clock } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/constants";

/** Shown instead of the tour when the agent's access window has closed. */
export function PausedNotice({ title }: { title?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size="lg" className="mb-2" />
      <div className="rounded-full bg-muted p-4">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Энэ тур түр зогссон байна</h1>
      <p className="max-w-md text-muted-foreground">
        {title ? <>«{title}» зарын</> : "Энэ зарын"} үзүүлэлтийн хугацаа дууссан тул түр хаагдлаа.
        Зуучлагч сунгамагц <b className="text-foreground">яг энэ холбоосоор</b> дахин нээгдэнэ —
        хуваалцсан линк, QR код тань хүчинтэй хэвээр.
      </p>
      <Button variant="outline" asChild>
        <Link href="/">{SITE.name}</Link>
      </Button>
    </main>
  );
}
