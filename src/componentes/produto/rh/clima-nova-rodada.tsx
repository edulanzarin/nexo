"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { num } from "@/lib/format";
import type { FormularioResumo } from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";
import { useFormulariosRh } from "@/hooks/use-rh";

/** Chaves de consulta da tela de Avaliações. */
export const CHAVES_CLIMA = { rodadas: "rh-clima-rodadas", painel: "rh-clima" } as const;

/**
 * Só entram formulários ativos e com perguntas: é o que `criarRodada` aceita, e
 * oferecer um rascunho seria convidar ao erro do servidor.
 */
export const formularioUsavel = (f: FormularioResumo) => f.status === "ativo" && f.campos > 0;

const TITULO = "Nova Rodada de Avaliação";
const DESCRICAO = "Um link aberto que os colaboradores respondem sem se identificar";

/**
 * Nova rodada de avaliação: título, o formulário cujas perguntas o colaborador
 * responde e o texto do topo da página pública. Sem formulário usável, a janela
 * diz onde montar um em vez de mostrar uma lista vazia.
 */
export function ModalNovaRodada({
  aberto,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (id: number) => void;
}) {
  // Monta a cada abertura: os campos nascem vazios.
  if (!aberto) return null;
  return <FormularioNovaRodada onFechar={onFechar} onCriada={onCriada} />;
}

/** A mesma janela parada, para o catálogo, com a lista de formulários dada. */
export function NovaRodadaEstatica({ formularios }: { formularios: FormularioResumo[] }) {
  return <FormularioNovaRodada onFechar={() => {}} onCriada={() => {}} estatico={formularios} />;
}

function FormularioNovaRodada({
  onFechar,
  onCriada,
  estatico,
}: {
  onFechar: () => void;
  onCriada: (id: number) => void;
  /** No catálogo: a lista vem pronta e nada vai ao servidor. */
  estatico?: FormularioResumo[];
}) {
  const id = useId();
  const qc = useQueryClient();
  const consulta = useFormulariosRh(!estatico);
  const lista = estatico ?? consulta.data;
  const usaveis = (lista ?? []).filter(formularioUsavel);

  const [titulo, setTitulo] = useState("");
  const [formularioId, setFormularioId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<{ titulo?: string; formulario?: string }>({});
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    const novos = {
      titulo: titulo.trim() ? undefined : "Dê um título à rodada.",
      formulario: formularioId ? undefined : "Escolha o formulário.",
    };
    setErros(novos);
    if (novos.titulo || novos.formulario || estatico) return;
    setSalvando(true);
    try {
      const r = await mutar<{ id: number; slug: string }>("/api/rh/clima", "POST", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        formularioId: Number(formularioId),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: [CHAVES_CLIMA.rodadas] }),
        qc.invalidateQueries({ queryKey: ["rh-painel"] }),
      ]);
      avisar.ok("Rodada criada");
      onCriada(r.id);
    } catch (e) {
      avisar.erro("Não deu para criar a rodada", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const carregandoLista = !estatico && consulta.isLoading;
  const semUsavel = lista != null && usaveis.length === 0;

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        criar();
      }}
    >
      <Rotulado rotulo="Título" htmlFor={`${id}-titulo`} erro={erros.titulo}>
        <Campo
          id={`${id}-titulo`}
          data-autofoco
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            if (erros.titulo) setErros((s) => ({ ...s, titulo: undefined }));
          }}
          aria-invalid={!!erros.titulo}
          placeholder="Ex.: Avaliação da empresa, 2º semestre de 2026"
        />
      </Rotulado>

      <Rotulado
        rotulo="Formulário"
        erro={erros.formulario}
        ajuda={semUsavel ? undefined : "Só aparecem os ativos e com perguntas."}
      >
        <Combo
          rotuloAcessivel="Formulário"
          icone="relatorio"
          desabilitado={carregandoLista || semUsavel}
          placeholder={carregandoLista ? "Carregando formulários" : "Escolher formulário"}
          opcoes={usaveis.map((f) => ({
            valor: String(f.id),
            rotulo: f.nome,
            detalhe: `${num(f.campos)} ${f.campos === 1 ? "pergunta" : "perguntas"}`,
          }))}
          valor={formularioId}
          onMudar={(v) => {
            setFormularioId(v);
            setErros((s) => ({ ...s, formulario: undefined }));
          }}
        />
      </Rotulado>
      {!estatico && consulta.isError && (
        <Nota tom="perigo" icone="erro">
          {(consulta.error as Error).message}
        </Nota>
      )}
      {semUsavel && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Nota tom="atencao" icone="alerta">
            Nenhum formulário ativo com perguntas.
          </Nota>
          <BotaoLink href="/rh/formularios" iconeFim="seta-direita">
            Montar em Formulários
          </BotaoLink>
        </div>
      )}

      <Rotulado
        rotulo="Descrição"
        htmlFor={`${id}-descricao`}
        ajuda="Opcional. Aparece no topo da página de quem responde."
      >
        <AreaTexto
          id={`${id}-descricao`}
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Queremos saber como está o dia a dia na Navecon. Leva uns cinco minutos."
        />
      </Rotulado>

      <Nota>A rodada já nasce aberta, com o link pronto para divulgar.</Nota>
    </form>
  );

  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="mais" type="submit" form={id} carregando={salvando} disabled={semUsavel}>
        Criar rodada
      </Botao>
    </>
  );

  if (estatico)
    return (
      <PainelModal estatico titulo={TITULO} descricao={DESCRICAO} rodape={rodape} onFechar={onFechar}>
        {corpo}
      </PainelModal>
    );
  return (
    <Modal
      aberto
      titulo={TITULO}
      descricao={DESCRICAO}
      rodape={rodape}
      onFechar={onFechar}
      fecharNoVeu={false}
    >
      {corpo}
    </Modal>
  );
}
