"use client";

import { useMemo, useState } from "react";
import { EmpresaPicker } from "@/components/admin/empresa-picker";
import { Segmented } from "@/components/ui";
import type { EmpresaOpcao } from "@/app/admin/dados";
import { inverterMarcadas, membrosDoGrupo, type ModoGrupo } from "@/lib/grupo-modo";

/**
 * As empresas de um grupo, nos dois cadastros (permissão e negócio): o modo e as
 * marcadas. Emite `modo` e um `empresas` por marcada para o Server Action.
 *
 * Trocar de modo INVERTE as marcações em vez de reinterpretá-las: o grupo sai
 * da troca com as mesmas empresas que tinha. Sem isso, virar "Todas, exceto"
 * num grupo com 1.478 marcadas deixaria de fora justamente essas 1.478.
 */
export function GrupoEmpresasCampo({
  empresas,
  modoInicial,
  marcadasIniciais,
}: {
  empresas: EmpresaOpcao[];
  modoInicial: ModoGrupo;
  marcadasIniciais: number[];
}) {
  const [modo, setModo] = useState<ModoGrupo>(modoInicial);
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set(marcadasIniciais));
  const [trocou, setTrocou] = useState(false);

  const universo = useMemo(() => empresas.map((e) => e.codigo), [empresas]);
  const noGrupo = membrosDoGrupo(modo, marcadas, universo).length;

  function trocarModo(novo: ModoGrupo) {
    if (novo === modo) return;
    setMarcadas(inverterMarcadas(marcadas, universo));
    setModo(novo);
    setTrocou(true);
  }

  // Lista com mais da metade marcada é o grupo "todas menos algumas" montado à
  // mão, o que deixa de fora toda empresa nova.
  const quaseTodas = modo === "lista" && marcadas.size > universo.length / 2;

  return (
    <div className="max-w-2xl">
      <input type="hidden" name="modo" value={modo} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {modo === "lista" ? "Empresas do grupo" : "Empresas fora do grupo"}
        </h2>
        <Segmented
          aria-label="Como o grupo escolhe as empresas"
          value={modo}
          onChange={trocarModo}
          options={[
            { value: "lista", label: "Só as marcadas" },
            { value: "exceto", label: "Todas, exceto as marcadas" },
          ]}
        />
      </div>

      <div className="mt-3">
        <EmpresaPicker
          name="empresas"
          empresas={empresas}
          selecionadas={marcadas}
          onMudar={setMarcadas}
          rotuloContagem={
            modo === "lista" ? `${marcadas.size} no grupo` : `${marcadas.size} fora · ${noGrupo} no grupo`
          }
        />
      </div>

      <div className="mt-2 grid gap-0.5 text-xs italic text-muted">
        {trocou && (
          <p>As marcações foram invertidas. O grupo segue com as mesmas {noGrupo} empresas.</p>
        )}
        {modo === "exceto" && <p>Empresa nova no Questor entra no grupo sem precisar editar.</p>}
        {quaseTodas && (
          <p>Quase todas estão marcadas. Em &ldquo;Todas, exceto&rdquo;, empresa nova no Questor entra sozinha.</p>
        )}
      </div>
    </div>
  );
}
