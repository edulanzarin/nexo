"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { mutar } from "@/hooks/mutar";
import { dataHoraBR, documento, num } from "@/lib/format";
import type { EmpresaCarteira } from "@/lib/obrigacoes";
import type { EntregaFila } from "@/lib/obrigacoes-tipos";
import { TabelaEntregasFila } from "./fila-tabelas";

/*
 * Consulta de UMA empresa direto no Acessórias. É o avesso da varredura: uma
 * empresa custa uma chamada (cerca de 1 s), porque o CNPJ é a única chave que a
 * API aceita. A rota grava o que leu no retrato, então a consulta também
 * atualiza aquela empresa na fila.
 */

/** Chave da fila materializada. A Configurações invalida por ela depois de varrer. */
export const CHAVE_FILA = "obrigacoes-fila";
/** Chave da carteira do Acessórias (`/api/obrigacoes/empresas`). */
export const CHAVE_CARTEIRA = "obrigacoes-carteira";

export interface ResultadoConsulta {
  /** CNPJ ou CPF como a API devolve, com pontuação. */
  cnpj: string;
  empresa: string | null;
  /** Só as entregas dos setores da seção. */
  fila: EntregaFila[];
  /** Quando a resposta chegou. */
  em: string;
}

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** CNPJ com 14 dígitos ou CPF com 11: é o que a rota aceita. */
export const documentoValido = (v: string) => {
  const n = soDigitos(v).length;
  return n === 14 || n === 11;
};

/**
 * O pedido ao Acessórias e o estado dele. Depois da resposta, a fila e a
 * carteira (quem tem fila) são invalidadas: a rota acabou de regravá-las.
 */
export function useConsultaAcessorias(secao: string) {
  const qc = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  // Só o último pedido escreve na tela: trocar de empresa no meio de uma
  // consulta não pode pôr a pendência de uma sob o nome da outra.
  const ultimo = useRef(0);

  async function consultar(doc: string) {
    const digitos = soDigitos(doc);
    if (!documentoValido(digitos)) return;
    const id = ++ultimo.current;
    setBuscando(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await mutar<Omit<ResultadoConsulta, "em">>(
        `/api/obrigacoes/empresa?secao=${encodeURIComponent(secao)}&cnpj=${digitos}`,
        "POST"
      );
      if (id !== ultimo.current) return;
      setResultado({ ...r, em: new Date().toISOString() });
      void qc.invalidateQueries({ queryKey: [CHAVE_FILA] });
      void qc.invalidateQueries({ queryKey: [CHAVE_CARTEIRA] });
    } catch (e) {
      if (id !== ultimo.current) return;
      setErro(e instanceof Error ? e.message : "O Acessórias não respondeu.");
    } finally {
      if (id === ultimo.current) setBuscando(false);
    }
  }

  function limpar() {
    ultimo.current++;
    setBuscando(false);
    setErro(null);
    setResultado(null);
  }

  return { consultar, limpar, buscando, erro, resultado };
}

/**
 * O painel da consulta. Parado, é só o cabeçalho com o campo: a ferramenta
 * fica à mão sem empurrar a fila para baixo. Com a empresa do topo, o campo
 * chega preenchido; se ela tem mais de um CNPJ na carteira, vira escolha.
 */
export function PainelConsultaAcessorias({
  documento: doc,
  onDocumento,
  opcoes,
  nota,
  onConsultar,
  buscando,
  erro,
  resultado,
  comSetor = true,
}: {
  documento: string;
  onDocumento: (v: string) => void;
  /** Os CNPJs da empresa do topo, quando ela tem mais de um na carteira. */
  opcoes?: EmpresaCarteira[];
  /** Recado sobre a carteira, no lugar do texto de apoio. */
  nota?: ReactNode;
  onConsultar: () => void;
  buscando?: boolean;
  erro?: string | null;
  resultado?: ResultadoConsulta | null;
  comSetor?: boolean;
}) {
  const valido = documentoValido(doc);
  const qtdDigitos = soDigitos(doc).length;

  let corpo: ReactNode;
  if (buscando) corpo = <EsqueletoTabela linhas={3} colunas={5} />;
  else if (erro)
    corpo = (
      <div className="p-4">
        <PainelErro
          titulo="Não deu para consultar o Acessórias"
          mensagem={erro}
          onTentar={valido ? onConsultar : undefined}
        />
      </div>
    );
  else if (resultado)
    corpo = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-linha px-4 py-2.5">
          <span className="min-w-0 truncate text-corpo font-[600] text-tinta">
            {resultado.empresa ?? documento(resultado.cnpj)}
          </span>
          {resultado.empresa && <span className="num text-pequeno text-apagado">{documento(resultado.cnpj)}</span>}
          <span className="num text-pequeno text-apagado sm:ml-auto">
            {resultado.fila.length > 0 &&
              `${num(resultado.fila.length)} ${resultado.fila.length === 1 ? "pendente" : "pendentes"} · `}
            Consultado em {dataHoraBR(resultado.em)}
          </span>
        </div>
        {resultado.fila.length === 0 ? (
          <Vazio
            compacto
            icone="ok"
            titulo="Nada pendente nesta seção"
            descricao="O Acessórias não tem entrega em aberto desta empresa."
          />
        ) : (
          <TabelaEntregasFila
            rotulo="Entregas pendentes da empresa"
            itens={resultado.fila}
            semEmpresa
            comSetor={comSetor}
            alturaMax="22rem"
          />
        )}
      </>
    );
  else
    corpo = (
      <div className="px-4 py-3">
        <Nota>
          {nota ??
            (qtdDigitos > 0 && !valido
              ? "O CNPJ tem 14 dígitos e o CPF, 11."
              : "A consulta também atualiza o retrato da empresa na fila.")}
        </Nota>
      </div>
    );

  return (
    <Painel
      titulo="Consulta no Acessórias"
      descricao="As pendências de uma empresa, lidas agora"
      corpo="p-0"
      rodape={resultado && !buscando ? <Nota>O retrato desta empresa na fila já foi atualizado.</Nota> : undefined}
      acoes={
        <form
          className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido && !buscando) onConsultar();
          }}
        >
          {opcoes && opcoes.length > 1 ? (
            <Combo
              icone="empresa"
              opcoes={opcoes.map((o) => ({ valor: o.cnpj, rotulo: o.razao, detalhe: documento(o.cnpj) }))}
              valor={doc || null}
              onMudar={onDocumento}
              placeholder="Escolha o CNPJ"
              className="w-full sm:w-72"
              larguraMin={360}
              rotuloAcessivel="CNPJ da empresa"
            />
          ) : (
            <Campo
              icone="empresa"
              value={doc}
              onChange={(e) => onDocumento(e.target.value)}
              placeholder="CNPJ ou CPF"
              inputMode="numeric"
              autoComplete="off"
              maxLength={18}
              aria-label="CNPJ ou CPF da empresa"
              classeCaixa="min-w-0 flex-1 sm:w-52 sm:flex-none"
            />
          )}
          <Botao type="submit" icone="buscar" carregando={buscando} disabled={!valido}>
            Consultar
          </Botao>
        </form>
      }
    >
      {corpo}
    </Painel>
  );
}
