"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { PainelErro } from "@/componentes/primitivos/estados";
import {
  FaixaPendenciasDp,
  ListaUrgencias,
  TituloBlocoDp,
  type ItemUrgencia,
} from "@/componentes/produto/folha/pendencias-dp";
import { TextoPrazo } from "@/componentes/produto/folha/prazo-dp";
import { dataBR, num } from "@/lib/format";
import type { PainelColaborador } from "@/lib/painel-dp-tipos";
import { linkFerias, linkRescisoes } from "@/lib/painel-links";
import { useConsulta } from "@/hooks/use-consulta";

/**
 * Meu painel: a home de quem trabalha a fila do DP. As três pendências e os
 * casos mais urgentes em lista, cada um abrindo a tela que resolve já com a
 * empresa escolhida. Sem atividade nem ranking de colegas: isso é do Painel da
 * Equipe, numa rota que o colaborador não alcança.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = useConsulta<PainelColaborador>(
    "folha-painel",
    "/api/folha/painel"
  );
  const tentar = () => refetch();

  if (error && !data)
    return (
      <PainelErro titulo="Não deu para carregar o painel" mensagem={(error as Error).message} onTentar={tentar} />
    );

  const carregando = isLoading || !data;
  const hoje = data?.periodo.fim;

  const rescisoes: ItemUrgencia[] | null | undefined =
    hoje && data
      ? (data.rescisoesUrgentes?.map((i) => ({
          chave: `${i.codigoempresa}:${i.contrato}`,
          href: linkRescisoes(hoje, i.codigoempresa),
          titulo: i.funcionario,
          apoio: `${i.empresa} · prazo ${dataBR(i.prazo)}`,
          // O tom segue a situação da lib: a antecedência do aviso é configurável,
          // e só o servidor sabe se "vence em 3 dias" já é "vence em breve".
          direita: <TextoPrazo dias={i.diasParaPrazo} atencao={i.situacao === "vence_breve"} />,
        })) ?? null)
      : undefined;

  const ferias: ItemUrgencia[] | null | undefined =
    hoje && data
      ? (data.feriasCriticas?.map((i) => ({
          chave: `${i.codigoempresa}:${i.contrato}`,
          href: linkFerias(hoje, i.codigoempresa),
          titulo: i.funcionario,
          apoio:
            i.periodosVencidos > 1 ? `${i.empresa} · ${num(i.periodosVencidos)} períodos vencidos` : i.empresa,
          direita: <TextoPrazo dias={i.diasParaLimite} />,
        })) ?? null)
      : undefined;

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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ListaUrgencias
          titulo="Rescisões mais Urgentes"
          descricao="As pendentes mais perto do prazo de pagamento"
          acoes={
            hoje && (
              <BotaoLink variante="fantasma" href={linkRescisoes(hoje)} iconeFim="seta-direita">
                Ver todas
              </BotaoLink>
            )
          }
          itens={rescisoes}
          carregando={carregando}
          vazio="Nenhuma rescisão pendente"
          onTentar={tentar}
        />
        {/* Sem "ver todas": a tela de Férias é de uma empresa por vez, e cada
            linha já abre a empresa dela. */}
        <ListaUrgencias
          titulo="Férias mais Críticas"
          descricao="Mais períodos vencidos primeiro"
          itens={ferias}
          carregando={carregando}
          vazio="Ninguém com férias vencidas"
          onTentar={tentar}
        />
      </div>
    </>
  );
}
