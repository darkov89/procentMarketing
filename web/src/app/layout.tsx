import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Machine — Autonomiczny System Pozyskiwania Klientów B2B | Procent Marketing",
  description: "Zaawansowany system automatyzacji procesów pozyskiwania leadów, weryfikacji w rejestrach i hiper-personalizacji ofert.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0A0E17] text-[#F8FAFC]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
