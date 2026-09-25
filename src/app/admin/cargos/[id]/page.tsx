import { assertAdmin } from "@/lib/sessao";
import EditorCargo from "./editor";

/** O cargo aberto (`/admin/cargos/12`) ou um novo (`/admin/cargos/novo`). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  return <EditorCargo id={id === "novo" ? null : Number(id)} />;
}
