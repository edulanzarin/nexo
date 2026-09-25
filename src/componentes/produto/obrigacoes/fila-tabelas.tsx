"use client";

import type { ReactNode } from "react";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { dataBR, documento, num } from "@/lib/format";
import type { EntregaFila, ObrigacaoFila, ResponsavelFila, SetorFila } from "@/lib/obrigacoes-tipos";
import { SeloAtraso } from "./fila-atraso";

/*
 * As tabelas da fila do Acessórias: os três recortes (quem responde, que
 * setor, que obrigação) e a fila em si. O recorte clicável filtra a fila
 * inteira, e clicar de novo na linha escolhida solta o filtro.
 */

/** Como o servidor agrupa as entregas sem dono (ver `montarPainelObrigacoes`). */
const SEM_RESPONSAVEL_SERVIDOR = "(sem responsável)";

/** O nome do responsável, ou null quando a entrega não tem dono. */
export function nomeResponsavel(nome: string | null | undefined): string | null {
  const n = nome?.trim();
  return !n || n === SEM_RESPONSAVEL_SERVIDOR ? null : n;
}

function Responsavel({ nome }: { nome: string | null }) {
  const n = nomeResponsavel(nome);
  return n ? (
    <span className="block truncate" title={n}>
      {n}
    </span>
  ) : (
    <span className="text-apagado">Sem responsável</span>
  );
}

/** Contagem que some no zero: numa coluna de vencidas, o traço deixa o número que importa saltar. */
function Contagem({ n }: { n: number }) {
  return n > 0 ? <>{num(n)}</> : <span className="text-apagado">—</span>;
}

/** Duas linhas numa célula: o nome e, apagado embaixo, o que o situa (CNPJ, setor). */
function DuasLinhas({ principal, apoio }: { principal: string; apoio?: string | null }) {
  return (
    <span className="flex min-w-0 flex-col py-1 leading-tight">
      <span className="truncate font-[560] text-tinta" title={principal}>
        {principal}
      </span>
      {apoio && (
        <span className="num truncate text-pequeno text-apagado" title={apoio}>
          {apoio}
        </span>
      )}
    </span>
  );
}

const nadaNaFila = <p className="py-8 text-center text-corpo text-apagado italic">Nada na fila.</p>;

// ── Por responsável ──────────────────────────────────────────────────────────

export function TabelaResponsaveisFila({
  itens,
  respId,
  onFiltrar,
  vazio,
  alturaMax = "24rem",
}: {
  itens: ResponsavelFila[];
  /** O responsável que filtra a fila agora. */
  respId?: number | null;
  /** Filtra a fila por ele; o mesmo clique na linha escolhida solta o filtro. */
  onFiltrar?: (r: ResponsavelFila) => void;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  const colunas: Coluna<ResponsavelFila>[] = [
    {
      id: "responsavel",
      cabecalho: "Responsável",
      largura: "42%",
      ordenar: (r) => nomeResponsavel(r.respNome),
      celula: (r) => <Responsavel nome={r.respNome} />,
    },
    { id: "total", cabecalho: "Na fila", alinhar: "dir", ordenar: (r) => r.total, celula: (r) => num(r.total) },
    {
      id: "vencidas",
      cabecalho: "Vencidas",
      alinhar: "dir",
      ordenar: (r) => r.atrasadas,
      celula: (r) => <Contagem n={r.atrasadas} />,
    },
    {
      id: "multa",
      cabecalho: "Com multa",
      alinhar: "dir",
      ordenar: (r) => r.comMulta,
      celula: (r) => <Contagem n={r.comMulta} />,
    },
    {
      id: "pior",
      cabecalho: "Pior atraso",
      alinhar: "dir",
      ordenar: (r) => r.piorAtraso,
      celula: (r) => <SeloAtraso dias={r.piorAtraso} />,
    },
  ];
  return (
    <TabelaDados
      rotulo="Fila por responsável"
      colunas={colunas}
      linhas={itens}
      chave={(r) => `${r.respId ?? "sem"}|${r.respNome}`}
      // O grupo sem dono não tem id para filtrar no servidor: o clique nele não faz nada.
      onLinha={onFiltrar ? (r) => r.respId != null && onFiltrar(r) : undefined}
      selecionada={(r) => respId != null && r.respId === respId}
      alturaMax={alturaMax}
      vazio={vazio ?? nadaNaFila}
    />
  );
}

// ── Por setor ────────────────────────────────────────────────────────────────

export function TabelaSetoresFila({
  itens,
  vazio,
  alturaMax = "12rem",
}: {
  itens: SetorFila[];
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  const colunas: Coluna<SetorFila>[] = [
    {
      id: "setor",
      cabecalho: "Setor",
      largura: "60%",
      ordenar: (s) => s.dptoNome,
      celula: (s) => (
        <span className="block truncate" title={s.dptoNome}>
          {s.dptoNome}
        </span>
      ),
    },
    { id: "total", cabecalho: "Na fila", alinhar: "dir", ordenar: (s) => s.total, celula: (s) => num(s.total) },
    {
      id: "vencidas",
      cabecalho: "Vencidas",
      alinhar: "dir",
      ordenar: (s) => s.atrasadas,
      celula: (s) => <Contagem n={s.atrasadas} />,
    },
  ];
  return (
    <TabelaDados
      rotulo="Fila por setor"
      colunas={colunas}
      linhas={itens}
      chave={(s) => String(s.dptoId)}
      alturaMax={alturaMax}
      vazio={vazio ?? nadaNaFila}
    />
  );
}

// ── Por obrigação ────────────────────────────────────────────────────────────

export function TabelaObrigacoesFila({
  itens,
  obrigacao,
  onFiltrar,
  vazio,
  alturaMax = "24rem",
}: {
  itens: ObrigacaoFila[];
  obrigacao?: string | null;
  onFiltrar?: (o: ObrigacaoFila) => void;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  const colunas: Coluna<ObrigacaoFila>[] = [
    {
      id: "obrigacao",
      cabecalho: "Obrigação",
      largura: "60%",
      ordenar: (o) => o.obrigacao,
      celula: (o) => (
        <span className="block truncate" title={o.obrigacao}>
          {o.obrigacao}
        </span>
      ),
    },
    { id: "total", cabecalho: "Na fila", alinhar: "dir", ordenar: (o) => o.total, celula: (o) => num(o.total) },
    {
      id: "vencidas",
      cabecalho: "Vencidas",
      alinhar: "dir",
      ordenar: (o) => o.atrasadas,
      celula: (o) => <Contagem n={o.atrasadas} />,
    },
  ];
  return (
    <TabelaDados
      rotulo="Fila por obrigação"
      colunas={colunas}
      linhas={itens}
      chave={(o) => o.obrigacao}
      onLinha={onFiltrar}
      selecionada={(o) => o.obrigacao === obrigacao}
      alturaMax={alturaMax}
      vazio={vazio ?? nadaNaFila}
    />
  );
}

// ── A fila ───────────────────────────────────────────────────────────────────

/**
 * As entregas, uma por linha. A mesma tabela serve a fila do escritório e a
 * consulta de uma empresa (`semEmpresa`), para o atraso e o responsável se
 * lerem igual nos dois lugares. O setor embaixo da obrigação só aparece onde
 * a seção junta mais de um setor.
 */
export function TabelaEntregasFila({
  itens,
  comSetor = true,
  semEmpresa,
  onAbrir,
  aberta,
  vazio,
  alturaMax = "62vh",
  rotulo = "Entregas na fila",
}: {
  itens: EntregaFila[];
  comSetor?: boolean;
  semEmpresa?: boolean;
  onAbrir?: (e: EntregaFila) => void;
  /** `entId` da entrega aberta no detalhe. */
  aberta?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
  rotulo?: string;
}) {
  const colunas: Coluna<EntregaFila>[] = [
    ...(semEmpresa
      ? []
      : [
          {
            id: "empresa",
            cabecalho: "Empresa",
            largura: "28%",
            ordenar: (e: EntregaFila) => e.empresa,
            celula: (e: EntregaFila) => <DuasLinhas principal={e.empresa} apoio={documento(e.cnpj)} />,
          },
        ]),
    {
      id: "obrigacao",
      cabecalho: "Obrigação",
      largura: semEmpresa ? "40%" : "26%",
      ordenar: (e) => e.obrigacao,
      celula: (e) => <DuasLinhas principal={e.obrigacao} apoio={comSetor ? e.dptoNome : null} />,
    },
    {
      id: "competencia",
      cabecalho: "Competência",
      ordenar: (e) => e.competencia,
      celula: (e) => <span className="num">{dataBR(e.competencia)}</span>,
    },
    {
      id: "prazo",
      cabecalho: "Prazo",
      ordenar: (e) => e.prazo,
      celula: (e) => <span className="num">{dataBR(e.prazo)}</span>,
    },
    {
      id: "atraso",
      cabecalho: "Atraso",
      alinhar: "dir",
      ordenar: (e) => e.diasAtraso,
      celula: (e) => <SeloAtraso dias={e.diasAtraso} />,
    },
    {
      id: "multa",
      cabecalho: "Multa",
      ordenar: (e) => (e.multa ? 1 : 0),
      celula: (e) => (e.multa ? <Selo tom="perigo">Com multa</Selo> : <span className="text-apagado">—</span>),
    },
    {
      id: "responsavel",
      cabecalho: "Responsável",
      largura: semEmpresa ? "24%" : "18%",
      ordenar: (e) => nomeResponsavel(e.respNome),
      celula: (e) => <Responsavel nome={e.respNome} />,
    },
  ];
  return (
    <TabelaDados
      rotulo={rotulo}
      colunas={colunas}
      linhas={itens}
      chave={(e) => String(e.entId)}
      onLinha={onAbrir}
      selecionada={aberta != null ? (e) => e.entId === aberta : undefined}
      alturaMax={alturaMax}
      vazio={vazio ?? nadaNaFila}
    />
  );
}
