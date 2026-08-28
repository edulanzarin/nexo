"use client";

import { UserCheck, UserSearch } from "lucide-react";
import { Badge } from "@/components/ui";
import { dataBR } from "@/lib/format";
import type { SeloFolha as Selo } from "@/lib/folha-casamento";

/**
 * O carimbo "isso é pagamento a gente da casa" numa linha do extrato.
 *
 * Três leituras, porque as três levam a decisões diferentes:
 *
 * - **Funcionário** da empresa do extrato → comissão dele não é serviço de
 *   terceiro.
 * - **Ex-funcionário**, com a data → acerto pós-desligamento é caso comum e
 *   passa batido quando só se olha "está na folha hoje?".
 * - **De outra empresa** da carteira → o caso que mais confunde em grupo
 *   econômico: presta serviço para uma e é registrado na outra.
 *
 * Casamento fraco (nome truncado, sem CPF) e homônimo aparecem como dúvida
 * explícita: o selo nunca afirma mais do que sabe, porque classificar na pessoa
 * errada é pior do que não classificar.
 */
export function SeloFolha({ selo }: { selo: Selo }) {
  const desligado = !!selo.datadem;
  const certo = selo.via === "cpf" || selo.via === "nome";
  const duvida = !certo || selo.homonimos > 0;

  const papel = desligado ? "Ex-funcionário" : "Funcionário";
  const onde = selo.mesmaEmpresa
    ? ""
    : ` · ${selo.empresaNome ?? `empresa ${selo.empresa}`}`;

  const quando = desligado
    ? `desligado em ${dataBR(selo.datadem!)}`
    : selo.dataadm
      ? `desde ${dataBR(selo.dataadm)}`
      : "";

  const detalhe = [
    selo.via === "cpf"
      ? "casou pelo CPF do extrato"
      : selo.via === "nome"
        ? "casou pelo nome completo"
        : "nome parecido, não idêntico — confira antes de classificar",
    selo.homonimos > 0
      ? `${selo.homonimos + 1} pessoas com esse nome na sua carteira`
      : "",
    `contrato ${selo.contrato}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // O title mora no span: o Badge é só apresentação e não recebe atributo de
    // DOM. É onde fica o "por que este selo apareceu", que a linha não comporta.
    <span title={detalhe} className="mt-0.5 inline-flex">
      <Badge tone={duvida ? "warning" : desligado ? "sai" : "good"} size="xs">
        {duvida ? <UserSearch className="size-3" /> : <UserCheck className="size-3" />}
        <span>
          {duvida && selo.via === "parcial" ? "Talvez " : ""}
          {papel}: {selo.nome}
          {onde}
          {quando ? ` · ${quando}` : ""}
          {selo.homonimos > 0 ? ` · ${selo.homonimos + 1} homônimos` : ""}
        </span>
      </Badge>
    </span>
  );
}
