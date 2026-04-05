"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  HandCoins,
  KanbanSquare,
  LayoutGrid,
  ListChecks,
  Menu,
  NotebookTabs,
  ShoppingCart,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Input, QuickJumpTrigger } from "@/components/ui";
import { mobilePrimaryKeys, navigationItems } from "@/lib/domain/navigation";
import { formatDate, isoToday } from "@/lib/utils";
import { useAppState } from "@/providers/app-state-provider";
import { cn } from "@/lib/utils";

const iconMap = {
  "hand-coins": HandCoins,
  "kanban-square": KanbanSquare,
  "layout-grid": LayoutGrid,
  "list-checks": ListChecks,
  "notebook-tabs": NotebookTabs,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
  wallet: Wallet,
};

type QuickJumpItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  group: "modules" | "attention";
  meta?: string;
};

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "A";
}

function NavigationLink({
  item,
  active,
  onClick,
}: {
  item: (typeof navigationItems)[number];
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = iconMap[item.icon as keyof typeof iconMap];

  return (
    <Link
      className={cn(
        "group flex items-center gap-3 rounded-[20px] border px-3.5 py-3 transition-all duration-150",
        active
          ? "border-[rgba(15,90,86,0.14)] bg-[rgba(26,130,121,0.14)] text-[var(--foreground)] shadow-[var(--shadow-sm)]"
          : "border-transparent bg-transparent text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[rgba(255,255,255,0.64)]",
      )}
      href={item.href}
      onClick={onClick}
      prefetch
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[16px] transition-colors",
          active
            ? "bg-[rgba(255,255,255,0.72)] text-[var(--accent-strong)]"
            : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
        )}
      >
        <Icon className="size-4" strokeWidth={2.15} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          {item.label}
        </span>
        <span
          className={cn(
            "block text-xs leading-5",
            active ? "text-[rgba(23,37,47,0.7)]" : "text-[var(--muted)]",
          )}
        >
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function MobileNav({
  pathname,
  onOpenMore,
}: {
  pathname: string;
  onOpenMore: () => void;
}) {
  const primaryItems = navigationItems.filter((item) =>
    mobilePrimaryKeys.includes(item.key),
  );

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-[24px] border border-[var(--border)] bg-[rgba(255,252,248,0.94)] p-2 shadow-[var(--shadow-lg)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1.5">
        {primaryItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const active = pathname === item.href;

          return (
            <Link
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[18px] border px-2 py-2.5 text-[11px] font-medium transition-colors",
                active
                  ? "border-[rgba(15,90,86,0.14)] bg-[rgba(26,130,121,0.14)] text-[var(--accent-strong)] shadow-[var(--shadow-sm)]"
                  : "border-transparent text-[var(--muted)] hover:bg-white",
              )}
              href={item.href}
              key={item.key}
              prefetch
            >
              <Icon className="size-4" strokeWidth={2.1} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          className="flex flex-col items-center gap-1.5 rounded-[18px] border border-black bg-black px-2 py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-black/90"
          onClick={onOpenMore}
          type="button"
        >
          <Menu className="size-4" strokeWidth={2.1} />
          <span>Lainnya</span>
        </button>
      </div>
    </div>
  );
}

function QuickJumpSection({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: QuickJumpItem[];
  onSelect: () => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="px-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            className="flex items-start justify-between gap-3 rounded-[18px] border border-transparent bg-[rgba(255,255,255,0.6)] px-4 py-3 transition-all duration-150 hover:border-[var(--border)] hover:bg-white hover:shadow-[var(--shadow-sm)]"
            href={item.href}
            key={item.id}
            onClick={onSelect}
            prefetch
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                {item.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.meta ? (
                <span className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {item.meta}
                </span>
              ) : null}
              <ArrowUpRight className="size-4 text-[var(--muted)]" strokeWidth={2} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState("");
  const { snapshot } = useAppState();
  const overflowItems = navigationItems.filter(
    (item) => !mobilePrimaryKeys.includes(item.key),
  );
  const activeNavigationItem =
    navigationItems.find((item) => pathname === item.href) ?? navigationItems[0];
  const sessionInitials = initialsFromName(snapshot.session.name);

  const quickJumpItems = useMemo(() => {
    const today = isoToday();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const dueLimit = sevenDaysFromNow.toISOString().slice(0, 10);

    const moduleItems: QuickJumpItem[] = navigationItems.map((item) => ({
      id: `module-${item.key}`,
      label: item.label,
      detail: item.description,
      href: item.href,
      group: "modules",
      meta: "modul",
    }));

    const taskItems = snapshot.tasks
      .filter((task) => task.status !== "done")
      .filter(
        (task) =>
          task.todayPinned ||
          (task.dueOn ? task.dueOn <= today : false) ||
          (task.reminderAt ? task.reminderAt.slice(0, 10) <= today : false),
      )
      .slice(0, 4)
      .map((task) => ({
        id: `task-${task.id}`,
        label: task.title,
        detail:
          task.dueOn && task.dueOn <= today
            ? `Task • perlu perhatian sejak ${formatDate(task.dueOn)}`
            : task.todayPinned
              ? "Task • di-pin ke today"
              : "Task • reminder aktif hari ini",
        href: "/tasks",
        group: "attention" as const,
        meta: "task",
      }));

    const debtItems = snapshot.debtInstallments
      .filter((installment) => installment.status !== "paid")
      .filter((installment) => installment.dueOn <= dueLimit)
      .slice(0, 3)
      .map((installment) => {
        const debt = snapshot.debts.find((item) => item.id === installment.debtId);

        return {
          id: `debt-${installment.id}`,
          label: debt ? `${debt.name} • cicilan ${installment.installmentNumber}` : "Cicilan",
          detail:
            installment.dueOn < today
              ? `Hutang • overdue sejak ${formatDate(installment.dueOn)}`
              : `Hutang • jatuh tempo ${formatDate(installment.dueOn)}`,
          href: "/debts",
          group: "attention" as const,
          meta: "hutang",
        };
      });

    const shoppingItems = snapshot.shoppingItems
      .filter((item) => item.status === "buying" || item.status === "bought")
      .slice(0, 3)
      .map((item) => ({
        id: `shopping-${item.id}`,
        label: item.name,
        detail:
          item.status === "buying"
            ? `Belanja • sedang diproses di ${item.section}`
            : "Belanja • sudah dibeli, cek pencatatan keuangan",
        href: "/shopping",
        group: "attention" as const,
        meta: "belanja",
      }));

    const wishItems = snapshot.wishItems
      .filter((item) => item.status === "ready")
      .slice(0, 3)
      .map((item) => ({
        id: `wish-${item.id}`,
        label: item.name,
        detail: `Wishlist • siap dipindah ke shopping`,
        href: "/wishlist",
        group: "attention" as const,
        meta: "wish",
      }));

    return [...moduleItems, ...debtItems, ...taskItems, ...shoppingItems, ...wishItems];
  }, [snapshot]);

  const filteredQuickJumpItems = useMemo(() => {
    const normalizedQuery = quickJumpQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return quickJumpItems;
    }

    return quickJumpItems.filter((item) =>
      `${item.label} ${item.detail} ${item.meta ?? ""}`.toLowerCase().includes(normalizedQuery),
    );
  }, [quickJumpItems, quickJumpQuery]);

  const moduleJumpItems = filteredQuickJumpItems.filter((item) => item.group === "modules");
  const attentionJumpItems = filteredQuickJumpItems.filter((item) => item.group === "attention");
  const openQuickJump = () => setIsQuickJumpOpen(true);
  const closeQuickJump = () => {
    setIsQuickJumpOpen(false);
    setQuickJumpQuery("");
  };
  const toggleQuickJump = useEffectEvent(() => {
    if (isQuickJumpOpen) {
      closeQuickJump();
      return;
    }

    openQuickJump();
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleQuickJump();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip pb-28 lg:pb-0">
      <div className="mx-auto flex max-w-[1560px] gap-5 px-4 py-4 md:px-6 lg:px-8 lg:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[288px] shrink-0 rounded-[30px] border border-[var(--border)] bg-[rgba(255,252,249,0.78)] p-4 shadow-[var(--shadow-md)] backdrop-blur lg:flex lg:flex-col">
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.68)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              AIO Tracker
            </p>
            <h1 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Sistem pribadi yang tetap tenang dipakai setiap hari.
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Task, keuangan, hutang, project, note, wishlist, dan belanja dalam satu ritme yang rapi.
            </p>
          </div>

          <QuickJumpTrigger
            className="mt-4 w-full"
            label="Cari modul atau fokus"
            onClick={openQuickJump}
          />

          <nav className="mt-5 flex flex-1 flex-col gap-1.5 overflow-auto pr-1">
            {navigationItems.map((item) => (
              <NavigationLink
                active={pathname === item.href}
                item={item}
                key={item.key}
              />
            ))}
          </nav>

          <form action="/auth/sign-out" className="mt-4" method="post">
            <button
              className="inline-flex min-h-10 w-full items-center justify-center rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.68)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-white"
              type="submit"
            >
              Keluar
            </button>
          </form>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          <header className="mb-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,252,249,0.74)] px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  {activeNavigationItem.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {activeNavigationItem.description} • {new Intl.DateTimeFormat("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date())}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <QuickJumpTrigger
                  className="min-w-[220px]"
                  label="Cari cepat"
                  onClick={openQuickJump}
                />
                <div className="hidden items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.76)] px-3 py-2 shadow-[var(--shadow-sm)] sm:flex">
                  <span className="flex size-9 items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent-strong)]">
                    {sessionInitials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                      {snapshot.session.name}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">{snapshot.session.location}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>

      <MobileNav pathname={pathname} onOpenMore={() => setIsMobileOpen(true)} />

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(23,37,47,0.38)] px-4 py-5 lg:hidden">
          <div className="absolute inset-0" onClick={() => setIsMobileOpen(false)} />
          <div className="relative ml-auto flex h-full max-h-[560px] w-full max-w-sm flex-col rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-5 shadow-[var(--shadow-lg)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Navigasi
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  Modul lain
                </h2>
              </div>
              <button
                className="flex size-11 items-center justify-center rounded-[16px] border border-[var(--border)] bg-white"
                onClick={() => setIsMobileOpen(false)}
                type="button"
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
            </div>
            <QuickJumpTrigger
              className="w-full"
              label="Cari modul"
              onClick={() => {
                setIsMobileOpen(false);
                openQuickJump();
              }}
            />
            <div className="mt-4 flex flex-1 flex-col gap-2 overflow-auto">
              {overflowItems.map((item) => (
                <NavigationLink
                  active={pathname === item.href}
                  item={item}
                  key={item.key}
                  onClick={() => setIsMobileOpen(false)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {isQuickJumpOpen ? (
        <div className="fixed inset-0 z-[60] bg-[rgba(23,37,47,0.34)] px-4 py-6 md:px-6">
          <div className="absolute inset-0" onClick={closeQuickJump} />
          <div className="relative mx-auto flex h-full max-h-[680px] w-full max-w-2xl flex-col rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-4 shadow-[var(--shadow-lg)] md:p-5">
            <div className="flex items-center gap-3">
              <Input
                autoFocus
                onChange={(event) => setQuickJumpQuery(event.target.value)}
                placeholder="Cari modul atau item penting"
                value={quickJumpQuery}
              />
              <button
                className="flex size-11 shrink-0 items-center justify-center rounded-[16px] border border-[var(--border)] bg-white"
                onClick={closeQuickJump}
                type="button"
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-auto">
              {moduleJumpItems.length === 0 && attentionJumpItems.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.55)] px-5 py-10 text-center">
                  <p className="text-base font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                    Tidak ada hasil yang cocok
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Coba kata kunci lain untuk modul atau item yang sedang perlu perhatian.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <QuickJumpSection
                    items={moduleJumpItems}
                    onSelect={closeQuickJump}
                    title="Modul"
                  />
                  <QuickJumpSection
                    items={attentionJumpItems}
                    onSelect={closeQuickJump}
                    title="Perlu perhatian"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
              <p>Lompat cepat ke modul atau item penting.</p>
              <span className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono uppercase tracking-[0.16em]">
                Ctrl K
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
