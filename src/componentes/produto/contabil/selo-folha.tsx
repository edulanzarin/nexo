"use client";

import { Dica } from "@/componentes/primitivos/dica";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { dataBR, num } from "@/lib/format";
import type { SeloFolha as DadosFolha } from "@/lib/folha-casamento";

/*
 * O carimbo "isso é pagamento a gente da casa" numa linha do extrato.
 *
 * Três leituras, porque levam a decisões diferentes:
 * - funcionário da empresa do extrato: comissão dele não é serviço de terceiro;
 * - ex-funcionário: acerto depois do desligamento é caso comum e passa batido
 *   quando só se olha "está na folha hoje?";
 * - de outra empresa da carteira: o caso que mais confunde em grupo econômico,
 *   presta serviço para uma e é registrado na outra.
 *
 * Casamento fraco (nome parecido, sem CPF) e homônimo aparecem como dúvida
 * explícita: o selo nunca afirma mais do que sabe, porque classificar na pessoa
 * errada é pior do que não classificar. Nenhum selo decide conta: é contexto
 * para quem decide.
 */

function leitura(s: DadosFolha) {
  const desligado = !!s.datadem;
  const duvida = s.via === "parcial" || s.homonimos > 0;
  const papel = desligado ? "Ex-funcionário" : "Funcionário";
  const tom: Tom = duvida ? "atencao" : desligado ? "neutro" : "rota";
  const curto = `${duvida ? "Talvez " : ""}${duvida ? papel.toLowerCase() : papel}${s.mesmaEmpresa ? "" : " de outra empresa"}`;
  const quando = desligado ? `desligado em ${dataBR(s.datadem)}` : s.dataadm ? `desde ${dataBR(s.dataadm)}` : null;
  const via =
    s.via === "cpf" ? "Pelo CPF do extrato" : s.via === "nome" ? "Pelo nome completo" : "Nome parecido, não idêntico";
  return { desligado, duvida, papel, tom, curto, quando, via };
}

/** O selo da linha: curto, com a pessoa e o motivo na dica. */
export function SeloFolha({ selo, className }: { selo: DadosFolha; className?: string }) {
  const l = leitura(selo);
  const dica = [
    `${selo.nome}${selo.mesmaEmpresa ? "" : ` · ${selo.empresaNome ?? `empresa ${selo.empresa}`}`}`,
    l.quando,
    l.via.toLowerCase(),
    selo.homonimos > 0 ? `${num(selo.homonimos + 1)} pessoas com esse nome na carteira` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Dica texto={dica}>
      <Selo tom={l.tom} icone="usuario" className={className}>
        {l.curto}
      </Selo>
    </Dica>
  );
}

/** A ficha da pessoa no detalhe do lançamento, sem nada escondido em dica. */
export function FichaFolha({ selo }: { selo: DadosFolha }) {
  const l = leitura(selo);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      <Par rotulo="Na folha" className="col-span-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{selo.nome}</span>
          <Selo tom={l.tom} icone="usuario">
            {l.curto}
          </Selo>
        </span>
      </Par>
      <Par rotulo="Empresa do vínculo">
        {selo.mesmaEmpresa ? "A do extrato" : (selo.empresaNome ?? `Empresa ${selo.empresa}`)}
      </Par>
      <Par rotulo="Contrato">
        <span className="num">{selo.contrato}</span>
      </Par>
      <Par rotulo={l.desligado ? "Desligamento" : "Admissão"}>
        <span className="num">{dataBR(l.desligado ? selo.datadem : selo.dataadm)}</span>
      </Par>
      <Par rotulo="Como casou" className="col-span-2">
        {l.via}
        {selo.homonimos > 0 && (
          <span className="text-atencao"> · {num(selo.homonimos + 1)} pessoas com esse nome na carteira</span>
        )}
      </Par>
    </dl>
  );
}
