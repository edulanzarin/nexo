"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { PainelErro } from "@/componentes/primitivos/estados";
import { FaixaAtividade, FaixaBase, FeedAtividade } from "@/componentes/produto/contabil/painel-atividade";
import { useConsulta } from "@/hooks/use-consulta";
import type { PainelContabilGestao } from "@/lib/painel-contabil-tipos";
import { SerieTrabalhos } from "./serie-trabalhos";

/**
 * Painel da equipe: a home do gestor. Atividade do time no mês, a série de
 * seis meses, o feed com o nome de quem fez e a base configurada.
 *
 * O painel não dispara nada: o Contábil é bancada (conciliação, balancete e
 * implantação precisam de empresa e período), então a home é o placar do que
 * JÁ se rodou, lido da trilha de auditoria do banco do app. Não toca o
 * Questor, e por isso carrega sozinho, sem Executar.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = useConsulta<PainelContabilGestao>(
    "painel-contabil-gestao",
    "/api/contabil/painel-gestao"
  );
  const tentar = () => refetch();

  if (error && !data)
    return (
      <PainelErro
        titulo="Não deu para carregar o painel"
        mensagem={(error as Error).message}
        onTentar={tentar}
      />
    );

  const carregando = isLoading || !data;

  return (
    <>
      <AcoesPagina>
        <Botao variante="fantasma" icone="atualizar" carregando={isFetching && !isLoading} onClick={tentar}>
          Atualizar
        </Botao>
      </AcoesPagina>

      <FaixaAtividade
        titulo="Atividade do time"
        periodo={data?.periodo}
        atividade={data?.atividade}
        carregando={carregando}
        onTentar={tentar}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SerieTrabalhos
          className="xl:col-span-2"
          serie={data?.serie}
          carregando={carregando}
          onTentar={tentar}
        />
        {/* O feed acompanha a altura do gráfico e rola por dentro: posto em
            absoluto, ele não estica a linha da grade com os doze eventos. */}
        <div className="relative xl:min-h-[22rem]">
          <FeedAtividade
            className="max-h-[32rem] xl:absolute xl:inset-0 xl:max-h-none"
            comAutor
            eventos={data?.recentes}
            carregando={carregando}
            descricao="Os últimos gestos do time no NaveX"
            vazio={{
              titulo: "Sem atividade registrada",
              descricao: "Conciliações, laudos, implantações e triagens do time aparecem aqui.",
            }}
            onTentar={tentar}
          />
        </div>
      </div>

      <FaixaBase base={data?.base} carregando={carregando} onTentar={tentar} />
    </>
  );
}
