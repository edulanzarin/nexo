import type { Metadata } from "next";
import { appQuery } from "@/lib/app-db";
import { getSessao } from "@/lib/sessao";
import { contarSessoes } from "@/lib/auth";
import { tituloPagina } from "@/lib/marca";
import { PerfilForm } from "./perfil-form";
import { Voltar } from "./voltar";

export const metadata: Metadata = { title: tituloPagina("Perfil") };

/**
 * Perfil da pessoa logada. Fora do catálogo de módulos — é pessoal, alcançado
 * pelo bloco de usuário na sidebar de qualquer módulo. O alvo é sempre a própria
 * sessão; a action é quem tranca em quem pode ser editado.
 */
export default async function PerfilPage() {
  const sessao = await getSessao();
  const id = sessao.usuario.id;

  const [row] = await appQuery<{ avatar_versao: number | null }>(
    `select extract(epoch from atualizado_em) * 1000 as avatar_versao
       from usuario_avatar where usuario_id = $1`,
    [id]
  );
  const avatarVersao = row?.avatar_versao != null ? Math.round(Number(row.avatar_versao)) : null;
  const sessoesAtivas = await contarSessoes(id);

  return (
    <main className="mx-auto max-w-2xl px-8 py-8">
      <Voltar />
      <h1 className="mt-3 text-xl font-semibold tracking-tight">Meu perfil</h1>
      <p className="mt-0.5 text-sm text-muted">Sua foto, sua senha e suas sessões.</p>

      <div className="mt-7">
        <PerfilForm
          id={id}
          nome={sessao.usuario.nome}
          email={sessao.usuario.email}
          avatarVersao={avatarVersao}
          sessoesAtivas={sessoesAtivas}
        />
      </div>
    </main>
  );
}
