import { Button } from "@/components/ui";
import { salvarSetor, excluirSetor } from "../actions";
import type { SetorOpcao } from "../dados";

const input =
  "h-10 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-accent/50";

/** Cria ou edita um setor (só o nome). Server Action. */
export function SetorForm({ setor }: { setor: SetorOpcao | null }) {
  return (
    <form action={salvarSetor} className="flex flex-col gap-6">
      {setor && <input type="hidden" name="id" value={setor.id} />}

      <label className="flex max-w-md flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-2">Nome do setor</span>
        <input name="nome" required defaultValue={setor?.nome ?? ""} className={input} placeholder="Ex.: Contábil" />
      </label>

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        {setor ? (
          <Button type="submit" formAction={excluirSetor} variant="danger">
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary" size="lg">
          {setor ? "Salvar" : "Criar setor"}
        </Button>
      </div>
    </form>
  );
}
