import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk, Martian_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./_components/ConvexClientProvider";
import { LocaleProvider } from "./_i18n/LocaleProvider";
import { getServerLocale } from "./_i18n/server";
import { getStrings } from "./_i18n/getStrings";

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const S = getStrings(locale);
  return {
    title: S.meta.title,
    description: S.meta.description,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ConvexClientProvider>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
