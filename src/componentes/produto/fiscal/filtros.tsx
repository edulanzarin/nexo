"use client";

import { useCallback } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { ComboMulti, type Opcao } from "@/componentes/primitivos/combo";
import { ESPECIES_PROD } from "@/lib/fiscal-produtividade-tipos";
import type { Metrica } from "@/lib/types";
import { useEstadoModulo } from "@/hooks/use-estado-modulo";

/*
 * Os dois filtros que só o Fiscal tem: a espécie da nota e a métrica dos
 * rankings. Não moram no contexto do topo porque nenhum outro módulo os lê; e
 * não moram na tela porque valem pelo módulo inteiro: quem olha só NFS-e no
 * Painel continua olhando só NFS-e nas Análises e na Produtividade. Sair do
 * módulo descarta, como todo estado de módulo.
 *
 * Aplicam na hora, como todo filtro de tela: a espécie entra na query da API
 * (o `parseFilters` do servidor já a lê) e a métrica troca o que se desenha.
 */

const CHAVE_ESPECIES = "/fiscal\u0000especies";
const CHAVE_METRICA = "/fiscal\u0000metrica";

const ORDEM = ESPECIES_PROD.map((e) => e.id);

const OPCOES: Opcao[] = ESPECIES_PROD.map((e) => ({ valor: e.id, rotulo: e.rotulo }));

/**
 * A espécie escolhida e a query que a acompanha. A lista sai sempre na ordem do
 * catálogo: marcar NF-e e depois CT-e ou o contrário é o mesmo recorte, e a
 * chave de cache não pode dizer que são dois.
 */
export function useEspecies() {
  const [especies, setEspecies] = useEstadoModulo<string[]>(CHAVE_ESPECIES, []);
  const mudar = useCallback(
    (lista: string[]) => setEspecies(ORDEM.filter((id) => lista.includes(id))),
    [setEspecies]
  );
  /** A query da aba com a espécie junto. */
  const comEspecies = useCallback(
    (qs: string) => (especies.length ? `${qs}&especies=${especies.join(",")}` : qs),
    [especies]
  );
  return { especies, mudar, comEspecies };
}

export function useMetrica() {
  return useEstadoModulo<Metrica>(CHAVE_METRICA, "valor");
}

/** Espécie da nota, para o cabeçalho da tela (`AcoesPagina`). Vazio é todas. */
export function FiltroEspecies({ desabilitado }: { desabilitado?: boolean }) {
  const { especies, mudar } = useEspecies();
  return (
    <ComboMulti
      opcoes={OPCOES}
      valor={especies}
      onMudar={mudar}
      rotuloTodas="Todas as espécies"
      plural="espécies"
      icone="etiquetas"
      className="w-48"
      larguraMin={300}
      desabilitado={desabilitado}
      rotuloAcessivel="Espécie da nota"
    />
  );
}

/** Valor ou quantidade: o que o Painel e as Análises medem e ordenam. */
export function AlternadorMetrica() {
  const [metrica, setMetrica] = useMetrica();
  return (
    <Segmentado
      rotulo="Medir por valor ou por quantidade"
      opcoes={[
        { valor: "valor", rotulo: "Valor", icone: "moedas" },
        { valor: "qtd", rotulo: "Quantidade", icone: "hash" },
      ]}
      valor={metrica}
      onMudar={setMetrica}
    />
  );
}
