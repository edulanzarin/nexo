"use client";

import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { PainelErro } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador, type Tom } from "@/componentes/primitivos/indicador";
import { ListaUrgencias, TituloBlocoDp, type ItemUrgencia } from "@/componentes/produto/folha/pendencias-dp";
import { TextoPrazo } from "@/componentes/produto/folha/prazo-dp";
import { useConsulta } from "@/hooks/use-consulta";
import { dataBR, num } from "@/lib/format";
import type { PainelRh } from "@/lib/painel-rh-tipos";
import { rotuloMarco } from "@/lib/rh-experiencia";

/** Uma semana para o vencimento já pede atenção na lista de urgentes. */
const DIAS_ATENCAO = 7;

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** O pior caso manda no tom: atrasado é perigo, pendente é atenção, nada é bom. */
function tomPendencia(pior: number, alguma: number): Tom {
  return pior > 0 ? "perigo" : alguma > 0 ? "atencao" : "ok";
}

/**
 * A home do RH: o que cobra ação agora (experiências a decidir, denúncias
 * abertas, avaliações em andamento), as experiências mais perto do prazo e o
 * que o RH fez no mês. Cada número leva à tela que resolve.
 *
 * Os blocos chegam separados do servidor: a experiência lê o Questor, o resto
 * lê o banco do app, e o que falhou vira buraco só no pedaço dele.
 */
export default function Conteudo() {
  const { data, error, isLoading, isFetching, refetch } = useConsulta<PainelRh>("rh-painel", "/api/rh/painel");
  const tentar = () => refetch();

  if (error && !data)
    return <PainelErro titulo="Não deu para carregar o painel" mensagem={(error as Error).message} onTentar={tentar} />;

  const carregando = isLoading || !data;
  const e = data?.experiencias;
  const p = data?.pendencias;
  const pan = data?.panorama;
  const hoje = data?.periodo.fim;

  const urgentes: ItemUrgencia[] | null | undefined = data
    ? (e?.urgentes.map((i) => ({
        chave: `${i.codigoempresa}:${i.contrato}:${i.marco}`,
        href: "/rh/experiencia",
        titulo: i.nome,
        apoio: [i.setor ?? "Sem setor", rotuloMarco(i.marco), `vence ${dataBR(i.vencimento)}`, i.gestores === 0 && "sem gestor"]
          .filter(Boolean)
          .join(" · "),
        direita: <TextoPrazo dias={i.diasParaVencer} atencao={i.diasParaVencer <= DIAS_ATENCAO} />,
      })) ?? null)
    : undefined;

  const indisponivel = "Indisponível agora";

  return (
    <>
      <AcoesPagina>
        <Botao variante="fantasma" icone="atualizar" carregando={isFetching && !isLoading} onClick={tentar}>
          Atualizar
        </Botao>
      </AcoesPagina>

      <section className="flex flex-col gap-2">
        <TituloBlocoDp titulo="Pendências do RH" apoio={hoje ? `Situação em ${dataBR(hoje)}` : undefined} />
        <FaixaIndicadores colunas={3}>
          <Indicador
            rotulo="Experiências a decidir"
            icone="calendario"
            carregando={carregando}
            href={e ? "/rh/experiencia" : undefined}
            valor={e ? num(e.aDecidir) : "—"}
            detalhe={
              e
                ? e.semGestor > 0
                  ? `${num(e.atrasadas)} em atraso · ${num(e.semGestor)} sem gestor`
                  : `${num(e.atrasadas)} em atraso · marcos de 45 e 90 dias`
                : indisponivel
            }
            tom={e ? tomPendencia(e.atrasadas, e.aDecidir) : "neutro"}
            valorNoTom={e != null && e.atrasadas > 0}
          />
          <Indicador
            rotulo="Denúncias abertas"
            icone="escudo"
            carregando={carregando}
            href={p ? "/rh/denuncias" : undefined}
            valor={p ? num(p.denunciasAbertas) : "—"}
            detalhe={
              p
                ? p.denunciasRecebidas > 0
                  ? plural(p.denunciasRecebidas, "ainda não aberta", "ainda não abertas")
                  : p.denunciasAbertas > 0
                    ? "Todas já em análise"
                    : "Nenhuma na fila"
                : indisponivel
            }
            tom={p ? tomPendencia(p.denunciasRecebidas, p.denunciasAbertas) : "neutro"}
            valorNoTom={p != null && p.denunciasRecebidas > 0}
          />
          <Indicador
            rotulo="Respostas nas avaliações abertas"
            icone="coracao"
            carregando={carregando}
            href={p ? "/rh/clima" : undefined}
            valor={p ? num(p.climaRespostasAbertas) : "—"}
            detalhe={
              p
                ? p.climaRodadasAbertas > 0
                  ? plural(p.climaRodadasAbertas, "rodada aberta", "rodadas abertas")
                  : "Nenhuma avaliação aberta"
                : indisponivel
            }
          />
        </FaixaIndicadores>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <ListaUrgencias
          titulo="Experiências mais Urgentes"
          descricao="Marcos sem resposta, do mais atrasado ao mais folgado"
          acoes={
            <BotaoLink variante="fantasma" href="/rh/experiencia" iconeFim="seta-direita">
              Ver todas
            </BotaoLink>
          }
          itens={urgentes}
          carregando={carregando}
          vazio="Nenhuma experiência a decidir"
          onTentar={tentar}
        />

        <section className="flex flex-col gap-2">
          <TituloBlocoDp
            titulo="No Mês"
            apoio={data ? `${dataBR(data.periodo.inicio)} a ${dataBR(data.periodo.fim)}` : undefined}
          />
          <FaixaIndicadores colunas={2}>
            <Indicador
              rotulo="Experiências respondidas"
              icone="ok"
              carregando={carregando}
              valor={pan ? num(pan.experienciasRespondidas) : "—"}
              detalhe={pan ? "Avaliações dos gestores" : indisponivel}
            />
            <Indicador
              rotulo="Denúncias recebidas"
              icone="escudo"
              carregando={carregando}
              valor={pan ? num(pan.denunciasRecebidasMes) : "—"}
              detalhe={pan ? "Relatos novos no canal" : indisponivel}
            />
            <Indicador
              rotulo="Formulários enviados"
              icone="enviar"
              carregando={carregando}
              valor={pan ? num(pan.campanhasEnviadas) : "—"}
              detalhe={pan ? "Envios e rodadas de desempenho" : indisponivel}
            />
            <Indicador
              rotulo="Respostas de avaliação"
              icone="coracao"
              carregando={carregando}
              valor={pan ? num(pan.respostasClima) : "—"}
              detalhe={pan ? "Participações no mês" : indisponivel}
            />
          </FaixaIndicadores>
        </section>
      </div>
    </>
  );
}
