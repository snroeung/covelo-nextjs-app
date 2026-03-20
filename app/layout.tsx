import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SelectedCardsProvider } from "@/contexts/SelectedCardsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Providers } from "@/app/providers";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers><ThemeProvider><SelectedCardsProvider>{children}</SelectedCardsProvider></ThemeProvider></Providers>
      </body>
    </html>
  );
}
