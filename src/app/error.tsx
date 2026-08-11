"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Catches anything that throws while rendering a page. Without this the
 * visitor gets a blank screen and we never learn that it happened.
 */
export default function Error({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Алдаа гарлаа</h1>
      <p className="max-w-md text-muted-foreground">
        Түр зуурын саатал байж магадгүй. Дахин оролдоод үзнэ үү — үргэлжилвэл бидэнд мэдэгдээрэй.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">алдааны код: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw /> Дахин оролдох
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Нүүр хуудас</Link>
        </Button>
      </div>
    </main>
  );
}
