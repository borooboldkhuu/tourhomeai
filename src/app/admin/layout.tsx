import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Logo } from "@/components/shared/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 glass hairline">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Logo showText={false} />
              <Badge variant="outline">Админ</Badge>
            </Link>
            <AdminNav className="hidden md:flex" />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{profile.email}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Хяналтын самбар</Link>
            </Button>
          </div>
        </div>
        <AdminNav className="flex overflow-x-auto px-4 pb-2 md:hidden no-scrollbar" />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
