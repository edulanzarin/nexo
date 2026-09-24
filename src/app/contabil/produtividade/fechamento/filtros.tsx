"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ComboMulti } from "@/componentes/primitivos/combo";
import { num } from "@/lib/format";
import type { EstadoGrupos, GrupoCarteira } from "@/lib/carteira-grupos-tipos";
import { SEM_RESPONSAVEL, type AnalistaCarteira, type EstadoCarteira } from "@/lib/carteira-setores-tipos";
import { useConsulta } from "@/hooks/use-consulta";

export const URL_ANALISTAS = "/api/contabil/produtividade-fechamento-analistas";
export const URL_GRUPOS = "/api/contabil/produtividade-fechamento-grupos";
export const URL_CARTEIRA = "/api/contabil/produtividade-fechamento-carteira";

/** De quanto em quanto tempo a tela pergunta pela varredura em curso. */
const BATIDA = 3_000;

/**
 * Consulta de uma varredura do Acessórias. Enquanto ela roda, pergunta de três
 * em três segundos: dois minutos (ou treze) sem sinal nenhum é indistinguível de
 * tela travada, e o servidor grava o progresso a cada página.
 *
 * O intervalo sai do último estado em cache: quando a resposta diz que parou,
 * o próximo desenho já pede sem intervalo.
 */
function useVarredura<T>(chave: string, url: string, rodando: (t: T) => boolean) {
  const qc = useQueryClient();
  const ultimo = qc.getQueryData<T>([chave, url]);
  return useConsulta<T>(chave, url, { refetchInterval: ultimo && rodando(ultimo) ? BATIDA : false });
}

export function useEstadoCarteira() {
  return useVarredura<EstadoCarteira>("carteira-acessorias", URL_CARTEIRA, (e) => e.rodando != null);
}

export function useGruposAcessorias() {
  return useVarredura<{ grupos: GrupoCarteira[]; estado: EstadoGrupos }>(
    "grupos-acessorias",
    URL_GRUPOS,
    (r) => r.estado.rodando != null
  );
}

/** Rota própria (e não campo da resposta) para o filtro funcionar antes do primeiro Executar. */
export function useAnalistasCarteira() {
  return useConsulta<{ analistas: AnalistaCarteira[] }>("analistas-carteira", URL_ANALISTAS);
}

/**
 * Os dois filtros da aba moram na URL (`grupos_acess` e `analista`), porque é
 * recorte que se compartilha: "olha o fechamento do grupo X" é um link, não um
 * passo a passo. O contexto do topo reescreve só as chaves dele, então trocar
 * a empresa não apaga estes.
 *
 * Analista vai um por parâmetro, repetido: nome de pessoa pode ter vírgula, e
 * juntar com separador faria um nome virar dois.
 */
export function useFiltrosFechamento() {
  const sp = useSearchParams();
  const grupos = useMemo(
    () =>
      (sp.get("grupos_acess") ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    [sp]
  );
  const analistas = useMemo(() => sp.getAll("analista").filter(Boolean), [sp]);

  const gravar = useCallback((mudar: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(window.location.search);
    mudar(p);
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, []);

  const setGrupos = useCallback(
    (novos: number[]) =>
      gravar((p) => {
        if (novos.length) p.set("grupos_acess", novos.join(","));
        else p.delete("grupos_acess");
      }),
    [gravar]
  );

  const setAnalistas = useCallback(
    (novos: string[]) =>
      gravar((p) => {
        p.delete("analista");
        for (const a of novos) p.append("analista", a);
      }),
    [gravar]
  );

  return { grupos, analistas, setGrupos, setAnalistas };
}

/** A query da consulta: o recorte executado mais os filtros próprios da aba. */
export function qsFechamento(qs: string, grupos: number[], analistas: string[]): string {
  const p = new URLSearchParams(qs);
  if (grupos.length) p.set("grupos_acess", grupos.join(","));
  for (const a of analistas) p.append("analista", a);
  return p.toString();
}

const ROTULO_SEM_RESPONSAVEL = "Sem responsável";

/**
 * Filtro por ANALISTA: o responsável pelo setor Contábil na carteira do
 * Acessórias, o mesmo nome da coluna Analista. O valor é o NOME como o
 * Acessórias escreve, que é o que a carteira guarda. Marcadores de fluxo
 * ("Entrada Empresas") aparecem como qualquer analista: escondê-los esconderia
 * quantas empresas estão sem dono de verdade. As sem responsável nenhum são uma
 * opção própria.
 *
 * Várias de uma vez porque carteiras se somam: cobrar um time é marcar os
 * nomes dele.
 */
export function FiltroAnalista({ valor, onMudar }: { valor: string[]; onMudar: (v: string[]) => void }) {
  const { data } = useAnalistasCarteira();
  const opcoes = useMemo(
    () =>
      (data?.analistas ?? []).map((a) => ({
        valor: a.nome ?? SEM_RESPONSAVEL,
        rotulo: a.nome ?? ROTULO_SEM_RESPONSAVEL,
        detalhe: `${num(a.empresas)} emp.`,
      })),
    [data]
  );
  return (
    <ComboMulti
      opcoes={opcoes}
      valor={valor}
      onMudar={(v) => onMudar([...v].sort((a, b) => a.localeCompare(b, "pt-BR")))}
      rotuloTodas="Todos os analistas"
      plural="analistas"
      icone="usuario"
      busca
      className="w-52"
      larguraMin={300}
      desabilitado={!data || opcoes.length === 0}
      rotuloAcessivel="Filtrar por analista"
    />
  );
}

/**
 * Filtro por GRUPO DE EMPRESA DO ACESSÓRIAS. Existe ao lado do grupo do
 * próprio NaveX (o do topo), e por isso diz de onde vem: um seletor escrito só
 * "Grupo" numa tela onde há dois é convite a filtrar pelo errado e concluir que
 * o sistema perdeu empresa. Manda só os ids; quem traduz grupo em CNPJ é o
 * servidor.
 */
export function FiltroGrupoAcessorias({ valor, onMudar }: { valor: number[]; onMudar: (v: number[]) => void }) {
  const { data } = useGruposAcessorias();
  const opcoes = useMemo(
    () =>
      (data?.grupos ?? []).map((g) => ({
        valor: String(g.id),
        rotulo: g.ativo ? g.nome : `${g.nome} (inativo)`,
        detalhe: `${num(g.empresas)} emp.`,
      })),
    [data]
  );
  return (
    <ComboMulti
      opcoes={opcoes}
      valor={valor.map(String)}
      onMudar={(v) => onMudar(v.map(Number).sort((a, b) => a - b))}
      rotuloTodas="Grupos do Acessórias"
      plural="grupos do Acessórias"
      icone="camadas"
      busca
      className="w-56"
      larguraMin={320}
      desabilitado={!data || opcoes.length === 0}
      rotuloAcessivel="Filtrar por grupo do Acessórias"
    />
  );
}
