import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/inter";
import "@fontsource-variable/urbanist";
import { ScrollNavigation } from "@/components/scroll-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ingresar | Teklease",
  description: "Acceso seguro al portal administrativo de Teklease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
        <ThemeToggle />
        <ScrollNavigation />
      </body>
    </html>
  );
}
