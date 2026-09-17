"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Download, FileUp, HelpCircle, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { ContaDropdown } from "@/components/conta-dropdown";
import { Badge, Button, Card, EmptyState, IconButton, StatTile, Table, Td, Th, Thead, Tr } from "@/components/ui";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { bytesWindows1252 } from "@/lib/csv";
import { brl, dataBR, num } from "@/lib/format";
import type { StatusCasamento } from "@/lib/implantacao-tipos";
import {
  avisoDoBem,
  conferirPatrimonial,
  TOLERANCIA,
  type ConferenciaConta,
} from "@/lib/patrimonial-conferencia";
import { RELATORIOS_PATRIMONIAL } from "@/lib/patrimonial-pdf";
import {
  PREFIXO_DEPARA_PATRIMONIAL,
  type BemLido,
  type LeituraPatrimonialCasada,
} from "@/lib/patrimonial-tipos";
import type { ContaPlano } from "@/lib/types";

/**
 * Implantação do patrimonial: o relatório de bens da contabilidade anterior
 * (PDF) vira o arquivo de importação do patrimonial do Questor.
 *
 * A tela é conferência, não formulário: tudo que se edita num bem recalcula na
 * hora a soma contra o total que o próprio relatório imprime, conta a conta. O
 * PDF é lido pelos controles da barra (`PatrimonialControles`), que gravam a
 * `leitura` no estado da seção.
 */

const SITUACAO: Record<StatusCasamento, { rotulo: string; tone: "good" | "warning" | "critical"; icone: typeof CheckCircle2 }> = {
  casada: { rotulo: "Casada", tone: "good", icone: CheckCircle2 },
  duvidosa: { rotulo: "Confira", tone: "warning", icone: HelpCircle },
  sem_conta: { rotulo: "Sem conta", tone: "critical", icone: AlertTriangle },
};

// Célula editável que parece texto até passar o mouse ou focar: a grade é para
// ler e conferir, e só às vezes corrigir.
const celula =
  "h-8 rounded-md border border-transparent bg-transparent px-2 text-xs text-ink outline-none hover:border-hairline focus:border-accent/50 focus:bg-surface";

const decimal2 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.234,56", "1234,56", "1234.56" ou "1.234" → número; null quando não dá. */
function numeroDigitado(s: string): number | null {
  const t = s.replace(/\s|R\$|%/g, "");
  if (!t) return null;
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  const v = Number(normal);
  return Number.isFinite(v) ? v : null;
}

/** Primeiro dia do mês seguinte à posição: quando a depreciação segue no Questor. */
function mesSeguinte(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
}

export default function Conteudo() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [leitura, setLeitura] = useEstadoSecao<LeituraPatrimonialCasada | null>("leitura", null);
  const [editandoConta, setEditandoConta] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const conferencia = useMemo(() => (leitura ? conferirPatrimonial(leitura) : null), [leitura]);

  if (!temEmpresa) {
    return <EmptyState icon={<Building2 className="size-6" />} titulo="Selecione uma empresa" />;
  }
  if (!leitura || !conferencia) {
    return (
      <EmptyState
        icon={<FileUp className="size-6" />}
        titulo="Nenhum relatório de bens lido"
        descricao={`Relatórios que a leitura conhece: ${RELATORIOS_PATRIMONIAL.join(", ")}.`}
      />
    );
  }

  const mudarBem = (i: number, mudanca: Partial<BemLido>) =>
    setLeitura((atual) =>
      atual && { ...atual, bens: atual.bens.map((b, j) => (j === i ? { ...b, ...mudanca } : b)) }
    );

  const removerBem = (i: number) =>
    setLeitura((atual) => atual && { ...atual, bens: atual.bens.filter((_, j) => j !== i) });

  async function escolherConta(chave: string, conta: number | null) {
    const origem = leitura?.contas.find((c) => c.chave === chave);
    let contaDescr: string | undefined;
    if (conta != null) {
      try {
        const res = await fetch(`/api/contabil/contas?empresa=${empresa}&busca=${conta}`);
        if (res.ok) {
          contaDescr = ((await res.json()) as ContaPlano[]).find((x) => x.conta === conta)?.descricao;
        }
      } catch {
        /* sem a descrição, a linha mostra só o número */
      }
    }
    // Funcional: a busca da descrição acima leva um instante, e um bem editado
    // nesse meio-tempo não pode ser desfeito pela troca de conta.
    setLeitura(
      (atual) =>
        atual && {
          ...atual,
          contas: atual.contas.map((c) =>
            c.chave === chave
              ? {
                  ...c,
                  conta,
                  contaDescr,
                  status: conta == null ? "sem_conta" : "casada",
                  via: conta == null ? null : "manual",
                  confianca: conta == null ? 0 : 1,
                }
              : c
          ),
        }
    );
    setEditandoConta(null);
    try {
      // Vira override: a próxima leitura desta empresa já vem com a conta.
      const res = await fetch("/api/contabil/implantacao/depara", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          empresa,
          chave: PREFIXO_DEPARA_PATRIMONIAL + chave,
          descr: origem?.descricao ?? null,
          conta,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao salvar o de-para");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o de-para");
    }
  }

  async function gerar() {
    if (!leitura) return;
    setGerando(true);
    try {
      const res = await fetch("/api/contabil/implantacao/patrimonial/gerar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          empresa,
          sistema: leitura.sistema,
          contas: leitura.contas.map((c) => ({ chave: c.chave, conta: c.conta })),
          bens: leitura.bens,
        }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Falha ao gerar o arquivo");
      const blob = new Blob([bytesWindows1252(r.arquivo as string)], {
        type: "text/csv;charset=windows-1252",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patrimonial_${empresa}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Arquivo gerado com ${r.linhas} bens`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o arquivo");
    } finally {
      setGerando(false);
    }
  }

  const confPorConta = new Map(conferencia.contas.map((c) => [c.chave, c]));
  const contasComBens = leitura.contas.filter((c) => (confPorConta.get(c.chave)?.bens ?? 0) > 0);
  const semConta = contasComBens.filter((c) => c.conta == null).length;
  const comAviso = leitura.bens.filter((b) => avisoDoBem(b)).length;
  const difGeral = conferencia.relatorio
    ? {
        valor: conferencia.lido.valor - conferencia.relatorio.valor,
        depreciacao: conferencia.lido.depreciacao - conferencia.relatorio.depreciacao,
      }
    : null;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          size="md"
          rotulo="Bens"
          valor={num(leitura.bens.length)}
          secundario={`${contasComBens.length} ${contasComBens.length === 1 ? "conta" : "contas"} · ${leitura.sistema}`}
        />
        <StatTile size="md" rotulo="Valor dos bens" valor={brl(conferencia.lido.valor)} />
        <StatTile
          size="md"
          rotulo="Depreciação acumulada"
          valor={brl(conferencia.lido.depreciacao)}
          secundario={leitura.posicao ? `Até ${dataBR(leitura.posicao)}` : undefined}
        />
        <StatTile
          size="md"
          rotulo="Total do relatório"
          valor={conferencia.confere === null ? "Sem total" : conferencia.confere ? "Confere" : "Difere"}
          alerta={conferencia.confere === false}
          secundario={
            difGeral && conferencia.confere === false ? <Diferenca dif={difGeral} /> : undefined
          }
        />
      </div>

      <Card as="section" overflow padding="none" animate="none">
        <Table minWidth="min-w-[56rem]">
          <Thead>
            <Th>Conta no relatório</Th>
            <Th>Conta no Questor</Th>
            <Th numeric>Bens</Th>
            <Th numeric>Valor</Th>
            <Th numeric>Depreciação</Th>
            <Th>Relatório</Th>
          </Thead>
          <tbody>
            {contasComBens.map((c) => {
              const situacao = SITUACAO[c.status];
              const Icone = situacao.icone;
              const conf = confPorConta.get(c.chave) as ConferenciaConta;
              const editar = editandoConta === c.chave || c.status !== "casada";
              return (
                <Tr key={c.chave} className="align-top">
                  <Td>
                    <div className="font-medium text-ink">{c.descricao}</div>
                    <div className="text-[11px] text-muted">
                      {c.chave}
                      {c.classif ? ` · ${c.classif}` : ""}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      {editar ? (
                        <ContaDropdown
                          empresa={empresa}
                          valor={c.conta}
                          onMudar={(conta) => escolherConta(c.chave, conta)}
                          limpavel
                          largura="w-80"
                        />
                      ) : (
                        <button
                          onClick={() => setEditandoConta(c.chave)}
                          className="flex items-center gap-1.5 text-left text-ink hover:text-accent"
                        >
                          <span>
                            <span className="font-mono">{c.conta}</span>{" "}
                            <span className="text-muted">{c.contaDescr}</span>
                          </span>
                          <Pencil className="size-3 shrink-0 opacity-50" />
                        </button>
                      )}
                      <Badge tone={situacao.tone}>
                        <Icone className="size-3" />
                        {situacao.rotulo}
                        {c.status === "duvidosa" && (
                          <span className="opacity-70">{Math.round(c.confianca * 100)}%</span>
                        )}
                      </Badge>
                    </div>
                  </Td>
                  <Td numeric>{conf.bens}</Td>
                  <Td numeric className="whitespace-nowrap">{brl(conf.lido.valor)}</Td>
                  <Td numeric className="whitespace-nowrap">{brl(conf.lido.depreciacao)}</Td>
                  <Td>
                    {conf.confere === null ? (
                      <span className="text-xs text-muted">Sem total</span>
                    ) : conf.confere ? (
                      <Badge tone="good">
                        <CheckCircle2 className="size-3" />
                        Confere
                      </Badge>
                    ) : (
                      <div className="grid gap-1">
                        <Badge tone="critical" className="w-fit">
                          <AlertTriangle className="size-3" />
                          Difere
                        </Badge>
                        {conf.relatorio && (
                          <Diferenca
                            dif={{
                              valor: conf.lido.valor - conf.relatorio.valor,
                              depreciacao: conf.lido.depreciacao - conf.relatorio.depreciacao,
                            }}
                          />
                        )}
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card as="section" overflow padding="none" animate="none">
        <Table minWidth="min-w-[60rem]">
          <Thead>
            <Th>Bem</Th>
            <Th>Descrição</Th>
            <Th>Aquisição</Th>
            <Th numeric>Valor</Th>
            <Th numeric>Depreciação acumulada</Th>
            <Th numeric>Taxa %</Th>
            <Th>
              <span className="sr-only">Remover</span>
            </Th>
          </Thead>
          <tbody>
            {contasComBens.map((c) => (
              <GrupoDeBens
                key={c.chave}
                titulo={c.descricao}
                destino={c.conta}
                bens={leitura.bens.map((b, i) => ({ b, i })).filter(({ b }) => b.conta === c.chave)}
                onMudar={mudarBem}
                onRemover={removerBem}
              />
            ))}
          </tbody>
        </Table>
      </Card>

      <Card as="section" animate="none" padding="sm" className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {semConta > 0 ? (
            <p className="text-xs text-critical">
              {semConta === 1
                ? "Falta escolher a conta do Questor de uma conta do relatório."
                : `Falta escolher a conta do Questor de ${semConta} contas do relatório.`}
            </p>
          ) : conferencia.confere === false ? (
            <p className="text-xs text-critical">
              A soma dos bens não bate com o total do relatório. Confira as contas marcadas antes de importar.
            </p>
          ) : comAviso > 0 ? (
            <p className="text-xs text-warning">
              {comAviso === 1 ? "Um bem está com aviso." : `${comAviso} bens estão com aviso.`}
            </p>
          ) : (
            <p className="text-xs text-good">Bens e depreciação conferem com o relatório.</p>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={gerar}
            disabled={gerando || semConta > 0 || !leitura.bens.length}
          >
            <Download className="size-4" />
            Baixar arquivo do patrimonial
          </Button>
        </div>
        {leitura.posicao && (
          <p className="text-xs italic text-muted">
            Depreciação acumulada até {dataBR(leitura.posicao)}. No Questor, a depreciação começa em{" "}
            {dataBR(mesSeguinte(leitura.posicao))}.
          </p>
        )}
      </Card>
    </div>
  );
}

/** Onde a soma lida se afasta do total impresso, só no que difere. */
function Diferenca({ dif }: { dif: { valor: number; depreciacao: number } }) {
  const partes = [
    Math.abs(dif.valor) > TOLERANCIA ? `valor ${dif.valor > 0 ? "+" : ""}${brl(dif.valor)}` : null,
    Math.abs(dif.depreciacao) > TOLERANCIA
      ? `depreciação ${dif.depreciacao > 0 ? "+" : ""}${brl(dif.depreciacao)}`
      : null,
  ].filter(Boolean);
  return <span className="text-[11px] italic text-muted">{partes.join(" · ")}</span>;
}

function GrupoDeBens({
  titulo,
  destino,
  bens,
  onMudar,
  onRemover,
}: {
  titulo: string;
  destino: number | null;
  bens: { b: BemLido; i: number }[];
  onMudar: (i: number, mudanca: Partial<BemLido>) => void;
  onRemover: (i: number) => void;
}) {
  return (
    <>
      <tr className="border-b border-hairline bg-surface-2/60">
        <td colSpan={7} className="px-3 py-1.5 text-xs font-medium text-ink-2">
          {titulo}
          <span className="font-normal text-muted"> · {destino ?? "sem conta no Questor"}</span>
        </td>
      </tr>
      {bens.map(({ b, i }) => {
        const aviso = avisoDoBem(b);
        return (
          <Tr key={`${b.codigo}-${i}`} className="align-top">
            <Td className="py-1.5 font-mono text-xs text-muted">{b.codigo}</Td>
            <Td className="py-1.5">
              <input
                value={b.descricao}
                onChange={(e) => onMudar(i, { descricao: e.target.value })}
                aria-label={`Descrição do bem ${b.codigo}`}
                className={clsx(celula, "w-full min-w-[18rem]")}
              />
              {aviso && <p className="px-2 text-[11px] italic text-warning">{aviso}</p>}
            </Td>
            <Td className="py-1.5">
              <input
                type="date"
                value={b.aquisicao}
                onChange={(e) => onMudar(i, { aquisicao: e.target.value })}
                aria-label={`Aquisição do bem ${b.codigo}`}
                className={clsx(celula, "w-36")}
              />
            </Td>
            <Td className="py-1.5">
              <CampoNumero
                valor={b.valor}
                onMudar={(valor) => onMudar(i, { valor })}
                rotulo={`Valor do bem ${b.codigo}`}
                className="w-32"
              />
            </Td>
            <Td className="py-1.5">
              <CampoNumero
                valor={b.depreciacao}
                onMudar={(depreciacao) => onMudar(i, { depreciacao })}
                rotulo={`Depreciação acumulada do bem ${b.codigo}`}
                className="w-32"
              />
            </Td>
            <Td className="py-1.5">
              <CampoNumero
                valor={b.taxa}
                onMudar={(taxa) => onMudar(i, { taxa })}
                rotulo={`Taxa do bem ${b.codigo}`}
                className="w-20"
              />
            </Td>
            <Td className="py-1.5">
              <IconButton
                tone="danger"
                size="sm"
                aria-label={`Remover o bem ${b.codigo}`}
                title="Tirar do arquivo"
                onClick={() => onRemover(i)}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </Td>
          </Tr>
        );
      })}
    </>
  );
}

/**
 * Número editável em formato BR. Enquanto está focado, o texto é livre; ao sair,
 * vira número (ou volta ao anterior se não der para ler).
 */
function CampoNumero({
  valor,
  onMudar,
  rotulo,
  className,
}: {
  valor: number;
  onMudar: (v: number) => void;
  rotulo: string;
  className?: string;
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const exibido = rascunho ?? decimal2(valor);
  return (
    <input
      inputMode="decimal"
      value={exibido}
      aria-label={rotulo}
      onFocus={(e) => {
        setRascunho(exibido);
        e.currentTarget.select();
      }}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        const v = rascunho == null ? null : numeroDigitado(rascunho);
        if (v != null && Math.abs(v - valor) > 0.001) onMudar(Math.round(v * 100) / 100);
        setRascunho(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={clsx(celula, "tnum text-right", className)}
    />
  );
}
