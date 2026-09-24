import type { Metadata } from "next";
import { Suspense } from "react";
import { MolduraCatalogo } from "./moldura";

export const metadata: Metadata = {
  title: "Catálogo de componentes",
  robots: { index: false, follow: false },
};

export default function LayoutSistema({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <MolduraCatalogo>{children}</MolduraCatalogo>
    </Suspense>
  );
}
