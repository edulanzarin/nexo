"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";
import { decimalBR } from "@/lib/csv";
import { brl, dataBR, num, pct } from "@/lib/format";
import type { AuditoriaResp, GrupoAchado } from "@/lib/types";
import { CHECAGENS, ORDEM_CHECAGENS, ORIGEM } from "./checagens";
import { ModalAchado } from "./modal-achado";

const SEVERIDADE = {
  alta: { rotulo: "Alta", tom: "perigo" },
  media: { rotulo: "Média", tom: "atencao" },
} as const;

const COLUNAS: Coluna<GrupoAchado>[] = [
  {
    id: "checagem",
    cabecalho: "Checagem",
    ordenar: (g) => CHECAGENS[g.tipo]?.rotulo ?? g.titulo,
    celula: (g) => (
      <span className="flex min-w-0 items-center gap-2">
        <Icone nome={CHECAGENS[g.tipo]?.icone ?? "alerta"} tamanho={15} className="text-apagado" />
        <span className="truncate font-[560] text-tinta">{CHECAGENS[g.tipo]?.rotulo ?? g.titulo}</span>
      </span>
    ),
  },
  {
    id: "severidade",
    cabecalho: "Severidade",
    largura: "112px",
    ordenar: (g) => (g.severidade === "alta" ? 0 : 1),
    celula: (g) => <Selo tom={SEVERIDADE[g.severidade].tom}>{SEVERIDADE[g.severidade].rotulo}</Selo>,
  },
  {
    id: "criterio",
    cabecalho: "Critério",
    secundaria: true,
    celula: (g) => (
      <span className="block truncate text-apagado" title={CHECAGENS[g.tipo]?.criterio ?? g.criterio}>
        {CHECAGENS[g.tipo]?.criterio ?? g.criterio}
      </span>
    ),
  },
  {
    id: "contagem",
    cabecalho: "Lançamentos",
    alinhar: "dir",
    largura: "124px",
    ordenar: (g) => g.contagem,
    classe: "text-tinta",
    celula: (g) => num(g.contagem),
  },
  {
    id: "valor",
    cabecalho: "Valor",
    alinhar: "dir",
    largura: "150px",
    ordenar: (g) => g.valor,
    classe: "font-[600] text-tinta",
    celula: (g) => brl(g.valor),
  },
];

export default function Conteudo() {
  const { qs } = useExecucao();
  const { data, isLoading, isError, error, refetch } = useConsulta<AuditoriaResp>(
    "auditoria",
    qs ? `/api/contabil/auditoria?${qs}` : null
  );
  const [aberto, setAberto] = useState<GrupoAchado | null>(null);

  const resumo = useMemo(() => {
    if (!data) return null;
    const acesos = new Set(data.grupos.map((g) => g.tipo));
    return {
      passaram: ORDEM_CHECAGENS.filter((t) => !acesos.has(t)),
      valor: data.grupos.reduce((s, g) => s + g.valor, 0),
      temAlta: data.grupos.some((g) => g.severidade === "alta"),
    };
  }, [data]);

  if (isError) {
    return <PainelErro titulo="Não deu para rodar a auditoria" mensagem={(error as Error).message} onTentar={() => refetch()} />;
  }

  const p = new URLSearchParams(qs ?? "");
  const sufixo = `${p.get("empresas") ?? "empresa"}-${p.get("inicio") ?? ""}-a-${p.get("fim") ?? ""}`;
  const cortes: CorteExportar[] = data
    ? [
        {
          id: "resumo",
          rotulo: "Resumo por checagem",
          nome: `auditoria-resumo-${sufixo}`,
          montar: () => ({
            cabecalhos: ["Checagem", "Severidade", "Lançamentos", "Valor", "Critério"],
            linhas: ORDEM_CHECAGENS.map((t) => {
              const g = data.grupos.find((x) => x.tipo === t);
              const c = CHECAGENS[t];
              return [c.rotulo, SEVERIDADE[c.severidade].rotulo, g?.contagem ?? 0, decimalBR(g?.valor ?? 0), c.criterio];
            }),
          }),
        },
        {
          id: "lancamentos",
          rotulo: "Lançamentos sinalizados",
          nome: `auditoria-lancamentos-${sufixo}`,
          montar: () => ({
            cabecalhos: [
              "Checagem",
              "Data",
              "Conta débito",
              "Descrição débito",
              "Conta crédito",
              "Descrição crédito",
              "Valor",
              "Achado",
              "Origem",
              "Usuário",
              "Histórico",
              "Lançado em",
              "Chave",
            ],
            linhas: data.grupos.flatMap((g) =>
              g.amostra.map((l) => [
                CHECAGENS[g.tipo]?.rotulo ?? g.titulo,
                dataBR(l.data),
                l.contaDeb,
                l.descrDeb,
                l.contaCred,
                l.descrCred,
                decimalBR(l.valor),
                l.detalhe ?? "",
                ORIGEM[l.origem] ?? l.origem,
                l.usuario,
                l.historico,
                l.lancadoEm,
                l.chave,
              ])
            ),
          }),
        },
      ]
    : [];

  return (
    <>
      <AcoesPagina>
        <MenuExportar modulo="contabil" cortes={cortes} desabilitado={!data} />
      </AcoesPagina>

      {isLoading || !data || !resumo ? (
        <FaixaIndicadores>
          {["Lançamentos no período", "Achados", "Checagens acesas", "Valor sinalizado"].map((r) => (
            <Indicador key={r} rotulo={r} valor="" detalhe="" carregando />
          ))}
        </FaixaIndicadores>
      ) : (
        <FaixaIndicadores>
          <Indicador
            rotulo="Lançamentos no período"
            icone="planilha"
            valor={num(data.totalLancamentos)}
            detalhe="normais, olhados um a um"
          />
          <Indicador
            rotulo="Achados"
            icone="lupa"
            valor={num(data.resumo.totalAchados)}
            detalhe={
              data.totalLancamentos > 0
                ? `${pct((data.resumo.totalAchados / data.totalLancamentos) * 100)} dos lançamentos`
                : "nenhum lançamento varrido"
            }
            tom={data.resumo.totalAchados ? (resumo.temAlta ? "perigo" : "atencao") : "ok"}
            valorNoTom={data.resumo.totalAchados > 0}
          />
          <Indicador
            rotulo="Checagens acesas"
            icone="fila"
            valor={`${num(data.resumo.tiposComAchado)} de ${num(ORDEM_CHECAGENS.length)}`}
            detalhe={resumo.passaram.length ? `${num(resumo.passaram.length)} passaram limpas` : "todas acenderam"}
          />
          <Indicador
            rotulo="Valor sinalizado"
            icone="moedas"
            valor={brl(resumo.valor)}
            detalhe={
              data.grupos.some((g) => g.tipo === "duplicado")
                ? "na partida repetida, só o excedente"
                : "soma dos lançamentos com achado"
            }
          />
        </FaixaIndicadores>
      )}

      <Painel
        corpo="p-0"
        titulo="Achados por checagem"
        descricao="Clique numa checagem para ver os lançamentos, maior valor primeiro"
        rodape={
          resumo && data && data.grupos.length > 0 && resumo.passaram.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-pequeno text-apagado">Passaram limpas</span>
              {resumo.passaram.map((t) => (
                <Selo key={t} tom="ok" icone="certo">
                  {CHECAGENS[t].rotulo}
                </Selo>
              ))}
            </div>
          ) : undefined
        }
      >
        {isLoading || !data ? (
          <EsqueletoTabela linhas={6} colunas={5} />
        ) : (
          <TabelaDados
            rotulo="Achados por checagem"
            colunas={COLUNAS}
            linhas={data.grupos}
            chave={(g) => g.tipo}
            onLinha={setAberto}
            selecionada={(g) => aberto?.tipo === g.tipo}
            vazio={
              data.totalLancamentos === 0 ? (
                <Vazio
                  icone="lupa"
                  titulo="Nenhum lançamento no período"
                  descricao="A auditoria olha os lançamentos normais nas datas do topo. Troque o período para varrer outro recorte."
                />
              ) : (
                <Vazio
                  icone="escudo"
                  titulo="Nenhuma anomalia"
                  descricao={`Os ${num(data.totalLancamentos)} lançamentos do período passaram nas seis checagens.`}
                />
              )
            }
          />
        )}
      </Painel>

      {aberto && <ModalAchado key={aberto.tipo} grupo={aberto} onFechar={() => setAberto(null)} />}
    </>
  );
}
