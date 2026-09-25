"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Abas } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { ApuracaoFormulario } from "@/componentes/produto/rh/apuracao-formulario";
import {
  CHAVES_CLIMA,
  ModalNovaRodada,
  formularioUsavel,
} from "@/componentes/produto/rh/clima-nova-rodada";
import { RespostasClima } from "@/componentes/produto/rh/clima-respostas";
import { PainelRodada } from "@/componentes/produto/rh/clima-rodada";
import type { ClimaDashboard, RodadaResumo } from "@/lib/clima-tipos";
import { decimalBR } from "@/lib/csv";
import { dataBR } from "@/lib/format";
import {
  MIN_ANONIMATO,
  apurarFormulario,
  filtrarRespostas,
  type Segmento,
} from "@/lib/formularios-apuracao";
import { escalaDoCampo, type FormularioCampo, type RespostaValores } from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useFormulariosRh } from "@/hooks/use-rh";

type Visao = "resumo" | "respostas";

/** Valor de uma pergunta como texto de planilha (a nota vira "3 · Bom"). */
function celula(campo: FormularioCampo, valores: RespostaValores): string {
  const v = valores[String(campo.id)];
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(" | ");
  if (campo.tipo === "nota" && typeof v === "number") {
    const rotulo = escalaDoCampo(campo)[v];
    return rotulo && rotulo !== String(v + 1) ? `${v + 1} · ${rotulo}` : String(v + 1);
  }
  return String(v);
}

/**
 * Os três arquivos que uma rodada rende: uma linha por pessoa (abre direto no
 * Excel), a apuração por pergunta e só o que foi escrito. Todos com o recorte
 * da tela aplicado, e o nome do arquivo diz quando é recorte.
 */
function cortesClima(dash: ClimaDashboard, filtradas: RespostaValores[], segmento: Segmento | null): CorteExportar[] {
  const nome = (corte: string) => `clima-${dash.rodada.slug}-${corte}${segmento ? "-recorte" : ""}`;
  // Data e número não moram em `valores`: reencontra a resposta pelo objeto,
  // que é o mesmo que o filtro devolveu. O número é o da tela (a 1 é a
  // primeira que chegou), também no recorte.
  const dataDe = new Map(dash.respostas.map((r) => [r.valores, r.criadoEm]));
  const numeroDe = new Map(dash.respostas.map((r, i) => [r.valores, dash.total - i]));

  return [
    {
      id: "respostas",
      rotulo: "Respostas",
      descricao: "Uma linha por pessoa, uma coluna por pergunta",
      nome: nome("respostas"),
      montar: () => ({
        cabecalhos: ["Nº", "Enviada em", ...dash.campos.map((c) => c.rotulo)],
        linhas: filtradas.map((valores) => [
          numeroDe.get(valores) ?? "",
          dataBR(dataDe.get(valores) ?? null),
          ...dash.campos.map((c) => celula(c, valores)),
        ]),
      }),
    },
    {
      id: "apuracao",
      rotulo: "Apuração por pergunta",
      descricao: "Cada opção e cada nível, com contagem e percentual",
      nome: nome("apuracao"),
      montar: () => ({
        cabecalhos: ["Pergunta", "Tipo", "Item", "Respostas", "% de quem respondeu"],
        linhas: apurarFormulario(dash.campos, filtradas).flatMap((a) =>
          a.forma === "texto"
            ? [[a.campo.rotulo, "Texto", "Respostas escritas", a.respondentes, ""]]
            : a.fatias.map((f) => [
                a.campo.rotulo,
                a.forma === "escala" ? "Nota" : a.forma === "numero" ? "Número" : "Marcação",
                f.rotulo,
                f.n,
                decimalBR(f.pct),
              ])
        ),
      }),
    },
    {
      id: "comentarios",
      rotulo: "Respostas escritas",
      descricao: "Só o que as pessoas escreveram, pergunta a pergunta",
      nome: nome("comentarios"),
      montar: () => ({
        cabecalhos: ["Pergunta", "Resposta"],
        linhas: apurarFormulario(dash.campos, filtradas).flatMap((a) =>
          a.forma === "texto" ? a.textos.map((t) => [a.campo.rotulo, t]) : []
        ),
      }),
    },
  ];
}

/**
 * Avaliações da empresa (clima): rodadas de um formulário respondido por link
 * aberto, sem identificação. A tela é uma rodada por vez: o resumo que se monta
 * das perguntas, as respostas uma a uma e a exportação.
 *
 * O recorte pertence à rodada em que foi escolhido: trocar de rodada volta para
 * todas as respostas, porque a pergunta de setor de uma pode não existir na
 * outra.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const [escolhida, setEscolhida] = useEstadoTela<number | null>("rodada", null);
  const [visao, setVisao] = useEstadoTela<Visao>("visao", "resumo");
  const [recorte, setRecorte] = useState<{ rodada: number; segmento: Segmento } | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [alternando, setAlternando] = useState(false);

  const lista = useConsulta<{ rodadas: RodadaResumo[] }>(CHAVES_CLIMA.rodadas, "/api/rh/clima", { staleTime: 30_000 });
  const rodadas = lista.data?.rodadas;
  const rodada = rodadas?.find((r) => r.id === escolhida) ?? rodadas?.[0] ?? null;

  const painel = useConsulta<ClimaDashboard>(CHAVES_CLIMA.painel, rodada ? `/api/rh/clima?id=${rodada.id}` : null, {
    manterAnterior: false,
    staleTime: 30_000,
  });
  const dash = painel.data;

  // Só para o vazio de primeira vez: diz se dá para criar rodada ou se falta o formulário.
  const formularios = useFormulariosRh(rodadas?.length === 0);
  const semFormulario = formularios.data != null && !formularios.data.some(formularioUsavel);

  const segmento = recorte && rodada && recorte.rodada === rodada.id ? recorte.segmento : null;
  const mudarSegmento = (s: Segmento | null) => setRecorte(s && rodada ? { rodada: rodada.id, segmento: s } : null);

  const valores = useMemo(() => dash?.respostas.map((r) => r.valores) ?? [], [dash]);
  const filtradas = useMemo(() => filtrarRespostas(valores, segmento), [valores, segmento]);
  // A trava de anonimato vale também para a planilha: recorte pequeno não sai.
  const travado = segmento != null && filtradas.length < MIN_ANONIMATO;
  const cortes = useMemo(
    () => (dash ? cortesClima(dash, filtradas, segmento) : []),
    [dash, filtradas, segmento]
  );

  async function alternar() {
    if (!rodada) return;
    const novo = rodada.status === "aberta" ? "fechada" : "aberta";
    setAlternando(true);
    try {
      await mutar("/api/rh/clima", "PATCH", { id: rodada.id, status: novo });
      await Promise.all([
        qc.invalidateQueries({ queryKey: [CHAVES_CLIMA.rodadas] }),
        qc.invalidateQueries({ queryKey: [CHAVES_CLIMA.painel] }),
        qc.invalidateQueries({ queryKey: ["rh-painel"] }),
      ]);
      avisar.ok(novo === "aberta" ? "Rodada reaberta" : "Rodada encerrada");
    } catch (e) {
      avisar.erro("Não deu para mudar a rodada", (e as Error).message);
    } finally {
      setAlternando(false);
    }
  }

  const acoes = (
    <AcoesPagina>
      <MenuExportar
        modulo="rh"
        cortes={cortes}
        desabilitado={!dash || dash.total === 0 || travado}
      />
      <Botao variante="primario" icone="mais" onClick={() => setNovaAberta(true)}>
        Nova rodada
      </Botao>
    </AcoesPagina>
  );
  const modal = (
    <ModalNovaRodada
      aberto={novaAberta}
      onFechar={() => setNovaAberta(false)}
      onCriada={(id) => {
        setEscolhida(id);
        setRecorte(null);
        setVisao("resumo");
        setNovaAberta(false);
      }}
    />
  );

  if (lista.isError && !rodadas)
    return (
      <>
        {acoes}
        <PainelErro
          titulo="Não deu para carregar as avaliações"
          mensagem={(lista.error as Error).message}
          onTentar={() => lista.refetch()}
        />
        {modal}
      </>
    );

  if (!rodadas)
    return (
      <>
        {acoes}
        <Esqueleto className="h-28 rounded-painel" />
        <FaixaCarregando />
        {modal}
      </>
    );

  if (!rodada)
    return (
      <>
        {acoes}
        <Painel>
          <Vazio
            icone="coracao"
            titulo="Nenhuma avaliação criada"
            descricao={
              semFormulario
                ? "Cada rodada usa um formulário ativo, e ainda não há nenhum."
                : "Cada rodada usa um formulário ativo e gera um link para os colaboradores responderem sem se identificar."
            }
            acao={
              semFormulario ? (
                <BotaoLink href="/rh/formularios" iconeFim="seta-direita">
                  Montar formulário
                </BotaoLink>
              ) : (
                <Botao icone="mais" onClick={() => setNovaAberta(true)}>
                  Nova rodada
                </Botao>
              )
            }
          />
        </Painel>
        {modal}
      </>
    );

  const aberta = rodada.status === "aberta";
  const semRespostas = (
    <Painel>
      <Vazio
        icone={aberta ? "relogio" : "bloqueado"}
        titulo="Nenhuma resposta ainda"
        descricao={
          aberta
            ? "Divulgue o link da rodada. As respostas aparecem aqui assim que chegam."
            : "A rodada foi encerrada sem respostas. Reabra para receber."
        }
      />
    </Painel>
  );

  return (
    <>
      {acoes}

      <PainelRodada
        rodadas={rodadas}
        rodada={rodada}
        onEscolher={setEscolhida}
        onAlternar={alternar}
        alternando={alternando}
      />

      {painel.isError && !dash ? (
        <PainelErro
          titulo="Não deu para carregar a rodada"
          mensagem={(painel.error as Error).message}
          onTentar={() => painel.refetch()}
        />
      ) : !dash ? (
        <>
          <FaixaCarregando />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Esqueleto className="h-56 rounded-painel" />
            <Esqueleto className="h-56 rounded-painel" />
          </div>
        </>
      ) : (
        <>
          <Abas
            rotulo="Resultados da rodada"
            ativa={visao}
            onMudar={(v) => setVisao(v as Visao)}
            itens={[
              { chave: "resumo", rotulo: "Resumo", icone: "grafico" },
              { chave: "respostas", rotulo: "Respostas", icone: "fila", contagem: dash.total },
            ]}
          />
          {visao === "resumo" ? (
            <ApuracaoFormulario
              campos={dash.campos}
              respostas={valores}
              anonimo
              segmento={segmento}
              onSegmento={mudarSegmento}
              vazio={semRespostas}
            />
          ) : (
            <RespostasClima key={dash.rodada.id} campos={dash.campos} respostas={dash.respostas} vazio={semRespostas} />
          )}
        </>
      )}

      {modal}
    </>
  );
}

function FaixaCarregando() {
  return (
    <FaixaIndicadores colunas={4}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Indicador key={i} rotulo="Carregando" valor="" detalhe="" carregando />
      ))}
    </FaixaIndicadores>
  );
}
