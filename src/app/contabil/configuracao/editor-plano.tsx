"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador, Caixa } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota, Vazio } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type { PlanoCfop } from "@/lib/types";
import { mutar } from "@/hooks/mutar";

/** Lançamento em edição. */
interface LinhaEdit {
  id: number;
  natureza: 1 | -1;
  conta: number | null;
  variavel: boolean;
  /** Origem da conta no Questor (0 = fixa; outra = do fornecedor ou cliente). */
  origemConta: number;
  /**
   * A fórmula do valor ("vlrContabil-vlrIPI-vlrICMS") não tem campo na tela,
   * mas viaja junto: salvar o override sem ela trocaria o valor que a
   * conferência espera daquela linha.
   */
  regraValor: string | null;
  rotulo: string;
}

function doPlano(plano: PlanoCfop): LinhaEdit[] {
  return plano.componentes
    .flatMap((c) =>
      c.linhas.map((l) => ({
        natureza: l.natureza,
        conta: l.conta,
        variavel: l.contaVariavel,
        origemConta: l.origemConta,
        regraValor: l.regraValor,
        rotulo: l.descrConta ?? c.rotulo,
      }))
    )
    .map((l, i) => ({ ...l, id: i }));
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  // O plano muda o que a conferência cobra de todas as notas daquele CFOP, e a
  // Central de Pendências é montada em cima da conferência.
  qc.invalidateQueries({ queryKey: ["plano"] });
  qc.invalidateQueries({ queryKey: ["conferencia"] });
  qc.invalidateQueries({ queryKey: ["pendencias"] });
}

/**
 * O override de um CFOP. Abre com o plano vigente (do Questor ou do override
 * já salvo); salvar passa a valer no lugar do Questor para esta empresa e este
 * estabelecimento.
 */
export function EditorPlano({
  empresa,
  plano,
  rotuloEstab,
  onFechar,
}: {
  empresa: number;
  plano: PlanoCfop;
  /** "matriz" ou "filial 0002": o código do estabelecimento sozinho não diz nada. */
  rotuloEstab: string;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [contabiliza, setContabiliza] = useState(plano.contabiliza);
  const [linhas, setLinhas] = useState<LinhaEdit[]>(() => doPlano(plano));
  const [observacao, setObservacao] = useState(plano.observacao ?? "");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState<"salvar" | "reverter" | null>(null);

  const alterar = (id: number, mudanca: Partial<LinhaEdit>) =>
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));

  const adicionar = () =>
    setLinhas((atual) => [
      ...atual,
      {
        id: atual.reduce((m, l) => Math.max(m, l.id), -1) + 1,
        natureza: 1,
        conta: null,
        variavel: false,
        origemConta: 0,
        regraValor: null,
        rotulo: "",
      },
    ]);

  const semConta = (l: LinhaEdit) => !l.variavel && l.conta == null;
  const erro = !tentou
    ? null
    : contabiliza && linhas.length === 0
      ? "Adicione ao menos um lançamento, ou desligue a contabilização."
      : contabiliza && linhas.some(semConta)
        ? `Escolha a conta ${linhas.filter(semConta).length === 1 ? "do lançamento marcado" : "dos lançamentos marcados"}.`
        : null;

  async function salvar() {
    setTentou(true);
    if (contabiliza && (linhas.length === 0 || linhas.some(semConta))) return;
    setSalvando("salvar");
    try {
      // CFOP que não contabiliza guarda só as linhas completas: a rota recusa
      // linha sem conta, e as linhas voltam a valer se alguém religar.
      const enviar = contabiliza ? linhas : linhas.filter((l) => !semConta(l));
      await mutar("/api/contabil/plano", "PUT", {
        empresa,
        estab: plano.estab,
        cfop: plano.cfop,
        contabiliza,
        observacao: observacao.trim() || null,
        linhas: enviar.map((l) => ({
          natureza: l.natureza,
          conta: l.variavel ? null : l.conta,
          // Conta variável que veio do Questor mantém a origem dele (fornecedor
          // ou cliente); a marcada aqui vira a do participante da nota.
          origemConta: l.variavel ? l.origemConta || 2 : 0,
          regraValor: l.regraValor,
          rotulo: l.rotulo.trim() || null,
        })),
      });
      avisar.ok(`Plano do CFOP ${plano.cfop} salvo`, "A conferência passa a cobrar esta regra.");
      invalidar(qc);
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para salvar", (e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function reverter() {
    setSalvando("reverter");
    try {
      const p = new URLSearchParams({ empresa: String(empresa), estab: String(plano.estab), cfop: String(plano.cfop) });
      await mutar(`/api/contabil/plano?${p}`, "DELETE");
      avisar.ok(`CFOP ${plano.cfop} voltou ao plano do Questor`);
      invalidar(qc);
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para voltar ao plano do Questor", (e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="g"
      fecharNoVeu={false}
      titulo={`CFOP ${plano.cfop}`}
      descricao={[rotuloEstab, plano.lado === "ent" ? "entrada" : "saída", plano.descricao].filter(Boolean).join(" · ")}
      rodape={
        <>
          <div className="mr-auto">
            {plano.origem === "override" ? (
              <Botao variante="fantasma" icone="desfazer" onClick={reverter} carregando={salvando === "reverter"} disabled={salvando != null}>
                Voltar ao plano do Questor
              </Botao>
            ) : (
              <Nota>Hoje segue o plano do Questor.</Nota>
            )}
          </div>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="salvar" onClick={salvar} carregando={salvando === "salvar"} disabled={salvando != null}>
            Salvar override
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-controle border border-linha bg-poco px-3.5 py-3">
          <Alternador ligado={contabiliza} onMudar={setContabiliza} rotulo="Gera lançamento contábil" />
          <p className="pl-10 text-pequeno text-apagado">
            Desligue para remessa, retorno, comodato e afins: a conferência deixa de cobrar lançamento dessas notas.
          </p>
        </div>

        {plano.origem !== "override" && plano.aprendido && (
          <Nota icone="historico">
            Nos últimos 12 meses, {num(plano.aprendido.contabilizadas)} de {num(plano.aprendido.notas)} notas deste CFOP
            foram lançadas.
          </Nota>
        )}

        {contabiliza && (
          <section className="flex flex-col gap-2">
            <header className="flex items-center justify-between gap-2">
              <h3 className="text-pequeno font-[600] text-tinta-2">Lançamentos esperados</h3>
              <Botao variante="fantasma" icone="mais" onClick={adicionar}>
                Adicionar lançamento
              </Botao>
            </header>
            {linhas.length === 0 ? (
              <div className="rounded-controle border border-dashed border-linha-forte">
                <Vazio
                  compacto
                  icone="calculadora"
                  titulo="Nenhum lançamento"
                  descricao="Cada lançamento diz a conta e o lado que a nota deste CFOP movimenta."
                />
              </div>
            ) : (
              linhas.map((l, i) => (
                <div
                  key={l.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-controle border bg-poco p-2",
                    tentou && semConta(l) ? "border-perigo/50" : "border-linha"
                  )}
                >
                  {/* Binário: alternar num clique é melhor que abrir uma lista. */}
                  <Segmentado
                    rotulo={`Lado do lançamento ${i + 1}`}
                    opcoes={[
                      { valor: "1", rotulo: "Débito" },
                      { valor: "-1", rotulo: "Crédito" },
                    ]}
                    valor={String(l.natureza) as "1" | "-1"}
                    onMudar={(v) => alterar(l.id, { natureza: v === "1" ? 1 : -1 })}
                  />
                  <SeletorConta
                    empresa={empresa}
                    valor={l.variavel ? null : l.conta}
                    onMudar={(conta, dados) =>
                      alterar(l.id, { conta, ...(dados && !l.rotulo.trim() ? { rotulo: dados.descricao } : {}) })
                    }
                    desabilitado={l.variavel}
                    placeholder={l.variavel ? "Conta do fornecedor ou cliente da nota" : "Escolher conta"}
                    rotuloAcessivel={`Conta do lançamento ${i + 1}`}
                    className="min-w-64 flex-1"
                  />
                  <Caixa
                    marcada={l.variavel}
                    onMudar={(v) => alterar(l.id, { variavel: v })}
                    rotulo="Variável"
                  />
                  <Campo
                    placeholder="Rótulo (ICMS, mercadoria)"
                    className="w-48"
                    value={l.rotulo}
                    onChange={(e) => alterar(l.id, { rotulo: e.target.value })}
                    aria-label={`Rótulo do lançamento ${i + 1}`}
                  />
                  <BotaoIcone
                    icone="apagar"
                    rotulo="Tirar este lançamento"
                    onClick={() => setLinhas((atual) => atual.filter((x) => x.id !== l.id))}
                  />
                </div>
              ))
            )}
          </section>
        )}

        <Rotulado rotulo="Observação" htmlFor="plano-observacao">
          <Campo
            id="plano-observacao"
            placeholder="Por que este CFOP foge do plano do Questor"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </Rotulado>

        {erro && (
          <Nota tom="perigo" icone="erro">
            {erro}
          </Nota>
        )}
      </div>
    </Modal>
  );
}
