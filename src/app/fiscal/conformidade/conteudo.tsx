"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Esqueleto, EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { FiltroEspecies, useEspecies } from "@/componentes/produto/fiscal/filtros";
import { RankingBarras } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { cn } from "@/lib/cn";
import { num, pct } from "@/lib/format";
import type { ConformidadeEmpresa, ConformidadeResumo } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

const razao = (parte: number, base: number) => (base > 0 ? (parte / base) * 100 : null);

/**
 * A situação é o COD_SIT do SPED (a rota nomeia). Regular, complementar e
 * regime especial são documento válido; cancelada é perigo; denegada,
 * inutilizada e as extemporâneas pedem olho. A cor é o juízo, e a palavra vai
 * junto.
 */
const corDaSituacao = (codigo: number) =>
  codigo === 2 || codigo === 3
    ? "var(--perigo)"
    : [1, 4, 5, 7].includes(codigo)
      ? "var(--atencao)"
      : "var(--ok)";

interface LinhaEmpresa extends ConformidadeEmpresa {
  posicao: number;
}

/** Pendência em perigo quando existe; zero fica apagado para o olho achar o que falta. */
function Contagem({ valor }: { valor: number }) {
  return <span className={cn(valor > 0 ? "font-[600] text-perigo" : "text-apagado")}>{num(valor)}</span>;
}

const COLUNAS: Coluna<LinhaEmpresa>[] = [
  {
    id: "posicao",
    cabecalho: "#",
    alinhar: "dir",
    largura: "44px",
    celula: (l) => l.posicao,
    classe: "text-apagado",
  },
  {
    id: "empresa",
    cabecalho: "Empresa",
    largura: "40%",
    ordenar: (l) => l.nome ?? "",
    celula: (l) => (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate font-[560] text-tinta" title={l.nome ?? undefined}>
          {l.nome ?? `Empresa ${l.codigo}`}
        </span>
        <span className="num shrink-0 text-pequeno text-apagado">{l.codigo}</span>
      </span>
    ),
  },
  {
    id: "ncm",
    cabecalho: "NCM inválido",
    alinhar: "dir",
    ordenar: (l) => l.ncmInvalido,
    celula: (l) => <Contagem valor={l.ncmInvalido} />,
  },
  {
    id: "canceladas",
    cabecalho: "Canceladas",
    alinhar: "dir",
    ordenar: (l) => l.canceladas,
    celula: (l) => <Contagem valor={l.canceladas} />,
  },
  {
    id: "denegadas",
    cabecalho: "Denegadas",
    alinhar: "dir",
    ordenar: (l) => l.denegadas,
    celula: (l) => <Contagem valor={l.denegadas} />,
  },
  {
    id: "semChave",
    cabecalho: "Sem chave",
    alinhar: "dir",
    ordenar: (l) => l.semChave,
    celula: (l) => <Contagem valor={l.semChave} />,
  },
  {
    id: "total",
    cabecalho: "Total",
    alinhar: "dir",
    ordenar: (l) => l.pendencias,
    celula: (l) => num(l.pendencias),
    classe: "font-[600] text-tinta",
  },
];

/**
 * Conformidade: a saúde fiscal das saídas do período. Quatro pendências (NCM
 * inválido, canceladas, denegadas ou inutilizadas e nota eletrônica sem
 * chave), a situação das notas e as empresas que mais acumulam pendência.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const { especies, comEspecies } = useEspecies();
  const url = (rota: string) => (qs == null ? null : `/api/fiscal/${rota}?${comEspecies(qs)}`);
  const resumo = useConsulta<ConformidadeResumo>("fiscal-conformidade", url("conformidade"));
  const empresas = useConsulta<ConformidadeEmpresa[]>("fiscal-conformidade-empresas", url("conformidade-empresas"));
  const r = resumo.data;

  const linhas = useMemo<LinhaEmpresa[] | undefined>(
    () => empresas.data?.map((e, i) => ({ ...e, posicao: i + 1 })),
    [empresas.data],
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    const p = new URLSearchParams(qs ?? "");
    const sufixo = `${p.get("inicio")}_${p.get("fim")}`;
    const lista: CorteExportar[] = [];
    if (r) {
      lista.push({
        id: "resumo",
        rotulo: "Resumo das pendências",
        nome: `conformidade-fiscal-resumo-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Pendência", "Quantidade", "Base", "Base em"],
          linhas: [
            ["Itens com NCM inválido", r.ncmInvalidoItens, r.totalItens, "itens de saída"],
            ["Produtos com NCM inválido", r.ncmInvalidoProdutos, "", ""],
            ["Notas canceladas", r.canceladas, r.totalNotas, "notas de saída"],
            ["Denegadas ou inutilizadas", r.denegadas, r.totalNotas, "notas de saída"],
            ["Sem chave de acesso", r.semChave, r.totalNotas, "notas de saída"],
          ],
        }),
      });
      lista.push({
        id: "situacoes",
        rotulo: "Situação das notas",
        nome: `conformidade-fiscal-situacoes-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Código", "Situação", "Notas"],
          linhas: r.situacoes.map((s) => [s.codigo, s.nome, s.qtd]),
        }),
      });
    }
    if (linhas)
      lista.push({
        id: "empresas",
        rotulo: "Empresas com pendências",
        nome: `conformidade-fiscal-empresas-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Posição", "Código", "Empresa", "NCM inválido", "Canceladas", "Denegadas", "Sem chave", "Total"],
          linhas: linhas.map((l) => [
            l.posicao,
            l.codigo,
            l.nome ?? "",
            l.ncmInvalido,
            l.canceladas,
            l.denegadas,
            l.semChave,
            l.pendencias,
          ]),
        }),
      });
    return lista;
  }, [qs, r, linhas]);

  const acoes = (
    <AcoesPagina>
      <FiltroEspecies />
      <MenuExportar modulo="fiscal" cortes={cortes} desabilitado={cortes.length === 0} />
    </AcoesPagina>
  );

  if (r && r.totalNotas === 0 && r.totalItens === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="nota"
            titulo="Nenhuma nota de saída no recorte"
            descricao={
              especies.length
                ? "Tire o filtro de espécie, amplie o período ou afrouxe a empresa no topo."
                : "Amplie o período ou tire o filtro de empresa no topo."
            }
          />
        </div>
      </>
    );

  return (
    <>
      {acoes}

      {resumo.error ? (
        <PainelErro
          titulo="Não deu para carregar as pendências"
          mensagem={(resumo.error as Error).message}
          onTentar={() => resumo.refetch()}
        />
      ) : (
        <FaixaIndicadores colunas={4}>
          <Indicador
            rotulo="Itens com NCM inválido"
            icone="etiquetas"
            carregando={!r}
            valor={num(r?.ncmInvalidoItens ?? 0)}
            detalhe={
              r
                ? `${num(r.ncmInvalidoProdutos)} ${r.ncmInvalidoProdutos === 1 ? "produto" : "produtos"} a corrigir · ${pct(razao(r.ncmInvalidoItens, r.totalItens), 2)} dos itens`
                : ""
            }
            tom={r && r.ncmInvalidoItens > 0 ? "perigo" : "neutro"}
            valorNoTom
          />
          <Indicador
            rotulo="Notas canceladas"
            icone="bloqueado"
            carregando={!r}
            valor={num(r?.canceladas ?? 0)}
            detalhe={r ? `${pct(razao(r.canceladas, r.totalNotas), 2)} das notas de saída` : ""}
          />
          <Indicador
            rotulo="Denegadas ou inutilizadas"
            icone="alerta"
            carregando={!r}
            valor={num(r?.denegadas ?? 0)}
            detalhe="Negadas pela Sefaz ou numeração inutilizada"
            tom={r && r.denegadas > 0 ? "atencao" : "neutro"}
          />
          <Indicador
            rotulo="Sem chave de acesso"
            icone="chave"
            carregando={!r}
            valor={num(r?.semChave ?? 0)}
            detalhe="Sem os 44 dígitos, fora as inutilizadas"
            tom={r && r.semChave > 0 ? "atencao" : "neutro"}
          />
        </FaixaIndicadores>
      )}

      <div className="flex flex-col gap-1">
        <Nota>Só as notas de saída. NCM vazio ou genérico (99999999, 00000000) conta como inválido.</Nota>
        {especies.length > 0 && <Nota>NCM inválido soma todas as espécies.</Nota>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {!resumo.error && (
          <Painel titulo="Situação das Notas" descricao="Notas de saída pela situação no Questor" corpo="p-2">
            {!r ? (
              <div aria-busy className="flex flex-col">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5 px-2 py-2">
                    <Esqueleto className="h-3 w-32" />
                    <Esqueleto className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <RankingBarras
                itens={r.situacoes}
                rotulo={(s) => (
                  <>
                    {s.nome} <span className="num text-apagado">{s.codigo}</span>
                  </>
                )}
                valor={(s) => s.qtd}
                cor={(s) => corDaSituacao(s.codigo)}
                detalhe={(s) => pct(razao(s.qtd, r.totalNotas), 2)}
                vazio="Nenhuma nota de saída no recorte."
              />
            )}
          </Painel>
        )}

        <Painel
          className={resumo.error ? "xl:col-span-3" : "xl:col-span-2"}
          titulo="Empresas com Mais Pendências"
          descricao="As quatro pendências somadas por empresa"
          corpo="p-0"
        >
          {empresas.error ? (
            <div className="p-4">
              <PainelErro mensagem={(empresas.error as Error).message} onTentar={() => empresas.refetch()} />
            </div>
          ) : !linhas ? (
            <EsqueletoTabela colunas={7} />
          ) : (
            <TabelaDados
              colunas={COLUNAS}
              linhas={linhas}
              chave={(l) => String(l.codigo)}
              rotulo="Empresas com pendências"
              vazio={
                <Vazio
                  compacto
                  icone="ok"
                  titulo="Nenhuma pendência no período"
                  descricao="Nenhuma empresa do recorte tem NCM inválido, nota cancelada, denegada ou sem chave nas saídas."
                />
              }
            />
          )}
        </Painel>
      </div>
    </>
  );
}
