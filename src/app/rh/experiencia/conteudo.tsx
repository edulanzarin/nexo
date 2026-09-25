"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Esqueleto, EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { DataComPrazo, emDiasTexto } from "@/componentes/produto/folha/prazo-dp";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import {
  SeletorEmpresaRh,
  SeloEmpresaRh,
  empresasDoFiltroRh,
  type FiltroEmpresaRh,
} from "@/componentes/produto/rh/empresa-rh";
import {
  CHAVE_CONFIG_EXPERIENCIA,
  ModalConfigExperiencia,
  URL_CONFIG_EXPERIENCIA,
  type ConfigExperiencia,
} from "@/componentes/produto/rh/experiencia-config";
import { CorpoExperiencia, ehRespostaLegada, type RespostaExperiencia } from "@/componentes/produto/rh/experiencia-detalhe";
import { PreparoExperiencia, type PassoPreparo } from "@/componentes/produto/rh/experiencia-preparo";
import { GestoresSetor, SeloExperiencia, SeloMarco, SetorCargo } from "@/componentes/produto/rh/experiencia-situacao";
import { dataBR, hojeISO, num } from "@/lib/format";
import { nomeEmpresaRh } from "@/lib/rh";
import { MARCOS, STATUS_ROTULO, rotuloMarco } from "@/lib/rh-experiencia";
import type { ExperienciaItem } from "@/lib/rh-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { CHAVE_RESPOSTA, decisaoDoItem, urlResposta } from "./decisoes";

type Vista = "todas" | "decidir" | "respondidas";

const CHAVE_LISTA = "rh-experiencia";

/** Um marco de um contrato: a mesma pessoa aparece uma vez no de 45 e outra no de 90. */
const chaveDe = (i: ExperienciaItem) => `${i.codigoempresa}:${i.contrato}:${i.marco}`;

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

const SEM_EMAIL = "O servidor está sem e-mail configurado, e o envio ficou só no log.";

/** Botão de ação dentro da linha: a altura da linha (26px), não a do controle. */
function BotaoLinha({
  icone,
  rotulo,
  variante = "fantasma",
  carregando,
  desabilitado,
  onClick,
}: {
  icone: NomeIcone;
  rotulo: string;
  variante?: "secundario" | "fantasma";
  carregando?: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <Botao
      variante={variante}
      icone={icone}
      carregando={carregando}
      disabled={desabilitado}
      onClick={onClick}
      className="h-controle-p rounded-chip px-2 text-pequeno"
    >
      {rotulo}
    </Botao>
  );
}

/**
 * Experiência: os marcos de 45 e 90 dias de cada contrato em curso, o prazo de
 * cada um, quem recebe o formulário e a decisão dos gestores. A lista vem do
 * Questor (os contratos) casada com o banco do app (o que já saiu e voltou), e
 * carrega sozinha: são três empresas.
 *
 * A empresa recorta aqui mesmo, sem pedir de novo ao servidor: a lista inteira
 * já vem numa chamada, e é ela que dá a contagem ao lado de cada empresa.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const [empresa, setEmpresa] = useEstadoTela<FiltroEmpresaRh>("empresa", "todas");
  const [vista, setVista] = useEstadoTela<Vista>("vista", "todas");
  const [configAberta, setConfigAberta] = useState(false);
  const [abertaChave, setAbertaChave] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);

  const res = useConsulta<ExperienciaItem[]>(CHAVE_LISTA, "/api/rh/experiencia");
  const cfg = useConsulta<ConfigExperiencia>(CHAVE_CONFIG_EXPERIENCIA, URL_CONFIG_EXPERIENCIA);
  const todos = res.data;

  const daEmpresa = useMemo(() => {
    const empresas = empresasDoFiltroRh(empresa);
    return (todos ?? []).filter((i) => empresas.includes(i.codigoempresa));
  }, [todos, empresa]);

  // Pessoas (e não marcos) por empresa, para o seletor.
  const contagens = useMemo(() => {
    if (!todos) return undefined;
    const pessoas = new Map<number, Set<number>>();
    for (const i of todos) {
      const s = pessoas.get(i.codigoempresa) ?? new Set<number>();
      s.add(i.contrato);
      pessoas.set(i.codigoempresa, s);
    }
    return Object.fromEntries([...pessoas].map(([cod, s]) => [cod, s.size])) as Partial<Record<number, number>>;
  }, [todos]);

  // Contado como no Painel do RH, que lê a mesma montagem.
  const r = useMemo(() => {
    const abertos = daEmpresa.filter((i) => i.status !== "respondido");
    return {
      aDecidir: abertos.length,
      atraso: abertos.filter((i) => i.status === "atraso").length,
      semGestor: abertos.filter((i) => i.gestores === 0).length,
      respondidas: daEmpresa.length - abertos.length,
    };
  }, [daEmpresa]);

  const linhas = useMemo(
    () =>
      vista === "decidir"
        ? daEmpresa.filter((i) => i.status !== "respondido")
        : vista === "respondidas"
          ? daEmpresa.filter((i) => i.status === "respondido")
          : daEmpresa,
    [daEmpresa, vista]
  );

  const decisaoDe = decisaoDoItem;

  // Lido da lista atual: depois de enviar ou remover, o detalhe mostra o estado novo.
  const aberta = abertaChave ? (todos?.find((i) => chaveDe(i) === abertaChave) ?? null) : null;
  const pedeResposta = aberta?.status === "respondido" && aberta.id != null && !ehRespostaLegada(aberta);
  const resp = useConsulta<RespostaExperiencia>(
    CHAVE_RESPOSTA,
    pedeResposta && aberta?.id != null ? urlResposta(aberta.id) : null,
    { manterAnterior: false }
  );

  const marcoLigado = (i: ExperienciaItem) => !cfg.data || cfg.data.config.some((c) => c.marco === i.marco);
  const podeEnviar = (i: ExperienciaItem) => i.status !== "respondido" && i.gestores > 0 && marcoLigado(i);

  const recarregar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVE_LISTA] }),
      qc.invalidateQueries({ queryKey: ["rh-painel"] }),
    ]);

  function abrir(i: ExperienciaItem) {
    setConfirmando(false);
    setAbertaChave(chaveDe(i));
  }

  function fechar() {
    setAbertaChave(null);
    setConfirmando(false);
  }

  async function enviar(i: ExperienciaItem) {
    setEnviando(chaveDe(i));
    try {
      const resultado = await mutar<{ enviado: boolean; destinatarios: string[] }>(
        "/api/rh/experiencia-reenviar",
        "POST",
        { codigoempresa: i.codigoempresa, contrato: i.contrato, marco: i.marco }
      );
      await recarregar();
      if (resultado.enviado)
        avisar.ok(
          `Formulário enviado a ${plural(resultado.destinatarios.length, "gestor", "gestores")}`,
          `${i.nome}, marco de ${rotuloMarco(i.marco)}`
        );
      else avisar.info("Envio registrado", SEM_EMAIL);
    } catch (e) {
      avisar.erro("Não deu para enviar o formulário", (e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  async function remover(i: ExperienciaItem) {
    if (i.id == null) return;
    setRemovendo(true);
    try {
      await mutar(`/api/rh/experiencia?id=${i.id}`, "DELETE");
      await recarregar();
      avisar.ok("Avaliação removida", `${i.nome}, marco de ${rotuloMarco(i.marco)}`);
      fechar();
    } catch (e) {
      avisar.erro("Não deu para remover", (e as Error).message);
    } finally {
      setRemovendo(false);
    }
  }

  const acaoDaLinha = (i: ExperienciaItem) =>
    i.status === "respondido" ? (
      <BotaoLinha icone="ver" rotulo="Ver respostas" onClick={() => abrir(i)} />
    ) : (
      <BotaoLinha
        icone="email"
        rotulo={i.ultimoLembrete ? "Reenviar" : "Enviar"}
        variante="secundario"
        carregando={enviando === chaveDe(i)}
        // Sem gestor ou sem formulário no marco a rota recusa; o motivo já está
        // na linha (Sem gestor) e no preparo (marco sem formulário).
        desabilitado={!podeEnviar(i)}
        onClick={() => enviar(i)}
      />
    );

  const celulaDecisao = (i: ExperienciaItem) => {
    if (i.status !== "respondido") return <span className="text-apagado">—</span>;
    const d = decisaoDe(i);
    if (d === undefined) return <Esqueleto className="h-3 w-16" />;
    if (d === null)
      return (
        <span className="text-apagado" title="O formulário não tem pergunta de decisão">
          —
        </span>
      );
    return (
      <span className="block truncate font-[560] text-tinta" title={d}>
        {d}
      </span>
    );
  };

  const colunas: Coluna<ExperienciaItem>[] = [
    {
      id: "nome",
      cabecalho: "Colaborador",
      largura: "24%",
      ordenar: (i) => i.nome,
      celula: (i) => (
        <span className="block truncate font-[560] text-tinta" title={i.nome}>
          {i.nome}
        </span>
      ),
    },
    // Com uma empresa escolhida, a coluna repetiria o mesmo nome em toda linha.
    ...(empresa === "todas"
      ? [
          {
            id: "empresa",
            cabecalho: "Empresa",
            secundaria: true,
            ordenar: (i: ExperienciaItem) => nomeEmpresaRh(i.codigoempresa),
            celula: (i: ExperienciaItem) => <SeloEmpresaRh codigo={i.codigoempresa} />,
          },
        ]
      : []),
    {
      id: "setor",
      cabecalho: "Setor e cargo",
      largura: "18%",
      ordenar: (i) => i.setor ?? "",
      celula: (i) => <SetorCargo setor={i.setor} cargo={i.cargo} />,
    },
    {
      id: "marco",
      cabecalho: "Marco",
      ordenar: (i) => i.marco,
      celula: (i) => <SeloMarco marco={i.marco} />,
    },
    {
      id: "vencimento",
      cabecalho: "Vencimento",
      ordenar: (i) => i.vencimento,
      // Respondido, o prazo não conta mais: fica só a data.
      celula: (i) => <DataComPrazo data={i.vencimento} dias={i.status === "respondido" ? null : i.diasParaVencer} />,
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      ordenar: (i) => STATUS_ROTULO[i.status],
      celula: (i) => <SeloExperiencia status={i.status} />,
    },
    {
      id: "gestores",
      cabecalho: "Quem recebe",
      ordenar: (i) => i.gestores,
      celula: (i) => <GestoresSetor n={i.gestores} />,
    },
    // O último envio fica no detalhe e no próprio botão (Enviar ou Reenviar):
    // coluna própria tirava do nome a largura que ele precisa.
    {
      id: "decisao",
      cabecalho: "Decisão",
      celula: celulaDecisao,
    },
    {
      id: "acao",
      cabecalho: <span className="sr-only">Ação</span>,
      alinhar: "dir",
      celula: (i) => (
        // O botão decide ali mesmo: o clique (e o Enter) não vaza para a linha.
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {acaoDaLinha(i)}
        </div>
      ),
    },
  ];

  // O preparo lê a configuração e a lista inteira (não a da empresa): os dois valem para todas.
  const configuracao = cfg.data;
  const passos: PassoPreparo[] | null =
    configuracao && todos
      ? [
          ...MARCOS.map((m) => {
            const c = configuracao.config.find((x) => x.marco === m);
            const nome = c ? configuracao.formularios.find((f) => f.id === c.formularioId)?.nome : undefined;
            const quando = c && (c.diasAntes === 0 ? "sai no dia do vencimento" : `sai ${emDiasTexto(c.diasAntes)} antes do vencimento`);
            return {
              chave: `marco-${m}`,
              feito: c != null,
              titulo: `Formulário do marco de ${rotuloMarco(m)}`,
              detalhe: c ? `${nome ?? "Formulário ligado"}, ${quando}` : "Nenhum ligado. O marco não sai para os gestores.",
              acao: (
                <Botao icone="engrenagem" onClick={() => setConfigAberta(true)}>
                  Configurar
                </Botao>
              ),
            };
          }),
          (() => {
            const pessoas = new Set(
              todos.filter((i) => i.status !== "respondido" && i.gestores === 0).map((i) => `${i.codigoempresa}:${i.contrato}`)
            ).size;
            return {
              chave: "gestores",
              feito: pessoas === 0,
              titulo: "Gestores dos setores",
              detalhe:
                pessoas === 0
                  ? "Todo setor com experiência em curso tem gestor."
                  : `${plural(pessoas, "pessoa em experiência está", "pessoas em experiência estão")} em setor sem gestor.`,
              acao: (
                <BotaoLink href="/rh/gestores" iconeFim="seta-direita">
                  Cadastrar gestores
                </BotaoLink>
              ),
            };
          })(),
        ]
      : null;

  let vazio: ReactNode;
  if (todos && todos.length === 0)
    vazio = (
      <Vazio
        icone="calendario"
        titulo="Ninguém em experiência agora"
        descricao="Quem for admitido nas empresas do RH aparece aqui, com os marcos de 45 e 90 dias."
      />
    );
  else if (daEmpresa.length === 0)
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo={`Ninguém em experiência na ${nomeEmpresaRh(Number(empresa))}`}
        descricao="As outras empresas do RH têm contratos em curso."
        acao={<Botao onClick={() => setEmpresa("todas")}>Ver todas as empresas</Botao>}
      />
    );
  else if (vista === "decidir")
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Nenhum marco a decidir"
        descricao="Todos os marcos em curso já têm a resposta dos gestores."
        acao={<Botao onClick={() => setVista("respondidas")}>Ver os respondidos</Botao>}
      />
    );
  else if (vista === "respondidas")
    vazio = (
      <Vazio
        compacto
        icone="pendente"
        titulo="Nenhum marco respondido ainda"
        descricao="A resposta dos gestores aparece aqui assim que chega."
        acao={<Botao onClick={() => setVista("todas")}>Ver todos</Botao>}
      />
    );

  const rotuloConta = (rotulo: string, n: number | undefined) => (
    <>
      {rotulo}
      {n != null && <span className="num text-apagado">{num(n)}</span>}
    </>
  );

  const nomeArquivo = `experiencia-${empresa === "todas" ? "todas" : nomeEmpresaRh(Number(empresa)).toLowerCase()}-${vista}-${hojeISO()}`;

  return (
    <>
      <AcoesPagina>
        <Botao icone="engrenagem" onClick={() => setConfigAberta(true)}>
          Configurar
        </Botao>
        <MenuExportar
          modulo="rh"
          desabilitado={!todos}
          cortes={[
            {
              id: "experiencia",
              rotulo: "Marcos de experiência",
              nome: nomeArquivo,
              montar: () => ({
                cabecalhos: [
                  "Empresa",
                  "Contrato",
                  "Colaborador",
                  "Cargo",
                  "Setor",
                  "Admissão",
                  "Marco",
                  "Vencimento",
                  "Dias para o vencimento",
                  "Situação",
                  "Gestores no setor",
                  "Último envio",
                  "Respondido por",
                  "Decisão",
                ],
                linhas: linhas.map((i) => [
                  nomeEmpresaRh(i.codigoempresa),
                  i.contrato,
                  i.nome,
                  i.cargo ?? "",
                  i.setor ?? "",
                  dataBR(i.dataadm),
                  rotuloMarco(i.marco),
                  dataBR(i.vencimento),
                  i.diasParaVencer,
                  STATUS_ROTULO[i.status],
                  i.gestores,
                  i.ultimoLembrete ? dataBR(i.ultimoLembrete) : "",
                  i.resposta?.respondidoPor ?? "",
                  decisaoDe(i) ?? "",
                ]),
              }),
            },
          ]}
        />
      </AcoesPagina>

      {res.isError ? (
        <PainelErro
          titulo="Não deu para carregar os contratos em experiência"
          mensagem={(res.error as Error).message}
          onTentar={() => res.refetch()}
        />
      ) : (
        <>
          <div className="max-w-full overflow-x-auto">
            <SeletorEmpresaRh valor={empresa} onMudar={setEmpresa} contagens={contagens} />
          </div>

          <FaixaIndicadores colunas={4}>
            <Indicador
              rotulo="A decidir"
              icone="calendario"
              carregando={!todos}
              valor={num(r.aDecidir)}
              detalhe="Marcos sem resposta dos gestores"
              // Nada a decidir é um estado bom, e acende verde.
              tom={todos && r.aDecidir === 0 ? "ok" : "neutro"}
              onClick={() => setVista("decidir")}
            />
            <Indicador
              rotulo="Em atraso"
              icone="alerta"
              carregando={!todos}
              valor={num(r.atraso)}
              detalhe="Venceram sem resposta"
              tom={r.atraso > 0 ? "perigo" : "neutro"}
              valorNoTom
              onClick={() => setVista("decidir")}
            />
            <Indicador
              rotulo="Sem gestor"
              icone="usuario"
              carregando={!todos}
              valor={num(r.semGestor)}
              detalhe="O formulário não sai para ninguém"
              tom={r.semGestor > 0 ? "atencao" : "neutro"}
              valorNoTom
              href={r.semGestor > 0 ? "/rh/gestores" : undefined}
            />
            <Indicador
              rotulo="Respondidos"
              icone="ok"
              carregando={!todos}
              valor={num(r.respondidas)}
              detalhe="Com a decisão dos gestores"
              onClick={() => setVista("respondidas")}
            />
          </FaixaIndicadores>

          <Nota>
            Entram os CLT admitidos há até 120 dias e os PJ marcados com experiência. A admissão conta como o dia 1 do
            contrato.
          </Nota>

          {passos && <PreparoExperiencia passos={passos} />}

          <Painel
            corpo="p-0"
            titulo="Marcos em Curso"
            descricao={
              todos ? (
                <span className="inline-flex items-center gap-1.5">
                  Vencidos e mais perto do prazo primeiro
                  {res.isFetching && <Girando />}
                </span>
              ) : (
                "Lendo os contratos no Questor"
              )
            }
            acoes={
              <Segmentado<Vista>
                rotulo="Situação dos marcos"
                valor={vista}
                onMudar={setVista}
                opcoes={[
                  { valor: "todas", rotulo: rotuloConta("Todos", todos ? daEmpresa.length : undefined) },
                  { valor: "decidir", rotulo: rotuloConta("A decidir", todos ? r.aDecidir : undefined) },
                  { valor: "respondidas", rotulo: rotuloConta("Respondidos", todos ? r.respondidas : undefined) },
                ]}
              />
            }
          >
            {!todos ? (
              <EsqueletoTabela colunas={8} />
            ) : (
              <TabelaDados
                rotulo="Marcos de experiência"
                colunas={colunas}
                linhas={linhas}
                chave={chaveDe}
                onLinha={abrir}
                selecionada={(i) => chaveDe(i) === abertaChave}
                alturaMax="62vh"
                vazio={vazio}
              />
            )}
          </Painel>
        </>
      )}

      <Modal
        aberto={aberta != null}
        onFechar={fechar}
        titulo={aberta?.nome ?? ""}
        descricao={aberta ? `Experiência, marco de ${rotuloMarco(aberta.marco)}` : undefined}
        largura="m"
        rodape={
          aberta && (
            <>
              {aberta.id != null &&
                (confirmando ? (
                  <Botao
                    variante="perigo"
                    icone="apagar"
                    carregando={removendo}
                    onClick={() => remover(aberta)}
                    className="mr-auto"
                  >
                    Confirmar remoção
                  </Botao>
                ) : (
                  <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
                    Remover
                  </Botao>
                ))}
              {confirmando ? (
                <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={removendo}>
                  Cancelar
                </Botao>
              ) : (
                <Botao variante="fantasma" onClick={fechar}>
                  Fechar
                </Botao>
              )}
              {aberta.status !== "respondido" && !confirmando && (
                <Botao
                  variante="primario"
                  icone="email"
                  carregando={enviando === chaveDe(aberta)}
                  disabled={!podeEnviar(aberta)}
                  onClick={() => enviar(aberta)}
                >
                  {aberta.ultimoLembrete ? "Reenviar aos gestores" : "Enviar aos gestores"}
                </Botao>
              )}
            </>
          )
        }
      >
        {aberta && (
          <CorpoExperiencia
            item={aberta}
            resposta={resp.data}
            erroResposta={resp.error ? (resp.error as Error).message : null}
            onTentarResposta={() => resp.refetch()}
            confirmandoRemocao={confirmando}
          />
        )}
      </Modal>

      <ModalConfigExperiencia aberto={configAberta} onFechar={() => setConfigAberta(false)} />
    </>
  );
}
