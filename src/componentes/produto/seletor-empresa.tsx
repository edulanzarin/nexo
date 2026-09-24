"use client";

import { useEffect, useMemo, useState } from "react";
import { Flutuante } from "@/componentes/primitivos/flutuante";
import { Icone } from "@/componentes/primitivos/icone";
import { ListaOpcoes, type Opcao } from "@/componentes/primitivos/combo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { cn } from "@/lib/cn";
import { useEmpresas, useGruposEmpresa } from "@/hooks/use-consulta";
import { useEmpresasRecentes } from "@/hooks/use-contexto";
import type { EscopoEmpresa } from "@/lib/secoes/tipos";

/** Evento que abre o seletor de qualquer lugar (o vazio "escolha a empresa"). */
export const EVENTO_ABRIR_EMPRESA = "navex:abrir-empresa";

export function abrirSeletorEmpresa() {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_EMPRESA));
}

const TODAS = "__todas";

/**
 * A empresa do contexto. Numa bancada é uma empresa só; numa tela que varre o
 * escritório, a empresa vira filtro e dá lugar a "Todas" ou a um grupo. As
 * recentes sobem para o topo: o analista volta às mesmas cinco empresas o dia
 * inteiro, entre 1.500.
 */
export function SeletorEmpresa({
  escopo,
  empresas,
  grupos,
  onMudar,
}: {
  escopo: EscopoEmpresa;
  empresas: number[];
  grupos: number[];
  onMudar: (m: { empresas: number[]; grupos: number[] }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"empresas" | "grupos">(grupos.length ? "grupos" : "empresas");
  const lista = useEmpresas();
  const listaGrupos = useGruposEmpresa();
  const recentes = useEmpresasRecentes();

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_EMPRESA, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_EMPRESA, abrir);
  }, []);

  const porCodigo = useMemo(() => new Map((lista.data ?? []).map((e) => [e.codigo, e])), [lista.data]);

  const opcoesEmpresa = useMemo<Opcao[]>(() => {
    const base = (lista.data ?? []).map((e) => ({ valor: String(e.codigo), rotulo: e.nome, detalhe: String(e.codigo) }));
    const rec = recentes
      .map((c) => porCodigo.get(c))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ valor: String(e.codigo), rotulo: e.nome, detalhe: String(e.codigo), icone: "historico" as const }));
    const recSet = new Set(rec.map((r) => r.valor));
    const todas: Opcao[] =
      escopo === "opcional" ? [{ valor: TODAS, rotulo: "Todas as empresas", icone: "camadas" }] : [];
    return [...todas, ...rec, ...base.filter((o) => !recSet.has(o.valor))];
  }, [lista.data, recentes, porCodigo, escopo]);

  const opcoesGrupo = useMemo<Opcao[]>(
    () =>
      (listaGrupos.data ?? []).map((g) => ({
        valor: String(g.id),
        rotulo: g.nome,
        detalhe: `${g.empresas} ${g.empresas === 1 ? "empresa" : "empresas"}`,
        icone: "camadas" as const,
      })),
    [listaGrupos.data]
  );

  const empresa = empresas[0] != null ? porCodigo.get(empresas[0]) : undefined;
  const grupo = grupos[0] != null ? listaGrupos.data?.find((g) => g.id === grupos[0]) : undefined;

  let texto: string;
  let codigo: string | undefined;
  if (empresa) {
    texto = empresa.nome;
    codigo = String(empresa.codigo);
  } else if (empresas[0] != null) {
    texto = lista.isLoading ? "Carregando" : `Empresa ${empresas[0]}`;
    codigo = String(empresas[0]);
  } else if (escopo === "opcional" && grupo) {
    texto = grupo.nome;
  } else if (escopo === "opcional") {
    texto = "Todas as empresas";
  } else {
    texto = "Escolha a empresa";
  }
  const vazio = escopo === "uma" && empresas.length === 0;

  return (
    <Flutuante
      papel="listbox"
      aberto={aberto}
      onAberto={setAberto}
      larguraMin={400}
      gatilho={(p) => (
        <button
          {...p}
          type="button"
          className={cn(
            "flex h-controle max-w-[360px] min-w-0 items-center gap-2 rounded-controle border px-2.5 text-corpo transition-colors",
            vazio
              ? "border-dashed border-acento-solido/60 bg-acento-suave text-acento hover:bg-acento-solido/20"
              : "border-linha bg-poco text-tinta hover:border-linha-forte hover:bg-poco-forte"
          )}
        >
          <Icone nome={grupo && escopo === "opcional" && !empresa ? "camadas" : "empresa"} tamanho={15} className={vazio ? "" : "text-apagado"} />
          {codigo && <span className="num shrink-0 text-pequeno font-[600] text-apagado">{codigo}</span>}
          <span className="min-w-0 truncate font-[560]">{texto}</span>
          <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
        </button>
      )}
    >
      {(fechar) => (
        <div className="flex min-h-0 flex-col">
          {escopo === "opcional" && (
            <div className="border-b border-linha p-1.5">
              <Segmentado
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
                opcoes={[
                  { valor: "empresas", rotulo: "Empresa" },
                  { valor: "grupos", rotulo: "Grupo" },
                ]}
                valor={modo}
                onMudar={setModo}
              />
            </div>
          )}
          {modo === "empresas" || escopo !== "opcional" ? (
            <ListaOpcoes
              opcoes={opcoesEmpresa}
              marcadas={new Set(empresas.length ? [String(empresas[0])] : escopo === "opcional" && !grupos.length ? [TODAS] : [])}
              busca
              placeholderBusca="Nome ou código da empresa"
              vazio={lista.isError ? "Não deu para listar as empresas." : lista.isLoading ? "Carregando empresas" : "Nenhuma empresa com esse nome ou código."}
              onEscolher={(v) => {
                if (v === TODAS) onMudar({ empresas: [], grupos: [] });
                else onMudar({ empresas: [Number(v)], grupos: [] });
                fechar();
              }}
            />
          ) : (
            <ListaOpcoes
              opcoes={opcoesGrupo}
              marcadas={new Set(grupos.map(String))}
              busca={opcoesGrupo.length > 8}
              vazio="Nenhum grupo de empresa cadastrado em Configurações."
              onEscolher={(v) => {
                onMudar({ empresas: [], grupos: [Number(v)] });
                fechar();
              }}
            />
          )}
        </div>
      )}
    </Flutuante>
  );
}
