import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Хуудас олдсонгүй</h1>
      <p className="max-w-md text-muted-foreground">
        Таны хайж буй зар устсан эсвэл хаяг нь өөрчлөгдсөн байж болзошгүй.
      </p>
      <Button asChild>
        <Link href="/">Нүүр хуудас руу буцах</Link>
      </Button>
    </main>
  );
}
