"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { useConsulta } from "@/hooks/use-consulta";
import { mutar } from "@/hooks/mutar";
import type { ModuloId } from "@/lib/modulos";
import { SECAO_PM } from "@/lib/postmortem-secoes";
import { setorDoModulo, temCampo } from "@/lib/postmortem-setores";
import type { ResumoPM } from "@/lib/postmortem-tipos";
import { CHAVE_PM, urlListaPM } from "./consulta";
import { FaixaResumoPM, TabelaPM } from "./resumo";

/**
 * A lista da seção `post-mortem`: os relatórios de QUEM ESTÁ OLHANDO, dentro do
 * setor do módulo. A posse é por linha (autor), então aqui não há filtro de
 * pessoa: quem lê o setor inteiro é o gestor, na seção ao lado.
 *
 * Serve a todo módulo de setor (Contábil, Fiscal, DP, Societário): o módulo diz
 * a rota da API e o setor, e o setor diz os campos.
 */
export function ListaMinha({ modulo }: { modulo: ModuloId }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);
  const setor = setorDoModulo(modulo);
  const mostraGravidade = setor ? temCampo(setor.id, "gravidade") : false;
  const base = `/${modulo}/${SECAO_PM}`;

  const { data, error, isLoading, refetch } = useConsulta<ResumoPM[]>(
    CHAVE_PM,
    urlListaPM(modulo, SECAO_PM)
  );

  // O rascunho nasce no servidor e o formulário abre nele: salvar depois é
  // sempre PATCH de um relatório que existe, sem caso especial de "novo".
  async function novo() {
    setCriando(true);
    try {
      const { id } = await mutar<{ id: number }>(`/api/${modulo}/post-mortem`, "POST");
      qc.invalidateQueries({ queryKey: [CHAVE_PM] });
      router.push(`${base}/${id}`);
    } catch (e) {
      avisar.erro("Não deu para abrir o relatório", (e as Error).message);
      setCriando(false);
    }
  }

  const botaoNovo = (
    <Botao variante="primario" icone="mais" carregando={criando} onClick={novo}>
      Novo relatório
    </Botao>
  );

  if (error && !data)
    return (
      <PainelErro titulo="Não deu para carregar os relatórios" mensagem={(error as Error).message} onTentar={() => refetch()} />
    );

  const carregando = isLoading || !data;

  return (
    <>
      <AcoesPagina>{botaoNovo}</AcoesPagina>

      <FaixaResumoPM lista={data} carregando={carregando} />

      <Painel titulo="Meus Relatórios" descricao="Só os seus. A gestão do setor lê todos." corpo="p-0">
        {carregando ? (
          <EsqueletoTabela colunas={6} linhas={6} />
        ) : !data.length ? (
          <Vazio
            icone="relatorio"
            titulo="Nenhum relatório ainda"
            descricao="Quando um erro acontecer, abra um relatório para registrar o que houve, a causa raiz e o que muda no processo."
            acao={botaoNovo}
          />
        ) : (
          <TabelaPM linhas={data} mostraGravidade={mostraGravidade} onLinha={(r) => router.push(`${base}/${r.id}`)} />
        )}
      </Painel>
    </>
  );
}
