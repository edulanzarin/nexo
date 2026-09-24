"use client";

import { useState } from "react";
import { BarraComposicao } from "@/componentes/primitivos/barra";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador, type Tom } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Ponto, Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { GraficoSerie, Legenda, type Serie } from "@/componentes/produto/graficos";
import { cn } from "@/lib/cn";
import { nomeMes } from "@/lib/contexto";
import { brl, brlCompact, decimal, num, pct } from "@/lib/format";
import type { AnaliseDeterministica, GrupoPatrimonial, Inconsistencia, IndicadorCalc, LinhaDRE } from "@/lib/types";

/*
 * As seções da Análise. Tudo aqui é o motor determinístico: regras e contas
 * sobre os saldos do contábil, sem IA. A IA só entra no laudo escrito, depois.
 */

export const SAUDE: Record<AnaliseDeterministica["saudeGeral"], { rotulo: string; tom: Tom }> = {
  forte: { rotulo: "Forte", tom: "ok" },
  estavel: { rotulo: "Estável", tom: "rota" },
  atencao: { rotulo: "Requer atenção", tom: "atencao" },
  critica: { rotulo: "Crítica", tom: "perigo" },
};

export const SEVERIDADE: Record<Inconsistencia["severidade"], { rotulo: string; tom: Tom; ordem: number }> = {
  alta: { rotulo: "Alta", tom: "perigo", ordem: 0 },
  media: { rotulo: "Média", tom: "atencao", ordem: 1 },
  baixa: { rotulo: "Baixa", tom: "neutro", ordem: 2 },
};

export const FAIXA: Record<IndicadorCalc["faixa"], { rotulo: string; tom: Tom }> = {
  bom: { rotulo: "Bom", tom: "ok" },
  atencao: { rotulo: "Atenção", tom: "atencao" },
  ruim: { rotulo: "Ruim", tom: "perigo" },
  neutro: { rotulo: "Sem leitura", tom: "neutro" },
};

/**
 * A tendência já vem com o sentido do indicador aplicado pelo motor (endividamento
 * caindo é melhora), então a tela diz a palavra e não desenha seta: seta para
 * baixo num "melhorando" confunde.
 */
export const TENDENCIA: Record<IndicadorCalc["tendencia"], { rotulo: string; tom: Tom } | null> = {
  melhora: { rotulo: "melhorando", tom: "ok" },
  piora: { rotulo: "piorando", tom: "perigo" },
  estavel: { rotulo: "estável", tom: "neutro" },
  indef: null,
};

/** Cor de cada grupo do balanço: vem do grupo, não da posição no gráfico. */
export const COR_GRUPO: Record<GrupoPatrimonial["chave"], string> = {
  ativoCirc: "var(--serie-1)",
  ativoNaoCirc: "var(--serie-3)",
  passivoCirc: "var(--serie-2)",
  passivoNaoCirc: "var(--serie-5)",
  pl: "var(--serie-6)",
};

/** As linhas de fluxo que a evolução acompanha, com a cor de cada uma. */
export const FLUXO_EVOLUCAO: Record<string, string> = {
  receitaLiquida: "var(--serie-1)",
  custoDespesa: "var(--serie-2)",
  resultado: "var(--serie-4)",
};

/** Nome da linha da DRE sem o prefixo de operação ("(−) ", "(=) "). */
export const nomeSemSinal = (nome: string) => nome.replace(/^\([−=]\)\s*/, "");

/** Valor de indicador na unidade dele. */
function formatarIndicador(v: number, unidade: IndicadorCalc["unidade"]): string {
  if (unidade === "pct") return pct(v * 100);
  if (unidade === "reais") return brl(v);
  return decimal(v, 2);
}

function eixoIndicador(v: number, unidade: IndicadorCalc["unidade"]): string {
  if (unidade === "pct") return pct(v * 100, 0);
  if (unidade === "reais") return brlCompact(v);
  return decimal(v, 1);
}

// ── Faixa de leitura ────────────────────────────────────────────────────────

export function FaixaLeitura({ analise }: { analise: AnaliseDeterministica }) {
  const saude = SAUDE[analise.saudeGeral] ?? SAUDE.estavel;
  const resultado = analise.dre.find((l) => l.chave === "resultado");
  const margem = analise.indicadores.find((i) => i.chave === "margemLiquida");
  const cont = { alta: 0, media: 0, baixa: 0 };
  for (const i of analise.inconsistencias) cont[i.severidade]++;
  const partes = [
    cont.alta ? `${num(cont.alta)} ${cont.alta === 1 ? "alta" : "altas"}` : null,
    cont.media ? `${num(cont.media)} ${cont.media === 1 ? "média" : "médias"}` : null,
    cont.baixa ? `${num(cont.baixa)} ${cont.baixa === 1 ? "baixa" : "baixas"}` : null,
  ].filter(Boolean);
  const negativo = resultado != null && resultado.valor < 0;
  return (
    <FaixaIndicadores>
      <Indicador
        rotulo="Saúde geral"
        icone="atividade"
        valor={saude.rotulo}
        detalhe="pelas regras, sem IA"
        tom={saude.tom}
        valorNoTom={saude.tom === "perigo" || saude.tom === "atencao"}
      />
      <Indicador
        rotulo="Fechamento"
        icone="balanca"
        valor={analise.fecha ? "Fecha" : "Não fecha"}
        detalhe={analise.fecha ? "saldo devedor igual ao credor" : `diferença de ${brl(Math.abs(analise.difFechamento))}`}
        tom={analise.fecha ? "ok" : "perigo"}
        valorNoTom={!analise.fecha}
      />
      <Indicador
        rotulo="Resultado do período"
        icone={negativo ? "tendencia-baixa" : "tendencia"}
        valor={resultado ? brl(resultado.valor) : "—"}
        detalhe={margem?.valor != null ? `margem de ${pct(margem.valor * 100)}` : "sem receita no período"}
        tom={negativo ? "perigo" : "neutro"}
        valorNoTom={negativo}
      />
      <Indicador
        rotulo="Ativo total"
        icone="empresa"
        valor={brl(analise.totais.ativo)}
        detalhe={`patrimônio líquido de ${brl(analise.totais.pl)}`}
      />
      <Indicador
        rotulo="Alertas"
        icone="alerta"
        valor={num(analise.inconsistencias.length)}
        detalhe={partes.length ? partes.join(", ") : "nenhuma inconsistência de regra"}
        tom={cont.alta ? "perigo" : cont.media ? "atencao" : "neutro"}
        valorNoTom={cont.alta > 0}
      />
    </FaixaIndicadores>
  );
}

// ── Validação contábil ──────────────────────────────────────────────────────

export function PainelValidacao({ analise }: { analise: AnaliseDeterministica }) {
  const cob = analise.cobertura;
  const parcial = cob.mesesComMovimento < cob.mesesSolicitados || !cob.temSaldoInicial;
  const lista = [...analise.inconsistencias].sort((a, b) => SEVERIDADE[a.severidade].ordem - SEVERIDADE[b.severidade].ordem);
  return (
    <Painel
      titulo="Validação contábil"
      descricao="Regras aplicadas aos saldos, da mais grave à mais leve"
      icone="escudo"
      corpo="p-0"
      className="print:break-inside-avoid"
      rodape={
        parcial ? (
          <Nota icone="info">
            {num(cob.mesesComMovimento)} de {num(cob.mesesSolicitados)} meses com movimento
            {cob.primeiroMesComDado ? `, a partir de ${nomeMes(cob.primeiroMesComDado)}` : ""}.
            {!cob.temSaldoInicial && " Sem saldo antes do período: empresa nova no recorte ou início da escrituração."}
          </Nota>
        ) : undefined
      }
    >
      {lista.length === 0 ? (
        <Vazio compacto icone="ok" titulo="Nenhuma inconsistência de regra" />
      ) : (
        <ul className="flex flex-col">
          {lista.map((i, idx) => (
            <li key={idx} className="flex items-start gap-3 border-b border-linha px-4 py-2.5 last:border-0">
              <Selo tom={SEVERIDADE[i.severidade].tom} className="mt-px w-14 justify-center">
                {SEVERIDADE[i.severidade].rotulo}
              </Selo>
              <div className="min-w-0 flex-1">
                <p className="text-corpo font-[560] text-tinta">{i.titulo}</p>
                <p className="mt-0.5 text-pequeno text-apagado">{i.detalhe}</p>
              </div>
              {i.valor != null && <span className="num shrink-0 text-corpo text-tinta-2">{brl(i.valor)}</span>}
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}

// ── Indicadores ─────────────────────────────────────────────────────────────

export function PainelIndicadores({ analise }: { analise: AnaliseDeterministica }) {
  const [aberto, setAberto] = useState<IndicadorCalc | null>(null);
  const temSerie = analise.meses.length > 1;

  const colunas: Coluna<IndicadorCalc>[] = [
    { id: "nome", cabecalho: "Indicador", largura: "220px", classe: "font-[560] text-tinta", celula: (i) => i.nome },
    {
      id: "valor",
      cabecalho: "Último mês",
      alinhar: "dir",
      largura: "128px",
      classe: "font-[600] text-tinta",
      ordenar: (i) => i.valor,
      celula: (i) => i.formatado,
    },
    {
      id: "faixa",
      cabecalho: "Leitura",
      largura: "116px",
      ordenar: (i) => i.faixa,
      celula: (i) => <Selo tom={FAIXA[i.faixa].tom}>{FAIXA[i.faixa].rotulo}</Selo>,
    },
    {
      id: "tendencia",
      cabecalho: "Tendência",
      largura: "124px",
      secundaria: true,
      ordenar: (i) => i.tendencia,
      celula: (i) => {
        const t = TENDENCIA[i.tendencia];
        if (!t) return <span className="text-apagado/60">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-tinta-2">
            <Ponto tom={t.tom} />
            {t.rotulo}
          </span>
        );
      },
    },
    { id: "leitura", cabecalho: "O que diz", classe: "text-apagado", celula: (i) => i.interpretacao },
  ];

  return (
    <>
      <Painel
        titulo="Indicadores"
        descricao={
          temSerie ? (
            <span className="nx-sem-papel">Clique num indicador para ver a evolução mês a mês</span>
          ) : (
            "Calculados sobre os saldos do último mês"
          )
        }
        icone="velocimetro"
        corpo="p-0"
        className="print:break-inside-avoid"
      >
        <TabelaDados
          rotulo="Indicadores"
          colunas={colunas}
          linhas={analise.indicadores}
          chave={(i) => i.chave}
          onLinha={temSerie ? setAberto : undefined}
          className="print:!overflow-visible"
          vazio={<Vazio compacto icone="velocimetro" titulo="Sem saldo para calcular indicadores" />}
        />
      </Painel>
      {aberto && (
        <ModalIndicador indicador={aberto} meses={analise.meses} onFechar={() => setAberto(null)} />
      )}
    </>
  );
}

function ModalIndicador({
  indicador,
  meses,
  onFechar,
}: {
  indicador: IndicadorCalc;
  meses: string[];
  onFechar: () => void;
}) {
  // Mês sem valor (sem passivo, sem receita) fica fora do gráfico: desenhado
  // como zero, afirmaria um número que não existe.
  const dados = meses
    .map((m, i) => ({ mes: nomeMes(m), valor: indicador.serie[i] }))
    .filter((d): d is { mes: string; valor: number } => d.valor != null && Number.isFinite(d.valor));
  const serie: Serie[] = [{ chave: "valor", rotulo: indicador.nome, cor: "var(--serie-1)", tipo: "linha" }];
  const t = TENDENCIA[indicador.tendencia];
  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="m"
      titulo={indicador.nome}
      descricao={indicador.interpretacao}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-3 gap-4">
          <Par rotulo="Último mês">
            <span className="num text-medio font-[600]">{indicador.formatado}</span>
          </Par>
          <Par rotulo="Leitura">
            <Selo tom={FAIXA[indicador.faixa].tom}>{FAIXA[indicador.faixa].rotulo}</Selo>
          </Par>
          <Par rotulo="Tendência">{t ? t.rotulo : "sem série para comparar"}</Par>
        </dl>
        <div className="h-56 min-w-0">
          {dados.length > 1 ? (
            <GraficoSerie
              dados={dados}
              x="mes"
              series={serie}
              formatar={(v) => formatarIndicador(v, indicador.unidade)}
              formatarEixo={(v) => eixoIndicador(v, indicador.unidade)}
            />
          ) : (
            <p className="grid h-full place-items-center text-corpo text-apagado italic">
              Menos de dois meses com valor: não há evolução para desenhar.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Estrutura patrimonial ───────────────────────────────────────────────────

interface LinhaEstrutura {
  chave: string;
  nome: string;
  saldo: number;
  parte: number | null;
  cor?: string;
  total?: boolean;
}

const COLUNAS_ESTRUTURA: Coluna<LinhaEstrutura>[] = [
  {
    id: "nome",
    cabecalho: "Grupo",
    celula: (l) =>
      l.total ? (
        <span className="font-[600] text-tinta">{l.nome}</span>
      ) : (
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: l.cor }} />
          {l.nome}
        </span>
      ),
  },
  {
    id: "saldo",
    cabecalho: "Saldo",
    alinhar: "dir",
    largura: "160px",
    celula: (l) => (
      <span className={cn(l.total ? "font-[600] text-tinta" : "text-tinta-2", l.saldo < 0 && "text-perigo")}>{brl(l.saldo)}</span>
    ),
  },
  {
    id: "parte",
    cabecalho: "Parte",
    alinhar: "dir",
    largura: "72px",
    classe: "text-apagado",
    celula: (l) => (l.parte != null ? pct(l.parte * 100, 0) : "—"),
  },
];

/** Balanço resumido do último mês: o Ativo de um lado, Passivo e PL do outro, e fecham. */
export function PainelEstrutura({ analise }: { analise: AnaliseDeterministica }) {
  const { estrutura, totais } = analise;
  const grupo = (chave: GrupoPatrimonial["chave"]): LinhaEstrutura | null => {
    const g = estrutura.find((x) => x.chave === chave);
    return g ? { chave: g.chave, nome: g.nome, saldo: g.saldo, parte: g.pctBase, cor: COR_GRUPO[g.chave] } : null;
  };
  const ativo = [grupo("ativoCirc"), grupo("ativoNaoCirc")].filter((l): l is LinhaEstrutura => l != null);
  const passivo = [grupo("passivoCirc"), grupo("passivoNaoCirc"), grupo("pl")].filter(
    (l): l is LinhaEstrutura => l != null
  );
  const linhas: LinhaEstrutura[] = [
    ...ativo,
    { chave: "totalAtivo", nome: "Ativo total", saldo: totais.ativo, parte: 1, total: true },
    ...passivo,
    { chave: "totalPassivo", nome: "Passivo e PL", saldo: totais.passivo + totais.pl, parte: 1, total: true },
  ];
  const partes = (ls: LinhaEstrutura[]) => ls.map((l) => ({ valor: l.saldo, cor: l.cor ?? "var(--serie-outras)", rotulo: l.nome }));

  return (
    <Painel
      titulo="Estrutura patrimonial"
      descricao="Saldo no último mês do período"
      icone="camadas"
      corpo="p-0"
      className="print:break-inside-avoid"
      rodape={
        Math.abs(totais.resultadoExercicio) > 1 ? (
          <Nota>
            O PL inclui {brl(totais.resultadoExercicio)} de resultado do exercício ainda não transportado às contas de
            PL, o normal antes da apuração.
          </Nota>
        ) : undefined
      }
    >
      {/* As barras são cor de fundo, que a impressão descarta por padrão. */}
      <div className="flex flex-col gap-2.5 border-b border-linha px-4 py-3 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
        <div className="grid grid-cols-[88px_1fr] items-center gap-3">
          <span className="text-pequeno text-apagado">Ativo</span>
          <BarraComposicao partes={partes(ativo)} />
          <span className="text-pequeno text-apagado">Passivo e PL</span>
          <BarraComposicao partes={partes(passivo)} />
        </div>
        <Legenda itens={[...ativo, ...passivo].map((l) => ({ rotulo: l.nome, cor: l.cor ?? "var(--serie-outras)" }))} />
      </div>
      <TabelaDados rotulo="Estrutura patrimonial" colunas={COLUNAS_ESTRUTURA} linhas={linhas} chave={(l) => l.chave} />
    </Painel>
  );
}

// ── DRE do período ──────────────────────────────────────────────────────────

const COLUNAS_DRE: Coluna<LinhaDRE>[] = [
  {
    id: "nome",
    cabecalho: "Linha",
    celula: (l) => <span className={l.destaque ? "font-[600] text-tinta" : "text-tinta-2"}>{l.nome}</span>,
  },
  {
    id: "valor",
    cabecalho: "Valor",
    alinhar: "dir",
    largura: "160px",
    celula: (l) => (
      <span className={cn(l.destaque ? "font-[600] text-tinta" : "text-tinta-2", l.destaque && l.valor < 0 && "text-perigo")}>
        {brl(l.valor)}
      </span>
    ),
  },
  {
    id: "parte",
    cabecalho: "Da receita",
    alinhar: "dir",
    largura: "92px",
    classe: "text-apagado",
    celula: (l) => (l.pctReceita != null ? pct(l.pctReceita * 100, 0) : "—"),
  },
];

/** A DRE condensada do período, em movimento: receita e despesa do intervalo. */
export function PainelDre({ dre }: { dre: LinhaDRE[] }) {
  return (
    <Painel
      titulo="Resultado do período"
      descricao="DRE condensada"
      icone="relatorio"
      corpo="p-0"
      className="print:break-inside-avoid"
      rodape={
        <Nota>
          Movimento do período, não o saldo acumulado do ano. O percentual é sobre a receita líquida.
        </Nota>
      }
    >
      <TabelaDados
        rotulo="Resultado do período"
        colunas={COLUNAS_DRE}
        linhas={dre}
        chave={(l) => l.chave}
        vazio={<Vazio compacto icone="relatorio" titulo="Sem receita nem despesa no período" />}
      />
    </Painel>
  );
}

// ── Evolução mês a mês ──────────────────────────────────────────────────────

export interface LinhaMensal {
  chave: string;
  nome: string;
  serie: number[];
  cor: string;
  destaque?: boolean;
  /** Negativo é normal nesta linha (custo): não pinta de perigo. */
  negativoNormal?: boolean;
  tipo: "linha" | "barra";
}

/**
 * Uma série mês a mês em gráfico e em tabela. O gráfico mostra a forma; a
 * tabela dá o número que vai para o papel e para a conversa com o cliente.
 */
export function PainelSerieMensal({
  titulo,
  descricao,
  meses,
  linhas,
}: {
  titulo: string;
  descricao: string;
  meses: string[];
  linhas: LinhaMensal[];
}) {
  const dados = meses.map((m, i) => {
    const ponto: Record<string, string | number> = { mes: nomeMes(m) };
    for (const l of linhas) ponto[l.chave] = l.serie[i] ?? 0;
    return ponto;
  });
  const series: Serie[] = linhas.map((l) => ({ chave: l.chave, rotulo: l.nome, cor: l.cor, tipo: l.tipo }));
  const colunas: Coluna<LinhaMensal>[] = [
    {
      id: "nome",
      cabecalho: "Linha",
      largura: "210px",
      celula: (l) => (
        <span className={cn("flex items-center gap-2", l.destaque ? "font-[600] text-tinta" : "text-tinta-2")}>
          <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: l.cor }} />
          <span className="truncate">{l.nome}</span>
        </span>
      ),
    },
    ...meses.map<Coluna<LinhaMensal>>((m, i) => ({
      id: m,
      cabecalho: nomeMes(m),
      alinhar: "dir",
      largura: "92px",
      celula: (l) => {
        const v = l.serie[i] ?? 0;
        return <span className={cn(v < 0 && !l.negativoNormal && "text-perigo", l.destaque && "font-[600]")}>{brlCompact(v)}</span>;
      },
    })),
  ];
  return (
    <Painel titulo={titulo} descricao={descricao} icone="tendencia" corpo="p-0" className="print:break-inside-avoid">
      {/* O gráfico mede a largura da tela e não refaz a conta para a folha:
          no papel vai só a tabela, que carrega os mesmos números. */}
      <div className="nx-sem-papel flex flex-col gap-3 border-b border-linha px-4 py-3">
        <Legenda itens={linhas.map((l) => ({ rotulo: l.nome, cor: l.cor }))} />
        <div className="h-56 min-w-0">
          <GraficoSerie dados={dados} x="mes" series={series} formatar={(v) => brl(v)} formatarEixo={brlCompact} />
        </div>
      </div>
      <TabelaDados rotulo={titulo} colunas={colunas} linhas={linhas} chave={(l) => l.chave} className="print:!overflow-visible" />
    </Painel>
  );
}
