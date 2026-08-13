import { EmpresaPicker } from "@/components/admin/empresa-picker";
import { Button } from "@/components/ui";
import type { EmpresaOpcao } from "@/app/admin/dados";
import type { GrupoEmpresaDetalhe } from "@/lib/grupos-empresa";
import { salvarGrupoEmpresa, excluirGrupoEmpresa } from "./actions";

const input =
  "h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

/** Cria ou edita um grupo de empresa de negócio (nome + empresas). Server Action.
 *  Reusa o EmpresaPicker e a lista de empresas do Questor do admin. */
export function GrupoEmpresaForm({
  grupo,
  empresas,
}: {
  grupo: GrupoEmpresaDetalhe | null;
  empresas: EmpresaOpcao[];
}) {
  return (
    <form action={salvarGrupoEmpresa} className="flex flex-col gap-6">
      {grupo && <input type="hidden" name="id" value={grupo.id} />}

      <label className="flex max-w-md flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-2">Nome do grupo</span>
        <input
          name="nome"
          required
          defaultValue={grupo?.nome ?? ""}
          className={input}
          placeholder="Ex.: U FIT"
        />
      </label>

      <div className="max-w-2xl">
        <h2 className="text-sm font-semibold">Empresas do grupo</h2>
        <div className="mt-3">
          <EmpresaPicker name="empresas" empresas={empresas} inicial={grupo?.empresas ?? []} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        {grupo ? (
          <Button type="submit" variant="danger" formAction={excluirGrupoEmpresa}>
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" size="lg">
          {grupo ? "Salvar" : "Criar grupo"}
        </Button>
      </div>
    </form>
  );
}
