import type { Metadata } from "next";
import { Gabarito } from "next/font/google";
import { cn } from "@/lib/utils";
import "@/style/globals.css";
import { Providers } from "./providers";

const gabarito = Gabarito({ subsets: ["latin"], variable: "--font-gabarito" });

export const metadata: Metadata = {
  title: "Dashboard",
  description: "A modern dashboard application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={cn("h-full overflow-hidden bg-slate-50 font-sans antialiased dark:bg-slate-900", gabarito.variable)}>
        <Providers>
          <div className="h-full overflow-auto">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
