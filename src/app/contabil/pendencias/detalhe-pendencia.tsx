"use client";

import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Rotulado } from "@/componentes/primitivos/campo";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { DetalheNotaConferida } from "@/componentes/produto/contabil/detalhe-nota-conferida";
import { MarcaNatureza } from "@/componentes/produto/contabil/partida";
import { BlocoDetalhe, DestaqueDetalhe } from "@/componentes/produto/notas/bloco-detalhe";
import { brl, dataBR, dataHoraBR } from "@/lib/format";
import type { LancamentoAchado, Pendencia } from "@/lib/types";

export type Status = "resolvido" | "ignorado" | "reabrir";

/** "2026-08-14 10:32" do Questor vira "14/08/2026 às 10:32". */
function momento(s: string): string {
  return s.length >= 16 ? `${dataBR(s)} às ${s.slice(11, 16)}` : dataBR(s);
}

function Conta({ conta, descr, natureza }: { conta: number | null; descr: string | null; natureza: 1 | -1 }) {
  if (conta == null) return <span className="text-apagado">Sem conta</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <MarcaNatureza natureza={natureza} />
      <span className="num text-tinta">{conta}</span>
      {descr && <span className="truncate text-apagado">{descr}</span>}
    </span>
  );
}

/** O lançamento anômalo da auditoria: a memória de cálculo do achado. */
function CorpoLancamento({ l }: { l: LancamentoAchado }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Par rotulo="Débito">
          <Conta conta={l.contaDeb} descr={l.descrDeb} natureza={1} />
        </Par>
        <Par rotulo="Crédito">
          <Conta conta={l.contaCred} descr={l.descrCred} natureza={-1} />
        </Par>
      </dl>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Par rotulo="Valor">
          <span className="num font-[600]">{brl(l.valor)}</span>
        </Par>
        <Par rotulo="Data do lançamento">
          <span className="num">{dataBR(l.data)}</span>
        </Par>
        <Par rotulo="Origem">
          <span className="num">{l.origem || "Sem origem"}</span>
        </Par>
        <Par rotulo="Digitado em">
          <span className="num">{l.lancadoEm ? momento(l.lancadoEm) : "Sem registro"}</span>
        </Par>
        <Par rotulo="Quem lançou" className="col-span-2">
          {l.usuario ?? "Sem registro"}
        </Par>
        <Par rotulo="Histórico" className="col-span-2">
          <span className="line-clamp-3" title={l.historico ?? undefined}>
            {l.historico ?? "Sem histórico"}
          </span>
        </Par>
      </dl>
    </div>
  );
}

/**
 * A decisão sobre a pendência, dentro do detalhe. Aberta: a observação que vai
 * junto de resolver ou ignorar. Tratada: quem tratou, quando e o que escreveu.
 */
function Triagem({
  p,
  observacao,
  onObservacao,
}: {
  p: Pendencia;
  observacao: string;
  onObservacao: (v: string) => void;
}) {
  const t = p.triagem;
  if (t)
    return (
      <BlocoDetalhe titulo="Triagem">
        <p className="flex flex-wrap items-center gap-2 text-corpo text-tinta-2">
          <Selo tom={t.status === "resolvido" ? "ok" : "neutro"}>{t.status === "resolvido" ? "Resolvida" : "Ignorada"}</Selo>
          por {t.usuario} em <span className="num">{dataHoraBR(t.em)}</span>
        </p>
        {t.observacao && (
          <p className="rounded-controle border border-linha bg-poco px-3 py-2 text-corpo text-tinta-2">{t.observacao}</p>
        )}
      </BlocoDetalhe>
    );
  return (
    <BlocoDetalhe titulo="Triagem">
      <Rotulado rotulo="Observação" htmlFor="triagem-observacao">
        <AreaTexto
          id="triagem-observacao"
          value={observacao}
          onChange={(e) => onObservacao(e.target.value)}
          placeholder="O que foi feito, ou por que não precisa de ação"
          maxLength={500}
        />
      </Rotulado>
    </BlocoDetalhe>
  );
}

/** Os botões da decisão, no rodapé do detalhe. */
function AcoesTriagem({
  p,
  gravando,
  onTriar,
  onFechar,
}: {
  p: Pendencia;
  gravando?: Status;
  onTriar: (s: Status) => void;
  onFechar: () => void;
}) {
  return (
    <>
      <Botao variante="fantasma" onClick={onFechar} className="mr-auto">
        Fechar
      </Botao>
      {p.triagem ? (
        <Botao icone="reabrir" onClick={() => onTriar("reabrir")} carregando={gravando === "reabrir"}>
          Reabrir
        </Botao>
      ) : (
        <>
          <Botao
            icone="ignorado"
            onClick={() => onTriar("ignorado")}
            carregando={gravando === "ignorado"}
            disabled={gravando != null}
          >
            Ignorar
          </Botao>
          <Botao
            variante="primario"
            icone="certo"
            onClick={() => onTriar("resolvido")}
            carregando={gravando === "resolvido"}
            disabled={gravando != null}
          >
            Resolver
          </Botao>
        </>
      )}
    </>
  );
}

/**
 * O detalhe de uma pendência. Nota da conferência abre o mesmo detalhe da
 * Conferência; lançamento da auditoria abre a memória de cálculo dele. Os dois
 * levam a triagem junto: é onde se escreve a observação.
 */
export function DetalhePendencia({
  p,
  empresa,
  observacao,
  onObservacao,
  gravando,
  onTriar,
  onFechar,
}: {
  p: Pendencia | null;
  empresa: number;
  observacao: string;
  onObservacao: (v: string) => void;
  gravando?: Status;
  onTriar: (p: Pendencia, s: Status) => void;
  onFechar: () => void;
}) {
  const triagem = p ? <Triagem p={p} observacao={observacao} onObservacao={onObservacao} /> : null;
  const acoes = p ? <AcoesTriagem p={p} gravando={gravando} onTriar={(s) => onTriar(p, s)} onFechar={onFechar} /> : null;

  if (p?.fonte === "conferencia" && p.nota)
    return (
      <DetalheNotaConferida
        nota={p.nota}
        tipo={p.lado ?? "ent"}
        empresa={empresa}
        onFechar={onFechar}
        extra={triagem}
        rodape={acoes}
      />
    );

  const l = p?.lancamento;
  return (
    <Modal
      aberto={p != null}
      onFechar={onFechar}
      largura="g"
      titulo={p?.titulo ?? ""}
      descricao={l ? `Lançamento ${l.chave} · ${dataBR(l.data)}` : undefined}
      rodape={acoes}
    >
      {p && (
        <div className="flex flex-col gap-4">
          {l?.detalhe && (
            <DestaqueDetalhe tom={p.severidade === "alta" ? "perigo" : "atencao"} icone="alerta" titulo="O Que a Auditoria Achou">
              {l.detalhe}
            </DestaqueDetalhe>
          )}
          {l ? <CorpoLancamento l={l} /> : <p className="text-corpo text-apagado">{p.descricao}</p>}
          {triagem}
        </div>
      )}
    </Modal>
  );
}
