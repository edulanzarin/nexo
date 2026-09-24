"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { num } from "@/lib/format";
import { normalizar, type TipoRegra } from "@/lib/regras-extrato";
import type { RegraExtratoDTO } from "@/lib/types";
import { mutar } from "@/hooks/mutar";

export interface RascunhoRegra {
  termo: string;
  tipo: TipoRegra;
  contaPagamento: number | null;
  contaRecebimento: number | null;
  historico: string;
  ativo: boolean;
}

export const ROTULO_TIPO: Record<TipoRegra, string> = { parcial: "Contém", exato: "Exato" };

/**
 * O termo que sai de uma descrição do extrato. O sufixo de data ("… 30/06") muda
 * todo mês: fora do termo, a regra casa sempre, e não só no mês em que nasceu.
 */
export function termoDaDescricao(descricao: string): string {
  return descricao.replace(/\s+\d{2}\/\d{2}(\/\d{4})?\s*$/, "").trim() || descricao;
}

interface PropsRegra {
  empresa: number;
  /** Conta do banco dona da regra: cada conta tem o próprio cadastro. */
  conta: number;
  descricaoConta?: string | null;
  /** Editando uma regra existente; sem ela, é regra nova. */
  regra?: RegraExtratoDTO | null;
  /** Regra nova já preenchida (a linha do extrato que a originou). */
  inicial?: Partial<RascunhoRegra>;
  /** Descrições do extrato lido: a janela conta quantas a regra casaria. */
  amostra?: string[];
  onFechar: () => void;
  onSalvo?: (id: number) => void;
  onApagado?: () => void;
}

/**
 * Cadastro de uma regra de extrato: a descrição que o banco usa e a
 * contrapartida de cada sentido do dinheiro. Serve a aba Regras (editar e
 * criar) e a Importação (criar a regra a partir da linha que não casou).
 *
 * Janela e não linha editável: a regra tem seis campos, e uma linha de tabela
 * com dois seletores de conta e um texto livre deixa de ser leitura. A tabela
 * fica para ler; a janela, para mudar.
 *
 * Quando a regra nasce do extrato, a janela diz quantas linhas dele o termo
 * casaria: é o jeito de ver, antes de salvar, se "PIX" genérico demais vai
 * engolir o extrato inteiro.
 */
export function RegraExtratoModal({ aberto, ...props }: PropsRegra & { aberto: boolean }) {
  // Monta a cada abertura: o rascunho nasce da regra (ou da linha) da vez.
  if (!aberto) return null;
  return <FormularioRegra {...props} />;
}

/** A mesma janela parada, para o catálogo. */
export function RegraExtratoEstatica(props: PropsRegra) {
  return <FormularioRegra {...props} estatico />;
}

function FormularioRegra({
  empresa,
  conta,
  descricaoConta,
  regra,
  inicial,
  amostra,
  onFechar,
  onSalvo,
  onApagado,
  estatico,
}: PropsRegra & { estatico?: boolean }) {
  const id = useId();
  const qc = useQueryClient();
  const [r, setR] = useState<RascunhoRegra>(() => ({
    termo: regra?.termoOriginal ?? inicial?.termo ?? "",
    tipo: regra?.tipo ?? inicial?.tipo ?? "parcial",
    contaPagamento: regra?.contaPagamento ?? inicial?.contaPagamento ?? null,
    contaRecebimento: regra?.contaRecebimento ?? inicial?.contaRecebimento ?? null,
    historico: regra?.historico ?? inicial?.historico ?? "",
    ativo: regra?.ativo ?? inicial?.ativo ?? true,
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const mudar = (parcial: Partial<RascunhoRegra>) => {
    setR((a) => ({ ...a, ...parcial }));
    setErro(null);
  };

  // A mesma normalização do casamento no servidor: sem acento, maiúsculas,
  // espaço colapsado. Contar com outra régua mentiria sobre o que vai casar.
  const normalizadas = useMemo(() => amostra?.map(normalizar), [amostra]);
  const casam = useMemo(() => {
    const t = normalizar(r.termo);
    if (!normalizadas || !t) return null;
    return normalizadas.filter((d) => (r.tipo === "exato" ? d === t : d.includes(t))).length;
  }, [normalizadas, r.termo, r.tipo]);

  async function salvar() {
    if (!r.termo.trim()) return setErro("Informe a descrição que o banco usa.");
    if (r.contaPagamento == null && r.contaRecebimento == null) {
      return setErro("Escolha a conta de pagamento, a de recebimento, ou as duas.");
    }
    setSalvando(true);
    try {
      const res = await mutar<{ id: number }>("/api/contabil/extrato-regras", "POST", {
        id: regra?.id,
        empresa,
        conta,
        termo: r.termo.trim(),
        tipo: r.tipo,
        contaPagamento: r.contaPagamento,
        contaRecebimento: r.contaRecebimento,
        historico: r.historico.trim() || null,
        ativo: r.ativo,
      });
      avisar.ok(regra ? "Regra salva" : "Regra criada");
      await qc.invalidateQueries({ queryKey: ["extrato-regras"] });
      onSalvo?.(res.id);
      onFechar();
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!regra) return;
    setApagando(true);
    try {
      const res = await mutar<{ ok: boolean }>(`/api/contabil/extrato-regras?regra=${regra.id}`, "DELETE");
      if (res.ok) avisar.ok("Regra apagada");
      else avisar.info("A regra já tinha sido apagada");
      await qc.invalidateQueries({ queryKey: ["extrato-regras"] });
      onApagado?.();
      onFechar();
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setApagando(false);
    }
  }

  const ajudaTermo =
    casam == null
      ? undefined
      : casam === 0
        ? "Não casa com nenhuma linha deste extrato."
        : casam === 1
          ? "Casa com 1 linha deste extrato."
          : `Casa com ${num(casam)} linhas deste extrato.`;

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Rotulado rotulo="Descrição no extrato" htmlFor={`${id}-termo`} ajuda={ajudaTermo}>
          <Campo
            id={`${id}-termo`}
            data-autofoco
            value={r.termo}
            onChange={(e) => mudar({ termo: e.target.value })}
            placeholder="Ex.: MAGALHAES"
          />
        </Rotulado>
        <Rotulado rotulo="Casamento">
          <Segmentado<TipoRegra>
            rotulo="Casamento"
            opcoes={[
              { valor: "parcial", rotulo: ROTULO_TIPO.parcial },
              { valor: "exato", rotulo: ROTULO_TIPO.exato },
            ]}
            valor={r.tipo}
            onMudar={(tipo) => mudar({ tipo })}
          />
        </Rotulado>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Rotulado rotulo="Se for pagamento">
          <SeletorConta
            empresa={empresa}
            valor={r.contaPagamento}
            onMudar={(c) => mudar({ contaPagamento: c })}
            limpavel
            placeholder="Sem conta"
            rotuloAcessivel="Contrapartida do pagamento"
          />
        </Rotulado>
        <Rotulado rotulo="Se for recebimento">
          <SeletorConta
            empresa={empresa}
            valor={r.contaRecebimento}
            onMudar={(c) => mudar({ contaRecebimento: c })}
            limpavel
            placeholder="Sem conta"
            rotuloAcessivel="Contrapartida do recebimento"
          />
        </Rotulado>
      </div>
      <Rotulado
        rotulo="Histórico"
        htmlFor={`${id}-historico`}
        ajuda="Vazio, o lançamento leva a descrição do extrato."
      >
        <Campo
          id={`${id}-historico`}
          value={r.historico}
          onChange={(e) => mudar({ historico: e.target.value })}
          placeholder="Descrição do extrato"
        />
      </Rotulado>
      <Alternador ligado={r.ativo} onMudar={(ativo) => mudar({ ativo })} rotulo="Regra ativa" />
      {erro && (
        <Nota tom="perigo" icone="erro">
          {erro}
        </Nota>
      )}
    </form>
  );

  const rodape = (
    <>
      {regra &&
        (confirmando ? (
          <Botao variante="perigo" icone="apagar" carregando={apagando} onClick={apagar} className="mr-auto">
            Confirmar exclusão
          </Botao>
        ) : (
          <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
            Apagar
          </Botao>
        ))}
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="salvar" type="submit" form={id} carregando={salvando}>
        {regra ? "Salvar" : "Criar regra"}
      </Botao>
    </>
  );

  const titulo = regra ? "Editar regra" : "Nova regra";
  const descricao = `Conta ${conta}${descricaoConta ? ` · ${descricaoConta}` : ""}`;

  if (estatico) {
    return (
      <PainelModal estatico titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {corpo}
      </PainelModal>
    );
  }
  return (
    <Modal aberto titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar} fecharNoVeu={false}>
      {corpo}
    </Modal>
  );
}
