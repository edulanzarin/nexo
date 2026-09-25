"use client";

import type { ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { useConsulta } from "@/hooks/use-consulta";
import { rotuloVinculo } from "@/lib/folha-filtros";
import { brl, dataBR, documento, num } from "@/lib/format";
import type { FolhaFicha, FolhaMovimentacao } from "@/lib/types";
import { diasDesde, tempoCasa } from "./tempo-casa";

/** Quem é dono da rota: o DP lê `/api/folha/*`, o RH lê `/api/rh/*`. A ficha é a mesma. */
export type ModuloPessoal = "folha" | "rh";

/**
 * A ficha de um contrato. Sem dado anterior de reserva: trocar de pessoa com a
 * ficha da anterior na tela, mesmo por um instante, é mostrar o salário de
 * alguém no nome de outro.
 */
export function useFicha(modulo: ModuloPessoal, empresa: number | null, contrato: number | null) {
  return useConsulta<FolhaFicha>(
    "pessoal-ficha",
    empresa != null && contrato != null
      ? `/api/${modulo}/funcionario?empresa=${empresa}&contrato=${contrato}`
      : null,
    { manterAnterior: false }
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

const ou = (v: string | null | undefined) => v || "—";

/**
 * O corpo da ficha: pessoa, vínculo e contrato. Exportado para o catálogo
 * mostrar a ficha aberta com a mesma peça que a tela usa.
 */
export function CorpoFicha({ ficha: f }: { ficha: FolhaFicha }) {
  const dias = f.tempoCasaDias ?? (f.datadem ? null : diasDesde(f.dataadm));
  return (
    <div className="flex flex-col gap-5">
      <Secao titulo="Pessoa">
        <Par rotulo="CPF">
          <span className="num">{f.cpf ? documento(f.cpf) : "—"}</span>
        </Par>
        <Par rotulo="Sexo">{ou(f.sexo)}</Par>
        <Par rotulo="Idade">{f.idade != null ? `${num(f.idade)} anos` : "—"}</Par>
        <Par rotulo="Nascimento">
          <span className="num">{dataBR(f.nascimento)}</span>
        </Par>
        <Par rotulo="Escolaridade">{ou(f.escolaridade)}</Par>
        <Par rotulo="Cidade">{f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ""}` : "—"}</Par>
      </Secao>
      <Secao titulo="Vínculo">
        <Par rotulo="Cargo">{ou(f.cargo)}</Par>
        <Par rotulo="Função">{ou(f.funcao)}</Par>
        <Par rotulo="Setor">{ou(f.setor)}</Par>
        <Par rotulo="Estabelecimento">{ou(f.estabelecimento)}</Par>
        <Par rotulo="Salário">
          {f.salario != null ? (
            <>
              <span className="num">{brl(f.salario)}</span>
              {f.tipoSalario && <span className="text-apagado"> · {f.tipoSalario}</span>}
            </>
          ) : (
            "—"
          )}
        </Par>
        {/* Sem tabela de domínio no Questor, o rótulo nomeia só o 01|10 (CLT) e
            mostra o resto pelo código, igual à lista de vínculos do filtro. */}
        <Par rotulo="Vínculo">
          {f.categoria || f.tipoVinculo ? rotuloVinculo(`${f.categoria ?? ""}|${f.tipoVinculo ?? ""}`) : "—"}
        </Par>
      </Secao>
      <Secao titulo="Contrato">
        <Par rotulo="Situação">
          {f.datadem ? <Selo tom="perigo">Desligado</Selo> : <Selo tom="ok">Ativo</Selo>}
        </Par>
        <Par rotulo="Admissão">
          <span className="num">{dataBR(f.dataadm)}</span>
        </Par>
        <Par rotulo="Desligamento">
          <span className="num">{dataBR(f.datadem)}</span>
        </Par>
        <Par rotulo="Tempo de casa">{tempoCasa(dias)}</Par>
        {f.motivoDesligamento && (
          <Par rotulo="Motivo do desligamento" className="col-span-2">
            {f.motivoDesligamento}
          </Par>
        )}
      </Secao>
    </div>
  );
}

/** A ficha enquanto chega: as três seções no lugar, sem pular quando o dado vem. */
export function EsqueletoFicha() {
  return (
    <div aria-busy className="flex flex-col gap-5">
      {[6, 6, 4].map((campos, s) => (
        <div key={s} className="flex flex-col gap-2.5">
          <Esqueleto className="h-3 w-20" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {Array.from({ length: campos }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Esqueleto className="h-3 w-16" />
                <Esqueleto className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A ficha buscada, com os estados: esqueleto, erro com a mensagem do servidor, dado. */
export function FichaBuscada({
  modulo,
  empresa,
  contrato,
}: {
  modulo: ModuloPessoal;
  empresa: number;
  contrato: number;
}) {
  const q = useFicha(modulo, empresa, contrato);
  if (q.error)
    return (
      <PainelErro
        titulo="Não deu para abrir a ficha"
        mensagem={(q.error as Error).message}
        onTentar={() => q.refetch()}
      />
    );
  if (!q.data) return <EsqueletoFicha />;
  return <CorpoFicha ficha={q.data} />;
}

/** Título e descrição da ficha a partir da linha da lista: aparecem antes do dado chegar. */
export function cabecalhoFicha(m: FolhaMovimentacao) {
  return { titulo: m.nome, descricao: `${m.cargo} · contrato ${m.contrato}` };
}

/**
 * A ficha em modal, aberta de qualquer lista de pessoas. A empresa vem da
 * própria linha, não do contexto: no RH a mesma lista mistura empresas.
 *
 * A edição da ficha que o RH tem no nexo2 não mora aqui; entra quando o RH for
 * portado, como corpo alternativo deste mesmo modal.
 */
export function ModalFicha({
  modulo,
  pessoa,
  onFechar,
}: {
  modulo: ModuloPessoal;
  /** A linha clicada. Nula, o modal fica fechado. */
  pessoa: FolhaMovimentacao | null;
  onFechar: () => void;
}) {
  const cab = pessoa ? cabecalhoFicha(pessoa) : null;
  return (
    <Modal
      aberto={pessoa != null}
      onFechar={onFechar}
      titulo={cab?.titulo ?? ""}
      descricao={cab?.descricao}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      {pessoa && <FichaBuscada modulo={modulo} empresa={pessoa.codigoempresa} contrato={pessoa.contrato} />}
    </Modal>
  );
}
