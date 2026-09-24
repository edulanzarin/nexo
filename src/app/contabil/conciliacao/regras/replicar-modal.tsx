"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Combo } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { num } from "@/lib/format";
import type { ContaBanco } from "@/lib/types";
import { mutar } from "@/hooks/mutar";
import { useConsulta, useEmpresas } from "@/hooks/use-consulta";

interface Destino {
  /** Chave da linha na lista (a mesma empresa e conta podem aparecer em edição). */
  id: number;
  empresa: number | null;
  conta: number | null;
}

interface ResultadoReplica {
  destino: { empresa: number; conta: number };
  criadas: number;
  atualizadas: number;
}

/**
 * Quais contrapartidas da origem não existem no plano da empresa de destino.
 * Só pergunta para outra empresa: na mesma, o plano é o mesmo.
 */
function Faltantes({ origem, empresa }: { origem: ContaBanco; empresa: number }) {
  const q = useConsulta<{ faltantes: number[] }>(
    "extrato-faltantes",
    `/api/contabil/extrato-regras?empresa=${origem.empresa}&faltantesDe=${origem.conta}&faltantesEm=${empresa}`
  );
  if (q.isError) {
    return (
      <Nota tom="perigo" icone="erro">
        {(q.error as Error).message}
      </Nota>
    );
  }
  if (!q.data?.faltantes.length) return null;
  return (
    <Nota tom="atencao" icone="alerta">
      Não existem no plano desta empresa: {q.data.faltantes.join(", ")}. As regras vão assim mesmo, e essas contas
      precisam de ajuste depois.
    </Nota>
  );
}

/**
 * Copia as regras de uma conta do banco para outras contas, da mesma empresa ou
 * de outras. É o caminho para não recadastrar o mesmo plano em cada empresa.
 *
 * O plano de contas é por empresa, então a cópia leva os mesmos números de
 * contrapartida. Funciona quando as empresas usam o plano padrão do
 * escritório; por isso cada destino de outra empresa mostra, antes de
 * confirmar, as contas que não existem lá.
 */
export function ReplicarModal({ origem, onFechar }: { origem: ContaBanco; onFechar: () => void }) {
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const [destinos, setDestinos] = useState<Destino[]>([{ id: 1, empresa: origem.empresa, conta: null }]);
  const [salvando, setSalvando] = useState(false);

  const opcoesEmpresa = useMemo(
    () => (empresas.data ?? []).map((e) => ({ valor: String(e.codigo), rotulo: e.nome, detalhe: String(e.codigo) })),
    [empresas.data]
  );
  const ehOrigem = (d: Destino) => d.empresa === origem.empresa && d.conta === origem.conta;
  const validos = destinos.filter(
    (d): d is Destino & { empresa: number; conta: number } => d.empresa != null && d.conta != null && !ehOrigem(d)
  );

  const mudar = (id: number, parcial: Partial<Destino>) =>
    setDestinos((lista) => lista.map((d) => (d.id === id ? { ...d, ...parcial } : d)));

  async function replicar() {
    if (!validos.length) return;
    setSalvando(true);
    try {
      const r = await mutar<{ resultado: ResultadoReplica[] }>("/api/contabil/extrato-regras", "POST", {
        acao: "replicar",
        empresa: origem.empresa,
        conta: origem.conta,
        destinos: validos.map((d) => ({ empresa: d.empresa, conta: d.conta })),
      });
      const criadas = r.resultado.reduce((s, x) => s + x.criadas, 0);
      const atualizadas = r.resultado.reduce((s, x) => s + x.atualizadas, 0);
      avisar.ok(
        `Regras replicadas para ${num(validos.length)} ${validos.length === 1 ? "conta" : "contas"}`,
        `${num(criadas)} novas, ${num(atualizadas)} atualizadas`
      );
      await qc.invalidateQueries({ queryKey: ["extrato-regras"] });
      onFechar();
    } catch (e) {
      avisar.erro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const nomeOrigem = origem.apelido || origem.descricao || `conta ${origem.conta}`;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      fecharNoVeu={false}
      titulo="Replicar regras"
      descricao={`${num(origem.regras.length)} ${origem.regras.length === 1 ? "regra" : "regras"} de ${nomeOrigem} (conta ${origem.conta})`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="copiar" carregando={salvando} disabled={!validos.length} onClick={replicar}>
            {validos.length ? `Replicar para ${num(validos.length)}` : "Replicar"}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Nota icone="info">
          As contrapartidas vão com os mesmos números. Entre empresas, isso só acerta quando o plano de contas é o mesmo.
        </Nota>
        <ul className="flex flex-col gap-2">
          {destinos.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 rounded-controle border border-linha bg-poco p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Combo
                  className="w-full sm:w-64"
                  rotuloAcessivel="Empresa de destino"
                  placeholder="Empresa"
                  busca
                  opcoes={opcoesEmpresa}
                  valor={d.empresa != null ? String(d.empresa) : null}
                  onMudar={(v) => mudar(d.id, { empresa: Number(v), conta: null })}
                />
                {d.empresa != null && (
                  <SeletorConta
                    key={d.empresa}
                    empresa={d.empresa}
                    soBanco
                    valor={d.conta}
                    onMudar={(c) => mudar(d.id, { conta: c })}
                    placeholder="Conta do banco"
                    rotuloAcessivel="Conta de destino"
                    className="min-w-0 flex-1 basis-56"
                  />
                )}
                <BotaoIcone
                  icone="apagar"
                  rotulo="Tirar este destino"
                  onClick={() => setDestinos((lista) => lista.filter((x) => x.id !== d.id))}
                />
              </div>
              {ehOrigem(d) && (
                <Nota tom="atencao" icone="alerta">
                  É a própria conta de origem.
                </Nota>
              )}
              {d.empresa != null && d.empresa !== origem.empresa && <Faltantes origem={origem} empresa={d.empresa} />}
            </li>
          ))}
        </ul>
        <div>
          <Botao
            variante="fantasma"
            icone="mais"
            onClick={() =>
              setDestinos((lista) => [
                ...lista,
                { id: Math.max(0, ...lista.map((x) => x.id)) + 1, empresa: origem.empresa, conta: null },
              ])
            }
          >
            Adicionar destino
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
