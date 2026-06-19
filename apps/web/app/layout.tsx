import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "7a0 — Match Viewer (M2)",
  description: "Watch a 7a0 match in 2D, read it as text, or get the instant result.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
