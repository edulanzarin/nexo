"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { PainelErro } from "@/componentes/primitivos/estados";
import { FaixaAtividade, FaixaBase, FeedAtividade } from "@/componentes/produto/contabil/painel-atividade";
import { useConsulta } from "@/hooks/use-consulta";
import type { PainelContabilColaborador } from "@/lib/painel-contabil-tipos";
import { ComposicaoMes } from "./composicao-mes";

/**
 * Meu painel: a home de quem não é gestor. Os MEUS números do mês, recortados
 * por dono no servidor, e a base configurada. Sem série do time e sem nome de
 * outra pessoa: quem não é gestor não busca o dado dos outros (a rota é outra,
 * e a permissão é por seção). Quem precisa do time tem o Painel da equipe.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = useConsulta<PainelContabilColaborador>(
    "painel-contabil",
    "/api/contabil/painel"
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
        titulo="O Que Você Rodou"
        periodo={data?.periodo}
        atividade={data?.atividade}
        carregando={carregando}
        onTentar={tentar}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        {/* Feed só dos meus eventos: sem autor, a coluna repetiria o mesmo nome. */}
        <FeedAtividade
          className="xl:col-span-2"
          titulo="Sua Atividade Recente"
          eventos={data?.recentes}
          carregando={carregando}
          vazio={{
            titulo: "Você ainda não rodou nada por aqui",
            descricao: "Conciliações, laudos, implantações e triagens que você fizer aparecem nesta lista.",
          }}
          onTentar={tentar}
        />
        <ComposicaoMes atividade={data?.atividade} carregando={carregando} />
      </div>

      <FaixaBase base={data?.base} carregando={carregando} onTentar={tentar} />
    </>
  );
}
