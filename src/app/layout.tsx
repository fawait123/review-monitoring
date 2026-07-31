import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Review Monitor",
  description: "Monitoring & review PR GitHub dengan Pi agent",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b">
          <nav className="flex items-center gap-6 px-6 h-14 max-w-7xl mx-auto w-full">
            <Link href="/" className="font-semibold tracking-tight">
              Review<span className="text-primary">Monitor</span>
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Analytics
            </Link>
          </nav>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">{children}</main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
