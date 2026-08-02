import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TourNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Зар олдсонгүй</h1>
      <p className="max-w-md text-muted-foreground">
        Холбоос буруу, эсвэл энэ зар нийтлэгдээгүй байна. Зуучлагч зараа нийтэлмэгц
        энэ хаяг ажиллана.
      </p>
      <Button asChild>
        <Link href="/">Нүүр хуудас</Link>
      </Button>
    </main>
  );
}
