"use client";

import { useQuery } from "@tanstack/react-query";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { buscarJson } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type { LaudoEscritoResp } from "@/lib/types";

/**
 * O laudo em prosa, escrito por IA sobre os achados do motor. Só roda no
 * clique: é o único ponto da Análise que gasta API. O servidor censura nome e
 * CNPJ antes do envio e repõe o nome no texto que volta.
 *
 * Consulta direta ao React Query, e não pelo `useConsulta`, por dois motivos
 * de custo: `retry: false` (cada tentativa é uma chamada paga, e o erro volta
 * para a pessoa decidir) e cache sem prazo (pedir de novo o mesmo recorte não
 * gasta outra vez).
 */
export function LaudoEscrito({ qs }: { qs: string }) {
  // O pedido guarda o recorte: laudo pedido para agosto não dispara sozinho
  // quando a pessoa analisa setembro.
  const [pedido, setPedido] = useEstadoTela<string | null>("laudo-pedido", null);
  const laudo = useQuery<LaudoEscritoResp>({
    queryKey: ["analise-laudo", qs],
    queryFn: () => buscarJson<LaudoEscritoResp>(`/api/contabil/analise-balancete/laudo?${qs}`),
    enabled: pedido === qs,
    staleTime: Infinity,
    retry: false,
  });
  const { data, isFetching, isError, error } = laudo;
  const paragrafos = (data?.texto ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Painel
      titulo="Laudo escrito"
      descricao="Redação por IA sobre a análise acima"
      icone="ia"
      // Sem laudo, o painel não vai para o papel: sairia um quadro vazio.
      className={cn(!data && "nx-sem-papel")}
    >
      {data ? (
        <div className="flex max-w-[82ch] flex-col gap-3">
          {paragrafos.map((p, i) => (
            <p key={i} className="text-corpo leading-6 whitespace-pre-line text-tinta-2">
              {p}
            </p>
          ))}
          <Nota icone="ia" className="nx-sem-papel mt-1">
            Redigido por IA ({data.meta.modelo}), {num(data.meta.tokensEntrada + data.meta.tokensSaida)} tokens. Confira
            antes de apresentar ao cliente.
          </Nota>
        </div>
      ) : isFetching ? (
        <div aria-busy className="flex max-w-[82ch] flex-col gap-2">
          <p className="mb-1 flex items-center gap-2 text-pequeno text-apagado">
            <Girando />
            Escrevendo o laudo
          </p>
          <Esqueleto className="w-full" />
          <Esqueleto className="w-11/12" />
          <Esqueleto className="w-4/5" />
          <Esqueleto className="mt-3 w-full" />
          <Esqueleto className="w-2/3" />
        </div>
      ) : isError ? (
        <PainelErro
          titulo="Não deu para escrever o laudo"
          mensagem={(error as Error).message}
          onTentar={() => laudo.refetch()}
        />
      ) : (
        <Vazio
          compacto
          icone="ia"
          titulo="Laudo ainda não escrito"
          descricao="A IA redige o texto a partir dos números acima. Ela recebe os valores sem o nome nem o CNPJ da empresa."
          acao={
            <Botao icone="ia" onClick={() => setPedido(qs)}>
              Escrever laudo
            </Botao>
          }
        />
      )}
    </Painel>
  );
}
