"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type SyntheticEvent } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { baixarArquivo } from "@/componentes/produto/contabil/baixar-arquivo";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { EnvioArquivo, erroDeSenha } from "@/componentes/produto/contabil/envio-arquivo";
import { DescricaoExtrato } from "@/componentes/produto/contabil/descricao-extrato";
import {
  RegraExtratoModal,
  termoDaDescricao,
  termoDoComplemento,
  type LinhaExtrato,
  type RascunhoRegra,
} from "@/componentes/produto/contabil/regra-extrato";
import { RodapeGeracao } from "@/componentes/produto/contabil/rodape-geracao";
import { SeloFolha } from "@/componentes/produto/contabil/selo-folha";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { cn } from "@/lib/cn";
import { decimalBR } from "@/lib/csv";
import { resumir, type Ajustes, type Previa } from "@/lib/extrato-previa";
import { brl, dataBR, num, pct } from "@/lib/format";
import { gerarLancamentos, textoDaLinha, type LancamentoGerado, type RegraExtrato } from "@/lib/regras-extrato";
import type { ContaBanco, RegraExtratoDTO } from "@/lib/types";
import { enviarArquivo, mutar } from "@/hooks/mutar";
import { buscarJson, useConsulta, useFiliais } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { contrapartida, LancamentoModal, partida, situacaoLancamento } from "./lancamento-modal";
import { useContaBanco } from "./use-conta-banco";

type Filtro = "todos" | "prontos" | "pendentes" | "pessoas";

interface Linha {
  l: LancamentoGerado;
  /** Posição no extrato: é a chave do ajuste à mão. */
  i: number;
}

interface JanelaRegra {
  regra?: RegraExtratoDTO;
  inicial?: Partial<RascunhoRegra>;
  linha?: LinhaExtrato;
}

/** O clique no seletor da célula não pode abrir o detalhe da linha. */
const parar = (e: SyntheticEvent) => e.stopPropagation();

/** Inicial fixo: um `{}` novo a cada render mudaria a identidade e refaria as contas. */
const SEM_AJUSTES: Ajustes = {};

const pendenteDe = (l: LancamentoGerado, ajuste: number | null | undefined) => !!l.pendencia && ajuste == null;

/**
 * Importar extrato: o OFX ou o PDF do banco vira o CSV de lançamentos do
 * Questor. A leitura casa cada descrição com as regras da conta; o que não
 * casou se resolve na linha (conta escolhida à mão, só nesta importação) ou
 * vira regra, para casar sozinho na próxima.
 *
 * Tudo que dá trabalho refazer (o arquivo, a prévia lida, os ajustes) mora no
 * estado da tela, por empresa: ir à aba Regras cadastrar o que faltou e voltar
 * reencontra o extrato lido. O nexo2 perdia o extrato nessa ida e volta.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const qc = useQueryClient();
  const k = `\u0000${empresa}`;

  const [conta, setConta] = useContaBanco(empresa);
  const [arquivo, setArquivo] = useEstadoTela<File | null>(`arquivo${k}`, null);
  const [protegido, setProtegido] = useEstadoTela(`protegido${k}`, false);
  const [senha, setSenha] = useEstadoTela(`senha${k}`, "");
  // O arquivo que gerou a prévia: comparado com o escolhido, diz se a tela
  // mostra o que está no campo ou uma leitura anterior.
  const [lidoDe, setLidoDe] = useEstadoTela<File | null>(`lido${k}`, null);
  const [previa, setPrevia] = useEstadoTela<Previa | null>(`previa${k}`, null);
  const [ajustes, setAjustes] = useEstadoTela<Ajustes>(`ajustes${k}`, SEM_AJUSTES);
  const [filtro, setFiltro] = useEstadoTela<Filtro>(`filtro${k}`, "todos");
  const [busca, setBusca] = useEstadoTela(`busca${k}`, "");
  const [estab, setEstab] = useEstadoTela<number | null>(`estab${k}`, null);
  // Leitura em andamento também sobrevive à troca de aba: a resposta chega no
  // estado da tela mesmo com a tela desmontada, e a volta mostra o giro.
  const [lendo, setLendo] = useEstadoTela(`lendo${k}`, false);
  const [erroLeitura, setErroLeitura] = useEstadoTela<string | null>(`erro${k}`, null);
  const [reaplicando, setReaplicando] = useEstadoTela(`reaplicando${k}`, false);
  const [gerando, setGerando] = useEstadoTela(`gerando${k}`, false);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [janela, setJanela] = useState<JanelaRegra | null>(null);

  const contaPrevia = previa?.contaBanco.conta ?? null;
  const urlRegras =
    contaPrevia != null ? `/api/contabil/extrato-regras?empresa=${empresa}&conta=${contaPrevia}` : null;
  // As regras da conta lida: descrevem a contrapartida das linhas que casaram.
  const regras = useConsulta<ContaBanco>("extrato-regras", urlRegras);
  const porRegra = useMemo(() => new Map((regras.data?.regras ?? []).map((r) => [r.id, r])), [regras.data]);
  const filiais = useFiliais(empresa);
  const estabEfetivo = estab ?? filiais.data?.[0]?.codigoestab ?? 1;

  const lancamentos = useMemo(() => previa?.lancamentos ?? [], [previa]);
  const resumo = useMemo(() => resumir(lancamentos, ajustes), [lancamentos, ajustes]);
  const amostra = useMemo(
    () => lancamentos.map((l) => ({ descricao: l.descricao, complemento: l.complemento })),
    [lancamentos]
  );
  const comPessoa = useMemo(() => lancamentos.filter((l) => l.pessoa).length, [lancamentos]);
  const pessoasEmDuvida = useMemo(
    () => lancamentos.filter((l) => l.pessoa && (l.pessoa.via === "parcial" || l.pessoa.homonimos > 0)).length,
    [lancamentos]
  );
  const pendentes = resumo.semRegra + resumo.semConta;

  // Lançamentos que vão para o arquivo: sem pendência, ou com a conta escolhida
  // à mão, e com os dois lados da partida resolvidos.
  const prontos = useMemo(
    () =>
      lancamentos
        .map((l, i) => ({ l, ...partida(l, ajustes[i] ?? null) }))
        .filter(
          (x): x is { l: LancamentoGerado; debito: number; credito: number } => x.debito != null && x.credito != null
        )
        .map(({ l, debito, credito }) => ({
          data: l.data,
          contaDebito: debito,
          contaCredito: credito,
          complemento: l.historico,
          valor: l.valor,
        })),
    [lancamentos, ajustes]
  );

  const visiveis = useMemo(() => {
    const t = normalizar(busca.trim());
    return lancamentos
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => {
        const ajuste = ajustes[i] ?? null;
        if (filtro === "pessoas" && !l.pessoa) return false;
        if (filtro === "prontos" && pendenteDe(l, ajuste)) return false;
        if (filtro === "pendentes" && !pendenteDe(l, ajuste)) return false;
        if (!t) return true;
        const contra = contrapartida(l, ajuste);
        return (
          normalizar(textoDaLinha(l.descricao, l.complemento)).includes(t) || (contra != null && String(contra) === t)
        );
      });
  }, [lancamentos, ajustes, filtro, busca]);

  const leituraEmDia = previa != null && lidoDe === arquivo && contaPrevia === conta;

  function escolherArquivo(f: File, trancado: boolean) {
    setArquivo(f);
    setProtegido(trancado);
    setSenha("");
    setErroLeitura(null);
  }

  async function ler() {
    if (!arquivo || conta == null) return;
    const f = arquivo;
    setLendo(true);
    setErroLeitura(null);
    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      fd.set("empresa", String(empresa));
      fd.set("conta", String(conta));
      if (senha) fd.set("senha", senha);
      const p = await enviarArquivo<Previa>("/api/contabil/extrato-importar", fd);
      setPrevia(p);
      setAjustes({});
      setLidoDe(f);
      setFiltro("todos");
      setBusca("");
      setDetalhe(null);
      avisar.ok(
        `${num(p.resumo.total)} transações lidas`,
        p.resumo.prontos ? `${num(p.resumo.prontos)} já casaram com as regras` : undefined
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
   * Reaplica as regras nas transações já lidas, sem pedir o arquivo de novo: é
   * o caminho depois de cadastrar o que faltava. Quem é o favorecido na folha
   * não muda com regra, e o casamento da folha vive no servidor: o selo se
   * preserva pela posição da linha.
   */
  async function reaplicar() {
    if (!previa) return;
    setReaplicando(true);
    try {
      const url = `/api/contabil/extrato-regras?empresa=${empresa}&conta=${previa.contaBanco.conta}`;
      const banco = await buscarJson<ContaBanco>(url);
      qc.setQueryData(["extrato-regras", url], banco);
      const lidas: RegraExtrato[] = banco.regras.map((r) => ({
        id: r.id,
        termo: r.termo,
        termoOriginal: r.termoOriginal,
        tipo: r.tipo,
        contaPagamento: r.contaPagamento,
        contaRecebimento: r.contaRecebimento,
        historico: r.historico,
        ativo: r.ativo,
      }));
      // O sinal se perdeu no valor absoluto; volta pelo sentido.
      const transacoes = previa.lancamentos.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        complemento: l.complemento,
        valor: l.sentido === "recebimento" ? l.valor : -l.valor,
      }));
      const novos = gerarLancamentos(transacoes, previa.contaBanco.conta, lidas).map((l, i) => ({
        ...l,
        pessoa: previa.lancamentos[i]?.pessoa ?? null,
      }));
      // Ajuste à mão só vale em linha pendente. A linha que agora casou segue a
      // regra, e o ajuste dela sai; se a regra levou a outra conta, o recado diz
      // quantas, porque a troca seria silenciosa.
      const mantidos: Ajustes = {};
      let trocadas = 0;
      for (const [chave, valor] of Object.entries(ajustes)) {
        const i = Number(chave);
        const l = novos[i];
        if (!l) continue;
        if (l.pendencia) mantidos[i] = valor;
        else if (contrapartida(l, null) !== valor) trocadas++;
      }
      setPrevia({ ...previa, lancamentos: novos, resumo: resumir(novos, mantidos) });
      setAjustes(mantidos);
      avisar.ok(
        `Regras reaplicadas · ${num(resumir(novos, mantidos).prontos)} prontas`,
        trocadas
          ? `${num(trocadas)} ${trocadas === 1 ? "linha escolhida à mão passou" : "linhas escolhidas à mão passaram"} a seguir a regra`
          : undefined
      );
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setReaplicando(false);
    }
  }

  function ajustar(i: number, c: number | null) {
    const novos = { ...ajustes };
    if (c == null) delete novos[i];
    else novos[i] = c;
    setAjustes(novos);
  }

  async function gerar() {
    if (!previa || !prontos.length) return;
    setGerando(true);
    try {
      const r = await mutar<{ arquivo: string; linhas: number; total: number }>("/api/contabil/conciliacao-gerar", "POST", {
        empresa,
        estab: estabEfetivo,
        lancamentos: prontos,
      });
      baixarArquivo(`conciliacao_${empresa}_${previa.contaBanco.conta}.csv`, r.arquivo, "text/csv;charset=utf-8");
      avisar.ok(`${num(r.linhas)} lançamentos exportados`, `Total de ${brl(r.total)}`);
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  function novaRegra(i: number) {
    const l = lancamentos[i];
    if (!l) return;
    const ajuste = ajustes[i] ?? null;
    setDetalhe(null);
    setJanela({
      // Com complemento, o termo nasce dele: pelo histórico, a regra levaria
      // toda transferência do extrato para a conta desta linha, calada. Termo
      // específico demais só deixa linha pendente, e isso aparece.
      inicial: {
        termo: l.complemento ? termoDoComplemento(l.complemento) : termoDaDescricao(l.descricao),
        tipo: "parcial",
        contaPagamento: l.sentido === "pagamento" ? ajuste : null,
        contaRecebimento: l.sentido === "recebimento" ? ajuste : null,
      },
      linha: { descricao: l.descricao, complemento: l.complemento },
    });
  }

  const proximaPendente = (de: number): number | null => {
    const n = lancamentos.length;
    for (let d = 1; d < n; d++) {
      const j = (de + d) % n;
      if (pendenteDe(lancamentos[j], ajustes[j])) return j;
    }
    return null;
  };

  const descrContra = (l: LancamentoGerado) => {
    const r = l.regraId != null ? porRegra.get(l.regraId) : undefined;
    return l.sentido === "pagamento" ? r?.descrPagamento : r?.descrRecebimento;
  };

  const colunas: Coluna<Linha>[] = [
    {
      id: "data",
      cabecalho: "Data",
      largura: "96px",
      ordenar: ({ l }) => l.data,
      celula: ({ l }) => <span className="num">{dataBR(l.data)}</span>,
    },
    {
      id: "descricao",
      cabecalho: "Descrição no extrato",
      ordenar: ({ l }) => l.descricao,
      celula: ({ l, i }) => {
        const ajuste = ajustes[i] ?? null;
        const s = situacaoLancamento(l, ajuste);
        return (
          <DescricaoExtrato descricao={l.descricao} complemento={l.complemento}>
            {l.pendencia && <Selo tom={s.tom}>{s.rotulo}</Selo>}
            {l.ambiguo && (
              <Selo tom="atencao" title="Outra regra casa com a mesma força">
                Regra empatada
              </Selo>
            )}
            {l.pessoa && <SeloFolha selo={l.pessoa} />}
          </DescricaoExtrato>
        );
      },
    },
    {
      id: "contra",
      cabecalho: "Contrapartida",
      largura: "360px",
      ordenar: ({ l, i }) => contrapartida(l, ajustes[i] ?? null),
      celula: ({ l, i }) =>
        l.pendencia ? (
          <div className="flex min-w-0 items-center gap-1" onClick={parar} onKeyDown={parar}>
            <SeletorConta
              empresa={empresa}
              valor={ajustes[i] ?? null}
              onMudar={(c) => ajustar(i, c)}
              limpavel
              placeholder="Escolher conta"
              rotuloAcessivel={`Contrapartida de ${l.descricao}`}
              className="min-w-0 flex-1"
            />
            {ajustes[i] != null && (
              <BotaoIcone linha icone="aprender" rotulo="Criar regra com esta descrição" onClick={() => novaRegra(i)} />
            )}
          </div>
        ) : (
          <ContaTexto conta={contrapartida(l, null)} descricao={descrContra(l)} />
        ),
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "150px",
      ordenar: ({ l }) => (l.sentido === "recebimento" ? l.valor : -l.valor),
      celula: ({ l }) => (
        <span className={cn("font-[600]", l.sentido === "recebimento" ? "text-ok" : "text-tinta")}>
          {l.sentido === "recebimento" ? "+" : "−"} {brl(l.valor)}
        </span>
      ),
    },
  ];

  const aberto = detalhe != null ? lancamentos[detalhe] : undefined;
  const proxima = detalhe != null ? proximaPendente(detalhe) : null;

  return (
    <>
      {previa && (
        <AcoesPagina>
          <MenuExportar
            modulo="contabil"
            cortes={[
              {
                id: "lancamentos",
                rotulo: "Lançamentos",
                nome: `extrato_${empresa}_${previa.contaBanco.conta}`,
                montar: () => ({
                  cabecalhos: [
                    "Data",
                    "Descrição no extrato",
                    "Complemento",
                    "Sentido",
                    "Débito",
                    "Crédito",
                    "Valor",
                    "Histórico",
                    "Situação",
                    "Favorecido na folha",
                  ],
                  linhas: visiveis.map(({ l, i }) => {
                    const ajuste = ajustes[i] ?? null;
                    const p = partida(l, ajuste);
                    return [
                      dataBR(l.data),
                      l.descricao,
                      l.complemento ?? "",
                      l.sentido === "recebimento" ? "Recebimento" : "Pagamento",
                      p.debito,
                      p.credito,
                      decimalBR(l.valor),
                      l.historico,
                      situacaoLancamento(l, ajuste).rotulo,
                      l.pessoa?.nome ?? "",
                    ];
                  }),
                }),
              },
            ]}
          />
        </AcoesPagina>
      )}

      <Painel corpo="flex flex-col gap-3">
        <Rotulado rotulo="Conta do banco" className="w-full sm:max-w-[420px]">
          <SeletorConta
            empresa={empresa}
            soBanco
            valor={conta}
            onMudar={(c) => setConta(c)}
            placeholder="Conta do banco no plano"
            rotuloAcessivel="Conta do banco"
          />
        </Rotulado>
        <EnvioArquivo
          aceita=".ofx,.qfx,.pdf"
          arquivo={arquivo}
          lido={leituraEmDia}
          lendo={lendo}
          onArquivo={escolherArquivo}
          onLer={ler}
          rotuloLer="Ler extrato"
          bloqueio={conta == null ? "Escolha a conta do banco para ler" : null}
          titulo="Solte o extrato do banco"
          descricao="OFX ou PDF da conta escolhida acima"
          icone="banco"
          senha={{ protegido, valor: senha, onMudar: setSenha }}
        />
        {previa && conta != null && contaPrevia !== conta && (
          <Nota tom="atencao" icone="alerta">
            A prévia abaixo é da conta {contaPrevia}
            {previa.contaBanco.descricao ? ` · ${previa.contaBanco.descricao}` : ""}. Leia de novo para usar a conta
            escolhida.
          </Nota>
        )}
      </Painel>

      {erroLeitura && (
        <PainelErro titulo="Não deu para ler o extrato" mensagem={erroLeitura} onTentar={arquivo ? ler : undefined} />
      )}

      {!previa && lendo && (
        <>
          <FaixaIndicadores>
            <Indicador rotulo="Transações lidas" valor="" carregando />
            <Indicador rotulo="Prontas para lançar" valor="" carregando />
            <Indicador rotulo="Pendentes" valor="" carregando />
            <Indicador rotulo="Entradas" valor="" carregando />
            <Indicador rotulo="Saídas" valor="" carregando />
          </FaixaIndicadores>
          <Painel corpo="p-0" titulo="Lançamentos">
            <EsqueletoTabela colunas={4} />
          </Painel>
        </>
      )}

      {previa && (
        <>
          <FaixaIndicadores>
            <Indicador
              rotulo="Transações lidas"
              icone="nota"
              valor={num(resumo.total)}
              detalhe={
                previa.inicio && previa.fim
                  ? `${dataBR(previa.inicio)} a ${dataBR(previa.fim)}`
                  : (previa.banco ?? previa.arquivo)
              }
              onClick={() => setFiltro("todos")}
            />
            <Indicador
              rotulo="Prontas para lançar"
              icone="ok"
              valor={num(resumo.prontos)}
              detalhe={`${pct(resumo.total ? (resumo.prontos / resumo.total) * 100 : 0)} do extrato`}
              onClick={() => setFiltro("prontos")}
            />
            <Indicador
              rotulo="Pendentes"
              icone="pendente"
              valor={num(pendentes)}
              tom={pendentes ? "atencao" : "neutro"}
              valorNoTom={pendentes > 0}
              detalhe={
                resumo.semConta
                  ? `${num(resumo.semConta)} com regra sem conta no sentido`
                  : pendentes
                    ? "descrições sem regra"
                    : "nada a resolver"
              }
              onClick={() => setFiltro("pendentes")}
            />
            <Indicador
              rotulo="Entradas"
              icone="tendencia"
              valor={brl(resumo.entradas)}
              detalhe={`${num(lancamentos.filter((l) => l.sentido === "recebimento").length)} recebimentos`}
            />
            <Indicador
              rotulo="Saídas"
              icone="tendencia-baixa"
              valor={brl(Math.abs(resumo.saidas))}
              detalhe={`${num(lancamentos.filter((l) => l.sentido === "pagamento").length)} pagamentos`}
            />
            {comPessoa > 0 && (
              <Indicador
                rotulo="Favorecidos na folha"
                icone="pessoas"
                valor={num(comPessoa)}
                detalhe={pessoasEmDuvida ? `${num(pessoasEmDuvida)} a confirmar` : "casados pelo CPF ou nome"}
                onClick={() => setFiltro("pessoas")}
              />
            )}
          </FaixaIndicadores>

          {previa.saldoConfere !== null &&
            (previa.saldoConfere ? (
              <Nota icone="escudo" className="px-1">
                Os saldos do extrato fecham do início ao fim.
              </Nota>
            ) : (
              <Nota tom="atencao" icone="alerta" className="px-1">
                Os saldos do extrato não fecham. Pode haver linha que a leitura não pegou: confira antes de gerar.
              </Nota>
            ))}

          <Painel
            corpo="p-0"
            titulo="Lançamentos"
            descricao={
              [previa.banco, previa.agencia && `ag. ${previa.agencia}`, previa.conta && `c/c ${previa.conta}`]
                .filter(Boolean)
                .join(" · ") || undefined
            }
            acoes={
              <>
                <Botao variante="fantasma" icone="atualizar" carregando={reaplicando} onClick={reaplicar}>
                  Reaplicar regras
                </Botao>
                <Campo
                  icone="buscar"
                  placeholder="Descrição ou conta"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  classeCaixa="w-52"
                  aria-label="Buscar no extrato"
                />
                <Segmentado<Filtro>
                  rotulo="Situação"
                  valor={filtro}
                  onMudar={setFiltro}
                  opcoes={[
                    { valor: "todos", rotulo: "Todos" },
                    { valor: "prontos", rotulo: "Prontos" },
                    { valor: "pendentes", rotulo: `Pendentes ${num(pendentes)}` },
                    ...(comPessoa ? [{ valor: "pessoas" as const, rotulo: `Funcionários ${num(comPessoa)}` }] : []),
                  ]}
                />
              </>
            }
          >
            <TabelaDados
              rotulo="Lançamentos do extrato"
              colunas={colunas}
              linhas={visiveis}
              chave={({ i }) => String(i)}
              onLinha={({ i }) => setDetalhe(i)}
              selecionada={({ i }) => i === detalhe}
              alturaMax="min(68dvh, 720px)"
              vazio={
                filtro === "pendentes" && !busca ? (
                  <Vazio compacto icone="ok" titulo="Nada pendente" descricao="Todas as linhas têm contrapartida." />
                ) : (
                  <Vazio
                    compacto
                    icone="filtrar"
                    titulo="Nenhuma linha neste filtro"
                    descricao={busca ? "Afrouxe a busca ou volte para Todos." : "Volte para Todos."}
                  />
                )
              }
            />
          </Painel>

          <RodapeGeracao
            estado={!prontos.length ? "perigo" : pendentes ? "atencao" : "ok"}
            mensagem={
              !prontos.length
                ? "Nenhum lançamento pronto. Escolha a contrapartida das pendentes."
                : `${num(prontos.length)} ${prontos.length === 1 ? "lançamento vai" : "lançamentos vão"} para o arquivo${
                    pendentes ? ` · ${num(pendentes)} ${pendentes === 1 ? "pendente fica" : "pendentes ficam"} de fora` : ""
                  }`
            }
          >
            <span className="text-pequeno text-apagado">Filial</span>
            {filiais.data?.length ? (
              <Combo
                className="w-56"
                rotuloAcessivel="Filial do arquivo"
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
                className="w-16 text-center"
                inputMode="numeric"
                aria-label="Filial do arquivo"
                value={String(estabEfetivo)}
                onChange={(e) => setEstab(Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || null)}
              />
            )}
            <Botao
              variante={leituraEmDia ? "primario" : "secundario"}
              icone="baixar"
              carregando={gerando}
              disabled={!prontos.length}
              onClick={gerar}
            >
              Gerar CSV do Questor
            </Botao>
          </RodapeGeracao>
        </>
      )}

      {aberto && detalhe != null && previa && (
        <LancamentoModal
          lancamento={aberto}
          ajuste={ajustes[detalhe] ?? null}
          regra={aberto.regraId != null ? porRegra.get(aberto.regraId) : undefined}
          empresa={empresa}
          banco={{ conta: previa.contaBanco.conta, descricao: previa.contaBanco.descricao }}
          onAjustar={(c) => ajustar(detalhe, c)}
          onCriarRegra={() => novaRegra(detalhe)}
          onEditarRegra={(regra) => {
            setDetalhe(null);
            setJanela({ regra });
          }}
          onProxima={proxima != null ? () => setDetalhe(proxima) : undefined}
          onFechar={() => setDetalhe(null)}
        />
      )}

      {previa && (
        <RegraExtratoModal
          aberto={janela != null}
          empresa={empresa}
          conta={previa.contaBanco.conta}
          descricaoConta={previa.contaBanco.descricao}
          regra={janela?.regra}
          inicial={janela?.inicial}
          linha={janela?.linha}
          amostra={amostra}
          onFechar={() => setJanela(null)}
          // Regra nova ou mudada vale na hora para o extrato na tela: é para isso
          // que ela foi criada daqui.
          onSalvo={reaplicar}
          onApagado={reaplicar}
        />
      )}
    </>
  );
}
