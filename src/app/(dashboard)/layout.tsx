'use client';

import { TopNav, SideNav } from "@/components/nav";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast-provider";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  children: React.ReactNode;
  params?: { [key: string]: string | string[] | undefined };
}

export default function DashboardLayout({ children }: Props) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Remove handleRouteChange declaration since it's unused
    router.prefetch('/dashboard/templates');
    router.prefetch('/dashboard.admin');

    return () => {
      // Cleanup logic if needed
    };
  }, [router]);

  // Get the title from the pathname
  const getTitle = () => {
    const path = pathname.split('/').filter(Boolean);
    if (path.length === 0) return 'Dashboard';
    return path[path.length - 1].charAt(0).toUpperCase() + path[path.length - 1].slice(1);
  };

  return (
    <ToastProvider>
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <div className="flex h-screen w-screen flex-col">
        <TopNav title={getTitle()} />
        <div className="flex flex-1">
          <SideNav />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
