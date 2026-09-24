"use client";

import type { ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Modal } from "@/componentes/primitivos/modal";
import { RankingBarras } from "@/componentes/produto/graficos";
import { num } from "@/lib/format";
import type { ChavePessoa } from "./filtro-pessoa";

export interface PessoaNaQuebra<K extends ChavePessoa> {
  codigo: K;
  nome: string;
  qtd: number;
}

/**
 * O corpo do detalhe, exportado para o catálogo mostrar o modal aberto com a
 * mesma peça que a tela usa.
 */
export function CorpoQuebra<K extends ChavePessoa>({
  fatos,
  pessoas,
  rotuloPessoas = "Quem fez",
  formatar = num,
  aoEscolher,
}: {
  /** Os números do item, em `Par`. */
  fatos: ReactNode;
  pessoas: PessoaNaQuebra<K>[];
  rotuloPessoas?: string;
  formatar?: (v: number) => string;
  aoEscolher?: (codigo: K) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{fatos}</dl>
      <section className="flex flex-col gap-1.5">
        <h3 className="text-pequeno font-[600] text-tinta-2">{rotuloPessoas}</h3>
        <RankingBarras
          itens={pessoas}
          rotulo={(p) => p.nome}
          valor={(p) => p.qtd}
          formatar={formatar}
          aoClicar={aoEscolher ? (p) => aoEscolher(p.codigo) : undefined}
          vazio="Ninguém no período."
        />
      </section>
    </div>
  );
}

/**
 * O detalhe de um item da quebra (uma origem, uma ação): os números dele e
 * QUEM fez, na ordem de quanto fez. A lista sai do ranking que já está na
 * memória (cada pessoa carrega as próprias origens), sem ida ao banco.
 *
 * Clicar numa pessoa isola ela no resto da tela e fecha o detalhe: é o passo
 * seguinte natural de "quem mais usou esta origem?".
 */
export function ModalQuebra<K extends ChavePessoa>({
  aberto,
  onFechar,
  titulo,
  descricao,
  fatos,
  pessoas,
  rotuloPessoas,
  formatar,
  onIsolar,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  fatos: ReactNode;
  pessoas: PessoaNaQuebra<K>[];
  rotuloPessoas?: string;
  formatar?: (v: number) => string;
  onIsolar?: (codigo: K) => void;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo}
      descricao={descricao}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <CorpoQuebra
        fatos={fatos}
        pessoas={pessoas}
        rotuloPessoas={rotuloPessoas}
        formatar={formatar}
        aoEscolher={
          onIsolar
            ? (codigo) => {
                onIsolar(codigo);
                onFechar();
              }
            : undefined
        }
      />
    </Modal>
  );
}
