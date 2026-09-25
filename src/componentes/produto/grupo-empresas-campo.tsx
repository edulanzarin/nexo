"use client";

import { useMemo, useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Nota } from "@/componentes/primitivos/estados";
import { num } from "@/lib/format";
import { inverterMarcadas, membrosDoGrupo, type ModoGrupo } from "@/lib/grupo-modo";
import type { EmpresaMarcavel } from "@/lib/grupos-empresa-tipos";
import { ListaEmpresasMarcaveis, type VisaoMarcaveis } from "./empresas-marcaveis";

/**
 * As empresas de um grupo, nos dois cadastros (negócio e permissão): o modo e
 * as marcadas.
 *
 * Trocar de modo INVERTE as marcações em vez de reinterpretá-las: o grupo sai
 * da troca com as mesmas empresas que tinha. Sem isso, virar "Todas, exceto"
 * num grupo com 1.478 marcadas deixaria de fora justamente essas 1.478.
 */
export function CampoEmpresasGrupo({
  empresas,
  carregando,
  modo,
  marcadas,
  onMudar,
  visaoInicial,
  trocouInicial = false,
}: {
  empresas: EmpresaMarcavel[];
  carregando?: boolean;
  modo: ModoGrupo;
  marcadas: ReadonlySet<number>;
  onMudar: (v: { modo: ModoGrupo; marcadas: Set<number> }) => void;
  /** Grupo que já existe abre nas marcadas: as dele, e não as 1.500 do Questor. */
  visaoInicial?: VisaoMarcaveis;
  /** Para o catálogo mostrar o aviso da troca sem clicar. */
  trocouInicial?: boolean;
}) {
  const [trocou, setTrocou] = useState(trocouInicial);
  const universo = useMemo(() => empresas.map((e) => e.codigo), [empresas]);
  const noGrupo = membrosDoGrupo(modo, marcadas, universo).length;

  function trocarModo(novo: ModoGrupo) {
    // Sem o universo carregado, inverter contra uma lista vazia zeraria o grupo.
    if (novo === modo || carregando || !universo.length) return;
    onMudar({ modo: novo, marcadas: inverterMarcadas(new Set(marcadas), universo) });
    setTrocou(true);
  }

  // Lista com mais da metade marcada é o grupo "todas menos algumas" montado à
  // mão, que deixa de fora toda empresa nova.
  const quaseTodas = modo === "lista" && universo.length > 0 && marcadas.size > universo.length / 2;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-medio font-[600] text-tinta">
          {modo === "lista" ? "Empresas do Grupo" : "Empresas Fora do Grupo"}
        </h3>
        <Segmentado<ModoGrupo>
          rotulo="Como o grupo escolhe as empresas"
          valor={modo}
          onMudar={trocarModo}
          opcoes={[
            { valor: "lista", rotulo: "Só as marcadas" },
            { valor: "exceto", rotulo: "Todas, exceto as marcadas" },
          ]}
        />
      </div>

      <ListaEmpresasMarcaveis
        empresas={empresas}
        carregando={carregando}
        visaoInicial={visaoInicial}
        marcadas={marcadas}
        onMudar={(m) => {
          // Mexeu depois de trocar: "as mesmas empresas" deixa de ser verdade.
          setTrocou(false);
          onMudar({ modo, marcadas: m });
        }}
        contagem={
          carregando
            ? "Carregando empresas"
            : modo === "lista"
              ? `${num(marcadas.size)} no grupo`
              : `${num(marcadas.size)} fora · ${num(noGrupo)} no grupo`
        }
      />

      {(trocou || modo === "exceto" || quaseTodas) && (
        <div className="flex flex-col gap-0.5">
          {trocou && <Nota>As marcações foram invertidas. O grupo segue com as mesmas {num(noGrupo)} empresas.</Nota>}
          {modo === "exceto" && <Nota>Empresa nova no Questor entra no grupo sem precisar editar.</Nota>}
          {quaseTodas && (
            <Nota tom="atencao" icone="alerta">
              Quase todas estão marcadas. Em &ldquo;Todas, exceto&rdquo;, empresa nova no Questor entra sozinha.
            </Nota>
          )}
        </div>
      )}
    </div>
  );
}
