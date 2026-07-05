import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Agora — Exchange Console",
  description:
    "A first-principles electronic exchange & market-microstructure simulator running live in the browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
