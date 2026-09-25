"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  alternarRecolhida,
  buscarNoPlano,
  CelulaConta,
  recortarArvore,
  SeletorNivel,
} from "@/componentes/produto/contabil/balancete/arvore-contas";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { cn } from "@/lib/cn";
import { decimalBR } from "@/lib/csv";
import { brl, dataBR, num } from "@/lib/format";
import type { BalanceteFiscalResp, BalanceteLinha, BalancetePendente } from "@/lib/types";
import { difLiquida, ModalConta, TOLERANCIA, type AlvoConta, type VistaConta } from "./modal-conta";

/** Acima disso a diferença deixa de ser detalhe e ganha o alerta. */
const DIFERENCA_GRANDE = 100;

/** Valor de coluna que abre os lançamentos que o compõem; zero vira traço. */
function ValorDrill({ valor, forte, onAbrir }: { valor: number; forte?: boolean; onAbrir: () => void }) {
  if (Math.abs(valor) < 0.005) return <span className="text-apagado/60">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className={cn("num rounded-chip hover:text-rota hover:underline", forte ? "font-[600] text-tinta" : "text-tinta-2")}
    >
      {brl(valor)}
    </button>
  );
}

/** A diferença da conta: "bate" quando fecha, senão o valor que abre as notas culpadas. */
function CelulaDiferenca({ linha, onAbrir }: { linha: BalanceteLinha; onAbrir: () => void }) {
  const d = difLiquida(linha);
  if (Math.abs(d) <= TOLERANCIA) return <span className="text-pequeno text-ok">bate</span>;
  const grande = Math.abs(d) > DIFERENCA_GRANDE;
  return (
    <button
      type="button"
      title="Ver as notas por trás desta diferença"
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className={cn(
        "num inline-flex items-center gap-1 rounded-chip hover:underline",
        grande ? "font-[600] text-perigo" : "text-atencao"
      )}
    >
      {grande && <Icone nome="alerta" tamanho={14} />}
      {brl(d)}
    </button>
  );
}

const CABECALHOS_CSV = [
  "Classificação",
  "Código",
  "Descrição",
  "Nível",
  "Tipo",
  "Débito esperado",
  "Crédito esperado",
  "Débito lançado",
  "Crédito lançado",
  "Diferença",
];

function linhaCsv(l: BalanceteLinha) {
  return [
    l.classif,
    l.conta,
    l.descricao,
    l.nivel,
    l.sintetica ? "Sintética" : "Analítica",
    decimalBR(l.fiscalDeb),
    decimalBR(l.fiscalCred),
    decimalBR(l.realDeb),
    decimalBR(l.realCred),
    decimalBR(difLiquida(l)),
  ];
}

export default function Conteudo() {
  const { qs } = useExecucao();
  const { data, isLoading, isError, error, refetch } = useConsulta<BalanceteFiscalResp>(
    "balancete-fiscal",
    qs ? `/api/contabil/balancete-fiscal?${qs}` : null
  );

  const [soDif, setSoDif] = useEstadoTela("so-diferencas", false);
  const [nivel, setNivel] = useEstadoTela("nivel", 3);
  const [recolhidas, setRecolhidas] = useEstadoTela<string[]>("recolhidas", []);
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [alvo, setAlvo] = useState<AlvoConta | null>(null);
  const [verPendentes, setVerPendentes] = useState(false);

  const resumo = useMemo(() => {
    if (!data) return null;
    const analiticas = data.linhas.filter((l) => !l.sintetica);
    // "Só diferenças": as analíticas em que o esperado não bate com o lançado,
    // do maior desvio para o menor. A sintética só soma as filhas: listá-la
    // junto contaria o mesmo desvio duas vezes.
    const comDif = analiticas
      .filter((l) => Math.abs(difLiquida(l)) > TOLERANCIA)
      .sort((a, b) => Math.abs(difLiquida(b)) - Math.abs(difLiquida(a)));
    return {
      analiticas,
      comDif,
      pendentes: data.pendentes.reduce((s, p) => s + p.valor, 0),
      semApuracao: data.semApuracao.reduce((s, a) => s + a.esperado, 0),
    };
  }, [data]);

  const nivelMax = data?.nivelMax ?? 5;
  const corte = Math.min(nivel, nivelMax);
  const recolhidasSet = useMemo(() => new Set(recolhidas), [recolhidas]);
  const buscando = busca.trim() !== "";
  const arvore = !soDif && !buscando;

  const linhas = useMemo(() => {
    if (!data || !resumo) return [];
    const base = soDif ? resumo.comDif : data.linhas;
    if (buscando) return buscarNoPlano(base, busca);
    return soDif ? base : recortarArvore(base, corte, recolhidasSet);
  }, [data, resumo, soDif, buscando, busca, corte, recolhidasSet]);

  // Rodapé: na árvore, o total das analíticas (a sintética repetiria o valor);
  // em "só diferenças", o total das contas listadas.
  const totais = useMemo(() => {
    const base = soDif ? linhas : (resumo?.analiticas ?? []);
    return base.reduce(
      (t, l) => ({
        fd: t.fd + l.fiscalDeb,
        fc: t.fc + l.fiscalCred,
        rd: t.rd + l.realDeb,
        rc: t.rc + l.realCred,
        dif: t.dif + difLiquida(l),
      }),
      { fd: 0, fc: 0, rd: 0, rc: 0, dif: 0 }
    );
  }, [soDif, linhas, resumo]);

  const abrir = (linha: BalanceteLinha, vista: VistaConta, natureza: 1 | -1 = 1) => setAlvo({ linha, vista, natureza });

  const colunas: Coluna<BalanceteLinha>[] = [
    {
      id: "conta",
      cabecalho: "Conta",
      celula: (l) => (
        <CelulaConta
          linha={l}
          recuar={arvore}
          aberta={!recolhidasSet.has(l.classif)}
          onAlternar={
            arvore && l.sintetica && l.nivel < corte
              ? () => setRecolhidas((lista) => alternarRecolhida(lista, l.classif))
              : undefined
          }
        />
      ),
      rodape: <span className="text-pequeno">{soDif ? "Total das diferenças" : "Total das analíticas"}</span>,
    },
    {
      id: "fd",
      cabecalho: "Débito esperado",
      alinhar: "dir",
      largura: "138px",
      ordenar: soDif ? (l) => l.fiscalDeb : undefined,
      celula: (l) => <ValorDrill valor={l.fiscalDeb} forte={l.sintetica} onAbrir={() => abrir(l, "fiscal", 1)} />,
      rodape: brl(totais.fd),
    },
    {
      id: "fc",
      cabecalho: "Crédito esperado",
      alinhar: "dir",
      largura: "138px",
      ordenar: soDif ? (l) => l.fiscalCred : undefined,
      celula: (l) => <ValorDrill valor={l.fiscalCred} forte={l.sintetica} onAbrir={() => abrir(l, "fiscal", -1)} />,
      rodape: brl(totais.fc),
    },
    {
      id: "rd",
      cabecalho: "Débito lançado",
      alinhar: "dir",
      largura: "138px",
      ordenar: soDif ? (l) => l.realDeb : undefined,
      celula: (l) => <ValorDrill valor={l.realDeb} forte={l.sintetica} onAbrir={() => abrir(l, "real", 1)} />,
      rodape: brl(totais.rd),
    },
    {
      id: "rc",
      cabecalho: "Crédito lançado",
      alinhar: "dir",
      largura: "138px",
      ordenar: soDif ? (l) => l.realCred : undefined,
      celula: (l) => <ValorDrill valor={l.realCred} forte={l.sintetica} onAbrir={() => abrir(l, "real", -1)} />,
      rodape: brl(totais.rc),
    },
    {
      id: "dif",
      cabecalho: "Diferença",
      alinhar: "dir",
      largura: "140px",
      ordenar: soDif ? (l) => Math.abs(difLiquida(l)) : undefined,
      celula: (l) => <CelulaDiferenca linha={l} onAbrir={() => abrir(l, "diferenca")} />,
      rodape: brl(totais.dif),
    },
  ];

  const empresa = qs ? new URLSearchParams(qs).get("empresas") : null;
  const p = new URLSearchParams(qs ?? "");
  const sufixo = `${empresa ?? "empresa"}-${p.get("inicio") ?? ""}-a-${p.get("fim") ?? ""}`;
  const cortes: CorteExportar[] =
    data && resumo
      ? [
          {
            id: "balancete",
            rotulo: "Balancete inteiro",
            nome: `balancete-fiscal-${sufixo}`,
            montar: () => ({ cabecalhos: CABECALHOS_CSV, linhas: data.linhas.map(linhaCsv) }),
          },
          {
            id: "diferencas",
            rotulo: "Contas com Diferença",
            nome: `balancete-fiscal-diferencas-${sufixo}`,
            montar: () => ({ cabecalhos: CABECALHOS_CSV, linhas: resumo.comDif.map(linhaCsv) }),
          },
          ...(data.pendentes.length
            ? [
                {
                  id: "nfse",
                  rotulo: "NFS-e a Contabilizar",
                  nome: `nfse-a-contabilizar-${sufixo}`,
                  montar: () => ({
                    cabecalhos: ["Número", "Data", "Origem", "Contraparte", "Conta prevista", "Descrição da conta", "Valor"],
                    linhas: data.pendentes.map((pd) => [
                      pd.numero,
                      dataBR(pd.data),
                      pd.origem === "ME" ? "Entrada" : "Saída",
                      pd.contraparte,
                      pd.conta,
                      pd.contaDescr,
                      decimalBR(pd.valor),
                    ]),
                  }),
                },
              ]
            : []),
        ]
      : [];

  if (isError) {
    return (
      <PainelErro
        titulo="Não deu para montar o balancete fiscal"
        mensagem={(error as Error).message}
        onTentar={() => refetch()}
      />
    );
  }

  const maior = resumo?.comDif[0];

  return (
    <>
      <AcoesPagina>
        <MenuExportar modulo="contabil" cortes={cortes} desabilitado={!data} />
      </AcoesPagina>

      {isLoading || !data || !resumo ? (
        <FaixaIndicadores>
          {["Contas com diferença", "Maior diferença", "Notas reproduzidas", "NFS-e a contabilizar"].map((r) => (
            <Indicador key={r} rotulo={r} valor="" detalhe="" carregando />
          ))}
        </FaixaIndicadores>
      ) : (
        <FaixaIndicadores>
          <Indicador
            rotulo="Contas com diferença"
            icone="alerta"
            valor={num(resumo.comDif.length)}
            detalhe={`de ${num(resumo.analiticas.length)} analíticas com movimento`}
            tom={resumo.comDif.length ? "perigo" : "ok"}
            valorNoTom={resumo.comDif.length > 0}
            onClick={resumo.comDif.length ? () => setSoDif(true) : undefined}
          />
          <Indicador
            rotulo="Maior diferença"
            icone="balanca"
            valor={maior ? brl(difLiquida(maior)) : "—"}
            detalhe={maior ? `${maior.conta} · ${maior.descricao}` : "nenhuma conta diverge"}
            onClick={maior ? () => abrir(maior, "diferenca") : undefined}
          />
          <Indicador
            rotulo="Notas reproduzidas"
            icone="calculadora"
            valor={num(data.cobertura.notas)}
            detalhe={
              data.cobertura.componentesPulados
                ? `${num(data.cobertura.componentesPulados)} componentes fora do alcance do motor`
                : "todas as linhas de regra avaliadas"
            }
          />
          <Indicador
            rotulo="NFS-e a contabilizar"
            icone="pendente"
            valor={num(data.pendentes.length)}
            detalhe={data.pendentes.length ? `${brl(resumo.pendentes)} sem lançamento` : "nenhuma pendente"}
            tom={data.pendentes.length ? "atencao" : "neutro"}
            valorNoTom={data.pendentes.length > 0}
            onClick={data.pendentes.length ? () => setVerPendentes(true) : undefined}
          />
        </FaixaIndicadores>
      )}

      <Painel
        corpo="p-0"
        titulo={soDif ? "Contas com Diferença" : "Contas"}
        descricao={
          soDif
            ? "Analíticas em que o esperado não bate com o lançado, maior desvio primeiro"
            : "Clique num valor para ver os lançamentos, e na diferença para ver as notas"
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="Conta, classificação ou descrição"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-64"
              aria-label="Buscar conta"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <Segmentado
              rotulo="Contas"
              opcoes={[
                { valor: "todas", rotulo: "Todas" },
                { valor: "dif", rotulo: "Só diferenças", icone: "filtrar" },
              ]}
              valor={soDif ? "dif" : "todas"}
              onMudar={(v) => setSoDif(v === "dif")}
            />
            {!soDif && <SeletorNivel nivelMax={nivelMax} valor={corte} onMudar={setNivel} />}
          </>
        }
        rodape={
          data && data.semApuracao.length > 0 ? (
            <Nota tom="atencao" icone="info">
              Fora da coluna Diferença: {brl(resumo?.semApuracao ?? 0)} esperados em {num(data.semApuracao.length)}{" "}
              {data.semApuracao.length === 1 ? "componente" : "componentes"} de apuração mensal (
              {[...new Set(data.semApuracao.map((a) => a.conta))].join(", ")}), sem lançamento de apuração no período
              para conferir.
            </Nota>
          ) : undefined
        }
      >
        {isLoading || !data ? (
          <EsqueletoTabela linhas={12} colunas={6} />
        ) : (
          <TabelaDados
            key={soDif ? "diferencas" : "arvore"}
            rotulo="Balancete Fiscal"
            colunas={colunas}
            linhas={linhas}
            chave={(l) => `${l.classif}:${l.conta}`}
            onLinha={(l) =>
              abrir(
                l,
                Math.abs(difLiquida(l)) > TOLERANCIA ? "diferenca" : "real",
                l.realCred > l.realDeb ? -1 : 1
              )
            }
            selecionada={(l) => alvo?.linha.classif === l.classif && alvo.linha.conta === l.conta}
            alturaMax="min(72dvh, 46rem)"
            vazio={
              data.linhas.length === 0 ? (
                <Vazio
                  icone="balanca"
                  titulo="Sem movimento fiscal no período"
                  descricao="Nenhuma nota nem lançamento de origem fiscal nas datas do topo. Troque o período para conferir outro recorte."
                />
              ) : buscando ? (
                <Vazio
                  compacto
                  icone="buscar"
                  titulo="Nenhuma conta com esse termo"
                  descricao="Busque pela classificação, pelo código ou por outra parte da descrição."
                  acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
                />
              ) : (
                <Vazio
                  compacto
                  icone="ok"
                  titulo="Nenhuma conta com diferença"
                  descricao="O esperado pelas regras bate com o lançado em todas as analíticas."
                  acao={<Botao onClick={() => setSoDif(false)}>Ver todas as contas</Botao>}
                />
              )
            }
          />
        )}
      </Painel>

      {alvo && qs && (
        <ModalConta
          key={`${alvo.linha.classif}:${alvo.linha.conta}:${alvo.vista}:${alvo.natureza}`}
          qs={qs}
          alvo={alvo}
          onFechar={() => setAlvo(null)}
        />
      )}

      <ModalPendentes aberto={verPendentes} pendentes={data?.pendentes ?? []} onFechar={() => setVerPendentes(false)} />
    </>
  );
}

const COLUNAS_PENDENTES: Coluna<BalancetePendente>[] = [
  {
    id: "numero",
    cabecalho: "Nº",
    largura: "110px",
    ordenar: (p) => p.numero,
    celula: (p) => (
      <span className="num whitespace-nowrap text-tinta">
        {p.numero != null ? num(p.numero) : "s/nº"}
        <span className="ml-1.5 text-micro text-apagado">{p.origem === "ME" ? "entrada" : "saída"}</span>
      </span>
    ),
  },
  { id: "data", cabecalho: "Data", largura: "96px", ordenar: (p) => p.data, celula: (p) => <span className="num">{dataBR(p.data)}</span> },
  {
    id: "contraparte",
    cabecalho: "Contraparte",
    ordenar: (p) => p.contraparte,
    celula: (p) => <span className="block truncate">{p.contraparte ?? "—"}</span>,
  },
  {
    id: "conta",
    cabecalho: "Conta prevista",
    ordenar: (p) => p.conta,
    celula: (p) => <ContaTexto conta={p.conta} descricao={p.contaDescr} vazio="sem histórico do fornecedor" />,
  },
  {
    id: "valor",
    cabecalho: "Valor",
    alinhar: "dir",
    largura: "136px",
    ordenar: (p) => p.valor,
    classe: "font-[600] text-tinta",
    celula: (p) => brl(p.valor),
  },
];

/**
 * As NFS-e obrigadas a contabilizar que não foram lançadas. Sem CFOP o motor
 * não as reproduz e sem lançamento não há o que espelhar, então elas sumiriam;
 * a rota injeta o valor no esperado da conta que o histórico do fornecedor
 * aponta, e aqui fica a prova de onde a diferença veio.
 */
function ModalPendentes({
  aberto,
  pendentes,
  onFechar,
}: {
  aberto: boolean;
  pendentes: BalancetePendente[];
  onFechar: () => void;
}) {
  const total = pendentes.reduce((s, p) => s + p.valor, 0);
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      largura="g"
      corpo="p-0"
      titulo="NFS-e a Contabilizar"
      descricao={`${num(pendentes.length)} ${pendentes.length === 1 ? "nota" : "notas"} · ${brl(total)}`}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <div className="px-5 py-3">
        <Nota>
          Entram no esperado da conta que o histórico do fornecedor aponta. Sem histórico, ficam só nesta lista.
        </Nota>
      </div>
      <TabelaDados
        rotulo="NFS-e a Contabilizar"
        colunas={COLUNAS_PENDENTES}
        linhas={pendentes}
        chave={(p) => `${p.origem}:${p.chave}`}
        ordemInicial={{ coluna: "valor", sentido: "desc" }}
      />
    </Modal>
  );
}
