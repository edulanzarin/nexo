"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { mutar } from "@/hooks/mutar";
import { CHAVES_RH } from "@/hooks/use-rh";
import { num } from "@/lib/format";
import type { GestorRh, SetorRh } from "@/lib/rh-tipos";

/*
 * Gestores por setor: o supervisor ou o coordenador de cada setor, que recebe
 * e responde os formulários do RH sobre as pessoas dele (experiência,
 * desempenho, envios para gestores). O setor é o mesmo nas três empresas da
 * Navecon, então o gestor também é um só por setor, sem empresa.
 *
 * Setor com gente e sem gestor é o que o RH precisa ver primeiro: as
 * avaliações das pessoas dele são geradas e não chegam a ninguém.
 */

export type PapelGestor = GestorRh["papel"];

export const PAPEIS_GESTOR: PapelGestor[] = ["supervisor", "coordenador", "outro"];

export const ROTULO_PAPEL: Record<PapelGestor, string> = {
  supervisor: "Supervisor",
  coordenador: "Coordenador",
  outro: "Outro",
};

export interface SetorGestores {
  setor: SetorRh;
  /** Pessoas ativas no setor, contadas no Diretório (com as trocas de setor feitas no RH). */
  pessoas: number;
  gestores: GestorRh[];
  /**
   * Tem gestor, mas o setor saiu da lista de setores: a lista só traz setor do
   * Questor com gente ativa, e o gestor de um setor que esvaziou sumia da tela
   * sem ter como ser tirado.
   */
  orfao?: boolean;
}

export const precisaGestor = (s: SetorGestores) => s.pessoas > 0 && s.gestores.length === 0;

/**
 * Junta setores, gestores e a contagem de pessoas, com quem precisa de gestor
 * primeiro e os maiores em seguida. Sem o Diretório (`pessoasPorSetor` nulo), a
 * contagem é a da lista de setores, que não vê as trocas de setor feitas no RH.
 */
export function montarSetores(
  setores: SetorRh[],
  gestores: GestorRh[],
  pessoasPorSetor: Map<string, number> | null
): SetorGestores[] {
  const porSetor = new Map<string, GestorRh[]>();
  for (const g of gestores) {
    const lista = porSetor.get(g.classiforgan);
    if (lista) lista.push(g);
    else porSetor.set(g.classiforgan, [g]);
  }
  const pessoas = (s: SetorRh) => (pessoasPorSetor ? (pessoasPorSetor.get(s.classiforgan) ?? 0) : s.ativos);
  const itens: SetorGestores[] = setores.map((s) => ({
    setor: s,
    pessoas: pessoas(s),
    gestores: porSetor.get(s.classiforgan) ?? [],
  }));
  const conhecidos = new Set(setores.map((s) => s.classiforgan));
  for (const [classiforgan, gs] of porSetor) {
    if (conhecidos.has(classiforgan)) continue;
    const setor: SetorRh = { classiforgan, nome: `Setor ${classiforgan}`, ativos: 0, origem: "questor" };
    itens.push({ setor, pessoas: pessoas(setor), gestores: gs, orfao: true });
  }
  return itens.sort(
    (a, b) =>
      Number(precisaGestor(b)) - Number(precisaGestor(a)) ||
      b.pessoas - a.pessoas ||
      a.setor.nome.localeCompare(b.setor.nome, "pt-BR")
  );
}

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** Nome do setor com o que o distingue: criado no RH, ou fora da lista do Questor. */
function NomeSetor({ item }: { item: SetorGestores }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-[560] text-tinta" title={item.setor.nome}>
        {item.setor.nome}
      </span>
      {item.setor.origem === "app" && <Selo title="Setor criado no RH, fora do Questor">Próprio</Selo>}
      {item.orfao && <Selo title="Ninguém ativo no Questor usa mais este setor">Inativo</Selo>}
    </span>
  );
}

function GestoresDaLinha({ item }: { item: SetorGestores }) {
  if (item.gestores.length)
    return (
      <span
        className="block truncate"
        title={item.gestores.map((g) => `${g.nome} (${ROTULO_PAPEL[g.papel]})`).join(", ")}
      >
        {item.gestores.map((g) => g.nome).join(", ")}
      </span>
    );
  if (item.pessoas > 0)
    return (
      <Selo tom="atencao" icone="alerta">
        Sem gestor
      </Selo>
    );
  return <span className="text-apagado">Nenhum</span>;
}

function colunasSetores(onAbrir: (s: SetorGestores) => void): Coluna<SetorGestores>[] {
  return [
    {
      id: "setor",
      cabecalho: "Setor",
      largura: "36%",
      ordenar: (s) => s.setor.nome,
      celula: (s) => <NomeSetor item={s} />,
    },
    {
      id: "pessoas",
      cabecalho: "Pessoas",
      alinhar: "dir",
      largura: "96px",
      ordenar: (s) => s.pessoas,
      celula: (s) => num(s.pessoas),
    },
    {
      id: "gestores",
      cabecalho: "Gestores",
      largura: "40%",
      ordenar: (s) => s.gestores.length,
      celula: (s) => <GestoresDaLinha item={s} />,
    },
    {
      id: "acao",
      cabecalho: <span className="sr-only">Ação</span>,
      alinhar: "dir",
      celula: (s) =>
        precisaGestor(s) ? (
          // O botão decide ali mesmo: o clique (e o Enter) não vaza para a linha.
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Botao icone="mais" onClick={() => onAbrir(s)} className="h-controle-p rounded-chip px-2 text-pequeno">
              Adicionar gestor
            </Botao>
          </div>
        ) : null,
    },
  ];
}

/**
 * Os setores, uma linha cada: quantas pessoas, quem responde por elas e, no
 * setor que precisa, o botão de adicionar gestor na própria linha. O resto
 * (editar, remover, renomear) está no setor que o clique abre.
 */
export function TabelaSetores({
  itens,
  onAbrir,
  selecionado,
  vazio,
  alturaMax = "62vh",
}: {
  itens: SetorGestores[];
  onAbrir: (s: SetorGestores) => void;
  selecionado?: string | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return (
    <TabelaDados
      rotulo="Setores e gestores"
      colunas={colunasSetores(onAbrir)}
      linhas={itens}
      chave={(s) => s.setor.classiforgan}
      onLinha={onAbrir}
      selecionada={(s) => s.setor.classiforgan === selecionado}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── O setor aberto ───────────────────────────────────────────────────────────

export interface DadosGestor {
  nome: string;
  email: string;
  papel: PapelGestor;
}

/** O que a janela do setor faz. Cada ação devolve se deu certo; o recado ao usuário é dela. */
export interface AcoesSetor {
  adicionar: (g: DadosGestor) => Promise<boolean>;
  editar: (g: GestorRh, novo: DadosGestor) => Promise<boolean>;
  remover: (g: GestorRh) => Promise<boolean>;
  renomear: (nome: string) => Promise<boolean>;
  removerSetor: () => Promise<boolean>;
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

/** Nome, e-mail e papel. Serve ao gestor novo e à edição na própria linha. */
function FormGestor({
  inicial,
  rotuloAcao,
  onSalvar,
  onCancelar,
}: {
  inicial?: DadosGestor;
  rotuloAcao: string;
  onSalvar: (g: DadosGestor) => Promise<boolean>;
  onCancelar?: () => void;
}) {
  const id = useId();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [papel, setPapel] = useState<PapelGestor>(inicial?.papel ?? "supervisor");
  const [salvando, setSalvando] = useState(false);
  const pronto = nome.trim() !== "" && email.trim() !== "";

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pronto) return;
        setSalvando(true);
        const ok = await onSalvar({ nome: nome.trim(), email: email.trim(), papel });
        setSalvando(false);
        if (ok && !inicial) {
          setNome("");
          setEmail("");
          setPapel("supervisor");
        }
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Rotulado rotulo="Nome" htmlFor={`${id}-nome`}>
          <Campo id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do gestor" />
        </Rotulado>
        <Rotulado rotulo="E-mail" htmlFor={`${id}-email`}>
          <Campo
            id={`${id}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@navecon.com.br"
          />
        </Rotulado>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmentado<PapelGestor>
          rotulo="Papel"
          valor={papel}
          onMudar={setPapel}
          opcoes={PAPEIS_GESTOR.map((p) => ({ valor: p, rotulo: ROTULO_PAPEL[p] }))}
        />
        <div className="flex items-center gap-1.5">
          {onCancelar && (
            <Botao variante="fantasma" onClick={onCancelar} disabled={salvando}>
              Cancelar
            </Botao>
          )}
          <Botao type="submit" icone={inicial ? "salvar" : "mais"} carregando={salvando} disabled={!pronto}>
            {rotuloAcao}
          </Botao>
        </div>
      </div>
    </form>
  );
}

function ListaGestores({
  item,
  acoes,
  editandoInicial = null,
  confirmandoInicial = null,
}: {
  item: SetorGestores;
  acoes: AcoesSetor;
  editandoInicial?: number | null;
  confirmandoInicial?: number | null;
}) {
  // Uma linha por vez edita ou pede confirmação; as outras seguem clicáveis.
  const [editando, setEditando] = useState<number | null>(editandoInicial);
  const [confirmando, setConfirmando] = useState<number | null>(confirmandoInicial);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const { gestores, pessoas } = item;

  if (!gestores.length)
    return (
      <div className="rounded-controle border border-linha">
        {pessoas > 0 ? (
          <Vazio
            compacto
            icone="usuario"
            titulo="Ninguém recebe os formulários deste setor"
            descricao={`Cadastre abaixo quem avalia ${
              pessoas === 1 ? "a pessoa" : `as ${num(pessoas)} pessoas`
            } daqui na experiência e no desempenho.`}
          />
        ) : (
          <Vazio compacto icone="usuario" titulo="Nenhum gestor neste setor" descricao="O setor não tem ninguém ativo agora." />
        )}
      </div>
    );

  return (
    <ul className="flex flex-col rounded-controle border border-linha">
      {gestores.map((g) => {
        if (editando === g.id)
          return (
            <li key={g.id} className="border-b border-linha px-3 py-3 last:border-0">
              <FormGestor
                inicial={{ nome: g.nome, email: g.email, papel: g.papel }}
                rotuloAcao="Salvar"
                onCancelar={() => setEditando(null)}
                onSalvar={async (novo) => {
                  const igual = novo.nome === g.nome && novo.email.toLowerCase() === g.email && novo.papel === g.papel;
                  const ok = igual || (await acoes.editar(g, novo));
                  if (ok) setEditando(null);
                  return ok;
                }}
              />
            </li>
          );
        const emConfirmacao = confirmando === g.id;
        return (
          <li key={g.id} className="flex min-h-12 items-center gap-3 border-b border-linha px-3 py-1.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2 text-corpo text-tinta">
                <span className="truncate">{g.nome}</span>
                <Selo>{ROTULO_PAPEL[g.papel]}</Selo>
              </p>
              <p className="truncate text-pequeno text-apagado">{g.email}</p>
            </div>
            {emConfirmacao ? (
              <div className="flex shrink-0 items-center gap-1">
                <Botao variante="fantasma" onClick={() => setConfirmando(null)} disabled={ocupado === g.id}>
                  Cancelar
                </Botao>
                <Botao
                  variante="perigo"
                  icone="apagar"
                  carregando={ocupado === g.id}
                  onClick={async () => {
                    setOcupado(g.id);
                    const ok = await acoes.remover(g);
                    setOcupado(null);
                    if (ok) setConfirmando(null);
                  }}
                >
                  Remover
                </Botao>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-0.5">
                <BotaoIcone
                  icone="editar"
                  rotulo={`Editar ${g.nome}`}
                  onClick={() => {
                    setConfirmando(null);
                    setEditando(g.id);
                  }}
                />
                <BotaoIcone
                  icone="apagar"
                  rotulo={`Remover ${g.nome}`}
                  onClick={() => {
                    setEditando(null);
                    setConfirmando(g.id);
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FormNomeSetor({ setor, onRenomear }: { setor: SetorRh; onRenomear: (nome: string) => Promise<boolean> }) {
  const id = useId();
  const [nome, setNome] = useState(setor.nome);
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== "" && nome.trim() !== setor.nome;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!mudou) return;
        setSalvando(true);
        await onRenomear(nome.trim());
        setSalvando(false);
      }}
    >
      <Rotulado rotulo="Nome" htmlFor={`${id}-nome`} className="min-w-48 flex-1">
        <Campo id={`${id}-nome`} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
      </Rotulado>
      <Botao type="submit" icone="salvar" carregando={salvando} disabled={!mudou}>
        Renomear
      </Botao>
    </form>
  );
}

function RemoverSetor({
  item,
  onRemover,
  confirmandoInicial = false,
}: {
  item: SetorGestores;
  onRemover: () => Promise<boolean>;
  confirmandoInicial?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const [removendo, setRemovendo] = useState(false);
  // A rota apaga só o setor: pessoa e gestor apontando para ele ficariam
  // presos a um código sem nome. Por isso só sai setor vazio.
  const vazio = item.pessoas === 0 && item.gestores.length === 0;
  if (!vazio) return <Nota>Para remover o setor, tire antes as pessoas e os gestores dele.</Nota>;
  return confirmando ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <Botao
        variante="perigo"
        icone="apagar"
        carregando={removendo}
        onClick={async () => {
          setRemovendo(true);
          await onRemover();
          setRemovendo(false);
        }}
      >
        Confirmar remoção
      </Botao>
      <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={removendo}>
        Cancelar
      </Botao>
    </div>
  ) : (
    <div>
      <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)}>
        Remover setor
      </Botao>
    </div>
  );
}

/**
 * O corpo do setor aberto: os gestores (editar e remover na própria linha,
 * remover com confirmação), o gestor novo e o nome do setor. Cada gesto grava
 * na hora; não há Salvar geral para perder.
 *
 * Os `...Inicial` existem para o catálogo mostrar a linha em edição ou em
 * confirmação sem clicar.
 */
export function CorpoSetor({
  item,
  acoes,
  editandoInicial,
  confirmandoInicial,
  removendoSetorInicial,
}: {
  item: SetorGestores;
  acoes: AcoesSetor;
  editandoInicial?: number | null;
  confirmandoInicial?: number | null;
  removendoSetorInicial?: boolean;
}) {
  const { setor } = item;
  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Gestores do Setor">
        <ListaGestores
          item={item}
          acoes={acoes}
          editandoInicial={editandoInicial}
          confirmandoInicial={confirmandoInicial}
        />
      </Secao>
      <Secao titulo="Novo Gestor">
        <FormGestor rotuloAcao="Adicionar" onSalvar={acoes.adicionar} />
      </Secao>
      <Secao titulo="Setor">
        {item.orfao ? (
          <Nota>
            Ninguém ativo no Questor usa mais este setor. Os gestores dele ainda recebem os envios feitos para todos
            os gestores.
          </Nota>
        ) : (
          <>
            {/* A chave refaz o rascunho quando o nome salvo volta do servidor. */}
            <FormNomeSetor key={setor.nome} setor={setor} onRenomear={acoes.renomear} />
            {setor.origem === "app" ? (
              <RemoverSetor item={item} onRemover={acoes.removerSetor} confirmandoInicial={removendoSetorInicial} />
            ) : (
              <Nota>O nome novo vale só no NaveX. No Questor o setor continua como está.</Nota>
            )}
          </>
        )}
      </Secao>
    </div>
  );
}

export function descricaoSetor(item: SetorGestores): string {
  return [
    plural(item.pessoas, "pessoa", "pessoas"),
    plural(item.gestores.length, "gestor", "gestores"),
    item.setor.origem === "app" ? "criado no RH" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A janela do setor, com as escritas. Fecha sozinha quando o setor é removido. */
export function ModalSetor({ item, onFechar }: { item: SetorGestores | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const nome = item?.setor.nome ?? "";
  const classiforgan = item?.setor.classiforgan ?? "";

  const tentar = async (fazer: () => Promise<unknown>, ok: [string, string?], falha: string) => {
    try {
      await fazer();
      avisar.ok(...ok);
      return true;
    } catch (e) {
      avisar.erro(falha, (e as Error).message);
      return false;
    }
  };
  const recarregarGestores = () => qc.invalidateQueries({ queryKey: [CHAVES_RH.gestores] });
  // O nome do setor aparece no Diretório e nas listas do RH: todos releem.
  const recarregarSetores = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVES_RH.setores] }),
      qc.invalidateQueries({ queryKey: [CHAVES_RH.funcionarios] }),
    ]);

  const acoes: AcoesSetor = {
    adicionar: (g) =>
      tentar(
        async () => {
          await mutar("/api/rh/gestores", "POST", { classiforgan, ...g });
          await recarregarGestores();
        },
        ["Gestor adicionado", `${g.nome} recebe os formulários de ${nome}`],
        "Não deu para adicionar o gestor"
      ),
    editar: (g, novo) =>
      tentar(
        async () => {
          await mutar("/api/rh/gestores", "PATCH", { id: g.id, ...novo });
          await recarregarGestores();
        },
        ["Gestor salvo", novo.nome],
        "Não deu para salvar o gestor"
      ),
    remover: (g) =>
      tentar(
        async () => {
          await mutar(`/api/rh/gestores?id=${g.id}`, "DELETE");
          await recarregarGestores();
        },
        ["Gestor removido", g.nome],
        "Não deu para remover o gestor"
      ),
    renomear: (novo) =>
      tentar(
        async () => {
          await mutar("/api/rh/setor", "PATCH", { classiforgan, nome: novo });
          await recarregarSetores();
        },
        ["Setor renomeado", novo],
        "Não deu para renomear o setor"
      ),
    removerSetor: () =>
      tentar(
        async () => {
          await mutar(`/api/rh/setor?classiforgan=${encodeURIComponent(classiforgan)}`, "DELETE");
          onFechar();
          await recarregarSetores();
        },
        ["Setor removido", nome],
        "Não deu para remover o setor"
      ),
  };

  return (
    <Modal
      aberto={item != null}
      onFechar={onFechar}
      titulo={nome}
      descricao={item ? descricaoSetor(item) : undefined}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      {/* A chave recomeça as edições em aberto quando outro setor é aberto. */}
      {item && <CorpoSetor key={classiforgan} item={item} acoes={acoes} />}
    </Modal>
  );
}

const SEM_ACAO: AcoesSetor = {
  adicionar: async () => true,
  editar: async () => true,
  remover: async () => true,
  renomear: async () => true,
  removerSetor: async () => true,
};

/** A janela do setor parada, para o catálogo. */
export function SetorEstatico({
  item,
  editandoInicial,
  confirmandoInicial,
  removendoSetorInicial,
}: {
  item: SetorGestores;
  editandoInicial?: number;
  confirmandoInicial?: number;
  removendoSetorInicial?: boolean;
}) {
  return (
    <PainelModal
      estatico
      titulo={item.setor.nome}
      descricao={descricaoSetor(item)}
      onFechar={() => {}}
      rodape={<Botao>Fechar</Botao>}
    >
      <CorpoSetor
        item={item}
        acoes={SEM_ACAO}
        editandoInicial={editandoInicial}
        confirmandoInicial={confirmandoInicial}
        removendoSetorInicial={removendoSetorInicial}
      />
    </PainelModal>
  );
}

// ── Setor novo ───────────────────────────────────────────────────────────────

const TITULO_NOVO = "Novo Setor";
const DESCRICAO_NOVO = "Setor próprio do RH, fora do organograma do Questor";

function CorpoNovoSetor({
  id,
  nome,
  onNome,
  onEnviar,
}: {
  id?: string;
  nome: string;
  onNome: (v: string) => void;
  onEnviar?: () => void;
}) {
  const base = useId();
  return (
    <form
      id={id}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar?.();
      }}
    >
      <Rotulado rotulo="Nome do setor" htmlFor={`${id ?? base}-nome`}>
        <Campo
          id={`${id ?? base}-nome`}
          data-autofoco
          value={nome}
          maxLength={80}
          onChange={(e) => onNome(e.target.value)}
          placeholder="Prestadores PJ"
        />
      </Rotulado>
      <Nota>O setor existe só no NaveX. Para pôr alguém nele, escolha o setor na ficha da pessoa, no Diretório.</Nota>
    </form>
  );
}

export function ModalNovoSetor({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** O setor criado, para a tela abri-lo e cadastrar o gestor em seguida. */
  onCriado?: (s: SetorRh) => void;
}) {
  if (!aberto) return null;
  return <JanelaNovoSetor onFechar={onFechar} onCriado={onCriado} />;
}

function JanelaNovoSetor({ onFechar, onCriado }: { onFechar: () => void; onCriado?: (s: SetorRh) => void }) {
  const qc = useQueryClient();
  const id = useId();
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const setor = await mutar<SetorRh>("/api/rh/setor", "POST", { nome: nome.trim() });
      await qc.invalidateQueries({ queryKey: [CHAVES_RH.setores] });
      avisar.ok("Setor criado", setor.nome);
      onFechar();
      onCriado?.(setor);
    } catch (e) {
      avisar.erro("Não deu para criar o setor", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={TITULO_NOVO}
      descricao={DESCRICAO_NOVO}
      largura="p"
      fecharNoVeu={false}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="mais" type="submit" form={id} carregando={salvando} disabled={!nome.trim()}>
            Criar setor
          </Botao>
        </>
      }
    >
      <CorpoNovoSetor id={id} nome={nome} onNome={setNome} onEnviar={criar} />
    </Modal>
  );
}

/** A janela de setor novo parada, para o catálogo. */
export function NovoSetorEstatico({ nome = "" }: { nome?: string }) {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={TITULO_NOVO}
      descricao={DESCRICAO_NOVO}
      onFechar={() => {}}
      rodape={
        <>
          <Botao variante="fantasma">Cancelar</Botao>
          <Botao variante="primario" icone="mais" disabled={!nome.trim()}>
            Criar setor
          </Botao>
        </>
      }
    >
      <CorpoNovoSetor nome={nome} onNome={() => {}} />
    </PainelModal>
  );
}
