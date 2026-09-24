"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Abas } from "@/componentes/primitivos/abas";
import {
  AguardandoExecucao,
  BotaoExecutar,
  CabecalhoPagina,
  EscolhaEmpresa,
} from "@/componentes/produto/pagina";
import { qsSoContexto } from "@/lib/contexto";
import type { ModuloId } from "@/lib/modulos";
import { useContexto } from "@/hooks/use-contexto";
import { limparEstadoModulo } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import { registrarVisita } from "@/hooks/use-visitas";
import { BarraLateral } from "./barra-lateral";
import { BarraTopo } from "./barra-topo";
import { useCasca } from "./casca-cliente";
import { Paleta } from "./paleta";

const SlotAcoes = createContext<HTMLElement | null>(null);

/**
 * Ações próprias da tela no cabeçalho (exportar, entradas/saídas), ao lado do
 * Executar. A tela declara onde está; a moldura decide onde aparece.
 */
export function AcoesPagina({ children }: { children: ReactNode }) {
  const slot = useContext(SlotAcoes);
  return slot ? createPortal(children, slot) : null;
}

/**
 * A moldura de todo módulo: barra lateral, topo com o contexto, cabeçalho da
 * seção, abas e o portão de execução. A tela recebe o espaço já decidido: se
 * falta a empresa, ela nem monta; se é de botão e ainda não rodou, quem aparece
 * é o convite para executar.
 */
export function MolduraModulo({ moduloId, children }: { moduloId: ModuloId; children: ReactNode }) {
  const { usuario, acessos } = useCasca();
  const visiveis = acessos[moduloId] ?? [];
  const modulosAcessiveis = Object.keys(acessos) as ModuloId[];

  // O estado de trabalho (extrato lido, resultado executado) vale pelo módulo.
  useEffect(() => () => limparEstadoModulo(`/${moduloId}`), [moduloId]);

  return (
    <div className="flex min-h-dvh">
      <BarraLateral
        moduloId={moduloId}
        visiveis={visiveis}
        modulosAcessiveis={modulosAcessiveis}
        usuario={usuario}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraTopo />
        <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 pt-5 pb-12 sm:px-6">
          <Corpo>{children}</Corpo>
        </main>
      </div>
      <Paleta />
    </div>
  );
}

function Corpo({ children }: { children: ReactNode }) {
  const { local, contexto } = useContexto();
  const exec = useExecucao();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const secao = local?.secao;
  const aba = local?.aba;

  const empresa = contexto.empresas.length === 1 ? contexto.empresas[0] : undefined;
  const qsVisita = qsSoContexto(contexto);
  useEffect(() => {
    if (!secao || !local) return;
    registrarVisita({
      path: secao.path,
      rotulo: secao.rotulo,
      modulo: local.modulo.id,
      icone: secao.icone,
      qs: qsVisita,
      empresa,
      quando: Date.now(),
    });
    // A visita conta pela seção e pela empresa; trocar só o período não é outra visita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secao?.path, empresa]);

  useEffect(() => {
    if (secao) document.title = `${aba && secao.abas.length > 1 ? `${aba.rotulo} · ` : ""}${secao.rotulo} · NaveX`;
  }, [secao, aba]);

  if (!secao) return <>{children}</>;

  const qs = qsSoContexto(contexto);
  const abas = secao.abas;

  let conteudo: ReactNode;
  if (exec.falta) conteudo = <EscolhaEmpresa />;
  else if (!exec.imediata && !exec.pronto)
    conteudo = <AguardandoExecucao rotulo={exec.rotulo} onExecutar={exec.executar} />;
  else conteudo = children;

  return (
    <SlotAcoes.Provider value={slot}>
      <div key={secao.path} className="nx-entra flex flex-col gap-4">
        <CabecalhoPagina
          titulo={secao.rotulo}
          descricao={aba?.descricao ?? secao.descricao}
          acoes={
            <>
              <div ref={setSlot} className="contents" />
              {!exec.imediata && (
                <BotaoExecutar
                  rotulo={exec.rotulo}
                  onExecutar={exec.executar}
                  executando={exec.pronto && exec.buscando}
                  desatualizado={exec.desatualizado}
                  desabilitado={exec.falta}
                />
              )}
            </>
          }
        />
        {abas.length > 1 && (
          <Abas
            rotulo={secao.rotulo}
            ativa={aba?.id ?? abas[0].id}
            itens={abas.map((a) => ({ chave: a.id, rotulo: a.rotulo, href: `${a.path}${qs ? `?${qs}` : ""}` }))}
          />
        )}
        <div className="flex min-w-0 flex-col gap-4">{conteudo}</div>
      </div>
    </SlotAcoes.Provider>
  );
}
