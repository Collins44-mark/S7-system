"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Box,
  Grid,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/categories", label: "Categories", icon: Grid },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const businessName =
    session?.role === "BUSINESS" ? session.businessName : "Store";
  const businessId =
    session?.role === "BUSINESS" ? session.businessId : undefined;
  const clear = useAuthStore((s) => s.clear);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50">
      <aside className="glass flex w-64 shrink-0 flex-col border-r border-white/60 p-4">
        <div className="mb-4 flex items-center gap-2 px-3 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
            <Box className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-800">
              {businessName}
            </span>
            {businessId && (
              <span className="text-xs text-slate-500 font-mono">
                {businessId}
              </span>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-blue-500/10 text-blue-700"
                    : "text-slate-600 hover:bg-blue-500/10 hover:text-blue-700",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="glass flex shrink-0 items-center justify-between border-b border-white/60 px-6 py-3">
          <div className="relative w-72 max-w-[40%]">
            <Input
              readOnly
              placeholder="Search (coming soon)"
              className="rounded-xl border-slate-200/50 bg-slate-100/80 pl-10 text-sm"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              ⌕
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-2 py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-xs font-bold text-white">
                {(businessName ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <span className="hidden max-w-[200px] truncate text-sm font-medium text-slate-700 sm:inline">
                {businessName}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200/80"
              onClick={() => {
                clear();
                router.replace("/login");
              }}
            >
              <LogOut className="mr-1 h-4 w-4" />
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
