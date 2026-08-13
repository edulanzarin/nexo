"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Search } from "lucide-react";
import { Dropdown, ItemLista } from "@/components/ui/dropdown";
import { FilialDropdown } from "@/components/filters/filial-dropdown";
import { PeriodoDropdown } from "@/components/filters/periodo-dropdown";
import { PeriodoMensalDropdown } from "@/components/filters/periodo-mensal-dropdown";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { useEmpresas } from "@/hooks/use-api";
import { useFiltros, useRascunhoFiltros } from "@/hooks/use-filters";

/**
 * `mostrarPeriodo=false` na aba Configuração: o plano de contabilização é
 * configuração fixa da empresa, não tem recorte de tempo.
 *
 * `execucao` vem do catálogo da aba ([[executar-com-botao]]): com botão, o
 * usuário edita o rascunho sem disparar nada e só o botão (com o verbo da
 * tela — "Executar", "Carregar") aplica; `imediata` é para telas cujo gatilho
 * pesado é próprio (o envio do extrato na Conciliação) — a empresa aplica na
 * hora, porque ela é contexto, não consulta.
 */
export function ConfFilterBar({
  mostrarPeriodo = true,
  periodoMensal = false,
  mostrarFilial = true,
  empresaOpcional = false,
  execucao = { imediata: false, rotulo: "Executar" },
  extras,
}: {
  mostrarPeriodo?: boolean;
  /** Período por mês (balancete) em vez de por dia. */
  periodoMensal?: boolean;
  /** Seletor de filial (só telas de dado; a Folha tem o seu próprio, e o
   *  cadastro do plano é por empresa). Depende do buildWhere honrar `estabs`. */
  mostrarFilial?: boolean;
  /** Empresa vira filtro, não obrigação: "Todas as empresas" é o padrão e o
   *  Executar não exige seleção (Produtividade do DP varre todo o escopo). */
  empresaOpcional?: boolean;
  execucao?: { imediata: boolean; rotulo: string };
  /** Controles que a aba põe NA LINHA da barra, ao lado da empresa (ex.: conta
   *  e extrato na Conciliação). Compartilham estado com a página via seção. */
  extras?: React.ReactNode;
} = {}) {
  const { filtros, atualizar } = useFiltros();
  const { rascunho: rascunhoState, editar: editarRascunho, dirty, executar } =
    useRascunhoFiltros();
  const queryClient = useQueryClient();
  // Executar sempre roda — mesmo sem mudar filtro. `executar` comita o rascunho
  // (só refaz a consulta se algo mudou); a invalidação força o refetch quando
  // nada mudou, pra o clique ter efeito. Empresas/contas (cadastro) ficam de fora.
  const aoExecutar = () => {
    executar();
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== "empresas" && q.queryKey[0] !== "contas",
    });
  };
  // No modo imediato a fonte é o aplicado e editar já comita.
  const rascunho = execucao.imediata ? filtros : rascunhoState;
  const editar = execucao.imediata ? atualizar : editarRascunho;
  const { data: empresas } = useEmpresas();
  const [busca, setBusca] = useState("");

  const empresaSel = rascunho.empresas[0];
  const rotuloEmpresa =
    empresaSel != null
      ? (empresas?.find((e) => e.codigo === empresaSel)?.nome ?? `Empresa ${empresaSel}`)
      : empresaOpcional
        ? "Todas as empresas"
        : "Selecione a empresa";

  const empresasFiltradas = useMemo(() => {
    if (!empresas) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(
      (e) => e.nome.toLowerCase().includes(q) || String(e.codigo).includes(q)
    );
  }, [empresas, busca]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Empresa (única, obrigatória) */}
      <Dropdown
        icone={<Building2 className="size-4" />}
        rotulo={rotuloEmpresa}
        ativo={empresaSel != null}
        largura="w-80"
      >
        {(fechar) => (
          <div>
            <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
              <Search className="size-4 text-muted" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou código…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {!empresas && <p className="px-3 py-2 text-sm text-muted">Carregando…</p>}
              {empresaOpcional && (
                <ItemLista
                  selecionado={empresaSel == null}
                  onClick={() => {
                    editar({ empresas: [], estabs: [] });
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {empresaSel == null && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="flex-1 truncate text-muted">Todas as empresas</span>
                </ItemLista>
              )}
              {empresasFiltradas.slice(0, 200).map((e) => (
                <ItemLista
                  key={e.codigo}
                  selecionado={e.codigo === empresaSel}
                  onClick={() => {
                    // Troca de empresa zera as filiais (são de outra empresa).
                    editar({ empresas: [e.codigo], estabs: [] });
                    fechar();
                  }}
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    {e.codigo === empresaSel && <Check className="size-4 stroke-[3] text-accent" />}
                  </span>
                  <span className="flex-1 truncate">{e.nome}</span>
                  <span className="tnum text-xs text-muted">{e.codigo}</span>
                </ItemLista>
              ))}
              {empresasFiltradas.length > 200 && (
                <p className="px-3 py-2 text-xs text-muted">
                  Mostrando 200 de {empresasFiltradas.length} — refine a busca
                </p>
              )}
            </div>
          </div>
        )}
      </Dropdown>

      {/* Filial (só quando a empresa tem mais de uma) */}
      {mostrarFilial && (
        <FilialDropdown
          empresa={empresaSel ?? null}
          estabs={rascunho.estabs}
          onChange={(estabs) => editar({ estabs })}
        />
      )}

      {/* Período (teto de 1 ano) — primitivo compartilhado. Mensal no balancete. */}
      {mostrarPeriodo &&
        (periodoMensal ? (
          <PeriodoMensalDropdown
            inicio={rascunho.inicio}
            fim={rascunho.fim}
            onChange={(inicio, fim) => editar({ inicio, fim })}
          />
        ) : (
          <PeriodoDropdown
            inicio={rascunho.inicio}
            fim={rascunho.fim}
            onChange={(inicio, fim) => editar({ inicio, fim })}
          />
        ))}

      {extras}

      {!execucao.imediata && (
        // Fixo na direita: não anda conforme a largura dos inputs.
        <div className="ml-auto">
          <BotaoExecutar
            onClick={aoExecutar}
            dirty={dirty}
            rotulo={execucao.rotulo}
            disabled={!empresaOpcional && empresaSel == null}
            title={!empresaOpcional && empresaSel == null ? "Selecione uma empresa" : undefined}
          />
        </div>
      )}
    </div>
  );
}
