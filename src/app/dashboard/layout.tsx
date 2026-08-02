import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { PlanBanner } from "@/components/dashboard/plan-banner";
import { SITE } from "@/lib/constants";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { InstallPWA, InstallPWACard } from "@/components/shared/install-pwa";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const entitlement = getEntitlement(profile);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 glass hairline">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" aria-label={SITE.name}>
              <Logo className="shrink-0" />
            </Link>
            <DashboardNav className="hidden md:flex" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="hidden md:flex" />
            <ThemeToggle compact className="md:hidden" />
            <InstallPWA className="hidden md:block" />
            <InstallPWA compact className="md:hidden" />
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/dashboard/properties/new">
                <Plus /> Шинэ зар
              </Link>
            </Button>
            <Button size="icon" asChild className="h-9 w-9 sm:hidden">
              <Link href="/dashboard/properties/new" aria-label="Шинэ зар">
                <Plus />
              </Link>
            </Button>
            <UserMenu profile={profile} />
          </div>
        </div>
        <DashboardNav className="flex overflow-x-auto px-4 pb-2 md:hidden no-scrollbar" />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <InstallPWACard />
        <PlanBanner entitlement={entitlement} />
        {children}
      </main>
    </div>
  );
}
