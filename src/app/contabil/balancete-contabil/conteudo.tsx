"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Dica } from "@/componentes/primitivos/dica";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Ponto } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  alternarRecolhida,
  buscarNoPlano,
  CelulaConta,
  recortarArvore,
  SeletorNivel,
  ValorConta,
} from "@/componentes/produto/contabil/balancete/arvore-contas";
import { CabecalhoPapel } from "@/componentes/produto/contabil/balancete/cabecalho-papel";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { nomeMes } from "@/lib/contexto";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataHoraBR, num } from "@/lib/format";
import type { BalanceteContabilLinha, BalanceteContabilResp } from "@/lib/types";
import { fraseAtipica, ModalAtipicas, ModalConta } from "./modais";

const CABECALHOS_CSV = [
  "Classificação",
  "Código",
  "Descrição",
  "Nível",
  "Tipo",
  "Natureza",
  "Saldo anterior",
  "D/C anterior",
  "Débito",
  "Crédito",
  "Saldo atual",
  "D/C atual",
];

/** Saldo em magnitude e a letra ao lado, como o Questor exporta. */
function linhaCsv(l: BalanceteContabilLinha) {
  return [
    l.classif,
    l.conta,
    l.descricao,
    l.nivel,
    l.sintetica ? "Sintética" : "Analítica",
    l.natureza === "D" ? "Devedora" : "Credora",
    decimalBR(Math.abs(l.saldoAnterior)),
    l.saldoAnterior >= 0 ? "D" : "C",
    decimalBR(l.debito),
    decimalBR(l.credito),
    decimalBR(Math.abs(l.saldoAtual)),
    l.saldoAtual >= 0 ? "D" : "C",
  ];
}

/** "agosto de 2026" ou "junho de 2026 a agosto de 2026". */
function rotuloMeses(meses: string[]): string {
  if (!meses.length) return "";
  const ini = nomeMes(meses[0], true);
  return meses.length === 1 ? ini : `${ini} a ${nomeMes(meses[meses.length - 1], true)}`;
}

export default function Conteudo() {
  const { qs } = useExecucao();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useConsulta<BalanceteContabilResp>(
    "balancete-contabil",
    qs ? `/api/contabil/balancete-contabil?${qs}` : null
  );

  const [nivel, setNivel] = useEstadoTela("nivel", 3);
  const [recolhidas, setRecolhidas] = useEstadoTela<string[]>("recolhidas", []);
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [conta, setConta] = useState<BalanceteContabilLinha | null>(null);
  const [verAtipicas, setVerAtipicas] = useState(false);

  const nivelMax = data?.nivelMax ?? 5;
  const corte = Math.min(nivel, nivelMax);
  const recolhidasSet = useMemo(() => new Set(recolhidas), [recolhidas]);
  const buscando = busca.trim() !== "";
  const atipicas = useMemo(() => new Set((data?.atipicas ?? []).map((a) => a.conta)), [data]);
  const analiticas = useMemo(() => (data?.linhas ?? []).filter((l) => !l.sintetica).length, [data]);

  const linhas = useMemo(() => {
    const todas = data?.linhas ?? [];
    return buscando ? buscarNoPlano(todas, busca) : recortarArvore(todas, corte, recolhidasSet);
  }, [data, buscando, busca, corte, recolhidasSet]);

  const colunas: Coluna<BalanceteContabilLinha>[] = [
    {
      id: "conta",
      cabecalho: "Conta",
      celula: (l) => (
        <CelulaConta
          linha={l}
          recuar={!buscando}
          aberta={!recolhidasSet.has(l.classif)}
          onAlternar={
            !buscando && l.sintetica && l.nivel < corte
              ? () => setRecolhidas((lista) => alternarRecolhida(lista, l.classif))
              : undefined
          }
        />
      ),
      rodape: <span className="text-pequeno">Total das analíticas</span>,
    },
    {
      id: "anterior",
      cabecalho: "Saldo anterior",
      alinhar: "dir",
      largura: "158px",
      celula: (l) => <ValorConta valor={l.saldoAnterior} natureza forte={l.sintetica} />,
    },
    {
      id: "debito",
      cabecalho: "Débito",
      alinhar: "dir",
      largura: "146px",
      celula: (l) => <ValorConta valor={l.debito} forte={l.sintetica} />,
      rodape: data ? brl(data.totais.debito) : undefined,
    },
    {
      id: "credito",
      cabecalho: "Crédito",
      alinhar: "dir",
      largura: "146px",
      celula: (l) => <ValorConta valor={l.credito} forte={l.sintetica} />,
      rodape: data ? brl(data.totais.credito) : undefined,
    },
    {
      id: "atual",
      cabecalho: "Saldo atual",
      alinhar: "dir",
      largura: "172px",
      celula: (l) => (
        <span className="inline-flex items-center gap-1.5">
          {atipicas.has(l.conta) && (
            <Dica texto={fraseAtipica(l.natureza)}>
              <Ponto tom="atencao" />
            </Dica>
          )}
          <ValorConta valor={l.saldoAtual} natureza forte={l.sintetica} />
        </span>
      ),
    },
  ];

  if (isError) {
    return (
      <PainelErro titulo="Não deu para montar o balancete" mensagem={(error as Error).message} onTentar={() => refetch()} />
    );
  }

  const empresa = data ? String(data.empresa.codigo) : (new URLSearchParams(qs ?? "").get("empresas") ?? "empresa");
  const sufixo = data ? `${empresa}-${data.periodo.inicio.slice(0, 7)}-a-${data.periodo.fim.slice(0, 7)}` : empresa;
  const t = data?.totais;
  const difMov = t ? t.debito - t.credito : 0;
  const difSaldo = t ? t.saldoAtualDevedor - t.saldoAtualCredor : 0;

  return (
    <>
      <AcoesPagina>
        {/* O botão não vai para o papel; `contents` não mexe na fila da tela. */}
        <span className="nx-sem-papel contents">
          <MenuExportar
            modulo="contabil"
            desabilitado={!data}
            imprimir="balancete contábil"
            cortes={
              data
                ? [
                    {
                      id: "todas",
                      rotulo: "Todas as contas",
                      nome: `balancete-contabil-${sufixo}`,
                      montar: () => ({ cabecalhos: CABECALHOS_CSV, linhas: data.linhas.map(linhaCsv) }),
                    },
                    {
                      id: "visiveis",
                      rotulo: "Contas na tela",
                      nome: `balancete-contabil-recorte-${sufixo}`,
                      montar: () => ({ cabecalhos: CABECALHOS_CSV, linhas: linhas.map(linhaCsv) }),
                    },
                    ...(data.atipicas.length
                      ? [
                          {
                            id: "atipicas",
                            rotulo: "Contas com Sinal Atípico",
                            nome: `balancete-contabil-sinal-atipico-${sufixo}`,
                            montar: () => ({
                              cabecalhos: ["Classificação", "Código", "Descrição", "Natureza", "Saldo atual", "D/C"],
                              linhas: data.atipicas.map((a) => [
                                a.classif,
                                a.conta,
                                a.descricao,
                                a.natureza === "D" ? "Devedora" : "Credora",
                                decimalBR(Math.abs(a.saldoFinal)),
                                a.saldoFinal >= 0 ? "D" : "C",
                              ]),
                            }),
                          },
                        ]
                      : []),
                  ]
                : []
            }
          />
        </span>
      </AcoesPagina>

      {data && (
        <CabecalhoPapel
          titulo="Balancete de Verificação"
          empresa={data.empresa}
          itens={[
            { rotulo: "Período", valor: rotuloMeses(data.periodo.meses) },
            { rotulo: "Filiais", valor: "Todas, consolidado" },
            { rotulo: "Recorte", valor: buscando ? `Contas com "${busca.trim()}"` : `Até o nível ${corte}` },
            { rotulo: "Dados de", valor: dataHoraBR(new Date(dataUpdatedAt).toISOString()) },
          ]}
        />
      )}

      {isLoading || !data || !t ? (
        <FaixaIndicadores>
          {["Fechamento", "Débito do período", "Crédito do período", "Saldo devedor", "Saldo credor", "Sinal atípico"].map((r) => (
            <Indicador key={r} rotulo={r} valor="" detalhe="" carregando />
          ))}
        </FaixaIndicadores>
      ) : (
        <FaixaIndicadores>
          <Indicador
            rotulo="Fechamento"
            valor={t.fecha ? "Fecha" : "Não fecha"}
            detalhe={
              t.fecha
                ? "saldo devedor igual ao credor"
                : Math.abs(difMov) > 1
                  ? `débito e crédito diferem em ${brl(Math.abs(difMov))}`
                  : `saldos diferem em ${brl(Math.abs(difSaldo))}`
            }
            tom={t.fecha ? "ok" : "perigo"}
            valorNoTom={!t.fecha}
          />
          <Indicador
            rotulo="Débito do período"
            valor={brl(t.debito)}
            detalhe={`${num(analiticas)} contas com saldo ou movimento`}
          />
          <Indicador
            rotulo="Crédito do período"
            valor={brl(t.credito)}
            detalhe={
              Math.abs(difMov) <= 1
                ? "igual ao débito"
                : `${brl(Math.abs(difMov))} ${difMov > 0 ? "abaixo" : "acima"} do débito`
            }
          />
          <Indicador
            rotulo="Saldo devedor"
            valor={brl(t.saldoAtualDevedor)}
            detalhe={`antes do período, ${brlCompact(t.saldoAnteriorDevedor)}`}
          />
          <Indicador
            rotulo="Saldo credor"
            valor={brl(t.saldoAtualCredor)}
            detalhe={`antes do período, ${brlCompact(t.saldoAnteriorCredor)}`}
          />
          <Indicador
            rotulo="Sinal atípico"
            valor={num(data.atipicas.length)}
            detalhe={data.atipicas.length ? "contas com saldo do lado trocado" : "nenhuma conta com saldo trocado"}
            tom={data.atipicas.length ? "atencao" : "neutro"}
            valorNoTom={data.atipicas.length > 0}
            onClick={data.atipicas.length ? () => setVerAtipicas(true) : undefined}
          />
        </FaixaIndicadores>
      )}

      <Painel
        corpo="p-0"
        titulo="Balancete de Verificação"
        descricao={<span className="nx-sem-papel">Clique numa conta para ver o detalhe e, na sintética, a composição</span>}
        acoes={
          <span className="nx-sem-papel flex flex-wrap items-center gap-1.5">
            <Campo
              icone="buscar"
              placeholder="Conta, classificação ou descrição"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-64"
              aria-label="Buscar conta"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <SeletorNivel nivelMax={nivelMax} valor={corte} onMudar={setNivel} />
          </span>
        }
      >
        {isLoading || !data ? (
          <EsqueletoTabela linhas={12} colunas={5} />
        ) : (
          <TabelaDados
            rotulo="Balancete de Verificação"
            colunas={colunas}
            linhas={linhas}
            chave={(l) => `${l.classif}:${l.conta}`}
            onLinha={setConta}
            selecionada={(l) => conta?.conta === l.conta}
            alturaMax="min(72dvh, 46rem)"
            // No papel a tabela sai inteira: o teto de altura cortaria as contas.
            className="print:!max-h-none print:!overflow-visible"
            vazio={
              <Vazio
                compacto
                icone="buscar"
                titulo="Nenhuma conta com esse termo"
                descricao="Busque pela classificação, pelo código ou por outra parte da descrição."
                acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
              />
            }
          />
        )}
      </Painel>

      <ModalConta
        linha={conta}
        linhas={data?.linhas ?? []}
        atipica={conta != null && atipicas.has(conta.conta)}
        onFechar={() => setConta(null)}
        onConta={setConta}
      />
      <ModalAtipicas
        aberto={verAtipicas}
        atipicas={data?.atipicas ?? []}
        onFechar={() => setVerAtipicas(false)}
        onConta={(a) => {
          const l = data?.linhas.find((x) => x.conta === a.conta);
          setVerAtipicas(false);
          if (l) setConta(l);
        }}
      />
    </>
  );
}
