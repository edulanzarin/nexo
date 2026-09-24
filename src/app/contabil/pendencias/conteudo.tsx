"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useCasca } from "@/componentes/casca/casca-cliente";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Ponto, Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { brl, dataBR, dataHoraBR, num } from "@/lib/format";
import type { FontePendencia, Pendencia, PendenciasResp, TriagemInfo } from "@/lib/types";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { DetalhePendencia, type Status } from "./detalhe-pendencia";

type Aba = "abertas" | "tratadas" | "todas";
type Fonte = "todas" | FontePendencia;

const FONTE: Record<FontePendencia, { rotulo: string; icone: "conferencia" | "lupa" }> = {
  conferencia: { rotulo: "Conferência", icone: "conferencia" },
  auditoria: { rotulo: "Auditoria", icone: "lupa" },
};

/** Teto de linhas desenhadas: a fila de um mês ruim passa de mil. */
const MAX_LINHAS = 400;

/** Identidade estável do achado: o tipo entra, então uma nota que muda de problema volta a abrir. */
const idDe = (p: Pendencia) => `${p.fonte}|${p.chave}|${p.tipo}`;

/**
 * Aplica a triagem gravada na fila que está na tela, sem refazer a varredura:
 * montar a fila roda a conferência dos dois lados e a auditoria do período, e
 * esperar isso a cada clique travaria a triagem de uma fila longa. O resumo é
 * recontado com a mesma regra da lib (abertas são as sem triagem).
 */
function aplicarTriagem(d: PendenciasResp, id: string, triagem: TriagemInfo | null): PendenciasResp {
  const itens = d.itens.map((i) => (idDe(i) === id ? { ...i, triagem } : i));
  const abertas = itens.filter((i) => !i.triagem);
  return {
    ...d,
    itens,
    resumo: {
      total: itens.length,
      abertas: abertas.length,
      tratadas: itens.length - abertas.length,
      valorAberto: abertas.reduce((s, i) => s + i.valor, 0),
      alta: abertas.filter((i) => i.severidade === "alta").length,
    },
  };
}

/** Botão de decisão dentro da linha: a altura da linha (26px), não a do controle. */
function BotaoLinha({
  icone,
  rotulo,
  variante = "fantasma",
  gravando,
  desabilitado,
  onClick,
}: {
  icone: "certo" | "ignorado" | "reabrir";
  rotulo: string;
  variante?: "secundario" | "fantasma";
  gravando?: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <Botao
      variante={variante}
      icone={icone}
      carregando={gravando}
      disabled={desabilitado}
      onClick={onClick}
      className="h-controle-p rounded-chip px-2 text-pequeno"
    >
      {rotulo}
    </Botao>
  );
}

export default function ConteudoPendencias() {
  const { qs } = useExecucao();
  const { usuario } = useCasca();
  const qc = useQueryClient();
  const empresa = Number(new URLSearchParams(qs ?? "").get("empresas"));
  const [aba, setAba] = useEstadoTela<Aba>("aba", "abertas");
  const [fonte, setFonte] = useEstadoTela<Fonte>("fonte", "todas");
  // Linhas gravando agora, com o que cada uma está gravando: a fila continua
  // clicável enquanto uma triagem vai para o servidor.
  const [gravando, setGravando] = useState<Record<string, Status>>({});
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const url = qs ? `/api/contabil/pendencias?${qs}` : null;
  const res = useConsulta<PendenciasResp>("pendencias", url);
  const dados = res.data;
  const itens = useMemo(() => dados?.itens ?? [], [dados]);

  const filtrados = useMemo(
    () =>
      itens.filter((i) => {
        if (aba === "abertas" && i.triagem) return false;
        if (aba === "tratadas" && !i.triagem) return false;
        return fonte === "todas" || i.fonte === fonte;
      }),
    [itens, aba, fonte]
  );
  const visiveis = filtrados.slice(0, MAX_LINHAS);
  // A pendência aberta é lida da fila atual: depois de triar, o detalhe mostra
  // o estado novo sem precisar fechar.
  const aberta = abertaId ? (itens.find((i) => idDe(i) === abertaId) ?? null) : null;

  const porFonte = useMemo(() => {
    const abertas = itens.filter((i) => !i.triagem);
    return {
      conferencia: abertas.filter((i) => i.fonte === "conferencia").length,
      auditoria: abertas.filter((i) => i.fonte === "auditoria").length,
    };
  }, [itens]);

  async function triar(p: Pendencia, status: Status, obs?: string) {
    const id = idDe(p);
    setGravando((g) => ({ ...g, [id]: status }));
    try {
      await mutar("/api/contabil/pendencias/triagem", "POST", {
        empresa,
        fonte: p.fonte,
        chave: p.chave,
        tipo: p.tipo,
        status,
        observacao: obs?.trim() || undefined,
      });
      const triagem: TriagemInfo | null =
        status === "reabrir"
          ? null
          : { status, observacao: obs?.trim() || null, usuario: usuario.nome, em: new Date().toISOString() };
      // Outras cargas da fila (outro período) ficam velhas e refazem quando
      // voltarem à tela; a que está aberta recebe a triagem direto.
      await qc.invalidateQueries({ queryKey: ["pendencias"], refetchType: "none" });
      qc.setQueryData<PendenciasResp>(["pendencias", url], (d) => (d ? aplicarTriagem(d, id, triagem) : d));
      avisar.ok(
        status === "resolvido" ? "Pendência resolvida" : status === "ignorado" ? "Pendência ignorada" : "Pendência reaberta",
        p.descricao
      );
      if (status !== "reabrir" && abertaId === id) setAbertaId(null);
    } catch (e) {
      avisar.erro("Não deu para gravar a triagem", (e as Error).message);
    } finally {
      setGravando((g) => {
        const n = { ...g };
        delete n[id];
        return n;
      });
    }
  }

  const abrir = (p: Pendencia) => {
    setObservacao("");
    setAbertaId(idDe(p));
  };

  const colunas: Coluna<Pendencia>[] = [
    {
      id: "severidade",
      cabecalho: "Severidade",
      largura: "104px",
      celula: (p) => (
        <span className="flex items-center gap-1.5">
          <Ponto tom={p.severidade === "alta" ? "perigo" : "atencao"} />
          {p.severidade === "alta" ? "Alta" : "Média"}
        </span>
      ),
    },
    {
      id: "pendencia",
      classe: "max-w-0",
      cabecalho: "Pendência",
      largura: "300px",
      celula: (p) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-[560] text-tinta" title={p.titulo}>
            {p.titulo}
          </span>
          <Selo icone={FONTE[p.fonte].icone} className="shrink-0">
            {FONTE[p.fonte].rotulo}
          </Selo>
        </span>
      ),
    },
    {
      id: "descricao",
      classe: "max-w-0",
      cabecalho: "Nota ou lançamento",
      celula: (p) => (
        <span className="block truncate text-apagado" title={p.descricao}>
          {p.descricao}
        </span>
      ),
    },
    {
      id: "data",
      cabecalho: "Data",
      largura: "96px",
      secundaria: true,
      celula: (p) => <span className="num">{p.data ? dataBR(p.data) : ""}</span>,
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "130px",
      classe: "font-[600] text-tinta",
      celula: (p) => brl(p.valor),
    },
    {
      id: "triagem",
      cabecalho: "Triagem",
      alinhar: "dir",
      largura: "236px",
      celula: (p) => {
        const id = idDe(p);
        const g = gravando[id];
        const t = p.triagem;
        return (
          // Os botões decidem ali mesmo: o clique (e o Enter) não pode vazar
          // para a linha e abrir o detalhe.
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {t ? (
              <>
                <Selo
                  tom={t.status === "resolvido" ? "ok" : "neutro"}
                  title={`Por ${t.usuario} em ${dataHoraBR(t.em)}${t.observacao ? `. ${t.observacao}` : ""}`}
                >
                  {t.status === "resolvido" ? "Resolvida" : "Ignorada"}
                </Selo>
                <BotaoLinha icone="reabrir" rotulo="Reabrir" gravando={g === "reabrir"} onClick={() => triar(p, "reabrir")} />
              </>
            ) : (
              <>
                <BotaoLinha
                  icone="certo"
                  rotulo="Resolver"
                  variante="secundario"
                  gravando={g === "resolvido"}
                  desabilitado={g != null}
                  onClick={() => triar(p, "resolvido")}
                />
                <BotaoLinha
                  icone="ignorado"
                  rotulo="Ignorar"
                  gravando={g === "ignorado"}
                  desabilitado={g != null}
                  onClick={() => triar(p, "ignorado")}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para montar a fila"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  const r = dados?.resumo;
  const rotuloAba = (rotulo: string, n: number | undefined) => (
    <>
      {rotulo}
      {n != null && <span className="num text-apagado">{num(n)}</span>}
    </>
  );

  let vazio: ReactNode;
  if (itens.length === 0)
    vazio = (
      <Vazio
        icone="escudo"
        titulo="Nada pendente no período"
        descricao="A conferência e a auditoria não acharam exceção nesta empresa."
      />
    );
  else if (fonte !== "todas")
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo={`Nada da ${FONTE[fonte].rotulo.toLowerCase()} nesta aba`}
        descricao="Volte para todas as fontes ou troque a aba."
        acao={<Botao onClick={() => setFonte("todas")}>Ver todas as fontes</Botao>}
      />
    );
  else if (aba === "abertas")
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Nenhuma pendência aberta"
        descricao="Tudo o que a conferência e a auditoria acharam já foi tratado."
        acao={<Botao onClick={() => setAba("tratadas")}>Ver as tratadas</Botao>}
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="fila"
        titulo="Nenhuma pendência tratada ainda"
        descricao="Resolva ou ignore as abertas e elas passam para cá."
        acao={<Botao onClick={() => setAba("abertas")}>Ver as abertas</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="contabil"
          desabilitado={!dados}
          cortes={[
            {
              id: "fila",
              rotulo: "Fila",
              nome: `pendencias-${aba}`,
              montar: () => ({
                cabecalhos: ["Fonte", "Pendência", "Severidade", "Nota ou lançamento", "Data", "Valor", "Triagem", "Por", "Em", "Observação"],
                linhas: filtrados.map((p) => [
                  FONTE[p.fonte].rotulo,
                  p.titulo,
                  p.severidade === "alta" ? "Alta" : "Média",
                  p.descricao,
                  p.data ? dataBR(p.data) : "",
                  p.valor,
                  p.triagem ? (p.triagem.status === "resolvido" ? "Resolvida" : "Ignorada") : "Aberta",
                  p.triagem?.usuario ?? "",
                  p.triagem ? dataHoraBR(p.triagem.em) : "",
                  p.triagem?.observacao ?? "",
                ]),
              }),
            },
          ]}
        />
      </AcoesPagina>

      <FaixaIndicadores>
        {!r ? (
          Array.from({ length: 5 }).map((_, i) => <Indicador key={i} rotulo="Carregando" valor="" detalhe="" carregando />)
        ) : (
          <>
            <Indicador
              rotulo="Abertas"
              icone="fila"
              valor={num(r.abertas)}
              detalhe={`${num(r.alta)} de severidade alta`}
              tom={r.alta > 0 ? "perigo" : r.abertas > 0 ? "atencao" : "neutro"}
              valorNoTom
              onClick={() => setAba("abertas")}
            />
            <Indicador rotulo="Valor em aberto" icone="moedas" valor={brl(r.valorAberto)} detalhe="soma das não tratadas" />
            <Indicador
              rotulo="Da conferência"
              icone="conferencia"
              valor={num(porFonte.conferencia)}
              detalhe="notas abertas com problema"
              onClick={() => {
                setAba("abertas");
                setFonte("conferencia");
              }}
            />
            <Indicador
              rotulo="Da auditoria"
              icone="lupa"
              valor={num(porFonte.auditoria)}
              detalhe="lançamentos abertos com anomalia"
              onClick={() => {
                setAba("abertas");
                setFonte("auditoria");
              }}
            />
            <Indicador
              rotulo="Tratadas"
              icone="certo-duplo"
              valor={num(r.tratadas)}
              detalhe="resolvidas ou ignoradas"
              onClick={() => setAba("tratadas")}
            />
          </>
        )}
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Fila"
        descricao={
          dados ? (
            <span className="inline-flex items-center gap-1.5">
              Severidade alta e maior valor primeiro
              {res.isFetching && <Girando />}
            </span>
          ) : (
            "Reunindo a conferência e a auditoria do período"
          )
        }
        acoes={
          <>
            <Segmentado
              rotulo="Fonte"
              opcoes={[
                { valor: "todas", rotulo: "Todas as fontes" },
                { valor: "conferencia", rotulo: "Conferência", icone: "conferencia" },
                { valor: "auditoria", rotulo: "Auditoria", icone: "lupa" },
              ]}
              valor={fonte}
              onMudar={setFonte}
            />
            <Segmentado
              rotulo="Estado da triagem"
              opcoes={[
                { valor: "abertas", rotulo: rotuloAba("Abertas", r?.abertas) },
                { valor: "tratadas", rotulo: rotuloAba("Tratadas", r?.tratadas) },
                { valor: "todas", rotulo: rotuloAba("Todas", r?.total) },
              ]}
              valor={aba}
              onMudar={setAba}
            />
          </>
        }
        rodape={
          filtrados.length > MAX_LINHAS ? (
            <Nota>
              Mostrando {num(MAX_LINHAS)} de {num(filtrados.length)}. Trate as primeiras, ou exporte a fila inteira.
            </Nota>
          ) : undefined
        }
      >
        {!dados ? (
          <EsqueletoTabela colunas={6} />
        ) : (
          <TabelaDados
            rotulo="Fila de pendências"
            colunas={colunas}
            linhas={visiveis}
            chave={idDe}
            onLinha={abrir}
            selecionada={(p) => idDe(p) === abertaId}
            alturaMax="62vh"
            vazio={vazio}
          />
        )}
      </Painel>

      <DetalhePendencia
        p={aberta}
        empresa={empresa}
        observacao={observacao}
        onObservacao={setObservacao}
        gravando={aberta ? gravando[idDe(aberta)] : undefined}
        onTriar={(p, s) => triar(p, s, s === "reabrir" ? undefined : observacao)}
        onFechar={() => setAbertaId(null)}
      />
    </>
  );
}
