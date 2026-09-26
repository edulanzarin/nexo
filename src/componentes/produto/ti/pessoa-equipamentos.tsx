"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Icone } from "@/componentes/primitivos/icone";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { dataBR, num } from "@/lib/format";
import {
  chaveDaPosse,
  comAlguem,
  frasePosse,
  nomeEquipamento,
  tipoEquipamento,
  type EquipamentoLista,
  type MovimentacaoLista,
  type PessoaExterna,
  type Posse,
} from "@/lib/ti-tipos";
import { IconeTipo, Patrimonio } from "./equipamento";

/** Uma pessoa vista pela TI: quem é e o que tem em mãos. */
export interface PessoaComEquipamentos {
  chave: string;
  nome: string;
  /** O setor; para quem é de fora, a empresa ou o vínculo. */
  setor: string | null;
  cargo: string | null;
  /**
   * Precisa devolver: saiu do Diretório, ou é de fora e teve o cadastro
   * encerrado.
   */
  fora: boolean;
  /** O cadastro de fora do Diretório; `null` para quem é do Diretório. */
  externo: PessoaExterna | null;
  itens: EquipamentoLista[];
}

/** O selo da pessoa na lista e na janela: de onde ela é e se precisa devolver. */
export function SeloPessoa({ pessoa }: { pessoa: PessoaComEquipamentos }) {
  if (pessoa.externo)
    return pessoa.fora ? (
      <Selo tom="atencao" title="O cadastro de fora do Diretório foi encerrado">
        Encerrado
      </Selo>
    ) : (
      <Selo tom="rota" title="Não é do Diretório do RH: cadastro da TI">
        De fora
      </Selo>
    );
  return pessoa.fora ? (
    <Selo tom="atencao" title="Não aparece mais no Diretório do RH: pode ter saído da empresa">
      Fora do Diretório
    </Selo>
  ) : null;
}

/**
 * O que a pessoa tem, numa linha: o ícone do tipo e a etiqueta (ou o tipo,
 * quando não há etiqueta). Passando de cinco, o resto vira contagem, para a
 * linha não quebrar.
 */
export function ChipsEquipamentos({ itens, max = 5 }: { itens: EquipamentoLista[]; max?: number }) {
  if (!itens.length) return <span className="text-apagado">Nenhum</span>;
  const vistos = itens.slice(0, max);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {vistos.map((e) => (
        <span
          key={e.id}
          title={nomeEquipamento(e)}
          className="inline-flex h-6 items-center gap-1 rounded-chip bg-poco-forte px-1.5 text-pequeno text-tinta-2"
        >
          <Icone nome={tipoEquipamento(e.tipo).icone} tamanho={14} />
          <span className="num whitespace-nowrap">{e.patrimonio ?? tipoEquipamento(e.tipo).rotulo}</span>
        </span>
      ))}
      {itens.length > max && <span className="text-pequeno text-apagado">+{num(itens.length - max)}</span>}
    </span>
  );
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

const ehDela = (p: Posse | null, chave: string) => comAlguem(p) && chaveDaPosse(p) === chave;

interface PropsPessoa {
  pessoa: PessoaComEquipamentos;
  /** O registro inteiro: a janela recorta o que passou por esta pessoa. */
  movimentacoes: MovimentacaoLista[] | undefined;
  onAbrirEquipamento: (id: number) => void;
  onEntregar: () => void;
  onDevolverTudo: () => void;
  /** Só para quem é de fora: o cadastro dela é da TI. */
  onEditarExterno?: () => void;
  onFechar: () => void;
}

/**
 * A pessoa e os equipamentos dela: o que está em mãos agora e tudo o que já
 * passou por ela, recebido ou devolvido. É a tela do desligamento: devolver
 * tudo de uma vez, e conferir no histórico que nada ficou para trás.
 */
function CorpoPessoa({ pessoa, movimentacoes, onAbrirEquipamento }: Omit<PropsPessoa, "onEntregar" | "onDevolverTudo" | "onFechar">) {
  const passou = (movimentacoes ?? []).filter((m) => ehDela(m.posse, pessoa.chave) || ehDela(m.anterior, pessoa.chave));
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-pequeno font-[600] text-tinta-2">
          Em mãos{pessoa.itens.length ? ` · ${num(pessoa.itens.length)}` : ""}
        </h3>
        {pessoa.itens.length ? (
          <ul className="flex flex-col divide-y divide-linha rounded-controle border border-linha">
            {pessoa.itens.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onAbrirEquipamento(e.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-poco"
                >
                  <IconeTipo tipo={e.tipo} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-corpo text-tinta">{nomeEquipamento(e)}</span>
                    <span className="block text-pequeno">
                      <Patrimonio codigo={e.patrimonio} />
                    </span>
                  </span>
                  <span className="num text-pequeno text-apagado">desde {dataBR(e.desde)}</span>
                  <Icone nome="chevron-direita" tamanho={15} className="text-apagado" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-corpo text-apagado">Nenhum equipamento com esta pessoa hoje.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-pequeno font-[600] text-tinta-2">Histórico</h3>
        {!movimentacoes ? (
          <p className="text-corpo text-apagado">Carregando</p>
        ) : passou.length ? (
          <ol className="flex flex-col gap-2">
            {passou.map((m) => {
              // O equipamento primeiro e o que aconteceu depois: "Notebook · recebeu",
              // "Headset · baixa por perda". Com o verbo na frente, a baixa se lia
              // como "Baixa por perda Headset".
              const recebeu = ehDela(m.posse, pessoa.chave);
              const evento = recebeu ? "recebeu" : minuscula(frasePosse(m).titulo);
              return (
                <li key={m.id} className="flex items-baseline gap-3 text-corpo">
                  <span className="num w-20 shrink-0 text-pequeno text-apagado">{dataBR(m.data)}</span>
                  <span className="min-w-0">
                    <span className="text-tinta">
                      {m.equipamento.patrimonio ? `${m.equipamento.patrimonio} · ` : ""}
                      {nomeEquipamento(m.equipamento)}
                    </span>
                    <span className={recebeu ? "text-ok" : "text-apagado"}> · {evento}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-corpo text-apagado">Nenhum equipamento passou por esta pessoa.</p>
        )}
      </section>
    </div>
  );
}

function Janela({
  pessoa,
  onEntregar,
  onDevolverTudo,
  onEditarExterno,
  onFechar,
  estatico,
  children,
}: PropsPessoa & { estatico?: boolean; children: React.ReactNode }) {
  const x = pessoa.externo;
  const linha = x
    ? [x.vinculo ?? "De fora do Diretório", x.contato].filter(Boolean).join(" · ")
    : [pessoa.setor, pessoa.cargo].filter(Boolean).join(" · ") || "Sem setor";
  const descricao = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {linha}
      <SeloPessoa pessoa={pessoa} />
    </span>
  );
  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar} className="mr-auto">
        Fechar
      </Botao>
      {x && onEditarExterno && (
        <Botao variante="fantasma" icone="editar" onClick={onEditarExterno}>
          Editar cadastro
        </Botao>
      )}
      {pessoa.itens.length > 0 && (
        <Botao variante={pessoa.fora ? "primario" : "secundario"} icone="estoque" onClick={onDevolverTudo}>
          {pessoa.itens.length === 1 ? "Devolver ao estoque" : "Devolver tudo ao estoque"}
        </Botao>
      )}
      {!pessoa.fora && (
        <Botao variante="primario" icone="usuario" onClick={onEntregar}>
          Entregar equipamento
        </Botao>
      )}
    </>
  );
  if (estatico)
    return (
      <PainelModal estatico titulo={pessoa.nome} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {children}
      </PainelModal>
    );
  return (
    <Modal aberto titulo={pessoa.nome} descricao={descricao} rodape={rodape} onFechar={onFechar}>
      {children}
    </Modal>
  );
}

export function ModalPessoaTi({ pessoa, ...props }: Omit<PropsPessoa, "pessoa"> & { pessoa: PessoaComEquipamentos | null }) {
  if (!pessoa) return null;
  return (
    <Janela pessoa={pessoa} {...props}>
      <CorpoPessoa pessoa={pessoa} movimentacoes={props.movimentacoes} onAbrirEquipamento={props.onAbrirEquipamento} />
    </Janela>
  );
}

/** A janela parada, para o catálogo. */
export function PessoaTiEstatica(props: Pick<PropsPessoa, "pessoa" | "movimentacoes">) {
  const nada = () => {};
  return (
    <Janela
      {...props}
      estatico
      onAbrirEquipamento={nada}
      onEntregar={nada}
      onDevolverTudo={nada}
      onEditarExterno={nada}
      onFechar={nada}
    >
      <CorpoPessoa pessoa={props.pessoa} movimentacoes={props.movimentacoes} onAbrirEquipamento={nada} />
    </Janela>
  );
}
