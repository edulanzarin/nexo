import clsx from "clsx";
import { MarcaPublicaRh } from "@/components/logo-marca";

/**
 * Moldura das telas PÚBLICAS do canal do RH (denúncia, acompanhamento, clima) —
 * sem sidebar nem chrome do app, centrada e enxuta, boa no celular (o acesso é
 * por link/QR). Presentacional: pode ser usada em server ou client component.
 */
export function ShellPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <MarcaPublicaRh className="mb-6" />
        {children}
      </div>
    </div>
  );
}

export function AvisoPublico({
  titulo,
  texto,
  tom = "neutro",
}: {
  titulo: string;
  texto: string;
  tom?: "neutro" | "bom";
}) {
  return (
    <div className="card px-6 py-8 text-center">
      <h1 className={clsx("text-lg font-semibold", tom === "bom" ? "text-good" : "text-ink")}>
        {titulo}
      </h1>
      <p className="mt-2 text-sm text-muted">{texto}</p>
    </div>
  );
}
