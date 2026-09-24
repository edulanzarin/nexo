"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { Esqueleto, EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { RegraExtratoModal, ROTULO_TIPO } from "@/componentes/produto/contabil/regra-extrato";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { num } from "@/lib/format";
import type { ContaBanco, RegraExtratoDTO } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { useContaBanco } from "../use-conta-banco";
import { ReplicarModal } from "./replicar-modal";

const COLUNAS: Coluna<RegraExtratoDTO>[] = [
  {
    id: "termo",
    cabecalho: "Descrição no extrato",
    ordenar: (r) => r.termoOriginal,
    celula: (r) => (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-tinta" title={r.termoOriginal}>
          {r.termoOriginal}
        </span>
        {!r.ativo && <Selo icone="ignorado">Pausada</Selo>}
      </span>
    ),
  },
  {
    id: "tipo",
    cabecalho: "Casamento",
    largura: "110px",
    ordenar: (r) => r.tipo,
    celula: (r) => <span className="text-apagado">{ROTULO_TIPO[r.tipo]}</span>,
  },
  {
    id: "pagamento",
    cabecalho: "Se for pagamento",
    largura: "26%",
    ordenar: (r) => r.contaPagamento,
    celula: (r) => <ContaTexto conta={r.contaPagamento} descricao={r.descrPagamento} />,
  },
  {
    id: "recebimento",
    cabecalho: "Se for recebimento",
    largura: "26%",
    ordenar: (r) => r.contaRecebimento,
    celula: (r) => <ContaTexto conta={r.contaRecebimento} descricao={r.descrRecebimento} />,
  },
  {
    id: "historico",
    cabecalho: "Histórico",
    largura: "18%",
    secundaria: true,
    celula: (r) =>
      r.historico ? (
        <span className="block truncate" title={r.historico}>
          {r.historico}
        </span>
      ) : (
        <span className="text-apagado italic">Do extrato</span>
      ),
  },
];

/**
 * Regras do extrato: para cada descrição que o banco usa, a contrapartida do
 * pagamento e a do recebimento. Não existe passo de "adicionar conta": a conta
 * do banco vem do plano do Questor e o cadastro nasce com a primeira regra.
 *
 * A conta escolhida é a mesma da aba Importar (ver `useContaBanco`): o caminho
 * comum é chegar aqui vindo do extrato lido, para cadastrar o que não casou.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const [conta, setConta] = useContaBanco(empresa);
  const [busca, setBusca] = useEstadoTela(`busca\u0000${empresa}`, "");
  const [janela, setJanela] = useState<{ regra: RegraExtratoDTO | null } | null>(null);
  const [replicando, setReplicando] = useState(false);

  // Contas que já têm cadastro: atalho para ir de uma a outra.
  const lista = useConsulta<ContaBanco[]>("extrato-regras", `/api/contabil/extrato-regras?empresa=${empresa}`);
  const atual = useConsulta<ContaBanco>(
    "extrato-regras",
    conta != null ? `/api/contabil/extrato-regras?empresa=${empresa}&conta=${conta}` : null,
    // Trocar de conta não pode mostrar as regras da anterior enquanto carrega.
    { manterAnterior: false }
  );

  const visiveis = useMemo(() => {
    const regras = atual.data?.regras ?? [];
    const t = normalizar(busca.trim());
    if (!t) return regras;
    return regras.filter((r) =>
      normalizar(
        [r.termoOriginal, r.contaPagamento, r.contaRecebimento, r.descrPagamento, r.descrRecebimento, r.historico]
          .filter((x) => x != null)
          .join(" ")
      ).includes(t)
    );
  }, [atual.data, busca]);

  const total = atual.data?.regras.length ?? 0;

  return (
    <>
      {atual.data && total > 0 && (
        <AcoesPagina>
          <MenuExportar
            modulo="contabil"
            cortes={[
              {
                id: "regras",
                rotulo: "Regras da conta",
                nome: `regras_extrato_${empresa}_${atual.data.conta}`,
                montar: () => ({
                  cabecalhos: [
                    "Descrição no extrato",
                    "Casamento",
                    "Conta do pagamento",
                    "Descrição do pagamento",
                    "Conta do recebimento",
                    "Descrição do recebimento",
                    "Histórico",
                    "Ativa",
                  ],
                  linhas: visiveis.map((r) => [
                    r.termoOriginal,
                    ROTULO_TIPO[r.tipo],
                    r.contaPagamento,
                    r.descrPagamento,
                    r.contaRecebimento,
                    r.descrRecebimento,
                    r.historico,
                    r.ativo ? "Sim" : "Não",
                  ]),
                }),
              },
            ]}
          />
        </AcoesPagina>
      )}

      <Painel corpo="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Rotulado rotulo="Conta do banco" className="w-full sm:w-[380px]">
            <SeletorConta
              empresa={empresa}
              soBanco
              valor={conta}
              onMudar={(c) => setConta(c)}
              placeholder="Conta do banco no plano"
              rotuloAcessivel="Conta do banco"
            />
          </Rotulado>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {atual.data && total > 0 && (
              <Botao icone="copiar" onClick={() => setReplicando(true)}>
                Replicar
              </Botao>
            )}
            <Botao
              variante="primario"
              icone="mais"
              disabled={conta == null}
              title={conta == null ? "Escolha a conta do banco" : undefined}
              onClick={() => setJanela({ regra: null })}
            >
              Nova regra
            </Botao>
          </div>
        </div>
        {lista.isLoading ? (
          <Esqueleto className="h-controle w-2/3" />
        ) : lista.data?.length ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-pequeno text-apagado">Com regra</span>
            {lista.data.map((c) => (
              <Botao
                key={c.conta}
                variante={c.conta === conta ? "secundario" : "fantasma"}
                aria-pressed={c.conta === conta}
                onClick={() => setConta(c.conta)}
              >
                <span className="num text-pequeno text-apagado">{c.conta}</span>
                <span className="max-w-56 truncate">{c.apelido || c.descricao || `Conta ${c.conta}`}</span>
                <span className="num text-micro text-apagado">{num(c.regras.length)}</span>
              </Botao>
            ))}
          </div>
        ) : null}
      </Painel>

      {lista.isError && (
        <PainelErro
          titulo="Não deu para carregar as contas com regra"
          mensagem={(lista.error as Error).message}
          onTentar={() => lista.refetch()}
        />
      )}

      {conta == null ? (
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="banco"
            titulo="Escolha a conta do banco"
            descricao={
              lista.data?.length
                ? "Cada conta tem as próprias regras. Escolha no plano ou numa das contas com regra."
                : "Nenhuma conta desta empresa tem regra ainda. Escolha a conta do banco no plano e cadastre a primeira."
            }
          />
        </div>
      ) : atual.isError ? (
        <PainelErro mensagem={(atual.error as Error).message} onTentar={() => atual.refetch()} />
      ) : !atual.data ? (
        <Painel corpo="p-0" titulo="Regras">
          <EsqueletoTabela colunas={4} linhas={6} />
        </Painel>
      ) : total === 0 ? (
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="etiquetas"
            titulo="Nenhuma regra nesta conta"
            descricao="Cadastre a descrição que o banco usa e a contrapartida de cada sentido. A linha do extrato que não casou também vira regra, na aba Importar."
            acao={
              <Botao icone="mais" onClick={() => setJanela({ regra: null })}>
                Nova regra
              </Botao>
            }
          />
        </div>
      ) : (
        <Painel
          corpo="p-0"
          titulo="Regras"
          descricao={`${num(total)} ${total === 1 ? "regra" : "regras"}${busca.trim() ? ` · ${num(visiveis.length)} na busca` : ""}`}
          acoes={
            <Campo
              icone="buscar"
              placeholder="Termo, conta ou histórico"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-64"
              aria-label="Buscar nas regras"
            />
          }
          rodape={
            <Nota>
              Quando duas regras casam, exato ganha de contém e, entre as que contêm, ganha o termo mais longo.
            </Nota>
          }
        >
          <TabelaDados
            rotulo="Regras da conta"
            colunas={COLUNAS}
            linhas={visiveis}
            chave={(r) => String(r.id)}
            onLinha={(r) => setJanela({ regra: r })}
            alturaMax="min(66dvh, 720px)"
            vazio={
              <Vazio compacto icone="filtrar" titulo="Nenhuma regra com esse termo" descricao="Afrouxe a busca." />
            }
          />
        </Painel>
      )}

      {conta != null && (
        <RegraExtratoModal
          aberto={janela != null}
          empresa={empresa}
          conta={conta}
          descricaoConta={atual.data?.descricao}
          regra={janela?.regra}
          onFechar={() => setJanela(null)}
        />
      )}

      {replicando && atual.data && <ReplicarModal origem={atual.data} onFechar={() => setReplicando(false)} />}
    </>
  );
}
