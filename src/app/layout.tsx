import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IEM-UEM Kiosk",
  description: "IEM-UEM kiosk display and admin portal",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
