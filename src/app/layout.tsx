import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/urbanist";
import { ScrollNavigation } from "@/components/scroll-navigation";
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
    <html lang="es">
      <body>
        {children}
        <ScrollNavigation />
      </body>
    </html>
  );
}
