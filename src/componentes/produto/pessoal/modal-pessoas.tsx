"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { useConsulta } from "@/hooks/use-consulta";
import { serializarFolhaSelecao, type FolhaSelecao } from "@/lib/folha-filtros";
import { num } from "@/lib/format";
import type { FolhaMovimentacao } from "@/lib/types";
import { cabecalhoFicha, FichaBuscada, type ModuloPessoal } from "./ficha-funcionario";
import { TabelaPessoas } from "./tabela-pessoas";

/** As dimensões que a rota de pessoas sabe recortar (o `dim` dela). */
export type DimensaoDrill =
  | "setor"
  | "cargo"
  | "estab"
  | "horario"
  | "sexo"
  | "faixaEtaria"
  | "escolaridade"
  | "estadoCivil"
  | "motivo"
  | "tempoCasa";

/** O grupo clicado: a dimensão, o valor dela e o nome da dimensão para a tela. */
export interface Drill {
  dim: DimensaoDrill;
  valor: string;
  /** "Setor", "Motivo do desligamento". */
  rotulo: string;
}

/**
 * Dimensões que também são filtro da tela. A rota ACRESCENTA o grupo à lista do
 * filtro, então clicar no setor A com os setores A e B filtrados traria A e B.
 * Tirando a dimensão da seleção, sobra só o grupo, que já está dentro dela.
 */
const FILTRO_DA_DIMENSAO: Partial<Record<DimensaoDrill, keyof FolhaSelecao>> = {
  setor: "setores",
  cargo: "cargos",
  estab: "estabs",
  horario: "horarios",
};

function urlPessoas(modulo: ModuloPessoal, qs: string, sel: FolhaSelecao, drill: Drill): string {
  const filtro = FILTRO_DA_DIMENSAO[drill.dim];
  const semDim = filtro ? { ...sel, [filtro]: [] } : sel;
  const p = new URLSearchParams({ dim: drill.dim, valor: drill.valor });
  return `/api/${modulo}/pessoas?${qs}${serializarFolhaSelecao(semDim)}&${p}`;
}

/**
 * O corpo da lista do grupo, com os estados. Exportado para o catálogo mostrar
 * o modal aberto com a mesma peça.
 */
export function CorpoPessoas({
  linhas,
  erro,
  onTentar,
  onAbrir,
  desligamento,
}: {
  /** Indefinido enquanto carrega. */
  linhas: FolhaMovimentacao[] | undefined;
  erro?: string | null;
  onTentar?: () => void;
  onAbrir?: (m: FolhaMovimentacao) => void;
  /** Grupo que só existe entre desligados (motivo, tempo de casa). */
  desligamento?: boolean;
}) {
  if (erro) return <PainelErro mensagem={erro} onTentar={onTentar} />;
  if (!linhas) return <EsqueletoTabela colunas={5} linhas={6} />;
  return (
    <TabelaPessoas
      linhas={linhas}
      onAbrir={onAbrir}
      alturaMax="min(60dvh, 34rem)"
      rotulo="Pessoas do grupo"
      vazio={
        <Vazio
          compacto
          icone="pessoas"
          titulo={desligamento ? "Nenhum desligamento neste grupo" : "Ninguém entrou nem saiu deste grupo"}
          descricao={desligamento ? undefined : "A lista traz só quem foi admitido ou desligado no período."}
        />
      }
    />
  );
}

const DESLIGAMENTO: DimensaoDrill[] = ["motivo", "tempoCasa"];

/**
 * O drill de qualquer quebra: quem entrou ou saiu naquele grupo no período, e a
 * ficha de cada um. A ficha abre no MESMO modal, com o caminho de volta para a
 * lista: modal sobre modal disputa o Esc e o foco, e fechar a ficha fechava o
 * grupo junto.
 */
export function ModalPessoas({
  modulo,
  qs,
  sel,
  drill,
  onFechar,
}: {
  modulo: ModuloPessoal;
  /** O recorte executado (empresa e período), sem a seleção. */
  qs: string;
  sel: FolhaSelecao;
  drill: Drill | null;
  onFechar: () => void;
}) {
  // A pessoa aberta vale para o grupo em que foi aberta: outro grupo começa na lista.
  const [aberta, setAberta] = useState<{ drill: Drill; pessoa: FolhaMovimentacao } | null>(null);
  const pessoa = aberta && aberta.drill === drill ? aberta.pessoa : null;

  const consulta = useConsulta<FolhaMovimentacao[]>(
    "pessoal-pessoas",
    drill ? urlPessoas(modulo, qs, sel, drill) : null,
    { manterAnterior: false }
  );
  const linhas = consulta.data;
  const desligamento = drill ? DESLIGAMENTO.includes(drill.dim) : false;

  let titulo = drill?.valor ?? "";
  let descricao: string | undefined;
  if (pessoa) {
    const cab = cabecalhoFicha(pessoa);
    titulo = cab.titulo;
    descricao = cab.descricao;
  } else if (drill) {
    descricao = !linhas
      ? drill.rotulo
      : `${drill.rotulo} · ${num(linhas.length)} ${
          desligamento
            ? linhas.length === 1 ? "desligado" : "desligados"
            : linhas.length === 1 ? "pessoa entrou ou saiu" : "pessoas entraram ou saíram"
        } no período`;
  }

  return (
    <Modal
      aberto={drill != null}
      onFechar={onFechar}
      largura="g"
      titulo={titulo}
      descricao={descricao}
      rodape={
        pessoa ? (
          <>
            <Botao variante="fantasma" icone="seta-esquerda" onClick={() => setAberta(null)}>
              Voltar ao grupo
            </Botao>
            <Botao onClick={onFechar}>Fechar</Botao>
          </>
        ) : (
          <Botao onClick={onFechar}>Fechar</Botao>
        )
      }
    >
      {pessoa ? (
        <FichaBuscada modulo={modulo} empresa={pessoa.codigoempresa} contrato={pessoa.contrato} />
      ) : (
        <CorpoPessoas
          linhas={linhas}
          erro={consulta.error ? (consulta.error as Error).message : null}
          onTentar={() => consulta.refetch()}
          onAbrir={drill ? (m) => setAberta({ drill, pessoa: m }) : undefined}
          desligamento={desligamento}
        />
      )}
    </Modal>
  );
}
