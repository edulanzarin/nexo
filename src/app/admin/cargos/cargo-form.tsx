"use client";

import { useState } from "react";
import { PermissaoMatriz } from "@/components/admin/permissao-matriz";
import { ComboCriavel } from "@/components/ui/combo-criavel";
import { Button, Card } from "@/components/ui";
import { salvarCargo, excluirCargo } from "../actions";
import type { CargoDetalhe, SetorOpcao, GrupoResumo } from "../dados";

const input =
  "h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";
const check = "size-4 accent-[var(--ent)]";

/**
 * Cria ou edita um cargo (grupo de permissão): identidade, setor, as seções que
 * concede e os grupos de empresa que traz. É o molde herdado pelos usuários.
 */
export function CargoForm({
  cargo,
  setores,
  grupos,
}: {
  cargo: CargoDetalhe | null;
  setores: SetorOpcao[];
  grupos: GrupoResumo[];
}) {
  const [escolha, setEscolha] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((cargo?.secoes ?? []).map((k) => [k, true]))
  );
  const [admin, setAdmin] = useState(cargo?.admin ?? false);

  return (
    <form action={salvarCargo} className="flex flex-col gap-6">
      {cargo && <input type="hidden" name="id" value={cargo.id} />}

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Nome do cargo</span>
          <input name="nome" required defaultValue={cargo?.nome ?? ""} className={input} placeholder="Ex.: Analista Contábil" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Setor</span>
          <ComboCriavel
            name="setor"
            opcoes={setores}
            inicial={setores.find((s) => s.id === cargo?.setor_id) ?? null}
            placeholder="Buscar ou criar setor…"
          />
        </div>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ink-2">Descrição (opcional)</span>
          <input name="descricao" defaultValue={cargo?.descricao ?? ""} className={input} placeholder="Para que serve este cargo" />
        </label>
      </section>

      <section className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="admin"
            checked={admin}
            onChange={(e) => setAdmin(e.target.checked)}
            className={check}
          />
          Acesso total (administrador)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="todas_empresas"
            defaultChecked={cargo?.todas_empresas ?? false}
            disabled={admin}
            className={check}
          />
          Vê todas as empresas
        </label>
      </section>

      {admin ? null : (
        <>
          <section>
            <h2 className="text-sm font-semibold">Permissões por seção</h2>
            <div className="mt-3">
              <PermissaoMatriz
                valor={escolha}
                onChange={(chave, nivel) => setEscolha((p) => ({ ...p, [chave]: nivel }))}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Grupos de empresa</h2>
            <Card padding="none" animate="none" className="mt-3 max-h-56 max-w-md divide-y divide-hairline overflow-auto">
              {grupos.length === 0 && <p className="px-4 py-3 text-xs text-muted">Nenhum grupo criado.</p>}
              {grupos.map((g) => (
                <label key={g.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="grupos"
                    value={g.id}
                    defaultChecked={cargo?.grupos.includes(g.id) ?? false}
                    className={check}
                  />
                  <span className="min-w-0 truncate">{g.nome}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted">{g.empresas} empresas</span>
                </label>
              ))}
            </Card>
          </section>
        </>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        {cargo ? (
          <Button type="submit" formAction={excluirCargo} variant="danger">
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" size="lg">
          {cargo ? "Salvar" : "Criar cargo"}
        </Button>
      </div>
    </form>
  );
}
