"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro } from "@/componentes/primitivos/estados";
import { FaixaAtividadeDp, RankingEquipeDp, SerieAtividadeDp } from "@/componentes/produto/folha/atividade-dp";
import { FaixaPendenciasDp, TituloBlocoDp } from "@/componentes/produto/folha/pendencias-dp";
import { dataBR } from "@/lib/format";
import type { PainelGestao } from "@/lib/painel-dp-tipos";
import { useConsulta } from "@/hooks/use-consulta";

/**
 * Painel da equipe: a home do gestor do DP. As três pendências do escritório,
 * a atividade do mês contra o período anterior, a série de seis meses e quem
 * mais trabalhou.
 *
 * Carrega sozinho, sem empresa nem período: as janelas são da lib (rescisões
 * de 180 dias, eSocial de 90, férias na data de hoje, atividade do mês
 * corrente). Cada bloco é uma consulta própria no servidor, e o que falhou
 * chega `null` e aparece indisponível só no pedaço dele.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = useConsulta<PainelGestao>(
    "folha-painel-gestao",
    "/api/folha/painel-gestao"
  );
  const tentar = () => refetch();

  if (error && !data)
    return (
      <PainelErro titulo="Não deu para carregar o painel" mensagem={(error as Error).message} onTentar={tentar} />
    );

  const carregando = isLoading || !data;
  const hoje = data?.periodo.fim;

  return (
    <>
      <AcoesPagina>
        <Botao variante="fantasma" icone="atualizar" carregando={isFetching && !isLoading} onClick={tentar}>
          Atualizar
        </Botao>
      </AcoesPagina>

      <section className="flex flex-col gap-2">
        <TituloBlocoDp titulo="Pendências do DP" apoio={hoje ? `Situação em ${dataBR(hoje)}` : undefined} />
        <FaixaPendenciasDp dados={data} hoje={hoje} carregando={carregando} />
      </section>

      <FaixaAtividadeDp
        periodo={data?.periodo}
        atividade={data?.atividade}
        carregando={carregando}
        onTentar={tentar}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SerieAtividadeDp className="xl:col-span-2" serie={data?.serie} carregando={carregando} onTentar={tentar} />
        <RankingEquipeDp operadores={data?.atividade?.topOperadores} carregando={carregando} onTentar={tentar} />
      </div>

      <Nota>Cada trabalho conta na data em que foi lançado no Questor.</Nota>
    </>
  );
}
