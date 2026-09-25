"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { DataComPrazo, emDiasTexto } from "@/componentes/produto/folha/prazo-dp";
import { ModalConfigRescisoes } from "@/componentes/produto/folha/rescisao-config";
import { invalidarRescisoes, ModalPagamentoRescisao } from "@/componentes/produto/folha/rescisao-pagamento";
import {
  CorpoRescisao,
  ROTULO_RESCISAO,
  SeloRescisao,
  SinalQuestor,
  textoSinalQuestor,
} from "@/componentes/produto/folha/rescisao-situacao";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { dataBR, num } from "@/lib/format";
import type { RescisaoItem, RescisoesResumo } from "@/lib/rescisoes-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

/** Teto de linhas desenhadas: sem o filtro de pendentes, um ano do escritório passa de mil. */
const MAX_LINHAS = 500;

const chaveDe = (i: RescisaoItem) => `${i.codigoempresa}:${i.contrato}`;

/** Botão de decisão dentro da linha: a altura da linha (26px), não a do controle. */
function BotaoLinha({
  icone,
  rotulo,
  variante = "fantasma",
  carregando,
  onClick,
}: {
  icone: "certo" | "reabrir";
  rotulo: string;
  variante?: "secundario" | "fantasma";
  carregando?: boolean;
  onClick: () => void;
}) {
  return (
    <Botao
      variante={variante}
      icone={icone}
      carregando={carregando}
      onClick={onClick}
      className="h-controle-p rounded-chip px-2 text-pequeno"
    >
      {rotulo}
    </Botao>
  );
}

/**
 * Rescisões a pagar: os desligamentos do período com o prazo de pagamento
 * (CLT art. 477), o que já foi marcado como pago e quem recebe os avisos. É o
 * retrato do escritório: empresa ou grupo no topo recorta, mas não é exigido.
 *
 * O prazo é contado até o FIM do período executado, não até hoje: o mesmo
 * recorte dá a mesma fila amanhã, e os painéis mandam o link com o fim = hoje.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const qc = useQueryClient();
  const [soPendentes, setSoPendentes] = useEstadoTela("so-pendentes", true);
  const [configAberta, setConfigAberta] = useState(false);
  const [pagando, setPagando] = useState<RescisaoItem | null>(null);
  const [abertaChave, setAbertaChave] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState<string | null>(null);

  const url = qs ? `/api/folha/rescisoes?${qs}` : null;
  const res = useConsulta<RescisoesResumo>("folha-rescisoes", url);
  const d = res.data;

  // A coluna da empresa sai quando o recorte EXECUTADO é uma empresa só: com
  // ela, repetiria o mesmo nome em toda linha. Lê a query executada, e não o
  // topo, porque é dela que a fila na tela veio.
  const p = new URLSearchParams(qs ?? "");
  const empresasDoRecorte = (p.get("empresas") ?? "").split(",").filter(Boolean);
  const comEmpresa = empresasDoRecorte.length !== 1;
  const recortado = empresasDoRecorte.length > 0 || p.has("grupos");

  const linhas = useMemo(
    () => (d ? (soPendentes ? d.itens.filter((i) => i.situacao !== "resolvida") : d.itens) : []),
    [d, soPendentes]
  );
  const visiveis = linhas.slice(0, MAX_LINHAS);
  // Lida da fila atual: depois de marcar ou reabrir, o detalhe mostra o estado novo.
  const aberta = abertaChave ? (d?.itens.find((i) => chaveDe(i) === abertaChave) ?? null) : null;

  async function reabrir(i: RescisaoItem) {
    setReabrindo(chaveDe(i));
    try {
      await mutar("/api/folha/rescisoes/resolver", "DELETE", {
        codigoempresa: i.codigoempresa,
        codigofunccontr: i.contrato,
      });
      await invalidarRescisoes(qc);
      avisar.ok("Rescisão reaberta", i.funcionario);
    } catch (e) {
      avisar.erro("Não deu para reabrir", (e as Error).message);
    } finally {
      setReabrindo(null);
    }
  }

  const acaoDaLinha = (i: RescisaoItem) =>
    i.situacao === "resolvida" ? (
      <BotaoLinha icone="reabrir" rotulo="Reabrir" carregando={reabrindo === chaveDe(i)} onClick={() => reabrir(i)} />
    ) : (
      <BotaoLinha icone="certo" rotulo="Marcar como paga" variante="secundario" onClick={() => setPagando(i)} />
    );

  const colunas: Coluna<RescisaoItem>[] = [
    ...(comEmpresa
      ? [
          {
            id: "empresa",
            cabecalho: "Empresa",
            largura: "28%",
            ordenar: (i: RescisaoItem) => i.empresa,
            celula: (i: RescisaoItem) => (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate" title={i.empresa}>
                  {i.empresa}
                </span>
                <span className="num shrink-0 text-pequeno text-apagado">{i.codigoempresa}</span>
              </span>
            ),
          },
        ]
      : []),
    {
      id: "funcionario",
      cabecalho: "Funcionário",
      largura: comEmpresa ? "28%" : "40%",
      ordenar: (i) => i.funcionario,
      celula: (i) => (
        <span className="block truncate font-[560] text-tinta" title={i.funcionario}>
          {i.funcionario}
        </span>
      ),
    },
    {
      id: "desligamento",
      cabecalho: "Desligamento",
      ordenar: (i) => i.dataDesligamento,
      celula: (i) => <span className="num">{dataBR(i.dataDesligamento)}</span>,
    },
    {
      id: "prazo",
      cabecalho: "Prazo",
      ordenar: (i) => i.prazo,
      celula: (i) => <DataComPrazo data={i.prazo} dias={i.diasParaPrazo} />,
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      celula: (i) => <SeloRescisao item={i} />,
    },
    {
      id: "questor",
      cabecalho: "No Questor",
      secundaria: true,
      celula: (i) => <SinalQuestor item={i} />,
    },
    {
      id: "acao",
      cabecalho: <span className="sr-only">Ação</span>,
      alinhar: "dir",
      celula: (i) => (
        // O botão decide ali mesmo: o clique (e o Enter) não vaza para a linha.
        <div
          className="flex justify-end"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {acaoDaLinha(i)}
        </div>
      ),
    },
  ];

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar as rescisões"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.total === 0)
    vazio = (
      <Vazio
        icone="recibo"
        titulo="Nenhum desligamento no período"
        descricao={
          recortado ? "Amplie o período ou tire o filtro de empresa no topo." : "Amplie o período no topo."
        }
      />
    );
  else if (d && soPendentes)
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Nenhuma rescisão pendente"
        descricao={
          d.resolvidas === 1
            ? "A rescisão do período já foi marcada como paga."
            : `As ${num(d.resolvidas)} rescisões do período já foram marcadas como pagas.`
        }
        acao={<Botao onClick={() => setSoPendentes(false)}>Ver as pagas</Botao>}
      />
    );

  const inicio = p.get("inicio") ?? "";
  const fim = p.get("fim") ?? "";

  return (
    <>
      <AcoesPagina>
        <Botao icone="engrenagem" onClick={() => setConfigAberta(true)}>
          Prazo e avisos
        </Botao>
        <MenuExportar
          modulo="folha"
          desabilitado={!d}
          cortes={[
            {
              id: "rescisoes",
              rotulo: "Rescisões",
              nome: `rescisoes-${soPendentes ? "pendentes" : "todas"}-${inicio}_${fim}`,
              montar: () => ({
                cabecalhos: [
                  "Código da empresa",
                  "Empresa",
                  "Contrato",
                  "Funcionário",
                  "Desligamento",
                  "Motivo",
                  "Aviso prévio",
                  "Prazo",
                  "Dias para o prazo",
                  "Situação",
                  "No Questor",
                  "Paga em",
                  "Observação",
                ],
                linhas: linhas.map((i) => [
                  i.codigoempresa,
                  i.empresa,
                  i.contrato,
                  i.funcionario,
                  dataBR(i.dataDesligamento),
                  i.causa ?? "",
                  i.dataAviso ? dataBR(i.dataAviso) : "",
                  dataBR(i.prazo),
                  i.diasParaPrazo,
                  ROTULO_RESCISAO[i.situacao],
                  textoSinalQuestor(i),
                  i.resolvidaEm ? dataBR(i.resolvidaEm) : "",
                  i.observacao ?? "",
                ]),
              }),
            },
          ]}
        />
      </AcoesPagina>

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Pendentes"
          icone="recibo"
          carregando={!d}
          valor={num(d?.pendentes ?? 0)}
          detalhe={d ? `De ${num(d.total)} ${d.total === 1 ? "desligamento" : "desligamentos"} no período` : ""}
        />
        <Indicador
          rotulo="Vencidas"
          icone="alerta"
          carregando={!d}
          valor={num(d?.vencidas ?? 0)}
          detalhe={d ? `Passaram dos ${emDiasTexto(d.prazoDias)} de prazo` : ""}
          tom={d && d.vencidas > 0 ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Vencem em breve"
          icone="relogio"
          carregando={!d}
          valor={num(d?.venceBreve ?? 0)}
          detalhe={d ? `A ${emDiasTexto(d.diasAntes)} ou menos do prazo` : ""}
          tom={d && d.venceBreve > 0 ? "atencao" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Pagas"
          icone="ok"
          carregando={!d}
          valor={num(d?.resolvidas ?? 0)}
          detalhe="Marcadas como pagas pelo DP"
        />
      </FaixaIndicadores>

      {d && (
        <div className="flex flex-col gap-1">
          <Nota>
            Prazo de {emDiasTexto(d.prazoDias)} após o desligamento, contado até {dataBR(d.referencia)}. Só empregados
            CLT, sem as transferências.
          </Nota>
          <Nota>Só a marcação de paga tira a rescisão da fila. Confira o pagamento no Questor antes de marcar.</Nota>
        </div>
      )}

      <Painel
        corpo="p-0"
        titulo="Rescisões do Período"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Vencidas e mais perto do prazo primeiro
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={<Alternador ligado={soPendentes} onMudar={setSoPendentes} rotulo="Só pendentes" />}
        rodape={
          linhas.length > MAX_LINHAS ? (
            <Nota>
              Mostrando {num(MAX_LINHAS)} de {num(linhas.length)}. Exporte para ver a fila inteira.
            </Nota>
          ) : undefined
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={comEmpresa ? 7 : 6} />
        ) : (
          <TabelaDados
            rotulo="Rescisões do período"
            colunas={colunas}
            linhas={visiveis}
            chave={chaveDe}
            onLinha={(i) => setAbertaChave(chaveDe(i))}
            selecionada={(i) => chaveDe(i) === abertaChave}
            alturaMax="62vh"
            vazio={vazio}
          />
        )}
      </Painel>

      <Modal
        aberto={aberta != null}
        onFechar={() => setAbertaChave(null)}
        titulo={aberta?.funcionario ?? ""}
        descricao="Rescisão"
        rodape={
          aberta && (
            <>
              <Botao variante="fantasma" onClick={() => setAbertaChave(null)}>
                Fechar
              </Botao>
              {aberta.situacao === "resolvida" ? (
                <Botao icone="reabrir" carregando={reabrindo === chaveDe(aberta)} onClick={() => reabrir(aberta)}>
                  Reabrir
                </Botao>
              ) : (
                <Botao
                  variante="primario"
                  icone="certo"
                  onClick={() => {
                    setPagando(aberta);
                    setAbertaChave(null);
                  }}
                >
                  Marcar como paga
                </Botao>
              )}
            </>
          )
        }
      >
        {aberta && <CorpoRescisao item={aberta} />}
      </Modal>

      <ModalPagamentoRescisao item={pagando} onFechar={() => setPagando(null)} />
      <ModalConfigRescisoes aberto={configAberta} onFechar={() => setConfigAberta(false)} />
    </>
  );
}
