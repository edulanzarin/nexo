"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { BlocoIndisponivelDp, ListaUrgencias, TituloBlocoDp } from "@/componentes/produto/folha/pendencias-dp";
import { AtividadeRecenteTi, InventarioPorTipo, itemPendenciaTi } from "@/componentes/produto/ti/painel-ti";
import { usePainelTi } from "@/hooks/use-ti";
import { dataBR, num } from "@/lib/format";
import { DIAS_LICENCA } from "@/lib/ti-acessos-tipos";
import { DIAS_GARANTIA, DIAS_MANUTENCAO_LONGA } from "@/lib/ti-painel-tipos";

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/**
 * A home da TI: o que cobra ação agora e o que aconteceu por último. No
 * inventário, o equipamento com quem saiu, a manutenção parada e a garantia
 * vencendo; no cofre, a senha que ninguém troca há um ano, a licença vencendo e
 * quantas vezes alguém abriu senha na semana. Cada número leva à tela que
 * resolve, e cada pendência abre a ficha do item.
 *
 * Cada lado só aparece para quem tem a seção dele: o servidor nem manda o
 * outro.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = usePainelTi();
  const tentar = () => refetch();

  if (error && !data)
    return <PainelErro titulo="Não deu para carregar o painel" mensagem={(error as Error).message} onTentar={tentar} />;

  const carregando = isLoading || !data;
  const pode = data?.permitido;
  const e = data?.equipamentos;
  const a = data?.acessos;

  if (pode && !pode.equipamentos && !pode.acessos)
    return (
      <Vazio
        icone="painel"
        titulo="Nada para mostrar aqui"
        descricao="O Painel resume os Equipamentos e os Acessos, e seu cargo não tem nenhuma das duas seções. Quem concede é o administrador, em Cargos."
      />
    );

  const verEquipamentos = !pode || pode.equipamentos;
  const verAcessos = !pode || pode.acessos;

  return (
    <>
      <AcoesPagina>
        <Botao variante="fantasma" icone="atualizar" carregando={isFetching && !isLoading} onClick={tentar}>
          Atualizar
        </Botao>
      </AcoesPagina>

      {a && !a.chave && (
        <Nota tom="perigo" icone="cadeado">
          O servidor está sem a chave do cofre (TI_COFRE_CHAVE no .env): nenhuma senha pode ser guardada nem aberta.
        </Nota>
      )}
      {a && a.outraChave > 0 && (
        <Nota tom="atencao" icone="alerta">
          {plural(a.outraChave, "acesso tem senha guardada", "acessos têm senha guardada")} com outra chave do cofre, que não
          abre com a de agora.
        </Nota>
      )}

      {verEquipamentos && (
        <section className="flex flex-col gap-2">
          <TituloBlocoDp titulo="Equipamentos" apoio={data ? `Situação em ${dataBR(data.hoje)}` : undefined} />
          {data && !e ? (
            <BlocoIndisponivelDp titulo="Equipamentos indisponíveis" onTentar={tentar} />
          ) : (
            <FaixaIndicadores colunas={4}>
              <Indicador
                rotulo="Em uso"
                icone="usuario"
                carregando={carregando}
                href="/ti/equipamentos"
                valor={e ? num(e.uso) : "—"}
                detalhe={
                  e
                    ? e.pessoas
                      ? `com ${plural(e.pessoas, "pessoa", "pessoas")} · ${num(e.estoque)} no estoque`
                      : `${num(e.estoque)} no estoque`
                    : undefined
                }
              />
              <Indicador
                rotulo="A recolher"
                icone="alerta"
                carregando={carregando}
                href="/ti/equipamentos"
                valor={e ? (e.aRecolher == null ? "—" : num(e.aRecolher)) : "—"}
                detalhe={e?.aRecolher == null ? "Diretório indisponível agora" : "com quem saiu ou foi encerrado"}
                tom={e?.aRecolher ? "atencao" : e?.aRecolher === 0 ? "ok" : "neutro"}
                valorNoTom={!!e?.aRecolher}
              />
              <Indicador
                rotulo="Em manutenção"
                icone="manutencao"
                carregando={carregando}
                href="/ti/equipamentos"
                valor={e ? num(e.manutencao) : "—"}
                detalhe={
                  e
                    ? e.manutencaoLonga
                      ? `${num(e.manutencaoLonga)} há mais de ${DIAS_MANUTENCAO_LONGA} dias`
                      : e.manutencao
                        ? `nenhum há mais de ${DIAS_MANUTENCAO_LONGA} dias`
                        : "nada parado"
                    : undefined
                }
                tom={e?.manutencaoLonga ? "atencao" : "neutro"}
              />
              <Indicador
                rotulo="Garantia vencendo"
                icone="escudo"
                carregando={carregando}
                href="/ti/equipamentos"
                valor={e ? num(e.garantiasVencendo) : "—"}
                detalhe={`nos próximos ${DIAS_GARANTIA} dias`}
                tom={e?.garantiasVencendo ? "atencao" : "neutro"}
              />
            </FaixaIndicadores>
          )}
        </section>
      )}

      {verAcessos && (
        <section className="flex flex-col gap-2">
          <TituloBlocoDp titulo="Acessos" apoio={a ? plural(a.total, "acesso no cofre", "acessos no cofre") : undefined} />
          {data && !a ? (
            <BlocoIndisponivelDp titulo="Acessos indisponíveis" onTentar={tentar} />
          ) : (
            <FaixaIndicadores colunas={4}>
              <Indicador
                rotulo="Senha antiga"
                icone="relogio"
                carregando={carregando}
                href="/ti/acessos"
                valor={a ? num(a.senhasAntigas) : "—"}
                detalhe="sem troca há mais de um ano"
                tom={a ? (a.senhasAntigas ? "atencao" : "ok") : "neutro"}
              />
              <Indicador
                rotulo="Licença vencendo"
                icone="licenca"
                carregando={carregando}
                href="/ti/acessos"
                valor={a ? num(a.licencasVencendo) : "—"}
                detalhe={`vencidas ou em ${DIAS_LICENCA} dias`}
                tom={a?.licencasVencendo ? "atencao" : "neutro"}
                valorNoTom={!!a?.licencasVencendo}
              />
              <Indicador
                rotulo="Senhas abertas"
                icone="ver"
                carregando={carregando}
                href="/ti/acessos/registro"
                valor={a ? num(a.vistas7) : "—"}
                detalhe="vistas ou copiadas em 7 dias"
              />
              <Indicador
                rotulo="Senhas trocadas"
                icone="chave"
                carregando={carregando}
                href="/ti/acessos/registro"
                valor={a ? num(a.trocas30) : "—"}
                detalhe="nos últimos 30 dias"
              />
            </FaixaIndicadores>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ListaUrgencias
          titulo="Pendências"
          descricao="O que pede ação, do que pesa mais para o que pode esperar"
          itens={data ? data.pendencias.slice(0, 30).map(itemPendenciaTi) : undefined}
          carregando={carregando}
          vazio="Nada pendente na TI"
          onTentar={tentar}
        />

        <div className="flex flex-col gap-4">
          {verEquipamentos && (
            <Painel
              corpo="p-0"
              titulo="Inventário por Tipo"
              descricao="O que está em uso, no estoque e na manutenção"
              acoes={
                <BotaoLink variante="fantasma" href="/ti/equipamentos" iconeFim="seta-direita">
                  Inventário
                </BotaoLink>
              }
            >
              <InventarioPorTipo porTipo={e?.porTipo} carregando={carregando} />
            </Painel>
          )}
          <Painel corpo="p-0" titulo="Atividade Recente" descricao="Movimentações e o cofre, da mais recente para trás">
            <AtividadeRecenteTi itens={data?.atividade} carregando={carregando} />
          </Painel>
        </div>
      </div>
    </>
  );
}
