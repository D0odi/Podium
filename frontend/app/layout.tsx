import { ThemeProvider } from "@/components/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Podium",
  description: "AI audience scene and demo controls",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh h-full flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* <header className="w-full gap-2 h-20 flex items-center absolute top-0 p-4 z-20 bg-transparent shrink-0">
            <div className="text-sm tracking-tight border-2 border-accent py-2 px-3 rounded-md">
              Public Scene AI <span aria-hidden>🤖</span>
            </div>
          </header> */}
          <main className="flex-1 min-h-0">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
