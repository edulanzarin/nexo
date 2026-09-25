"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import type { RodadaResumo, StatusRodada } from "@/lib/clima-tipos";
import { dataBR, num } from "@/lib/format";
import { LinkPublico } from "./link-publico";

const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

/** Aberta recebe respostas; encerrada parou. O banco chama de "fechada". */
export function SeloRodada({ status, className }: { status: StatusRodada; className?: string }) {
  return (
    <Selo tom={status === "aberta" ? "ok" : "neutro"} className={className}>
      {status === "aberta" ? "Aberta" : "Encerrada"}
    </Selo>
  );
}

/** "Aberta em 12/09/2026" ou "De 12/09/2026 a 30/09/2026". */
export function periodoRodada(r: RodadaResumo): string {
  return r.status === "aberta" || !r.fechadoEm
    ? `Aberta em ${dataBR(r.abertoEm)}`
    : `De ${dataBR(r.abertoEm)} a ${dataBR(r.fechadoEm)}`;
}

/**
 * A rodada em trabalho: escolhida no próprio painel (a lista diz quantas
 * respostas cada uma tem e quais pararam), a situação, abrir ou encerrar, e o
 * link. Aberta mostra o endereço para divulgar; encerrada diz que o link parou,
 * e as duas voltam com um clique, porque encerrar não apaga nada.
 */
export function PainelRodada({
  rodadas,
  rodada,
  onEscolher,
  onAlternar,
  alternando,
}: {
  rodadas: RodadaResumo[];
  rodada: RodadaResumo;
  onEscolher: (id: number) => void;
  onAlternar?: () => void;
  alternando?: boolean;
}) {
  const aberta = rodada.status === "aberta";
  return (
    <Painel>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Combo
            className="w-full sm:w-80"
            larguraMin={320}
            rotuloAcessivel="Rodada"
            icone="coracao"
            opcoes={rodadas.map((r) => ({
              valor: String(r.id),
              rotulo: r.titulo,
              detalhe:
                r.status === "aberta"
                  ? plural(r.respostas, "resposta", "respostas")
                  : `encerrada · ${plural(r.respostas, "resposta", "respostas")}`,
            }))}
            valor={String(rodada.id)}
            onMudar={(v) => onEscolher(Number(v))}
          />
          <span className="flex items-center gap-2">
            <SeloRodada status={rodada.status} />
            <span className="num text-pequeno text-apagado">{periodoRodada(rodada)}</span>
          </span>
          {onAlternar && (
            <Botao
              className="sm:ml-auto"
              icone={aberta ? "bloqueado" : "reabrir"}
              carregando={alternando}
              onClick={onAlternar}
            >
              {aberta ? "Encerrar rodada" : "Reabrir rodada"}
            </Botao>
          )}
        </div>
        {aberta ? (
          <Rotulado rotulo="Link para divulgar">
            <LinkPublico caminho={`/clima/${rodada.slug}`} />
          </Rotulado>
        ) : (
          <Nota icone="bloqueado">Rodada encerrada. O link não aceita novas respostas.</Nota>
        )}
      </div>
    </Painel>
  );
}
