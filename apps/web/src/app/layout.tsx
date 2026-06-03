import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { LuxuryBackground } from "@/components/layout/luxury-background";
import { LuxuryCursor } from "@/components/layout/luxury-cursor";

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
  title: "Restaurant ERP",
  description: "Plataforma SaaS multi-tenant para restaurantes",
};

// Luxury restaurant interior — crystal chandelier, warm tones.
// Photo by Elyne Anthonissen on Unsplash (free license, no attribution required).
// Swap by editing this URL or dropping a JPG into apps/web/public/ and pointing
// here. The Unsplash CDN params keep the image sized + format-optimized.
const BG_IMAGE =
  "https://images.unsplash.com/photo-1502920764203-b859c2384716?auto=format&fit=crop&w=2400&q=80";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col text-white">
        <LuxuryBackground imageSrc={BG_IMAGE} />
        <LuxuryCursor />
        {children}
      </body>
    </html>
  );
}
