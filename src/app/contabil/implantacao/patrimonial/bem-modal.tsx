"use client";

import { useId, useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { CampoNumero } from "@/componentes/produto/contabil/campo-numero";
import { brl, num } from "@/lib/format";
import { avisoDoBem } from "@/lib/patrimonial-conferencia";
import type { BemLido } from "@/lib/patrimonial-tipos";

type Editavel = Pick<BemLido, "descricao" | "aquisicao" | "valor" | "depreciacao" | "taxa">;

/**
 * Um bem do relatório, para corrigir o que a leitura pegou torto. A grade é
 * para ler e conferir; corrigir é às vezes, e por isso mora aqui. O aviso
 * recalcula enquanto se digita, com a mesma regra da tabela.
 */
export function BemModal({
  bem,
  conta,
  onSalvar,
  onRemover,
  onFechar,
}: {
  bem: BemLido;
  /** Descrição da conta de origem do bem. */
  conta: string;
  onSalvar: (mudanca: Editavel) => void;
  onRemover: () => void;
  onFechar: () => void;
}) {
  const id = useId();
  const [r, setR] = useState<Editavel>({
    descricao: bem.descricao,
    aquisicao: bem.aquisicao,
    valor: bem.valor,
    depreciacao: bem.depreciacao,
    taxa: bem.taxa,
  });
  const [confirmando, setConfirmando] = useState(false);
  const mudar = (parcial: Partial<Editavel>) => setR((a) => ({ ...a, ...parcial }));
  const aviso = avisoDoBem({ ...bem, ...r });

  return (
    <Modal
      aberto
      onFechar={onFechar}
      fecharNoVeu={false}
      titulo={`Bem ${bem.codigo}`}
      descricao={conta}
      rodape={
        <>
          {confirmando ? (
            <Botao variante="perigo" icone="apagar" onClick={onRemover} className="mr-auto">
              Confirmar: tirar do arquivo
            </Botao>
          ) : (
            <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
              Tirar do arquivo
            </Botao>
          )}
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            icone="salvar"
            disabled={!r.descricao.trim()}
            onClick={() => onSalvar({ ...r, descricao: r.descricao.trim() })}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Rotulado rotulo="Descrição" htmlFor={`${id}-descricao`}>
          <Campo
            id={`${id}-descricao`}
            data-autofoco
            value={r.descricao}
            onChange={(e) => mudar({ descricao: e.target.value })}
            aria-invalid={!r.descricao.trim()}
          />
        </Rotulado>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Rotulado rotulo="Aquisição" htmlFor={`${id}-aquisicao`}>
            <Campo
              id={`${id}-aquisicao`}
              type="date"
              value={r.aquisicao}
              onChange={(e) => mudar({ aquisicao: e.target.value })}
            />
          </Rotulado>
          <Rotulado rotulo="Valor" htmlFor={`${id}-valor`}>
            <CampoNumero id={`${id}-valor`} valor={r.valor} onMudar={(valor) => mudar({ valor })} />
          </Rotulado>
          <Rotulado rotulo="Depreciação acumulada" htmlFor={`${id}-depreciacao`}>
            <CampoNumero
              id={`${id}-depreciacao`}
              valor={r.depreciacao}
              onMudar={(depreciacao) => mudar({ depreciacao })}
            />
          </Rotulado>
          <Rotulado rotulo="Taxa anual (%)" htmlFor={`${id}-taxa`}>
            <CampoNumero id={`${id}-taxa`} valor={r.taxa} onMudar={(taxa) => mudar({ taxa })} />
          </Rotulado>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-linha pt-4 sm:grid-cols-4">
          <Par rotulo="Quantidade">
            <span className="num">{num(bem.quantidade)}</span>
          </Par>
          <Par rotulo="Valor menos depreciação">
            <span className="num">{brl(r.valor - r.depreciacao)}</span>
          </Par>
          {bem.residual != null && (
            <Par rotulo="Residual no relatório">
              <span className="num">{brl(bem.residual)}</span>
            </Par>
          )}
        </dl>
        {aviso && (
          <Nota tom="atencao" icone="alerta">
            {aviso}
          </Nota>
        )}
      </div>
    </Modal>
  );
}
