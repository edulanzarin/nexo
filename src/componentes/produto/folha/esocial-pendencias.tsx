"use client";

import { Vazio } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { dataBR, num } from "@/lib/format";
import type { EsocialSituacao, PendenciaEsocial } from "@/lib/types";

/*
 * Situação de um evento no eSocial, pela regra de `conformidade-esocial`:
 * recibo preenchido é aceito; sem recibo e status 13 é rejeitado; sem recibo e
 * sem rejeição é pendente; sem transação nenhuma é não enviado.
 */

export const ROTULO_ESOCIAL: Record<EsocialSituacao, string> = {
  aceito: "Aceito",
  pendente: "Sem recibo",
  rejeitado: "Rejeitado",
  nao_enviado: "Não enviado",
};

export const TOM_ESOCIAL: Record<EsocialSituacao, Tom> = {
  aceito: "ok",
  pendente: "atencao",
  rejeitado: "perigo",
  nao_enviado: "perigo",
};

export function SeloEsocial({ situacao }: { situacao: EsocialSituacao }) {
  return <Selo tom={TOM_ESOCIAL[situacao]}>{ROTULO_ESOCIAL[situacao]}</Selo>;
}

/**
 * Uma pendência obrigatória do eSocial: admitidos sem S-2200 aceito ou
 * desligados sem S-2299 aceito. A contagem vai no cabeçalho para quem só quer
 * saber se tem; lista vazia é o estado bom e diz isso.
 */
export function ListaPendenciasEsocial({
  titulo,
  descricao,
  icone,
  rotuloData,
  itens,
  vazio,
  className,
}: {
  titulo: string;
  descricao: string;
  icone: NomeIcone;
  /** O fato que a data marca: "Admissão" ou "Desligamento". */
  rotuloData: string;
  itens: PendenciaEsocial[];
  vazio: string;
  className?: string;
}) {
  const colunas: Coluna<PendenciaEsocial>[] = [
    {
      id: "funcionario",
      cabecalho: "Funcionário",
      largura: "60%",
      ordenar: (p) => p.funcionario,
      celula: (p) => (
        <span className="block truncate text-tinta" title={p.funcionario}>
          {p.funcionario}
        </span>
      ),
    },
    {
      id: "data",
      cabecalho: rotuloData,
      ordenar: (p) => p.data,
      celula: (p) => <span className="num">{dataBR(p.data)}</span>,
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      alinhar: "dir",
      ordenar: (p) => ROTULO_ESOCIAL[p.situacao],
      celula: (p) => <SeloEsocial situacao={p.situacao} />,
    },
  ];
  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      icone={icone}
      corpo="p-0"
      className={className}
      acoes={<Selo tom={itens.length ? "atencao" : "ok"}>{num(itens.length)}</Selo>}
    >
      {itens.length === 0 ? (
        <Vazio compacto icone="ok" titulo={vazio} />
      ) : (
        <TabelaDados
          rotulo={titulo}
          colunas={colunas}
          linhas={itens}
          chave={(p) => String(p.contrato)}
          alturaMax="22rem"
        />
      )}
    </Painel>
  );
}
