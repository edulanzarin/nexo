"use client";

import { useState } from "react";
import { useCascaOpcional } from "@/componentes/casca/casca-cliente";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import type { NomeIcone } from "@/componentes/primitivos/icone";
import { Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { useCaminho } from "@/hooks/use-contexto";
import { usePreferencia } from "@/hooks/use-preferencia";
import { exportarCSV, exportarPdf, exportarXlsx, imprimirPDF } from "@/lib/exportar";
import { num } from "@/lib/format";
import { localDoCaminho, type ModuloId } from "@/lib/modulos";
import type { CapaPdf } from "@/lib/relatorio-pdf";
import { LIMITE_LINHAS_PDF, type Tabela } from "@/lib/tabela-exportar";

/**
 * Um recorte exportável. `montar` só roda no clique: fechado, o menu não custa
 * nada. Pode ser assíncrono, para o recorte que busca o conjunto inteiro no
 * servidor (a tela mostra uma página, o arquivo leva todas).
 */
export interface CorteExportar {
  id: string;
  rotulo: string;
  /** O que o arquivo leva, quando o rótulo não basta. Sai também no PDF, abaixo do título. */
  descricao?: string;
  /** Nome do arquivo, sem extensão. */
  nome: string;
  montar: () => Tabela | Promise<Tabela>;
}

export type FormatoExportar = "xlsx" | "pdf" | "csv";

export const FORMATOS_EXPORTAR: { id: FormatoExportar; rotulo: string; icone: NomeIcone; descricao: string }[] = [
  { id: "xlsx", rotulo: "Excel", icone: "planilha", descricao: "Planilha para somar e filtrar" },
  { id: "pdf", rotulo: "PDF", icone: "documento", descricao: "Relatório para imprimir ou enviar" },
  { id: "csv", rotulo: "CSV", icone: "texto", descricao: "Texto para importar em outro sistema" },
];

const formatoValido = (f: unknown): f is FormatoExportar => FORMATOS_EXPORTAR.some((x) => x.id === f);

/**
 * Os itens do menu. Com um recorte só, um item por formato; com vários, um item
 * por recorte, no formato escolhido no alto. Fora do componente para o catálogo
 * mostrar o menu aberto com os itens de verdade.
 */
export function itensExportar(
  cortes: CorteExportar[],
  formato: FormatoExportar,
  exportar: (c: CorteExportar, f: FormatoExportar) => void,
  imprimir?: () => void
): ItemMenu[] {
  const atual = FORMATOS_EXPORTAR.find((f) => f.id === formato) ?? FORMATOS_EXPORTAR[0];
  const itens: ItemMenu[] =
    cortes.length === 1
      ? FORMATOS_EXPORTAR.map((f) => ({
          rotulo: f.rotulo,
          descricao: f.descricao,
          icone: f.icone,
          aoEscolher: () => exportar(cortes[0], f.id),
        }))
      : cortes.map((c) => ({
          rotulo: c.rotulo,
          descricao: c.descricao,
          icone: atual.icone,
          aoEscolher: () => exportar(c, formato),
        }));
  if (imprimir) {
    if (itens.length) itens.push({ tipo: "separador" });
    itens.push({ rotulo: "Imprimir a tela", descricao: "Como está, com os gráficos", icone: "imprimir", aoEscolher: imprimir });
  }
  return itens;
}

/** A escolha de formato no alto do menu de vários recortes. */
export function SeletorFormato({ valor, onMudar }: { valor: FormatoExportar; onMudar: (f: FormatoExportar) => void }) {
  return (
    <Segmentado
      opcoes={FORMATOS_EXPORTAR.map((f) => ({ valor: f.id, rotulo: f.rotulo, icone: f.icone }))}
      valor={valor}
      onMudar={onMudar}
      rotulo="Formato do arquivo"
    />
  );
}

/**
 * O botão de exportar de toda tela. As telas entregam a tabela (cabeçalhos e
 * linhas, pensadas para o CSV) e o formato é problema daqui: o Excel reconhece
 * número e data sozinho, o PDF sai paginado com título e autoria. Cada arquivo
 * sai como está na tela, com o recorte aplicado, e toda exportação vai para a
 * trilha de auditoria.
 *
 * Com um recorte só, o menu lista os formatos. Com vários, lista os recortes e
 * o formato vira uma escolha no alto, lembrada entre telas: listar recorte ×
 * formato daria doze itens para quem quer um arquivo.
 */
export function MenuExportar({
  modulo,
  cortes,
  imprimir,
  desabilitado,
}: {
  modulo: ModuloId;
  cortes: CorteExportar[];
  /** Oferece "Imprimir a tela" com esse nome na trilha (a tela com gráfico ou laudo). */
  imprimir?: string;
  desabilitado?: boolean;
}) {
  const [guardado, setFormato] = usePreferencia<FormatoExportar>("exportar-formato", "xlsx");
  const formato = formatoValido(guardado) ? guardado : "xlsx";
  const [gerando, setGerando] = useState(false);
  const caminho = useCaminho();
  const casca = useCascaOpcional();

  const capa = (c: CorteExportar): CapaPdf => {
    const local = localDoCaminho(caminho);
    const partes = [local?.modulo.titulo, local?.secao.rotulo, local?.aba?.rotulo, c.descricao].filter(
      (p, i, todas): p is string => !!p && p !== c.rotulo && todas.indexOf(p) === i
    );
    const agora = new Date();
    const quando = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return {
      titulo: c.rotulo,
      contexto: partes.join(" · ") || undefined,
      autoria: casca ? `Gerado por ${casca.usuario.nome} em ${quando}` : `Gerado no NaveX em ${quando}`,
    };
  };

  const exportar = async (c: CorteExportar, f: FormatoExportar) => {
    setGerando(true);
    try {
      const tabela = await c.montar();
      const n = tabela.linhas.length;
      if (!n) {
        avisar.info("Nada para exportar neste recorte");
        return;
      }
      if (f === "pdf" && n > LIMITE_LINHAS_PDF) {
        avisar.info(`O PDF vai até ${num(LIMITE_LINHAS_PDF)} linhas`, `Este recorte tem ${num(n)}. Leve em Excel.`);
        return;
      }
      if (f === "csv") exportarCSV(modulo, c.nome, tabela.cabecalhos, tabela.linhas);
      else if (f === "xlsx") await exportarXlsx(modulo, c.nome, c.rotulo, tabela);
      else await exportarPdf(modulo, c.nome, capa(c), tabela);
      avisar.ok(`${num(n)} ${n === 1 ? "linha exportada" : "linhas exportadas"}`, `${c.nome}.${f}`);
    } catch (e) {
      avisar.erro("Não deu para exportar", e instanceof Error ? e.message : undefined);
    } finally {
      setGerando(false);
    }
  };

  const itens = itensExportar(
    cortes,
    formato,
    (c, f) => void exportar(c, f),
    imprimir ? () => imprimirPDF(modulo, imprimir) : undefined
  );

  return (
    <Menu
      itens={itens}
      larguraMin={280}
      cabecalho={cortes.length > 1 ? <SeletorFormato valor={formato} onMudar={setFormato} /> : undefined}
      gatilho={(p) => (
        <Botao
          {...p}
          variante="secundario"
          icone="baixar"
          carregando={gerando}
          disabled={desabilitado || (!cortes.length && !imprimir)}
        >
          Exportar
        </Botao>
      )}
    />
  );
}
