"use client";

import type { ReactNode } from "react";
import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { brl, brlCompact, pct } from "@/lib/format";
import type { Impostos } from "@/lib/types";
import { SeletorLado, type Lado } from "./lado";

type ChaveImposto = Exclude<keyof Impostos, "totalItens">;

export interface InfoImposto {
  chave: ChaveImposto;
  rotulo: string;
  /** Só os destacados têm cor: são eles que dividem a barra. */
  cor?: string;
}

/*
 * Os impostos que o Questor espalha em três tabelas (item, PIS/COFINS e
 * retido) e a rota soma. A cor é por imposto e não muda de tela: o ICMS é
 * azul no Painel e em Tributos. O COFINS fica com a sexta série, e não com a
 * cor de entrada que o nexo2 usava, porque aqui entrada e ICMS são o mesmo azul.
 */
export const IMPOSTOS_DESTACADOS: InfoImposto[] = [
  { chave: "icms", rotulo: "ICMS", cor: "var(--serie-1)" },
  { chave: "st", rotulo: "ICMS-ST", cor: "var(--serie-4)" },
  { chave: "ipi", rotulo: "IPI", cor: "var(--serie-3)" },
  { chave: "iss", rotulo: "ISS", cor: "var(--serie-5)" },
  { chave: "pis", rotulo: "PIS", cor: "var(--serie-2)" },
  { chave: "cofins", rotulo: "COFINS", cor: "var(--serie-6)" },
];

export const IMPOSTOS_RETIDOS: InfoImposto[] = [
  { chave: "irrf", rotulo: "IRRF" },
  { chave: "inss", rotulo: "INSS" },
  { chave: "csll", rotulo: "CSLL" },
  { chave: "issqn", rotulo: "ISSQN" },
];

/** Só existem nas saídas: nas entradas a rota devolve zero e o grupo some. */
export const IMPOSTOS_INTERESTADUAIS: InfoImposto[] = [
  { chave: "difal", rotulo: "DIFAL" },
  { chave: "fcp", rotulo: "FCP" },
  { chave: "funrural", rotulo: "FUNRURAL" },
];

export const TODOS_IMPOSTOS = [...IMPOSTOS_DESTACADOS, ...IMPOSTOS_RETIDOS, ...IMPOSTOS_INTERESTADUAIS];

/** A soma dos seis destacados na nota, a base da carga tributária. */
export const somaDestacados = (d: Impostos) => IMPOSTOS_DESTACADOS.reduce((s, i) => s + d[i.chave], 0);

const temAlgum = (d: Impostos, lista: InfoImposto[]) => lista.some((i) => d[i.chave] > 0);

function Grade({ lista, dados }: { lista: InfoImposto[]; dados: Impostos }) {
  const base = dados.totalItens;
  return (
    <div className="grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
      {lista.map((i) => {
        const v = dados[i.chave];
        return (
          <div key={i.chave} className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 text-pequeno text-apagado">
              {i.cor && <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: i.cor }} />}
              <span className="truncate">{i.rotulo}</span>
            </p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="nx-leitura text-titulo text-tinta" title={brl(v)}>
                {brlCompact(v)}
              </span>
              <span className="num text-pequeno text-apagado">{pct(base > 0 ? (v / base) * 100 : null)}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-linha pt-3">
      <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * De que são feitos os impostos de um lado: os seis destacados na nota numa
 * barra, cada um com o valor e o peso sobre o valor dos itens, e embaixo as
 * retenções e o interestadual, que só aparecem quando existem no período. Serve
 * o Painel e Tributos, com o mesmo seletor de lado.
 */
export function ComposicaoImpostos({
  titulo = "Impostos",
  dados,
  lado,
  onLado,
  carregando,
  erro,
  onTentar,
  rodape,
  className,
}: {
  titulo?: ReactNode;
  dados: Impostos | undefined;
  lado: Lado;
  onLado: (lado: Lado) => void;
  carregando?: boolean;
  erro?: string | null;
  onTentar?: () => void;
  rodape?: ReactNode;
  className?: string;
}) {
  const nomeLado = lado === "ent" ? "entrada" : "saída";
  const descricao =
    dados && !carregando && !erro && dados.totalItens > 0
      ? `Sobre ${brlCompact(dados.totalItens)} em itens de ${nomeLado}`
      : `Destacados nos itens de ${nomeLado}`;

  let corpo: ReactNode;
  if (erro) corpo = <PainelErro mensagem={erro} onTentar={onTentar} />;
  else if (carregando || !dados)
    corpo = (
      <div aria-busy className="flex flex-col gap-4">
        <Esqueleto className="h-3 w-full rounded-full" />
        <div className="grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {IMPOSTOS_DESTACADOS.map((i) => (
            <div key={i.chave} className="flex flex-col gap-1.5">
              <Esqueleto className="h-3 w-12" />
              <Esqueleto className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  else if (dados.totalItens === 0 && !temAlgum(dados, TODOS_IMPOSTOS))
    corpo = (
      <Vazio
        compacto
        icone="moedas"
        titulo={`Nenhum item de ${nomeLado} no recorte`}
        descricao="Confira o período e a filial no topo, ou veja o outro lado."
        acao={<Botao onClick={() => onLado(lado === "ent" ? "sai" : "ent")}>{lado === "ent" ? "Ver saídas" : "Ver entradas"}</Botao>}
      />
    );
  else
    corpo = (
      <div className="flex flex-col gap-4">
        <BarraComposicao
          className="h-3"
          partes={IMPOSTOS_DESTACADOS.map((i) => ({
            valor: dados[i.chave],
            cor: i.cor!,
            rotulo: `${i.rotulo}: ${brl(dados[i.chave])}`,
          }))}
        />
        <Grade lista={IMPOSTOS_DESTACADOS} dados={dados} />
        {temAlgum(dados, IMPOSTOS_RETIDOS) && (
          <Grupo titulo="Retenções em notas de serviço">
            <Grade lista={IMPOSTOS_RETIDOS} dados={dados} />
          </Grupo>
        )}
        {temAlgum(dados, IMPOSTOS_INTERESTADUAIS) && (
          <Grupo titulo="Interestadual e rural">
            <Grade lista={IMPOSTOS_INTERESTADUAIS} dados={dados} />
          </Grupo>
        )}
      </div>
    );

  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      acoes={<SeletorLado lado={lado} onMudar={onLado} />}
      className={className}
      rodape={rodape}
    >
      {corpo}
    </Painel>
  );
}
