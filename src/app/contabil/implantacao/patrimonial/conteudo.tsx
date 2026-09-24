"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { baixarArquivo } from "@/componentes/produto/contabil/baixar-arquivo";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { EnvioArquivo, erroDeSenha } from "@/componentes/produto/contabil/envio-arquivo";
import { RodapeGeracao, type EstadoGeracao } from "@/componentes/produto/contabil/rodape-geracao";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { bytesWindows1252, decimalBR } from "@/lib/csv";
import { brl, dataBR, num, pct } from "@/lib/format";
import { avisoDoBem, conferirPatrimonial, type ConferenciaConta } from "@/lib/patrimonial-conferencia";
import { RELATORIOS_PATRIMONIAL } from "@/lib/patrimonial-pdf";
import {
  PREFIXO_DEPARA_PATRIMONIAL,
  type BemLido,
  type ContaBensCasada,
  type LeituraPatrimonialCasada,
} from "@/lib/patrimonial-tipos";
import type { ContaPlano } from "@/lib/types";
import { enviarArquivo, mutar } from "@/hooks/mutar";
import { buscarJson } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { rotuloSituacao, SITUACAO_DEPARA, VIA_DEPARA } from "../de-para";
import { BemModal } from "./bem-modal";
import { ContaBensModal } from "./conta-bens-modal";
import { diferenca, diferencaDaConta } from "./diferenca";

type Leitura = LeituraPatrimonialCasada & { arquivo: string };

interface LinhaConta {
  c: ContaBensCasada;
  conf: ConferenciaConta;
}

interface LinhaBem {
  b: BemLido;
  i: number;
}

const TODAS = "todas";

const parar = (e: SyntheticEvent) => e.stopPropagation();

/** Primeiro dia do mês seguinte à posição: quando a depreciação segue no Questor. */
function mesSeguinte(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Implantação do patrimonial: o relatório de bens da contabilidade anterior
 * (PDF) vira o arquivo de importação do patrimonial do Questor.
 *
 * A tela é conferência, não formulário: toda correção num bem recalcula na hora
 * a soma contra o total que o PRÓPRIO relatório imprime, conta a conta. É o que
 * separa esta leitura de colar o PDF numa IA: pegar a coluna do residual no
 * lugar da depreciação passaria calado; aqui a soma deixa de bater e a tela
 * aponta.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const k = `\u0000${empresa}`;

  const [arquivo, setArquivo] = useEstadoTela<File | null>(`arquivo${k}`, null);
  const [protegido, setProtegido] = useEstadoTela(`protegido${k}`, false);
  const [senha, setSenha] = useEstadoTela(`senha${k}`, "");
  const [lidoDe, setLidoDe] = useEstadoTela<File | null>(`lido${k}`, null);
  const [leitura, setLeitura] = useEstadoTela<Leitura | null>(`leitura${k}`, null);
  const [lendo, setLendo] = useEstadoTela(`lendo${k}`, false);
  const [erroLeitura, setErroLeitura] = useEstadoTela<string | null>(`erro${k}`, null);
  const [gerando, setGerando] = useEstadoTela(`gerando${k}`, false);
  const [contaFiltro, setContaFiltro] = useEstadoTela<string>(`contaFiltro${k}`, TODAS);
  const [soAviso, setSoAviso] = useEstadoTela<"todos" | "aviso">(`aviso${k}`, "todos");
  const [busca, setBusca] = useEstadoTela(`busca${k}`, "");
  const [contaAberta, setContaAberta] = useState<string | null>(null);
  const [bemAberto, setBemAberto] = useState<number | null>(null);

  const conferencia = useMemo(() => (leitura ? conferirPatrimonial(leitura) : null), [leitura]);
  const confPorConta = useMemo(
    () => new Map((conferencia?.contas ?? []).map((c) => [c.chave, c])),
    [conferencia]
  );
  // Conta que ficou sem bem (todos tirados do arquivo) não pesa em nada.
  const linhasConta = useMemo<LinhaConta[]>(
    () =>
      (leitura?.contas ?? [])
        .map((c) => ({ c, conf: confPorConta.get(c.chave) }))
        .filter((x): x is LinhaConta => !!x.conf && x.conf.bens > 0),
    [leitura, confPorConta]
  );
  const nomeConta = useMemo(() => new Map((leitura?.contas ?? []).map((c) => [c.chave, c.descricao])), [leitura]);
  const semConta = linhasConta.filter(({ c }) => c.conta == null).length;
  const comAviso = useMemo(() => (leitura?.bens ?? []).filter((b) => avisoDoBem(b)).length, [leitura]);

  const bensVisiveis = useMemo(() => {
    const t = normalizar(busca.trim());
    return (leitura?.bens ?? [])
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => {
        if (contaFiltro !== TODAS && b.conta !== contaFiltro) return false;
        if (soAviso === "aviso" && !avisoDoBem(b)) return false;
        return !t || normalizar(`${b.codigo} ${b.descricao}`).includes(t);
      });
  }, [leitura, contaFiltro, soAviso, busca]);

  const leituraEmDia = leitura != null && lidoDe === arquivo;

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
      const r = await enviarArquivo<Leitura>("/api/contabil/implantacao/patrimonial/ler", fd);
      setLeitura(r);
      setLidoDe(f);
      setContaFiltro(TODAS);
      setSoAviso("todos");
      setBusca("");
      setContaAberta(null);
      setBemAberto(null);
      avisar.ok(`${num(r.bens.length)} bens lidos`, `Relatório ${r.sistema}`);
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

  const mudarBem = (i: number, mudanca: Partial<BemLido>) =>
    setLeitura((atual) => atual && { ...atual, bens: atual.bens.map((b, j) => (j === i ? { ...b, ...mudanca } : b)) });

  const removerBem = (i: number) =>
    setLeitura((atual) => atual && { ...atual, bens: atual.bens.filter((_, j) => j !== i) });

  /** Troca a conta do Questor de uma conta do relatório e grava o de-para da empresa. */
  async function escolherConta(chave: string, conta: number | null, dados?: ContaPlano) {
    const origem = leitura?.contas.find((c) => c.chave === chave);
    let contaDescr = dados?.descricao;
    if (conta != null && !contaDescr) {
      try {
        const contas = await buscarJson<ContaPlano[]>(`/api/contabil/contas?empresa=${empresa}&busca=${conta}`);
        contaDescr = contas.find((x) => x.conta === conta)?.descricao;
      } catch {
        /* sem a descrição, a linha mostra só o número */
      }
    }
    // Funcional: um bem editado enquanto a descrição chegava não pode ser
    // desfeito pela troca de conta.
    setLeitura(
      (atual) =>
        atual && {
          ...atual,
          contas: atual.contas.map((c) =>
            c.chave === chave
              ? {
                  ...c,
                  conta,
                  contaDescr,
                  status: conta == null ? "sem_conta" : "casada",
                  via: conta == null ? null : "manual",
                  confianca: conta == null ? 0 : 1,
                }
              : c
          ),
        }
    );
    try {
      // Vira de-para: a próxima leitura desta empresa já vem com a conta. O
      // prefixo separa a conta do relatório de bens da conta "3" do balancete.
      await mutar("/api/contabil/implantacao/depara", "POST", {
        empresa,
        chave: PREFIXO_DEPARA_PATRIMONIAL + chave,
        descr: origem?.descricao ?? null,
        conta,
      });
    } catch (e) {
      avisar.erro("A conta mudou na tela, mas o de-para não foi salvo", (e as Error).message);
    }
  }

  async function gerar() {
    if (!leitura) return;
    setGerando(true);
    try {
      const r = await mutar<{ arquivo: string; linhas: number; valor: number; depreciacao: number }>(
        "/api/contabil/implantacao/patrimonial/gerar",
        "POST",
        {
          empresa,
          sistema: leitura.sistema,
          contas: leitura.contas.map((c) => ({ chave: c.chave, conta: c.conta })),
          bens: leitura.bens,
        }
      );
      // Windows-1252: é o que o importador do Questor lê sem estragar acento.
      baixarArquivo(`patrimonial_${empresa}.csv`, bytesWindows1252(r.arquivo), "text/csv;charset=windows-1252");
      avisar.ok(`Arquivo gerado com ${num(r.linhas)} bens`, `${brl(r.valor)} em bens, ${brl(r.depreciacao)} depreciados`);
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  const colunasConta: Coluna<LinhaConta>[] = [
    {
      id: "origem",
      cabecalho: "Conta no relatório",
      ordenar: ({ c }) => c.descricao,
      celula: ({ c }) => (
        <span className="flex min-w-0 items-baseline gap-2" title={c.descricao}>
          <span className="num shrink-0 text-pequeno text-apagado">{c.chave}</span>
          <span className="min-w-0 truncate text-tinta">{c.descricao}</span>
        </span>
      ),
    },
    {
      id: "questor",
      cabecalho: "Conta no Questor",
      largura: "30%",
      ordenar: ({ c }) => c.conta,
      celula: ({ c }) =>
        c.status !== "casada" ? (
          <div className="min-w-0" onClick={parar} onKeyDown={parar}>
            <SeletorConta
              empresa={empresa}
              valor={c.conta}
              onMudar={(conta, dados) => escolherConta(c.chave, conta, dados)}
              limpavel
              placeholder="Escolher conta"
              rotuloAcessivel={`Conta no Questor para ${c.descricao}`}
            />
          </div>
        ) : (
          <ContaTexto conta={c.conta} descricao={c.contaDescr} />
        ),
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      largura: "120px",
      ordenar: ({ c }) => (c.status === "casada" ? 2 : c.status === "duvidosa" ? 1 : 0),
      celula: ({ c }) => <Selo tom={SITUACAO_DEPARA[c.status].tom}>{rotuloSituacao(c.status, c.confianca)}</Selo>,
    },
    {
      id: "bens",
      cabecalho: "Bens",
      alinhar: "dir",
      largura: "70px",
      ordenar: ({ conf }) => conf.bens,
      celula: ({ conf }) => num(conf.bens),
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "140px",
      ordenar: ({ conf }) => conf.lido.valor,
      classe: "font-[600] text-tinta",
      celula: ({ conf }) => brl(conf.lido.valor),
    },
    {
      id: "depreciacao",
      cabecalho: "Depreciação",
      alinhar: "dir",
      largura: "140px",
      secundaria: true,
      ordenar: ({ conf }) => conf.lido.depreciacao,
      celula: ({ conf }) => brl(conf.lido.depreciacao),
    },
    {
      id: "relatorio",
      cabecalho: "Relatório",
      largura: "110px",
      ordenar: ({ conf }) => (conf.confere == null ? 1 : conf.confere ? 2 : 0),
      celula: ({ conf }) =>
        conf.confere === null ? (
          <span className="text-apagado">Sem total</span>
        ) : conf.confere ? (
          <Selo tom="ok">Confere</Selo>
        ) : (
          <Selo tom="perigo" title={diferencaDaConta(conf) ?? undefined}>
            Difere
          </Selo>
        ),
    },
  ];

  const colunasBem: Coluna<LinhaBem>[] = [
    {
      id: "codigo",
      cabecalho: "Bem",
      largura: "90px",
      ordenar: ({ b }) => b.codigo,
      celula: ({ b }) => <span className="num text-apagado">{b.codigo}</span>,
    },
    {
      id: "descricao",
      cabecalho: "Descrição",
      ordenar: ({ b }) => b.descricao,
      celula: ({ b }) => {
        const aviso = avisoDoBem(b);
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-tinta" title={b.descricao}>
              {b.descricao}
            </span>
            {aviso && (
              <Selo tom="atencao" icone="alerta" title={aviso}>
                Aviso
              </Selo>
            )}
          </span>
        );
      },
    },
    {
      id: "conta",
      cabecalho: "Conta",
      largura: "22%",
      secundaria: true,
      ordenar: ({ b }) => nomeConta.get(b.conta),
      celula: ({ b }) => <span className="block truncate text-apagado">{nomeConta.get(b.conta) ?? b.conta}</span>,
    },
    {
      id: "aquisicao",
      cabecalho: "Aquisição",
      largura: "100px",
      ordenar: ({ b }) => b.aquisicao,
      celula: ({ b }) => <span className="num">{dataBR(b.aquisicao)}</span>,
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "130px",
      ordenar: ({ b }) => b.valor,
      classe: "font-[600] text-tinta",
      celula: ({ b }) => brl(b.valor),
    },
    {
      id: "depreciacao",
      cabecalho: "Depreciação",
      alinhar: "dir",
      largura: "130px",
      ordenar: ({ b }) => b.depreciacao,
      celula: ({ b }) => brl(b.depreciacao),
    },
    {
      id: "taxa",
      cabecalho: "Taxa",
      alinhar: "dir",
      largura: "70px",
      ordenar: ({ b }) => b.taxa,
      celula: ({ b }) => pct(b.taxa),
    },
  ];

  const difGeral =
    conferencia?.relatorio != null
      ? diferenca({
          valor: conferencia.lido.valor - conferencia.relatorio.valor,
          depreciacao: conferencia.lido.depreciacao - conferencia.relatorio.depreciacao,
        })
      : null;

  const estadoGeracao: { estado: EstadoGeracao; mensagem: string } =
    semConta > 0
      ? {
          estado: "perigo",
          mensagem:
            semConta === 1
              ? "Falta escolher a conta do Questor de uma conta do relatório."
              : `Falta escolher a conta do Questor de ${num(semConta)} contas do relatório.`,
        }
      : conferencia?.confere === false
        ? {
            estado: "perigo",
            mensagem: "A soma dos bens não bate com o total do relatório. Confira as contas marcadas antes de importar.",
          }
        : comAviso > 0
          ? {
              estado: "atencao",
              mensagem: comAviso === 1 ? "Um bem está com aviso." : `${num(comAviso)} bens estão com aviso.`,
            }
          : { estado: "ok", mensagem: "Bens e depreciação conferem com o relatório." };

  const abertaConta = contaAberta != null ? linhasConta.find(({ c }) => c.chave === contaAberta) : undefined;
  const abertoBem = bemAberto != null ? leitura?.bens[bemAberto] : undefined;

  return (
    <>
      {leitura && (
        <AcoesPagina>
          <MenuExportar
            modulo="contabil"
            cortes={[
              {
                id: "contas",
                rotulo: "Contas do relatório",
                nome: `patrimonial_contas_${empresa}`,
                montar: () => ({
                  cabecalhos: [
                    "Conta no relatório",
                    "Descrição",
                    "Conta no Questor",
                    "Descrição no Questor",
                    "Situação",
                    "Como casou",
                    "Bens",
                    "Valor",
                    "Depreciação",
                    "Relatório",
                  ],
                  linhas: linhasConta.map(({ c, conf }) => [
                    c.chave,
                    c.descricao,
                    c.conta,
                    c.contaDescr,
                    rotuloSituacao(c.status, c.confianca),
                    c.via ? VIA_DEPARA[c.via] : "",
                    conf.bens,
                    decimalBR(conf.lido.valor),
                    decimalBR(conf.lido.depreciacao),
                    conf.confere === null ? "Sem total" : conf.confere ? "Confere" : "Difere",
                  ]),
                }),
              },
              {
                id: "bens",
                rotulo: "Bens",
                nome: `patrimonial_bens_${empresa}`,
                montar: () => ({
                  cabecalhos: ["Bem", "Descrição", "Conta", "Aquisição", "Valor", "Depreciação", "Taxa", "Aviso"],
                  linhas: bensVisiveis.map(({ b }) => [
                    b.codigo,
                    b.descricao,
                    nomeConta.get(b.conta) ?? b.conta,
                    dataBR(b.aquisicao),
                    decimalBR(b.valor),
                    decimalBR(b.depreciacao),
                    decimalBR(b.taxa),
                    avisoDoBem(b) ?? "",
                  ]),
                }),
              },
            ]}
          />
        </AcoesPagina>
      )}

      <Painel>
        <EnvioArquivo
          aceita=".pdf"
          arquivo={arquivo}
          lido={leituraEmDia}
          lendo={lendo}
          onArquivo={escolherArquivo}
          onLer={ler}
          rotuloLer="Ler bens"
          titulo="Solte o relatório de bens da contabilidade anterior"
          descricao={`Relatórios que a leitura conhece: ${RELATORIOS_PATRIMONIAL.join(", ")}.`}
          icone="camadas"
          senha={{ protegido, valor: senha, onMudar: setSenha }}
        />
      </Painel>

      {erroLeitura && (
        <PainelErro
          titulo="Não deu para ler o relatório de bens"
          mensagem={erroLeitura}
          onTentar={arquivo ? ler : undefined}
        />
      )}

      {!leitura && lendo && (
        <>
          <FaixaIndicadores>
            <Indicador rotulo="Bens" valor="" carregando />
            <Indicador rotulo="Valor dos bens" valor="" carregando />
            <Indicador rotulo="Depreciação acumulada" valor="" carregando />
            <Indicador rotulo="Total do relatório" valor="" carregando />
          </FaixaIndicadores>
          <Painel corpo="p-0" titulo="Contas do relatório">
            <EsqueletoTabela colunas={5} linhas={4} />
          </Painel>
        </>
      )}

      {leitura && conferencia && (
        <>
          <FaixaIndicadores>
            <Indicador
              rotulo="Bens"
              icone="camadas"
              valor={num(leitura.bens.length)}
              detalhe={`${num(linhasConta.length)} ${linhasConta.length === 1 ? "conta" : "contas"} · ${leitura.sistema}`}
            />
            <Indicador rotulo="Valor dos bens" icone="moedas" valor={brl(conferencia.lido.valor)} />
            <Indicador
              rotulo="Depreciação acumulada"
              icone="tendencia-baixa"
              valor={brl(conferencia.lido.depreciacao)}
              detalhe={leitura.posicao ? `até ${dataBR(leitura.posicao)}` : undefined}
            />
            <Indicador
              rotulo="Total do relatório"
              icone="balanca"
              valor={conferencia.confere === null ? "Sem total" : conferencia.confere ? "Confere" : "Difere"}
              tom={conferencia.confere === false ? "perigo" : "neutro"}
              valorNoTom={conferencia.confere === false}
              detalhe={conferencia.confere === false && difGeral ? difGeral : undefined}
            />
            <Indicador
              rotulo="Com aviso"
              icone="alerta"
              valor={num(comAviso)}
              tom={comAviso ? "atencao" : "neutro"}
              valorNoTom={comAviso > 0}
              detalhe={comAviso ? "bens para conferir" : "nenhum bem torto"}
              onClick={comAviso ? () => setSoAviso("aviso") : undefined}
            />
          </FaixaIndicadores>

          <Painel
            corpo="p-0"
            titulo="Contas do relatório"
            descricao="Onde cada conta de bens entra no plano do Questor"
          >
            <TabelaDados
              rotulo="Contas do relatório de bens"
              colunas={colunasConta}
              linhas={linhasConta}
              chave={({ c }) => c.chave}
              onLinha={({ c }) => setContaAberta(c.chave)}
              selecionada={({ c }) => c.chave === contaFiltro}
              alturaMax="min(40dvh, 420px)"
            />
          </Painel>

          <Painel
            corpo="p-0"
            titulo="Bens"
            descricao={
              bensVisiveis.length === leitura.bens.length
                ? `${num(leitura.bens.length)} no relatório`
                : `${num(bensVisiveis.length)} de ${num(leitura.bens.length)}`
            }
            acoes={
              <>
                <Campo
                  icone="buscar"
                  placeholder="Código ou descrição"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  classeCaixa="w-52"
                  aria-label="Buscar bem"
                />
                <Combo
                  className="w-56"
                  rotuloAcessivel="Conta do relatório"
                  opcoes={[
                    { valor: TODAS, rotulo: "Todas as contas" },
                    ...linhasConta.map(({ c }) => ({ valor: c.chave, rotulo: c.descricao, detalhe: c.chave })),
                  ]}
                  valor={contaFiltro}
                  onMudar={setContaFiltro}
                />
                <Segmentado<"todos" | "aviso">
                  rotulo="Aviso"
                  valor={soAviso}
                  onMudar={setSoAviso}
                  opcoes={[
                    { valor: "todos", rotulo: "Todos" },
                    { valor: "aviso", rotulo: `Com aviso ${num(comAviso)}` },
                  ]}
                />
              </>
            }
          >
            <TabelaDados
              rotulo="Bens do relatório"
              colunas={colunasBem}
              linhas={bensVisiveis}
              chave={({ b, i }) => `${b.codigo}-${i}`}
              onLinha={({ i }) => setBemAberto(i)}
              selecionada={({ i }) => i === bemAberto}
              alturaMax="min(60dvh, 640px)"
              vazio={
                leitura.bens.length === 0 ? (
                  <Vazio
                    compacto
                    icone="camadas"
                    titulo="Nenhum bem no arquivo"
                    descricao="Todos foram tirados. Leia o relatório de novo para recomeçar."
                  />
                ) : (
                  <Vazio
                    compacto
                    icone="filtrar"
                    titulo="Nenhum bem neste filtro"
                    descricao="Afrouxe a busca, volte para Todas as contas ou para Todos."
                  />
                )
              }
            />
          </Painel>

          <RodapeGeracao
            estado={estadoGeracao.estado}
            mensagem={estadoGeracao.mensagem}
            nota={
              leitura.posicao
                ? `Depreciação acumulada até ${dataBR(leitura.posicao)}. No Questor, a depreciação começa em ${dataBR(mesSeguinte(leitura.posicao))}.`
                : undefined
            }
          >
            <Botao
              variante={leituraEmDia ? "primario" : "secundario"}
              icone="baixar"
              carregando={gerando}
              disabled={semConta > 0 || !leitura.bens.length}
              onClick={gerar}
            >
              Baixar arquivo do patrimonial
            </Botao>
          </RodapeGeracao>
        </>
      )}

      {abertaConta && (
        <ContaBensModal
          conta={abertaConta.c}
          conferencia={abertaConta.conf}
          empresa={empresa}
          onConta={(conta, dados) => escolherConta(abertaConta.c.chave, conta, dados)}
          onVerBens={() => {
            setContaFiltro(abertaConta.c.chave);
            setContaAberta(null);
          }}
          onFechar={() => setContaAberta(null)}
        />
      )}

      {abertoBem && bemAberto != null && (
        <BemModal
          bem={abertoBem}
          conta={nomeConta.get(abertoBem.conta) ?? abertoBem.conta}
          onSalvar={(mudanca) => {
            mudarBem(bemAberto, mudanca);
            setBemAberto(null);
          }}
          onRemover={() => {
            removerBem(bemAberto);
            setBemAberto(null);
          }}
          onFechar={() => setBemAberto(null)}
        />
      )}
    </>
  );
}
