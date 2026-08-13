"use client";

import { useState } from "react";
import { ListaModal } from "@/components/lista-modal";
import { Badge, type BadgeTone } from "@/components/ui";
import { useBalanceteCulpados } from "@/hooks/use-api";
import { brl, num } from "@/lib/format";
import type { BalanceteLinha } from "@/lib/types";

const ORIGEM: Record<string, string> = { ME: "Nota entrada", MS: "Nota saída" };

const TIPO: Record<string, { rotulo: string; tone: BadgeTone; titulo: string }> = {
  valor: {
    rotulo: "Valor diferente",
    tone: "critical",
    titulo: "Lançada, mas com valor diferente do esperado pela regra",
  },
  faltando: {
    rotulo: "Não lançada aqui",
    tone: "warning",
    titulo: "Esperada nesta conta pela regra, mas não lançada aqui (foi para outra)",
  },
  conta_errada: {
    rotulo: "Conta errada",
    tone: "critical",
    titulo:
      "Lançada em conta diferente da que o plano manda — veja a coluna Conta onde ela está",
  },
  interno: {
    rotulo: "Conta errada no grupo",
    tone: "warning",
    titulo:
      "Lançada em outra conta DENTRO deste grupo (veja na coluna Conta: esperada → lançada). Não altera o total da sintética — por isso a diferença é zero —, mas as duas analíticas ficam erradas",
  },
  extra: {
    rotulo: "Sem regra reproduzível",
    tone: "neutral",
    titulo:
      "Lançada sem o motor esperar e sem plano reproduzível (NFSE/serviço ou CFOP sem tabela) — confira manualmente",
  },
};

/**
 * Notas por trás da diferença de uma conta do balancete: por nota, o líquido
 * (débito − crédito) que o motor esperava na conta × o que o contábil lançou.
 * A soma das diferenças fecha com a coluna Diferença da conta. Monta sobre a
 * base comum `ListaModal` (mesma casca e busca do drill-down).
 */
export function CulpadosModal({
  alvo,
  qs,
  onFechar,
}: {
  alvo: BalanceteLinha | null;
  qs: string;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useBalanceteCulpados(
    qs,
    alvo?.classif ?? null,
    alvo?.conta ?? 0,
    alvo?.sintetica ?? false
  );

  const todos = data?.culpados ?? [];
  const q = busca.trim().toLowerCase();
  const culpados = !q
    ? todos
    : todos.filter(
        (c) =>
          String(c.numero ?? "").includes(q) ||
          (c.contraparte ?? "").toLowerCase().includes(q) ||
          (c.especie ?? "").toLowerCase().includes(q)
      );

  const totalDif = culpados.reduce((s, c) => s + c.diferenca, 0);
  const internos = culpados.filter((c) => c.tipo === "interno").length;
  // O valor do rodapé é a CÉLULA clicada (a verdade da tabela). Em sintética
  // grande, as milhares de notas conferidas (dentro da tolerância, não
  // listadas) carregam resíduo de arredondamento — a soma das listadas pode
  // divergir da célula em ~0,1%; o tooltip decompõe quando isso acontece.
  const celula = alvo
    ? alvo.fiscalDeb - alvo.fiscalCred - (alvo.realDeb - alvo.realCred)
    : totalDif;
  const residuo = celula - totalDif;
  // Na sintética a coluna de conta diz em qual analítica-filha a nota bate; na
  // analítica só aparece quando alguma nota tem o par certa → errada (aí a
  // coluna é o que diz PRA ONDE a nota deveria ir).
  const temPar = culpados.some(
    (c) => c.contaEsperada != null && c.conta != null && c.contaEsperada !== c.conta
  );
  const mostrarConta = (alvo?.sintetica ?? false) || temPar;

  return (
    <ListaModal
      aberto={alvo != null}
      onFechar={onFechar}
      largura="max-w-5xl"
      ariaLabel="Notas da diferença"
      titulo={
        <h3 className="truncate text-lg font-semibold" title={alvo?.descricao}>
          {alvo ? `${alvo.conta} · ${alvo.descricao}` : ""}
        </h3>
      }
      subtitulo="Notas cujo esperado não bate com o lançado · esperado − real"
      busca={busca}
      onBusca={setBusca}
      buscaPlaceholder="Nº, contraparte ou espécie…"
      carregando={isLoading}
      rodape={
        <>
          <span>
            {num(culpados.length - internos)} {culpados.length - internos === 1 ? "nota" : "notas"}
            {internos > 0 && (
              <span className="text-muted/70">
                {" "}
                · {num(internos)} {internos === 1 ? "remanejo interno" : "remanejos internos"}
              </span>
            )}
            {(data?.total ?? 0) > todos.length && (
              <span className="text-muted/70"> · maiores de {num(data?.total ?? 0)}</span>
            )}
          </span>
          <span
            className="tabular-nums font-medium text-ink"
            title={
              Math.abs(residuo) > 0.5
                ? `Notas listadas: ${brl(totalDif)} · resíduo de arredondamento das notas conferidas (não listadas): ${brl(residuo)}`
                : undefined
            }
          >
            {brl(celula)}
          </span>
        </>
      }
    >
      {isLoading ? (
        <div className="p-6">
          <div className="skeleton h-40 w-full" />
        </div>
      ) : culpados.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {todos.length === 0
            ? "Nenhuma nota isolada explica a diferença (pode ser imposto/apuração)."
            : "Nenhuma nota com esse filtro."}
        </p>
      ) : (
        <table className="w-full min-w-[820px] text-xs">
          <thead className="sticky top-0 bg-surface text-left text-muted">
            <tr className="border-b border-hairline">
              <th className="py-2 pl-6 pr-3 font-medium">Nº</th>
              <th className="py-2 pr-3 font-medium">Espécie</th>
              <th className="py-2 pr-3 font-medium">Contraparte</th>
              {mostrarConta && <th className="py-2 pr-3 font-medium">Conta</th>}
              <th className="py-2 pr-3 font-medium">Situação</th>
              <th className="py-2 pr-3 text-right font-medium">Esperado</th>
              <th className="py-2 pr-3 text-right font-medium">Real</th>
              <th className="py-2 pr-6 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {culpados.map((c, i) => {
              const nfse = c.especie === "NFSE";
              return (
                <tr key={i} className="border-b border-hairline/50 last:border-0">
                  <td className="py-1.5 pl-6 pr-3 tabular-nums whitespace-nowrap">
                    {c.numero ?? "—"}
                    <span className="ml-1.5 text-[10px] text-muted">{ORIGEM[c.origem] ?? c.origem}</span>
                  </td>
                  <td className="py-1.5 pr-3">
                    {c.especie ? (
                      <span
                        title={nfse ? "NFSE (serviço) — o motor não reproduz; confira manualmente" : c.especie}
                      >
                        <Badge tone={nfse ? "warning" : "neutral"} size="xs">
                          {c.especie}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-[280px] truncate py-1.5 pr-3" title={c.contraparte ?? ""}>
                    {c.contraparte ?? "—"}
                  </td>
                  {mostrarConta && (
                    <td className="py-1.5 pr-3 tabular-nums text-muted">
                      {c.contaEsperada != null && c.conta != null && c.contaEsperada !== c.conta ? (
                        <span
                          className="inline-flex items-center gap-1 whitespace-nowrap"
                          title={`Certa pelo plano: ${c.contaEsperada} · Lançada (errada): ${c.conta}`}
                        >
                          <span className="font-medium text-good">{c.contaEsperada}</span>
                          <span className="text-[9px] uppercase tracking-wide text-muted/70">certa</span>
                          <span className="text-muted/50">→</span>
                          <span className="font-medium text-critical">{c.conta}</span>
                          <span className="text-[9px] uppercase tracking-wide text-muted/70">errada</span>
                        </span>
                      ) : (
                        (c.conta ?? "—")
                      )}
                    </td>
                  )}
                  <td className="py-1.5 pr-3">
                    {nfse && c.tipo === "extra" ? (
                      <span title="Serviço (NFSE) — o motor não reproduz; confira a contabilização manualmente">
                        <Badge tone="warning" size="xs">
                          Verificar manual
                        </Badge>
                      </span>
                    ) : (
                      <span title={TIPO[c.tipo].titulo}>
                        <Badge tone={TIPO[c.tipo].tone} size="xs">
                          {TIPO[c.tipo].rotulo}
                        </Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{brl(c.esperado)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{brl(c.real)}</td>
                  <td className="py-1.5 pr-6 text-right font-semibold tabular-nums text-ink">
                    {c.tipo === "interno" ? (
                      <span className="font-normal text-muted/50" title="Remanejo interno — não altera o total do grupo">
                        —
                      </span>
                    ) : (
                      brl(c.diferenca)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </ListaModal>
  );
}
