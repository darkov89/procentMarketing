import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNavbar } from "@/components/navigation/app-navbar";

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
      <body className="min-h-full flex flex-col bg-[#0A0E17] text-[#F8FAFC]">
        <AppNavbar />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
