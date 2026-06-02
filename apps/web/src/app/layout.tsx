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

// To use a real luxury restaurant photo as the background, drop a JPG into
// apps/web/public/ (e.g. restaurant-bg.jpg) and uncomment the imageSrc prop
// on <LuxuryBackground />. Until then the CSS-only fallback is rendered.
const BG_IMAGE: string | undefined = undefined;

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
