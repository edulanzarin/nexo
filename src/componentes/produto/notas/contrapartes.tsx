"use client";

import { useEffect, useState } from "react";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Esqueleto, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { cn } from "@/lib/cn";
import { documento, num } from "@/lib/format";
import type { ContraparteBusca, ContrapartesResp } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import type { ModuloNotas } from "./bloco-detalhe";

export interface PessoaSel {
  codigo: number;
  nome: string;
}

/**
 * Contrapartes com movimento no recorte, uma por linha, com quantas notas cada
 * uma tem. Só aparece quem tem nota: um campo livre deixaria digitar um nome
 * que não existe no período e descobrir depois, com a tabela vazia.
 */
export function ListaContrapartes({
  linhas,
  selecionada,
  onEscolher,
}: {
  linhas: ContraparteBusca[];
  selecionada?: number | null;
  onEscolher: (c: ContraparteBusca) => void;
}) {
  return (
    <ul className="flex flex-col">
      {linhas.map((c) => (
        <li key={c.codigo}>
          <button
            type="button"
            onClick={() => onEscolher(c)}
            className={cn(
              "flex w-full items-center gap-3 rounded-controle px-2.5 py-2 text-left transition-colors hover:bg-poco-forte",
              selecionada === c.codigo && "bg-rota-suave"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-corpo text-tinta">{c.nome}</span>
              <span className="num block truncate text-pequeno text-apagado">
                {[c.doc ? documento(c.doc) : null, c.uf].filter(Boolean).join(" · ") || "Sem documento"}
              </span>
            </span>
            <span className="num shrink-0 text-pequeno text-apagado">
              {num(c.qtd)} {c.qtd === 1 ? "nota" : "notas"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Filtro por contraparte do explorador. A busca é no servidor e paginada de 20
 * em 20: a carteira tem empresa com milhares de fornecedores, e trazer todos
 * para filtrar no navegador travaria a abertura.
 */
export function FiltroContraparte({
  aberto,
  onFechar,
  modulo,
  qs,
  tipo,
  selecionada,
  onSelecionar,
}: {
  aberto: boolean;
  onFechar: () => void;
  modulo: ModuloNotas;
  /** Recorte executado (empresas, filial, período). */
  qs: string;
  tipo: "ent" | "sai";
  selecionada: PessoaSel | null;
  onSelecionar: (p: PessoaSel | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  // A página guarda a busca a que pertence: trocar a busca volta para a
  // primeira sem precisar de efeito que zere.
  const [pag, setPag] = useState({ busca: "", n: 1 });
  const pagina = pag.busca === busca ? pag.n : 1;

  useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const url = aberto
    ? `/api/${modulo}/contrapartes?${qs}&${new URLSearchParams({ tipo, q: busca, page: String(pagina) })}`
    : null;
  const res = useConsulta<ContrapartesResp>("contrapartes", url);
  const linhas = res.data?.rows ?? [];

  const escolher = (p: PessoaSel | null) => {
    onSelecionar(p);
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Filtrar por Contraparte"
      descricao={tipo === "ent" ? "Fornecedores com nota no recorte" : "Clientes com nota no recorte"}
      corpo="flex flex-col gap-3"
      rodape={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="num flex items-center gap-2 text-pequeno text-apagado">
            Página {num(pagina)}
            {res.isFetching && <Girando />}
          </span>
          <div className="flex items-center gap-1">
            <BotaoIcone
              icone="chevron-esquerda"
              rotulo="Página anterior"
              disabled={pagina <= 1 || res.isFetching}
              onClick={() => setPag({ busca, n: pagina - 1 })}
            />
            <BotaoIcone
              icone="chevron-direita"
              rotulo="Próxima página"
              disabled={!res.data?.temMais || res.isFetching}
              onClick={() => setPag({ busca, n: pagina + 1 })}
            />
          </div>
        </div>
      }
    >
      <Campo
        data-autofoco
        icone="buscar"
        placeholder="Nome da contraparte"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {selecionada && (
        <div className="flex items-center justify-between gap-2 rounded-controle bg-rota-suave px-3 py-2">
          <span className="min-w-0 truncate text-corpo text-tinta">
            Filtrando por <span className="font-[600]">{selecionada.nome}</span>
          </span>
          <Botao variante="fantasma" icone="fechar" onClick={() => escolher(null)}>
            Limpar filtro
          </Botao>
        </div>
      )}
      {res.isError ? (
        <PainelErro mensagem={(res.error as Error).message} onTentar={() => res.refetch()} />
      ) : res.isLoading ? (
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Esqueleto key={i} className="h-9" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <Vazio
          compacto
          icone="pessoas"
          titulo={busca ? "Ninguém com esse nome no recorte" : "Nenhuma contraparte no recorte"}
          descricao={busca ? "Busque por outra parte do nome." : undefined}
        />
      ) : (
        <ListaContrapartes
          linhas={linhas}
          selecionada={selecionada?.codigo}
          onEscolher={(c) => escolher({ codigo: c.codigo, nome: c.nome })}
        />
      )}
    </Modal>
  );
}
