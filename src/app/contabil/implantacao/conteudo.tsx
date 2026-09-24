"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type SyntheticEvent } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { baixarArquivo } from "@/componentes/produto/contabil/baixar-arquivo";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { EnvioArquivo, erroDeSenha } from "@/componentes/produto/contabil/envio-arquivo";
import { MarcaNatureza } from "@/componentes/produto/contabil/partida";
import { RodapeGeracao, type EstadoGeracao } from "@/componentes/produto/contabil/rodape-geracao";
import { SeletorHistorico, useHistorico } from "@/componentes/produto/contabil/seletor-historico";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { decimalBR } from "@/lib/csv";
import { brl, num, pct } from "@/lib/format";
import type { ConfigImplantacao, LinhaCasada, StatusCasamento } from "@/lib/implantacao-tipos";
import type { ContaPlano } from "@/lib/types";
import { enviarArquivo, mutar } from "@/hooks/mutar";
import { buscarJson, useConsulta, useFiliais } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { rotuloSituacao, SITUACAO_DEPARA, VIA_DEPARA } from "./de-para";
import { SaldoModal } from "./saldo-modal";

type Filtro = StatusCasamento | "todas";

interface Linha {
  c: LinhaCasada;
  i: number;
}

interface ResultadoGeracao {
  arquivo: string;
  linhas: number;
  totalDebito: number;
  totalCredito: number;
  transitoriaZera: boolean;
  semConta: unknown[];
}

/**
 * Histórico 350 é "Valor Referente [DICTEXTO]", o de implantação usado no
 * escritório, e ele pede complemento. Vale quando nem a empresa nem o padrão
 * global têm histórico salvo.
 */
const HISTORICO_PADRAO = 350;
const COMPLEMENTO_PADRAO = "IMPLANTACAO DE SALDOS";
/** Marca de "ainda não mexi": o valor vem da configuração da empresa. */
const DO_PADRAO = "padrao" as const;

const parar = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Implantação de saldos: o balancete da contabilidade anterior, em PDF, vira o
 * arquivo de saldos do Questor. Cada conta com saldo é casada com o plano da
 * empresa (pelo de-para salvo, pela classificação ou pela descrição) e vira um
 * lançamento contra a conta transitória; se tudo casou certo, a transitória
 * zera e o balancete de abertura fecha.
 *
 * A tela é conferência: cada conta escolhida à mão vira de-para da empresa, e a
 * próxima leitura já vem com ela.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const qc = useQueryClient();
  const k = `\u0000${empresa}`;

  const [arquivo, setArquivo] = useEstadoTela<File | null>(`arquivo${k}`, null);
  const [protegido, setProtegido] = useEstadoTela(`protegido${k}`, false);
  const [senha, setSenha] = useEstadoTela(`senha${k}`, "");
  const [lidoDe, setLidoDe] = useEstadoTela<File | null>(`lido${k}`, null);
  const [casadas, setCasadas] = useEstadoTela<LinhaCasada[] | null>(`casadas${k}`, null);
  const [lendo, setLendo] = useEstadoTela(`lendo${k}`, false);
  const [erroLeitura, setErroLeitura] = useEstadoTela<string | null>(`erro${k}`, null);
  const [gerando, setGerando] = useEstadoTela(`gerando${k}`, false);
  const [filtro, setFiltro] = useEstadoTela<Filtro>(`filtro${k}`, "todas");
  const [busca, setBusca] = useEstadoTela(`busca${k}`, "");
  // Parâmetros do lote. Preenchidos antes de ler, o arquivo sai pronto.
  const [estab, setEstab] = useEstadoTela<number | null>(`estab${k}`, null);
  const [data, setData] = useEstadoTela(`data${k}`, "");
  const [contaImpl, setContaImpl] = useEstadoTela<number | null | typeof DO_PADRAO>(`contaImpl${k}`, DO_PADRAO);
  const [historico, setHistorico] = useEstadoTela<number | null | typeof DO_PADRAO>(`historico${k}`, DO_PADRAO);
  const [complemento, setComplemento] = useEstadoTela<string | null>(`complemento${k}`, null);
  const [salvandoPadrao, setSalvandoPadrao] = useState(false);
  const [detalhe, setDetalhe] = useState<number | null>(null);

  const urlConfig = `/api/contabil/implantacao/config?empresa=${empresa}`;
  const config = useConsulta<ConfigImplantacao>("implantacao-config", urlConfig);
  const filiais = useFiliais(empresa);

  const estabEfetivo = estab ?? filiais.data?.[0]?.codigoestab ?? 1;
  const contaEfetiva = contaImpl === DO_PADRAO ? (config.data?.contaImplantacao ?? null) : contaImpl;
  const historicoEfetivo = historico === DO_PADRAO ? (config.data?.codigoHistorico ?? HISTORICO_PADRAO) : historico;
  const complementoEfetivo = complemento ?? config.data?.complemento ?? COMPLEMENTO_PADRAO;
  const historicoEscolhido = useHistorico(historicoEfetivo);
  // Enquanto não se sabe, o campo aparece: sumir e voltar pularia a linha.
  const pedeComplemento = historicoEscolhido.data?.pedeComplemento ?? true;

  const mexeuNoPadrao = contaImpl !== DO_PADRAO || historico !== DO_PADRAO || complemento != null;
  const difereDoPadrao =
    !!config.data &&
    (contaEfetiva !== config.data.contaImplantacao ||
      historicoEfetivo !== config.data.codigoHistorico ||
      complementoEfetivo !== (config.data.complemento ?? COMPLEMENTO_PADRAO));

  const resumo = useMemo(() => {
    const c = casadas ?? [];
    let deb = 0;
    let cred = 0;
    for (const x of c) {
      if (x.natureza === "D") deb += x.origem.saldo;
      else if (x.natureza === "C") cred += x.origem.saldo;
    }
    const semConta = c.filter((x) => x.status === "sem_conta").length;
    return {
      total: c.length,
      casadas: c.filter((x) => x.status === "casada").length,
      duvidosas: c.filter((x) => x.status === "duvidosa").length,
      semConta,
      deb,
      cred,
      // Só fecha com tudo casado: conta sem destino não tem natureza garantida.
      fecha: semConta === 0 && Math.abs(deb - cred) < 1,
    };
  }, [casadas]);

  const visiveis = useMemo(() => {
    const t = normalizar(busca.trim());
    return (casadas ?? [])
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        if (filtro !== "todas" && c.status !== filtro) return false;
        if (!t) return true;
        return normalizar(
          [c.origem.chave, c.origem.classif, c.origem.descricao, c.conta, c.contaDescr].filter((x) => x != null).join(" ")
        ).includes(t);
      });
  }, [casadas, filtro, busca]);

  const leituraEmDia = casadas != null && lidoDe === arquivo;

  function escolherArquivo(f: File, trancado: boolean) {
    setArquivo(f);
    setProtegido(trancado);
    setSenha("");
    setErroLeitura(null);
  }

  async function ler() {
    if (!arquivo) return;
    const f = arquivo;
    setLendo(true);
    setErroLeitura(null);
    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      fd.set("empresa", String(empresa));
      if (senha) fd.set("senha", senha);
      const r = await enviarArquivo<{ casadas: LinhaCasada[]; resumo: { semConta: number } }>(
        "/api/contabil/implantacao/casar",
        fd
      );
      setCasadas(r.casadas);
      setLidoDe(f);
      setFiltro("todas");
      setBusca("");
      setDetalhe(null);
      avisar.ok(
        `${num(r.casadas.length)} contas lidas do balancete`,
        r.resumo.semConta ? `${num(r.resumo.semConta)} sem correspondência no plano` : undefined
      );
    } catch (e) {
      const msg = (e as Error).message;
      if (erroDeSenha(msg)) {
        setProtegido(true);
        setSenha("");
      }
      setErroLeitura(msg);
    } finally {
      setLendo(false);
    }
  }

  /**
   * Troca a conta de uma linha e grava o de-para: a próxima leitura desta
   * empresa já vem com ela. A natureza decide o lado do lançamento: a da origem
   * quando o balancete marca D ou C, senão a da conta escolhida no Questor (há
   * sistemas que não marcam).
   */
  async function escolherConta(i: number, conta: number | null, dados?: ContaPlano) {
    const linha = casadas?.[i];
    if (!linha) return;
    let natureza = linha.origem.natureza ?? null;
    if (conta != null && !natureza) {
      natureza = dados?.natureza ?? null;
      if (!natureza) {
        try {
          const contas = await buscarJson<ContaPlano[]>(`/api/contabil/contas?empresa=${empresa}&busca=${conta}`);
          natureza = contas.find((x) => x.conta === conta)?.natureza ?? null;
        } catch {
          /* natureza fica nula; o servidor resolve ao gerar */
        }
      }
    }
    // Funcional: a busca da natureza leva um instante, e outra linha trocada
    // nesse meio tempo não pode ser desfeita por esta.
    setCasadas((atual) =>
      atual
        ? atual.map((x, j) =>
            j === i
              ? {
                  ...x,
                  conta,
                  contaDescr: conta == null ? undefined : (dados?.descricao ?? (conta === x.conta ? x.contaDescr : undefined)),
                  status: conta == null ? "sem_conta" : "casada",
                  via: conta == null ? null : "manual",
                  confianca: conta == null ? 0 : 1,
                  natureza,
                }
              : x
          )
        : atual
    );
    try {
      await mutar("/api/contabil/implantacao/depara", "POST", {
        empresa,
        chave: linha.origem.chave,
        descr: linha.origem.descricao,
        conta,
      });
    } catch (e) {
      avisar.erro("A conta mudou na tela, mas o de-para não foi salvo", (e as Error).message);
    }
  }

  async function salvarPadrao() {
    setSalvandoPadrao(true);
    try {
      await mutar("/api/contabil/implantacao/config", "PUT", {
        empresa,
        config: {
          contaImplantacao: contaEfetiva,
          codigoHistorico: historicoEfetivo,
          complemento: pedeComplemento ? complementoEfetivo : null,
        },
      });
      avisar.ok("Padrão da empresa salvo", "A próxima implantação já abre com estes valores.");
      await qc.invalidateQueries({ queryKey: ["implantacao-config"] });
      setContaImpl(DO_PADRAO);
      setHistorico(DO_PADRAO);
      setComplemento(null);
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setSalvandoPadrao(false);
    }
  }

  const faltas = [
    !data && "a data dos lançamentos",
    contaEfetiva == null && "a conta transitória",
    historicoEfetivo == null && "o histórico",
  ].filter((x): x is string => !!x);
  const podeGerar = !!casadas?.length && !faltas.length && resumo.semConta === 0;

  async function gerar() {
    if (!casadas || !podeGerar || contaEfetiva == null || historicoEfetivo == null) return;
    setGerando(true);
    try {
      const r = await mutar<ResultadoGeracao>("/api/contabil/implantacao/gerar", "POST", {
        empresa,
        estab: estabEfetivo,
        data,
        contaImplantacao: contaEfetiva,
        codigoHistorico: historicoEfetivo,
        // Histórico que não pede complemento não leva texto livre.
        complemento: pedeComplemento ? complementoEfetivo : "",
        linhas: casadas.map((c) => c.origem),
      });
      baixarArquivo(`implantacao_${empresa}_${data}.txt`, r.arquivo, "text/plain;charset=utf-8");
      if (!r.transitoriaZera) {
        avisar.erro(
          "Arquivo gerado com a transitória aberta",
          `Débitos ${brl(r.totalDebito)}, créditos ${brl(r.totalCredito)}. O balancete de abertura não fecha.`
        );
      } else {
        avisar.ok(
          `${num(r.linhas)} lançamentos gerados`,
          r.semConta.length ? `${num(r.semConta.length)} contas sem correspondência ficaram de fora` : undefined
        );
      }
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  const proximaAConferir = (de: number): number | null => {
    const lista = casadas ?? [];
    for (let d = 1; d < lista.length; d++) {
      const j = (de + d) % lista.length;
      if (lista[j].status !== "casada") return j;
    }
    return null;
  };

  const colunas: Coluna<Linha>[] = [
    {
      id: "origem",
      cabecalho: "Conta no balancete",
      ordenar: ({ c }) => c.origem.descricao,
      celula: ({ c }) => (
        <span className="flex min-w-0 items-baseline gap-2" title={c.origem.descricao}>
          <span className="num shrink-0 text-pequeno text-apagado">{c.origem.chave}</span>
          <span className="min-w-0 truncate text-tinta">{c.origem.descricao}</span>
        </span>
      ),
    },
    {
      id: "classif",
      cabecalho: "Classificação",
      largura: "130px",
      secundaria: true,
      ordenar: ({ c }) => c.origem.classif,
      celula: ({ c }) => <span className="num text-apagado">{c.origem.classif ?? ""}</span>,
    },
    {
      id: "questor",
      cabecalho: "Conta no Questor",
      largura: "32%",
      ordenar: ({ c }) => c.conta,
      celula: ({ c, i }) =>
        c.status !== "casada" ? (
          <div className="min-w-0" onClick={parar} onKeyDown={parar}>
            <SeletorConta
              empresa={empresa}
              valor={c.conta}
              onMudar={(conta, dados) => escolherConta(i, conta, dados)}
              limpavel
              placeholder="Escolher conta"
              rotuloAcessivel={`Conta no Questor para ${c.origem.descricao}`}
            />
          </div>
        ) : (
          <ContaTexto conta={c.conta} descricao={c.contaDescr} />
        ),
    },
    {
      id: "natureza",
      cabecalho: "Natureza",
      largura: "110px",
      ordenar: ({ c }) => c.natureza,
      celula: ({ c }) =>
        c.natureza ? (
          <span className="flex items-center gap-1.5">
            <MarcaNatureza natureza={c.natureza === "D" ? 1 : -1} />
            <span className="text-apagado">{c.natureza === "D" ? "Devedor" : "Credor"}</span>
          </span>
        ) : (
          <span className="text-apagado italic">Indefinida</span>
        ),
    },
    {
      id: "saldo",
      cabecalho: "Saldo",
      alinhar: "dir",
      largura: "150px",
      ordenar: ({ c }) => c.origem.saldo,
      classe: "font-[600] text-tinta",
      celula: ({ c }) => brl(c.origem.saldo),
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      largura: "130px",
      ordenar: ({ c }) => (c.status === "casada" ? 2 : c.status === "duvidosa" ? 1 : 0),
      celula: ({ c }) => <Selo tom={SITUACAO_DEPARA[c.status].tom}>{rotuloSituacao(c.status, c.confianca)}</Selo>,
    },
  ];

  const estadoGeracao: { estado: EstadoGeracao; mensagem: string; nota?: string } =
    resumo.semConta > 0
      ? {
          estado: "perigo",
          mensagem: `${num(resumo.semConta)} ${resumo.semConta === 1 ? "conta sem" : "contas sem"} correspondência no Questor.`,
          nota: "Sem elas o balancete de abertura não fecha.",
        }
      : faltas.length
        ? { estado: "atencao", mensagem: `Falta ${faltas.join(", ").replace(/, ([^,]*)$/, " e $1")}.` }
        : !resumo.fecha
          ? {
              estado: "perigo",
              mensagem: `O balancete não fecha: débitos ${brl(resumo.deb)}, créditos ${brl(resumo.cred)}, diferença de ${brl(Math.abs(resumo.deb - resumo.cred))}.`,
              nota: "A leitura do PDF pode ter vindo incompleta. Confira as contas.",
            }
          : { estado: "ok", mensagem: `Balancete fecha: débitos e créditos de ${brl(resumo.deb)}.` };

  const aberta = detalhe != null ? casadas?.[detalhe] : undefined;
  const proxima = detalhe != null ? proximaAConferir(detalhe) : null;

  return (
    <>
      {casadas && (
        <AcoesPagina>
          <MenuExportar
            modulo="contabil"
            cortes={[
              {
                id: "depara",
                rotulo: "De-para",
                nome: `implantacao_depara_${empresa}`,
                montar: () => ({
                  cabecalhos: [
                    "Conta no balancete",
                    "Classificação",
                    "Descrição",
                    "Saldo",
                    "Natureza",
                    "Conta no Questor",
                    "Descrição no Questor",
                    "Situação",
                    "Como casou",
                  ],
                  linhas: visiveis.map(({ c }) => [
                    c.origem.chave,
                    c.origem.classif,
                    c.origem.descricao,
                    decimalBR(c.origem.saldo),
                    c.natureza,
                    c.conta,
                    c.contaDescr,
                    rotuloSituacao(c.status, c.confianca),
                    c.via ? VIA_DEPARA[c.via] : "",
                  ]),
                }),
              },
            ]}
          />
        </AcoesPagina>
      )}

      <Painel corpo="flex flex-col gap-4">
        <EnvioArquivo
          aceita=".pdf"
          arquivo={arquivo}
          lido={leituraEmDia}
          lendo={lendo}
          onArquivo={escolherArquivo}
          onLer={ler}
          rotuloLer="Ler balancete"
          titulo="Solte o balancete da contabilidade anterior"
          descricao="PDF com texto. Balancete digitalizado não tem o que ler."
          icone="balanca"
          senha={{ protegido, valor: senha, onMudar: setSenha }}
        />
        <div className="flex flex-wrap items-end gap-3 border-t border-linha pt-4">
          <Rotulado rotulo="Filial" className="w-full sm:w-52">
            {filiais.data?.length ? (
              <Combo
                rotuloAcessivel="Filial"
                opcoes={filiais.data.map((f) => ({
                  valor: String(f.codigoestab),
                  rotulo: f.nome,
                  detalhe: String(f.codigoestab),
                }))}
                valor={String(estabEfetivo)}
                onMudar={(v) => setEstab(Number(v))}
              />
            ) : (
              <Campo
                inputMode="numeric"
                aria-label="Filial"
                value={String(estabEfetivo)}
                onChange={(e) => setEstab(Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || null)}
              />
            )}
          </Rotulado>
          <Rotulado rotulo="Data dos lançamentos" className="w-40">
            <Campo
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              aria-invalid={casadas != null && !data}
            />
          </Rotulado>
          <Rotulado rotulo="Conta transitória" className="w-full sm:w-72">
            <SeletorConta
              empresa={empresa}
              valor={contaEfetiva}
              onMudar={(c) => setContaImpl(c)}
              limpavel
              placeholder="Contrapartida dos saldos"
              rotuloAcessivel="Conta transitória"
            />
          </Rotulado>
          <Rotulado rotulo="Histórico" className="w-full sm:w-72">
            <SeletorHistorico
              valor={historicoEfetivo}
              onMudar={(h) => setHistorico(h?.codigo ?? null)}
              limpavel
              rotuloAcessivel="Histórico"
            />
          </Rotulado>
          {pedeComplemento && (
            <Rotulado rotulo="Complemento do histórico" className="min-w-48 flex-1">
              <Campo value={complementoEfetivo} onChange={(e) => setComplemento(e.target.value)} />
            </Rotulado>
          )}
          {mexeuNoPadrao && difereDoPadrao && (
            <Botao variante="fantasma" icone="salvar" carregando={salvandoPadrao} onClick={salvarPadrao}>
              Salvar como padrão da empresa
            </Botao>
          )}
        </div>
      </Painel>

      {config.isError && (
        <PainelErro
          titulo="Não deu para carregar o padrão da empresa"
          mensagem={(config.error as Error).message}
          onTentar={() => config.refetch()}
        />
      )}

      {erroLeitura && (
        <PainelErro titulo="Não deu para ler o balancete" mensagem={erroLeitura} onTentar={arquivo ? ler : undefined} />
      )}

      {!casadas && lendo && (
        <>
          <FaixaIndicadores>
            <Indicador rotulo="Contas lidas" valor="" carregando />
            <Indicador rotulo="Casadas" valor="" carregando />
            <Indicador rotulo="Confira" valor="" carregando />
            <Indicador rotulo="Sem conta" valor="" carregando />
            <Indicador rotulo="Débitos e créditos" valor="" carregando />
          </FaixaIndicadores>
          <Painel corpo="p-0" titulo="De-para">
            <EsqueletoTabela colunas={5} />
          </Painel>
        </>
      )}

      {casadas && (
        <>
          <FaixaIndicadores>
            <Indicador
              rotulo="Contas lidas"
              icone="planilha"
              valor={num(resumo.total)}
              detalhe="com saldo no balancete"
              onClick={() => setFiltro("todas")}
            />
            <Indicador
              rotulo="Casadas"
              icone="ok"
              valor={num(resumo.casadas)}
              detalhe={`${pct(resumo.total ? (resumo.casadas / resumo.total) * 100 : 0)} das contas`}
              onClick={() => setFiltro("casada")}
            />
            <Indicador
              rotulo="Confira"
              icone="lupa"
              valor={num(resumo.duvidosas)}
              tom={resumo.duvidosas ? "atencao" : "neutro"}
              valorNoTom={resumo.duvidosas > 0}
              detalhe="casadas com pouca certeza"
              onClick={() => setFiltro("duvidosa")}
            />
            <Indicador
              rotulo="Sem conta"
              icone="alerta"
              valor={num(resumo.semConta)}
              tom={resumo.semConta ? "perigo" : "neutro"}
              valorNoTom={resumo.semConta > 0}
              detalhe={resumo.semConta ? "impedem o arquivo" : "todas têm destino"}
              onClick={() => setFiltro("sem_conta")}
            />
            <Indicador
              rotulo="Débitos e créditos"
              icone="balanca"
              valor={resumo.fecha ? "Fecham" : "Não fecham"}
              tom={resumo.fecha ? "neutro" : "perigo"}
              valorNoTom={!resumo.fecha}
              detalhe={`${brl(resumo.deb)} e ${brl(resumo.cred)}`}
            />
          </FaixaIndicadores>

          <Painel
            corpo="p-0"
            titulo="De-para"
            descricao="Cada conta do balancete anterior e a conta do Questor que recebe o saldo"
            acoes={
              <>
                <Campo
                  icone="buscar"
                  placeholder="Conta ou descrição"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  classeCaixa="w-52"
                  aria-label="Buscar no de-para"
                />
                <Segmentado<Filtro>
                  rotulo="Situação"
                  valor={filtro}
                  onMudar={setFiltro}
                  opcoes={[
                    { valor: "todas", rotulo: "Todas" },
                    { valor: "casada", rotulo: "Casadas" },
                    { valor: "duvidosa", rotulo: `Confira ${num(resumo.duvidosas)}` },
                    { valor: "sem_conta", rotulo: `Sem conta ${num(resumo.semConta)}` },
                  ]}
                />
              </>
            }
          >
            <TabelaDados
              rotulo="De-para do balancete"
              colunas={colunas}
              linhas={visiveis}
              chave={({ c, i }) => `${c.origem.chave}-${i}`}
              onLinha={({ i }) => setDetalhe(i)}
              selecionada={({ i }) => i === detalhe}
              alturaMax="min(66dvh, 720px)"
              vazio={
                <Vazio
                  compacto
                  icone="filtrar"
                  titulo="Nenhuma conta neste filtro"
                  descricao={busca ? "Afrouxe a busca ou volte para Todas." : "Volte para Todas."}
                />
              }
            />
          </Painel>

          <RodapeGeracao estado={estadoGeracao.estado} mensagem={estadoGeracao.mensagem} nota={estadoGeracao.nota}>
            <Botao
              variante={leituraEmDia ? "primario" : "secundario"}
              icone="baixar"
              carregando={gerando}
              disabled={!podeGerar}
              onClick={gerar}
            >
              Gerar arquivo do Questor
            </Botao>
          </RodapeGeracao>
        </>
      )}

      {aberta && detalhe != null && (
        <SaldoModal
          linha={aberta}
          empresa={empresa}
          transitoria={contaEfetiva}
          onConta={(conta, dados) => escolherConta(detalhe, conta, dados)}
          onProxima={proxima != null ? () => setDetalhe(proxima) : undefined}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </>
  );
}

