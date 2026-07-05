import "./globals.css";
import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project Agora — Exchange Console",
  description:
    "A first-principles electronic exchange & market-microstructure simulator running live in the browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
