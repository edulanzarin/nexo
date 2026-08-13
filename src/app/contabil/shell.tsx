"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ModuloHeader } from "@/components/modulo-header";
import { useEffect } from "react";
import { useIsFetching } from "@tanstack/react-query";
import clsx from "clsx";
import { ConfFilterBar } from "@/components/filters/conf-filter-bar";
import { FiltroPendente } from "@/components/filtro-pendente";
import { ImportarControles } from "@/components/importar-controles";
import { ImplantacaoControles } from "@/components/implantacao-controles";
import { RegrasControles } from "@/components/regras-controles";
import { useFiltros } from "@/hooks/use-filters";
import {
  abaContabilAtual,
  abasDaSecao,
  abaUsaPeriodo,
  abaUsaPeriodoMensal,
  execucaoDaAba,
  secaoContabilAtual,
} from "@/lib/contabil-secoes";
import { abaFoiExecutada, limparEstadoDoModulo, marcarAbaExecutada } from "@/lib/estado-secao";
import { limparFiltrosDoModulo } from "@/lib/estado-filtros-secao";
import { dataBR } from "@/lib/format";

// Controles que cada aba põe na linha da barra. O mapa vive aqui (e não no
// catálogo) para o catálogo não importar componente de app — evita ciclo de
// import, já que o estado de seção depende do próprio catálogo.
const CONTROLES_BARRA: Record<string, React.ComponentType> = {
  importar: ImportarControles,
  regras: RegrasControles,
  implantar: ImplantacaoControles,
};

export function ContabilShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { filtros, aplicado } = useFiltros();
  const secao = secaoContabilAtual(pathname);
  const aba = abaContabilAtual(pathname);
  const abas = abasDaSecao(pathname);
  const carregando = useIsFetching() > 0;

  // Busca, extrato carregado e memória de filtro valem pelo MÓDULO inteiro:
  // trocar de seção (ou de aba) mantém, e só "Trocar módulo" — quando este shell
  // sai do ar — descarta. Antes limpava a cada troca de seção, o que obrigava a
  // reescolher tudo e recarregar ao voltar.
  const secaoPath = secao?.path;
  useEffect(
    () => () => {
      limparEstadoDoModulo("/contabil");
      limparFiltrosDoModulo("/contabil");
    },
    []
  );
  const usaPeriodo = abaUsaPeriodo(pathname);
  const periodoMensal = abaUsaPeriodoMensal(pathname);
  const execucao = execucaoDaAba(pathname);

  // Quando uma aba executa (aplicado), lembra disso pela vida do módulo — assim
  // ir noutra aba (ou seção) e voltar mantém o resultado, sem reexecutar.
  const abaId = aba?.id;
  useEffect(() => {
    if (aplicado && secaoPath && abaId) marcarAbaExecutada(secaoPath, abaId);
  }, [aplicado, secaoPath, abaId]);
  const jaExecutou = !!(secaoPath && abaId && abaFoiExecutada(secaoPath, abaId));

  // Ao trocar de aba, os filtros (empresa, período, filial…) seguem na URL, mas o
  // marcador de executado (`ap`) NÃO: cada aba é um trabalho próprio e só roda
  // quando o usuário clica no seu botão — estar no mesmo menu não a dispara.
  const tabParams = new URLSearchParams(sp.toString());
  tabParams.delete("ap");
  const tabQs = tabParams.toString();
  const suffix = tabQs ? `?${tabQs}` : "";

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <ModuloHeader
        titulo={secao?.rotulo ?? "Contábil"}
        carregando={carregando}
        direita={
          usaPeriodo && (
            <p className="hidden text-xs text-muted sm:block">
              {dataBR(filtros.inicio)} – {dataBR(filtros.fim)}
            </p>
          )
        }
      />

      {aba && abas.length > 1 && (
        <nav className="mb-4 flex gap-1 border-b border-hairline" aria-label={secao?.rotulo}>
          {abas.map((a) => {
            const ativa = a.id === aba.id;
            return (
              <Link
                key={a.id}
                href={`${a.path}${suffix}`}
                aria-current={ativa ? "page" : undefined}
                className={clsx(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                  ativa
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-muted hover:border-hairline hover:text-ink"
                )}
              >
                {a.rotulo}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Filial nas telas de dado (junto com o período): Conferência, Notas e
          Balancete honram `estabs`. A Configuração (cadastro por empresa) fica fora. */}
      <ConfFilterBar
        mostrarPeriodo={usaPeriodo}
        periodoMensal={periodoMensal}
        mostrarFilial={usaPeriodo}
        execucao={execucao}
        extras={(() => {
          const Controles = aba ? CONTROLES_BARRA[aba.id] : undefined;
          return Controles ? <Controles /> : undefined;
        })()}
      />

      {/* O gate só existe onde há botão; tela de execução imediata cuida dos
          próprios estados vazios (escolher conta, enviar arquivo). */}
      <div className="mt-5 space-y-4">
        {execucao.imediata || aplicado || jaExecutou ? (
          children
        ) : (
          <FiltroPendente rotulo={execucao.rotulo} />
        )}
      </div>
    </div>
  );
}
