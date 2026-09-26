"use client";

import Link from "next/link";
import { Esqueleto } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import type { ItemUrgencia } from "@/componentes/produto/folha/pendencias-dp";
import { emDiasTexto, TextoPrazo } from "@/componentes/produto/folha/prazo-dp";
import { cn } from "@/lib/cn";
import { dataHoraBR, num } from "@/lib/format";
import type { AtividadeTi, PainelTiEquipamentos, PendenciaTi, TipoPendenciaTi } from "@/lib/ti-painel-tipos";
import { tipoEquipamento } from "@/lib/ti-tipos";
import { IconeTipo } from "./equipamento";

/*
 * As peças do Painel da TI: a pendência na lista de urgência, o inventário por
 * tipo e a atividade recente dos dois lados (inventário e cofre).
 */

const ROTULO_PENDENCIA: Record<TipoPendenciaTi, string> = {
  recolher: "A recolher",
  licenca: "Licença",
  manutencao: "Manutenção parada",
  senha: "Senha antiga",
  garantia: "Garantia",
};

/** "45 dias", "8 meses", "2 anos": o tempo parado dito na escala que se lê. */
export function tempoDesde(dias: number): string {
  if (dias < 60) return emDiasTexto(dias);
  if (dias < 730) return `${num(Math.floor(dias / 30))} meses`;
  return `${num(Math.floor(dias / 365))} anos`;
}

export const hrefPendencia = (p: Pick<PendenciaTi, "alvo">) => `/ti/${p.alvo.secao}?abrir=${p.alvo.id}`;

/**
 * A pendência como linha da lista de urgência. Garantia e licença falam em
 * prazo ("vence em 12 dias"); o resto fala em tempo parado ("há 45 dias"), que
 * é o que pesa: equipamento com quem saiu há dois meses é mais urgente que o de
 * ontem.
 */
export function itemPendenciaTi(p: PendenciaTi): ItemUrgencia {
  const prazo = p.tipo === "garantia" || p.tipo === "licenca";
  return {
    chave: p.chave,
    href: hrefPendencia(p),
    titulo: p.titulo,
    apoio: `${ROTULO_PENDENCIA[p.tipo]} · ${p.apoio}`,
    direita: prazo ? (
      <TextoPrazo dias={p.dias} atencao={p.dias <= 30} />
    ) : (
      <span className={cn("num text-pequeno whitespace-nowrap", p.tipo === "recolher" ? "text-atencao" : "text-apagado")}>
        há {tempoDesde(p.dias)}
      </span>
    ),
  };
}

const SERIES = [
  { chave: "uso", rotulo: "Em uso", cor: "bg-rota" },
  { chave: "estoque", rotulo: "No estoque", cor: "bg-apagado" },
  { chave: "manutencao", rotulo: "Em manutenção", cor: "bg-atencao" },
] as const;

/**
 * O inventário por tipo, cada barra dividida em uso, estoque e manutenção. A
 * régua é o maior tipo, então a barra também compara os tipos entre si: dá
 * para ver que sobra monitor no estoque e falta notebook.
 */
export function InventarioPorTipo({
  porTipo,
  carregando,
}: {
  porTipo: PainelTiEquipamentos["porTipo"] | undefined;
  carregando?: boolean;
}) {
  if (carregando || !porTipo)
    return (
      <ul aria-busy className="flex flex-col gap-3 px-4 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Esqueleto className="size-7" />
            <Esqueleto className="h-3 w-24" />
            <Esqueleto className="h-2.5 flex-1" />
          </li>
        ))}
      </ul>
    );
  if (!porTipo.length) return <p className="px-4 py-6 text-center text-corpo text-apagado">Nenhum equipamento ativo.</p>;
  const maior = Math.max(...porTipo.map((t) => t.uso + t.estoque + t.manutencao));
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <ul className="flex flex-col gap-2">
        {porTipo.map((t) => {
          const total = t.uso + t.estoque + t.manutencao;
          return (
            <li key={t.tipo} className="flex items-center gap-3">
              <IconeTipo tipo={t.tipo} className="size-7" />
              <span className="w-28 shrink-0 truncate text-corpo text-tinta sm:w-36">{tipoEquipamento(t.tipo).rotulo}</span>
              <span
                className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-poco"
                title={SERIES.map((s) => `${s.rotulo}: ${num(t[s.chave])}`).join(" · ")}
              >
                {SERIES.map((s) =>
                  t[s.chave] ? (
                    <span key={s.chave} className={s.cor} style={{ width: `${(t[s.chave] / maior) * 100}%` }} />
                  ) : null
                )}
              </span>
              <span className="num w-8 shrink-0 text-right text-corpo text-tinta">{num(total)}</span>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-pequeno text-apagado">
        {SERIES.map((s) => (
          <li key={s.chave} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.cor)} />
            {s.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * O que aconteceu por último, no inventário e no cofre, numa lista só. Senha
 * vista aparece no tom de atenção: é a linha que alguém precisa conseguir
 * enxergar de relance.
 */
export function AtividadeRecenteTi({ itens, carregando }: { itens: AtividadeTi[] | undefined; carregando?: boolean }) {
  if (carregando || !itens)
    return (
      <ul aria-busy className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-linha px-4 py-2.5 last:border-0">
            <Esqueleto className="size-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Esqueleto className="h-3 w-40" />
              <Esqueleto className="h-3 w-56" />
            </div>
          </li>
        ))}
      </ul>
    );
  if (!itens.length) return <p className="px-4 py-6 text-center text-corpo text-apagado">Nada aconteceu ainda.</p>;
  return (
    <ul className="flex flex-col">
      {itens.map((a) => {
        const aberto = a.icone === "ver" || a.icone === "copiar";
        const conteudo = (
          <>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full",
                aberto ? "bg-atencao-suave text-atencao" : a.origem === "acessos" ? "bg-poco-forte text-tinta-2" : "bg-rota-suave text-rota"
              )}
            >
              <Icone nome={a.icone} tamanho={14} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-corpo text-tinta">
                <span className="font-[560]">{a.titulo}</span>
                <span className="text-apagado"> · {a.alvo}</span>
              </span>
              <span className="num truncate text-pequeno text-apagado">
                {a.por ?? "Sem sessão"} · {dataHoraBR(a.em)}
              </span>
            </span>
          </>
        );
        return (
          <li key={a.chave} className="border-b border-linha last:border-0">
            {a.alvoId != null ? (
              <Link
                href={`/ti/${a.origem}?abrir=${a.alvoId}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-poco"
              >
                {conteudo}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2.5">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
