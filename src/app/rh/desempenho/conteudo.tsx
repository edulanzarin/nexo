"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { ModalCobrarRodada } from "@/componentes/produto/rh/desempenho-cobranca";
import { ModalNovaAvaliacao, type ResultadoNovaAvaliacao } from "@/componentes/produto/rh/desempenho-nova";
import { CorpoDesempenho } from "@/componentes/produto/rh/desempenho-respostas";
import {
  SeloDesempenho,
  SeloEncerrada,
  cobravel,
  textoCobrancas,
  textoRespostas,
} from "@/componentes/produto/rh/desempenho-situacao";
import { SeletorEmpresaRh, SeloEmpresaRh, type FiltroEmpresaRh } from "@/componentes/produto/rh/empresa-rh";
import { GestoresSetor, SetorCargo } from "@/componentes/produto/rh/experiencia-situacao";
import { dataBR, hojeISO, num } from "@/lib/format";
import { nomeEmpresaRh } from "@/lib/rh";
import { STATUS_DESEMPENHO, STATUS_DESEMPENHO_ROTULO } from "@/lib/rh-desempenho";
import type { DesempenhoDetalhe, DesempenhoItem, DesempenhoRodada } from "@/lib/rh-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useFormulariosRh, useRhGestores, useRhSetores } from "@/hooks/use-rh";

type Acao = "reenviar" | "lembrete" | "encerrar" | "reabrir";

const CHAVE_LISTA = "rh-desempenho";
const CHAVE_RODADAS = "rh-desempenho-rodadas";
const CHAVE_DETALHE = "rh-desempenho-detalhe";

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;
const avaliacoes = (n: number) => plural(n, "avaliação", "avaliações");

const SEM_EMAIL = "O servidor está sem e-mail configurado, e o envio ficou só no log.";

const FALHA: Record<Acao, string> = {
  reenviar: "Não deu para reenviar",
  lembrete: "Não deu para cobrar",
  encerrar: "Não deu para encerrar",
  reabrir: "Não deu para reabrir",
};

/** Até quatro nomes e o resto em número, para caber na torrada. */
function nomesCurtos(nomes: string[]): string {
  if (nomes.length <= 4) return nomes.join(", ");
  return `${nomes.slice(0, 4).join(", ")} e mais ${num(nomes.length - 4)}`;
}

/** Botão de ação dentro da linha: a altura da linha (26px), não a do controle. */
function BotaoLinha({
  icone,
  rotulo,
  variante = "fantasma",
  carregando,
  onClick,
}: {
  icone: NomeIcone;
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
 * Desempenho: as avaliações sobre cada colaborador, respondidas pelos gestores
 * do setor dele. Cada disparo é uma rodada, e a mesma pessoa aparece uma vez por
 * rodada, o que forma o histórico dela. Tudo mora no banco do app, então os
 * filtros aplicam na hora e a lista carrega sozinha.
 *
 * A busca filtra aqui mesmo, sem ir ao servidor a cada tecla: a lista já veio
 * com os outros filtros aplicados, e o nome casa também com setor e cargo.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const [empresa, setEmpresa] = useEstadoTela<FiltroEmpresaRh>("empresa", "todas");
  const [rodada, setRodada] = useEstadoTela("rodada", "");
  const [status, setStatus] = useEstadoTela("status", "");
  const [setor, setSetor] = useEstadoTela("setor", "");
  const [formulario, setFormulario] = useEstadoTela("formulario", "");
  const [de, setDe] = useEstadoTela("de", "");
  const [ate, setAte] = useEstadoTela("ate", "");
  const [busca, setBusca] = useEstadoTela("busca", "");

  const [nova, setNova] = useState(false);
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [agindo, setAgindo] = useState<{ id: number; acao: Acao } | null>(null);
  const [cobrar, setCobrar] = useState<DesempenhoRodada | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (empresa !== "todas") p.set("empresa", empresa);
    if (rodada) p.set("rodada", rodada);
    if (status) p.set("status", status);
    if (setor) p.set("setor", setor);
    if (formulario) p.set("formulario", formulario);
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    return p.toString();
  }, [empresa, rodada, status, setor, formulario, de, ate]);

  const res = useConsulta<DesempenhoItem[]>(CHAVE_LISTA, `/api/rh/desempenho${qs ? `?${qs}` : ""}`);
  const rodadas = useConsulta<DesempenhoRodada[]>(CHAVE_RODADAS, "/api/rh/desempenho?rodadas=1");
  const setores = useRhSetores();
  const formularios = useFormulariosRh();
  const gestores = useRhGestores();

  const filtrado = qs !== "" || busca.trim() !== "";
  const rodadaSel = rodada ? (rodadas.data?.find((r) => String(r.id) === rodada) ?? null) : null;

  const itens = useMemo(() => {
    const lista = res.data ?? [];
    const termo = normalizar(busca.trim());
    if (!termo) return lista;
    return lista.filter((i) => normalizar(`${i.nome} ${i.setor ?? ""} ${i.cargo ?? ""}`).includes(termo));
  }, [res.data, busca]);

  const r = useMemo(
    () => ({
      total: itens.length,
      rodadas: new Set(itens.map((i) => i.rodadaId)).size,
      respondidas: itens.filter((i) => i.status === "respondido").length,
      respostas: itens.reduce((s, i) => s + i.respostas, 0),
      aCobrar: itens.filter((i) => cobravel(i) && i.gestores > 0).length,
      // Sem resposta e ninguém para responder: parada até alguém cadastrar o gestor.
      semGestor: itens.filter((i) => i.gestores === 0 && i.respostas === 0 && !i.encerradoEm).length,
    }),
    [itens]
  );

  // Lida da lista atual: depois de uma ação, o detalhe mostra o estado novo.
  const aberta = abertaId != null ? (res.data?.find((i) => i.id === abertaId) ?? null) : null;
  const det = useConsulta<DesempenhoDetalhe>(
    CHAVE_DETALHE,
    aberta && aberta.respostas > 0 ? `/api/rh/desempenho?id=${aberta.id}` : null,
    { manterAnterior: false }
  );

  const recarregar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVE_LISTA] }),
      qc.invalidateQueries({ queryKey: [CHAVE_RODADAS] }),
      qc.invalidateQueries({ queryKey: [CHAVE_DETALHE] }),
      qc.invalidateQueries({ queryKey: ["rh-painel"] }),
    ]);

  function limpar() {
    setEmpresa("todas");
    setRodada("");
    setStatus("");
    setSetor("");
    setFormulario("");
    setDe("");
    setAte("");
    setBusca("");
  }

  function abrir(i: DesempenhoItem) {
    setConfirmando(false);
    setAbertaId(i.id);
  }

  function fechar() {
    setAbertaId(null);
    setConfirmando(false);
  }

  const agindoEm = (i: DesempenhoItem, acao: Acao) => agindo?.id === i.id && agindo.acao === acao;

  async function agir(i: DesempenhoItem, acao: Acao) {
    setAgindo({ id: i.id, acao });
    try {
      const resultado = await mutar<{ enviado?: boolean; destinatarios?: number }>("/api/rh/desempenho", "PATCH", {
        id: i.id,
        acao,
      });
      await recarregar();
      if (acao === "reenviar")
        avisar.ok("Avaliação reenviada", resultado.enviado === false ? SEM_EMAIL : `Aos gestores do setor de ${i.nome}.`);
      else if (acao === "lembrete")
        avisar.ok(
          "Lembrete enviado",
          resultado.enviado === false
            ? SEM_EMAIL
            : `${plural(resultado.destinatarios ?? i.gestores, "gestor", "gestores")} do setor de ${i.nome}.`
        );
      else if (acao === "encerrar") avisar.ok("Avaliação encerrada", "O link não aceita mais respostas.");
      else avisar.ok("Avaliação reaberta", "O link volta a aceitar respostas.");
    } catch (e) {
      avisar.erro(FALHA[acao], (e as Error).message);
    } finally {
      setAgindo(null);
    }
  }

  async function remover(i: DesempenhoItem) {
    setRemovendo(true);
    try {
      await mutar(`/api/rh/desempenho?id=${i.id}`, "DELETE");
      await recarregar();
      avisar.ok("Avaliação removida", `${i.nome}, ${i.rodadaTitulo}`);
      fechar();
    } catch (e) {
      avisar.erro("Não deu para remover", (e as Error).message);
    } finally {
      setRemovendo(false);
    }
  }

  async function cobrarRodada(rod: DesempenhoRodada) {
    setCobrando(true);
    try {
      const resultado = await mutar<{ cobradas: number; enviados: number; ignoradas: number; falhas: string[] }>(
        "/api/rh/desempenho",
        "PATCH",
        { acao: "cobrar-rodada", rodadaId: rod.id }
      );
      await recarregar();
      if (resultado.cobradas)
        avisar.ok(`Lembrete enviado em ${avaliacoes(resultado.cobradas)}`, resultado.enviados === 0 ? SEM_EMAIL : rod.titulo);
      else avisar.info("Nenhuma avaliação para cobrar nesta rodada");
      if (resultado.falhas.length)
        avisar.erro(
          `${plural(resultado.falhas.length, "avaliação ficou", "avaliações ficaram")} sem cobrança`,
          `${nomesCurtos(resultado.falhas)}. Confira os gestores do setor.`
        );
      setCobrar(null);
    } catch (e) {
      avisar.erro("Não deu para cobrar a rodada", (e as Error).message);
    } finally {
      setCobrando(false);
    }
  }

  async function aoCriar(resultado: ResultadoNovaAvaliacao) {
    await recarregar();
    avisar.ok(
      `${avaliacoes(resultado.avaliacoes)} ${resultado.avaliacoes === 1 ? "enviada" : "enviadas"} aos gestores`,
      resultado.enviados === 0 ? SEM_EMAIL : undefined
    );
    if (resultado.semGestor.length)
      avisar.info(
        `${plural(resultado.semGestor.length, "pessoa ficou", "pessoas ficaram")} de fora por setor sem gestor`,
        nomesCurtos(resultado.semGestor)
      );
  }

  const acaoDaLinha = (i: DesempenhoItem) => {
    if (i.respostas > 0) return <BotaoLinha icone="ver" rotulo="Ver respostas" onClick={() => abrir(i)} />;
    if (i.gestores === 0 || i.encerradoEm) return null;
    if (cobravel(i))
      return (
        <BotaoLinha
          icone="relogio"
          rotulo="Cobrar"
          variante="secundario"
          carregando={agindoEm(i, "lembrete")}
          onClick={() => agir(i, "lembrete")}
        />
      );
    // Não saiu (ou falhou): cobrar não vale, a rota pede o disparo antes.
    if (i.status === "pendente" || i.status === "erro")
      return (
        <BotaoLinha
          icone="email"
          rotulo="Reenviar"
          variante="secundario"
          carregando={agindoEm(i, "reenviar")}
          onClick={() => agir(i, "reenviar")}
        />
      );
    return null;
  };

  const colunas: Coluna<DesempenhoItem>[] = [
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
    {
      id: "setor",
      cabecalho: "Setor e cargo",
      largura: "16%",
      secundaria: true,
      ordenar: (i) => i.setor ?? "",
      celula: (i) => <SetorCargo setor={i.setor} cargo={i.cargo} />,
    },
    // Com uma empresa escolhida, a coluna repetiria o mesmo nome em toda linha.
    ...(empresa === "todas"
      ? [
          {
            id: "empresa",
            cabecalho: "Empresa",
            secundaria: true,
            ordenar: (i: DesempenhoItem) => nomeEmpresaRh(i.codigoempresa),
            celula: (i: DesempenhoItem) => <SeloEmpresaRh codigo={i.codigoempresa} />,
          },
        ]
      : []),
    {
      id: "rodada",
      cabecalho: "Rodada",
      largura: "20%",
      ordenar: (i) => i.criadoEm,
      celula: (i) => (
        <span className="block truncate" title={`${i.rodadaTitulo} · ${i.formularioNome}`}>
          {i.rodadaTitulo}
          {/* O título nasce do nome do formulário; só diz o formulário quando o título é outro. */}
          {i.formularioNome !== i.rodadaTitulo && <span className="text-apagado"> · {i.formularioNome}</span>}
        </span>
      ),
    },
    {
      id: "enviada",
      cabecalho: "Enviada",
      ordenar: (i) => i.enviadoEm ?? "",
      celula: (i) =>
        i.enviadoEm ? <span className="num">{dataBR(i.enviadoEm)}</span> : <span className="text-apagado">Não saiu</span>,
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      ordenar: (i) => STATUS_DESEMPENHO_ROTULO[i.status],
      celula: (i) => (
        <span className="flex items-center gap-1.5">
          <SeloDesempenho status={i.status} />
          {i.encerradoEm && <SeloEncerrada em={i.encerradoEm} />}
        </span>
      ),
    },
    {
      id: "respostas",
      cabecalho: "Respostas de gestores",
      largura: "16%",
      ordenar: (i) => i.respostas,
      celula: (i) =>
        i.gestores === 0 && i.respostas === 0 ? (
          <GestoresSetor n={0} />
        ) : (
          <span className="block truncate" title={i.respondentes.join(", ") || undefined}>
            <span className="num">{textoRespostas(i)}</span>
            {i.respondentes.length > 0 && <span className="text-apagado"> · {i.respondentes.join(", ")}</span>}
          </span>
        ),
    },
    {
      id: "cobrancas",
      cabecalho: "Cobranças",
      secundaria: true,
      ordenar: (i) => i.lembretes,
      celula: (i) =>
        i.lembretes > 0 ? <span className="num">{textoCobrancas(i)}</span> : <span className="text-apagado">—</span>,
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

  const opcoesRodada: Opcao[] = [
    { valor: "", rotulo: "Todas as rodadas" },
    ...(rodadas.data ?? []).map((rod) => ({
      valor: String(rod.id),
      rotulo: rod.titulo,
      detalhe: `${dataBR(rod.criadoEm)} · ${num(rod.respondidas)}/${num(rod.avaliacoes)}`,
    })),
  ];
  const opcoesSituacao: Opcao[] = [
    { valor: "", rotulo: "Todas as situações" },
    ...STATUS_DESEMPENHO.map((s) => ({ valor: s, rotulo: STATUS_DESEMPENHO_ROTULO[s] })),
  ];
  const opcoesSetor: Opcao[] = [
    { valor: "", rotulo: "Todos os setores" },
    ...(setores.data ?? []).map((s) => ({ valor: s.classiforgan, rotulo: s.nome })),
  ];
  const opcoesFormulario: Opcao[] = [
    { valor: "", rotulo: "Todos os formulários" },
    ...(formularios.data ?? []).map((f) => ({ valor: String(f.id), rotulo: f.nome })),
  ];

  // O vazio de quem nunca avaliou ensina o caminho, na ordem em que ele trava.
  const temFormularioAtivo = formularios.data?.some((f) => f.status === "ativo");
  const temGestor = gestores.data ? gestores.data.some((g) => g.ativo) : undefined;
  const botaoNova = (
    <Botao icone="mais" onClick={() => setNova(true)}>
      Nova avaliação
    </Botao>
  );

  let vazio: ReactNode;
  if (!filtrado)
    vazio = (
      <Vazio
        icone="tendencia"
        titulo="Nenhuma avaliação de desempenho ainda"
        descricao={
          temFormularioAtivo === false
            ? "Comece pelo formulário: monte e ative o de desempenho em Formulários."
            : temGestor === false
              ? "Cadastre os gestores de cada setor. São eles que recebem o link e respondem."
              : "Escolha o formulário e sobre quem. Os gestores do setor de cada pessoa recebem o link e respondem."
        }
        acao={
          temFormularioAtivo === false ? (
            <BotaoLink href="/rh/formularios" iconeFim="seta-direita">
              Ir para Formulários
            </BotaoLink>
          ) : temGestor === false ? (
            <>
              <BotaoLink href="/rh/gestores" iconeFim="seta-direita">
                Cadastrar gestores
              </BotaoLink>
              {botaoNova}
            </>
          ) : (
            botaoNova
          )
        }
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhuma avaliação com esses filtros"
        descricao={
          busca.trim() ? "Confira o nome buscado, ou limpe os filtros." : "Afrouxe a rodada, a situação ou as datas."
        }
        acao={
          <Botao icone="fechar" onClick={limpar}>
            Limpar filtros
          </Botao>
        }
      />
    );

  const podeCobrar = (i: DesempenhoItem) => cobravel(i) && i.gestores > 0;

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="rh"
          desabilitado={!res.data}
          cortes={[
            {
              id: "desempenho",
              rotulo: "Avaliações de desempenho",
              nome: `desempenho-${rodadaSel ? `rodada-${rodadaSel.id}` : "avaliacoes"}-${hojeISO()}`,
              montar: () => ({
                cabecalhos: [
                  "Rodada",
                  "Formulário",
                  "Empresa",
                  "Contrato",
                  "Colaborador",
                  "Cargo",
                  "Setor",
                  "Situação",
                  "Encerrada em",
                  "Enviada em",
                  "Gestores no setor",
                  "Respostas",
                  "Quem respondeu",
                  "Cobranças",
                  "Última cobrança",
                ],
                linhas: itens.map((i) => [
                  i.rodadaTitulo,
                  i.formularioNome,
                  nomeEmpresaRh(i.codigoempresa),
                  i.contrato,
                  i.nome,
                  i.cargo ?? "",
                  i.setor ?? "",
                  STATUS_DESEMPENHO_ROTULO[i.status],
                  i.encerradoEm ? dataBR(i.encerradoEm) : "",
                  i.enviadoEm ? dataBR(i.enviadoEm) : "",
                  i.gestores,
                  i.respostas,
                  i.respondentes.join(", "),
                  i.lembretes,
                  i.ultimoLembrete ? dataBR(i.ultimoLembrete) : "",
                ]),
              }),
            },
          ]}
        />
        {/* Só com rodada escolhida: cobrar "quem não respondeu" na lista inteira
            misturaria a avaliação de agosto com a de ontem. */}
        {rodadaSel && (
          <Botao icone="relogio" disabled={rodadaSel.aCobrar === 0} onClick={() => setCobrar(rodadaSel)}>
            {rodadaSel.aCobrar === 0 ? "Ninguém a cobrar" : `Cobrar ${num(rodadaSel.aCobrar)} sem resposta`}
          </Botao>
        )}
        <Botao variante="primario" icone="mais" onClick={() => setNova(true)}>
          Nova avaliação
        </Botao>
      </AcoesPagina>

      <div className="nx-sem-papel flex flex-wrap items-center gap-2">
        <Campo
          icone="buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar colaborador"
          aria-label="Buscar colaborador"
          classeCaixa="w-full sm:w-56"
        />
        <div className="max-w-full overflow-x-auto">
          <SeletorEmpresaRh valor={empresa} onMudar={setEmpresa} />
        </div>
        <Combo
          icone="historico"
          opcoes={opcoesRodada}
          valor={rodada}
          onMudar={setRodada}
          className="w-full sm:w-60"
          larguraMin={320}
          desabilitado={!rodadas.data}
          rotuloAcessivel="Filtrar por rodada"
        />
        <Combo
          icone="filtrar"
          opcoes={opcoesSituacao}
          valor={status}
          onMudar={setStatus}
          className="w-full sm:w-52"
          rotuloAcessivel="Filtrar por situação"
        />
        <Combo
          icone="camadas"
          opcoes={opcoesSetor}
          valor={setor}
          onMudar={setSetor}
          className="w-full sm:w-56"
          larguraMin={280}
          desabilitado={!setores.data}
          rotuloAcessivel="Filtrar por setor"
        />
        <Combo
          icone="relatorio"
          opcoes={opcoesFormulario}
          valor={formulario}
          onMudar={setFormulario}
          className="w-full sm:w-56"
          larguraMin={280}
          desabilitado={!formularios.data}
          rotuloAcessivel="Filtrar por formulário"
        />
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <span className="shrink-0 text-pequeno text-apagado">Criadas de</span>
          <Campo type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Criadas a partir de" className="min-w-0 sm:w-36" />
          <span className="shrink-0 text-pequeno text-apagado">até</span>
          <Campo type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Criadas até" className="min-w-0 sm:w-36" />
        </div>
        {filtrado && (
          <Botao variante="fantasma" icone="fechar" onClick={limpar}>
            Limpar filtros
          </Botao>
        )}
      </div>

      {res.isError ? (
        <PainelErro
          titulo="Não deu para carregar as avaliações"
          mensagem={(res.error as Error).message}
          onTentar={() => res.refetch()}
        />
      ) : (
        <>
          <FaixaIndicadores colunas={4}>
            <Indicador
              rotulo="Avaliações"
              icone="relatorio"
              carregando={!res.data}
              valor={num(r.total)}
              detalhe={`Em ${plural(r.rodadas, "rodada", "rodadas")}`}
            />
            <Indicador
              rotulo="Respondidas"
              icone="ok"
              carregando={!res.data}
              valor={num(r.respondidas)}
              detalhe={`${plural(r.respostas, "resposta", "respostas")} de gestores`}
            />
            <Indicador
              rotulo="A cobrar"
              icone="relogio"
              carregando={!res.data}
              valor={num(r.aCobrar)}
              detalhe="Saíram e ninguém respondeu"
              tom={r.aCobrar > 0 ? "atencao" : "neutro"}
              valorNoTom
            />
            <Indicador
              rotulo="Sem gestor"
              icone="usuario"
              carregando={!res.data}
              valor={num(r.semGestor)}
              detalhe="Ninguém recebe o link"
              tom={r.semGestor > 0 ? "atencao" : "neutro"}
              valorNoTom
              href={r.semGestor > 0 ? "/rh/gestores" : undefined}
            />
          </FaixaIndicadores>

          <Nota>Cada gestor do setor responde a sua pelo mesmo link, até a avaliação ser encerrada.</Nota>

          <Painel
            corpo="p-0"
            titulo="Avaliações"
            descricao={
              res.data ? (
                <span className="inline-flex items-center gap-1.5">
                  Mais novas primeiro
                  {res.isFetching && <Girando />}
                </span>
              ) : (
                "Lendo as avaliações"
              )
            }
          >
            {!res.data ? (
              <EsqueletoTabela colunas={7} />
            ) : (
              <TabelaDados
                rotulo="Avaliações de desempenho"
                colunas={colunas}
                linhas={itens}
                chave={(i) => String(i.id)}
                onLinha={abrir}
                selecionada={(i) => i.id === abertaId}
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
        descricao={aberta?.rodadaTitulo}
        largura="m"
        rodape={
          aberta &&
          (confirmando ? (
            <>
              <Botao variante="perigo" icone="apagar" carregando={removendo} onClick={() => remover(aberta)} className="mr-auto">
                Confirmar remoção
              </Botao>
              <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={removendo}>
                Cancelar
              </Botao>
            </>
          ) : (
            <>
              <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
                Remover
              </Botao>
              <Botao
                icone={aberta.encerradoEm ? "reabrir" : "bloqueado"}
                carregando={agindoEm(aberta, aberta.encerradoEm ? "reabrir" : "encerrar")}
                onClick={() => agir(aberta, aberta.encerradoEm ? "reabrir" : "encerrar")}
              >
                {aberta.encerradoEm ? "Reabrir" : "Encerrar"}
              </Botao>
              {!aberta.encerradoEm && (
                <Botao
                  icone="email"
                  carregando={agindoEm(aberta, "reenviar")}
                  disabled={aberta.gestores === 0}
                  onClick={() => agir(aberta, "reenviar")}
                >
                  Reenviar
                </Botao>
              )}
              {podeCobrar(aberta) && (
                <Botao
                  variante="primario"
                  icone="relogio"
                  carregando={agindoEm(aberta, "lembrete")}
                  onClick={() => agir(aberta, "lembrete")}
                >
                  Cobrar gestores
                </Botao>
              )}
            </>
          ))
        }
      >
        {aberta && (
          <CorpoDesempenho
            item={aberta}
            detalhe={det.data}
            erro={det.error ? (det.error as Error).message : null}
            onTentar={() => det.refetch()}
            confirmandoRemocao={confirmando}
          />
        )}
      </Modal>

      <ModalCobrarRodada
        rodada={cobrar}
        cobrando={cobrando}
        onConfirmar={() => cobrar && cobrarRodada(cobrar)}
        onFechar={() => setCobrar(null)}
      />
      <ModalNovaAvaliacao aberto={nova} onFechar={() => setNova(false)} onCriada={aoCriar} />
    </>
  );
}
