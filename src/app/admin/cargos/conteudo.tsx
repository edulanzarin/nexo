"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { ComboMulti, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaCargos } from "@/componentes/produto/admin/cargos";
import { useCargosAdmin } from "@/hooks/use-admin";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import type { CargoResumo } from "@/lib/admin-tipos";
import { num } from "@/lib/format";

/** Valor do filtro para o cargo sem setor: o id do setor nunca é zero. */
const SEM_SETOR = "0";
const chaveSetor = (c: CargoResumo) => (c.setorId == null ? SEM_SETOR : String(c.setorId));

/**
 * Cargos: a lista, com busca por nome e filtro por setor. O cargo abre numa
 * página própria (`/admin/cargos/<id>`), onde mora a matriz de permissões.
 */
export default function Conteudo() {
  const router = useRouter();
  const res = useCargosAdmin();
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [setores, setSetores] = useEstadoTela<string[]>("setores", []);

  // Só os setores que têm cargo, com quantos: filtrar por setor vazio não acharia nada.
  const opcoesSetor = useMemo<Opcao[]>(() => {
    const cont = new Map<string, { rotulo: string; n: number }>();
    for (const c of d ?? []) {
      const k = chaveSetor(c);
      const atual = cont.get(k) ?? { rotulo: c.setorNome ?? "Sem setor", n: 0 };
      cont.set(k, { ...atual, n: atual.n + 1 });
    }
    return [...cont.entries()]
      .map(([valor, v]) => ({ valor, rotulo: v.rotulo, detalhe: num(v.n) }))
      .sort((a, b) =>
        a.valor === SEM_SETOR ? 1 : b.valor === SEM_SETOR ? -1 : a.rotulo.localeCompare(b.rotulo, "pt-BR")
      );
  }, [d]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(
    () =>
      (d ?? []).filter(
        (c) =>
          (!termo || normalizar(c.nome).includes(termo)) && (!setores.length || setores.includes(chaveSetor(c)))
      ),
    [d, termo, setores]
  );

  const limpar = () => {
    setBusca("");
    setSetores([]);
  };

  if (res.isError && !d)
    return (
      <PainelErro
        titulo="Não deu para carregar os cargos"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="chave"
        titulo="Nenhum cargo cadastrado"
        descricao="O cargo diz que seções e que empresas a pessoa vê. Crie o primeiro e atribua em Usuários."
        acao={
          <BotaoLink variante="primario" icone="mais" href="/admin/cargos/novo">
            Criar cargo
          </BotaoLink>
        }
      />
    );
  else if (termo || setores.length)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo={setores.length ? "Nenhum cargo com esses filtros" : "Nenhum cargo com esse nome"}
        acao={<Botao onClick={limpar}>{setores.length ? "Limpar filtros" : "Limpar busca"}</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <BotaoLink variante="primario" icone="mais" href="/admin/cargos/novo">
          Novo cargo
        </BotaoLink>
      </AcoesPagina>

      <Nota>A pessoa pode ter mais de um cargo e fica com a soma do que eles liberam.</Nota>

      <Painel
        corpo="p-0"
        titulo="Cargos"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Por setor, em ordem alfabética
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="Nome do cargo"
              aria-label="Buscar cargo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-56"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <ComboMulti
              opcoes={opcoesSetor}
              valor={setores}
              onMudar={setSetores}
              rotuloTodas="Todos os setores"
              plural="setores"
              icone="camadas"
              rotuloAcessivel="Filtrar por setor"
              desabilitado={!opcoesSetor.length}
              className="w-full sm:w-52"
            />
          </>
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={5} linhas={6} />
        ) : (
          <TabelaCargos cargos={linhas} onAbrir={(c) => router.push(`/admin/cargos/${c.id}`)} vazio={vazio} />
        )}
      </Painel>
    </>
  );
}
