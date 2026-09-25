"use client";

import type { ReactNode } from "react";
import { EsqueletoTabela } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Ponto, Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  CATEGORIA_DENUNCIA_ROTULO,
  STATUS_DENUNCIA,
  type DenunciaDashboard,
  type DenunciaResumo,
  type StatusDenuncia,
} from "@/lib/denuncia-tipos";
import { dataHoraBR, horas, num } from "@/lib/format";
import { SeloStatusDenuncia } from "./status-denuncia";

/*
 * A fila do canal de denúncia: os números do canal e a tabela. A linha diz de
 * que se trata e em que pé está, nunca o relato: denúncia é sensível e a fila
 * fica à vista de quem passa pela tela. O relato mora no detalhe.
 */

/**
 * Filtro de situação da fila. As quatro do banco, mais dois que a rota não
 * filtra: "abertas" (duas situações de uma vez) e "aguardando", que não é
 * situação gravada, é quem escreveu por último. Esses dois pedem a lista
 * inteira e filtram no cliente (`filtrarFilaDenuncias`).
 */
export type FiltroSituacaoDenuncia = "todas" | "abertas" | "aguardando" | StatusDenuncia;

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

export const denunciaAberta = (s: StatusDenuncia) => s === "recebida" || s === "em_analise";

/** A situação que vai para a rota (`?status=`), ou nada quando o filtro é do cliente. */
export function statusDaRota(f: FiltroSituacaoDenuncia): StatusDenuncia | null {
  return f === "todas" || f === "abertas" || f === "aguardando" ? null : f;
}

/** Aplica o que a rota não filtra. */
export function filtrarFilaDenuncias(itens: DenunciaResumo[], f: FiltroSituacaoDenuncia): DenunciaResumo[] {
  if (f === "abertas") return itens.filter((d) => denunciaAberta(d.status));
  if (f === "aguardando") return itens.filter((d) => d.aguardandoRh);
  return itens;
}

/** Tempo médio até a primeira resposta: em horas até dois dias, depois em dias. */
export function tempoPrimeiraResposta(h: number): string {
  if (h < 48) return horas(h);
  return plural(Math.round(h / 24), "dia", "dias");
}

/**
 * Os números do canal inteiro, sem o filtro da fila. Novas e aguardando o RH
 * são o que cobra ação e acendem em atenção; zero acende verde, porque fila
 * vazia é um estado bom. Os de situação filtram a fila no clique.
 *
 * Abertas conta como o Painel do RH (recebidas e em análise), para os dois
 * mostrarem o mesmo número.
 */
export function FaixaDenuncias({
  dados,
  carregando,
  onFiltrar,
}: {
  dados: DenunciaDashboard | undefined;
  carregando?: boolean;
  onFiltrar?: (f: FiltroSituacaoDenuncia) => void;
}) {
  const c = carregando || !dados;
  const s = dados?.porStatus;
  const novas = s?.recebida ?? 0;
  const analise = s?.em_analise ?? 0;
  const concluidas = s?.concluida ?? 0;
  const arquivadas = s?.arquivada ?? 0;
  const aguardando = dados?.aguardandoRh ?? 0;
  const h = dados?.horasPrimeiraResposta ?? null;
  const filtrar = (f: FiltroSituacaoDenuncia) => (onFiltrar ? () => onFiltrar(f) : undefined);

  return (
    <FaixaIndicadores colunas={5}>
      <Indicador
        rotulo="Abertas"
        icone="escudo"
        carregando={c}
        valor={num(novas + analise)}
        detalhe={novas + analise > 0 ? `${num(analise)} em análise` : "Nenhuma na fila"}
        tom={dados && novas + analise === 0 ? "ok" : "neutro"}
        onClick={filtrar("abertas")}
      />
      <Indicador
        rotulo="Novas"
        icone="pendente"
        carregando={c}
        valor={num(novas)}
        detalhe={novas > 0 ? "Ainda não abertas pelo RH" : "Nenhuma esperando"}
        tom={dados ? (novas > 0 ? "atencao" : "ok") : "neutro"}
        valorNoTom={novas > 0}
        onClick={filtrar("recebida")}
      />
      <Indicador
        rotulo="Aguardando o RH"
        icone="relogio"
        carregando={c}
        valor={num(aguardando)}
        detalhe="Sem resposta ou com mensagem nova"
        tom={dados ? (aguardando > 0 ? "atencao" : "ok") : "neutro"}
        valorNoTom={aguardando > 0}
        onClick={filtrar("aguardando")}
      />
      <Indicador
        rotulo="Primeira resposta"
        icone="cronometro"
        carregando={c}
        valor={h == null ? "—" : tempoPrimeiraResposta(h)}
        detalhe={h == null ? "Nenhuma respondida ainda" : "Média até o RH responder"}
      />
      <Indicador
        rotulo="Encerradas"
        icone="certo-duplo"
        carregando={c}
        valor={num(concluidas + arquivadas)}
        detalhe={`${plural(concluidas, "concluída", "concluídas")} · ${plural(arquivadas, "arquivada", "arquivadas")}`}
      />
    </FaixaIndicadores>
  );
}

/**
 * De quem é a vez na conversa. A lib só sabe dizer isso das abertas (é o
 * `aguardandoRh`); encerrada não espera ninguém, e aí fica só a contagem.
 */
function VezDaConversa({ d }: { d: DenunciaResumo }) {
  const msgs = d.mensagens > 0 ? plural(d.mensagens, "mensagem", "mensagens") : "Sem conversa";
  if (!denunciaAberta(d.status)) return <span className="num text-apagado">{msgs}</span>;
  return (
    <span className="flex items-center gap-2">
      {d.aguardandoRh ? <Selo tom="atencao">Aguardando o RH</Selo> : <Selo>Respondida</Selo>}
      {d.mensagens > 0 && <span className="num text-pequeno text-apagado">{msgs}</span>}
    </span>
  );
}

const ORDEM_STATUS = Object.fromEntries(STATUS_DENUNCIA.map((s, i) => [s, i])) as Record<StatusDenuncia, number>;

const COLUNAS: Coluna<DenunciaResumo>[] = [
  {
    id: "protocolo",
    cabecalho: "Protocolo",
    ordenar: (d) => d.protocolo,
    celula: (d) => (
      <span className="flex items-center gap-2">
        {/* O ponto reforça o selo da coluna Conversa; sozinho não diz nada. */}
        {d.aguardandoRh ? <Ponto tom="atencao" /> : <span aria-hidden className="size-2 shrink-0" />}
        <span className="num font-[560] text-tinta">{d.protocolo}</span>
      </span>
    ),
  },
  {
    id: "assunto",
    cabecalho: "Assunto",
    largura: "24%",
    ordenar: (d) => CATEGORIA_DENUNCIA_ROTULO[d.categoria],
    celula: (d) => (
      <span className="block truncate" title={CATEGORIA_DENUNCIA_ROTULO[d.categoria]}>
        {CATEGORIA_DENUNCIA_ROTULO[d.categoria]}
      </span>
    ),
  },
  {
    id: "setor",
    cabecalho: "Setor envolvido",
    largura: "20%",
    secundaria: true,
    ordenar: (d) => d.setorEnvolvido,
    celula: (d) =>
      d.setorEnvolvido ? (
        <span className="block truncate" title={d.setorEnvolvido}>
          {d.setorEnvolvido}
        </span>
      ) : (
        <span className="text-apagado">Não informado</span>
      ),
  },
  {
    id: "situacao",
    cabecalho: "Situação",
    ordenar: (d) => ORDEM_STATUS[d.status],
    celula: (d) => <SeloStatusDenuncia status={d.status} />,
  },
  {
    id: "recebida",
    cabecalho: "Recebida em",
    ordenar: (d) => d.criadoEm,
    celula: (d) => <span className="num">{dataHoraBR(d.criadoEm)}</span>,
  },
  {
    id: "conversa",
    cabecalho: "Conversa",
    celula: (d) => <VezDaConversa d={d} />,
  },
  {
    // Toca a cada mensagem nova e a cada troca de situação: é a ordem da fila.
    id: "movimento",
    cabecalho: "Última movimentação",
    secundaria: true,
    ordenar: (d) => d.atualizadoEm,
    celula: (d) => <span className="num text-apagado">{dataHoraBR(d.atualizadoEm)}</span>,
  },
];

/** A tabela da fila. Sem `itens` desenha o esqueleto; lista vazia mostra o `vazio` de quem chama. */
export function TabelaDenuncias({
  itens,
  vazio,
  onAbrir,
  abertaId,
}: {
  itens: DenunciaResumo[] | undefined;
  vazio?: ReactNode;
  onAbrir?: (d: DenunciaResumo) => void;
  abertaId?: number | null;
}) {
  if (!itens) return <EsqueletoTabela colunas={6} linhas={6} />;
  return (
    <TabelaDados
      rotulo="Fila de denúncias"
      colunas={COLUNAS}
      linhas={itens}
      chave={(d) => String(d.id)}
      onLinha={onAbrir}
      selecionada={(d) => d.id === abertaId}
      alturaMax="62vh"
      vazio={vazio}
    />
  );
}
