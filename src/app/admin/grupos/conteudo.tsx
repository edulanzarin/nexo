"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { ModalGrupoPermissao, TabelaGruposPermissao } from "@/componentes/produto/admin/grupos-permissao";
import type { AlvoGrupo } from "@/componentes/produto/config/grupos-empresa";
import { useGruposPermissao } from "@/hooks/use-admin";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import type { GrupoPermissaoResumo } from "@/lib/admin-tipos";

/**
 * Grupos de Permissão: as empresas que cada cargo enxerga. Mesma montagem do
 * cadastro de Grupos de Empresa das Configurações (criar, abrir e remover na
 * janela do grupo), com o uso por cargo e por pessoa na lista.
 */
export default function Conteudo() {
  const res = useGruposPermissao();
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [alvo, setAlvo] = useState<AlvoGrupo<GrupoPermissaoResumo> | null>(null);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => (d ?? []).filter((g) => !termo || normalizar(g.nome).includes(termo)), [d, termo]);

  const novo = () => setAlvo("novo");

  if (res.isError && !d)
    return (
      <PainelErro
        titulo="Não deu para carregar os grupos de permissão"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="empresa"
        titulo="Nenhum grupo de permissão"
        descricao="Junte as empresas de uma carteira num grupo e marque o grupo nos cargos que devem enxergá-las."
        acao={
          <Botao variante="primario" icone="mais" onClick={novo}>
            Criar grupo
          </Botao>
        }
      />
    );
  else if (termo)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Nenhum grupo com esse nome"
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <Botao variante="primario" icone="mais" onClick={novo}>
          Novo grupo
        </Botao>
      </AcoesPagina>

      <Nota>
        O grupo só vale para os cargos que o marcam. Cargo com acesso total ou que vê todas as empresas não precisa de
        grupo.
      </Nota>

      <Painel
        corpo="p-0"
        titulo="Grupos"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Em ordem alfabética
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <Campo
            icone="buscar"
            placeholder="Nome do grupo"
            aria-label="Buscar grupo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            classeCaixa="w-full sm:w-56"
            fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
          />
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={5} linhas={6} />
        ) : (
          <TabelaGruposPermissao
            grupos={linhas}
            onAbrir={setAlvo}
            selecionado={alvo && alvo !== "novo" ? alvo.id : null}
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalGrupoPermissao alvo={alvo} onFechar={() => setAlvo(null)} />
    </>
  );
}
