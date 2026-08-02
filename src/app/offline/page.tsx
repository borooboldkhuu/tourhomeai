import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Холболт алга" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <WifiOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Интернэт холболт алга</h1>
      <p className="max-w-sm text-muted-foreground">
        Сүүлд үзсэн хуудсууд офлайн ажиллана. Холболт сэргэмэгц хуудсаа дахин ачаална уу.
      </p>
    </main>
  );
}
