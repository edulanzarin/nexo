"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota } from "@/componentes/primitivos/estados";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { dataHoraBR, num } from "@/lib/format";
import { mutar } from "@/hooks/mutar";
import { URL_CARTEIRA, URL_GRUPOS, useEstadoCarteira, useGruposAcessorias } from "./filtros";

/**
 * Chama o fim de uma varredura uma vez: quando o estado passa de "rodando" para
 * parado, quem depende do dado recarrega sozinho. Pedir que a pessoa aperte
 * Executar de novo seria esconder que o que ela está vendo já é o dado velho.
 */
function useAoTerminar(rodando: boolean, aoTerminar: () => void) {
  const estava = useRef(false);
  const fim = useRef(aoTerminar);
  useEffect(() => {
    fim.current = aoTerminar;
  });
  useEffect(() => {
    if (rodando) {
      estava.current = true;
      return;
    }
    if (!estava.current) return;
    estava.current = false;
    fim.current();
  }, [rodando]);
}

function Medidas({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</dl>;
}

/**
 * O estado da carteira do Acessórias, com o botão que a atualiza, e os grupos
 * de empresa de lá no mesmo painel.
 *
 * Mora na tela, e não só no job da madrugada: o dado de dois minutos atrás e o
 * de três semanas atrás se parecem na tela e não valem o mesmo. Quem lê o
 * relatório precisa ver a idade da fonte antes de acreditar nela, e poder
 * corrigi-la ali mesmo.
 *
 * As duas varreduras são separadas porque têm tamanhos diferentes: a carteira
 * leva uns dois minutos e meio (páginas de 20, teto de requisições por minuto);
 * os grupos, uns treze (o Acessórias não devolve o grupo junto da empresa, então
 * é uma pergunta por grupo). O POST abre a varredura e volta na hora; quem
 * acompanha é a consulta que pergunta de três em três segundos.
 */
export function PainelAcessorias({ semCarteira }: { semCarteira: boolean }) {
  const qc = useQueryClient();
  const carteira = useEstadoCarteira();
  const grupos = useGruposAcessorias();
  const [enviando, setEnviando] = useState<"carteira" | "grupos" | null>(null);

  const estado = carteira.data;
  const rodando = estado?.rodando ?? null;
  const estadoGrupos = grupos.data?.estado;
  const rodandoGrupos = estadoGrupos?.rodando ?? null;
  const semGrupos = !!estadoGrupos && estadoGrupos.grupos === 0;

  useAoTerminar(rodando != null, () => {
    qc.invalidateQueries({ queryKey: ["contabil-fechamento"] });
    qc.invalidateQueries({ queryKey: ["analistas-carteira"] });
    avisar.ok("Carteira do Acessórias atualizada");
  });
  useAoTerminar(rodandoGrupos != null, () => {
    qc.invalidateQueries({ queryKey: ["contabil-fechamento"] });
    avisar.ok("Grupos do Acessórias atualizados");
  });

  async function atualizar(qual: "carteira" | "grupos") {
    setEnviando(qual);
    try {
      const r = await mutar<{ iniciada: boolean }>(qual === "carteira" ? URL_CARTEIRA : URL_GRUPOS, "POST");
      if (qual === "carteira") {
        if (r.iniciada) avisar.ok("Buscando a carteira", "Leva cerca de dois minutos e meio.");
        else avisar.info("Já há uma varredura da carteira em curso");
        qc.invalidateQueries({ queryKey: ["carteira-acessorias"] });
      } else {
        if (r.iniciada) avisar.ok("Buscando os grupos", "Leva cerca de treze minutos.");
        else avisar.info("Já há uma varredura de grupos em curso");
        qc.invalidateQueries({ queryKey: ["grupos-acessorias"] });
      }
    } catch (e) {
      avisar.erro("Não deu para chamar o Acessórias", (e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Painel
      titulo="Carteira do Acessórias"
      descricao="De onde vem o analista responsável por cada empresa"
      icone="banco"
      acoes={
        <Botao
          icone="atualizar"
          carregando={enviando === "carteira" || rodando != null}
          disabled={!estado && !carteira.isError}
          onClick={() => atualizar("carteira")}
        >
          {rodando ? "Buscando" : semCarteira ? "Buscar carteira" : "Atualizar"}
        </Botao>
      }
    >
      <div className="flex flex-col gap-4">
        {semCarteira && !rodando && (
          <p className="max-w-3xl text-corpo text-tinta-2">
            Sem a carteira o NaveX sabe quais empresas fecharam, mas não de quem elas são: o responsável mora no
            Acessórias. A busca percorre a carteira inteira em cerca de dois minutos e meio, e o relatório monta
            sozinho no fim.
          </p>
        )}
        {carteira.isError && <Nota tom="perigo">{(carteira.error as Error).message}</Nota>}
        {estado?.erro && (
          <Nota tom="perigo" icone="erro">
            A última varredura terminou mal: {estado.erro}
          </Nota>
        )}
        <Medidas>
          <Par rotulo="Atualizada em">
            <span className="num">{estado?.atualizadoEm ? dataHoraBR(estado.atualizadoEm) : estado ? "Nunca" : "—"}</span>
          </Par>
          <Par rotulo="Empresas ativas">
            <span className="num">{estado ? num(estado.empresas) : "—"}</span>
          </Par>
          <Par rotulo="Com par no Questor">
            <span className="num">{estado ? num(estado.casadas) : "—"}</span>
            {estado && (
              <span className="num block text-pequeno text-apagado">
                {num(estado.empresas - estado.casadas)} só no Acessórias
              </span>
            )}
          </Par>
          <Par rotulo="Com responsável no Contábil">
            <span className="num">{estado ? num(estado.comResponsavel) : "—"}</span>
          </Par>
        </Medidas>
        {rodando && (
          <Nota icone="carregando">
            Página {num(rodando.paginas)}, desde {dataHoraBR(rodando.desde)}.
          </Nota>
        )}

        <section className="flex flex-col gap-4 border-t border-linha pt-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-corpo font-[600] text-tinta">Grupos de empresa</h3>
              <p className="text-pequeno text-apagado">
                O grupo como o Acessórias mantém, que alimenta o filtro de grupo desta aba. O grupo do topo é o do
                NaveX.
              </p>
            </div>
            <Botao
              icone="atualizar"
              carregando={enviando === "grupos" || rodandoGrupos != null}
              disabled={!estadoGrupos && !grupos.isError}
              onClick={() => atualizar("grupos")}
            >
              {rodandoGrupos ? "Buscando" : semGrupos ? "Buscar grupos" : "Atualizar"}
            </Botao>
          </header>
          {semGrupos && !rodandoGrupos && (
            <p className="max-w-3xl text-corpo text-tinta-2">
              Ainda não foram buscados. A empresa não traz o grupo na API, então é uma pergunta por grupo: cerca de
              treze minutos. Depois o filtro fica pronto e o job noturno o mantém.
            </p>
          )}
          {grupos.isError && <Nota tom="perigo">{(grupos.error as Error).message}</Nota>}
          {estadoGrupos?.erro && (
            <Nota tom="perigo" icone="erro">
              A última varredura de grupos terminou mal: {estadoGrupos.erro}
            </Nota>
          )}
          <Medidas>
            <Par rotulo="Atualizados em">
              <span className="num">
                {estadoGrupos?.atualizadoEm ? dataHoraBR(estadoGrupos.atualizadoEm) : estadoGrupos ? "Nunca" : "—"}
              </span>
            </Par>
            <Par rotulo="Grupos">
              <span className="num">{estadoGrupos ? num(estadoGrupos.grupos) : "—"}</span>
            </Par>
            <Par rotulo="Empresas em grupo">
              <span className="num">{estadoGrupos ? num(estadoGrupos.vinculos) : "—"}</span>
            </Par>
            <Par rotulo="Fora da carteira">
              <span className="num">{estadoGrupos ? num(estadoGrupos.foraDaCarteira) : "—"}</span>
              <span className="block text-pequeno text-apagado">Estão num grupo e não na carteira</span>
            </Par>
          </Medidas>
          {rodandoGrupos && (
            <Nota icone="carregando">
              Grupo {num(rodandoGrupos.grupos)}, desde {dataHoraBR(rodandoGrupos.desde)}.
            </Nota>
          )}
        </section>
      </div>
    </Painel>
  );
}
