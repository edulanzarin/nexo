"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { CHAVES_ADMIN } from "@/hooks/use-admin";
import {
  NOME_MAX,
  type CargoDetalhe,
  type CargoResumo,
  type DadosCargo,
  type GrupoPermissaoResumo,
  type SetorResumo,
} from "@/lib/admin-tipos";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { resumoEmpresasGrupo } from "./grupos-permissao";
import { CHAVES_CONCEDIVEIS, MatrizPermissoes, secoesValidas } from "./matriz-permissoes";

/*
 * O cargo concentra toda a permissão do NaveX: as seções que libera, os grupos
 * de permissão que trazem as empresas e as duas chaves "acesso total" e "vê
 * todas as empresas". A pessoa recebe um ou mais cargos e fica com a soma.
 */

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** A descrição do cargo cabe em 300 letras (o servidor confere). */
const DESCRICAO_MAX = 300;

// ── A lista ──────────────────────────────────────────────────────────────────

const COLUNAS: Coluna<CargoResumo>[] = [
  {
    id: "nome",
    cabecalho: "Cargo",
    largura: "42%",
    ordenar: (c) => c.nome,
    celula: (c) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-[560] text-tinta" title={c.descricao ?? c.nome}>
          {c.nome}
        </span>
        {c.admin ? (
          <Selo tom="rota" icone="escudo" title="Entra em tudo, inclusive na Administração">
            Acesso total
          </Selo>
        ) : c.todasEmpresas ? (
          <Selo title="Vê todas as empresas sem depender de grupo">Todas as empresas</Selo>
        ) : null}
      </span>
    ),
  },
  {
    id: "setor",
    cabecalho: "Setor",
    largura: "26%",
    // No celular o nome do cargo precisa do espaço; o setor tem filtro próprio.
    secundaria: true,
    ordenar: (c) => c.setorNome,
    celula: (c) =>
      c.setorNome ? (
        <span className="block truncate" title={c.setorNome}>
          {c.setorNome}
        </span>
      ) : (
        <span className="text-apagado">Sem setor</span>
      ),
  },
  {
    id: "secoes",
    cabecalho: "Seções",
    alinhar: "dir",
    largura: "96px",
    // Acesso total grava a lista vazia, mas abre tudo: ordena depois de todos.
    ordenar: (c) => (c.admin ? CHAVES_CONCEDIVEIS.length + 1 : c.secoes),
    celula: (c) => (c.admin ? <span className="text-apagado">Todas</span> : num(c.secoes)),
  },
  {
    id: "grupos",
    cabecalho: "Grupos",
    alinhar: "dir",
    largura: "96px",
    secundaria: true,
    ordenar: (c) => c.grupos,
    celula: (c) => (c.admin ? <span className="text-apagado">—</span> : num(c.grupos)),
  },
  {
    id: "usuarios",
    cabecalho: "Usuários",
    alinhar: "dir",
    largura: "96px",
    ordenar: (c) => c.usuarios,
    celula: (c) => (c.usuarios ? num(c.usuarios) : <span className="text-apagado">0</span>),
  },
];

/** Os cargos, uma linha cada. O clique leva ao cargo, que é uma página: a matriz é longa. */
export function TabelaCargos({
  cargos,
  onAbrir,
  vazio,
  alturaMax = "62vh",
}: {
  cargos: CargoResumo[];
  onAbrir: (c: CargoResumo) => void;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return (
    <TabelaDados
      rotulo="Cargos"
      colunas={COLUNAS}
      linhas={cargos}
      chave={(c) => String(c.id)}
      onLinha={onAbrir}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── O rascunho ───────────────────────────────────────────────────────────────

export interface RascunhoCargo {
  nome: string;
  setorId: number | null;
  /**
   * Setor digitado, que nasce ao salvar. Null: o setor vem da lista. O
   * `setorId` fica guardado enquanto se digita, e voltar à lista o devolve.
   */
  setorNovo: string | null;
  descricao: string;
  admin: boolean;
  todasEmpresas: boolean;
  secoes: Set<string>;
  grupos: Set<number>;
}

export const rascunhoCargoVazio = (): RascunhoCargo => ({
  nome: "",
  setorId: null,
  setorNovo: null,
  descricao: "",
  admin: false,
  todasEmpresas: false,
  secoes: new Set(),
  grupos: new Set(),
});

export function rascunhoDoCargo(c: CargoDetalhe): RascunhoCargo {
  return {
    nome: c.nome,
    setorId: c.setorId,
    setorNovo: null,
    descricao: c.descricao ?? "",
    admin: c.admin,
    todasEmpresas: c.todasEmpresas,
    // Seção que saiu do catálogo não aparece na matriz e o servidor não grava.
    secoes: secoesValidas(c.secoes),
    grupos: new Set(c.grupos),
  };
}

/** O corpo que o servidor recebe. Acesso total leva as listas vazias, como ele grava. */
export function dadosDoRascunho(r: RascunhoCargo): DadosCargo {
  // Campo de setor novo aberto e vazio vale a escolha que estava na lista.
  const setorNovo = r.setorNovo?.trim() || null;
  return {
    nome: r.nome.trim(),
    setorId: setorNovo ? null : r.setorId,
    setorNovo,
    descricao: r.descricao.trim() || null,
    admin: r.admin,
    todasEmpresas: r.admin || r.todasEmpresas,
    secoes: r.admin ? [] : CHAVES_CONCEDIVEIS.filter((k) => r.secoes.has(k)),
    grupos: r.admin ? [] : [...r.grupos].sort((a, b) => a - b),
  };
}

/** Mesmo cargo para o servidor: base do "alterações não salvas". */
export function mesmoCargo(a: RascunhoCargo, b: RascunhoCargo): boolean {
  return JSON.stringify(dadosDoRascunho(a)) === JSON.stringify(dadosDoRascunho(b));
}

/**
 * O que ler de novo depois de salvar ou excluir um cargo: a lista de cargos,
 * os setores e os grupos (contam cargos) e os usuários (mostram os cargos).
 */
export function invalidarAposCargo(qc: QueryClient) {
  return Promise.all([
    // A lista é a próxima tela: chega pronta em vez de piscar a antiga.
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.cargos], refetchType: "all" }),
    // O cargo aberto sai de cena (ou deixou de existir): não relê.
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.cargo], refetchType: "none" }),
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.setores] }),
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.grupos] }),
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.usuarios] }),
  ]);
}

// ── O setor ──────────────────────────────────────────────────────────────────

const SEM_SETOR = "";
const CRIAR_SETOR = "criar";

/**
 * O setor do cargo: um da lista ou um novo, digitado, que nasce ao salvar. Não
 * há combo que aceite texto livre, então "Criar setor" troca a lista por um
 * campo, e o X volta para a lista com a escolha de antes.
 */
export function CampoSetorCargo({
  setorId,
  setorNovo,
  onMudar,
  setores,
  carregando,
  erro,
}: {
  setorId: number | null;
  setorNovo: string | null;
  onMudar: (v: { setorId: number | null; setorNovo: string | null }) => void;
  setores?: SetorResumo[];
  carregando?: boolean;
  erro?: string;
}) {
  const id = useId();
  // Só foca quando a pessoa escolhe criar: aberto já digitando (o catálogo),
  // o foco roubaria a rolagem da página.
  const [focar, setFocar] = useState(false);

  if (setorNovo !== null) {
    const nome = setorNovo.trim().toLowerCase();
    // O servidor casa sem diferenciar maiúscula e reaproveita o setor.
    const existente = nome ? setores?.find((s) => s.nome.toLowerCase() === nome) : undefined;
    return (
      <Rotulado
        rotulo="Setor"
        htmlFor={id}
        ajuda={existente ? `Já existe. O cargo entra em ${existente.nome}.` : "Nasce quando o cargo for salvo."}
      >
        <Campo
          id={id}
          autoFocus={focar}
          value={setorNovo}
          maxLength={NOME_MAX}
          placeholder="Nome do novo setor"
          onChange={(e) => onMudar({ setorId, setorNovo: e.target.value })}
          fim={
            <BotaoIcone
              icone="fechar"
              rotulo="Escolher da lista"
              linha
              onClick={() => onMudar({ setorId, setorNovo: null })}
            />
          }
        />
      </Rotulado>
    );
  }

  const opcoes: Opcao[] = [
    { valor: SEM_SETOR, rotulo: "Sem setor" },
    ...(setores ?? []).map((s) => ({
      valor: String(s.id),
      rotulo: s.nome,
      detalhe: plural(s.cargos, "cargo", "cargos"),
    })),
    { valor: CRIAR_SETOR, rotulo: "Criar setor", icone: "mais" },
  ];
  return (
    <Rotulado rotulo="Setor" erro={erro}>
      <Combo
        opcoes={opcoes}
        valor={setorId == null ? SEM_SETOR : String(setorId)}
        onMudar={(v) => {
          if (v === CRIAR_SETOR) {
            setFocar(true);
            onMudar({ setorId, setorNovo: "" });
          } else onMudar({ setorId: v ? Number(v) : null, setorNovo: null });
        }}
        desabilitado={carregando}
        placeholder={carregando ? "Carregando setores" : "Sem setor"}
        rotuloAcessivel="Setor"
      />
    </Rotulado>
  );
}

// ── Os grupos de permissão do cargo ─────────────────────────────────────────

/** Os grupos para marcar, com quantas empresas cada um traz. */
export function ListaGruposCargo({
  grupos,
  marcados,
  onMudar,
  carregando,
  erro,
  onTentar,
}: {
  grupos?: GrupoPermissaoResumo[];
  marcados: ReadonlySet<number>;
  onMudar: (m: Set<number>) => void;
  carregando?: boolean;
  erro?: string;
  onTentar?: () => void;
}) {
  if (erro)
    return <PainelErro titulo="Não deu para carregar os grupos de permissão" mensagem={erro} onTentar={onTentar} />;
  if (carregando || !grupos)
    return (
      <div aria-busy className="flex flex-col gap-3 py-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Esqueleto key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  if (!grupos.length)
    return (
      <Vazio
        compacto
        icone="empresa"
        titulo="Nenhum grupo de permissão"
        descricao="Monte os grupos com as empresas de cada carteira e marque aqui os que o cargo enxerga."
        acao={
          <BotaoLink href="/admin/grupos" iconeFim="seta-direita">
            Abrir Grupos de Permissão
          </BotaoLink>
        }
      />
    );
  return (
    // Uma coluna: o painel divide a linha com o cargo, e em duas colunas o nome
    // do grupo não cabia e saía cortado.
    <ul className="flex flex-col">
      {grupos.map((g) => (
        <li key={g.id} className="min-w-0">
          <Caixa
            marcada={marcados.has(g.id)}
            onMudar={(v) => {
              const novo = new Set(marcados);
              if (v) novo.add(g.id);
              else novo.delete(g.id);
              onMudar(novo);
            }}
            className="flex w-full rounded-controle px-2 py-1.5 hover:bg-poco"
            rotulo={
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0 truncate" title={g.nome}>
                  {g.nome}
                </span>
                <span
                  className={cn(
                    "num ml-auto shrink-0 text-pequeno",
                    g.empresas === 0 ? "text-atencao" : "text-apagado"
                  )}
                >
                  {resumoEmpresasGrupo(g)}
                </span>
              </span>
            }
          />
        </li>
      ))}
    </ul>
  );
}

// ── O cargo aberto ───────────────────────────────────────────────────────────

/**
 * O formulário do cargo: quem é, o acesso, os grupos e a matriz. Controlado:
 * o rascunho mora na página, que compara com o gravado e salva. Com acesso
 * total, os grupos e a matriz somem: o servidor grava as duas listas vazias.
 */
export function FormularioCargo({
  rascunho,
  onMudar,
  titulo,
  descricao,
  setores,
  grupos,
  erroNome,
  idNome,
}: {
  rascunho: RascunhoCargo;
  onMudar: (r: RascunhoCargo) => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  setores: { dados?: SetorResumo[]; carregando?: boolean; erro?: string };
  grupos: { dados?: GrupoPermissaoResumo[]; carregando?: boolean; erro?: string; onTentar?: () => void };
  erroNome?: string;
  /** Para quem salva levar o foco ao nome que falta. */
  idNome?: string;
}) {
  const base = useId();
  const idN = idNome ?? `${base}-nome`;
  const muda = (parcial: Partial<RascunhoCargo>) => onMudar({ ...rascunho, ...parcial });
  const nGrupos = rascunho.grupos.size;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className={cn("grid items-start gap-4", !rascunho.admin && "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
        <Painel titulo={titulo} descricao={descricao}>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Rotulado rotulo="Nome" htmlFor={idN} erro={erroNome}>
                <Campo
                  id={idN}
                  value={rascunho.nome}
                  maxLength={NOME_MAX}
                  placeholder="Analista Contábil"
                  aria-invalid={!!erroNome}
                  onChange={(e) => muda({ nome: e.target.value })}
                />
              </Rotulado>
              <CampoSetorCargo
                setorId={rascunho.setorId}
                setorNovo={rascunho.setorNovo}
                onMudar={muda}
                setores={setores.dados}
                carregando={setores.carregando}
                erro={setores.erro}
              />
            </div>
            <Rotulado rotulo="Descrição (opcional)" htmlFor={`${base}-descricao`}>
              <Campo
                id={`${base}-descricao`}
                value={rascunho.descricao}
                maxLength={DESCRICAO_MAX}
                placeholder="Para que serve o cargo"
                onChange={(e) => muda({ descricao: e.target.value })}
              />
            </Rotulado>
            <fieldset className="flex min-w-0 flex-col gap-1.5">
              <legend className="mb-1 text-pequeno font-[560] text-tinta-2">Acesso</legend>
              <div className="flex flex-col gap-x-8 gap-y-2 sm:flex-row">
                <Caixa
                  marcada={rascunho.admin}
                  onMudar={(v) => muda({ admin: v })}
                  rotulo="Acesso total"
                  detalhe="Administrador do NaveX"
                />
                <Caixa
                  // Acesso total já vê todas as empresas: marcada e parada.
                  marcada={rascunho.admin || rascunho.todasEmpresas}
                  desabilitada={rascunho.admin}
                  onMudar={(v) => muda({ todasEmpresas: v })}
                  rotulo="Vê todas as empresas"
                  detalhe="Inclusive as que entrarem no Questor"
                />
              </div>
            </fieldset>
            {rascunho.admin && (
              <Nota tom="rota" icone="escudo">
                Com acesso total, o cargo entra em todas as seções de todos os módulos, inclusive na Administração, e
                vê todas as empresas.
              </Nota>
            )}
          </div>
        </Painel>

        {!rascunho.admin && (
          <Painel
            titulo="Grupos de Permissão"
            descricao={
              nGrupos ? plural(nGrupos, "grupo marcado", "grupos marcados") : "As empresas que o cargo enxerga"
            }
          >
            <div className="flex flex-col gap-3">
              {rascunho.todasEmpresas && (
                <Nota>O cargo já vê todas as empresas. Os grupos marcados só contam se isso for desligado.</Nota>
              )}
              <ListaGruposCargo
                grupos={grupos.dados}
                marcados={rascunho.grupos}
                onMudar={(g) => muda({ grupos: g })}
                carregando={grupos.carregando}
                erro={grupos.erro}
                onTentar={grupos.onTentar}
              />
            </div>
          </Painel>
        )}
      </div>

      {!rascunho.admin && (
        <Painel corpo="p-0" titulo="Permissões por Seção" descricao="As seções que o cargo abre em cada módulo">
          <MatrizPermissoes marcadas={rascunho.secoes} onMudar={(s) => muda({ secoes: s })} />
        </Painel>
      )}
    </div>
  );
}

/**
 * A barra do cargo: excluir, o estado do rascunho e salvar. Presa ao pé da
 * janela: a matriz passa de cinquenta seções, e o Salvar no alto da página
 * ficaria longe de quem acabou de marcar a última.
 */
export function BarraSalvarCargo({
  novo,
  sujo,
  salvando,
  erro,
  onSalvar,
  onExcluir,
  estatico,
}: {
  novo: boolean;
  sujo: boolean;
  salvando?: boolean;
  /** A recusa do servidor (nome em uso, sem administrador ativo), até a próxima mudança. */
  erro?: string | null;
  onSalvar: () => void;
  /** Só no cargo que já existe. */
  onExcluir?: () => void;
  /** No catálogo: sem prender ao pé. */
  estatico?: boolean;
}) {
  return (
    <div
      className={cn(
        "nx-vidro z-10 flex flex-wrap items-center gap-2 rounded-painel px-4 py-2.5",
        !estatico && "sticky bottom-3"
      )}
    >
      {onExcluir && (
        <Botao variante="fantasma" icone="apagar" onClick={onExcluir} disabled={salvando}>
          Excluir cargo
        </Botao>
      )}
      <div className="flex min-w-0 flex-1 justify-end">
        {erro ? (
          <Nota tom="perigo" icone="erro">
            {erro}
          </Nota>
        ) : sujo ? (
          <Nota tom="atencao">Alterações não salvas</Nota>
        ) : null}
      </div>
      <Botao
        variante="primario"
        icone={novo ? "mais" : "salvar"}
        carregando={salvando}
        disabled={!novo && !sujo}
        onClick={onSalvar}
      >
        {novo ? "Criar cargo" : "Salvar"}
      </Botao>
    </div>
  );
}

// ── A exclusão ───────────────────────────────────────────────────────────────

const TITULO_EXCLUIR = "Excluir o Cargo?";

function CorpoExcluir({ usuarios, erro }: { usuarios: number; erro?: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-corpo text-tinta-2">
        {usuarios
          ? `${plural(usuarios, "pessoa perde", "pessoas perdem")} este cargo e o acesso que vinha dele.`
          : "Ninguém tem este cargo."}
      </p>
      {usuarios > 0 && <Nota>Quem só tinha este cargo fica sem acesso a nada até receber outro.</Nota>}
      {erro && (
        <Nota tom="perigo" icone="erro">
          {erro}
        </Nota>
      )}
    </div>
  );
}

function RodapeExcluir({
  excluindo,
  onCancelar,
  onConfirmar,
}: {
  excluindo?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <>
      <Botao variante="fantasma" onClick={onCancelar} disabled={excluindo}>
        Cancelar
      </Botao>
      <Botao variante="perigo" icone="apagar" carregando={excluindo} onClick={onConfirmar}>
        Excluir cargo
      </Botao>
    </>
  );
}

/** A confirmação da exclusão, com quantas pessoas perdem o cargo. */
export function ModalExcluirCargo({
  cargo,
  aberto,
  excluindo,
  erro,
  onFechar,
  onConfirmar,
}: {
  cargo: { nome: string; usuarios: number };
  aberto: boolean;
  excluindo?: boolean;
  /** A recusa do servidor (o último administrador ativo), dita na própria janela. */
  erro?: string | null;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={TITULO_EXCLUIR}
      descricao={cargo.nome}
      largura="p"
      rodape={<RodapeExcluir excluindo={excluindo} onCancelar={onFechar} onConfirmar={onConfirmar} />}
    >
      <CorpoExcluir usuarios={cargo.usuarios} erro={erro} />
    </Modal>
  );
}

/** A confirmação aberta e parada, para o catálogo. */
export function ExcluirCargoEstatico({
  cargo,
  erro,
}: {
  cargo: { nome: string; usuarios: number };
  erro?: string;
}) {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={TITULO_EXCLUIR}
      descricao={cargo.nome}
      onFechar={() => {}}
      rodape={<RodapeExcluir onCancelar={() => {}} onConfirmar={() => {}} />}
    >
      <CorpoExcluir usuarios={cargo.usuarios} erro={erro} />
    </PainelModal>
  );
}
