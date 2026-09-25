"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Esqueleto, EsqueletoTabela, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { mutar } from "@/hooks/mutar";
import { buscarJson, useConsulta } from "@/hooks/use-consulta";
import { dataBR, num } from "@/lib/format";
import { membrosDoGrupo, type ModoGrupo } from "@/lib/grupo-modo";
import {
  NOME_GRUPO_MAX,
  type EmpresaMarcavel,
  type GrupoEmpresaCadastro,
  type GrupoEmpresaDetalhe,
} from "@/lib/grupos-empresa-tipos";
import { CampoEmpresasGrupo } from "../grupo-empresas-campo";

/*
 * Grupos de empresa de negócio: a U FIT e as empresas dela, para o seletor de
 * empresa do topo filtrar as telas pelo grupo inteiro e para o Post Mortem
 * dizer de que grupo era o cliente.
 *
 * A mesma montagem (lista, janela, remoção) serve aos grupos de permissão da
 * Administração, que são o mesmo desenho sobre outra tabela. O que muda entre
 * os dois mora num `CadastroGrupo`; as peças sem o sufixo `Cadastro` são as de
 * negócio, com o cadastro delas já ligado.
 */

/** Chave da lista do cadastro. Quem escreve invalida por ela e pela do seletor do topo. */
export const CHAVE_GRUPOS_CADASTRO = "config-grupos-empresa";
const CHAVE_EMPRESAS = "config-empresas";

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

// ── O que muda entre os cadastros ───────────────────────────────────────────

/** O que a lista e a janela leem de um grupo, nos dois cadastros. */
export interface GrupoListado {
  id: number;
  nome: string;
  modo: ModoGrupo;
  /** Quantas empresas o grupo tem hoje. */
  empresas: number;
  /** Quantas estão marcadas: no modo `exceto`, as que ficam de fora. */
  marcadas: number;
  atualizadoEm: string;
}

export interface CadastroGrupo<G extends GrupoListado> {
  /** Rota da lista e do POST. O grupo aberto, o PATCH e o DELETE vão em `${api}/<id>`. */
  api: string;
  /** Chave do grupo aberto no cache. */
  chaveGrupo: string;
  /** O universo de empresas, com a mesma chave e URL do hook das outras telas. */
  empresas: { chave: string; url: string };
  /** Listas que mudam quando um grupo muda: invalidadas depois de escrever. */
  invalidar: string[];
  rotuloTabela: string;
  /** Largura da coluna do nome: cede espaço às colunas de uso, quando há. */
  larguraNome: string;
  /** Colunas entre Empresas e Atualizado em (quem usa o grupo). */
  colunasUso?: Coluna<G>[];
  /** O que o selo "Sem empresa" explica ao passar o mouse. */
  dicaSemEmpresa: string;
  tituloNovo: string;
  descricaoNovo: string;
  exemploNome: string;
  descricao: (g: G) => string;
  /** Por que o grupo não pode sair, dito antes do clique. Null quando pode. */
  trava: (g: G) => ReactNode;
  /** O que a remoção desfaz, ao lado do Confirmar. */
  efeito: (g: G) => string;
}

// ── A lista ──────────────────────────────────────────────────────────────────

function colunasDoCadastro<G extends GrupoListado>(cad: CadastroGrupo<G>): Coluna<G>[] {
  return [
    {
      id: "nome",
      cabecalho: "Grupo",
      largura: cad.larguraNome,
      ordenar: (g) => g.nome,
      celula: (g) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-[560] text-tinta" title={g.nome}>
            {g.nome}
          </span>
          {g.modo === "exceto" && (
            <Selo title="Toda empresa do Questor menos as marcadas. Empresa nova entra sozinha.">
              Todas, exceto {num(g.marcadas)}
            </Selo>
          )}
          {g.empresas === 0 && (
            <Selo tom="atencao" title={cad.dicaSemEmpresa}>
              Sem empresa
            </Selo>
          )}
        </span>
      ),
    },
    {
      id: "empresas",
      cabecalho: "Empresas",
      alinhar: "dir",
      largura: "112px",
      ordenar: (g) => g.empresas,
      celula: (g) => num(g.empresas),
    },
    ...(cad.colunasUso ?? []),
    {
      id: "atualizado",
      cabecalho: "Atualizado em",
      secundaria: true,
      largura: "136px",
      ordenar: (g) => g.atualizadoEm,
      celula: (g) => <span className="num">{dataBR(g.atualizadoEm)}</span>,
    },
  ];
}

/** Os grupos de um cadastro, uma linha cada. O clique abre o grupo. */
export function TabelaGruposCadastro<G extends GrupoListado>({
  cadastro,
  grupos,
  onAbrir,
  selecionado,
  vazio,
  alturaMax = "62vh",
}: {
  cadastro: CadastroGrupo<G>;
  grupos: G[];
  onAbrir: (g: G) => void;
  selecionado?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  const colunas = useMemo(() => colunasDoCadastro(cadastro), [cadastro]);
  return (
    <TabelaDados
      rotulo={cadastro.rotuloTabela}
      colunas={colunas}
      linhas={grupos}
      chave={(g) => String(g.id)}
      onLinha={onAbrir}
      selecionada={(g) => g.id === selecionado}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── O grupo aberto ───────────────────────────────────────────────────────────

export interface RascunhoGrupo {
  nome: string;
  modo: ModoGrupo;
  marcadas: Set<number>;
}

const rascunhoVazio = (): RascunhoGrupo => ({ nome: "", modo: "lista", marcadas: new Set() });

function iguais(a: RascunhoGrupo, b: RascunhoGrupo): boolean {
  return (
    a.nome.trim() === b.nome.trim() &&
    a.modo === b.modo &&
    a.marcadas.size === b.marcadas.size &&
    [...a.marcadas].every((c) => b.marcadas.has(c))
  );
}

// O relatório aponta para o grupo de negócio por chave estrangeira: o banco recusaria.
function travaNegocio(relatorios: number): ReactNode {
  if (relatorios <= 0) return null;
  return (
    <>
      {relatorios === 1 ? "Um relatório" : `${num(relatorios)} relatórios`} do Post Mortem{" "}
      {relatorios === 1 ? "usa" : "usam"} este grupo, e por isso ele não pode ser removido.
    </>
  );
}

const EFEITO_NEGOCIO = "O grupo sai do seletor de empresa de todos.";

function RemoverGrupo({
  trava,
  efeito,
  onRemover,
  confirmandoInicial = false,
}: {
  trava: ReactNode;
  efeito: string;
  onRemover: () => Promise<boolean>;
  confirmandoInicial?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const [removendo, setRemovendo] = useState(false);
  let conteudo: ReactNode;
  if (trava) conteudo = <Nota>{trava}</Nota>;
  else if (confirmando)
    conteudo = (
      <>
        <Botao
          variante="perigo"
          icone="apagar"
          carregando={removendo}
          onClick={async () => {
            setRemovendo(true);
            const ok = await onRemover();
            setRemovendo(false);
            if (ok) setConfirmando(false);
          }}
        >
          Confirmar remoção
        </Botao>
        <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={removendo}>
          Cancelar
        </Botao>
        <span className="text-pequeno text-apagado">{efeito}</span>
      </>
    );
  else
    conteudo = (
      <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)}>
        Remover grupo
      </Botao>
    );
  return <div className="flex flex-wrap items-center gap-1.5 border-t border-linha pt-4">{conteudo}</div>;
}

/**
 * O corpo do grupo: o nome, as empresas e, no grupo que já existe, a remoção.
 * Controlado: o rascunho mora em quem abre, que compara com o gravado para
 * saber se há o que salvar.
 */
export function CorpoGrupoEmpresa({
  rascunho,
  onMudar,
  empresas,
  carregandoEmpresas,
  idForm,
  onEnviar,
  remocao,
  trocouInicial,
  exemploNome = "U FIT",
}: {
  rascunho: RascunhoGrupo;
  onMudar: (r: RascunhoGrupo) => void;
  empresas: EmpresaMarcavel[];
  carregandoEmpresas?: boolean;
  idForm?: string;
  onEnviar?: () => void;
  /**
   * Só no grupo que já existe. Sem `trava` e `efeito`, vale o grupo de
   * negócio: a trava é o uso em relatório do Post Mortem.
   */
  remocao?: {
    relatorios?: number;
    trava?: ReactNode;
    efeito?: string;
    onRemover: () => Promise<boolean>;
    confirmandoInicial?: boolean;
  };
  trocouInicial?: boolean;
  exemploNome?: string;
}) {
  const base = useId();
  return (
    <form
      id={idForm}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar?.();
      }}
    >
      <Rotulado rotulo="Nome do grupo" htmlFor={`${base}-nome`} className="max-w-md">
        <Campo
          id={`${base}-nome`}
          data-autofoco
          value={rascunho.nome}
          maxLength={NOME_GRUPO_MAX}
          placeholder={exemploNome}
          onChange={(e) => onMudar({ ...rascunho, nome: e.target.value })}
        />
      </Rotulado>
      <CampoEmpresasGrupo
        empresas={empresas}
        carregando={carregandoEmpresas}
        modo={rascunho.modo}
        marcadas={rascunho.marcadas}
        onMudar={(v) => onMudar({ ...rascunho, ...v })}
        // Lido só na montagem: o grupo aberto começa pelas empresas dele.
        visaoInicial={remocao && rascunho.marcadas.size > 0 ? "marcadas" : "todas"}
        trocouInicial={trocouInicial}
      />
      {remocao && (
        <RemoverGrupo
          trava={remocao.trava !== undefined ? remocao.trava : travaNegocio(remocao.relatorios ?? 0)}
          efeito={remocao.efeito ?? EFEITO_NEGOCIO}
          onRemover={remocao.onRemover}
          confirmandoInicial={remocao.confirmandoInicial}
        />
      )}
    </form>
  );
}

/** O que o rodapé diz: quantas empresas o grupo tem, ou o que falta para salvar. */
function resumoRascunho(r: RascunhoGrupo, empresas: EmpresaMarcavel[] | undefined): string {
  if (!empresas) return "Carregando empresas";
  if (r.modo === "lista" && r.marcadas.size === 0) return "Marque ao menos uma empresa";
  const n = membrosDoGrupo(
    r.modo,
    r.marcadas,
    empresas.map((e) => e.codigo)
  ).length;
  return `${plural(n, "empresa", "empresas")} no grupo`;
}

function RodapeGrupo({
  resumo,
  novo,
  pronto,
  salvando,
  idForm,
  onCancelar,
}: {
  resumo: string;
  novo: boolean;
  pronto: boolean;
  salvando?: boolean;
  idForm?: string;
  onCancelar: () => void;
}) {
  return (
    <>
      <span className="num mr-auto text-pequeno text-apagado">{resumo}</span>
      <Botao variante="fantasma" onClick={onCancelar}>
        Cancelar
      </Botao>
      <Botao
        type="submit"
        form={idForm}
        variante="primario"
        icone={novo ? "mais" : "salvar"}
        carregando={salvando}
        disabled={!pronto}
      >
        {novo ? "Criar grupo" : "Salvar"}
      </Botao>
    </>
  );
}

export function descricaoGrupo(g: GrupoEmpresaCadastro): string {
  return [
    plural(g.empresas, "empresa", "empresas"),
    g.atualizadoEm ? `atualizado em ${dataBR(g.atualizadoEm)}` : null,
    g.relatorios ? `em ${plural(g.relatorios, "relatório", "relatórios")} do Post Mortem` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** O cadastro de grupos de negócio (Configurações). */
export const CADASTRO_GRUPO_NEGOCIO: CadastroGrupo<GrupoEmpresaCadastro> = {
  api: "/api/config/grupos-empresa",
  chaveGrupo: "config-grupo",
  empresas: { chave: CHAVE_EMPRESAS, url: "/api/config/empresas" },
  // A lista do cadastro e a do seletor de empresa do topo mostram o mesmo grupo.
  invalidar: [CHAVE_GRUPOS_CADASTRO, "grupos-empresa"],
  rotuloTabela: "Grupos de empresa",
  larguraNome: "64%",
  dicaSemEmpresa: "Grupo sem empresa não aparece no seletor de empresa",
  tituloNovo: "Novo Grupo",
  descricaoNovo: "Empresas de um mesmo negócio, para filtrar as telas pelo grupo de uma vez",
  exemploNome: "U FIT",
  descricao: descricaoGrupo,
  trava: (g) => travaNegocio(g.relatorios),
  efeito: () => EFEITO_NEGOCIO,
};

/** Quem a janela abre: um grupo novo ou um da lista. */
export type AlvoGrupo<G extends GrupoListado = GrupoEmpresaCadastro> = "novo" | G;

/** A janela do grupo de um cadastro, com as escritas. Fecha sozinha ao salvar e ao remover. */
export function ModalGrupoCadastro<G extends GrupoListado>({
  cadastro: cad,
  alvo,
  onFechar,
}: {
  cadastro: CadastroGrupo<G>;
  alvo: AlvoGrupo<G> | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const idForm = useId();
  const novo = alvo === "novo";
  const grupo = alvo && alvo !== "novo" ? alvo : null;

  const empresas = useConsulta<EmpresaMarcavel[]>(cad.empresas.chave, alvo ? cad.empresas.url : null, {
    staleTime: 10 * 60_000,
  });
  // Sem cache entre aberturas: o grupo aberto é sempre o gravado agora, e a
  // volta à janela do navegador não recarrega por cima do que está sendo editado.
  const detalhe = useQuery<GrupoEmpresaDetalhe>({
    queryKey: [cad.chaveGrupo, grupo?.id ?? null],
    queryFn: () => buscarJson<GrupoEmpresaDetalhe>(`${cad.api}/${grupo!.id}`),
    enabled: grupo != null,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // O rascunho nasce uma vez por abertura: do grupo gravado, ou vazio.
  const origem = alvo == null ? null : novo ? "novo" : detalhe.data ? `g${detalhe.data.id}` : null;
  const [inicio, setInicio] = useState<{ origem: string | null; rascunho: RascunhoGrupo | null }>({
    origem: null,
    rascunho: null,
  });
  const [rascunho, setRascunho] = useState<RascunhoGrupo | null>(null);
  if (origem !== inicio.origem) {
    const r =
      origem == null
        ? null
        : novo || !detalhe.data
          ? rascunhoVazio()
          : { nome: detalhe.data.nome, modo: detalhe.data.modo, marcadas: new Set(detalhe.data.empresas) };
    setInicio({ origem, rascunho: r });
    setRascunho(r);
  }

  const [salvando, setSalvando] = useState(false);
  const mudou = !!rascunho && !!inicio.rascunho && !iguais(rascunho, inicio.rascunho);
  const pronto =
    !!rascunho &&
    !!empresas.data &&
    rascunho.nome.trim() !== "" &&
    (rascunho.modo === "exceto" || rascunho.marcadas.size > 0) &&
    (novo || mudou);

  const invalidar = () =>
    Promise.all(
      cad.invalidar.map((chave) =>
        qc.invalidateQueries({
          queryKey: [chave],
          // O grupo aberto só é marcado: relido agora, o removido acenderia o
          // erro "não existe mais" na janela que está fechando.
          refetchType: chave === cad.chaveGrupo ? "none" : "active",
        })
      )
    );

  async function salvar() {
    if (!rascunho || !pronto) return;
    const nome = rascunho.nome.trim();
    const corpo = { nome, modo: rascunho.modo, empresas: [...rascunho.marcadas] };
    setSalvando(true);
    try {
      if (grupo) await mutar(`${cad.api}/${grupo.id}`, "PATCH", corpo);
      else await mutar(cad.api, "POST", corpo);
      await invalidar();
      avisar.ok(novo ? "Grupo criado" : "Grupo salvo", `${nome} · ${resumoRascunho(rascunho, empresas.data)}`);
      onFechar();
    } catch (e) {
      avisar.erro(novo ? "Não deu para criar o grupo" : "Não deu para salvar o grupo", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(): Promise<boolean> {
    if (!grupo) return false;
    try {
      await mutar(`${cad.api}/${grupo.id}`, "DELETE");
      await invalidar();
      avisar.ok("Grupo removido", grupo.nome);
      onFechar();
      return true;
    } catch (e) {
      avisar.erro("Não deu para remover o grupo", (e as Error).message);
      return false;
    }
  }

  let corpo: ReactNode;
  if (grupo && detalhe.isError)
    corpo = (
      <PainelErro
        titulo="Não deu para abrir o grupo"
        mensagem={(detalhe.error as Error).message}
        onTentar={() => detalhe.refetch()}
      />
    );
  else if (empresas.isError)
    corpo = (
      <PainelErro
        titulo="Não deu para carregar as empresas do Questor"
        mensagem={(empresas.error as Error).message}
        onTentar={() => empresas.refetch()}
      />
    );
  else if (!rascunho)
    corpo = (
      <div aria-busy className="flex flex-col gap-5">
        <Esqueleto className="h-controle max-w-md" />
        <EsqueletoTabela linhas={7} colunas={2} />
      </div>
    );
  else
    corpo = (
      <CorpoGrupoEmpresa
        rascunho={rascunho}
        onMudar={setRascunho}
        empresas={empresas.data ?? []}
        carregandoEmpresas={!empresas.data}
        idForm={idForm}
        onEnviar={salvar}
        exemploNome={cad.exemploNome}
        remocao={grupo ? { trava: cad.trava(grupo), efeito: cad.efeito(grupo), onRemover: remover } : undefined}
      />
    );

  return (
    <Modal
      aberto={alvo != null}
      onFechar={onFechar}
      titulo={grupo ? grupo.nome : cad.tituloNovo}
      descricao={grupo ? cad.descricao(grupo) : cad.descricaoNovo}
      fecharNoVeu={!mudou}
      rodape={
        <RodapeGrupo
          resumo={rascunho ? resumoRascunho(rascunho, empresas.data) : ""}
          novo={novo}
          pronto={pronto}
          salvando={salvando}
          idForm={idForm}
          onCancelar={onFechar}
        />
      }
    >
      {corpo}
    </Modal>
  );
}

/** A janela do grupo de um cadastro, parada, para o catálogo. Mexe no rascunho, mas não grava. */
export function GrupoCadastroEstatico<G extends GrupoListado>({
  cadastro: cad,
  grupo,
  inicial,
  empresas,
  carregando,
  trocouInicial,
  confirmandoInicial,
}: {
  cadastro: CadastroGrupo<G>;
  /** Sem grupo, é a janela do grupo novo. */
  grupo?: G;
  inicial: RascunhoGrupo;
  empresas: EmpresaMarcavel[];
  carregando?: boolean;
  trocouInicial?: boolean;
  confirmandoInicial?: boolean;
}) {
  const [rascunho, setRascunho] = useState(inicial);
  const lista = useMemo(() => (carregando ? undefined : empresas), [carregando, empresas]);
  return (
    <PainelModal
      estatico
      titulo={grupo ? grupo.nome : cad.tituloNovo}
      descricao={grupo ? cad.descricao(grupo) : cad.descricaoNovo}
      onFechar={() => {}}
      rodape={
        <RodapeGrupo
          resumo={resumoRascunho(rascunho, lista)}
          novo={!grupo}
          pronto={!grupo ? rascunho.nome.trim() !== "" : !iguais(rascunho, inicial)}
          onCancelar={() => setRascunho(inicial)}
        />
      }
    >
      <CorpoGrupoEmpresa
        rascunho={rascunho}
        onMudar={setRascunho}
        empresas={empresas}
        carregandoEmpresas={carregando}
        trocouInicial={trocouInicial}
        exemploNome={cad.exemploNome}
        remocao={
          grupo
            ? { trava: cad.trava(grupo), efeito: cad.efeito(grupo), onRemover: async () => true, confirmandoInicial }
            : undefined
        }
      />
    </PainelModal>
  );
}

// ── As peças do grupo de negócio, com o cadastro dele ligado ─────────────────

/** Os grupos, uma linha cada. O clique abre o grupo, com as empresas e a remoção. */
export function TabelaGruposEmpresa(props: {
  grupos: GrupoEmpresaCadastro[];
  onAbrir: (g: GrupoEmpresaCadastro) => void;
  selecionado?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return <TabelaGruposCadastro cadastro={CADASTRO_GRUPO_NEGOCIO} {...props} />;
}

/** A janela do grupo, com as escritas. Fecha sozinha ao salvar e ao remover. */
export function ModalGrupoEmpresa({ alvo, onFechar }: { alvo: AlvoGrupo | null; onFechar: () => void }) {
  return <ModalGrupoCadastro cadastro={CADASTRO_GRUPO_NEGOCIO} alvo={alvo} onFechar={onFechar} />;
}

/** A janela do grupo parada, para o catálogo. Mexe no rascunho, mas não grava. */
export function GrupoEmpresaEstatico(props: {
  /** Sem grupo, é a janela do grupo novo. */
  grupo?: GrupoEmpresaCadastro;
  inicial: RascunhoGrupo;
  empresas: EmpresaMarcavel[];
  carregando?: boolean;
  trocouInicial?: boolean;
  confirmandoInicial?: boolean;
}) {
  return <GrupoCadastroEstatico cadastro={CADASTRO_GRUPO_NEGOCIO} {...props} />;
}
