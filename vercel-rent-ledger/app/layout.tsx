import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentKhata — Rent & Electricity Manager",
  description: "Manage occupants, rooms, shops, halls, rent and electricity bills in one place.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
