import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficeStock | Stationery & Pantry Inventory",
  description: "Office inventory, stock movements, staff requests and reorder planning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
