import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { MARCA, tituloPagina } from "@/lib/marca";

// Fonte única do sistema. Geist cobre tudo — inclusive números, via tabular-nums.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: tituloPagina(),
  description: `${MARCA} — plataforma da Navecon sobre a base do Questor`,
};

const themeInit = `(function(){try{var t=localStorage.getItem("nexo-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Sem sidebar aqui: o launcher (/) e cada módulo trazem a própria
            casca. Este layout guarda só o que é global — tema, fontes, providers. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
