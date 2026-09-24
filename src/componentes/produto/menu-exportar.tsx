"use client";

import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { exportarCSV, imprimirPDF } from "@/lib/exportar";
import { num } from "@/lib/format";
import type { ModuloId } from "@/lib/modulos";

type Celula = string | number | null | undefined;
type Tabela = { cabecalhos: string[]; linhas: Celula[][] };

/**
 * Um recorte exportável. `montar` só roda no clique: fechado, o menu não custa
 * nada. Pode ser assíncrono, para o recorte que busca o conjunto inteiro no
 * servidor (a tela mostra uma página, o arquivo leva todas).
 */
export interface CorteExportar {
  id: string;
  rotulo: string;
  /** O que o arquivo leva, quando o rótulo não basta. */
  descricao?: string;
  /** Nome do arquivo, sem extensão. */
  nome: string;
  montar: () => Tabela | Promise<Tabela>;
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
  const exportar = async (c: CorteExportar) => {
    try {
      const { cabecalhos, linhas } = await c.montar();
      if (!linhas.length) {
        avisar.info("Nada para exportar neste recorte");
        return;
      }
      exportarCSV(modulo, c.nome, cabecalhos, linhas);
      avisar.ok(`${num(linhas.length)} ${linhas.length === 1 ? "linha exportada" : "linhas exportadas"}`, `${c.nome}.csv`);
    } catch (e) {
      avisar.erro("Não deu para exportar", e instanceof Error ? e.message : undefined);
    }
  };

  const itens: ItemMenu[] = [
    ...(cortes.length > 1 ? [{ tipo: "titulo" as const, rotulo: "Planilha (CSV)" }] : []),
    ...cortes.map((c) => ({
      rotulo: cortes.length > 1 ? c.rotulo : "Planilha (CSV)",
      descricao: c.descricao,
      icone: "planilha" as const,
      aoEscolher: () => void exportar(c),
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
      larguraMin={260}
      gatilho={(p) => (
        <Botao {...p} variante="secundario" icone="baixar" disabled={desabilitado || (!cortes.length && !imprimir)}>
          Exportar
        </Botao>
      )}
    />
  );
}
