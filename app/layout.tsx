import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SelectedCardsProvider } from "@/contexts/SelectedCardsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Providers } from "@/app/providers";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Covelo",
  description: "The all in one companion for points maxing travelers",
};

// viewport-fit=cover lets the bottom tab bar pad for the iPhone home indicator
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers><ThemeProvider><AuthProvider><SelectedCardsProvider>{children}<Suspense fallback={null}><MobileTabBar /></Suspense></SelectedCardsProvider></AuthProvider></ThemeProvider></Providers>
      </body>
    </html>
  );
}
