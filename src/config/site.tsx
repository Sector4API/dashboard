import { LayoutDashboard, ShoppingBag, FileText, type LucideIcon } from "lucide-react";

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
];
