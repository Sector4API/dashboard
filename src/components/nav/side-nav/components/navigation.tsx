"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navigations, logoutNav } from "@/config/site";
import { cn } from "@/lib/utils";
import { dashboardSupabase, createSupabaseClient } from "@/lib/supabase";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = async (href: string) => {
    if (href === "/logout") {
      try {
        // Sign out from dashboard Supabase
        await dashboardSupabase.auth.signOut();
        
        // Sign out from products Supabase
        const productsSupabase = createSupabaseClient('product');
        await productsSupabase.auth.signOut();

        // Clear the authentication cookie
        document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; secure; samesite=strict';
        router.push("/login");
        router.refresh();
      } catch (error) {
        console.error("Error during logout:", error);
      }
      return;
    }
    // Handle regular navigation
    router.push(href);
  };

  const NavButton = ({ icon: Icon, name, href }: { icon: any, name: string, href: string }) => (
    <button
      onClick={() => handleNavigation(href)}
      className={cn(
        "flex items-center rounded-md px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 w-full text-left",
        pathname === href
          ? "bg-slate-200 dark:bg-slate-800"
          : "bg-transparent",
      )}
    >
      <Icon
        size={16}
        className="mr-2 text-slate-800 dark:text-slate-200"
      />
      <span className="text-lg text-slate-700 dark:text-slate-300">
        {name}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Main navigation */}
      <nav className="flex-grow flex flex-col gap-y-1 p-2">
        {navigations.map((navigation) => (
          <NavButton
            key={navigation.name}
            icon={navigation.icon}
            name={navigation.name}
            href={navigation.href}
          />
        ))}
      </nav>

      {/* Logout button at bottom */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <NavButton
          icon={logoutNav.icon}
          name={logoutNav.name}
          href={logoutNav.href}
        />
      </div>
    </div>
  );
}
