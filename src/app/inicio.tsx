"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCasca } from "@/componentes/casca/casca-cliente";
import { AssinaturaNavex } from "@/componentes/casca/marca";
import { MenuUsuario } from "@/componentes/casca/menu-usuario";
import { CorModulo } from "@/componentes/casca/modulo";
import { abrirPaleta, Paleta } from "@/componentes/casca/paleta";
import { Icone } from "@/componentes/primitivos/icone";
import { Tecla } from "@/componentes/primitivos/selo";
import { Vazio } from "@/componentes/primitivos/estados";
import { MODULOS, secoesDoModulo, type Modulo } from "@/lib/modulos";
import type { Secao } from "@/lib/secoes/tipos";
import { useEmpresas } from "@/hooks/use-consulta";
import { useVisitas } from "@/hooks/use-visitas";

function saudacao(): string {
  // Fuso do escritório, e não o do servidor ou do navegador de quem viaja.
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function hojePorExtenso(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function ha(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/**
 * O início. O peso da tela sai do que dá para FAZER: o módulo pronto vem aberto,
 * com o mapa das seções à mão, e ao lado o caminho de volta para onde a pessoa
 * parou. Os módulos que ainda estão sendo refeitos ficam numa fila compacta,
 * com a cor de cada um.
 */
export function Inicio() {
  const { usuario, acessos } = useCasca();
  const visitas = useVisitas();
  const empresas = useEmpresas();
  const nomes = useMemo(() => new Map((empresas.data ?? []).map((e) => [e.codigo, e.nome])), [empresas.data]);
  const meus = MODULOS.filter((m) => acessos[m.id]?.length);
  const prontos = meus.filter((m) => m.pronto);
  const caminho = meus.filter((m) => !m.pronto);
  const primeiroNome = usuario.nome.split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1320px] flex-col px-4 pb-14 sm:px-8">
      <header className="flex h-20 items-center gap-3">
        <AssinaturaNavex />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={abrirPaleta}
            className="flex h-controle items-center gap-2 rounded-controle border border-linha bg-poco px-2.5 text-corpo text-apagado transition-colors hover:border-linha-forte hover:text-tinta-2"
          >
            <Icone nome="buscar" tamanho={15} />
            <span className="hidden sm:inline">Ir para</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <Tecla>Ctrl</Tecla>
              <Tecla>K</Tecla>
            </span>
          </button>
          <div className="w-[220px]">
            <MenuUsuario usuario={usuario} />
          </div>
        </div>
      </header>

      <div className="nx-entra flex flex-col gap-8 pt-6">
        <div>
          <p className="text-corpo text-apagado first-letter:uppercase">{hojePorExtenso()}</p>
          <h1 className="nx-titulo mt-1 text-[32px] leading-10 text-tinta">
            {saudacao()}, {primeiroNome}
          </h1>
        </div>

        {meus.length === 0 ? (
          <div className="nx-vidro rounded-painel">
            <Vazio
              icone="chave"
              titulo="Seu usuário ainda não tem acesso a nenhum módulo"
              descricao="Peça ao administrador para vincular um cargo ao seu usuário."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              {prontos.map((m) => (
                <MapaModulo key={m.id} modulo={m} visiveis={acessos[m.id] ?? []} />
              ))}
            </div>
            <aside className="nx-vidro flex min-w-0 flex-col rounded-painel">
              <h2 className="border-b border-linha px-4 py-3 text-medio font-[600] text-tinta">Continuar</h2>
              {visitas.length === 0 ? (
                <p className="px-4 py-5 text-corpo text-apagado italic">
                  As telas que você abrir aparecem aqui, com a empresa em que você estava.
                </p>
              ) : (
                <ul className="flex flex-col p-1.5">
                  {visitas.slice(0, 6).map((v) => (
                    <li key={`${v.path}-${v.empresa ?? ""}`}>
                      <Link
                        href={`${v.path}${v.qs ? `?${v.qs}` : ""}`}
                        className="flex items-center gap-3 rounded-controle px-2.5 py-2 transition-colors hover:bg-poco"
                      >
                        <Icone nome={v.icone} tamanho={16} className="text-apagado" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-corpo font-[560] text-tinta">{v.rotulo}</span>
                          <span className="block truncate text-pequeno text-apagado">
                            {v.empresa ? `${v.empresa} · ${nomes.get(v.empresa) ?? "empresa"}` : "Escritório inteiro"}
                          </span>
                        </span>
                        <span className="shrink-0 text-micro text-apagado">{ha(v.quando)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}

        {caminho.length > 0 && (
          <section>
            <h2 className="mb-2.5 text-medio font-[600] text-tinta">Sendo refeitos no NaveX</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
              {caminho.map((m) => (
                <div key={m.id} className="nx-vidro flex items-center gap-2.5 rounded-painel px-3 py-2.5">
                  <CorModulo modulo={m} tamanho={30} />
                  <div className="min-w-0">
                    <p className="truncate text-corpo font-[600] text-tinta">{m.titulo}</p>
                    <p className="truncate text-pequeno text-apagado">Ainda no Nexo</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <Paleta />
    </div>
  );
}

/** O módulo aberto: marca, a frase dele e o mapa das seções por grupo de trabalho. */
function MapaModulo({ modulo, visiveis }: { modulo: Modulo; visiveis: string[] }) {
  const grupos = useMemo(() => {
    const vis = new Set(visiveis);
    const mapa = new Map<string, Secao[]>();
    for (const s of secoesDoModulo(modulo.id)) {
      if (vis.has(s.id)) mapa.set(s.grupo, [...(mapa.get(s.grupo) ?? []), s]);
    }
    return [...mapa.entries()];
  }, [modulo.id, visiveis]);

  return (
    <section className="nx-vidro rounded-painel">
      <header className="flex flex-wrap items-center gap-3 border-b border-linha px-4 py-3.5">
        <CorModulo modulo={modulo} tamanho={36} />
        <div className="min-w-0 flex-1">
          <h2 className="nx-titulo text-[18px] leading-6 text-tinta">{modulo.titulo}</h2>
          <p className="truncate text-corpo text-apagado">{modulo.descricao}</p>
        </div>
        <Link
          href={`/${modulo.id}`}
          className="flex h-controle items-center gap-1.5 rounded-controle bg-acento-solido px-3 text-corpo font-[560] text-sobre-acento transition-colors hover:bg-acento-solido-hover"
        >
          Abrir
          <Icone nome="seta-direita" tamanho={15} />
        </Link>
      </header>
      {/* Grade que se reparte pela largura: seis colunas fixas cortavam o nome das seções. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-4 p-4">
        {grupos.map(([grupo, secoes]) => (
          <div key={grupo} className="min-w-0">
            <p className="mb-1.5 px-2 text-micro font-[600] text-apagado">{grupo}</p>
            <ul className="flex flex-col gap-px">
              {secoes.map((s) => (
                <li key={s.id}>
                  <Link
                    href={s.path}
                    className="flex h-8 items-center gap-2 rounded-controle px-2 text-corpo text-tinta-2 transition-colors hover:bg-poco hover:text-tinta"
                  >
                    <Icone nome={s.icone} tamanho={15} className="text-apagado" />
                    <span className="truncate">{s.rotulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
