"use client";

import { BotaoIcone } from "@/componentes/primitivos/botao";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { num } from "@/lib/format";

/**
 * Chave de quem está sendo comparado. É `number` em toda aba que lê o Questor
 * (`codigousuario` é inteiro) e `string` na aba No NaveX, cujo autor é o uuid do
 * usuário do app. As peças são genéricas na chave em vez de o payload do app
 * inventar um número só para caber aqui.
 */
export type ChavePessoa = string | number;

/**
 * O mínimo que o filtro precisa saber de alguém: quem é e quanto fez. Cada aba
 * conta uma coisa (lançamentos, exclusões, horas, registros) e traduz para cá,
 * então o filtro serve todas sem conhecer nenhuma.
 */
export interface OpcaoPessoa<K extends ChavePessoa> {
  codigo: K;
  nome: string;
  qtd: number;
  inativo?: boolean;
}

const TODOS = "\u0000todos";

/**
 * Isola uma pessoa do time no resto da tela. A lista sai do ranking que já está
 * na memória, sem ida ao banco; o número ao lado do nome é o que a aba conta,
 * para achar alguém pelo tamanho e não só pelo nome.
 *
 * Pessoa que sumiu do ranking depois de executar de novo (outro período, outra
 * empresa) volta a mostrar o time todo em vez de um nome fantasma.
 */
export function FiltroPessoa<K extends ChavePessoa>({
  pessoas,
  valor,
  onMudar,
  rotuloTodos = "Todo o time",
  formatarQtd = num,
  desabilitado,
}: {
  pessoas: OpcaoPessoa<K>[];
  valor: K | null;
  onMudar: (codigo: K | null) => void;
  rotuloTodos?: string;
  formatarQtd?: (v: number) => string;
  desabilitado?: boolean;
}) {
  const escolhida = valor != null && pessoas.some((p) => p.codigo === valor);
  const opcoes: Opcao[] = [
    { valor: TODOS, rotulo: rotuloTodos, icone: "pessoas" },
    ...pessoas.map((p) => ({
      valor: String(p.codigo),
      rotulo: p.nome,
      detalhe: p.inativo ? `desligado · ${formatarQtd(p.qtd)}` : formatarQtd(p.qtd),
    })),
  ];
  return (
    <div className="flex items-center gap-1">
      <Combo
        opcoes={opcoes}
        valor={escolhida ? String(valor) : TODOS}
        onMudar={(v) => onMudar(v === TODOS ? null : (pessoas.find((p) => String(p.codigo) === v)?.codigo ?? null))}
        icone={escolhida ? "usuario" : "pessoas"}
        busca
        className="w-56"
        larguraMin={300}
        desabilitado={desabilitado}
        rotuloAcessivel="Isolar uma pessoa"
        vazio="Ninguém com esse nome no período"
      />
      {escolhida && (
        <BotaoIcone icone="fechar" rotulo={`Voltar para ${rotuloTodos.toLowerCase()}`} onClick={() => onMudar(null)} />
      )}
    </div>
  );
}
