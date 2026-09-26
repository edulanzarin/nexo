"use client";

import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { CelulaAcesso, Segredo, TextoCopiavel } from "@/componentes/produto/ti/acesso";
import { useJanelasAcessos } from "@/componentes/produto/ti/janelas-acessos";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { dataBR, hojeISO, num } from "@/lib/format";
import {
  diasEntre,
  DIAS_LICENCA,
  enderecoAcesso,
  segredoAntigo,
  TIPOS_ACESSO,
  tipoAcesso,
  usuarioAcesso,
  type AcessoLista,
} from "@/lib/ti-acessos-tipos";

type Filtro = "todos" | "antigas" | "sem-segredo" | "licencas" | "outra-chave";

const ROTULO_FILTRO: Record<Filtro, string> = {
  todos: "Todos",
  antigas: "Senha antiga",
  "sem-segredo": "Sem senha guardada",
  licencas: "Licença vencendo",
  "outra-chave": "Outra chave",
};

const TODOS = "*";
const SEM_GRUPO = "-";

/** A troca mais recente entre os segredos guardados: é o que a coluna mostra. */
const ultimaTroca = (a: AcessoLista) =>
  Object.values(a.segredos)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

/**
 * O cofre: cada acesso da infraestrutura com endereço, usuário e a senha
 * mascarada. Endereço e usuário se copiam com um clique; a senha abre ou se
 * copia pelo servidor, que registra quem abriu. A lista nunca carrega senha.
 *
 * Não tem exportar de propósito: planilha com o cofre inteiro é o arquivo que
 * vaza. O que se exporta é o Registro, que não tem segredo.
 */
export default function Conteudo() {
  const j = useJanelasAcessos();
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "todos");
  const [tipo, setTipo] = useEstadoTela("tipo", TODOS);
  const [grupo, setGrupo] = useEstadoTela("grupo", TODOS);
  const [busca, setBusca] = useEstadoTela("busca", "");
  const hoje = hojeISO();

  const d = j.lista.data;
  const todos = useMemo(() => d?.acessos ?? [], [d]);

  const situacao = useMemo(() => {
    const m = new Map<number, Set<Filtro>>();
    for (const a of todos) {
      const s = new Set<Filtro>(["todos"]);
      if (segredoAntigo(a, hoje)) s.add("antigas");
      if (tipoAcesso(a.tipo).segredos.every((x) => !a.segredos[x])) s.add("sem-segredo");
      if (a.campos.validade && diasEntre(hoje, a.campos.validade) <= DIAS_LICENCA) s.add("licencas");
      if (a.outraChave.length) s.add("outra-chave");
      m.set(a.id, s);
    }
    return m;
  }, [todos, hoje]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, antigas: 0, "sem-segredo": 0, licencas: 0, "outra-chave": 0 };
    for (const s of situacao.values()) for (const f of s) c[f]++;
    return c;
  }, [situacao]);

  const opcoesTipo = useMemo<Opcao[]>(() => {
    const n = new Map<string, number>();
    for (const a of todos) n.set(a.tipo, (n.get(a.tipo) ?? 0) + 1);
    return [
      { valor: TODOS, rotulo: "Todos os tipos", detalhe: num(todos.length) },
      ...TIPOS_ACESSO.filter((t) => n.has(t.id) || t.id === tipo).map((t) => ({
        valor: t.id,
        rotulo: t.rotulo,
        icone: t.icone as Opcao["icone"],
        detalhe: num(n.get(t.id) ?? 0),
      })),
    ];
  }, [todos, tipo]);

  const opcoesGrupo = useMemo<Opcao[]>(() => {
    const n = new Map<string, number>();
    let sem = 0;
    for (const a of todos) {
      if (a.grupo) n.set(a.grupo, (n.get(a.grupo) ?? 0) + 1);
      else sem++;
    }
    return [
      { valor: TODOS, rotulo: "Todos os grupos", detalhe: num(todos.length) },
      ...j.grupos.map((g) => ({ valor: g, rotulo: g, detalhe: num(n.get(g) ?? 0) })),
      ...(sem ? [{ valor: SEM_GRUPO, rotulo: "Sem grupo", detalhe: num(sem) }] : []),
    ];
  }, [todos, j.grupos]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return todos.filter((a) => {
      if (!situacao.get(a.id)?.has(filtro)) return false;
      if (tipo !== TODOS && a.tipo !== tipo) return false;
      if (grupo === SEM_GRUPO && a.grupo) return false;
      if (grupo !== TODOS && grupo !== SEM_GRUPO && a.grupo?.toLowerCase() !== grupo.toLowerCase()) return false;
      if (!partes.length) return true;
      const alvo = normalizar(
        [
          a.nome,
          a.grupo,
          tipoAcesso(a.tipo).rotulo,
          ...Object.values(a.campos),
          a.observacoes,
          a.equipamento?.nome,
          a.equipamento?.patrimonio,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return partes.every((p) => alvo.includes(p));
    });
  }, [todos, situacao, filtro, tipo, grupo, termo]);

  const semChave = d ? !d.chave : false;

  const colunas: Coluna<AcessoLista>[] = [
    {
      id: "nome",
      cabecalho: "Acesso",
      largura: "30%",
      ordenar: (a) => a.nome.toLowerCase(),
      celula: (a) => <CelulaAcesso a={a} />,
    },
    {
      id: "endereco",
      cabecalho: "Endereço",
      largura: "26%",
      ordenar: (a) => enderecoAcesso(a),
      celula: (a) => <TextoCopiavel valor={enderecoAcesso(a)} rotulo="Endereço" />,
    },
    {
      id: "usuario",
      cabecalho: "Usuário",
      largura: "18%",
      ordenar: (a) => usuarioAcesso(a),
      celula: (a) => <TextoCopiavel valor={usuarioAcesso(a)} rotulo="Usuário" />,
    },
    {
      id: "segredo",
      cabecalho: "Senha",
      largura: "18%",
      celula: (a) => {
        const s = tipoAcesso(a.tipo).segredos[0];
        return (
          <Segredo
            acessoId={a.id}
            campo={s}
            guardado={!!a.segredos[s]}
            outraChave={a.outraChave.includes(s)}
            semChave={semChave}
          />
        );
      },
    },
    {
      id: "troca",
      cabecalho: "Trocada em",
      largura: "110px",
      secundaria: true,
      ordenar: (a) => ultimaTroca(a),
      celula: (a) => {
        const t = ultimaTroca(a);
        const antiga = situacao.get(a.id)?.has("antigas");
        return t ? <span className={antiga ? "num text-atencao" : "num"}>{dataBR(t)}</span> : <span className="text-apagado">—</span>;
      },
    },
  ];

  if (j.lista.isError)
    return (
      <PainelErro titulo="Não deu para abrir o cofre" mensagem={(j.lista.error as Error).message} onTentar={() => j.lista.refetch()} />
    );

  const filtrado = filtro !== "todos" || tipo !== TODOS || grupo !== TODOS || busca !== "";
  let vazio: ReactNode;
  if (d && d.acessos.length === 0)
    vazio = (
      <Vazio
        icone="cofre"
        titulo="Nenhum acesso no cofre"
        descricao="Guarde a senha do Wi-Fi, do roteador, dos bancos de dados e do acesso remoto. Quem vê ou copia uma senha fica no registro."
        acao={
          <Botao variante="primario" icone="mais" onClick={j.novo}>
            Novo acesso
          </Botao>
        }
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhum acesso neste filtro"
        acao={
          filtrado ? (
            <Botao
              onClick={() => {
                setFiltro("todos");
                setTipo(TODOS);
                setGrupo(TODOS);
                setBusca("");
              }}
            >
              Limpar filtros
            </Botao>
          ) : undefined
        }
      />
    );

  const descricaoFiltro = [
    ROTULO_FILTRO[filtro],
    tipo !== TODOS && tipoAcesso(tipo).rotulo,
    grupo !== TODOS && (grupo === SEM_GRUPO ? "sem grupo" : grupo),
    busca && `busca "${busca}"`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <AcoesPagina>
        <Botao variante="primario" icone="mais" onClick={j.novo}>
          Novo acesso
        </Botao>
      </AcoesPagina>

      {semChave && (
        <Nota tom="perigo" icone="cadeado">
          O servidor está sem a chave do cofre (TI_COFRE_CHAVE no .env). O cadastro aparece, mas nenhuma senha pode ser
          guardada nem aberta até a chave entrar.
        </Nota>
      )}
      {contagem["outra-chave"] > 0 && (
        <Nota tom="atencao" icone="alerta">
          {num(contagem["outra-chave"])} {contagem["outra-chave"] === 1 ? "acesso tem senha guardada" : "acessos têm senha guardada"} com
          outra chave do cofre, que não abre com a de agora. Se a chave mudou, volte a antiga ao .env ou guarde as senhas de novo.
        </Nota>
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Acessos"
          icone="cofre"
          carregando={!d}
          valor={num(todos.length)}
          detalhe={j.grupos.length ? `em ${num(j.grupos.length)} ${j.grupos.length === 1 ? "grupo" : "grupos"}` : "no cofre"}
          onClick={() => setFiltro("todos")}
        />
        <Indicador
          rotulo="Senha antiga"
          icone="relogio"
          carregando={!d}
          valor={num(contagem.antigas)}
          tom={contagem.antigas ? "atencao" : "ok"}
          detalhe="sem troca há mais de um ano"
          onClick={() => setFiltro("antigas")}
        />
        <Indicador
          rotulo="Sem senha guardada"
          icone="pendente"
          carregando={!d}
          valor={num(contagem["sem-segredo"])}
          detalhe="para completar"
          onClick={() => setFiltro("sem-segredo")}
        />
        {contagem.licencas > 0 && (
          <Indicador
            rotulo="Licença vencendo"
            icone="licenca"
            valor={num(contagem.licencas)}
            tom="atencao"
            valorNoTom
            detalhe={`vencidas ou em ${DIAS_LICENCA} dias`}
            onClick={() => setFiltro("licencas")}
          />
        )}
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Cofre"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            {d ? `${num(linhas.length)} de ${num(todos.length)} · ${descricaoFiltro}` : "Carregando"}
            {j.lista.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <>
            <Combo
              opcoes={(Object.keys(ROTULO_FILTRO) as Filtro[])
                .filter((f) => f !== "outra-chave" || contagem[f] > 0 || filtro === f)
                .map((f) => ({ valor: f, rotulo: ROTULO_FILTRO[f], detalhe: num(contagem[f]) }))}
              valor={filtro}
              onMudar={(v) => setFiltro(v as Filtro)}
              rotuloAcessivel="Situação"
              className="w-48"
              busca={false}
            />
            <Combo opcoes={opcoesTipo} valor={tipo} onMudar={setTipo} rotuloAcessivel="Tipo" className="w-48" busca={false} />
            {j.grupos.length > 0 && (
              <Combo opcoes={opcoesGrupo} valor={grupo} onMudar={setGrupo} rotuloAcessivel="Grupo" className="w-44" />
            )}
            <Campo
              icone="buscar"
              placeholder="Nome, IP, usuário"
              aria-label="Buscar acesso"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-56"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
          </>
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={5} linhas={8} />
        ) : (
          <TabelaDados
            rotulo="Acessos"
            colunas={colunas}
            linhas={linhas}
            chave={(a) => String(a.id)}
            onLinha={(a) => j.abrirFicha(a.id)}
            selecionada={(a) => a.id === j.fichaAberta}
            ordemInicial={{ coluna: "nome", sentido: "asc" }}
            alturaMax="min(68dvh, 760px)"
            vazio={vazio}
          />
        )}
      </Painel>

      {j.elemento}
    </>
  );
}
