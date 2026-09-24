"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { exportarCSV, imprimirPDF } from "@/lib/exportar";
import type { ModuloId } from "@/lib/modulos";

type Celula = string | number | null | undefined;

/** Um recorte exportável. `montar` só roda no clique: fechado, o menu não custa nada. */
export interface CorteExportar {
  id: string;
  rotulo: string;
  /** Nome do arquivo, sem extensão. */
  nome: string;
  montar: () => { cabecalhos: string[]; linhas: Celula[][] };
}

/**
 * Um botão de exportar por tela, com os recortes dela (a lista, o ranking, a
 * série). Cada arquivo sai como está na tela, com o recorte aplicado, e toda
 * exportação vai para a trilha de auditoria.
 */
export function MenuExportar({
  modulo,
  cortes,
  imprimir,
  desabilitado,
}: {
  modulo: ModuloId;
  cortes: CorteExportar[];
  /** Oferece "Imprimir ou salvar em PDF" com esse nome na trilha. */
  imprimir?: string;
  desabilitado?: boolean;
}) {
  const itens: ItemMenu[] = [
    ...(cortes.length > 1 ? [{ tipo: "titulo" as const, rotulo: "Planilha (CSV)" }] : []),
    ...cortes.map((c) => ({
      rotulo: cortes.length > 1 ? c.rotulo : "Planilha (CSV)",
      icone: "planilha" as const,
      aoEscolher: () => {
        const { cabecalhos, linhas } = c.montar();
        exportarCSV(modulo, c.nome, cabecalhos, linhas);
      },
    })),
    ...(imprimir
      ? [
          { tipo: "separador" as const },
          { rotulo: "Imprimir ou salvar em PDF", icone: "imprimir" as const, aoEscolher: () => imprimirPDF(modulo, imprimir) },
        ]
      : []),
  ];
  return (
    <Menu
      itens={itens}
      larguraMin={240}
      gatilho={(p) => (
        <Botao {...p} variante="secundario" icone="baixar" disabled={desabilitado || !cortes.length}>
          Exportar
        </Botao>
      )}
    />
  );
}
