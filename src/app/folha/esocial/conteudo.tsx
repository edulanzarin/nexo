"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { LegendaEsocial, TabelaEventosEsocial } from "@/componentes/produto/folha/esocial-eventos";
import { ListaPendenciasEsocial, ROTULO_ESOCIAL } from "@/componentes/produto/folha/esocial-pendencias";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { dataBR, num, pct } from "@/lib/format";
import type { ConformidadeEsocialResp, PendenciaEsocial } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

const razao = (parte: number, base: number) => (base > 0 ? (parte / base) * 100 : null);

const cortePendencias = (id: string, rotulo: string, nome: string, fato: string, itens: PendenciaEsocial[]): CorteExportar => ({
  id,
  rotulo,
  nome,
  montar: () => ({
    cabecalhos: ["Contrato", "Funcionário", fato, "Situação"],
    linhas: itens.map((p) => [p.contrato, p.funcionario, dataBR(p.data), ROTULO_ESOCIAL[p.situacao]]),
  }),
});

/**
 * eSocial: o que a empresa transmitiu no período e o resultado de cada evento,
 * mais as duas pendências obrigatórias que o DP caça (admitido sem S-2200
 * aceito, desligado sem S-2299 aceito). Sem pendência nenhuma, a tela diz que
 * está em dia antes de mostrar o panorama.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const res = useConsulta<ConformidadeEsocialResp>("folha-esocial", qs ? `/api/folha/esocial?${qs}` : null);
  const d = res.data;
  const r = d?.resumo;

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const sufixo = `${d.empresa.codigo}-${d.periodo.inicio}_${d.periodo.fim}`;
    return [
      cortePendencias("admissoes", "Admissões sem S-2200 aceito", `esocial-admissoes-${sufixo}`, "Admissão", d.admissoesPendentes),
      cortePendencias(
        "desligamentos",
        "Desligamentos sem S-2299 aceito",
        `esocial-desligamentos-${sufixo}`,
        "Desligamento",
        d.rescisoesPendentes
      ),
      {
        id: "eventos",
        rotulo: "Eventos por tipo",
        nome: `esocial-eventos-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Evento", "Descrição", "Aceitos", "Pendentes", "Rejeitados", "Total"],
          linhas: d.eventos.map((e) => [e.evento, e.descricao, e.aceitos, e.pendentes, e.rejeitados, e.total]),
        }),
      },
    ];
  }, [d]);

  const acoes = (
    <AcoesPagina>
      <MenuExportar modulo="folha" cortes={cortes} desabilitado={!d} />
    </AcoesPagina>
  );

  if (res.isError)
    return (
      <>
        {acoes}
        <PainelErro
          titulo="Não deu para conferir o eSocial"
          mensagem={(res.error as Error).message}
          onTentar={() => res.refetch()}
        />
      </>
    );

  if (d && r && r.total === 0 && !d.admissoesPendentes.length && !d.rescisoesPendentes.length)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="escudo"
            titulo="Nenhum evento do eSocial no período"
            descricao="Amplie o período ou escolha outra empresa no topo."
          />
        </div>
      </>
    );

  const emDia =
    d != null && r != null && r.pendentes === 0 && r.rejeitados === 0 && !d.admissoesPendentes.length && !d.rescisoesPendentes.length;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Eventos no período"
          icone="enviar"
          carregando={!r}
          valor={num(r?.total ?? 0)}
          detalhe="Transmitidos ao eSocial"
        />
        <Indicador
          rotulo="Aceitos"
          icone="ok"
          carregando={!r}
          valor={num(r?.aceitos ?? 0)}
          detalhe={r ? `${pct(razao(r.aceitos, r.total))} com recibo do governo` : ""}
        />
        <Indicador
          rotulo="Pendentes"
          icone="relogio"
          carregando={!r}
          valor={num(r?.pendentes ?? 0)}
          detalhe="Enviados, ainda sem recibo"
          tom={r && r.pendentes > 0 ? "atencao" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Rejeitados"
          icone="erro"
          carregando={!r}
          valor={num(r?.rejeitados ?? 0)}
          detalhe="Recusados na transmissão"
          tom={r && r.rejeitados > 0 ? "perigo" : "neutro"}
          valorNoTom
        />
      </FaixaIndicadores>

      {!d ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {["Admissões sem eSocial", "Rescisões sem eSocial"].map((t) => (
            <Painel key={t} titulo={t} corpo="p-0">
              <EsqueletoTabela linhas={4} colunas={3} />
            </Painel>
          ))}
        </div>
      ) : emDia ? (
        <div className="nx-vidro rounded-painel">
          <Vazio
            compacto
            icone="escudo"
            titulo="eSocial em dia"
            descricao="Admissões e desligamentos do período com o evento aceito, e nenhuma transmissão pendente ou rejeitada."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListaPendenciasEsocial
            titulo="Admissões sem eSocial"
            descricao="Admitidos no período sem S-2200 aceito"
            icone="contrato"
            rotuloData="Admissão"
            itens={d.admissoesPendentes}
            vazio="Todas as admissões com S-2200 aceito"
          />
          <ListaPendenciasEsocial
            titulo="Rescisões sem eSocial"
            descricao="Desligados no período sem S-2299 aceito"
            icone="recibo"
            rotuloData="Desligamento"
            itens={d.rescisoesPendentes}
            vazio="Todos os desligamentos com S-2299 aceito"
          />
        </div>
      )}

      <Nota>
        Os eventos contam pela data da transmissão; as pendências, pela data da admissão ou do desligamento.
      </Nota>

      <Painel
        titulo="Eventos por Tipo"
        descricao="Volume transmitido no período e o resultado de cada tipo"
        acoes={<LegendaEsocial />}
        corpo="p-0"
      >
        {!d ? <EsqueletoTabela colunas={6} /> : <TabelaEventosEsocial eventos={d.eventos} />}
      </Painel>
    </>
  );
}
