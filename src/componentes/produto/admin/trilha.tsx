"use client";

import type { ReactNode } from "react";
import type { Opcao } from "@/componentes/primitivos/combo";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import type { EventoTrilha } from "@/lib/admin-tipos";
import { dataHoraBR } from "@/lib/format";
import { getModulo, MODULOS } from "@/lib/modulos";

/*
 * A trilha de auditoria: quem viu, gerou, exportou e mudou o quê. A lib grava
 * um verbo estável por gesto ("folha.ficha.ver"); aqui ele vira frase.
 */

/**
 * Rótulos legíveis das ações gravadas. Verbo sem rótulo aparece cru, de
 * propósito: é o que denuncia gesto instrumentado sem batismo, em vez de
 * escondê-lo num rótulo genérico. Consulta e exportação não estão aqui porque
 * valem para todo módulo (ver `rotuloAcao`).
 */
const ROTULO_ACAO: Record<string, string> = {
  "folha.ficha.ver": "Viu ficha (DP)",
  "rh.ficha.ver": "Viu ficha (RH)",
  "contabil.laudo.gerar": "Gerou laudo",
  "contabil.conciliacao.gerar": "Gerou conciliação",
  "contabil.implantacao.gerar": "Gerou implantação de saldos",
  "contabil.implantacao.patrimonial": "Gerou implantação do patrimonial",
  "contabil.pendencia.triar": "Triou pendência",
  "contabil.plano.salvar": "Salvou plano de contabilização",
  "contabil.plano.reverter": "Reverteu plano ao Questor",
  "contabil.plano.replicar": "Replicou plano entre empresas",
  "contabil.plano.aprender": "Reaprendeu plano do histórico",
  "contabil.regra.salvar": "Salvou regra de extrato",
  "contabil.regra.remover": "Removeu regra de extrato",
  "contabil.regra.replicar": "Replicou regras de extrato",
  "contabil.nota.ver": "Abriu nota (Contábil)",
  "fiscal.nota.ver": "Abriu nota (Fiscal)",
  "admin.usuario.criar": "Criou usuário",
  "admin.usuario.salvar": "Alterou usuário",
  "admin.usuario.excluir": "Excluiu usuário",
  "admin.usuario.foto": "Trocou a foto de um usuário",
  "admin.cargo.criar": "Criou cargo",
  "admin.cargo.salvar": "Alterou cargo",
  "admin.cargo.excluir": "Excluiu cargo",
  "admin.setor.criar": "Criou setor",
  "admin.setor.salvar": "Alterou setor",
  "admin.setor.excluir": "Excluiu setor",
  "admin.grupo.criar": "Criou grupo de permissão",
  "admin.grupo.salvar": "Alterou grupo de permissão",
  "admin.grupo.excluir": "Excluiu grupo de permissão",
  "perfil.senha": "Trocou a própria senha",
  "perfil.foto": "Trocou a própria foto",
};

/**
 * A ação como frase. `<modulo>.consulta` e `<modulo>.export` levam o título do
 * módulo, que vem de `MODULOS` (o id `folha` aparece como DP).
 */
export function rotuloAcao(acao: string): string {
  const fixo = ROTULO_ACAO[acao];
  if (fixo) return fixo;
  const partes = acao.split(".");
  const modulo = partes.length === 2 ? getModulo(partes[0]) : undefined;
  if (modulo && partes[1] === "consulta") return `Executou consulta (${modulo.titulo})`;
  if (modulo && partes[1] === "export") return `Exportou (${modulo.titulo})`;
  return acao;
}

/** Origens da trilha que não são módulo da barra: o Meu Perfil grava como `perfil`. */
const FORA_DOS_MODULOS: Record<string, string> = { perfil: "Meu Perfil" };

export function tituloOrigem(modulo: string | null): string {
  if (!modulo) return "Sem módulo";
  return getModulo(modulo)?.titulo ?? FORA_DOS_MODULOS[modulo] ?? modulo;
}

/** O valor de "sem filtro" no seletor de módulo. A rota não recebe `modulo`. */
export const TODOS_MODULOS = "todos";

/**
 * Todos e um por módulo. A rota filtra por módulo exato e só aceita ids de
 * `MODULOS`, então o que o Meu Perfil grava só aparece em Todos.
 */
export const OPCOES_MODULO_TRILHA: Opcao[] = [
  { valor: TODOS_MODULOS, rotulo: "Todos os módulos" },
  ...MODULOS.map((m) => ({ valor: m.id, rotulo: m.titulo })),
];

// ── A lista ──────────────────────────────────────────────────────────────────

function AlvoEvento({ e }: { e: EventoTrilha }) {
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      {(e.alvo || e.codigoempresa == null) && (
        <span className="truncate" title={e.alvo ?? undefined}>
          {e.alvo || "—"}
        </span>
      )}
      {e.codigoempresa != null && (
        <span className="num shrink-0 text-pequeno text-apagado">empresa {e.codigoempresa}</span>
      )}
    </span>
  );
}

const COLUNAS: Coluna<EventoTrilha>[] = [
  {
    id: "quando",
    cabecalho: "Quando",
    celula: (e) => <span className="num">{dataHoraBR(e.criadoEm)}</span>,
  },
  {
    id: "quem",
    cabecalho: "Quem",
    largura: "18%",
    celula: (e) => (
      <span className="block truncate font-[560] text-tinta" title={e.usuarioNome}>
        {e.usuarioNome}
      </span>
    ),
  },
  {
    id: "acao",
    cabecalho: "Ação",
    largura: "26%",
    celula: (e) => {
      const rotulo = rotuloAcao(e.acao);
      return (
        <span className="block truncate" title={rotulo === e.acao ? undefined : e.acao}>
          {rotulo}
        </span>
      );
    },
  },
  {
    id: "alvo",
    cabecalho: "Alvo",
    largura: "38%",
    celula: (e) => <AlvoEvento e={e} />,
  },
];

/**
 * Uma linha por evento, da mais recente. Sem ordenação na coluna: a rota corta
 * em páginas de cem pela data, e reordenar só a página na tela mentiria sobre o
 * resto da trilha. O clique abre o evento com o alvo inteiro.
 */
export function TabelaTrilha({
  eventos,
  onAbrir,
  selecionado,
  vazio,
  alturaMax = "62vh",
}: {
  eventos: EventoTrilha[];
  onAbrir?: (e: EventoTrilha) => void;
  selecionado?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return (
    <TabelaDados
      rotulo="Trilha de auditoria"
      colunas={COLUNAS}
      linhas={eventos}
      chave={(e) => String(e.id)}
      onLinha={onAbrir}
      selecionada={(e) => e.id === selecionado}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── O evento aberto ──────────────────────────────────────────────────────────

/** O evento inteiro: o alvo sem corte e o verbo como foi gravado. */
export function CorpoEvento({ e }: { e: EventoTrilha }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Par rotulo="Quem">{e.usuarioNome}</Par>
      <Par rotulo="Módulo">{tituloOrigem(e.modulo)}</Par>
      <Par rotulo="Ação gravada">
        <code className="text-pequeno break-all text-tinta-2">{e.acao}</code>
      </Par>
      <Par rotulo="Empresa">
        <span className="num">{e.codigoempresa ?? "Nenhuma"}</span>
      </Par>
      <Par rotulo="Alvo" className="sm:col-span-2">
        <span className="break-words whitespace-pre-wrap">{e.alvo || "Sem alvo registrado"}</span>
      </Par>
    </dl>
  );
}

export function DetalheEvento({ evento, onFechar }: { evento: EventoTrilha | null; onFechar: () => void }) {
  return (
    <Modal
      aberto={evento != null}
      onFechar={onFechar}
      largura="p"
      titulo={evento ? rotuloAcao(evento.acao) : ""}
      descricao={evento ? dataHoraBR(evento.criadoEm) : undefined}
    >
      {evento && <CorpoEvento e={evento} />}
    </Modal>
  );
}

/** O evento aberto parado, para o catálogo. */
export function EventoEstatico({ evento }: { evento: EventoTrilha }) {
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={rotuloAcao(evento.acao)}
      descricao={dataHoraBR(evento.criadoEm)}
      onFechar={() => {}}
    >
      <CorpoEvento e={evento} />
    </PainelModal>
  );
}
