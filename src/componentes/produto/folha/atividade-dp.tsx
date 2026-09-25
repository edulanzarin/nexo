"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Vazio } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { CaixaGrafico, GraficoSerie, Legenda, RankingBarras, type Serie } from "@/componentes/produto/graficos";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { nomeMes } from "@/lib/contexto";
import { dataBR, mesBR, num } from "@/lib/format";
import type { PainelAtividade, PainelOperador, PainelSeriePonto, PainelTrabalhos } from "@/lib/painel-dp-tipos";
import { BlocoIndisponivelDp, TituloBlocoDp } from "./pendencias-dp";

/*
 * A atividade do DP no Painel da Equipe: os quatro trabalhos clássicos do mês
 * (a lib traduz os doze da Produtividade para estes quatro de propósito), a
 * série de seis meses e quem mais trabalhou.
 */

type ChaveTrabalho = Exclude<keyof PainelTrabalhos, "total">;

/**
 * Os quatro trabalhos, com a cor da série. A cor é por trabalho e não pela
 * posição, então a rescisão é a mesma cor na legenda, na dica e na pilha.
 *
 * Admissão e férias levam a cor da família delas na Produtividade do DP
 * (`COR_FAMILIA`: movimentação e férias). Aviso e rescisão também são
 * movimentação, mas lá dividem o azul; numa pilha, três barras do mesmo azul
 * viram uma só, então aqui ganham cor própria.
 */
export const TRABALHOS_PAINEL_DP: { chave: ChaveTrabalho; rotulo: string; icone: NomeIcone; cor: string }[] = [
  { chave: "admissoes", rotulo: "Admissões", icone: "contrato", cor: "var(--ent)" },
  { chave: "avisos", rotulo: "Avisos prévios", icone: "relogio", cor: "var(--serie-2)" },
  { chave: "rescisoes", rotulo: "Rescisões", icone: "recibo", cor: "var(--serie-5)" },
  { chave: "ferias", rotulo: "Férias calculadas", icone: "calendario", cor: "var(--sai)" },
];

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * O mês em cinco números: cada trabalho contra o período anterior de mesmo
 * tamanho (a lib compara 1 a 25 de setembro com os 25 dias antes, não com
 * agosto inteiro) e quantas pessoas do DP trabalharam.
 */
export function FaixaAtividadeDp({
  periodo,
  atividade,
  carregando,
  onTentar,
}: {
  periodo?: { inicio: string; fim: string };
  atividade: PainelAtividade | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
}) {
  const cabeca = (
    <TituloBlocoDp
      titulo={periodo ? `Atividade em ${maiuscula(nomeMes(periodo.inicio.slice(0, 7), true))}` : "Atividade no Mês"}
      apoio={periodo ? `${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}` : undefined}
    />
  );
  if (!carregando && !atividade)
    return (
      <section className="flex flex-col gap-2">
        {cabeca}
        <BlocoIndisponivelDp titulo="Atividade indisponível" onTentar={onTentar} />
      </section>
    );
  const a = atividade;
  return (
    <section className="flex flex-col gap-2">
      {cabeca}
      <FaixaIndicadores colunas={5}>
        {TRABALHOS_PAINEL_DP.map((t) => (
          <Indicador
            key={t.chave}
            rotulo={t.rotulo}
            icone={t.icone}
            carregando={carregando}
            valor={a ? num(a.mes[t.chave]) : ""}
            detalhe={
              a ? (
                <>
                  <Variacao atual={a.mes[t.chave]} anterior={a.anterior[t.chave]} />
                  {a.anterior[t.chave] > 0 && " · "}
                  {num(a.anterior[t.chave])} no período anterior
                </>
              ) : (
                ""
              )
            }
          />
        ))}
        <Indicador
          rotulo="Pessoas do DP"
          icone="pessoas"
          carregando={carregando}
          valor={a ? num(a.colaboradores) : ""}
          detalhe="Com algum trabalho no mês"
        />
      </FaixaIndicadores>
    </section>
  );
}

const SERIES: Serie[] = TRABALHOS_PAINEL_DP.map((t) => ({
  chave: t.chave,
  rotulo: t.rotulo,
  cor: t.cor,
  tipo: "barra" as const,
  pilha: "trabalhos",
}));

/** Série de seis meses dos quatro trabalhos, empilhados por mês. */
export function SerieAtividadeDp({
  serie,
  carregando,
  onTentar,
  className,
}: {
  serie: PainelSeriePonto[] | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
  className?: string;
}) {
  const titulo = "Atividade dos Últimos Seis Meses";
  const descricao = "Admissões, rescisões, avisos prévios e férias por mês";

  if (!carregando && !serie)
    return (
      <CaixaGrafico titulo={titulo} descricao={descricao} className={className} altura={260}>
        <Vazio
          compacto
          icone="alerta"
          titulo="Série indisponível"
          descricao="A consulta da série falhou no servidor."
          acao={
            onTentar && (
              <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
                Tentar de novo
              </Botao>
            )
          }
        />
      </CaixaGrafico>
    );

  const dados = (serie ?? []).map((p) => ({ ...p, mes: mesBR(p.bucket) }));
  // Total do semestre ao lado de cada nome: o gráfico mostra o ritmo, a
  // legenda responde "quanto no total" sem ninguém somar barra.
  const total = (k: ChaveTrabalho) => dados.reduce((s, p) => s + p[k], 0);
  const semNada = !dados.length || TRABALHOS_PAINEL_DP.every((t) => total(t.chave) === 0);

  return (
    <CaixaGrafico
      titulo={titulo}
      descricao={descricao}
      className={className}
      altura={260}
      carregando={carregando}
      vazio={semNada ? "Nenhuma admissão, rescisão, aviso ou férias nos últimos seis meses." : undefined}
      legenda={
        !carregando && (
          <Legenda itens={TRABALHOS_PAINEL_DP.map((t) => ({ rotulo: t.rotulo, cor: t.cor, valor: num(total(t.chave)) }))} />
        )
      }
    >
      <GraficoSerie dados={dados} x="mes" series={SERIES} tituloDica={(p) => maiuscula(nomeMes(p.bucket, true))} />
    </CaixaGrafico>
  );
}

/**
 * Quem mais trabalhou no mês. O número é a soma de TODOS os trabalhos do DP
 * que a Produtividade mede (folha, encargos, cadastro, eSocial), não só os
 * quatro da faixa: o painel responde "quem carregou o mês", e a folha é a
 * maior parte dele.
 */
export function RankingEquipeDp({
  operadores,
  carregando,
  onTentar,
  className,
}: {
  operadores: PainelOperador[] | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
  className?: string;
}) {
  return (
    <Painel
      titulo="Quem Mais Trabalhou no Mês"
      descricao="Todos os trabalhos do DP no Questor, por pessoa"
      icone="pessoas"
      corpo="p-2"
      className={className}
    >
      {carregando ? (
        <div aria-busy className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2 py-2">
              <Esqueleto className="h-3 w-40" />
              <Esqueleto className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : !operadores ? (
        <Vazio
          compacto
          icone="alerta"
          titulo="Ranking indisponível"
          descricao="A consulta da atividade falhou no servidor."
          acao={
            onTentar && (
              <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
                Tentar de novo
              </Botao>
            )
          }
        />
      ) : (
        <RankingBarras
          itens={operadores}
          rotulo={(o) => <span title={o.nome}>{o.nome}</span>}
          valor={(o) => o.total}
          vazio="Nenhum trabalho do DP no mês."
        />
      )}
    </Painel>
  );
}
