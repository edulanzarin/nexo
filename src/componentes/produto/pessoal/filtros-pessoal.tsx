"use client";

import { useCallback } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { ComboMulti, type Opcao } from "@/componentes/primitivos/combo";
import { PainelErro } from "@/componentes/primitivos/estados";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { cn } from "@/lib/cn";
import {
  contarFolhaSelecao,
  FOLHA_SELECAO_VAZIA,
  serializarFolhaSelecao,
  type FolhaSelecao,
} from "@/lib/folha-filtros";
import { num } from "@/lib/format";
import type { FolhaFiltros, FolhaOpcao } from "@/lib/types";

/*
 * Os filtros de pessoal: estabelecimento, setor, cargo, vínculo e horário. São
 * da empresa (o setor de uma não existe na outra), então não sobem para o
 * contexto do topo; moram na tela, aplicam na hora e entram na query junto do
 * recorte executado. A Rotatividade do DP estreia; o RH usa a mesma faixa.
 */

export type DimensaoFiltro = keyof FolhaSelecao;

const DIMENSOES: {
  chave: DimensaoFiltro;
  opcoes: keyof FolhaFiltros;
  titulo: string;
  todas: string;
  plural: string;
  icone: NomeIcone;
}[] = [
  { chave: "estabs", opcoes: "estabelecimentos", titulo: "Estabelecimento", todas: "Todos os estabelecimentos", plural: "estabelecimentos", icone: "empresa" },
  { chave: "setores", opcoes: "setores", titulo: "Setor", todas: "Todos os setores", plural: "setores", icone: "camadas" },
  { chave: "cargos", opcoes: "cargos", titulo: "Cargo", todas: "Todos os cargos", plural: "cargos", icone: "usuario" },
  { chave: "vinculos", opcoes: "vinculos", titulo: "Vínculo", todas: "Todos os vínculos", plural: "vínculos", icone: "contrato" },
  { chave: "horarios", opcoes: "horarios", titulo: "Horário", todas: "Todos os horários", plural: "horários", icone: "relogio" },
];

const INICIAL: { empresa: string | null; sel: FolhaSelecao } = { empresa: null, sel: FOLHA_SELECAO_VAZIA };

/**
 * Marcar A e depois B ou B e depois A é o mesmo recorte: a lista sai ordenada
 * para a chave de cache não dizer que são dois.
 */
function canonica(sel: FolhaSelecao): FolhaSelecao {
  const ordenar = (l: string[]) => [...l].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    estabs: ordenar(sel.estabs),
    setores: ordenar(sel.setores),
    cargos: ordenar(sel.cargos),
    vinculos: ordenar(sel.vinculos),
    horarios: ordenar(sel.horarios),
  };
}

/**
 * A seleção da tela, presa à empresa em que foi feita. Trocar de empresa não
 * precisa de efeito que limpe: a seleção guardada é de outra empresa, então a
 * leitura devolve vazio, e voltar para a primeira reencontra o que estava.
 *
 * `qs` é o pedaço da query que a seleção acrescenta ao recorte executado.
 */
export function useSelecaoPessoal(empresa: string | null) {
  const [estado, setEstado] = useEstadoTela("selecao-pessoal", INICIAL);
  const sel = estado.empresa === empresa ? estado.sel : FOLHA_SELECAO_VAZIA;
  const mudar = useCallback(
    (nova: FolhaSelecao) => setEstado({ empresa, sel: canonica(nova) }),
    [empresa, setEstado]
  );
  return { sel, mudar, filtrada: contarFolhaSelecao(sel) > 0, qs: serializarFolhaSelecao(sel) };
}

/**
 * Os filtros ativos por extenso, pelo rótulo que a pessoa escolheu. Vai para o
 * cabeçalho do papel: relatório filtrado que não diz que está filtrado engana
 * quem lê depois, ainda mais com uma linha escrita "Total".
 */
export function resumoFiltros(
  sel: FolhaSelecao,
  opcoes: FolhaFiltros | undefined
): { rotulo: string; valor: string }[] {
  return DIMENSOES.filter((d) => sel[d.chave].length > 0).map((d) => ({
    rotulo: d.titulo,
    valor: sel[d.chave].map((v) => opcoes?.[d.opcoes].find((o) => o.valor === v)?.rotulo ?? v).join(", "),
  }));
}

const paraOpcao = (o: FolhaOpcao): Opcao => ({ valor: o.valor, rotulo: o.rotulo, detalhe: num(o.contratos) });

/**
 * A faixa de filtros no topo da tela. As opções vêm sem a seleção aplicada: a
 * lista não encolhe conforme se marca, e o número ao lado de cada opção é de
 * contratos da empresa inteira.
 */
export function FaixaFiltrosPessoal({
  opcoes,
  sel,
  onMudar,
  erro,
  onTentar,
  className,
}: {
  /** Indefinido enquanto carrega: os controles ficam no lugar, travados. */
  opcoes: FolhaFiltros | undefined;
  sel: FolhaSelecao;
  onMudar: (sel: FolhaSelecao) => void;
  erro?: string | null;
  onTentar?: () => void;
  className?: string;
}) {
  if (erro)
    return (
      <PainelErro
        titulo="Não deu para carregar os filtros"
        mensagem={erro}
        onTentar={onTentar}
        className={cn("nx-sem-papel", className)}
      />
    );
  const marcados = contarFolhaSelecao(sel);
  return (
    <div className={cn("nx-sem-papel flex flex-wrap items-center gap-2", className)}>
      {DIMENSOES.map((d) => {
        const lista = opcoes?.[d.opcoes] ?? [];
        const valor = sel[d.chave];
        return (
          <ComboMulti
            key={d.chave}
            opcoes={lista.map(paraOpcao)}
            valor={valor}
            onMudar={(v) => onMudar({ ...sel, [d.chave]: v })}
            rotuloTodas={d.todas}
            plural={d.plural}
            icone={d.icone}
            className="w-56"
            larguraMin={300}
            // Com uma opção só não há o que recortar: a empresa de um
            // estabelecimento teria um filtro que não muda nada.
            desabilitado={!opcoes || (lista.length < 2 && valor.length === 0)}
            rotuloAcessivel={`Filtrar por ${d.titulo.toLowerCase()}`}
          />
        );
      })}
      {marcados > 0 && (
        <Botao variante="fantasma" icone="fechar" onClick={() => onMudar(FOLHA_SELECAO_VAZIA)}>
          Limpar filtros
        </Botao>
      )}
    </div>
  );
}
