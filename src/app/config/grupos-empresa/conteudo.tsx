"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import {
  CHAVE_GRUPOS_CADASTRO,
  ModalGrupoEmpresa,
  TabelaGruposEmpresa,
  type AlvoGrupo,
} from "@/componentes/produto/config/grupos-empresa";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import type { GrupoEmpresaCadastro } from "@/lib/grupos-empresa-tipos";

/**
 * Grupos de Empresa: o cadastro dos grupos de negócio. Criar, abrir e remover
 * são na janela do grupo; a lista só mostra quantas empresas cada um tem hoje.
 */
export default function Conteudo() {
  const res = useConsulta<GrupoEmpresaCadastro[]>(CHAVE_GRUPOS_CADASTRO, "/api/config/grupos-empresa", {
    staleTime: 60_000,
  });
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [alvo, setAlvo] = useState<AlvoGrupo | null>(null);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => (d ?? []).filter((g) => !termo || normalizar(g.nome).includes(termo)), [d, termo]);

  const novo = () => setAlvo("novo");

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar os grupos"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="camadas"
        titulo="Nenhum grupo cadastrado"
        descricao="Junte as empresas de um mesmo negócio, como a U FIT, para filtrar as telas pelo grupo inteiro."
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

      <Nota>O grupo aparece no seletor de empresa do topo, nas telas que varrem o escritório, e no Post Mortem.</Nota>

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
          <EsqueletoTabela colunas={3} linhas={6} />
        ) : (
          <TabelaGruposEmpresa
            grupos={linhas}
            onAbrir={setAlvo}
            selecionado={alvo && alvo !== "novo" ? alvo.id : null}
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalGrupoEmpresa alvo={alvo} onFechar={() => setAlvo(null)} />
    </>
  );
}
