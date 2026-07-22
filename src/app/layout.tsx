import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Race Finder",
  description: "Find running races to participate in — filter by date, distance, location, and entry criteria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="border-b">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-xl font-bold tracking-tight">
                🏃 Race Finder
              </Link>
              <nav className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/">Find races</Link>
                </Button>
                <Button asChild>
                  <Link href="/submit">Submit a race</Link>
                </Button>
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
