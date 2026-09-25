"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { ModalSetor, TabelaSetores, type AlvoSetor } from "@/componentes/produto/admin/setores";
import { useSetoresAdmin } from "@/hooks/use-admin";
import { useEstadoTela } from "@/hooks/use-estado-modulo";

/**
 * Setores: o cadastro dos setores que agrupam os cargos. Criar, renomear e
 * excluir são na janela do setor; a lista mostra quantos cargos cada um tem.
 */
export default function Conteudo() {
  const res = useSetoresAdmin();
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [alvo, setAlvo] = useState<AlvoSetor | null>(null);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => (d ?? []).filter((s) => !termo || normalizar(s.nome).includes(termo)), [d, termo]);

  const novo = () => setAlvo("novo");

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar os setores"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="camadas"
        titulo="Nenhum setor cadastrado"
        descricao="Crie os setores do escritório, como Contábil e Fiscal, para agrupar os cargos."
        acao={
          <Botao variante="primario" icone="mais" onClick={novo}>
            Criar setor
          </Botao>
        }
      />
    );
  else if (termo)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Nenhum setor com esse nome"
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <Botao variante="primario" icone="mais" onClick={novo}>
          Novo setor
        </Botao>
      </AcoesPagina>

      <Nota>O setor agrupa os cargos e não muda nenhuma permissão.</Nota>

      <Painel
        corpo="p-0"
        titulo="Setores"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Em ordem alfabética
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <Campo
            icone="buscar"
            placeholder="Nome do setor"
            aria-label="Buscar setor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            classeCaixa="w-full sm:w-56"
            fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
          />
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={2} linhas={6} />
        ) : (
          <TabelaSetores
            setores={linhas}
            onAbrir={setAlvo}
            selecionado={alvo && alvo !== "novo" ? alvo.id : null}
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalSetor alvo={alvo} onFechar={() => setAlvo(null)} />
    </>
  );
}
