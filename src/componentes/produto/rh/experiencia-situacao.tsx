"use client";

import Link from "next/link";
import { Icone } from "@/componentes/primitivos/icone";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { STATUS_ROTULO, rotuloMarco, type Marco, type StatusExperiencia } from "@/lib/rh-experiencia";

/*
 * A situação de um marco de experiência como a lib a deriva
 * (`montarPainelExperiencia`): respondido manda; vencido sem resposta é atraso
 * pela DATA, mesmo que o job ainda não tenha mandado o lembrete atrasado; o
 * resto é o que o banco guarda (o formulário já saiu, ou ainda não).
 *
 * Aguardando resposta leva o tom de rota, e não o de atenção: o formulário está
 * com os gestores e no prazo, nada a fazer. Atenção fica para o que pede mão
 * (setor sem gestor), perigo para o vencido.
 */
export const TOM_EXPERIENCIA: Record<StatusExperiencia, Tom> = {
  pendente: "neutro",
  enviado: "rota",
  atraso: "perigo",
  respondido: "ok",
};

export function SeloExperiencia({ status, className }: { status: StatusExperiencia; className?: string }) {
  return (
    <Selo tom={TOM_EXPERIENCIA[status]} className={className}>
      {STATUS_ROTULO[status]}
    </Selo>
  );
}

/** O marco (45 ou 90 dias) é fato do item, sem tom: a urgência é do prazo e da situação. */
export function SeloMarco({ marco, className }: { marco: Marco; className?: string }) {
  return <Selo className={className}>{rotuloMarco(marco)}</Selo>;
}

/**
 * Setor e cargo numa célula só, o setor primeiro: é ele que decide quem recebe
 * o formulário. Quando falta espaço, a reticência come o cargo.
 */
export function SetorCargo({ setor, cargo }: { setor: string | null; cargo: string | null }) {
  const titulo = [setor ?? "Sem setor", cargo].filter(Boolean).join(" · ");
  return (
    <span className="block truncate" title={titulo}>
      {setor ?? <span className="text-apagado">Sem setor</span>}
      {cargo && <span className="text-apagado"> · {cargo}</span>}
    </span>
  );
}

/**
 * Quantos gestores do setor recebem o link. Zero quer dizer que o formulário
 * não sai para ninguém, e é a causa mais comum de avaliação parada; por isso o
 * aviso já leva ao cadastro de Gestores, onde se resolve. Serve a Experiência e
 * o Desempenho, que mandam para os mesmos gestores.
 *
 * O clique no aviso não vaza para a linha da tabela, que abre o detalhe.
 */
export function GestoresSetor({ n, className }: { n: number; className?: string }) {
  if (n > 0)
    return (
      <span className={cn("num", className)}>
        {num(n)} {n === 1 ? "gestor" : "gestores"}
      </span>
    );
  return (
    <Link
      href="/rh/gestores"
      title="Cadastrar gestor no setor"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap text-atencao hover:underline", className)}
    >
      <Icone nome="alerta" tamanho={14} className="size-3.5" />
      Sem gestor
    </Link>
  );
}
