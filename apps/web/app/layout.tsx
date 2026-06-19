import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "7a0 — Match Viewer",
  description: "Read a 7a0 match as a text ticker or get the instant result.",
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
