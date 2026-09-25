"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { FaixaIndicadores, Indicador, type Tom } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { num } from "@/lib/format";
import type { PainelEsocial, PainelFerias, PainelRescisoes } from "@/lib/painel-dp-tipos";
import { linkEsocial, linkFerias, linkRescisoes } from "@/lib/painel-links";

/*
 * As peças de pendência dos dois painéis do DP (o da equipe e o meu). As três
 * pendências são as mesmas nos dois, recortadas pelo escopo da sessão no
 * servidor, então nascem uma vez aqui.
 *
 * Cada bloco do painel é uma consulta independente no servidor: a que falha
 * chega `null`, e o buraco diz o que faltou naquele pedaço em vez de derrubar
 * a tela inteira.
 */

/** Título de um bloco do painel, com a informação de apoio à direita. */
export function TituloBlocoDp({ titulo, apoio }: { titulo: ReactNode; apoio?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
      <h2 className="text-medio font-[600] text-tinta">{titulo}</h2>
      {apoio && <span className="num text-pequeno text-apagado">{apoio}</span>}
    </div>
  );
}

/** Bloco inteiro que não veio do servidor, com o jeito de pedir de novo. */
export function BlocoIndisponivelDp({ titulo, onTentar }: { titulo: string; onTentar?: () => void }) {
  return (
    <div className="nx-vidro rounded-painel">
      <Vazio
        compacto
        icone="alerta"
        titulo={titulo}
        descricao="A consulta deste bloco falhou no servidor."
        acao={
          onTentar && (
            <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
              Tentar de novo
            </Botao>
          )
        }
      />
    </div>
  );
}

/** O pior caso manda no tom: vencido é perigo, pendente é atenção, nada é bom. */
function tomPendencia(pior: number, alguma: number): Tom {
  return pior > 0 ? "perigo" : alguma > 0 ? "atencao" : "ok";
}

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

export interface PendenciasDp {
  rescisoes: PainelRescisoes | null;
  ferias: PainelFerias | null;
  esocial: PainelEsocial | null;
}

/**
 * As três pendências do DP numa faixa só: rescisões a pagar, férias vencidas e
 * eSocial rejeitado. Cada número leva à tela que resolve, já executada no
 * recorte que o painel contou (`ap=1`). O tom é o do pior caso, e zero acende
 * a lâmpada verde: nada pendente é um estado bom, e ele aparece.
 */
export function FaixaPendenciasDp({
  dados,
  hoje,
  carregando,
}: {
  dados?: PendenciasDp;
  /** Fim do período do painel. Os links abrem as telas com a janela contada até ele. */
  hoje?: string;
  carregando?: boolean;
}) {
  const r = dados?.rescisoes;
  const f = dados?.ferias;
  const e = dados?.esocial;
  const pronto = !carregando && dados != null;
  const link = (montar: (hoje: string) => string) => (pronto && hoje ? montar(hoje) : undefined);

  return (
    <FaixaIndicadores colunas={3}>
      <Indicador
        rotulo="Rescisões a pagar"
        icone="recibo"
        carregando={carregando}
        href={link(linkRescisoes)}
        valor={r ? num(r.pendentes) : "—"}
        detalhe={
          r
            ? `${plural(r.vencidas, "vencida", "vencidas")} · ${plural(r.venceBreve, "vence", "vencem")} em breve`
            : "Indisponível agora"
        }
        tom={r ? tomPendencia(r.vencidas, r.pendentes) : "neutro"}
        valorNoTom={r != null && r.pendentes > 0}
      />
      <Indicador
        rotulo="Férias vencidas"
        icone="calendario"
        carregando={carregando}
        href={link(linkFerias)}
        valor={f ? num(f.vencidas) : "—"}
        detalhe={f ? `${plural(f.aVencer, "funcionário", "funcionários")} a vencer em 120 dias` : "Indisponível agora"}
        tom={f ? tomPendencia(f.vencidas, f.aVencer) : "neutro"}
        valorNoTom={f != null && f.vencidas > 0}
      />
      <Indicador
        rotulo="eSocial rejeitado"
        icone="escudo"
        carregando={carregando}
        href={link(linkEsocial)}
        valor={e ? num(e.rejeitados) : "—"}
        detalhe={e ? `${num(e.pendentes)} sem recibo · últimos 90 dias` : "Indisponível agora"}
        tom={e ? tomPendencia(e.rejeitados, e.pendentes) : "neutro"}
        valorNoTom={e != null && e.rejeitados > 0}
      />
    </FaixaIndicadores>
  );
}

/** Uma linha de lista de urgência: quem, onde e o prazo à direita. */
export interface ItemUrgencia {
  chave: string;
  href: string;
  titulo: string;
  apoio: string;
  direita: ReactNode;
}

/**
 * Lista curta dos casos mais urgentes, cada um levando à tela que resolve com a
 * empresa já escolhida. Lista vazia é o estado bom ("nenhuma pendente"), e
 * lista que falhou no servidor (`null`) é indisponível, nunca vazia.
 */
export function ListaUrgencias({
  titulo,
  descricao,
  acoes,
  itens,
  carregando,
  vazio,
  onTentar,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  itens: ItemUrgencia[] | null | undefined;
  carregando?: boolean;
  /** Título do estado bom, quando não há nada pendente. */
  vazio: string;
  onTentar?: () => void;
  className?: string;
}) {
  let corpo: ReactNode;
  if (carregando) {
    corpo = (
      <ul aria-busy className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-linha px-4 py-2.5 last:border-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Esqueleto className="h-3 w-48" />
              <Esqueleto className="h-3 w-64" />
            </div>
            <Esqueleto className="h-3 w-24" />
          </li>
        ))}
      </ul>
    );
  } else if (!itens) {
    corpo = (
      <Vazio
        compacto
        icone="alerta"
        titulo="Lista indisponível"
        descricao="A consulta desta lista falhou no servidor."
        acao={
          onTentar && (
            <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
              Tentar de novo
            </Botao>
          )
        }
      />
    );
  } else if (!itens.length) {
    corpo = <Vazio compacto icone="ok" titulo={vazio} />;
  } else {
    corpo = (
      <ul className="flex flex-col">
        {itens.map((i) => (
          <li key={i.chave} className="border-b border-linha last:border-0">
            <Link
              href={i.href}
              className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-poco"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-corpo text-tinta" title={i.titulo}>
                  {i.titulo}
                </p>
                <p className="truncate text-pequeno text-apagado" title={i.apoio}>
                  {i.apoio}
                </p>
              </div>
              <span className="shrink-0 text-pequeno">{i.direita}</span>
              <Icone
                nome="chevron-direita"
                tamanho={14}
                className="text-apagado transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Painel titulo={titulo} descricao={descricao} acoes={acoes} corpo="p-0" className={className}>
      {corpo}
    </Painel>
  );
}
