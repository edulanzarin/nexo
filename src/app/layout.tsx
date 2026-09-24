import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { Provedores } from "@/componentes/casca/provedores";
import { SCRIPT_TEMA } from "@/componentes/casca/tema";
import "./globals.css";

/**
 * Instrument Sans: grotesca com eixo de largura. O texto corre na largura
 * normal e o número de indicador estreita (82%), o que cabe mais dígito na
 * mesma célula sem perder corpo, que é a régua do sistema: bonito e denso.
 */
const fonte = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--fonte-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NaveX", template: "%s · NaveX" },
  description: "Plataforma de trabalho da Navecon sobre o Questor",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
    { media: "(prefers-color-scheme: light)", color: "#edf0f6" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fonte.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
