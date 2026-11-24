import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const dmSans = localFont({
  src: [
    { path: "../fonts/dm-sans-latin-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/dm-sans-latin-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-sans-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/dm-sans-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/dm-sans-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hardware Sales & Inventory",
  description: "Inventory, orders, and debt tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${dmSans.variable} min-h-full font-sans antialiased`}
        style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
