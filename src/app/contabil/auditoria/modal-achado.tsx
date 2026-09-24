"use client";

import { useMemo, useState } from "react";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { Nota, Vazio } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { brl, dataBR, dataHoraBR, num } from "@/lib/format";
import type { GrupoAchado, LancamentoAchado } from "@/lib/types";
import { CHECAGENS, ORIGEM, ORIGENS_MANUAIS } from "./checagens";

const POR_PAGINA = 50;

/** Quando o lançamento foi digitado: a rota manda "AAAA-MM-DD HH:MM", sem fuso. */
function quando(l: LancamentoAchado): string | null {
  return l.lancadoEm ? dataHoraBR(l.lancadoEm.replace(" ", "T")) : null;
}

/**
 * A amostra de uma checagem: os lançamentos de maior valor, a memória de
 * cálculo que torna o veredito auditável. Onde a identificação é heurística
 * (partida repetida, manual em conta de controle) é aqui que a pessoa valida.
 */
export function ModalAchado({ grupo, onFechar }: { grupo: GrupoAchado; onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const checagem = CHECAGENS[grupo.tipo];

  const filtrados = useMemo(() => {
    const partes = normalizar(busca.trim()).split(/\s+/).filter(Boolean);
    if (!partes.length) return grupo.amostra;
    return grupo.amostra.filter((l) => {
      const alvo = normalizar(
        [l.contaDeb, l.descrDeb, l.contaCred, l.descrCred, l.usuario, l.historico, ORIGEM[l.origem] ?? l.origem, l.detalhe]
          .filter((c) => c != null)
          .join(" ")
      );
      return partes.every((p) => alvo.includes(p));
    });
  }, [grupo.amostra, busca]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const soma = filtrados.reduce((s, l) => s + l.valor, 0);
  const temDetalhe = grupo.amostra.some((l) => l.detalhe);

  const colunas: Coluna<LancamentoAchado>[] = [
    { id: "data", cabecalho: "Data", largura: "92px", ordenar: (l) => l.data, celula: (l) => <span className="num">{dataBR(l.data)}</span> },
    {
      id: "deb",
      cabecalho: "Débito",
      ordenar: (l) => l.contaDeb,
      celula: (l) => <ContaTexto conta={l.contaDeb} descricao={l.descrDeb} vazio="sem débito" />,
    },
    {
      id: "cred",
      cabecalho: "Crédito",
      ordenar: (l) => l.contaCred,
      celula: (l) => <ContaTexto conta={l.contaCred} descricao={l.descrCred} vazio="sem crédito" />,
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "124px",
      ordenar: (l) => l.valor,
      classe: "font-[600] text-tinta",
      celula: (l) => brl(l.valor),
    },
    ...(temDetalhe
      ? [
          {
            id: "detalhe",
            cabecalho: "Achado",
            largura: "170px",
            ordenar: (l: LancamentoAchado) => l.detalhe,
            celula: (l: LancamentoAchado) => <span className="block truncate text-pequeno text-atencao">{l.detalhe ?? ""}</span>,
          },
        ]
      : []),
    {
      id: "origem",
      cabecalho: "Origem",
      largura: "124px",
      ordenar: (l) => l.origem,
      celula: (l) => (
        <Selo tom={ORIGENS_MANUAIS.has(l.origem) ? "atencao" : "neutro"} title={`Origem ${l.origem}`}>
          {ORIGEM[l.origem] ?? l.origem}
        </Selo>
      ),
    },
    {
      id: "quem",
      cabecalho: "Lançado por",
      largura: "176px",
      secundaria: true,
      ordenar: (l) => l.usuario,
      celula: (l) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-tinta-2">{l.usuario ?? "—"}</span>
          {quando(l) && <span className="num shrink-0 text-micro text-apagado">{quando(l)}</span>}
        </span>
      ),
    },
    {
      id: "historico",
      cabecalho: "Histórico",
      secundaria: true,
      celula: (l) =>
        l.historico ? (
          <span className="block truncate text-apagado" title={l.historico}>
            {l.historico}
          </span>
        ) : (
          <span className="text-apagado/60">—</span>
        ),
    },
  ];

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="xg"
      corpo="p-0"
      titulo={checagem?.rotulo ?? grupo.titulo}
      descricao={checagem?.criterio ?? grupo.criterio}
      rodape={
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-pequeno text-apagado">
            {num(filtrados.length)} {filtrados.length === 1 ? "lançamento" : "lançamentos"}
          </span>
          {filtrados.length > POR_PAGINA && (
            <Paginacao pagina={pag} porPagina={POR_PAGINA} total={filtrados.length} onPagina={setPagina} className="justify-center" />
          )}
          <span className="flex items-center gap-3">
            <span className="num text-corpo font-[600] text-tinta">{brl(soma)}</span>
            <Botao onClick={onFechar}>Fechar</Botao>
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
        <Campo
          icone="buscar"
          placeholder="Conta, usuário, origem ou histórico"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          classeCaixa="w-full sm:w-80"
          aria-label="Buscar na amostra"
          fim={
            busca ? (
              <BotaoIcone
                icone="fechar"
                rotulo="Limpar busca"
                linha
                onClick={() => {
                  setBusca("");
                  setPagina(1);
                }}
              />
            ) : undefined
          }
        />
        {grupo.truncado && (
          <Nota className="min-w-0 flex-1">
            Os {num(grupo.amostra.length)} de maior valor, de {num(grupo.contagem)} no período. A soma do grupo,{" "}
            {brl(grupo.valor)}, conta todos.
          </Nota>
        )}
      </div>
      <TabelaDados
        rotulo={`Lançamentos: ${checagem?.rotulo ?? grupo.titulo}`}
        colunas={colunas}
        linhas={visiveis}
        chave={(l) => l.chave}
        vazio={
          <Vazio
            compacto
            icone="buscar"
            titulo="Nenhum lançamento com esse termo"
            descricao="Busque pelo código da conta, pelo usuário, pela origem ou pelo histórico."
          />
        }
      />
    </Modal>
  );
}
