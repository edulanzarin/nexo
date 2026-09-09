import { notFound, redirect } from "next/navigation";
import type { ModuloId } from "@/lib/modulos";
import { listarGruposPostMortem, obterPostMortem } from "@/lib/postmortem";
import { podeLerSetor, podePreencher } from "@/lib/postmortem-acesso";
import { SECAO_PM, SECAO_PM_GESTAO } from "@/lib/postmortem-secoes";
import { setorDoModulo } from "@/lib/postmortem-setores";
import { getSessao } from "@/lib/sessao";
import { FormularioPM } from "./form";
import { ListaGestao } from "./lista-gestao";
import { ListaMinha } from "./lista-minha";

/**
 * As três telas do Post Mortem, escritas UMA vez. Cada módulo de setor tem
 * apenas os arquivos de rota que o Next exige (`page.tsx`), e eles delegam
 * para cá passando o próprio id de módulo — o setor sai daí.
 *
 * Sem isto seriam quatro cópias das mesmas quatro páginas, e a quinta cópia
 * (quando entrar um setor novo) sairia diferente das outras.
 */

/** O setor do módulo, ou 404 — módulo sem setor não tem estas rotas. */
function setorOuNada(modulo: ModuloId) {
  const setor = setorDoModulo(modulo);
  if (!setor) notFound();
  return setor;
}

/** Seção `post-mortem`: os relatórios de quem está olhando. */
export async function PaginaMinha({ modulo }: { modulo: ModuloId }) {
  const setor = setorOuNada(modulo);
  const sessao = await getSessao();
  if (!podePreencher(sessao, setor)) redirect(`/${modulo}`);
  return <ListaMinha modulo={modulo} setor={setor.id} />;
}

/** Seção `post-mortem-gestao`: o setor inteiro, para o gestor da área. */
export async function PaginaGestao({ modulo }: { modulo: ModuloId }) {
  const setor = setorOuNada(modulo);
  const sessao = await getSessao();
  if (!podeLerSetor(sessao, setor)) redirect(`/${modulo}`);
  return <ListaGestao modulo={modulo} setor={setor.id} rotulo={setor.rotulo} />;
}

/**
 * O relatório. O caminho carrega a seção de ONDE se entrou, que é o que o botão
 * Voltar precisa saber e é onde a permissão é conferida:
 *
 * - pela seção do analista, só o DONO abre (a lista de lá é só a dele);
 * - pela seção de gestão, qualquer relatório DAQUELE setor.
 *
 * Relatório de outro setor não existe neste caminho — 404, e não "sem permissão":
 * quem não pode ver não descobre que ele existe.
 */
export async function PaginaRelatorio({
  modulo,
  secao,
  id,
}: {
  modulo: ModuloId;
  secao: typeof SECAO_PM | typeof SECAO_PM_GESTAO;
  id: string;
}) {
  const setor = setorOuNada(modulo);
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();

  const sessao = await getSessao();
  const gestao = secao === SECAO_PM_GESTAO;
  const podeEntrar = gestao ? podeLerSetor(sessao, setor) : podePreencher(sessao, setor);
  if (!podeEntrar) redirect(`/${modulo}`);

  const rel = await obterPostMortem(n);
  if (!rel || rel.setor !== setor.id) notFound();

  const ehDono = rel.autorId === sessao.usuario.id;
  if (!gestao && !ehDono) notFound();

  const grupos = await listarGruposPostMortem();
  // Edita só o dono e só enquanto rascunho; o resto é leitura.
  return (
    <FormularioPM
      inicial={rel}
      grupos={grupos}
      somenteLeitura={!ehDono || rel.status === "enviado"}
      voltarPara={`/${modulo}/${secao}`}
      apiBase={`/api/${modulo}/post-mortem`}
    />
  );
}
