import { LayoutDashboard, ShoppingBag, FileText, User, LogOut, FolderOpen, type LucideIcon } from "lucide-react";

export type SiteConfig = typeof siteConfig;
export type Navigation = {
  icon: LucideIcon;
  name: string;
  href: string;
};

export const siteConfig = {
  title: "VisActor Next Template",
  description: "Template for VisActor and Next.js",
};

export const navigations: Navigation[] = [
  {
    icon: LayoutDashboard,
    name: "Admin",
    href: "/",
  },
  {
    icon: ShoppingBag,
    name: "Products",
    href: "/products",
  },
  {
    icon: FileText,
    name: "Templates",
    href: "/templates",
  },
  {
    icon: FolderOpen,
    name: "Category",
    href: "/category",
  },
  {
    icon: User,
    name: "Users",
    href: "/users",
  },
];

// Export logout configuration separately
export const logoutNav: Navigation = {
  icon: LogOut,
  name: "Logout",
  href: "/logout",
};
