"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Nota, Vazio } from "@/componentes/primitivos/estados";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador, type Tom } from "@/componentes/primitivos/indicador";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { RankingBarras } from "@/componentes/produto/graficos";
import { cn } from "@/lib/cn";
import { decimal, num, pct } from "@/lib/format";
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

/*
 * O RESUMO DE UM FORMULÁRIO, montado da definição e não à mão. Cada pergunta
 * vira o bloco que o tipo dela pede: marcação vira contagem por opção, nota
 * vira média e distribuição, número vira média e faixas, texto se lista. Pergunta
 * nova no editor já nasce com o seu bloco aqui. A conta é da lib
 * (`formularios-apuracao`, pura e testada); esta peça só desenha.
 *
 * Serve a avaliação de clima e pode servir a de desempenho: o que muda entre as
 * duas é `anonimo`, que liga a trava de recorte pequeno.
 */

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

const ICONE_FORMA: Record<ApuracaoCampo["forma"], NomeIcone> = {
  opcoes: "fila",
  escala: "velocimetro",
  numero: "hash",
  texto: "nota",
};

/** Quantos textos aparecem antes do "mostrar todos". */
const TEXTOS_VISIVEIS = 5;

/** Valor de fora de toda opção: o texto da opção é livre e pode ser qualquer coisa. */
const TODAS = "\u0000todas";

/** Favorabilidade em faixas: 70% ou mais é bom, abaixo de 50% pede atenção de verdade. */
export function tomFavoravel(p: number): Tom {
  return p >= 70 ? "ok" : p >= 50 ? "atencao" : "perigo";
}

/**
 * Cor do nível numa escala, do pior ao melhor, passando pelo âmbar no meio. A
 * mistura direta de vermelho e verde dá um marrom no meio da escala, que não se
 * lê como "regular".
 */
function corDoNivel(i: number, total: number): string {
  if (total < 2) return "var(--serie-1)";
  const t = i / (total - 1);
  return t <= 0.5
    ? `color-mix(in oklab, var(--atencao) ${Math.round(t * 200)}%, var(--perigo))`
    : `color-mix(in oklab, var(--ok) ${Math.round((t - 0.5) * 200)}%, var(--atencao))`;
}

/**
 * Barras da pergunta. A régua é quem RESPONDEU a pergunta, então a barra é o
 * percentual e não a proporção da maior opção: cinco opções empatadas em 20%
 * desenham cinco barras curtas, não cinco cheias. Marcação múltipla passa de
 * 100% e a barra satura.
 */
function Barras({ fatias, base, cor }: { fatias: FatiaApuracao[]; base: number; cor?: (i: number) => string }) {
  const itens = fatias.map((f, i) => ({ ...f, i }));
  return (
    <RankingBarras
      itens={itens}
      rotulo={(f) => <span title={f.rotulo}>{f.rotulo}</span>}
      valor={(f) => f.n}
      regua={base}
      detalhe={(f) => <span className="num">{pct(f.pct)}</span>}
      cor={cor ? (f) => cor(f.i) : undefined}
      vazio="Nenhuma opção cadastrada nesta pergunta."
    />
  );
}

function BlocoOpcoes({ a }: { a: ApuracaoOpcoes }) {
  return (
    <div className="flex flex-col gap-2">
      {a.multipla && <Nota>Cada pessoa pode marcar mais de uma opção, então a soma passa de 100%.</Nota>}
      <Barras fatias={a.fatias} base={a.respondentes} />
    </div>
  );
}

function BlocoEscala({ a }: { a: ApuracaoEscala }) {
  // Escala só de números ("1" a "5") não ganha "perto de 4": repetiria a média.
  const rotulo = a.rotuloMedia && !/^\d+$/.test(a.rotuloMedia.trim()) ? a.rotuloMedia : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <p className="text-apagado">
            <span className="nx-leitura text-leitura text-tinta">{a.media != null ? decimal(a.media, 2) : "—"}</span>
            <span className="num ml-1 text-corpo">de {num(a.niveis)}</span>
          </p>
          <p className="text-pequeno text-apagado">{rotulo ? `Média, perto de “${rotulo}”` : "Média"}</p>
        </div>
        {a.favoravel != null && (
          <Selo tom={tomFavoravel(a.favoravel)} className="mb-1">
            {pct(a.favoravel)} nos dois níveis mais altos
          </Selo>
        )}
      </div>
      <Barras fatias={a.fatias} base={a.respondentes} cor={(i) => corDoNivel(i, a.fatias.length)} />
    </div>
  );
}

function BlocoNumero({ a }: { a: ApuracaoNumero }) {
  const valor = (v: number | null) => (v == null ? "—" : decimal(v, 2));
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Média", a.media],
            ["Mediana", a.mediana],
            ["Menor", a.minimo],
            ["Maior", a.maximo],
          ] as const
        ).map(([rotulo, v]) => (
          <Par key={rotulo} rotulo={rotulo}>
            <span className="num text-medio font-[620]">{valor(v)}</span>
          </Par>
        ))}
      </dl>
      <Barras fatias={a.fatias} base={a.respondentes} />
    </div>
  );
}

function BlocoTexto({ a }: { a: ApuracaoTexto }) {
  const [todos, setTodos] = useState(false);
  if (a.textos.length === 0) return <p className="text-corpo text-apagado italic">Ninguém escreveu nesta pergunta.</p>;
  const visiveis = todos ? a.textos : a.textos.slice(0, TEXTOS_VISIVEIS);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {visiveis.map((t, i) => (
          <li
            key={i}
            className="rounded-controle border border-linha bg-poco px-3 py-2 text-corpo whitespace-pre-wrap text-tinta-2 [overflow-wrap:anywhere]"
          >
            {t}
          </li>
        ))}
      </ul>
      {a.textos.length > TEXTOS_VISIVEIS && (
        <Botao
          variante="fantasma"
          className="self-start"
          icone={todos ? "chevron-cima" : "chevron-baixo"}
          onClick={() => setTodos((v) => !v)}
        >
          {todos ? "Mostrar menos" : `Mostrar as ${num(a.textos.length)} respostas`}
        </Botao>
      )}
    </div>
  );
}

function PerguntaApurada({ a, indice }: { a: ApuracaoCampo; indice: number }) {
  let corpo: ReactNode;
  if (a.respondentes === 0 && a.forma !== "texto")
    corpo = <p className="text-corpo text-apagado italic">Ninguém respondeu esta pergunta.</p>;
  else if (a.forma === "opcoes") corpo = <BlocoOpcoes a={a} />;
  else if (a.forma === "escala") corpo = <BlocoEscala a={a} />;
  else if (a.forma === "numero") corpo = <BlocoNumero a={a} />;
  else corpo = <BlocoTexto a={a} />;

  return (
    // Texto ocupa a largura toda: lista de comentário espremida em meia coluna vira tripa.
    <Painel className={cn(a.forma === "texto" && "xl:col-span-2")}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-micro text-apagado">
            <span className="num grid size-5 place-items-center rounded-chip bg-poco-forte font-[600] text-tinta-2">
              {indice}
            </span>
            <Icone nome={ICONE_FORMA[a.forma]} tamanho={14} />
            {TIPO_CAMPO_ROTULO[a.campo.tipo]}
          </p>
          {/* A pergunta inteira, sem cortar: é ela que dá sentido ao número. */}
          <h3 className="mt-1.5 text-medio font-[600] text-tinta">{a.campo.rotulo}</h3>
          {a.campo.ajuda && <p className="mt-0.5 text-pequeno text-apagado">{a.campo.ajuda}</p>}
        </div>
        <p className="num shrink-0 text-right text-pequeno text-apagado">
          {plural(a.respondentes, "resposta", "respostas")}
          {a.emBranco > 0 && <span className="block">{num(a.emBranco)} em branco</span>}
        </p>
      </header>
      {corpo}
    </Painel>
  );
}

/** Um filtro por pergunta de marcação única: as opções com a contagem ao lado. */
function ComboRecorte({
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
  const opcoes = useMemo<Opcao[]>(() => {
    const contagem = new Map<string, number>();
    for (const r of respostas) {
      const v = r[String(campo.id)];
      if (typeof v === "string" && v) contagem.set(v, (contagem.get(v) ?? 0) + 1);
    }
    return [
      { valor: TODAS, rotulo: "Todas as respostas" },
      ...(campo.config.opcoes ?? []).map((op) => ({ valor: op, rotulo: op, detalhe: num(contagem.get(op) ?? 0) })),
    ];
  }, [respostas, campo]);

  return (
    <Combo
      className="w-full sm:w-60"
      icone="filtrar"
      rotuloAcessivel={`Recorte por ${campo.rotulo}`}
      placeholder={campo.rotulo}
      opcoes={opcoes}
      valor={ativo ? segmento!.valor : null}
      onMudar={(v) => onSegmento(v === TODAS ? null : { campoId: campo.id, valor: v })}
    />
  );
}

/**
 * O resumo das respostas de um formulário. O recorte sai da própria definição:
 * toda pergunta de marcação única com poucas opções (setor, tempo de casa) vira
 * filtro, sem ninguém marcar nada como "campo de segmento".
 *
 * Em pesquisa anônima, recorte fino identifica gente ("Fiscal com menos de seis
 * meses" pode ser uma pessoa só), e o resumo se recusa a mostrar um recorte com
 * menos de `MIN_ANONIMATO` respostas. A tela que exporta aplica a mesma trava.
 */
export function ApuracaoFormulario({
  campos,
  respostas,
  anonimo = false,
  segmento,
  onSegmento,
  vazio,
}: {
  campos: FormularioCampo[];
  respostas: RespostaValores[];
  /** Pesquisa sem identificação: liga a trava de recorte pequeno. */
  anonimo?: boolean;
  /** Recorte ativo, controlado pela tela (que também exporta com ele). */
  segmento: Segmento | null;
  onSegmento: (s: Segmento | null) => void;
  /** O que mostrar sem nenhuma resposta. */
  vazio?: ReactNode;
}) {
  const segmentaveis = useMemo(() => camposDeSegmento(campos), [campos]);
  const filtradas = useMemo(() => filtrarRespostas(respostas, segmento), [respostas, segmento]);
  const apuracoes = useMemo(() => apurarFormulario(campos, filtradas), [campos, filtradas]);
  const geral = useMemo(() => indicadoresGerais(apuracoes), [apuracoes]);
  const textos = useMemo(
    () => apuracoes.reduce((s, a) => s + (a.forma === "texto" ? a.textos.length : 0), 0),
    [apuracoes]
  );
  const temTexto = apuracoes.some((a) => a.forma === "texto");

  if (respostas.length === 0)
    return <>{vazio ?? <Painel><Vazio icone="grafico" titulo="Nenhuma resposta ainda" /></Painel>}</>;
  if (campos.length === 0)
    return (
      <Painel>
        <Vazio icone="relatorio" titulo="Formulário sem perguntas" descricao="Não há o que resumir nas respostas." />
      </Painel>
    );

  const campoSeg = segmento ? campos.find((c) => c.id === segmento.campoId) : null;
  const escondido = anonimo && segmento != null && filtradas.length < MIN_ANONIMATO;

  return (
    <div className="flex flex-col gap-4">
      {segmentaveis.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-pequeno font-[560] text-tinta-2">Recorte</span>
          {segmentaveis.map((c) => (
            <ComboRecorte key={c.id} campo={c} respostas={respostas} segmento={segmento} onSegmento={onSegmento} />
          ))}
          {segmento && (
            <Botao variante="fantasma" icone="fechar" onClick={() => onSegmento(null)}>
              Limpar recorte
            </Botao>
          )}
        </div>
      )}

      {escondido ? (
        <Painel>
          <Vazio
            icone="escudo"
            titulo="Poucas respostas neste recorte"
            descricao={`São ${plural(filtradas.length, "resposta", "respostas")}. O resumo de um recorte aparece a partir de ${num(MIN_ANONIMATO)}.`}
            acao={<Botao onClick={() => onSegmento(null)}>Ver todas as respostas</Botao>}
          />
        </Painel>
      ) : (
        <>
          <FaixaIndicadores colunas={4}>
            <Indicador
              rotulo={segmento ? "Respostas no recorte" : "Respostas"}
              icone="certo-duplo"
              valor={num(filtradas.length)}
              detalhe={
                segmento && campoSeg
                  ? `${campoSeg.rotulo}: ${segmento.valor}`
                  : plural(campos.length, "pergunta no formulário", "perguntas no formulário")
              }
            />
            {geral.indice != null && (
              <Indicador
                rotulo="Índice geral"
                icone="velocimetro"
                valor={pct(geral.indice)}
                detalhe={
                  geral.perguntasEscala === 1
                    ? "A pergunta de nota, de 0 a 100"
                    : `Média das ${num(geral.perguntasEscala)} perguntas de nota, de 0 a 100`
                }
              />
            )}
            {geral.favoravel != null && (
              <Indicador
                rotulo="Favorabilidade"
                icone="tendencia"
                valor={pct(geral.favoravel)}
                detalhe="Notas nos dois níveis mais altos"
                tom={tomFavoravel(geral.favoravel)}
              />
            )}
            {temTexto && (
              <Indicador rotulo="Comentários" icone="nota" valor={num(textos)} detalhe="Respostas escritas" />
            )}
          </FaixaIndicadores>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            {apuracoes.map((a, i) => (
              <PerguntaApurada key={a.campo.id} a={a} indice={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
