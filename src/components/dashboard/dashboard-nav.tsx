"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CreditCard, LayoutGrid, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Хяналтын самбар", icon: LayoutGrid, exact: true },
  { href: "/dashboard/properties", label: "Зарууд", icon: Building2 },
  { href: "/dashboard/leads", label: "Хүсэлтүүд", icon: Users },
  { href: "/dashboard/analytics", label: "Статистик", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Багц", icon: CreditCard },
  { href: "/dashboard/settings", label: "Тохиргоо", icon: Settings },
];

export function DashboardNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("items-center gap-1", className)}>
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
