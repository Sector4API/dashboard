'use client';

import { TopNav, SideNav } from "@/components/nav";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast-provider";

interface Props {
  children: React.ReactNode;
  params?: { [key: string]: string | string[] | undefined };
}

export default function DashboardLayout({ children }: Props) {
  const pathname = usePathname();

  // Get the title from the pathname
  const getTitle = () => {
    const path = pathname.split('/').filter(Boolean);
    if (path.length === 0) return 'Dashboard';
    return path[0].charAt(0).toUpperCase() + path[0].slice(1);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav title={getTitle()} />
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-y-auto p-6">
          <ToastProvider>
            {children}
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}
