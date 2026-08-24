"use client";

import { useMemo, useState } from "react";
import { AlignLeft, BarChart3, CheckSquare, Gauge, Hash, ListChecks, Lock } from "lucide-react";
import clsx from "clsx";
import { Badge, Card, StatTile } from "@/components/ui";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import {
  MIN_ANONIMATO,
  apurarFormulario,
  camposDeSegmento,
  filtrarRespostas,
  indicadoresGerais,
  type ApuracaoCampo,
  type ApuracaoEscala,
  type ApuracaoNumero,
  type ApuracaoOpcoes,
  type ApuracaoTexto,
  type FatiaApuracao,
  type Segmento,
} from "@/lib/formularios-apuracao";
import { TIPO_CAMPO_ROTULO, type FormularioCampo, type RespostaValores } from "@/lib/formularios-tipos";
import { num } from "@/lib/format";

const pctBR = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const ICONE: Record<ApuracaoCampo["forma"], React.ReactNode> = {
  opcoes: <ListChecks className="size-4" />,
  escala: <Gauge className="size-4" />,
  numero: <Hash className="size-4" />,
  texto: <AlignLeft className="size-4" />,
};

/** Cor do nível numa escala ordinal: do crítico (pior) ao bom (melhor). */
function corDoNivel(i: number, total: number): string {
  if (total < 2) return "var(--accent)";
  const t = i / (total - 1);
  return `color-mix(in oklab, var(--good) ${Math.round(t * 100)}%, var(--critical))`;
}

/**
 * Linha de barra: rótulo, barra, contagem e percentual. A barra é o PERCENTUAL,
 * não a proporção em relação à maior fatia — com escala relativa, cinco opções
 * empatadas em 20% desenhavam cinco barras cheias, e a leitura virava "todo
 * mundo marcou tudo". (Marcação múltipla pode passar de 100%; aí a barra satura.)
 */
function Barra({
  fatia,
  cor = "var(--accent)",
  destaque,
}: {
  fatia: FatiaApuracao;
  cor?: string;
  destaque?: boolean;
}) {
  const largura = Math.min(100, fatia.pct);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <p className={clsx("mb-1 truncate text-xs", destaque ? "text-ink" : "text-ink-2")} title={fatia.rotulo}>
          {fatia.rotulo}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${largura}%`, background: cor }}
          />
        </div>
      </div>
      <p className="tnum w-24 shrink-0 text-right text-xs text-muted">
        <span className="font-medium text-ink-2">{num(fatia.n)}</span> · {pctBR(fatia.pct)}%
      </p>
    </div>
  );
}

function CabecalhoPergunta({ a, indice }: { a: ApuracaoCampo; indice: number }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-muted">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-medium text-ink-2">
            {indice}
          </span>
          <span className="text-muted">{ICONE[a.forma]}</span>
          <span className="text-[11px]">{TIPO_CAMPO_ROTULO[a.campo.tipo]}</span>
        </div>
        <h3 className="mt-1.5 text-sm font-semibold text-ink">{a.campo.rotulo}</h3>
        {a.campo.ajuda && <p className="mt-0.5 text-xs text-muted">{a.campo.ajuda}</p>}
      </div>
      <p className="shrink-0 text-right text-xs text-muted">
        {num(a.respondentes)} {a.respondentes === 1 ? "resposta" : "respostas"}
        {a.emBranco > 0 && <span className="block">{num(a.emBranco)} em branco</span>}
      </p>
    </header>
  );
}

function BlocoOpcoes({ a }: { a: ApuracaoOpcoes }) {
  const topo = Math.max(...a.fatias.map((f) => f.n));
  return (
    <div className="space-y-3">
      {a.multipla && (
        <p className="text-[11px] text-muted">
          Várias marcações por pessoa — a soma dos percentuais passa de 100%.
        </p>
      )}
      {a.fatias.map((f) => (
        <Barra key={f.rotulo} fatia={f} destaque={f.n === topo && f.n > 0} />
      ))}
    </div>
  );
}

function BlocoEscala({ a }: { a: ApuracaoEscala }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="tnum text-3xl font-semibold tracking-tight">
            {a.media != null ? a.media.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
            <span className="ml-1 text-sm font-normal text-muted">de {a.niveis}</span>
          </p>
          {a.rotuloMedia && <p className="mt-0.5 text-xs text-muted">média · perto de “{a.rotuloMedia}”</p>}
        </div>
        {a.favoravel != null && (
          <Badge tone={a.favoravel >= 70 ? "good" : a.favoravel >= 50 ? "warning" : "critical"}>
            {pctBR(a.favoravel)}% nos dois níveis mais altos
          </Badge>
        )}
      </div>
      <div className="space-y-3">
        {a.fatias.map((f, i) => (
          <Barra key={f.rotulo} fatia={f} cor={corDoNivel(i, a.fatias.length)} />
        ))}
      </div>
    </div>
  );
}

function BlocoNumero({ a }: { a: ApuracaoNumero }) {
  const fmt = (v: number | null) =>
    v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <p className="tnum text-3xl font-semibold tracking-tight">{fmt(a.media)}</p>
          <p className="mt-0.5 text-xs text-muted">média</p>
        </div>
        <p className="text-xs text-muted">
          mediana <span className="tnum text-ink-2">{fmt(a.mediana)}</span> · menor{" "}
          <span className="tnum text-ink-2">{fmt(a.minimo)}</span> · maior{" "}
          <span className="tnum text-ink-2">{fmt(a.maximo)}</span>
        </p>
      </div>
      <div className="space-y-3">
        {a.fatias.map((f) => (
          <Barra key={f.rotulo} fatia={f} />
        ))}
      </div>
    </div>
  );
}

/** Quantos textos aparecem antes do "mostrar todas". */
const TEXTOS_VISIVEIS = 5;

function BlocoTexto({ a }: { a: ApuracaoTexto }) {
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? a.textos : a.textos.slice(0, TEXTOS_VISIVEIS);
  if (a.textos.length === 0) {
    return <p className="text-sm text-muted">Ninguém escreveu nada aqui.</p>;
  }
  return (
    <div className="space-y-2">
      {visiveis.map((t, i) => (
        <p
          key={i}
          className="rounded-lg border border-hairline bg-surface-2/40 px-3 py-2 text-sm text-ink-2"
        >
          {t}
        </p>
      ))}
      {a.textos.length > TEXTOS_VISIVEIS && (
        <button
          onClick={() => setTodas((v) => !v)}
          className="text-xs text-accent transition-opacity hover:opacity-80"
        >
          {todas ? "Mostrar menos" : `Mostrar as ${a.textos.length} respostas`}
        </button>
      )}
    </div>
  );
}

function Pergunta({ a, indice }: { a: ApuracaoCampo; indice: number }) {
  return (
    <Card as="section" animate="none">
      <CabecalhoPergunta a={a} indice={indice} />
      {a.respondentes === 0 && a.forma !== "texto" ? (
        <p className="text-sm text-muted">Ninguém respondeu esta pergunta.</p>
      ) : a.forma === "opcoes" ? (
        <BlocoOpcoes a={a} />
      ) : a.forma === "escala" ? (
        <BlocoEscala a={a} />
      ) : a.forma === "numero" ? (
        <BlocoNumero a={a} />
      ) : (
        <BlocoTexto a={a} />
      )}
    </Card>
  );
}

/**
 * PAINEL DE RESULTADOS DE UM FORMULÁRIO — montado da definição, não à mão.
 *
 * Cada pergunta vira o bloco que o seu tipo pede (marcação → contagem por opção,
 * escala → distribuição e média, número → média e faixas, texto → a lista). O
 * recorte por segmento também sai da definição: qualquer pergunta de marcação
 * única com poucas opções (setor, tempo de casa) vira filtro.
 *
 * Em pesquisa anônima, recorte fino identifica gente — por isso o painel se
 * recusa a mostrar um segmento com menos de `MIN_ANONIMATO` respostas.
 */
export function ApuracaoFormulario({
  campos,
  respostas,
  anonimo = false,
  segmento,
  onSegmento,
}: {
  campos: FormularioCampo[];
  respostas: RespostaValores[];
  /** Pesquisa sem identificação: liga a trava de segmento pequeno. */
  anonimo?: boolean;
  /** Segmento ativo (controlado pela tela, que também exporta com ele). */
  segmento: Segmento | null;
  onSegmento: (s: Segmento | null) => void;
}) {
  const segmentaveis = useMemo(() => camposDeSegmento(campos), [campos]);
  const filtradas = useMemo(() => filtrarRespostas(respostas, segmento), [respostas, segmento]);
  const apuracoes = useMemo(() => apurarFormulario(campos, filtradas), [campos, filtradas]);
  const geral = useMemo(() => indicadoresGerais(apuracoes), [apuracoes]);

  const campoSeg = segmento ? campos.find((c) => c.id === segmento.campoId) : null;
  const escondido = anonimo && segmento != null && filtradas.length < MIN_ANONIMATO;

  return (
    <div className="space-y-4">
      {/* Recorte: sai da própria definição do formulário */}
      {segmentaveis.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Recorte:</span>
          {segmentaveis.map((c) => (
            <SegmentoDropdown
              key={c.id}
              campo={c}
              respostas={respostas}
              segmento={segmento}
              onSegmento={onSegmento}
            />
          ))}
          {segmento && campoSeg && (
            <button
              onClick={() => onSegmento(null)}
              className="text-xs text-accent transition-opacity hover:opacity-80"
            >
              limpar
            </button>
          )}
        </div>
      )}

      {escondido ? (
        <Card className="flex items-start gap-3" animate="none">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/12 text-warning">
            <Lock className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">
              Poucas respostas neste recorte para mostrar com segurança
            </p>
            <p className="mt-1 text-xs text-muted">
              São {num(filtradas.length)} — abaixo de {MIN_ANONIMATO}, o resultado apontaria para
              pessoas específicas, e a pesquisa é anônima. Escolha um recorte mais amplo.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Cabeçalho de números: só aparece quando há escala para resumir */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              rotulo={segmento ? "Respostas no recorte" : "Respostas"}
              icon={<CheckSquare className="size-4 text-ent" />}
              iconTint="bg-ent/12"
              valor={num(filtradas.length)}
              secundario={
                segmento && campoSeg
                  ? `${campoSeg.rotulo}: ${segmento.valor}`
                  : `${num(campos.length)} perguntas`
              }
            />
            {geral.indice != null && (
              <StatTile
                rotulo="Índice geral"
                icon={<BarChart3 className="size-4 text-sai" />}
                iconTint="bg-sai/12"
                valor={`${pctBR(geral.indice)}%`}
                secundario={`média das ${num(geral.perguntasEscala)} perguntas de escala, normalizada`}
              />
            )}
            {geral.favoravel != null && (
              <StatTile
                rotulo="Favorabilidade"
                icon={<Gauge className="size-4 text-ink-2" />}
                valor={`${pctBR(geral.favoravel)}%`}
                secundario="marcações nos dois níveis mais altos"
              />
            )}
          </div>

          {apuracoes.map((a, i) => (
            <Pergunta key={a.campo.id} a={a} indice={i + 1} />
          ))}
        </>
      )}
    </div>
  );
}

/** Um filtro por pergunta de marcação: as opções com a contagem ao lado. */
function SegmentoDropdown({
  campo,
  respostas,
  segmento,
  onSegmento,
}: {
  campo: FormularioCampo;
  respostas: RespostaValores[];
  segmento: Segmento | null;
  onSegmento: (s: Segmento | null) => void;
}) {
  const ativo = segmento?.campoId === campo.id;
  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of respostas) {
      const v = r[String(campo.id)];
      if (typeof v === "string" && v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  }, [respostas, campo.id]);

  return (
    <Dropdown
      rotulo={ativo ? segmento!.valor : campo.rotulo}
      ativo={ativo}
      largura="w-80"
      larguraBotao="w-56"
    >
      {(fechar) => (
        <div className="max-h-72 overflow-y-auto py-1">
          <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted">
            {campo.rotulo}
          </p>
          <ItemLista
            selecionado={!ativo}
            onClick={() => {
              onSegmento(null);
              fechar();
            }}
          >
            <span className="flex-1 truncate text-muted">Todas as respostas</span>
          </ItemLista>
          {(campo.config.opcoes ?? []).map((op) => (
            <ItemLista
              key={op}
              selecionado={ativo && segmento!.valor === op}
              onClick={() => {
                onSegmento({ campoId: campo.id, valor: op });
                fechar();
              }}
            >
              <span className="flex-1 truncate">{op}</span>
              <span className="tnum text-xs text-muted">{contagem.get(op) ?? 0}</span>
            </ItemLista>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
