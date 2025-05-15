import { Providers } from '@/app/providers';
import { cn } from "@/lib/utils";
import { Gabarito } from "next/font/google";
import "@/style/globals.css";

const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito" });

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("h-full bg-slate-50 font-sans antialiased dark:bg-slate-900", gabarito.variable)}>
      <Providers>
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-md space-y-8 px-4 py-8">
            {children}
          </div>
        </div>
      </Providers>
    </div>
  );
}
