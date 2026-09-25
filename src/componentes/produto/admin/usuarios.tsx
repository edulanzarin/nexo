"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Avatar } from "@/componentes/primitivos/avatar";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { Alternador, Caixa } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { ComboMulti, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { enviarArquivo, mutar } from "@/hooks/mutar";
import { CHAVES_ADMIN, useCargosAdmin } from "@/hooks/use-admin";
import { NOME_MAX, SENHA_MIN, type CargoResumo, type DadosUsuario, type UsuarioLista } from "@/lib/admin-tipos";
import { cn } from "@/lib/cn";
import { dataHoraBR, num } from "@/lib/format";
import { CampoFoto, FOTO_INTACTA, fotoMudou, srcAvatar, type MudancaFoto } from "./campo-foto";

/*
 * Os usuários da Administração: quem entra no NaveX e com que cargos. Toda a
 * permissão vem do cargo (a pessoa enxerga a união dos cargos dela), então o
 * cadastro da pessoa é só identidade, senha, situação e a lista de cargos.
 */

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** "a, b ou c": a lista do que afrouxar, em português. */
function emLista(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} ou ${partes[partes.length - 1]}`;
}

// ── Os filtros ───────────────────────────────────────────────────────────────

export type SituacaoUsuario = "todos" | "ativos" | "inativos";

export interface FiltroUsuarios {
  busca: string;
  /** Ids de cargo, como texto (o valor do combo). Vazio = todos. */
  cargos: string[];
  situacao: SituacaoUsuario;
}

export const FILTRO_USUARIOS_VAZIO: FiltroUsuarios = { busca: "", cargos: [], situacao: "todos" };

export const filtroAtivo = (f: FiltroUsuarios) => f.busca.trim() !== "" || f.cargos.length > 0 || f.situacao !== "todos";

export function filtrarUsuarios(lista: UsuarioLista[], f: FiltroUsuarios): UsuarioLista[] {
  const partes = normalizar(f.busca.trim()).split(/\s+/).filter(Boolean);
  const cargos = new Set(f.cargos.map(Number));
  return lista.filter((u) => {
    if (f.situacao === "ativos" && !u.ativo) return false;
    if (f.situacao === "inativos" && u.ativo) return false;
    if (cargos.size && !u.cargos.some((c) => cargos.has(c.id))) return false;
    if (!partes.length) return true;
    const alvo = normalizar(`${u.nome} ${u.email}`);
    return partes.every((p) => alvo.includes(p));
  });
}

/**
 * As opções do filtro de cargo saem dos próprios usuários, com quantos têm
 * cada um: cargo sem ninguém não recortaria nada.
 */
export function opcoesCargoUsuarios(lista: UsuarioLista[]): Opcao[] {
  const cont = new Map<number, { nome: string; qtd: number }>();
  for (const u of lista)
    for (const c of u.cargos) {
      const atual = cont.get(c.id);
      cont.set(c.id, { nome: c.nome, qtd: (atual?.qtd ?? 0) + 1 });
    }
  return [...cont.entries()]
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"))
    .map(([id, c]) => ({ valor: String(id), rotulo: c.nome, detalhe: num(c.qtd) }));
}

const SITUACOES: { valor: SituacaoUsuario; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "inativos", rotulo: "Inativos" },
];

/** A fila de filtros sobre a lista. Fica fora do painel: três controles no cabeçalho dele não cabem no celular. */
export function FiltrosUsuarios({
  filtro,
  onMudar,
  opcoesCargo,
  className,
}: {
  filtro: FiltroUsuarios;
  onMudar: (f: FiltroUsuarios) => void;
  opcoesCargo: Opcao[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Campo
        icone="buscar"
        placeholder="Nome ou e-mail"
        aria-label="Buscar usuário"
        value={filtro.busca}
        onChange={(e) => onMudar({ ...filtro, busca: e.target.value })}
        classeCaixa="w-full sm:w-64"
        fim={
          filtro.busca ? (
            <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => onMudar({ ...filtro, busca: "" })} />
          ) : undefined
        }
      />
      <ComboMulti
        opcoes={opcoesCargo}
        valor={filtro.cargos}
        onMudar={(cargos) => onMudar({ ...filtro, cargos })}
        rotuloTodas="Todos os cargos"
        plural="cargos"
        icone="chave"
        className="w-full sm:w-56"
        larguraMin={260}
        desabilitado={opcoesCargo.length === 0}
        rotuloAcessivel="Filtrar por cargo"
      />
      <Segmentado
        opcoes={SITUACOES}
        valor={filtro.situacao}
        onMudar={(situacao) => onMudar({ ...filtro, situacao })}
        rotulo="Situação do usuário"
      />
      {filtroAtivo(filtro) && (
        <Botao variante="fantasma" icone="fechar" onClick={() => onMudar(FILTRO_USUARIOS_VAZIO)}>
          Limpar filtros
        </Botao>
      )}
    </div>
  );
}

/**
 * O vazio da lista. Cadastro vazio ensina; recorte vazio diz o que afrouxar; e
 * "ninguém inativo" é resposta boa, não falta de dado.
 */
export function VazioUsuarios({
  total,
  filtro,
  onMudar,
  onNovo,
}: {
  total: number;
  filtro: FiltroUsuarios;
  onMudar: (f: FiltroUsuarios) => void;
  onNovo: () => void;
}) {
  if (total === 0)
    return (
      <Vazio
        icone="pessoas"
        titulo="Nenhum usuário cadastrado"
        descricao="Cadastre quem vai entrar no NaveX e marque os cargos de cada pessoa."
        acao={
          <Botao variante="primario" icone="mais" onClick={onNovo}>
            Novo usuário
          </Botao>
        }
      />
    );
  if (filtro.situacao === "inativos" && !filtro.busca.trim() && !filtro.cargos.length)
    return (
      <Vazio
        compacto
        icone="ok"
        titulo="Nenhum usuário inativo"
        acao={<Botao onClick={() => onMudar({ ...filtro, situacao: "todos" })}>Ver todos</Botao>}
      />
    );
  const partes = [
    filtro.busca.trim() ? "a busca" : "",
    filtro.cargos.length === 1 ? "o cargo" : filtro.cargos.length > 1 ? "os cargos" : "",
    filtro.situacao !== "todos" ? "a situação" : "",
  ].filter(Boolean);
  return (
    <Vazio
      compacto
      icone="buscar"
      titulo="Nenhum usuário com esses filtros"
      descricao={`Mude ${emLista(partes)}.`}
      acao={<Botao onClick={() => onMudar(FILTRO_USUARIOS_VAZIO)}>Limpar filtros</Botao>}
    />
  );
}

// ── Os números ───────────────────────────────────────────────────────────────

export function resumoUsuarios(lista: UsuarioLista[]) {
  const ativos = lista.filter((u) => u.ativo);
  return {
    total: lista.length,
    ativos: ativos.length,
    inativos: lista.length - ativos.length,
    admins: ativos.filter((u) => u.admin).length,
    restritas: ativos.filter((u) => !u.todasEmpresas).length,
    nunca: ativos.filter((u) => !u.ultimoAcesso).length,
  };
}

/**
 * Os números do cadastro. Fora "Pessoas", contam só os ativos: administrador
 * inativo não entra, e quem foi desativado sem nunca ter entrado não é
 * pendência de ninguém.
 */
export function IndicadoresUsuarios({ usuarios }: { usuarios?: UsuarioLista[] }) {
  const r = usuarios ? resumoUsuarios(usuarios) : null;
  const carregando = !r;
  return (
    <FaixaIndicadores colunas={4}>
      <Indicador
        rotulo="Pessoas"
        icone="pessoas"
        carregando={carregando}
        valor={num(r?.total ?? 0)}
        detalhe={r ? (r.inativos ? `${num(r.ativos)} ativas e ${num(r.inativos)} inativas` : "Todas ativas") : ""}
      />
      <Indicador
        rotulo="Administradores"
        icone="escudo"
        carregando={carregando}
        valor={num(r?.admins ?? 0)}
        detalhe="Com acesso total"
      />
      <Indicador
        rotulo="Empresas restritas"
        icone="empresa"
        carregando={carregando}
        valor={num(r?.restritas ?? 0)}
        detalhe="Veem só as empresas dos cargos"
      />
      <Indicador
        rotulo="Nunca entraram"
        icone="relogio"
        carregando={carregando}
        valor={num(r?.nunca ?? 0)}
        detalhe={r ? (r.nunca ? "Entre as pessoas ativas" : "Todas já entraram") : ""}
      />
    </FaixaIndicadores>
  );
}

// ── A lista ──────────────────────────────────────────────────────────────────

type FotoDe = (u: UsuarioLista) => string | null;

const fotoDaRota: FotoDe = (u) => srcAvatar(u.id, u.avatarVersao);

function colunasUsuarios(fotoDe: FotoDe): Coluna<UsuarioLista>[] {
  return [
    {
      id: "nome",
      cabecalho: "Nome",
      largura: "32%",
      ordenar: (u) => u.nome,
      celula: (u) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar
            nome={u.nome}
            src={fotoDe(u)}
            tamanho={22}
            className={cn(!u.ativo && "opacity-50 grayscale")}
          />
          <span className={cn("truncate font-[560]", u.ativo ? "text-tinta" : "text-apagado")} title={u.nome}>
            {u.nome}
          </span>
          {u.admin && (
            <Selo tom="rota" icone="escudo" title="Algum cargo dá acesso total">
              Administrador
            </Selo>
          )}
          {!u.ativo && <Selo>Inativo</Selo>}
        </span>
      ),
    },
    {
      id: "email",
      cabecalho: "E-mail",
      largura: "26%",
      ordenar: (u) => u.email,
      celula: (u) => (
        <span className="block truncate" title={u.email}>
          {u.email}
        </span>
      ),
    },
    {
      id: "cargos",
      cabecalho: "Cargos",
      largura: "24%",
      celula: (u) =>
        u.cargos.length ? (
          <span className="block truncate" title={u.cargos.map((c) => c.nome).join(", ")}>
            {u.cargos.map((c) => c.nome).join(", ")}
          </span>
        ) : (
          // Cargo removido tira o vínculo junto, e sem cargo a pessoa não vê tela nenhuma.
          <Selo tom="atencao" title="Sem cargo a pessoa entra, mas não vê nenhuma tela">
            Sem cargo
          </Selo>
        ),
    },
    {
      id: "empresas",
      cabecalho: "Empresas",
      largura: "96px",
      secundaria: true,
      ordenar: (u) => (u.todasEmpresas ? 1 : 0),
      celula: (u) => (u.todasEmpresas ? "Todas" : "Restritas"),
    },
    {
      id: "acesso",
      cabecalho: "Último acesso",
      largura: "148px",
      ordenar: (u) => u.ultimoAcesso,
      celula: (u) =>
        u.ultimoAcesso ? (
          <span className="num">{dataHoraBR(u.ultimoAcesso)}</span>
        ) : (
          <span className="text-apagado italic">Nunca entrou</span>
        ),
    },
  ];
}

/** Uma linha por pessoa, com o e-mail em coluna própria para a linha não dobrar. O clique abre a pessoa. */
export function TabelaUsuarios({
  usuarios,
  onAbrir,
  selecionado,
  vazio,
  alturaMax = "62vh",
  fotoDe = fotoDaRota,
}: {
  usuarios: UsuarioLista[];
  onAbrir: (u: UsuarioLista) => void;
  selecionado?: string | null;
  vazio?: ReactNode;
  alturaMax?: string;
  /** No catálogo a foto não vem da rota, que exige sessão. */
  fotoDe?: FotoDe;
}) {
  const colunas = useMemo(() => colunasUsuarios(fotoDe), [fotoDe]);
  return (
    <TabelaDados
      rotulo="Usuários"
      colunas={colunas}
      linhas={usuarios}
      chave={(u) => u.id}
      onLinha={onAbrir}
      selecionada={(u) => u.id === selecionado}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── A pessoa aberta ──────────────────────────────────────────────────────────

export interface RascunhoUsuario {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  ativo: boolean;
  cargos: Set<number>;
  foto: MudancaFoto;
}

export function rascunhoUsuario(u: UsuarioLista | null): RascunhoUsuario {
  return {
    nome: u?.nome ?? "",
    email: u?.email ?? "",
    telefone: u?.telefone ?? "",
    senha: "",
    ativo: u?.ativo ?? true,
    cargos: new Set(u?.cargos.map((c) => c.id) ?? []),
    foto: FOTO_INTACTA,
  };
}

/** Os dados do cadastro, sem a foto (que tem rota própria). */
function dadosIguais(a: RascunhoUsuario, b: RascunhoUsuario): boolean {
  return (
    a.nome.trim() === b.nome.trim() &&
    a.email.trim().toLowerCase() === b.email.trim().toLowerCase() &&
    a.telefone.trim() === b.telefone.trim() &&
    a.senha === b.senha &&
    a.ativo === b.ativo &&
    a.cargos.size === b.cargos.size &&
    [...a.cargos].every((c) => b.cargos.has(c))
  );
}

/** O que impede de salvar, na ordem do formulário. O servidor confere de novo. */
function faltaNoUsuario(r: RascunhoUsuario, novo: boolean): string | null {
  if (!r.nome.trim()) return "Informe o nome";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) return "Informe um e-mail válido";
  if (novo && !r.senha) return "Defina uma senha";
  if (r.senha && r.senha.length < SENHA_MIN) return `A senha precisa de ao menos ${SENHA_MIN} caracteres`;
  if (!r.cargos.size) return "Marque ao menos um cargo";
  return null;
}

function resumoUsuario(r: RascunhoUsuario, novo: boolean, cargos: CargoResumo[] | undefined): string {
  const falta = faltaNoUsuario(r, novo);
  if (falta) return falta;
  const total = cargos?.some((c) => c.admin && r.cargos.has(c.id));
  return `${plural(r.cargos.size, "cargo", "cargos")}${total ? " · acesso total" : ""}`;
}

export function descricaoUsuario(u: UsuarioLista): string {
  return [
    u.email,
    u.ultimoAcesso ? `último acesso em ${dataHoraBR(u.ultimoAcesso)}` : "nunca entrou",
    u.ativo ? null : "inativo",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Os cargos para marcar. Sem cargo cadastrado não há o que dar à pessoa: a lista leva a criar um. */
function ListaCargos({
  cargos,
  erro,
  onTentar,
  marcados,
  onMudar,
}: {
  cargos?: CargoResumo[];
  erro?: string | null;
  onTentar?: () => void;
  marcados: Set<number>;
  onMudar: (m: Set<number>) => void;
}) {
  let corpo: ReactNode;
  if (erro) corpo = <PainelErro titulo="Não deu para carregar os cargos" mensagem={erro} onTentar={onTentar} />;
  else if (!cargos)
    corpo = (
      <div aria-busy className="flex flex-col gap-3 rounded-painel border border-linha px-3 py-3">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} className={cn("h-3.5", i % 2 ? "w-40" : "w-56")} />
        ))}
      </div>
    );
  else if (!cargos.length)
    corpo = (
      <div className="rounded-painel border border-dashed border-linha-forte">
        <Vazio
          compacto
          icone="chave"
          titulo="Nenhum cargo cadastrado"
          descricao="Crie um cargo antes de cadastrar a pessoa."
          acao={
            <BotaoLink href="/admin/cargos/novo" icone="mais">
              Criar cargo
            </BotaoLink>
          }
        />
      </div>
    );
  else
    corpo = (
      <ul className="max-h-64 divide-y divide-linha overflow-y-auto rounded-painel border border-linha">
        {cargos.map((c) => (
          <li key={c.id} className="flex min-w-0 items-center gap-2 px-3 py-2">
            <Caixa
              className="flex-1"
              marcada={marcados.has(c.id)}
              rotulo={c.nome}
              detalhe={c.setorNome ?? "Sem setor"}
              onMudar={(sim) => {
                const m = new Set(marcados);
                if (sim) m.add(c.id);
                else m.delete(c.id);
                onMudar(m);
              }}
            />
            {c.admin && (
              <Selo tom="rota" icone="escudo">
                Acesso total
              </Selo>
            )}
          </li>
        ))}
      </ul>
    );
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-corpo font-[600] text-tinta">Cargos</h3>
        {cargos && cargos.length > 0 && (
          <span className="num text-pequeno text-apagado">
            {num(marcados.size)} de {num(cargos.length)}
          </span>
        )}
      </div>
      {cargos && cargos.length > 0 && <Nota>A pessoa enxerga a soma do que os cargos marcados liberam.</Nota>}
      {corpo}
    </section>
  );
}

export interface RemocaoUsuario {
  /** O usuário aberto é quem está logado. */
  proprio: boolean;
  registros: number;
  ativo: boolean;
  onExcluir: () => Promise<boolean>;
  onDesativar: () => Promise<boolean>;
  confirmandoInicial?: boolean;
}

/**
 * A saída do usuário. Quem tem registro no sistema (relatório do Post Mortem,
 * rescisão marcada) não sai: o registro guarda quem fez, e a janela oferece
 * desativar antes de a pessoa tentar excluir e levar a recusa.
 */
function SaidaUsuario({ proprio, registros, ativo, onExcluir, onDesativar, confirmandoInicial = false }: RemocaoUsuario) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const [agindo, setAgindo] = useState(false);
  const agir = async (f: () => Promise<boolean>) => {
    setAgindo(true);
    const ok = await f();
    setAgindo(false);
    if (ok) setConfirmando(false);
  };

  let conteudo: ReactNode;
  if (proprio) conteudo = <Nota>Você não pode excluir o próprio usuário.</Nota>;
  else if (registros > 0)
    conteudo = (
      <>
        <Nota className="basis-full">
          Este usuário tem {plural(registros, "registro", "registros")} no sistema e não pode ser excluído.
        </Nota>
        {ativo && (
          <Botao icone="bloqueado" carregando={agindo} onClick={() => agir(onDesativar)}>
            Desativar usuário
          </Botao>
        )}
      </>
    );
  else if (confirmando)
    conteudo = (
      <>
        <Botao variante="perigo" icone="apagar" carregando={agindo} onClick={() => agir(onExcluir)}>
          Confirmar exclusão
        </Botao>
        <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={agindo}>
          Cancelar
        </Botao>
        <span className="text-pequeno text-apagado">O acesso acaba na hora e não dá para desfazer.</span>
      </>
    );
  else
    conteudo = (
      <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)}>
        Excluir usuário
      </Botao>
    );
  return <div className="flex flex-wrap items-center gap-1.5 border-t border-linha pt-4">{conteudo}</div>;
}

/**
 * O corpo da janela: foto, dados, situação, cargos e a saída. Controlado: o
 * rascunho mora em quem abre, que compara com o gravado para saber se há o que
 * salvar.
 */
export function CorpoUsuario({
  rascunho,
  onMudar,
  novo,
  proprio,
  fotoAtual,
  cargos,
  erroCargos,
  onTentarCargos,
  idForm,
  onEnviar,
  saida,
  ocupado,
}: {
  rascunho: RascunhoUsuario;
  onMudar: (r: RascunhoUsuario) => void;
  novo: boolean;
  proprio?: boolean;
  fotoAtual: string | null;
  cargos?: CargoResumo[];
  erroCargos?: string | null;
  onTentarCargos?: () => void;
  idForm?: string;
  onEnviar?: () => void;
  /** Só no usuário que já existe. */
  saida?: RemocaoUsuario;
  ocupado?: boolean;
}) {
  const base = useId();
  const campo = <K extends keyof RascunhoUsuario>(k: K, v: RascunhoUsuario[K]) => onMudar({ ...rascunho, [k]: v });
  return (
    <form
      id={idForm}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar?.();
      }}
    >
      <CampoFoto
        nome={rascunho.nome}
        atual={fotoAtual}
        mudanca={rascunho.foto}
        onMudar={(foto) => campo("foto", foto)}
        desabilitado={ocupado}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Rotulado rotulo="Nome" htmlFor={`${base}-nome`}>
          <Campo
            id={`${base}-nome`}
            data-autofoco
            value={rascunho.nome}
            maxLength={NOME_MAX}
            autoComplete="off"
            placeholder="Nome e sobrenome"
            onChange={(e) => campo("nome", e.target.value)}
          />
        </Rotulado>
        <Rotulado rotulo="E-mail" htmlFor={`${base}-email`}>
          <Campo
            id={`${base}-email`}
            type="email"
            value={rascunho.email}
            autoComplete="off"
            placeholder="nome@navecon.net.br"
            onChange={(e) => campo("email", e.target.value)}
          />
        </Rotulado>
        <Rotulado rotulo="Telefone" htmlFor={`${base}-telefone`}>
          <Campo
            id={`${base}-telefone`}
            type="tel"
            value={rascunho.telefone}
            maxLength={30}
            autoComplete="off"
            placeholder="(00) 00000-0000"
            onChange={(e) => campo("telefone", e.target.value)}
          />
        </Rotulado>
        <Rotulado
          rotulo="Senha"
          htmlFor={`${base}-senha`}
          ajuda={
            novo
              ? `Ao menos ${SENHA_MIN} caracteres`
              : rascunho.senha
                ? "Salvar encerra as sessões abertas da pessoa"
                : undefined
          }
        >
          <Campo
            id={`${base}-senha`}
            type="password"
            value={rascunho.senha}
            autoComplete="new-password"
            placeholder={novo ? "" : "Vazia mantém a senha atual"}
            onChange={(e) => campo("senha", e.target.value)}
          />
        </Rotulado>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Alternador
          ligado={rascunho.ativo}
          onMudar={(v) => campo("ativo", v)}
          rotulo="Ativo"
          desabilitado={proprio}
        />
        {proprio && <Nota>Você não pode desativar o próprio usuário.</Nota>}
      </div>
      <ListaCargos
        cargos={cargos}
        erro={erroCargos}
        onTentar={onTentarCargos}
        marcados={rascunho.cargos}
        onMudar={(m) => campo("cargos", m)}
      />
      {saida && <SaidaUsuario {...saida} />}
    </form>
  );
}

function RodapeUsuario({
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
        {novo ? "Criar usuário" : "Salvar"}
      </Botao>
    </>
  );
}

const TITULO_NOVO = "Novo Usuário";
const DESCRICAO_NOVO = "A pessoa entra com o e-mail e a senha definidos aqui";

/** Quem a janela abre: um usuário novo ou um da lista. */
export type AlvoUsuario = "novo" | UsuarioLista;

/**
 * A janela do usuário, com as escritas. Fecha sozinha ao salvar, ao desativar
 * e ao excluir. `proprioId` é quem está logado: ele não se desativa nem se
 * exclui, e a foto dele no menu do canto só muda com a sessão relida.
 */
export function ModalUsuario({
  alvo,
  onFechar,
  proprioId,
}: {
  alvo: AlvoUsuario | null;
  onFechar: () => void;
  proprioId: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const idForm = useId();
  const novo = alvo === "novo";
  const usuario = alvo && alvo !== "novo" ? alvo : null;
  const proprio = usuario?.id === proprioId;
  const cargos = useCargosAdmin(alvo != null);

  // O rascunho nasce uma vez por abertura: do usuário da lista, ou vazio.
  const origem = alvo == null ? null : usuario ? `u${usuario.id}` : "novo";
  const [inicio, setInicio] = useState<{ origem: string | null; rascunho: RascunhoUsuario | null }>({
    origem: null,
    rascunho: null,
  });
  const [rascunho, setRascunho] = useState<RascunhoUsuario | null>(null);
  if (origem !== inicio.origem) {
    const r = origem == null ? null : rascunhoUsuario(usuario);
    setInicio({ origem, rascunho: r });
    setRascunho(r);
  }

  const [salvando, setSalvando] = useState(false);
  const mudou = !!rascunho && !!inicio.rascunho && (!dadosIguais(rascunho, inicio.rascunho) || fotoMudou(rascunho.foto));
  const pronto = !!rascunho && !faltaNoUsuario(rascunho, novo) && (novo || mudou) && !salvando;

  // Salvar usuário muda a contagem de usuários dos cargos e dos grupos de permissão.
  const invalidar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.usuarios] }),
      qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.cargos] }),
      qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.grupos] }),
    ]);

  async function gravar(r: RascunhoUsuario, acao: "salvar" | "desativar"): Promise<boolean> {
    const corpo: DadosUsuario = {
      nome: r.nome.trim(),
      email: r.email.trim(),
      telefone: r.telefone.trim() || null,
      senha: r.senha,
      ativo: r.ativo,
      cargos: [...r.cargos],
    };
    setSalvando(true);
    let id = usuario?.id ?? null;
    try {
      if (!usuario) id = (await mutar<{ id: string }>("/api/admin/usuarios", "POST", corpo)).id;
      // Só a foto mudou: o cadastro fica como está, e a trilha não ganha um "salvou" vazio.
      else if (acao === "desativar" || !inicio.rascunho || !dadosIguais(r, inicio.rascunho))
        await mutar(`/api/admin/usuarios/${usuario.id}`, "PATCH", corpo);
    } catch (e) {
      const titulo =
        acao === "desativar"
          ? "Não deu para desativar o usuário"
          : novo
            ? "Não deu para criar o usuário"
            : "Não deu para salvar o usuário";
      avisar.erro(titulo, (e as Error).message);
      setSalvando(false);
      return false;
    }

    // A foto vai depois do cadastro: o usuário novo só tem id quando o POST volta.
    let erroFoto: string | null = null;
    if (id && fotoMudou(r.foto)) {
      try {
        if (r.foto.arquivo) {
          const form = new FormData();
          form.append("avatar", r.foto.arquivo);
          await enviarArquivo(`/api/admin/usuarios/${id}/avatar`, form);
        } else await mutar(`/api/admin/usuarios/${id}/avatar`, "DELETE");
      } catch (e) {
        erroFoto = (e as Error).message;
      }
    }

    await invalidar();
    // O menu do canto lê a sessão, que vem do servidor: sem reler, ele segue
    // com o nome e a foto antigos de quem se editou.
    if (proprio) router.refresh();
    if (erroFoto) avisar.erro(novo ? "Usuário criado sem a foto" : "Usuário salvo sem a foto nova", erroFoto);
    else
      avisar.ok(
        acao === "desativar" ? "Usuário desativado" : novo ? "Usuário criado" : "Usuário salvo",
        corpo.nome
      );
    setSalvando(false);
    onFechar();
    return true;
  }

  async function excluir(): Promise<boolean> {
    if (!usuario) return false;
    try {
      await mutar(`/api/admin/usuarios/${usuario.id}`, "DELETE");
      await invalidar();
      avisar.ok("Usuário excluído", usuario.nome);
      onFechar();
      return true;
    } catch (e) {
      avisar.erro("Não deu para excluir o usuário", (e as Error).message);
      return false;
    }
  }

  const salvar = () => {
    if (rascunho && pronto) void gravar(rascunho, "salvar");
  };

  const corpo = rascunho ? (
    <CorpoUsuario
      rascunho={rascunho}
      onMudar={setRascunho}
      novo={novo}
      proprio={proprio}
      fotoAtual={usuario ? srcAvatar(usuario.id, usuario.avatarVersao) : null}
      cargos={cargos.data}
      erroCargos={cargos.isError ? (cargos.error as Error).message : null}
      onTentarCargos={() => cargos.refetch()}
      idForm={idForm}
      onEnviar={salvar}
      ocupado={salvando}
      saida={
        usuario
          ? {
              proprio,
              registros: usuario.registros,
              ativo: usuario.ativo,
              onExcluir: excluir,
              onDesativar: () => gravar({ ...rascunho, ativo: false }, "desativar"),
            }
          : undefined
      }
    />
  ) : (
    <div aria-busy className="flex flex-col gap-4">
      <Esqueleto className="size-16 rounded-full" />
      <Esqueleto className="h-controle" />
      <Esqueleto className="h-controle" />
    </div>
  );

  return (
    <Modal
      aberto={alvo != null}
      onFechar={onFechar}
      titulo={usuario ? usuario.nome : TITULO_NOVO}
      descricao={usuario ? descricaoUsuario(usuario) : DESCRICAO_NOVO}
      fecharNoVeu={!mudou}
      rodape={
        <RodapeUsuario
          resumo={rascunho ? resumoUsuario(rascunho, novo, cargos.data) : ""}
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

/** A janela do usuário parada, para o catálogo. Mexe no rascunho, mas não grava. */
export function UsuarioEstatico({
  usuario,
  cargos,
  erroCargos,
  proprio,
  fotoAtual = null,
  inicial,
  confirmandoInicial,
}: {
  /** Sem usuário, é a janela do usuário novo. */
  usuario?: UsuarioLista;
  /** Indefinido: os cargos ainda chegando. */
  cargos?: CargoResumo[];
  erroCargos?: string;
  proprio?: boolean;
  fotoAtual?: string | null;
  inicial?: RascunhoUsuario;
  confirmandoInicial?: boolean;
}) {
  const [origem] = useState(() => inicial ?? rascunhoUsuario(usuario ?? null));
  const [rascunho, setRascunho] = useState(origem);
  const novo = !usuario;
  const mudou = !dadosIguais(rascunho, origem) || fotoMudou(rascunho.foto);
  return (
    <PainelModal
      estatico
      titulo={usuario ? usuario.nome : TITULO_NOVO}
      descricao={usuario ? descricaoUsuario(usuario) : DESCRICAO_NOVO}
      onFechar={() => {}}
      rodape={
        <RodapeUsuario
          resumo={resumoUsuario(rascunho, novo, cargos)}
          novo={novo}
          pronto={!faltaNoUsuario(rascunho, novo) && (novo || mudou)}
          onCancelar={() => setRascunho(origem)}
        />
      }
    >
      <CorpoUsuario
        rascunho={rascunho}
        onMudar={setRascunho}
        novo={novo}
        proprio={proprio}
        fotoAtual={fotoAtual}
        cargos={cargos}
        erroCargos={erroCargos}
        saida={
          usuario
            ? {
                proprio: !!proprio,
                registros: usuario.registros,
                ativo: usuario.ativo,
                onExcluir: async () => true,
                onDesativar: async () => true,
                confirmandoInicial,
              }
            : undefined
        }
      />
    </PainelModal>
  );
}
