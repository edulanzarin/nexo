import { StatTile } from "@/components/ui";

/** Card de KPI das telas do módulo Contábil (conferência e contas). */
export function Kpi({
  rotulo,
  icone,
  corIcone,
  valor,
  secundario,
  alerta,
}: {
  rotulo: string;
  icone: React.ReactNode;
  corIcone: string;
  valor: string;
  secundario: string;
  alerta?: boolean;
}) {
  return (
    <StatTile
      size="md"
      rotulo={rotulo}
      icon={icone}
      iconTint={corIcone}
      valor={valor}
      secundario={secundario}
      alerta={alerta}
    />
  );
}
