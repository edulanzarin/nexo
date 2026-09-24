"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Partida } from "@/componentes/produto/contabil/partida";
import { num } from "@/lib/format";
import type { ReplicarItem, ReplicarPreviewResp, ReplicarResp } from "@/lib/types";
import { mutar } from "@/hooks/mutar";
import { useConsulta, useEmpresas } from "@/hooks/use-consulta";

/**
 * Copiar os overrides da empresa aberta para outra: escolhe o destino, marca
 * todos ou só alguns CFOPs e replica. Override com conta fixa que não existe
 * no plano de contas do destino fica travado: replicar cobraria lá uma conta
 * que a empresa não tem.
 */
export function ReplicarModal({
  origem,
  aberto,
  onFechar,
}: {
  origem: number;
  aberto: boolean;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const empresas = useEmpresas();
  const [destino, setDestino] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  // Guarda os DESMARCADOS: começa tudo marcado, o caso comum é replicar tudo.
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const origemNome = empresas.data?.find((e) => e.codigo === origem)?.nome ?? `empresa ${origem}`;
  const opcoesDestino = useMemo<Opcao[]>(
    () =>
      (empresas.data ?? [])
        .filter((e) => e.codigo !== origem)
        .map((e) => ({ valor: String(e.codigo), rotulo: e.nome, detalhe: String(e.codigo) })),
    [empresas.data, origem]
  );

  const url = aberto && destino != null ? `/api/contabil/plano/replicar?origem=${origem}&destino=${destino}` : null;
  const preview = useConsulta<ReplicarPreviewResp>("plano-replicar", url, { manterAnterior: false });
  const itens = useMemo(() => preview.data?.itens ?? [], [preview.data]);

  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return itens;
    return itens.filter((i) => String(i.cfop).includes(q) || normalizar(i.descricao ?? "").includes(q));
  }, [itens, busca]);
  const replicaveis = itens.filter((i) => !i.contasAusentes.length);
  const escolhidos = replicaveis.filter((i) => !desmarcados.has(i.cfop));
  const todos = escolhidos.length === replicaveis.length;

  const alternar = (cfop: number) =>
    setDesmarcados((s) => {
      const n = new Set(s);
      if (n.has(cfop)) n.delete(cfop);
      else n.add(cfop);
      return n;
    });

  async function replicar() {
    if (destino == null || !escolhidos.length) return;
    setEnviando(true);
    try {
      const r = await mutar<ReplicarResp>("/api/contabil/plano/replicar", "POST", {
        origem,
        destino,
        cfops: escolhidos.map((i) => i.cfop),
      });
      avisar.ok(
        `${num(r.replicados)} ${r.replicados === 1 ? "override replicado" : "overrides replicados"}`,
        r.pulados.length
          ? `${num(r.pulados.length)} ${r.pulados.length === 1 ? "ficou" : "ficaram"} de fora por conta que não existe no destino.`
          : undefined
      );
      // O destino ganhou regras: o plano e a conferência de quem estiver com
      // ele aberto passam a cobrar as novas.
      qc.invalidateQueries({ queryKey: ["plano"] });
      qc.invalidateQueries({ queryKey: ["plano-replicar"] });
      qc.invalidateQueries({ queryKey: ["conferencia"] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para replicar", (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const colunas: Coluna<ReplicarItem>[] = [
    {
      id: "marcar",
      cabecalho: <span className="sr-only">Replicar</span>,
      largura: "44px",
      celula: (i) => (
        // A linha inteira alterna; a caixa não pode alternar de novo no mesmo clique.
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Caixa
            marcada={!i.contasAusentes.length && !desmarcados.has(i.cfop)}
            desabilitada={i.contasAusentes.length > 0}
            onMudar={() => alternar(i.cfop)}
            rotulo={<span className="sr-only">Replicar o CFOP {i.cfop}</span>}
          />
        </span>
      ),
    },
    {
      id: "cfop",
      cabecalho: "CFOP",
      largura: "72px",
      celula: (i) => <span className="num font-[600] text-tinta">{i.cfop}</span>,
    },
    {
      id: "descricao",
      classe: "max-w-0",
      cabecalho: "Descrição",
      celula: (i) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate" title={i.descricao ?? undefined}>
            {i.descricao ?? "Sem descrição"}
          </span>
          {i.contasAusentes.length > 0 ? (
            <Selo
              tom="perigo"
              icone="bloqueado"
              title={`Estas contas não existem no plano de contas do destino: ${i.contasAusentes.join(", ")}`}
            >
              {i.contasAusentes.length === 1 ? `Conta ${i.contasAusentes[0]} falta no destino` : `${i.contasAusentes.length} contas faltam no destino`}
            </Selo>
          ) : (
            i.jaExiste && (
              <Selo tom="atencao" title="O destino já tem override para este CFOP">
                Substitui o existente
              </Selo>
            )
          )}
        </span>
      ),
    },
    {
      id: "lancamentos",
      classe: "max-w-0",
      cabecalho: "Lançamentos",
      largura: "45%",
      celula: (i) =>
        !i.contabiliza ? (
          <Selo>Não contabiliza</Selo>
        ) : (
          <span className="flex items-center gap-1 overflow-hidden">
            {i.linhas.map((l, k) => (
              <Partida key={k} natureza={l.natureza} conta={l.conta} variavel={l.contaVariavel} />
            ))}
          </span>
        ),
    },
  ];

  let corpo: ReactNode;
  if (destino == null)
    corpo = (
      <Vazio
        compacto
        icone="empresa"
        titulo="Escolha a empresa de destino"
        descricao="A lista mostra os overrides desta empresa e o que impede cada um de ir."
      />
    );
  else if (preview.isError)
    corpo = <PainelErro mensagem={(preview.error as Error).message} onTentar={() => preview.refetch()} />;
  else if (!preview.data) corpo = <EsqueletoTabela linhas={5} colunas={4} />;
  else if (itens.length === 0)
    corpo = <Vazio compacto icone="copiar" titulo="Esta empresa não tem override para replicar" />;
  else
    corpo = (
      <div className="overflow-hidden rounded-controle border border-linha">
        <TabelaDados
          rotulo="Overrides para replicar"
          colunas={colunas}
          linhas={visiveis}
          chave={(i) => String(i.cfop)}
          onLinha={(i) => !i.contasAusentes.length && alternar(i.cfop)}
          alturaMax="46vh"
          vazio={<p className="py-6 text-center text-corpo text-apagado italic">Nenhum CFOP com esse filtro.</p>}
        />
      </div>
    );

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      largura="g"
      titulo="Replicar overrides"
      descricao={`De ${origemNome} para outra empresa`}
      corpo="flex flex-col gap-3"
      rodape={
        <>
          <span className="num mr-auto text-pequeno text-apagado">
            {destino == null
              ? "Nenhum destino escolhido"
              : `${num(escolhidos.length)} de ${num(replicaveis.length)} ${replicaveis.length === 1 ? "selecionado" : "selecionados"}`}
          </span>
          <Botao variante="fantasma" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            icone="copiar"
            onClick={replicar}
            carregando={enviando}
            disabled={destino == null || !escolhidos.length}
          >
            Replicar
          </Botao>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <Rotulado rotulo="Destino" className="w-80">
          <Combo
            opcoes={opcoesDestino}
            valor={destino != null ? String(destino) : null}
            onMudar={(v) => {
              setDestino(Number(v));
              setDesmarcados(new Set());
            }}
            placeholder={empresas.isLoading ? "Carregando empresas" : "Escolher empresa"}
            icone="empresa"
            rotuloAcessivel="Empresa de destino"
            larguraMin={380}
          />
        </Rotulado>
        <Campo
          icone="buscar"
          placeholder="CFOP ou descrição"
          classeCaixa="w-56"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
        />
        {destino != null && replicaveis.length > 0 && (
          <Botao
            variante="fantasma"
            icone={todos ? "menos" : "certo-duplo"}
            onClick={() => setDesmarcados(todos ? new Set(replicaveis.map((i) => i.cfop)) : new Set())}
          >
            {todos ? "Desmarcar todos" : "Marcar todos"}
          </Botao>
        )}
      </div>
      <Nota icone="info">No destino, cada override entra como regra geral, valendo para todos os estabelecimentos.</Nota>
      {corpo}
    </Modal>
  );
}
