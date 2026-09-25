"use client";

import { useId } from "react";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Dica } from "@/componentes/primitivos/dica";
import { Icone, type NomeIcone } from "@/componentes/primitivos/icone";
import { Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type { CampoEntrada } from "@/lib/formularios";
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_ROTULO,
  type CampoConfig,
  type FormularioCampo,
  type TipoCampo,
} from "@/lib/formularios-tipos";

/*
 * A pergunta enquanto é editada. O editor trabalha num rascunho "achatado"
 * (opções e níveis como texto, uma por linha; mínimo e máximo como texto) e só
 * monta o `config` guardado na hora de salvar ou de desenhar a prévia: campo
 * numérico que vira número a cada tecla não deixa apagar para digitar de novo.
 */

export interface RascunhoPergunta {
  /** Identidade na tela, estável ao reordenar. Também é o id da pergunta na prévia. */
  chave: number;
  /** Id guardado. Null é pergunta nova: o servidor insere; com id, atualiza e preserva as respostas antigas. */
  id: number | null;
  tipo: TipoCampo;
  rotulo: string;
  ajuda: string;
  obrigatorio: boolean;
  /** Seleção: uma opção por linha. */
  opcoesTexto: string;
  /** Nota: um nível por linha. */
  escalaTexto: string;
  /** Pontuação: faixa aceita, em texto enquanto se digita. */
  min: string;
  max: string;
  /** A pergunta que carrega a decisão do formulário (efetivar, prorrogar, desligar). */
  decisao: boolean;
}

let sequencia = 0;
const novaChave = () => ++sequencia;

const linhas = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

const ehSelecao = (t: TipoCampo) => t === "selecao_unica" || t === "selecao_multipla";

/**
 * Decisão só em marcação de uma opção: é a resposta que vira texto único
 * ("Efetivar") para o painel. Texto livre ou várias marcas não dão uma decisão.
 */
export const aceitaDecisao = (t: TipoCampo) => t === "selecao_unica";

export function rascunhoDoCampo(c: FormularioCampo): RascunhoPergunta {
  // Nota guardada sem rótulos (só `max`) vira níveis numerados: a pergunta
  // desenha igual (a legenda some quando repete o número) e não encolhe para
  // 1 a 5 ao salvar, que é o que aconteceria se o rascunho ignorasse o `max`.
  const escala =
    c.tipo === "nota" && !c.config.escala?.length && c.config.max
      ? Array.from({ length: c.config.max }, (_, i) => String(i + 1))
      : (c.config.escala ?? []);
  return {
    chave: novaChave(),
    id: c.id,
    tipo: c.tipo,
    rotulo: c.rotulo,
    ajuda: c.ajuda ?? "",
    obrigatorio: c.obrigatorio,
    opcoesTexto: (c.config.opcoes ?? []).join("\n"),
    escalaTexto: escala.join("\n"),
    min: String(c.config.min ?? 0),
    max: String(c.config.max ?? 100),
    decisao: c.config.papel === "decisao",
  };
}

export function rascunhoNovo(tipo: TipoCampo): RascunhoPergunta {
  return {
    chave: novaChave(),
    id: null,
    tipo,
    rotulo: "",
    ajuda: "",
    obrigatorio: true,
    opcoesTexto: ehSelecao(tipo) ? "Opção 1\nOpção 2" : "",
    escalaTexto: tipo === "nota" ? "Insatisfatório\nRegular\nBom\nExcelente" : "",
    min: "0",
    max: "10",
    decisao: false,
  };
}

/** Cópia logo abaixo da original: pergunta nova (sem id) e fora da decisão, que é uma só. */
export function rascunhoDuplicado(r: RascunhoPergunta): RascunhoPergunta {
  return { ...r, chave: novaChave(), id: null, decisao: false };
}

const inteiro = (s: string): number | null => (/^-?\d+$/.test(s.trim()) ? Number(s) : null);

function configDoRascunho(r: RascunhoPergunta): CampoConfig {
  const config: CampoConfig = {};
  if (ehSelecao(r.tipo)) config.opcoes = linhas(r.opcoesTexto);
  if (r.tipo === "nota") config.escala = linhas(r.escalaTexto);
  if (r.tipo === "pontuacao") {
    config.min = inteiro(r.min) ?? 0;
    config.max = inteiro(r.max) ?? 100;
  }
  if (r.decisao && aceitaDecisao(r.tipo)) config.papel = "decisao";
  return config;
}

/** O que vai no PATCH. A ordem é a posição na tela. */
export function entradaDoRascunho(r: RascunhoPergunta, ordem: number): CampoEntrada {
  return {
    id: r.id,
    ordem,
    tipo: r.tipo,
    rotulo: r.rotulo.trim(),
    ajuda: r.ajuda.trim() || null,
    obrigatorio: r.obrigatorio,
    config: configDoRascunho(r),
  };
}

/** A pergunta como quem responde vê, para a prévia. O id é a chave: a resposta da prévia sobrevive a reordenar. */
export function campoDoRascunho(r: RascunhoPergunta, ordem: number): FormularioCampo {
  return {
    id: r.chave,
    ordem,
    tipo: r.tipo,
    rotulo: r.rotulo.trim() || "Pergunta sem enunciado",
    ajuda: r.ajuda.trim() || null,
    obrigatorio: r.obrigatorio,
    config: configDoRascunho(r),
  };
}

export interface ErrosPergunta {
  rotulo?: string;
  opcoes?: string;
  escala?: string;
  faixa?: string;
}

/**
 * O que o servidor recusaria, dito antes e no campo certo. Opção repetida e
 * escala de um nível o servidor aceita, mas saem quebradas para quem responde.
 */
export function errosDoRascunho(r: RascunhoPergunta): ErrosPergunta {
  const e: ErrosPergunta = {};
  if (!r.rotulo.trim()) e.rotulo = "Escreva a pergunta";
  if (ehSelecao(r.tipo)) {
    const ops = linhas(r.opcoesTexto);
    if (!ops.length) e.opcoes = "Informe ao menos uma opção";
    else if (new Set(ops).size < ops.length) e.opcoes = "Há opções repetidas";
  }
  if (r.tipo === "nota") {
    const niveis = linhas(r.escalaTexto);
    if (niveis.length === 1) e.escala = "Use ao menos dois níveis";
    else if (new Set(niveis).size < niveis.length) e.escala = "Há níveis repetidos";
  }
  if (r.tipo === "pontuacao") {
    const min = inteiro(r.min);
    const max = inteiro(r.max);
    if (min == null || max == null) e.faixa = "Use números inteiros";
    else if (max <= min) e.faixa = "O máximo precisa ser maior que o mínimo";
  }
  return e;
}

export const temErro = (e: ErrosPergunta) => Object.keys(e).length > 0;

// ── Escolha do tipo ───────────────────────────────────────────────────────────

const TIPO_ICONE: Record<TipoCampo, NomeIcone> = {
  texto_curto: "editar",
  texto_longo: "nota",
  selecao_unica: "ok",
  selecao_multipla: "fila",
  nota: "grafico",
  pontuacao: "hash",
};

const TIPO_DESCRICAO: Record<TipoCampo, string> = {
  texto_curto: "Resposta de uma linha",
  texto_longo: "Texto livre, em parágrafo",
  selecao_unica: "Escolhe uma das opções",
  selecao_multipla: "Marca quantas opções quiser",
  nota: "Escala de níveis, com rótulo em cada um",
  pontuacao: "Um número dentro de uma faixa",
};

/** Os tipos, com a frase do que cada um pede. Exportado para o catálogo mostrar o menu aberto. */
export function itensNovaPergunta(onEscolher: (tipo: TipoCampo) => void): ItemMenu[] {
  return TIPOS_CAMPO.map((t) => ({
    rotulo: TIPO_CAMPO_ROTULO[t],
    descricao: TIPO_DESCRICAO[t],
    icone: TIPO_ICONE[t],
    aoEscolher: () => onEscolher(t),
  }));
}

/** Adicionar pergunta: o tipo se escolhe uma vez, na criação. */
export function MenuNovaPergunta({
  onEscolher,
  variante = "secundario",
}: {
  onEscolher: (tipo: TipoCampo) => void;
  variante?: "primario" | "secundario";
}) {
  return (
    <Menu
      itens={itensNovaPergunta(onEscolher)}
      lado="bottom-start"
      larguraMin={280}
      gatilho={(p) => (
        <Botao {...p} variante={variante} icone="mais">
          Adicionar pergunta
        </Botao>
      )}
    />
  );
}

// ── A pergunta em edição ──────────────────────────────────────────────────────

/**
 * Uma pergunta no editor. O tipo fica fixo (trocar de marcação para pontuação
 * perderia as opções sem aviso); para mudar, remove e adiciona. `erros` só
 * chega depois da primeira tentativa de salvar: cobrar enunciado desde a
 * primeira tecla seria ruído.
 */
export function EditorPergunta({
  rascunho: r,
  indice,
  total,
  erros = {},
  autoFoco,
  onMudar,
  onMover,
  onDuplicar,
  onRemover,
}: {
  rascunho: RascunhoPergunta;
  indice: number;
  total: number;
  erros?: ErrosPergunta;
  autoFoco?: boolean;
  onMudar: (parcial: Partial<RascunhoPergunta>) => void;
  onMover: (direcao: -1 | 1) => void;
  onDuplicar: () => void;
  onRemover: () => void;
}) {
  const id = useId();
  const nOpcoes = linhas(r.opcoesTexto).length;
  const nNiveis = linhas(r.escalaTexto).length;
  const alturaLista = (s: string) => Math.max(3, s.split("\n").length);

  return (
    <section
      aria-label={`Pergunta ${indice + 1}`}
      className={cn("nx-vidro flex min-w-0 flex-col rounded-painel", r.decisao && "ring-1 ring-rota/40")}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-linha py-1.5 pr-2 pl-4">
        <span className="num text-medio font-[620] text-apagado">{indice + 1}.</span>
        <Selo icone={TIPO_ICONE[r.tipo]}>{TIPO_CAMPO_ROTULO[r.tipo]}</Selo>
        {r.decisao && (
          <Selo tom="rota" icone="balanca">
            Decisão
          </Selo>
        )}
        <span className="flex-1" />
        <div className="flex items-center">
          <BotaoIcone icone="seta-cima" rotulo="Subir" disabled={indice === 0} onClick={() => onMover(-1)} />
          <BotaoIcone icone="seta-baixo" rotulo="Descer" disabled={indice === total - 1} onClick={() => onMover(1)} />
          <BotaoIcone icone="copiar" rotulo="Duplicar pergunta" onClick={onDuplicar} />
          <BotaoIcone icone="apagar" rotulo="Remover pergunta" onClick={onRemover} className="hover:text-perigo" />
        </div>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <Rotulado rotulo="Pergunta" htmlFor={`${id}-rotulo`} erro={erros.rotulo}>
          <Campo
            id={`${id}-rotulo`}
            value={r.rotulo}
            onChange={(e) => onMudar({ rotulo: e.target.value })}
            placeholder="O que você quer saber?"
            aria-invalid={!!erros.rotulo}
            autoFocus={autoFoco}
            className="font-[560]"
          />
        </Rotulado>
        <Rotulado rotulo="Texto de ajuda" htmlFor={`${id}-ajuda`}>
          <Campo
            id={`${id}-ajuda`}
            value={r.ajuda}
            onChange={(e) => onMudar({ ajuda: e.target.value })}
            placeholder="Opcional. Aparece embaixo da pergunta."
          />
        </Rotulado>

        {ehSelecao(r.tipo) && (
          <Rotulado
            rotulo="Opções"
            htmlFor={`${id}-opcoes`}
            erro={erros.opcoes}
            ajuda={`Uma por linha. ${nOpcoes === 1 ? "1 opção" : `${num(nOpcoes)} opções`}.`}
          >
            <AreaTexto
              id={`${id}-opcoes`}
              value={r.opcoesTexto}
              onChange={(e) => onMudar({ opcoesTexto: e.target.value })}
              rows={alturaLista(r.opcoesTexto)}
              aria-invalid={!!erros.opcoes}
              className="min-h-0"
            />
          </Rotulado>
        )}

        {r.tipo === "nota" && (
          <Rotulado
            rotulo="Níveis da escala"
            htmlFor={`${id}-escala`}
            erro={erros.escala}
            ajuda={
              nNiveis === 0
                ? "Um por linha, na ordem em que aparecem. Vazio vira uma escala de 1 a 5."
                : `Um por linha, na ordem em que aparecem. ${num(nNiveis)} níveis.`
            }
          >
            <AreaTexto
              id={`${id}-escala`}
              value={r.escalaTexto}
              onChange={(e) => onMudar({ escalaTexto: e.target.value })}
              rows={alturaLista(r.escalaTexto)}
              aria-invalid={!!erros.escala}
              className="min-h-0"
            />
          </Rotulado>
        )}

        {r.tipo === "pontuacao" && (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-3">
              <Rotulado rotulo="Mínimo" htmlFor={`${id}-min`} className="w-28">
                <Campo
                  id={`${id}-min`}
                  inputMode="numeric"
                  value={r.min}
                  onChange={(e) => onMudar({ min: e.target.value })}
                  aria-invalid={!!erros.faixa}
                />
              </Rotulado>
              <Rotulado rotulo="Máximo" htmlFor={`${id}-max`} className="w-28">
                <Campo
                  id={`${id}-max`}
                  inputMode="numeric"
                  value={r.max}
                  onChange={(e) => onMudar({ max: e.target.value })}
                  aria-invalid={!!erros.faixa}
                />
              </Rotulado>
            </div>
            {erros.faixa && <p className="text-pequeno text-perigo">{erros.faixa}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          <Caixa marcada={r.obrigatorio} onMudar={(v) => onMudar({ obrigatorio: v })} rotulo="Obrigatória" />
          {aceitaDecisao(r.tipo) && (
            <span className="inline-flex items-center gap-1.5">
              <Caixa marcada={r.decisao} onMudar={(v) => onMudar({ decisao: v })} rotulo="Pergunta de decisão" />
              <Dica texto="A resposta desta pergunta é a decisão do formulário, como efetivar ou desligar na experiência. Só uma pergunta por formulário.">
                <Icone nome="info" tamanho={14} className="text-apagado" titulo="O que é a pergunta de decisão" />
              </Dica>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
