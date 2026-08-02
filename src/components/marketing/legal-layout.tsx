import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { SITE } from "@/lib/constants";

export function LegalLayout({
  title, updated, children,
}: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" aria-label={SITE.name}><Logo /></Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Нүүр
          </Link>
        </div>
      </header>

      <main className="container max-w-2xl py-14">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Сүүлд шинэчилсэн: {updated}</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:space-y-2">
          {children}
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container flex flex-wrap justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {SITE.name}</span>
          <span className="flex gap-5">
            <Link href="/terms" className="hover:text-foreground">Үйлчилгээний нөхцөл</Link>
            <Link href="/privacy" className="hover:text-foreground">Нууцлалын бодлого</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
