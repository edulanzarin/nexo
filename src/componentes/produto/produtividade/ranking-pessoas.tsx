"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarraProporcao } from "@/componentes/primitivos/barra";
import { Dica } from "@/componentes/primitivos/dica";
import { EsqueletoTabela } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type { ChavePessoa } from "./filtro-pessoa";

/** Quem está sendo comparado: o suficiente para a linha e para o recorte. */
export interface LinhaPessoa<K extends ChavePessoa = number> {
  codigo: K;
  nome: string;
  inativo: boolean;
}

/**
 * Uma coluna do ranking. `valor` ORDENA e mede a barra; `celula` é só a
 * aparência. Separar os dois deixa uma coluna de texto ("mais velha: mai/26")
 * ordenar por número sem virar comparação de string.
 */
export interface ColunaRanking<T> {
  id: string;
  rotulo: string;
  /** A regra por trás do número, na dica do cabeçalho. */
  dica?: string;
  /** Cor de série no cabeçalho, quando a coluna é uma classe do catálogo. */
  cor?: string;
  valor: (linha: T) => number;
  celula?: (linha: T) => ReactNode;
  /** Número que pede atenção fica em vermelho na linha. */
  alerta?: (linha: T) => boolean;
  largura?: string;
  /** Some abaixo de 900px. */
  secundaria?: boolean;
}

/**
 * Ranking de pessoas das abas de Produtividade. Clicar numa linha isola a
 * pessoa no resto da tela, e clicar de novo devolve o time; o ranking segue
 * inteiro, porque ele É a comparação.
 *
 * A barra sob o nome mede a coluna ORDENADA, não a primeira: ordenar por
 * atraso mediano e ver a barra do volume seria um gráfico contando outra
 * história.
 */
export function RankingPessoas<K extends ChavePessoa, T extends LinhaPessoa<K>>({
  titulo,
  descricao,
  linhas,
  colunas,
  ordemInicial,
  carregando,
  selecionada,
  onSelecionar,
  vazio = "Ninguém no período.",
  rodape,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  linhas: T[] | undefined;
  colunas: ColunaRanking<T>[];
  /** Id da coluna que ordena ao abrir (maior primeiro). */
  ordemInicial: string;
  carregando?: boolean;
  selecionada: K | null;
  onSelecionar: (codigo: K | null) => void;
  vazio?: ReactNode;
  rodape?: ReactNode;
  acoes?: ReactNode;
}) {
  const inicial = useMemo<{ coluna: string; sentido: "asc" | "desc" }>(
    () => ({ coluna: ordemInicial, sentido: "desc" }),
    [ordemInicial]
  );
  const [ordem, setOrdem] = useState(inicial);
  const ativa = colunas.find((c) => c.id === ordem.coluna) ?? colunas[0];

  const ordenadas = useMemo(() => {
    const s = ordem.sentido === "desc" ? -1 : 1;
    return [...(linhas ?? [])].sort(
      (a, b) => s * (ativa.valor(a) - ativa.valor(b)) || a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [linhas, ativa, ordem.sentido]);

  const maximo = ordenadas.reduce((m, l) => Math.max(m, ativa.valor(l)), 0);

  const tabela: Coluna<T>[] = [
    {
      id: "posicao",
      cabecalho: "#",
      largura: "44px",
      alinhar: "dir",
      classe: "text-pequeno text-apagado",
      celula: (_, i) => i + 1,
    },
    {
      id: "pessoa",
      cabecalho: "Pessoa",
      // Em porcentagem para o nome truncar quando o ranking tem muita coluna
      // (o do Fiscal passa de dez): sem isso a última coluna saía da vista.
      largura: "24%",
      celula: (l) => {
        const sel = selecionada === l.codigo;
        return (
          <div className="flex min-w-0 flex-col gap-1 py-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("truncate", sel ? "font-[600] text-rota" : "text-tinta")}>{l.nome}</span>
              {l.inativo && <Selo>Desligado</Selo>}
            </span>
            <BarraProporcao
              valor={maximo > 0 ? Math.max(0, ativa.valor(l)) / maximo : 0}
              tom="rota"
              className="h-1"
              rotulo={`${ativa.rotulo} de ${l.nome}`}
            />
          </div>
        );
      },
    },
    ...colunas.map<Coluna<T>>((c) => ({
      id: c.id,
      alinhar: "dir",
      largura: c.largura,
      secundaria: c.secundaria,
      ordenar: c.valor,
      cabecalho: (
        <span className="inline-flex items-center gap-1.5">
          {c.cor && <span aria-hidden className="size-2 rounded-[3px]" style={{ background: c.cor }} />}
          {c.dica ? (
            <Dica texto={c.dica}>
              <span className="underline decoration-linha-forte decoration-dotted underline-offset-2">{c.rotulo}</span>
            </Dica>
          ) : (
            c.rotulo
          )}
        </span>
      ),
      celula: (l) => {
        const v = c.valor(l);
        const alerta = c.alerta?.(l);
        return (
          <span className={cn(alerta ? "font-[600] text-perigo" : v === 0 ? "text-apagado" : "text-tinta-2")}>
            {c.celula ? c.celula(l) : num(v)}
          </span>
        );
      },
    })),
  ];

  return (
    <Painel
      titulo={titulo}
      descricao={descricao}
      corpo="p-0"
      rodape={rodape}
      acoes={
        <>
          {acoes}
          {!carregando && ordenadas.length > 0 && (
            <span className="num text-pequeno text-apagado">
              {num(ordenadas.length)} {ordenadas.length === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </>
      }
    >
      {carregando ? (
        <EsqueletoTabela linhas={8} colunas={Math.min(colunas.length + 1, 7)} />
      ) : (
        <TabelaDados
          colunas={tabela}
          linhas={ordenadas}
          chave={(l) => String(l.codigo)}
          ordem={ordem}
          onOrdem={(o) => setOrdem(o ?? inicial)}
          onLinha={(l) => onSelecionar(selecionada === l.codigo ? null : l.codigo)}
          selecionada={(l) => l.codigo === selecionada}
          alturaMax="560px"
          rotulo={typeof titulo === "string" ? titulo : undefined}
          vazio={<p className="py-10 text-center text-corpo text-apagado italic">{vazio}</p>}
        />
      )}
    </Painel>
  );
}
