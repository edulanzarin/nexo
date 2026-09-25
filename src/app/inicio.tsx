"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCasca } from "@/componentes/casca/casca-cliente";
import { AssinaturaNavex } from "@/componentes/casca/marca";
import { MenuUsuario } from "@/componentes/casca/menu-usuario";
import { abrirPaleta, Paleta } from "@/componentes/casca/paleta";
import { IconeModulo } from "@/componentes/casca/modulo";
import { PortaModulo } from "@/componentes/casca/porta-modulo";
import { Icone } from "@/componentes/primitivos/icone";
import { Tecla } from "@/componentes/primitivos/selo";
import { Vazio } from "@/componentes/primitivos/estados";
import { MODULOS, secoesDoModulo, type Modulo } from "@/lib/modulos";
import { useEmpresas } from "@/hooks/use-consulta";
import { useVisitas, type Visita } from "@/hooks/use-visitas";

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
 * O início é porta e retomada, não cardápio. Cada módulo é uma porta com a
 * relação da pessoa com ele (onde parou ou onde ele abre); o mapa das seções
 * mora dentro do módulo, e repetido aqui tirava o motivo de entrar. Ir direto a
 * uma tela é a busca (Ctrl+K), e voltar a uma tela é o Continuar ao lado.
 *
 * Os módulos que ainda estão no Nexo ficam numa faixa compacta embaixo: do
 * tamanho de uma porta, eles ocupavam mais tela que os prontos.
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
        <div className="ml-auto w-[220px]">
          <MenuUsuario usuario={usuario} />
        </div>
      </header>

      <div className="nx-entra flex flex-col gap-8 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-corpo text-apagado first-letter:uppercase">{hojePorExtenso()}</p>
            <h1 className="nx-titulo mt-1 text-[32px] leading-10 text-tinta">
              {saudacao()}, {primeiroNome}
            </h1>
          </div>
          {/* A busca é o caminho para qualquer tela: por isso ela fica grande e
              aqui, no lugar onde antes morava a lista de seções. */}
          {meus.length > 0 && (
            <button
              type="button"
              onClick={abrirPaleta}
              className="nx-vidro flex h-11 w-full items-center gap-2.5 rounded-controle px-3.5 text-corpo text-apagado transition-colors hover:border-linha-forte hover:text-tinta-2 sm:w-[380px]"
            >
              <Icone nome="buscar" tamanho={16} />
              <span className="flex-1 text-left">Buscar tela</span>
              <span className="hidden items-center gap-0.5 sm:flex">
                <Tecla>Ctrl</Tecla>
                <Tecla>K</Tecla>
              </span>
            </button>
          )}
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
            <div className="flex min-w-0 flex-col gap-6">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
                {prontos.map((m) => (
                  <PortaModulo
                    key={m.id}
                    modulo={m}
                    href={`/${m.id}`}
                    rodape={rodapePorta(m, acessos[m.id] ?? [], visitas)}
                  />
                ))}
              </div>
              {caminho.length > 0 && (
                <section>
                  <h2 className="mb-2 text-pequeno font-[600] text-apagado">Ainda no Nexo</h2>
                  <ul className="flex flex-wrap gap-2">
                    {caminho.map((m) => (
                      <li
                        key={m.id}
                        className="flex h-10 items-center gap-2 rounded-controle border border-dashed border-linha-forte pr-3 pl-1.5 text-corpo text-tinta-2"
                      >
                        <IconeModulo modulo={m} tamanho={26} />
                        {m.titulo}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <aside className="nx-vidro flex min-w-0 flex-col self-start rounded-painel">
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

      </div>
      <Paleta />
    </div>
  );
}

/**
 * A linha de baixo da porta: onde a pessoa parou naquele módulo (a visita mais
 * recente dele) ou, se ainda não entrou, a seção onde ele abre.
 */
function rodapePorta(modulo: Modulo, visiveis: string[], visitas: Visita[]): string {
  const ultima = visitas.find((v) => v.modulo === modulo.id);
  if (ultima) return `Parou em ${ultima.rotulo} · ${ha(ultima.quando)}`;
  const vis = new Set(visiveis);
  const entrada = secoesDoModulo(modulo.id).find((s) => vis.has(s.id));
  return entrada ? `Abre em ${entrada.rotulo}` : "";
}
