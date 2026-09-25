"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TopoAvulso } from "@/componentes/casca/topo-avulso";
import { avisar } from "@/componentes/primitivos/aviso";
import { PainelErro } from "@/componentes/primitivos/estados";
import { srcAvatar, type MudancaFoto } from "@/componentes/produto/admin/campo-foto";
import {
  BotaoVoltar,
  CHAVE_PERFIL,
  EsqueletoPerfil,
  PainelFotoPerfil,
  PainelSenha,
  PainelSessoes,
  type TrocaSenha,
} from "@/componentes/produto/admin/perfil";
import { CabecalhoPagina } from "@/componentes/produto/pagina";
import { enviarArquivo, mutar } from "@/hooks/mutar";
import { CHAVES_ADMIN } from "@/hooks/use-admin";
import { useConsulta } from "@/hooks/use-consulta";
import type { Perfil } from "@/lib/admin-tipos";
import { num } from "@/lib/format";

const sessoesEncerradas = (n: number) => (n === 1 ? "Uma sessão encerrada" : `${num(n)} sessões encerradas`);

/**
 * Meu Perfil: a foto, a senha e as sessões de quem está logado. Fica fora da
 * moldura dos módulos, com o mesmo topo do início; o alvo de toda escrita é a
 * própria sessão, que o servidor lê sozinho.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const router = useRouter();
  const res = useConsulta<Perfil>(CHAVE_PERFIL, "/api/perfil");
  const p = res.data;

  const reler = () => qc.invalidateQueries({ queryKey: [CHAVE_PERFIL] });

  async function salvarFoto(m: MudancaFoto): Promise<boolean> {
    try {
      if (m.arquivo) {
        const form = new FormData();
        form.append("avatar", m.arquivo);
        await enviarArquivo("/api/perfil/avatar", form);
      } else await mutar("/api/perfil/avatar", "DELETE");
      // A lista de usuários da Administração também mostra esta foto.
      await Promise.all([reler(), qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.usuarios] })]);
      // O menu do canto lê a foto da sessão, que vem do servidor.
      router.refresh();
      avisar.ok(m.arquivo ? "Foto trocada" : "Foto removida");
      return true;
    } catch (e) {
      avisar.erro(m.arquivo ? "Não deu para trocar a foto" : "Não deu para remover a foto", (e as Error).message);
      return false;
    }
  }

  async function trocarSenha(d: TrocaSenha): Promise<boolean> {
    try {
      const r = await mutar<{ encerradas: number }>("/api/perfil/senha", "POST", d);
      await reler();
      avisar.ok(
        "Senha trocada",
        r.encerradas === 0
          ? undefined
          : r.encerradas === 1
            ? "A sessão aberta em outro dispositivo foi encerrada"
            : `${num(r.encerradas)} sessões em outros dispositivos foram encerradas`
      );
      return true;
    } catch (e) {
      avisar.erro("Não deu para trocar a senha", (e as Error).message);
      return false;
    }
  }

  async function encerrarOutras(): Promise<void> {
    try {
      const r = await mutar<{ encerradas: number }>("/api/perfil/sessoes", "DELETE");
      await reler();
      avisar.ok(r.encerradas ? sessoesEncerradas(r.encerradas) : "Nenhuma outra sessão estava aberta");
    } catch (e) {
      avisar.erro("Não deu para encerrar as sessões", (e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1320px] flex-col px-4 pb-14 sm:px-8">
      <TopoAvulso />
      <main className="nx-entra mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BotaoVoltar />
        <CabecalhoPagina titulo="Meu Perfil" descricao="Sua foto, sua senha e os dispositivos em que você está conectado" />
        {res.isError ? (
          <PainelErro
            titulo="Não deu para carregar o seu perfil"
            mensagem={(res.error as Error).message}
            onTentar={() => res.refetch()}
          />
        ) : !p ? (
          <EsqueletoPerfil />
        ) : (
          <>
            <PainelFotoPerfil
              nome={p.nome}
              email={p.email}
              foto={srcAvatar(p.id, p.avatarVersao)}
              onSalvar={salvarFoto}
            />
            <PainelSenha onTrocar={trocarSenha} />
            <PainelSessoes sessoes={p.sessoes} onEncerrar={encerrarOutras} />
          </>
        )}
      </main>
    </div>
  );
}
