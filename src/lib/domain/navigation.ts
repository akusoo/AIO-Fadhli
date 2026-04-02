import type { NavigationKey } from "@/lib/domain/models";

export type NavigationItem = {
  key: NavigationKey;
  label: string;
  href: string;
  description: string;
  icon: string;
};

export const navigationItems: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    description: "Ringkasan lintas modul",
    icon: "layout-grid",
  },
  {
    key: "finance",
    label: "Keuangan",
    href: "/finance",
    description: "Transaksi, budget, dan akun",
    icon: "wallet",
  },
  {
    key: "debts",
    label: "Hutang",
    href: "/debts",
    description: "Cicilan, pembayaran, jatuh tempo",
    icon: "hand-coins",
  },
  {
    key: "tasks",
    label: "Tasks",
    href: "/tasks",
    description: "To-do list cepat dan prioritas",
    icon: "list-checks",
  },
  {
    key: "projects",
    label: "Projects",
    href: "/projects",
    description: "Board untuk project aktif",
    icon: "kanban-square",
  },
  {
    key: "notes",
    label: "Notes",
    href: "/notes",
    description: "Catatan standalone dan terhubung",
    icon: "notebook-tabs",
  },
  {
    key: "wishlist",
    label: "Wishlist",
    href: "/wishlist",
    description: "Barang incaran dan target harga",
    icon: "sparkles",
  },
  {
    key: "shopping",
    label: "Belanja",
    href: "/shopping",
    description: "Daftar yang harus dibeli",
    icon: "shopping-cart",
  },
];

export const mobilePrimaryKeys: NavigationKey[] = [
  "dashboard",
  "finance",
  "tasks",
  "projects",
];
