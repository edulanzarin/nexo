"use client";

import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { CelulaAcesso } from "@/componentes/produto/ti/acesso";
import { useJanelasAcessos } from "@/componentes/produto/ti/janelas-acessos";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useRegistroAcessos } from "@/hooks/use-ti";
import { dataHoraBR, hojeISO, num } from "@/lib/format";
import { diasEntre, fraseEvento, tipoAcesso, type AcaoEvento, type RegistroAcesso } from "@/lib/ti-acessos-tipos";

type Filtro = "todos" | "abertos" | "trocas" | "cadastro";

const ROTULO_FILTRO: Record<Filtro, string> = {
  todos: "Tudo",
  abertos: "Senhas vistas e copiadas",
  trocas: "Trocas de senha",
  cadastro: "Cadastro",
};

const DO_FILTRO: Record<Exclude<Filtro, "todos">, AcaoEvento[]> = {
  abertos: ["revelado", "copiado"],
  trocas: ["segredo", "removido"],
  cadastro: ["criado", "editado", "apagado"],
};

const TODOS = "*";

/**
 * O registro do cofre: quem viu, copiou ou trocou cada senha, e quem mexeu no
 * cadastro. É a resposta para "quem sabia a senha do banco antes de o
 * prestador sair", e o que torna trocar a senha uma decisão com dado.
 *
 * Só cresce: apagar um acesso não apaga o que aconteceu com ele. Exporta,
 * porque aqui não há segredo nenhum.
 */
export default function Conteudo() {
  const q = useRegistroAcessos();
  const j = useJanelasAcessos();
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "todos");
  const [quem, setQuem] = useEstadoTela("quem", TODOS);
  const [busca, setBusca] = useEstadoTela("busca", "");
  const hoje = hojeISO();

  const d = q.data;
  const todos = useMemo(() => d ?? [], [d]);

  const resumo = useMemo(() => {
    const r = { vistas7: 0, copias7: 0, trocas30: 0, pessoas30: new Set<string>() };
    for (const ev of todos) {
      const dias = diasEntre(ev.em, hoje);
      if (dias <= 7 && ev.acao === "revelado") r.vistas7++;
      if (dias <= 7 && ev.acao === "copiado") r.copias7++;
      if (dias <= 30 && ev.acao === "segredo") r.trocas30++;
      if (dias <= 30 && (ev.acao === "revelado" || ev.acao === "copiado") && ev.usuario) r.pessoas30.add(ev.usuario);
    }
    return r;
  }, [todos, hoje]);

  const opcoesQuem = useMemo<Opcao[]>(() => {
    const n = new Map<string, number>();
    for (const ev of todos) if (ev.usuario) n.set(ev.usuario, (n.get(ev.usuario) ?? 0) + 1);
    return [
      { valor: TODOS, rotulo: "Todo mundo", detalhe: num(todos.length) },
      ...[...n.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .map(([nome, c]) => ({ valor: nome, rotulo: nome, detalhe: num(c) })),
    ];
  }, [todos]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return todos.filter((ev) => {
      if (filtro !== "todos" && !DO_FILTRO[filtro].includes(ev.acao)) return false;
      if (quem !== TODOS && ev.usuario !== quem) return false;
      if (!partes.length) return true;
      const alvo = normalizar(`${ev.acesso.nome} ${tipoAcesso(ev.acesso.tipo).rotulo} ${fraseEvento(ev, ev.acesso.tipo).titulo}`);
      return partes.every((p) => alvo.includes(p));
    });
  }, [todos, filtro, quem, termo]);

  const colunas: Coluna<RegistroAcesso>[] = [
    {
      id: "em",
      cabecalho: "Quando",
      largura: "150px",
      ordenar: (ev) => ev.em,
      celula: (ev) => <span className="num whitespace-nowrap">{dataHoraBR(ev.em)}</span>,
    },
    {
      id: "quem",
      cabecalho: "Quem",
      largura: "22%",
      ordenar: (ev) => ev.usuario,
      celula: (ev) => <span className="truncate">{ev.usuario ?? <span className="text-apagado">Sem sessão</span>}</span>,
    },
    {
      id: "oque",
      cabecalho: "O que fez",
      largura: "26%",
      ordenar: (ev) => fraseEvento(ev, ev.acesso.tipo).titulo,
      celula: (ev) => {
        const f = fraseEvento(ev, ev.acesso.tipo);
        const aberto = ev.acao === "revelado" || ev.acao === "copiado";
        return (
          <span className={aberto ? "inline-flex items-center gap-1.5 text-atencao" : "inline-flex items-center gap-1.5 text-tinta"}>
            <Icone nome={f.icone} tamanho={15} className="shrink-0" />
            <span className="truncate">{f.titulo}</span>
          </span>
        );
      },
    },
    {
      id: "acesso",
      cabecalho: "Acesso",
      largura: "34%",
      ordenar: (ev) => ev.acesso.nome.toLowerCase(),
      celula: (ev) => (
        <span className="flex min-w-0 items-center gap-2">
          <CelulaAcesso a={{ tipo: ev.acesso.tipo, nome: ev.acesso.nome, grupo: null }} />
          {ev.acesso.id == null && <Selo tom="neutro">Apagado</Selo>}
        </span>
      ),
    },
  ];

  if (q.isError)
    return <PainelErro titulo="Não deu para carregar o registro" mensagem={(q.error as Error).message} onTentar={() => q.refetch()} />;

  const filtrado = filtro !== "todos" || quem !== TODOS || busca !== "";
  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="historico"
        titulo="Nada registrado ainda"
        descricao="Cada senha vista, copiada ou trocada no cofre aparece aqui, com quem e quando."
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nada neste filtro"
        acao={
          filtrado ? (
            <Botao
              onClick={() => {
                setFiltro("todos");
                setQuem(TODOS);
                setBusca("");
              }}
            >
              Limpar filtros
            </Botao>
          ) : undefined
        }
      />
    );

  const descricaoFiltro = [ROTULO_FILTRO[filtro], quem !== TODOS && quem, busca && `busca "${busca}"`].filter(Boolean).join(" · ");

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="ti"
          desabilitado={!d?.length}
          cortes={[
            {
              id: "registro",
              rotulo: "Registro do cofre",
              descricao: descricaoFiltro,
              nome: "registro-cofre-ti",
              montar: () => ({
                cabecalhos: ["Quando", "Quem", "O que fez", "Acesso", "Tipo"],
                linhas: linhas.map((ev) => [
                  dataHoraBR(ev.em),
                  ev.usuario ?? "",
                  fraseEvento(ev, ev.acesso.tipo).titulo,
                  ev.acesso.nome,
                  tipoAcesso(ev.acesso.tipo).rotulo,
                ]),
              }),
            },
          ]}
        />
      </AcoesPagina>

      <FaixaIndicadores>
        <Indicador
          rotulo="Vistas em 7 dias"
          icone="ver"
          carregando={!d}
          valor={num(resumo.vistas7)}
          detalhe={`${num(resumo.copias7)} ${resumo.copias7 === 1 ? "cópia" : "cópias"} no mesmo período`}
          onClick={() => setFiltro("abertos")}
        />
        <Indicador
          rotulo="Quem abriu senha"
          icone="pessoas"
          carregando={!d}
          valor={num(resumo.pessoas30.size)}
          detalhe={resumo.pessoas30.size === 1 ? "pessoa nos últimos 30 dias" : "pessoas nos últimos 30 dias"}
        />
        <Indicador
          rotulo="Trocas em 30 dias"
          icone="chave"
          carregando={!d}
          valor={num(resumo.trocas30)}
          detalhe="senhas trocadas no cofre"
          onClick={() => setFiltro("trocas")}
        />
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Registro"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            {d ? `${num(linhas.length)} de ${num(todos.length)} · ${descricaoFiltro}` : "Carregando"}
            {q.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <>
            <Combo
              opcoes={(Object.keys(ROTULO_FILTRO) as Filtro[]).map((f) => ({ valor: f, rotulo: ROTULO_FILTRO[f] }))}
              valor={filtro}
              onMudar={(v) => setFiltro(v as Filtro)}
              rotuloAcessivel="O que fez"
              className="w-56"
              busca={false}
            />
            <Combo opcoes={opcoesQuem} valor={quem} onMudar={setQuem} rotuloAcessivel="Quem" className="w-48" />
            <Campo
              icone="buscar"
              placeholder="Acesso"
              aria-label="Buscar no registro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-52"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
          </>
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={4} linhas={10} />
        ) : (
          <TabelaDados
            rotulo="Registro do cofre"
            colunas={colunas}
            linhas={linhas}
            chave={(ev) => String(ev.id)}
            onLinha={(ev) => ev.acesso.id != null && j.abrirFicha(ev.acesso.id)}
            ordemInicial={{ coluna: "em", sentido: "desc" }}
            alturaMax="min(68dvh, 760px)"
            vazio={vazio}
          />
        )}
      </Painel>

      {j.elemento}
    </>
  );
}
