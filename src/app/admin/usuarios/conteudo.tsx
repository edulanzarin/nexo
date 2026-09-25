"use client";

import { useMemo, useState } from "react";
import { useCasca } from "@/componentes/casca/casca-cliente";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, Girando, PainelErro } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import {
  FILTRO_USUARIOS_VAZIO,
  filtrarUsuarios,
  filtroAtivo,
  FiltrosUsuarios,
  IndicadoresUsuarios,
  ModalUsuario,
  opcoesCargoUsuarios,
  TabelaUsuarios,
  VazioUsuarios,
  type AlvoUsuario,
  type FiltroUsuarios,
} from "@/componentes/produto/admin/usuarios";
import { useUsuariosAdmin } from "@/hooks/use-admin";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { num } from "@/lib/format";

/**
 * Usuários: quem entra no NaveX e com que cargos. Criar, abrir, desativar e
 * excluir são na janela da pessoa, sobre a lista; no nexo2 eram páginas.
 */
export default function Conteudo() {
  const { usuario: eu } = useCasca();
  const res = useUsuariosAdmin();
  const d = res.data;
  const [filtro, setFiltro] = useEstadoTela<FiltroUsuarios>("filtro", FILTRO_USUARIOS_VAZIO);
  const [alvo, setAlvo] = useState<AlvoUsuario | null>(null);

  const linhas = useMemo(() => filtrarUsuarios(d ?? [], filtro), [d, filtro]);
  const opcoesCargo = useMemo(() => opcoesCargoUsuarios(d ?? []), [d]);
  const novo = () => setAlvo("novo");

  return (
    <>
      <AcoesPagina>
        <Botao variante="primario" icone="mais" onClick={novo}>
          Novo usuário
        </Botao>
      </AcoesPagina>

      {res.isError ? (
        <PainelErro
          titulo="Não deu para carregar os usuários"
          mensagem={(res.error as Error).message}
          onTentar={() => res.refetch()}
        />
      ) : (
        <>
          <IndicadoresUsuarios usuarios={d} />
          <FiltrosUsuarios filtro={filtro} onMudar={setFiltro} opcoesCargo={opcoesCargo} />
          <Painel
            corpo="p-0"
            titulo="Pessoas"
            descricao={
              <span className="inline-flex items-center gap-1.5">
                {d && filtroAtivo(filtro)
                  ? `${num(linhas.length)} de ${num(d.length)} com esses filtros`
                  : "Em ordem alfabética"}
                {res.isFetching && d && <Girando />}
              </span>
            }
          >
            {!d ? (
              <EsqueletoTabela colunas={5} linhas={6} />
            ) : (
              <TabelaUsuarios
                usuarios={linhas}
                onAbrir={setAlvo}
                selecionado={alvo && alvo !== "novo" ? alvo.id : null}
                vazio={<VazioUsuarios total={d.length} filtro={filtro} onMudar={setFiltro} onNovo={novo} />}
              />
            )}
          </Painel>
        </>
      )}

      <ModalUsuario alvo={alvo} onFechar={() => setAlvo(null)} proprioId={eu.id} />
    </>
  );
}
