"use client";

import { useMemo, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { num } from "@/lib/format";
import type { FolhaMovimentacao } from "@/lib/types";
import { TabelaPessoas } from "./tabela-pessoas";

/**
 * O que a lista mostra. Três vistas leem a mesma consulta (quem entrou ou saiu
 * no período) e só recortam na tela; o efetivo é outra consulta, a de quem
 * estava ativo no último dia.
 */
export type VistaPessoas = "todos" | "admitidos" | "desligados" | "efetivo";

/** O `escopo` da rota de movimentações para a vista escolhida. */
export const vistaEhEfetivo = (v: VistaPessoas) => v === "efetivo";

export function filtrarVista(linhas: FolhaMovimentacao[], vista: VistaPessoas): FolhaMovimentacao[] {
  if (vista === "admitidos") return linhas.filter((m) => m.admitido);
  if (vista === "desligados") return linhas.filter((m) => m.desligado);
  return linhas;
}

const VAZIO_DA_VISTA: Record<VistaPessoas, string> = {
  todos: "Ninguém entrou nem saiu no período",
  admitidos: "Nenhuma admissão no período",
  desligados: "Nenhum desligamento no período",
  efetivo: "Nenhum funcionário ativo no fim do período",
};

function Contagem({ n }: { n: number | undefined }) {
  return n == null ? null : <span className="num text-micro text-apagado">{num(n)}</span>;
}

/**
 * Quem entrou e saiu no período, ou o efetivo no último dia, num painel só: são
 * duas perguntas sobre a mesma equipe, e a troca é um clique no cabeçalho, sem
 * rolar a tela atrás de outra lista. Cada linha abre a ficha.
 *
 * A contagem ao lado de cada vista vem de quem chama (os números do topo da
 * tela), então aparece antes de a lista daquela vista ser buscada.
 */
export function PainelMovimentacoes({
  vista,
  onVista,
  linhas,
  erro,
  onTentar,
  contagens,
  onAbrir,
  selecionada,
  className,
}: {
  vista: VistaPessoas;
  onVista: (v: VistaPessoas) => void;
  /** Indefinido enquanto carrega. */
  linhas: FolhaMovimentacao[] | undefined;
  erro?: string | null;
  onTentar?: () => void;
  contagens?: { admitidos: number; desligados: number; efetivo: number };
  onAbrir?: (m: FolhaMovimentacao) => void;
  selecionada?: (m: FolhaMovimentacao) => boolean;
  className?: string;
}) {
  const [busca, setBusca] = useEstadoTela("busca-pessoas", "");

  const daVista = useMemo(() => (linhas ? filtrarVista(linhas, vista) : undefined), [linhas, vista]);
  const filtradas = useMemo(() => {
    if (!daVista) return undefined;
    const q = normalizar(busca.trim());
    if (!q) return daVista;
    return daVista.filter((m) => normalizar(`${m.nome} ${m.cargo} ${m.setor}`).includes(q));
  }, [daVista, busca]);

  const descricao = !daVista || !filtradas
    ? "Carregando"
    : filtradas.length === daVista.length
      ? `${num(daVista.length)} ${daVista.length === 1 ? "contrato" : "contratos"}`
      : `${num(filtradas.length)} de ${num(daVista.length)}`;

  let corpo: ReactNode;
  if (erro) {
    corpo = (
      <div className="p-4">
        <PainelErro titulo="Não deu para carregar a lista" mensagem={erro} onTentar={onTentar} />
      </div>
    );
  } else if (!filtradas || !daVista) {
    corpo = <EsqueletoTabela colunas={6} linhas={8} />;
  } else {
    corpo = (
      <TabelaPessoas
        linhas={filtradas}
        onAbrir={onAbrir}
        selecionada={selecionada}
        rotulo={vista === "efetivo" ? "Efetivo no fim do período" : "Movimentações do período"}
        vazio={
          daVista.length === 0 ? (
            <Vazio compacto icone="pessoas" titulo={VAZIO_DA_VISTA[vista]} />
          ) : (
            <Vazio
              compacto
              icone="buscar"
              titulo="Ninguém com essa busca"
              descricao="Tente um pedaço do nome, o cargo ou o setor."
              acao={
                <Botao variante="fantasma" icone="fechar" onClick={() => setBusca("")}>
                  Limpar busca
                </Botao>
              }
            />
          )
        }
      />
    );
  }

  return (
    <Painel
      className={className}
      corpo="p-0"
      icone="pessoas"
      titulo={vista === "efetivo" ? "Efetivo no Fim do Período" : "Movimentações do Período"}
      descricao={descricao}
      acoes={
        <div className="nx-sem-papel flex flex-wrap items-center gap-1.5">
          <Campo
            icone="buscar"
            placeholder="Nome, cargo ou setor"
            classeCaixa="w-56"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar na lista"
          />
          <Segmentado<VistaPessoas>
            rotulo="Quem mostrar"
            valor={vista}
            onMudar={onVista}
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              {
                valor: "admitidos",
                rotulo: (
                  <>
                    Admitidos
                    <Contagem n={contagens?.admitidos} />
                  </>
                ),
              },
              {
                valor: "desligados",
                rotulo: (
                  <>
                    Desligados
                    <Contagem n={contagens?.desligados} />
                  </>
                ),
              },
              {
                valor: "efetivo",
                rotulo: (
                  <>
                    Efetivo
                    <Contagem n={contagens?.efetivo} />
                  </>
                ),
              },
            ]}
          />
        </div>
      }
    >
      {corpo}
    </Painel>
  );
}
