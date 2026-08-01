import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { PlanBanner } from "@/components/dashboard/plan-banner";
import { SITE } from "@/lib/constants";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { InstallPWA } from "@/components/shared/install-pwa";
import { ThemeToggle } from "@/components/shared/theme";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const entitlement = getEntitlement(profile);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 glass hairline">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight">
              {SITE.name}
            </Link>
            <DashboardNav className="hidden md:flex" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="hidden sm:flex" />
            <InstallPWA className="hidden sm:block" />
            <Button size="sm" asChild>
              <Link href="/dashboard/properties/new">
                <Plus /> Шинэ зар
              </Link>
            </Button>
            <UserMenu profile={profile} />
          </div>
        </div>
        <DashboardNav className="flex overflow-x-auto px-4 pb-2 md:hidden no-scrollbar" />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <PlanBanner entitlement={entitlement} />
        {children}
      </main>
    </div>
  );
}
