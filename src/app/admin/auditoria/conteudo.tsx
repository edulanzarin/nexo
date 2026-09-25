"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao } from "@/componentes/primitivos/tabela";
import {
  DetalheEvento,
  OPCOES_MODULO_TRILHA,
  TabelaTrilha,
  TODOS_MODULOS,
} from "@/componentes/produto/admin/trilha";
import { CHAVES_ADMIN } from "@/hooks/use-admin";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import type { EventoTrilha, PaginaTrilha } from "@/lib/admin-tipos";
import { num } from "@/lib/format";

/**
 * Auditoria: a trilha de quem viu, gerou, exportou e mudou o quê, da mais
 * recente para a mais antiga. O filtro e a busca vão ao servidor, que corta em
 * páginas de cem: a trilha passa de dezenas de milhares de linhas.
 */
export default function Conteudo() {
  const [modulo, setModulo] = useEstadoTela("modulo", TODOS_MODULOS);
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [buscaAplicada, setBuscaAplicada] = useEstadoTela("buscaAplicada", "");
  const [aberto, setAberto] = useState<EventoTrilha | null>(null);

  // Digitar não dispara consulta a cada tecla.
  useEffect(() => {
    const alvo = busca.trim();
    if (alvo === buscaAplicada) return;
    const t = setTimeout(() => setBuscaAplicada(alvo), 350);
    return () => clearTimeout(t);
  }, [busca, buscaAplicada, setBuscaAplicada]);

  // A página guarda o filtro a que pertence: mudar módulo ou busca volta para
  // a primeira sem efeito que zere, e voltar de outra seção reencontra a
  // página onde estava.
  const recorte = `${modulo}|${buscaAplicada}`;
  const [pag, setPag] = useEstadoTela("pagina", { recorte, n: 1 });
  const pagina = pag.recorte === recorte ? pag.n : 1;

  const q = new URLSearchParams();
  if (modulo !== TODOS_MODULOS) q.set("modulo", modulo);
  if (buscaAplicada) q.set("busca", buscaAplicada);
  if (pagina > 1) q.set("pagina", String(pagina));
  const qs = q.toString();
  const res = useConsulta<PaginaTrilha>(CHAVES_ADMIN.trilha, `/api/admin/auditoria${qs ? `?${qs}` : ""}`);
  const d = res.data;
  const total = d?.total ?? 0;

  const comModulo = modulo !== TODOS_MODULOS;
  const temFiltro = comModulo || !!buscaAplicada;
  const limpar = () => {
    setModulo(TODOS_MODULOS);
    setBusca("");
    setBuscaAplicada("");
  };

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar a trilha"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  // A busca da ação casa com o verbo gravado, não com a frase da coluna:
  // "exportou" não acha nada, "export" acha. O vazio da busca diz isso.
  let vazio: ReactNode;
  if (temFiltro)
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhum evento com esse filtro"
        descricao={
          buscaAplicada
            ? "A busca olha a pessoa, o alvo e o nome gravado da ação (export, ficha, laudo)."
            : "Volte para Todos os módulos."
        }
        acao={<Botao onClick={limpar}>Limpar filtros</Botao>}
      />
    );
  else
    vazio = (
      <Vazio
        icone="historico"
        titulo="Nenhum evento registrado"
        descricao="Fichas vistas, laudos gerados, exportações e mudanças de acesso aparecem aqui."
      />
    );

  return (
    <>
      <Painel
        corpo="p-0"
        titulo="Eventos"
        descricao={
          d ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="num">
                {total === 0
                  ? "Nenhum evento"
                  : `${num(total)} ${total === 1 ? "evento" : "eventos"}, do mais recente`}
              </span>
              {res.isFetching && <Girando />}
            </span>
          ) : (
            "Carregando"
          )
        }
        rodape={
          d && total > 0 ? (
            <Paginacao
              pagina={pagina}
              porPagina={d.porPagina}
              total={total}
              onPagina={(n) => setPag({ recorte, n })}
            />
          ) : undefined
        }
      >
        {/* Os filtros numa faixa do corpo, e não nas ações do cabeçalho: lá eles
            não quebram linha e, no celular, empurrariam a página para o lado. */}
        <div className="flex flex-wrap gap-2 border-b border-linha px-4 py-2.5">
          <Combo
            opcoes={OPCOES_MODULO_TRILHA}
            valor={modulo}
            onMudar={setModulo}
            busca={false}
            icone="filtrar"
            rotuloAcessivel="Módulo"
            className="w-full sm:w-52"
          />
          <Campo
            icone="buscar"
            placeholder="Pessoa, alvo ou ação"
            aria-label="Buscar na trilha"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            classeCaixa="w-full sm:w-64"
            fim={
              busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined
            }
          />
        </div>
        {!d ? (
          <EsqueletoTabela colunas={4} />
        ) : (
          <TabelaTrilha eventos={d.linhas} onAbrir={setAberto} selecionado={aberto?.id} vazio={vazio} />
        )}
      </Painel>

      <DetalheEvento evento={aberto} onFechar={() => setAberto(null)} />
    </>
  );
}
