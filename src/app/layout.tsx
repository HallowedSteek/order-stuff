import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wolt API POC",
  description: "Proof of concept against the unofficial Wolt API",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
