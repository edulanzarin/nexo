"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Vazio } from "@/componentes/primitivos/estados";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { cn } from "@/lib/cn";
import { num, pct } from "@/lib/format";
import type { TurnoverGrupo } from "@/lib/types";

/** Turnover com duas casas, como o relatório de referência do DP. */
export const pctTurnover = (v: number) => pct(v, 2);

/**
 * O tom do turnover de um grupo. As faixas são as do nexo2 e valem para o
 * índice do período inteiro: num ano, 10% é pouco; num mês, é muito. Por isso o
 * tom só colore o número e nunca vira alerta da tela.
 */
export function tomTurnover(t: number): Tom {
  if (t > 10) return "perigo";
  if (t >= 2) return "atencao";
  if (t > 0) return "ok";
  return "neutro";
}

type Total = Pick<TurnoverGrupo, "ativos" | "admissoes" | "desligamentos" | "turnover">;

/**
 * Turnover por uma dimensão (setor, cargo, horário, perfil): ativos, entradas,
 * saídas e o índice de cada grupo, com a linha de total embaixo. Clicar no
 * grupo abre quem entrou e saiu nele.
 *
 * O total some quando a busca ou o "só com movimento" escondem linhas: somado
 * sobre o que sobrou ele diria outro número, e com o nome de total.
 */
export function PainelQuebraTurnover({
  titulo,
  descricao,
  rotuloColuna,
  grupos,
  total,
  rotuloTotal = "Total da empresa",
  carregando,
  compacto,
  onGrupo,
  rodape,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Nome da primeira coluna ("Setor", "Cargo"). */
  rotuloColuna: string;
  grupos: TurnoverGrupo[] | undefined;
  total?: Total;
  /** Com filtro na tela, o total não é mais da empresa: quem chama diz o que é. */
  rotuloTotal?: string;
  carregando?: boolean;
  /** Quebra de poucos grupos (sexo, faixa etária): sem busca nem alternador. */
  compacto?: boolean;
  onGrupo?: (g: TurnoverGrupo) => void;
  rodape?: ReactNode;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const [soMovimento, setSoMovimento] = useState(false);

  const visiveis = useMemo(() => {
    if (!grupos) return undefined;
    const q = normalizar(busca.trim());
    return grupos.filter(
      (g) => (!q || normalizar(g.grupo).includes(q)) && (!soMovimento || g.admissoes + g.desligamentos > 0)
    );
  }, [grupos, busca, soMovimento]);

  const recortado = busca.trim() !== "" || soMovimento;
  const tot = total && !recortado ? total : null;

  const colunas = useMemo<Coluna<TurnoverGrupo>[]>(
    () => [
      {
        id: "grupo",
        cabecalho: rotuloColuna,
        largura: "46%",
        ordenar: (g) => g.grupo,
        classe: "font-[560] text-tinta",
        celula: (g) => (
          <span className="block truncate" title={g.grupo}>
            {g.grupo}
          </span>
        ),
        rodape: tot ? rotuloTotal : undefined,
      },
      {
        id: "ativos",
        cabecalho: "Ativos",
        alinhar: "dir",
        ordenar: (g) => g.ativos,
        celula: (g) => num(g.ativos),
        rodape: tot ? num(tot.ativos) : undefined,
      },
      {
        id: "admissoes",
        cabecalho: "Admissões",
        alinhar: "dir",
        ordenar: (g) => g.admissoes,
        celula: (g) => <span className={g.admissoes > 0 ? "text-ok" : "text-apagado"}>{num(g.admissoes)}</span>,
        rodape: tot ? num(tot.admissoes) : undefined,
      },
      {
        id: "desligamentos",
        cabecalho: "Desligamentos",
        alinhar: "dir",
        ordenar: (g) => g.desligamentos,
        celula: (g) => (
          <span className={g.desligamentos > 0 ? "text-perigo" : "text-apagado"}>{num(g.desligamentos)}</span>
        ),
        rodape: tot ? num(tot.desligamentos) : undefined,
      },
      {
        id: "turnover",
        cabecalho: "Turnover",
        alinhar: "dir",
        largura: "110px",
        ordenar: (g) => g.turnover,
        celula: (g) =>
          g.turnover > 0 ? (
            <Selo tom={tomTurnover(g.turnover)}>{pctTurnover(g.turnover)}</Selo>
          ) : (
            <span className="text-apagado">{pctTurnover(0)}</span>
          ),
        rodape: tot ? pctTurnover(tot.turnover) : undefined,
      },
    ],
    [rotuloColuna, tot, rotuloTotal]
  );

  let corpo: ReactNode;
  if (carregando || !grupos || !visiveis) {
    corpo = <EsqueletoTabela colunas={5} linhas={compacto ? 4 : 8} />;
  } else {
    corpo = (
      <TabelaDados
        colunas={colunas}
        linhas={visiveis}
        chave={(g) => g.grupo}
        onLinha={onGrupo}
        ordemInicial={{ coluna: "ativos", sentido: "desc" }}
        alturaMax={compacto ? undefined : "34rem"}
        className="print:!max-h-none print:!overflow-visible"
        rotulo={typeof titulo === "string" ? titulo : rotuloColuna}
        vazio={
          grupos.length === 0 ? (
            <Vazio compacto icone="pessoas" titulo="Nenhum contrato no período" />
          ) : (
            <Vazio
              compacto
              icone="buscar"
              titulo={soMovimento && !busca.trim() ? "Nenhum grupo com movimento" : "Nenhum grupo com essa busca"}
              acao={
                <Botao
                  variante="fantasma"
                  icone="fechar"
                  onClick={() => {
                    setBusca("");
                    setSoMovimento(false);
                  }}
                >
                  Mostrar todos
                </Botao>
              }
            />
          )
        }
      />
    );
  }

  const n = visiveis?.length ?? 0;
  return (
    <Painel
      className={cn("print:break-inside-avoid", className)}
      corpo="p-0"
      titulo={titulo}
      descricao={descricao ?? (visiveis ? `${num(n)} ${n === 1 ? "grupo" : "grupos"}` : undefined)}
      rodape={rodape}
      acoes={
        compacto ? undefined : (
          <div className="nx-sem-papel flex flex-wrap items-center gap-3">
            <Alternador ligado={soMovimento} onMudar={setSoMovimento} rotulo="Só com movimento" />
            <Campo
              icone="buscar"
              placeholder={`Buscar ${rotuloColuna.toLowerCase()}`}
              classeCaixa="w-48"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label={`Buscar ${rotuloColuna.toLowerCase()}`}
            />
          </div>
        )
      }
    >
      {corpo}
    </Painel>
  );
}
