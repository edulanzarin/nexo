"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { ModalEnviarFormulario } from "@/componentes/produto/rh/envio-enviar";
import { ModalAvisoSaida, useAvisoSaida } from "@/componentes/produto/rh/formulario-aviso-saida";
import { FolhaFormulario } from "@/componentes/produto/rh/formulario-folha";
import {
  EditorPergunta,
  MenuNovaPergunta,
  campoDoRascunho,
  entradaDoRascunho,
  errosDoRascunho,
  rascunhoDoCampo,
  rascunhoDuplicado,
  rascunhoNovo,
  temErro,
  type RascunhoPergunta,
} from "@/componentes/produto/rh/formulario-pergunta";
import {
  ROTULO_SITUACAO_FORMULARIO,
  SITUACOES_FORMULARIO,
  SeloSituacaoFormulario,
} from "@/componentes/produto/rh/formulario-situacao";
import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";
import type { Formulario, StatusFormulario, TipoCampo } from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { CHAVES_RH } from "@/hooks/use-rh";

/** Chave de um formulário com as perguntas (`/api/rh/formularios?id=`). */
const CHAVE_FORMULARIO = "rh-formulario";

const AJUDA_SITUACAO: Record<StatusFormulario, string> = {
  rascunho: "Em montagem. Não pode ser enviado nem escolhido.",
  ativo: "Pode ser enviado e escolhido na experiência, no desempenho e nas avaliações.",
  arquivado: "Fora de uso. Some das escolhas de formulário.",
};

export function Conteudo({ id }: { id: number }) {
  const url = `/api/rh/formularios?id=${id}`;
  // Sem manter o anterior: o editor de um formulário nunca mostra o de outro.
  const res = useConsulta<Formulario>(CHAVE_FORMULARIO, url, { manterAnterior: false });

  if (res.isError && !res.data)
    return (
      <>
        <Voltar />
        <PainelErro
          titulo="Não deu para abrir o formulário"
          mensagem={(res.error as Error).message}
          onTentar={() => res.refetch()}
        />
      </>
    );

  if (!res.data)
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Esqueleto className="h-12 w-full rounded-painel" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
          <div className="flex flex-col gap-4">
            <Esqueleto className="h-48 w-full rounded-painel" />
            <Esqueleto className="h-56 w-full rounded-painel" />
            <Esqueleto className="h-56 w-full rounded-painel" />
          </div>
          <Esqueleto className="hidden h-[32rem] w-full rounded-painel xl:block" />
        </div>
      </div>
    );

  // O rascunho nasce do formulário carregado uma vez; uma nova leitura do
  // servidor (foco na janela, invalidação) não pode apagar o que se digitou.
  return <Editor inicial={res.data} url={url} />;
}

function Voltar() {
  return (
    <BotaoLink href="/rh/formularios" variante="fantasma" icone="seta-esquerda" className="-ml-1.5 self-start">
      Formulários
    </BotaoLink>
  );
}

interface CorpoFormulario {
  nome: string;
  descricao: string | null;
  status: StatusFormulario;
  campos: ReturnType<typeof entradaDoRascunho>[];
}

function corpoDe(nome: string, descricao: string, status: StatusFormulario, perguntas: RascunhoPergunta[]): CorpoFormulario {
  return {
    nome: nome.trim(),
    descricao: descricao.trim() || null,
    status,
    campos: perguntas.map((p, i) => entradaDoRascunho(p, i)),
  };
}

function Editor({ inicial, url }: { inicial: Formulario; url: string }) {
  const qc = useQueryClient();
  const idCampo = useId();
  const [nome, setNome] = useState(inicial.nome);
  const [descricao, setDescricao] = useState(inicial.descricao ?? "");
  const [status, setStatus] = useState<StatusFormulario>(inicial.status);
  const [perguntas, setPerguntas] = useState<RascunhoPergunta[]>(() => inicial.campos.map(rascunhoDoCampo));
  // O que está no servidor: base do "alterações não salvas" e das perguntas com resposta guardada.
  const [salvo, setSalvo] = useState(() =>
    JSON.stringify(corpoDe(inicial.nome, inicial.descricao ?? "", inicial.status, perguntas))
  );
  const [idsGuardados, setIdsGuardados] = useState(() => new Set(inicial.campos.map((c) => c.id)));
  const [statusGuardado, setStatusGuardado] = useState(inicial.status);
  const [atualizadoEm, setAtualizadoEm] = useState(inicial.atualizadoEm ?? null);
  // Erros só acendem depois da primeira tentativa de salvar.
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [recem, setRecem] = useState<number | null>(null);
  const [modo, setModo] = useState<"editar" | "previa">("editar");
  const [versaoPrevia, setVersaoPrevia] = useState(0);
  const [enviarAberto, setEnviarAberto] = useState(false);

  const corpo = useMemo(() => corpoDe(nome, descricao, status, perguntas), [nome, descricao, status, perguntas]);
  const sujo = JSON.stringify(corpo) !== salvo;
  const saida = useAvisoSaida(sujo);

  const campos = useMemo(() => perguntas.map((p, i) => campoDoRascunho(p, i)), [perguntas]);
  const removidasComResposta = [...idsGuardados].filter((i) => !perguntas.some((p) => p.id === i)).length;
  const erroNome = tentou && !nome.trim() ? "Dê um nome ao formulário" : undefined;
  const podeEnviar = !sujo && statusGuardado === "ativo" && perguntas.length > 0;

  const mudar = (chave: number, parcial: Partial<RascunhoPergunta>) =>
    setPerguntas((ps) =>
      ps.map((p) => {
        if (p.chave === chave) return { ...p, ...parcial };
        // A decisão é uma só por formulário: marcar uma desmarca a outra.
        return parcial.decisao ? { ...p, decisao: false } : p;
      })
    );

  const mover = (i: number, direcao: -1 | 1) =>
    setPerguntas((ps) => {
      const j = i + direcao;
      if (j < 0 || j >= ps.length) return ps;
      const novo = [...ps];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });

  const adicionar = (tipo: TipoCampo) => {
    const p = rascunhoNovo(tipo);
    setPerguntas((ps) => [...ps, p]);
    setRecem(p.chave);
    setModo("editar");
  };

  const duplicar = (i: number) => {
    const p = rascunhoDuplicado(perguntas[i]);
    setPerguntas((ps) => [...ps.slice(0, i + 1), p, ...ps.slice(i + 1)]);
    setRecem(p.chave);
  };

  const remover = (chave: number) => setPerguntas((ps) => ps.filter((p) => p.chave !== chave));

  async function salvar() {
    setTentou(true);
    if (!nome.trim()) {
      avisar.erro("Falta o nome do formulário");
      setModo("editar");
      return;
    }
    const comErro = perguntas.findIndex((p) => temErro(errosDoRascunho(p)));
    if (comErro >= 0) {
      avisar.erro("Revise as perguntas", `A pergunta ${num(comErro + 1)} tem um campo marcado.`);
      setModo("editar");
      document.getElementById(`pergunta-${perguntas[comErro].chave}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setSalvando(true);
    try {
      const f = await mutar<Formulario>("/api/rh/formularios", "PATCH", { id: inicial.id, ...corpo });
      // As perguntas novas ganham id no servidor e voltam na mesma ordem. Sem
      // levar o id para o rascunho, o próximo salvar as apagaria e criaria de
      // novo, e as respostas guardadas por id perderiam a pergunta.
      const novas =
        f.campos.length === perguntas.length
          ? perguntas.map((p, i) => ({ ...p, id: f.campos[i].id }))
          : f.campos.map(rascunhoDoCampo);
      setPerguntas(novas);
      setSalvo(JSON.stringify(corpoDe(f.nome, f.descricao ?? "", f.status, novas)));
      setNome(f.nome);
      setDescricao(f.descricao ?? "");
      setIdsGuardados(new Set(f.campos.map((c) => c.id)));
      setStatusGuardado(f.status);
      setAtualizadoEm(f.atualizadoEm ?? null);
      setTentou(false);
      qc.setQueryData([CHAVE_FORMULARIO, url], f);
      await qc.invalidateQueries({ queryKey: [CHAVES_RH.formularios] });
      avisar.ok("Formulário salvo", f.nome);
    } catch (e) {
      avisar.erro("Não deu para salvar", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const colunaEditor = (
    <div className={cn("min-w-0 flex-col gap-4", modo === "previa" ? "hidden xl:flex" : "flex")}>
      <Painel>
        <div className="flex flex-col gap-3">
          <Rotulado rotulo="Nome" htmlFor={`${idCampo}-nome`} erro={erroNome}>
            <Campo
              id={`${idCampo}-nome`}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-invalid={!!erroNome}
              className="font-[560]"
            />
          </Rotulado>
          <Rotulado
            rotulo="Descrição"
            htmlFor={`${idCampo}-descricao`}
            ajuda="Opcional. Instruções que aparecem no alto, para quem responde."
          >
            <AreaTexto
              id={`${idCampo}-descricao`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="min-h-0"
            />
          </Rotulado>
          <Rotulado rotulo="Situação" ajuda={AJUDA_SITUACAO[status]}>
            <Segmentado<StatusFormulario>
              rotulo="Situação"
              valor={status}
              onMudar={setStatus}
              className="self-start"
              opcoes={SITUACOES_FORMULARIO.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO_FORMULARIO[s] }))}
            />
          </Rotulado>
        </div>
      </Painel>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-medio font-[600] text-tinta">
          Perguntas <span className="num font-normal text-apagado">{num(perguntas.length)}</span>
        </h2>
        {perguntas.length > 0 && <MenuNovaPergunta onEscolher={adicionar} />}
      </div>

      {status === "ativo" && perguntas.length === 0 && (
        <Nota tom="atencao" icone="alerta">
          Formulário ativo sem perguntas não pode ser enviado.
        </Nota>
      )}
      {removidasComResposta > 0 && (
        <Nota tom="atencao" icone="alerta">
          {removidasComResposta === 1
            ? "Ao salvar, a pergunta removida some também das respostas que já chegaram."
            : `Ao salvar, as ${num(removidasComResposta)} perguntas removidas somem também das respostas que já chegaram.`}
        </Nota>
      )}

      {perguntas.length === 0 ? (
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="relatorio"
            titulo="Nenhuma pergunta ainda"
            descricao="Escolha o tipo da primeira pergunta. A prévia mostra como ela chega a quem responde."
            acao={<MenuNovaPergunta onEscolher={adicionar} />}
          />
        </div>
      ) : (
        <>
          {perguntas.map((p, i) => (
            <div key={p.chave} id={`pergunta-${p.chave}`} className="scroll-mt-24">
              <EditorPergunta
                rascunho={p}
                indice={i}
                total={perguntas.length}
                erros={tentou ? errosDoRascunho(p) : undefined}
                autoFoco={p.chave === recem}
                onMudar={(parcial) => mudar(p.chave, parcial)}
                onMover={(d) => mover(i, d)}
                onDuplicar={() => duplicar(i)}
                onRemover={() => remover(p.chave)}
              />
            </div>
          ))}
          <div>
            <MenuNovaPergunta onEscolher={adicionar} />
          </div>
        </>
      )}
    </div>
  );

  const colunaPrevia = (
    <div
      className={cn(
        "min-w-0 flex-col gap-2 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto",
        modo === "editar" ? "hidden xl:flex" : "flex"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-pequeno text-apagado">Prévia do que chega a quem responde</p>
        <Botao variante="fantasma" icone="desfazer" onClick={() => setVersaoPrevia((v) => v + 1)}>
          Limpar respostas
        </Botao>
      </div>
      <FolhaFormulario
        key={versaoPrevia}
        titulo={nome.trim() || "Formulário sem nome"}
        descricao={descricao.trim() || null}
        campos={campos}
        onEnviar={async () => {
          avisar.ok("Respostas válidas", "Na prévia nada é enviado.");
        }}
      />
    </div>
  );

  return (
    <>
      <AcoesPagina>
        {podeEnviar && (
          <Botao icone="enviar" onClick={() => setEnviarAberto(true)}>
            Enviar
          </Botao>
        )}
        <Botao variante="primario" icone="salvar" carregando={salvando} onClick={salvar}>
          Salvar
        </Botao>
      </AcoesPagina>

      <div className="nx-vidro flex flex-wrap items-center gap-x-4 gap-y-2 rounded-painel px-4 py-2">
        <Voltar />
        <span className="min-w-0 flex-1 truncate text-medio font-[600] text-tinta" title={nome}>
          {nome.trim() || "Formulário sem nome"}
        </span>
        <SeloSituacaoFormulario status={statusGuardado} />
        {sujo ? (
          <Nota tom="atencao">Alterações não salvas</Nota>
        ) : (
          atualizadoEm && <span className="text-pequeno text-apagado">Salvo em {dataBR(atualizadoEm)}</span>
        )}
        <Segmentado<"editar" | "previa">
          rotulo="Mostrar"
          valor={modo}
          onMudar={setModo}
          className="xl:hidden"
          opcoes={[
            { valor: "editar", rotulo: "Editar", icone: "editar" },
            { valor: "previa", rotulo: "Prévia", icone: "ver" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
        {colunaEditor}
        {colunaPrevia}
      </div>

      <ModalEnviarFormulario
        aberto={enviarAberto}
        formulario={{ id: inicial.id, nome }}
        onFechar={() => setEnviarAberto(false)}
      />
      <ModalAvisoSaida aberto={saida.destino != null} onFicar={saida.ficar} onSair={saida.sair} />
    </>
  );
}
