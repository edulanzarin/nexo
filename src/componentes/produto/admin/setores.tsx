"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { mutar } from "@/hooks/mutar";
import { CHAVES_ADMIN } from "@/hooks/use-admin";
import { NOME_MAX, type SetorResumo } from "@/lib/admin-tipos";
import { num } from "@/lib/format";

/*
 * Setores da Administração: o rótulo que agrupa os cargos na lista e no
 * formulário do cargo. Só o nome; a permissão mora toda no cargo.
 */

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/**
 * Quem escreve invalida os setores e os cargos (a lista de cargos mostra o
 * nome do setor, e excluir deixa cargo sem setor), e a trilha, que ganhou uma
 * linha.
 */
function invalidarSetores(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.setores] }),
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.cargos] }),
    qc.invalidateQueries({ queryKey: [CHAVES_ADMIN.trilha] }),
  ]);
}

// ── A lista ──────────────────────────────────────────────────────────────────

const COLUNAS: Coluna<SetorResumo>[] = [
  {
    id: "nome",
    cabecalho: "Setor",
    largura: "72%",
    ordenar: (s) => s.nome,
    celula: (s) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-[560] text-tinta" title={s.nome}>
          {s.nome}
        </span>
        {s.cargos === 0 && <Selo title="Nenhum cargo está neste setor">Sem cargo</Selo>}
      </span>
    ),
  },
  {
    id: "cargos",
    cabecalho: "Cargos",
    alinhar: "dir",
    largura: "112px",
    ordenar: (s) => s.cargos,
    celula: (s) => num(s.cargos),
  },
];

/** Os setores, uma linha cada. O clique abre o setor, com o nome e a exclusão. */
export function TabelaSetores({
  setores,
  onAbrir,
  selecionado,
  vazio,
  alturaMax = "62vh",
}: {
  setores: SetorResumo[];
  onAbrir: (s: SetorResumo) => void;
  selecionado?: number | null;
  vazio?: ReactNode;
  alturaMax?: string;
}) {
  return (
    <TabelaDados
      rotulo="Setores"
      colunas={COLUNAS}
      linhas={setores}
      chave={(s) => String(s.id)}
      onLinha={onAbrir}
      selecionada={(s) => s.id === selecionado}
      alturaMax={alturaMax}
      vazio={vazio}
    />
  );
}

// ── O setor aberto ───────────────────────────────────────────────────────────

/**
 * Excluir em dois cliques, e o segundo diz o que muda: os cargos do setor não
 * somem, ficam sem setor (a chave estrangeira anula).
 */
function ExcluirSetor({
  cargos,
  onExcluir,
  confirmandoInicial = false,
}: {
  cargos: number;
  onExcluir: () => Promise<boolean>;
  confirmandoInicial?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const [excluindo, setExcluindo] = useState(false);
  let conteudo: ReactNode;
  if (confirmando)
    conteudo = (
      <>
        <Botao
          variante="perigo"
          icone="apagar"
          carregando={excluindo}
          onClick={async () => {
            setExcluindo(true);
            const ok = await onExcluir();
            setExcluindo(false);
            if (ok) setConfirmando(false);
          }}
        >
          Confirmar exclusão
        </Botao>
        <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={excluindo}>
          Cancelar
        </Botao>
        <span className="text-pequeno text-apagado">
          {cargos > 0
            ? `${plural(cargos, "cargo fica", "cargos ficam")} sem setor.`
            : "Nenhum cargo está neste setor."}
        </span>
      </>
    );
  else
    conteudo = (
      <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)}>
        Excluir setor
      </Botao>
    );
  return <div className="flex flex-wrap items-center gap-1.5 border-t border-linha pt-4">{conteudo}</div>;
}

/** O corpo da janela: o nome e, no setor que já existe, a exclusão. */
export function CorpoSetor({
  nome,
  onNome,
  idForm,
  onEnviar,
  exclusao,
}: {
  nome: string;
  onNome: (v: string) => void;
  idForm?: string;
  onEnviar?: () => void;
  /** Só no setor que já existe. */
  exclusao?: { cargos: number; onExcluir: () => Promise<boolean>; confirmandoInicial?: boolean };
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
      <Rotulado rotulo="Nome do setor" htmlFor={`${base}-nome`}>
        <Campo
          id={`${base}-nome`}
          data-autofoco
          value={nome}
          maxLength={NOME_MAX}
          placeholder="Contábil"
          onChange={(e) => onNome(e.target.value)}
        />
      </Rotulado>
      {exclusao && (
        <ExcluirSetor
          cargos={exclusao.cargos}
          onExcluir={exclusao.onExcluir}
          confirmandoInicial={exclusao.confirmandoInicial}
        />
      )}
    </form>
  );
}

function RodapeSetor({
  novo,
  pronto,
  salvando,
  idForm,
  onCancelar,
}: {
  novo: boolean;
  pronto: boolean;
  salvando?: boolean;
  idForm?: string;
  onCancelar: () => void;
}) {
  return (
    <>
      <Botao variante="fantasma" onClick={onCancelar} disabled={salvando}>
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
        {novo ? "Criar setor" : "Salvar"}
      </Botao>
    </>
  );
}

const TITULO_NOVO = "Novo Setor";
const DESCRICAO_NOVO = "Agrupa os cargos de uma mesma área";

function descricaoSetor(s: SetorResumo): string {
  return s.cargos > 0 ? `${plural(s.cargos, "cargo", "cargos")} neste setor` : "Nenhum cargo neste setor";
}

/** Quem a janela abre: um setor novo ou um da lista. */
export type AlvoSetor = "novo" | SetorResumo;

/** A janela do setor, com as escritas. Fecha sozinha ao salvar e ao excluir. */
export function ModalSetor({ alvo, onFechar }: { alvo: AlvoSetor | null; onFechar: () => void }) {
  if (!alvo) return null;
  // A chave refaz a janela a cada abertura: o nome digitado não sobra de um
  // setor para o outro.
  return <JanelaSetor key={alvo === "novo" ? "novo" : alvo.id} alvo={alvo} onFechar={onFechar} />;
}

function JanelaSetor({ alvo, onFechar }: { alvo: AlvoSetor; onFechar: () => void }) {
  const qc = useQueryClient();
  const idForm = useId();
  const setor = alvo === "novo" ? null : alvo;
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [salvando, setSalvando] = useState(false);

  const limpo = nome.trim();
  const mudou = limpo !== (setor?.nome ?? "");
  const pronto = limpo !== "" && mudou;

  async function salvar() {
    if (!pronto) return;
    setSalvando(true);
    try {
      if (setor) await mutar(`/api/admin/setores/${setor.id}`, "PATCH", { nome: limpo });
      else await mutar("/api/admin/setores", "POST", { nome: limpo });
      await invalidarSetores(qc);
      avisar.ok(setor ? "Setor salvo" : "Setor criado", limpo);
      onFechar();
    } catch (e) {
      // O nome em uso chega aqui, com o nome que já existe.
      avisar.erro(setor ? "Não deu para salvar o setor" : "Não deu para criar o setor", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(): Promise<boolean> {
    if (!setor) return false;
    try {
      await mutar(`/api/admin/setores/${setor.id}`, "DELETE");
      await invalidarSetores(qc);
      avisar.ok(
        "Setor excluído",
        setor.cargos > 0 ? `${setor.nome} · ${plural(setor.cargos, "cargo ficou", "cargos ficaram")} sem setor` : setor.nome
      );
      onFechar();
      return true;
    } catch (e) {
      avisar.erro("Não deu para excluir o setor", (e as Error).message);
      return false;
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="p"
      titulo={setor ? setor.nome : TITULO_NOVO}
      descricao={setor ? descricaoSetor(setor) : DESCRICAO_NOVO}
      fecharNoVeu={!mudou}
      rodape={
        <RodapeSetor novo={!setor} pronto={pronto} salvando={salvando} idForm={idForm} onCancelar={onFechar} />
      }
    >
      <CorpoSetor
        nome={nome}
        onNome={setNome}
        idForm={idForm}
        onEnviar={salvar}
        exclusao={setor ? { cargos: setor.cargos, onExcluir: excluir } : undefined}
      />
    </Modal>
  );
}

/** A janela do setor parada, para o catálogo. Mexe no nome, mas não grava. */
export function SetorEstatico({
  setor,
  nomeInicial,
  confirmandoInicial,
}: {
  /** Sem setor, é a janela do setor novo. */
  setor?: SetorResumo;
  nomeInicial?: string;
  confirmandoInicial?: boolean;
}) {
  const inicial = nomeInicial ?? setor?.nome ?? "";
  const [nome, setNome] = useState(inicial);
  const limpo = nome.trim();
  return (
    <PainelModal
      estatico
      largura="p"
      titulo={setor ? setor.nome : TITULO_NOVO}
      descricao={setor ? descricaoSetor(setor) : DESCRICAO_NOVO}
      onFechar={() => {}}
      rodape={
        <RodapeSetor
          novo={!setor}
          pronto={limpo !== "" && limpo !== (setor?.nome ?? "")}
          onCancelar={() => setNome(inicial)}
        />
      }
    >
      <CorpoSetor
        nome={nome}
        onNome={setNome}
        exclusao={setor ? { cargos: setor.cargos, onExcluir: async () => true, confirmandoInicial } : undefined}
      />
    </PainelModal>
  );
}
