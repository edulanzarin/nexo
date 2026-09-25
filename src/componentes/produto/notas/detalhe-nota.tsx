"use client";

import type { ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { brl, documento, num } from "@/lib/format";
import type { NotaLista } from "@/lib/types";
import { BlocoDetalhe, legendaNota, type ModuloNotas } from "./bloco-detalhe";
import { ItensNota } from "./itens-nota";

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar.ok("Chave copiada");
  } catch {
    avisar.erro("Não deu para copiar", "Selecione a chave e copie com Ctrl+C.");
  }
}

/**
 * O corpo do detalhe de uma nota do explorador: o que não cabe na linha
 * (documento, modelo, a chave de acesso de 44 dígitos) e os itens. Os itens
 * entram por fora (`itens`): na tela vêm da API, no catálogo vêm de mentira,
 * e o corpo é o mesmo.
 */
export function CorpoNotaLista({
  nota,
  mostraEmpresa,
  itens,
}: {
  nota: NotaLista;
  mostraEmpresa?: boolean;
  itens: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Par rotulo="Valor">
          <span className={cn("num font-[600]", nota.cancelada && "text-apagado line-through")}>{brl(nota.valor)}</span>
        </Par>
        <Par rotulo="Documento">
          <span className="num">{nota.contraparteDoc ? documento(nota.contraparteDoc) : "Sem documento"}</span>
        </Par>
        <Par rotulo="Modelo">
          <span className="num">{nota.modelo ?? "Sem modelo"}</span>
        </Par>
        {mostraEmpresa && (
          <Par rotulo="Empresa">
            <span className="block truncate" title={nota.empresaNome ?? undefined}>
              {nota.empresaNome ?? `Empresa ${nota.empresa}`}
            </span>
          </Par>
        )}
      </dl>

      {nota.chaveNfe && (
        <BlocoDetalhe
          titulo="Chave de Acesso"
          acoes={<BotaoIcone icone="copiar" rotulo="Copiar chave" linha onClick={() => copiar(nota.chaveNfe!)} />}
        >
          <p className="num text-corpo break-all text-tinta-2 select-all">{nota.chaveNfe}</p>
        </BlocoDetalhe>
      )}

      <BlocoDetalhe titulo="Itens da Nota">{itens}</BlocoDetalhe>
    </div>
  );
}

/** Título do modal: a contraparte, e o selo quando a nota foi cancelada. */
export function TituloNota({ contraparte, cancelada }: { contraparte: string | null; cancelada?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate" title={contraparte ?? undefined}>
        {contraparte ?? "Nota sem contraparte"}
      </span>
      {cancelada && <Selo tom="perigo">Cancelada</Selo>}
    </span>
  );
}

/**
 * Detalhe de uma nota do explorador (Fiscal em Dados, Contábil em Notas). Abre
 * no clique da linha, que fica enxuta. `modulo` só troca a rota dos itens.
 */
export function DetalheNota({
  nota,
  tipo,
  modulo,
  mostraEmpresa,
  onFechar,
}: {
  nota: NotaLista | null;
  tipo: "ent" | "sai";
  modulo: ModuloNotas;
  mostraEmpresa?: boolean;
  onFechar: () => void;
}) {
  return (
    <Modal
      aberto={nota != null}
      onFechar={onFechar}
      largura="xg"
      titulo={nota ? <TituloNota contraparte={nota.contraparte} cancelada={nota.cancelada} /> : ""}
      descricao={nota ? legendaNota({ ...nota, doc: null }) : undefined}
      rodape={
        <Botao variante="fantasma" onClick={onFechar}>
          Fechar
        </Botao>
      }
    >
      {nota && (
        <CorpoNotaLista
          nota={nota}
          mostraEmpresa={mostraEmpresa}
          itens={<ItensNota key={nota.chave} modulo={modulo} tipo={tipo} empresa={nota.empresa} chave={nota.chave} />}
        />
      )}
    </Modal>
  );
}

/** Rótulo de número de nota com série, para a linha da tabela. */
export function NumeroNota({ numero, serie }: { numero: number; serie: string | null }) {
  return (
    <span className="num text-tinta">
      {num(numero)}
      {serie && <span className="text-apagado">/{serie}</span>}
    </span>
  );
}
