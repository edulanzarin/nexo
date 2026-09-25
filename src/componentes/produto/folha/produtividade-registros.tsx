"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import { infoDoTipo, type DpLinha, type DpTipo, type EsocialStatus } from "@/lib/dp-tipos";

/*
 * Os registros por trás do número de um trabalho do DP: uma linha por
 * registro, com a pessoa do DP que fez, a empresa, o funcionário (ou o evento,
 * quando a fonte não tem contrato) e quando. A rota `dp-lista` existia no
 * nexo2 sem nenhuma tela; no NaveX ela é o detalhe da aba de família.
 */

/** Chave da consulta, para a exportação reaproveitar o que o modal já trouxe. */
export const CHAVE_REGISTROS = "folha-dp-lista";

/** O teto que `montarListaDp` aplica: passado dele, a lista corta nos mais recentes. */
export const LIMITE_REGISTROS = 1000;

export function urlRegistros(qs: string, tipo: DpTipo, usuario: number | null): string {
  return `/api/folha/dp-lista?${qs}&tipo=${tipo}${usuario != null ? `&usuario=${usuario}` : ""}`;
}

/**
 * O usuário 0 do Questor é a rotina automática. No ranking ele já chega como
 * "Sistema (automático)"; aqui chega com o nome cru da tabela de usuários, e a
 * mesma coisa não pode ter dois nomes na mesma tela.
 */
const nomePessoa = (l: DpLinha) => (l.codigousuario === 0 ? "Sistema (automático)" : l.usuario);

const ESOCIAL: Record<EsocialStatus, { rotulo: string; tom: Tom }> = {
  ok: { rotulo: "Transmitida", tom: "ok" },
  pendente: { rotulo: "Pendente", tom: "atencao" },
  nao_enviado: { rotulo: "Não enviada", tom: "neutro" },
};

function texto(valor: string | null | undefined): ReactNode {
  return valor ? (
    <span className="block truncate" title={valor}>
      {valor}
    </span>
  ) : (
    "—"
  );
}

function colunaData(id: string, cabecalho: string, ler: (l: DpLinha) => string | null | undefined): Coluna<DpLinha> {
  return {
    id,
    cabecalho,
    largura: "104px",
    classe: "num",
    celula: (l) => dataBR(ler(l)),
    ordenar: (l) => ler(l) ?? "",
  };
}

/**
 * As colunas de um trabalho. As comuns (pessoa, empresa, alvo, quando) valem
 * para os doze; as próprias só onde a fonte tem o campo. Nome e empresa em
 * porcentagem para truncar: são as colunas longas, e sem isso a data do fim
 * sai da tela.
 */
export function colunasRegistros(tipo: DpTipo): Coluna<DpLinha>[] {
  const info = infoDoTipo(tipo);
  const comuns: Coluna<DpLinha>[] = [
    {
      id: "pessoa",
      cabecalho: "Pessoa do DP",
      largura: "18%",
      celula: (l) => texto(nomePessoa(l)),
      ordenar: nomePessoa,
    },
    {
      id: "empresa",
      cabecalho: "Empresa",
      largura: "26%",
      celula: (l) => (
        <span className="flex min-w-0 items-baseline gap-1.5" title={l.empresa}>
          <span className="num shrink-0 text-pequeno text-apagado">{l.codigoempresa}</span>
          <span className="truncate">{l.empresa}</span>
        </span>
      ),
      ordenar: (l) => l.empresa,
    },
    info.porContrato
      ? {
          id: "funcionario",
          cabecalho: "Funcionário",
          largura: "22%",
          celula: (l) => texto(l.funcionario),
          ordenar: (l) => l.funcionario,
        }
      : { id: "evento", cabecalho: "Evento", celula: (l) => l.evento ?? "—", ordenar: (l) => l.evento ?? "" },
  ];

  let proprias: Coluna<DpLinha>[] = [];
  if (tipo === "avisos" || tipo === "rescisoes")
    proprias = [
      { id: "causa", cabecalho: "Causa", largura: "16%", celula: (l) => texto(l.causa), ordenar: (l) => l.causa ?? "" },
      colunaData("aviso", "Aviso", (l) => l.dataAviso),
      colunaData("rescisao", "Rescisão", (l) => l.dataResc),
    ];
  else if (tipo === "admissoes")
    proprias = [
      colunaData("admissao", "Admissão", (l) => l.dataAdm),
      {
        id: "esocial",
        cabecalho: "eSocial",
        celula: (l) => {
          const s = ESOCIAL[l.esocial ?? "nao_enviado"];
          return <Selo tom={s.tom}>{s.rotulo}</Selo>;
        },
        ordenar: (l) => ESOCIAL[l.esocial ?? "nao_enviado"].rotulo,
      },
      { id: "origem", cabecalho: "Origem", celula: (l) => l.origem ?? "—", ordenar: (l) => l.origem ?? "", secundaria: true },
    ];
  else if (tipo === "ferias")
    proprias = [
      {
        id: "gozo",
        cabecalho: "Gozo",
        classe: "num",
        celula: (l) => `${dataBR(l.inicioFerias)} a ${dataBR(l.fimFerias)}`,
        ordenar: (l) => l.inicioFerias ?? "",
      },
      colunaData("aquisitivo", "Aquisitivo desde", (l) => l.periodoAquisitivo),
      colunaData("pagamento", "Pagamento", (l) => l.dataPgto),
    ];

  return [
    ...comuns,
    ...proprias,
    {
      id: "quando",
      cabecalho: "Registrado em",
      largura: "136px",
      classe: "num text-apagado",
      celula: (l) => dataHoraBR(l.quando),
      ordenar: (l) => l.quando,
    },
  ];
}

/** Os registros como planilha, com as mesmas colunas da tabela e os códigos junto. */
export function tabelaRegistros(tipo: DpTipo, linhas: DpLinha[]) {
  const info = infoDoTipo(tipo);
  const proprias: { cabecalho: string; valor: (l: DpLinha) => string }[] =
    tipo === "avisos" || tipo === "rescisoes"
      ? [
          { cabecalho: "Causa", valor: (l) => l.causa ?? "" },
          { cabecalho: "Data do aviso", valor: (l) => (l.dataAviso ? dataBR(l.dataAviso) : "") },
          { cabecalho: "Data da rescisão", valor: (l) => (l.dataResc ? dataBR(l.dataResc) : "") },
        ]
      : tipo === "admissoes"
        ? [
            { cabecalho: "Data de admissão", valor: (l) => (l.dataAdm ? dataBR(l.dataAdm) : "") },
            { cabecalho: "eSocial", valor: (l) => ESOCIAL[l.esocial ?? "nao_enviado"].rotulo },
            { cabecalho: "Origem", valor: (l) => l.origem ?? "" },
          ]
        : tipo === "ferias"
          ? [
              { cabecalho: "Início do gozo", valor: (l) => (l.inicioFerias ? dataBR(l.inicioFerias) : "") },
              { cabecalho: "Fim do gozo", valor: (l) => (l.fimFerias ? dataBR(l.fimFerias) : "") },
              { cabecalho: "Início do período aquisitivo", valor: (l) => (l.periodoAquisitivo ? dataBR(l.periodoAquisitivo) : "") },
              { cabecalho: "Pagamento", valor: (l) => (l.dataPgto ? dataBR(l.dataPgto) : "") },
            ]
          : [];
  return {
    cabecalhos: [
      "Código da pessoa",
      "Pessoa do DP",
      "Código da empresa",
      "Empresa",
      ...(info.porContrato ? ["Contrato", "Funcionário"] : ["Evento"]),
      ...proprias.map((p) => p.cabecalho),
      "Registrado em",
    ],
    linhas: linhas.map((l) => [
      l.codigousuario,
      nomePessoa(l),
      l.codigoempresa,
      l.empresa,
      ...(info.porContrato ? [l.contrato, l.funcionario] : [l.evento ?? ""]),
      ...proprias.map((p) => p.valor(l)),
      dataHoraBR(l.quando),
    ]),
  };
}

/**
 * O corpo do modal, sem busca de dado: o catálogo mostra o modal aberto com a
 * mesma peça. A busca filtra o que já veio (até mil linhas) e procura em
 * pessoa, empresa, funcionário, evento e causa.
 */
export function CorpoRegistros({
  tipo,
  linhas,
  erro,
  onTentar,
}: {
  tipo: DpTipo;
  /** `undefined` enquanto carrega. */
  linhas: DpLinha[] | undefined;
  erro?: string;
  onTentar?: () => void;
}) {
  const [busca, setBusca] = useState("");
  const colunas = useMemo(() => colunasRegistros(tipo), [tipo]);
  const porContrato = infoDoTipo(tipo).porContrato;

  const filtradas = useMemo(() => {
    const t = normalizar(busca.trim());
    if (!linhas || !t) return linhas;
    return linhas.filter((l) =>
      normalizar(
        [nomePessoa(l), l.empresa, String(l.codigoempresa), porContrato ? l.funcionario : "", l.evento ?? "", l.causa ?? ""].join(
          " "
        )
      ).includes(t)
    );
  }, [linhas, busca, porContrato]);

  if (erro) return <PainelErro mensagem={erro} onTentar={onTentar} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Campo
          icone="buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={porContrato ? "Buscar pessoa, empresa ou funcionário" : "Buscar pessoa, empresa ou evento"}
          aria-label="Buscar nos registros"
          classeCaixa="max-w-sm"
          disabled={!linhas?.length}
        />
        {linhas && filtradas && (
          <span className="num text-pequeno text-apagado">
            {filtradas.length === linhas.length
              ? `${num(linhas.length)} ${linhas.length === 1 ? "registro" : "registros"}`
              : `${num(filtradas.length)} de ${num(linhas.length)}`}
          </span>
        )}
      </div>

      {!linhas || !filtradas ? (
        <EsqueletoTabela linhas={8} colunas={Math.min(colunas.length, 6)} />
      ) : linhas.length === 0 ? (
        <Vazio
          compacto
          icone="tabela"
          titulo="Nenhum registro no período"
          descricao="Amplie o período ou tire o filtro de empresa no topo."
        />
      ) : (
        <TabelaDados
          colunas={colunas}
          linhas={filtradas}
          chave={(l, i) => `${l.codigoempresa}-${l.contrato}-${l.quando}-${i}`}
          alturaMax="560px"
          rotulo="Registros"
          vazio={
            <Vazio compacto icone="buscar" titulo="Nenhum registro com esse texto" descricao="Apague a busca para ver todos." />
          }
        />
      )}

      {linhas && linhas.length >= LIMITE_REGISTROS && (
        <Nota>
          Mostrando os {num(LIMITE_REGISTROS)} mais recentes. Para ver o resto, reduza o período ou escolha uma empresa no
          topo.
        </Nota>
      )}
    </div>
  );
}

/**
 * O modal "Registros" de um trabalho. Só consulta ao abrir: a lista custa uma
 * varredura por registro, e quase sempre quem olha a aba não precisa dela.
 *
 * Sem o dado anterior como provisório: trocar de trabalho mostraria as linhas
 * do anterior embaixo das colunas do novo.
 */
export function ModalRegistros({
  aberto,
  onFechar,
  tipo,
  url,
  descricao,
  arquivo,
}: {
  aberto: boolean;
  onFechar: () => void;
  tipo: DpTipo;
  url: string | null;
  descricao?: ReactNode;
  /** Nome do arquivo exportado, sem extensão. */
  arquivo: string;
}) {
  const consulta = useConsulta<DpLinha[]>(CHAVE_REGISTROS, aberto ? url : null, { manterAnterior: false });
  const linhas = consulta.data;
  const cortes = useMemo<CorteExportar[]>(
    () => (linhas ? [{ id: "registros", rotulo: "Registros", nome: arquivo, montar: () => tabelaRegistros(tipo, linhas) }] : []),
    [linhas, tipo, arquivo]
  );
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registros"
      descricao={descricao}
      largura="xg"
      rodape={
        <>
          <MenuExportar modulo="folha" cortes={cortes} desabilitado={!linhas?.length} />
          <Botao onClick={onFechar}>Fechar</Botao>
        </>
      }
    >
      <CorpoRegistros
        key={tipo}
        tipo={tipo}
        linhas={linhas}
        erro={consulta.isError ? (consulta.error as Error).message : undefined}
        onTentar={() => consulta.refetch()}
      />
    </Modal>
  );
}
