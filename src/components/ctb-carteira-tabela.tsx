"use client";

import { useMemo, useState } from "react";
import { ArrowDown, Search } from "lucide-react";
import clsx from "clsx";
import { Badge, Card, Segmented, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { FAIXAS_PARADA, PARADA_NUNCA, type CtbCarteiraEmpresa } from "@/lib/contabil-carteira-tipos";
import { faixaDe } from "@/lib/contabil-prod-escala";
import { brlCompact, dataBR, num } from "@/lib/format";

type Recorte = "todas" | "atendidas" | "paradas";
type Ordem = "lancamentos" | "parada" | "valor" | "nome";

const RECORTES: { value: Recorte; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "atendidas", label: "Atendidas" },
  { value: "paradas", label: "Sem movimento" },
];

/**
 * A carteira inteira numa tabela: o que teve movimento no período e, sobretudo,
 * o que não teve.
 *
 * O recorte "Sem movimento" é o motivo da tela existir — empresa parada não
 * aparece em ranking nenhum, porque ranking só lista quem produziu. A busca e o
 * recorte ficam no componente (são leitura, não filtro de consulta); o que
 * dispara banco continua sendo só a barra de cima.
 */
export function CtbCarteiraTabela({
  dados,
  carregando,
  recarregando,
}: {
  dados: CtbCarteiraEmpresa[] | undefined;
  carregando: boolean;
  recarregando: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [recorte, setRecorte] = useState<Recorte>("todas");
  const [ordem, setOrdem] = useState<Ordem>("lancamentos");

  const linhas = useMemo(() => {
    if (!dados) return undefined;
    const q = busca.trim().toLowerCase();
    const filtradas = dados.filter((e) => {
      if (recorte === "atendidas" && e.lancamentos === 0) return false;
      if (recorte === "paradas" && e.lancamentos > 0) return false;
      if (q && !e.nome.toLowerCase().includes(q) && !String(e.codigo).includes(q)) return false;
      return true;
    });
    const parada = (e: CtbCarteiraEmpresa) => e.diasParada ?? PARADA_NUNCA;
    return [...filtradas].sort((a, b) => {
      if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "parada") return parada(b) - parada(a);
      if (ordem === "valor") return b.valor - a.valor;
      return b.lancamentos - a.lancamentos;
    });
  }, [dados, busca, recorte, ordem]);

  const cabecalho = (key: Ordem, rotulo: string, titulo?: string) => (
    <Th numeric={key !== "nome"} title={titulo}>
      <button
        onClick={() => setOrdem(key)}
        className={clsx(
          "inline-flex items-center gap-1 transition-colors hover:text-ink",
          ordem === key && "text-ink"
        )}
      >
        {rotulo}
        {ordem === key && <ArrowDown className="size-3" />}
      </button>
    </Th>
  );

  return (
    <Card as="section">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Carteira, empresa por empresa</h2>
          <p className="mt-0.5 text-xs text-muted">
            Movimento no período e tempo desde o último lançamento de todos os tempos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-hairline px-2.5 py-1">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa…"
              className="w-40 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <Segmented
            aria-label="Recorte da carteira"
            options={RECORTES}
            value={recorte}
            onChange={setRecorte}
          />
        </div>
      </header>

      {carregando || !linhas ? (
        <div className="skeleton h-96 w-full" />
      ) : linhas.length === 0 ? (
        <p className="grid h-40 place-items-center text-sm text-muted">
          Nenhuma empresa com esse recorte
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-y-auto">
          <Table minWidth="min-w-[760px]" recarregando={recarregando}>
            <Thead sticky>
              <Th className="w-14 pr-2 text-right">Código</Th>
              {cabecalho("nome", "Empresa")}
              {cabecalho("lancamentos", "Lançamentos")}
              <Th numeric title="Pessoas do time que tocaram nela no período">Pessoas</Th>
              <Th>Quem mais lançou</Th>
              {cabecalho("valor", "Valor")}
              <Th numeric>Último lançamento</Th>
              {cabecalho("parada", "Parada há", "Dias desde o último lançamento de todos os tempos")}
            </Thead>
            <tbody>
              {linhas.map((e) => {
                const dias = e.diasParada;
                const faixa = FAIXAS_PARADA[faixaDe(FAIXAS_PARADA, dias ?? PARADA_NUNCA)];
                return (
                  <Tr key={e.codigo}>
                    <Td numeric className="pr-2 text-xs text-muted">
                      {e.codigo}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{e.nome}</span>
                        {!e.ativa && <Badge tone="neutral">baixada</Badge>}
                      </span>
                    </Td>
                    <Td numeric className={clsx(e.lancamentos === 0 && "text-muted")}>
                      {num(e.lancamentos)}
                    </Td>
                    <Td numeric className={clsx(e.pessoas === 0 && "text-muted")}>
                      {num(e.pessoas)}
                    </Td>
                    <Td className="max-w-40 truncate text-ink-2">{e.principal ?? "—"}</Td>
                    <Td numeric className={clsx(e.valor === 0 && "text-muted")}>
                      {brlCompact(e.valor)}
                    </Td>
                    <Td numeric className="text-ink-2">
                      {dataBR(e.ultimo)}
                    </Td>
                    <Td numeric>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: faixa.cor }}
                          aria-hidden
                        />
                        {dias == null ? "nunca" : `${num(dias)} d`}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {linhas && (
        <p className="mt-3 text-xs text-muted">
          {num(linhas.length)} empresa(s) neste recorte · a coluna &ldquo;parada há&rdquo; olha a
          tabela inteira do Questor, não só o período filtrado
        </p>
      )}
    </Card>
  );
}
