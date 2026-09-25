"use client";

import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { num } from "@/lib/format";
import { nomeResponsavel } from "./fila-tabelas";

/*
 * Os filtros da fila do Acessórias. Moram na tela, e não no topo, porque não
 * disparam consulta cara: a fila já está materializada, então cada troca vai
 * direto ao servidor e volta na hora. Vão TODOS para o servidor: filtrar no
 * cliente faria os números do topo discordarem da tabela, que saem da mesma
 * consulta.
 *
 * O setor não é filtro: ele vem da seção (Contábil, Fiscal, DP), que é também
 * o que a permissão libera.
 */

export type RecorteFila = "todas" | "vencidas" | "multa";

export interface FiltrosTelaFila {
  respId: number | null;
  /** Nome de quem foi escolhido, para o combo dizer quem é mesmo quando a lista não o traz. */
  respNome: string | null;
  obrigacao: string | null;
  /** Janela de PRAZO, em ISO: é o prazo que define atraso, então é por ele que se filtra. */
  prazoDe: string;
  prazoAte: string;
  recorte: RecorteFila;
}

export const FILTROS_FILA_VAZIOS: FiltrosTelaFila = {
  respId: null,
  respNome: null,
  obrigacao: null,
  prazoDe: "",
  prazoAte: "",
  recorte: "todas",
};

/**
 * Filtros para a query da rota (`/api/obrigacoes/fila`). Só entra o que está
 * marcado, para a chave da consulta não variar por campo vazio.
 */
export function qsFiltrosFila(f: FiltrosTelaFila): string {
  const q = new URLSearchParams();
  if (f.respId != null) q.set("respId", String(f.respId));
  if (f.obrigacao) q.set("obrigacao", f.obrigacao);
  if (f.prazoDe) q.set("prazoDe", f.prazoDe);
  if (f.prazoAte) q.set("prazoAte", f.prazoAte);
  if (f.recorte === "vencidas") q.set("soVencidas", "1");
  if (f.recorte === "multa") q.set("soMulta", "1");
  return q.toString();
}

/** O que está marcado, dito como se afrouxa ("o responsável", "o prazo"). Vazia quando nada está. */
export function filtrosMarcados(f: FiltrosTelaFila): string[] {
  const l: string[] = [];
  if (f.respId != null) l.push("o responsável");
  if (f.obrigacao) l.push("a obrigação");
  if (f.prazoDe || f.prazoAte) l.push("o prazo");
  if (f.recorte === "vencidas") l.push("o recorte de vencidas");
  if (f.recorte === "multa") l.push("o recorte com multa");
  return l;
}

/** "a", "a ou b", "a, b ou c". */
export function listaOu(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ou ${itens[itens.length - 1]}`;
}

/** Uma opção de responsável. Sem `total`, a contagem é de outro recorte e não aparece. */
export interface OpcaoResponsavelFila {
  respId: number | null;
  respNome: string;
  total?: number;
}

export interface OpcaoObrigacaoFila {
  obrigacao: string;
  total?: number;
}

export function BarraFiltrosFila({
  valor,
  onMudar,
  responsaveis,
  obrigacoes,
}: {
  valor: FiltrosTelaFila;
  onMudar: (f: FiltrosTelaFila) => void;
  responsaveis?: OpcaoResponsavelFila[] | null;
  obrigacoes?: OpcaoObrigacaoFila[] | null;
}) {
  // Só quem tem id filtra: o grupo "sem responsável" não tem chave no servidor.
  const comId = (responsaveis ?? []).filter((r): r is OpcaoResponsavelFila & { respId: number } => r.respId != null);
  const opcoesResp: Opcao[] = [
    { valor: "", rotulo: "Todos os responsáveis" },
    ...comId.map((r) => ({
      valor: String(r.respId),
      rotulo: nomeResponsavel(r.respNome) ?? `Responsável ${r.respId}`,
      detalhe: r.total != null ? num(r.total) : undefined,
    })),
  ];
  // O escolhido sempre está na lista: sem ele o combo diria "Todos" com o filtro ligado.
  if (valor.respId != null && !comId.some((r) => r.respId === valor.respId)) {
    opcoesResp.push({ valor: String(valor.respId), rotulo: valor.respNome ?? `Responsável ${valor.respId}` });
  }

  const opcoesObrig: Opcao[] = [
    { valor: "", rotulo: "Todas as obrigações" },
    ...(obrigacoes ?? []).map((o) => ({
      valor: o.obrigacao,
      rotulo: o.obrigacao,
      detalhe: o.total != null ? num(o.total) : undefined,
    })),
  ];
  if (valor.obrigacao && !(obrigacoes ?? []).some((o) => o.obrigacao === valor.obrigacao)) {
    opcoesObrig.push({ valor: valor.obrigacao, rotulo: valor.obrigacao });
  }

  const marcado = filtrosMarcados(valor).length > 0;

  return (
    <div className="nx-sem-papel flex flex-wrap items-center gap-2">
      <Combo
        icone="usuario"
        opcoes={opcoesResp}
        valor={valor.respId != null ? String(valor.respId) : ""}
        onMudar={(v) => {
          const r = comId.find((x) => String(x.respId) === v);
          onMudar({ ...valor, respId: v ? Number(v) : null, respNome: v ? (r?.respNome ?? valor.respNome) : null });
        }}
        className="w-full sm:w-60"
        larguraMin={300}
        rotuloAcessivel="Filtrar por responsável"
      />
      <Combo
        icone="fila"
        opcoes={opcoesObrig}
        valor={valor.obrigacao ?? ""}
        onMudar={(v) => onMudar({ ...valor, obrigacao: v || null })}
        className="w-full sm:w-64"
        larguraMin={340}
        rotuloAcessivel="Filtrar por obrigação"
      />
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <span className="shrink-0 text-pequeno text-apagado">Prazo de</span>
        <Campo
          type="date"
          value={valor.prazoDe}
          max={valor.prazoAte || undefined}
          onChange={(e) => onMudar({ ...valor, prazoDe: e.target.value })}
          aria-label="Prazo a partir de"
          className="min-w-0 sm:w-36"
        />
        <span className="shrink-0 text-pequeno text-apagado">até</span>
        <Campo
          type="date"
          value={valor.prazoAte}
          min={valor.prazoDe || undefined}
          onChange={(e) => onMudar({ ...valor, prazoAte: e.target.value })}
          aria-label="Prazo até"
          className="min-w-0 sm:w-36"
        />
      </div>
      <Segmentado<RecorteFila>
        rotulo="Recorte da fila"
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          { valor: "vencidas", rotulo: "Vencidas" },
          { valor: "multa", rotulo: "Com multa" },
        ]}
        valor={valor.recorte}
        onMudar={(r) => onMudar({ ...valor, recorte: r })}
      />
      {marcado && (
        <Botao variante="fantasma" icone="fechar" onClick={() => onMudar(FILTROS_FILA_VAZIOS)}>
          Limpar filtros
        </Botao>
      )}
    </div>
  );
}
