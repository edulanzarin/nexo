"use client";

import { useMemo, useState } from "react";
import { IconeModulo } from "@/componentes/casca/modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { Vazio } from "@/componentes/primitivos/estados";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import { MODULOS_CONCEDIVEIS, secoesDoModulo, type Modulo } from "@/lib/modulos";
import type { Secao } from "@/lib/secoes/tipos";

/*
 * A matriz de permissões do cargo: uma caixa por seção, binária (a seção é
 * liberada ou não; não há "só leitura"). O que ela lista é o catálogo de
 * seções, o mesmo que desenha a barra lateral, então seção nova aparece aqui
 * sem ninguém mexer na tela. A Administração fica de fora: nenhum cargo a
 * concede (ver `soAdmin`).
 */

/** A chave que o cargo grava em `cargo_secao`: "modulo/secao". */
export const chaveSecao = (modulo: string, secao: string) => `${modulo}/${secao}`;

interface SecaoMatriz {
  chave: string;
  secao: Secao;
  /** Texto da busca, já sem acento: módulo, grupo, rótulo e descrição. */
  alvo: string;
}

interface ModuloMatriz {
  modulo: Modulo;
  chaves: string[];
  /** Os grupos da barra lateral, na ordem dela. */
  grupos: { nome: string; secoes: SecaoMatriz[] }[];
}

// Montada uma vez: o catálogo é fixo no código.
const MATRIZ: ModuloMatriz[] = MODULOS_CONCEDIVEIS.map((modulo) => {
  const grupos = new Map<string, SecaoMatriz[]>();
  for (const secao of secoesDoModulo(modulo.id)) {
    const item = {
      chave: chaveSecao(modulo.id, secao.id),
      secao,
      alvo: normalizar(`${modulo.titulo} ${secao.grupo} ${secao.rotulo} ${secao.descricao}`),
    };
    grupos.set(secao.grupo, [...(grupos.get(secao.grupo) ?? []), item]);
  }
  const lista = [...grupos.entries()].map(([nome, secoes]) => ({ nome, secoes }));
  return { modulo, grupos: lista, chaves: lista.flatMap((g) => g.secoes.map((s) => s.chave)) };
});

/** Toda chave que um cargo pode liberar, na ordem da matriz. */
export const CHAVES_CONCEDIVEIS: string[] = MATRIZ.flatMap((m) => m.chaves);
const CONCEDIVEIS = new Set(CHAVES_CONCEDIVEIS);

/** Só as chaves que ainda existem no catálogo (seção que saiu não conta nem se grava). */
export function secoesValidas(chaves: Iterable<string>): Set<string> {
  return new Set([...chaves].filter((c) => CONCEDIVEIS.has(c)));
}

/** Estado de um lote de caixas: todas, algumas ou nenhuma marcada. */
function estadoLote(chaves: string[], marcadas: ReadonlySet<string>) {
  const n = chaves.reduce((s, c) => s + (marcadas.has(c) ? 1 : 0), 0);
  return { n, todas: chaves.length > 0 && n === chaves.length, algumas: n > 0 && n < chaves.length };
}

function comLote(marcadas: ReadonlySet<string>, chaves: string[], marcar: boolean): Set<string> {
  const novo = new Set(marcadas);
  for (const c of chaves) {
    if (marcar) novo.add(c);
    else novo.delete(c);
  }
  return novo;
}

function BlocoModulo({
  item,
  grupos,
  marcadas,
  onMudar,
}: {
  item: ModuloMatriz;
  /** Os grupos com as seções que a busca deixou. */
  grupos: ModuloMatriz["grupos"];
  marcadas: ReadonlySet<string>;
  onMudar: (m: Set<string>) => void;
}) {
  const { modulo } = item;
  // A contagem é do módulo inteiro; a caixa do cabeçalho age sobre o que está
  // na tela, como a da busca: com busca, só as seções achadas.
  const doModulo = estadoLote(item.chaves, marcadas);
  const vistas = grupos.flatMap((g) => g.secoes.map((s) => s.chave));
  const lote = estadoLote(vistas, marcadas);
  return (
    <section aria-label={modulo.titulo} className="mb-5 break-inside-avoid">
      <div className="flex items-center gap-3 border-b border-linha pb-2">
        <Caixa
          marcada={lote.todas}
          indeterminada={lote.algumas}
          onMudar={(v) => onMudar(comLote(marcadas, vistas, v))}
          className="min-w-0 flex-1"
          rotulo={
            <span className="flex min-w-0 items-center gap-2">
              <IconeModulo modulo={modulo} tamanho={22} />
              <span className="truncate text-medio font-[600] text-tinta">{modulo.titulo}</span>
            </span>
          }
        />
        <span className={cn("num shrink-0 text-pequeno", doModulo.n ? "text-tinta-2" : "text-apagado")}>
          {num(doModulo.n)} de {num(item.chaves.length)}
        </span>
      </div>
      {grupos.map((g) => (
        <div key={g.nome}>
          <p className="px-2 pt-2.5 pb-0.5 text-micro font-[600] text-apagado">{g.nome}</p>
          <ul className="flex flex-col">
            {g.secoes.map((s) => (
              <li key={s.chave}>
                <Caixa
                  marcada={marcadas.has(s.chave)}
                  onMudar={(v) => onMudar(comLote(marcadas, [s.chave], v))}
                  className="flex w-full rounded-controle px-2 py-1.5 hover:bg-poco"
                  rotulo={s.secao.rotulo}
                  detalhe={<span title={s.secao.descricao}>{s.secao.descricao}</span>}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * As seções de todos os módulos que um cargo pode liberar, agrupadas por
 * módulo e, dentro dele, como na barra lateral. Controlada: as marcadas moram
 * em quem edita o cargo.
 */
export function MatrizPermissoes({
  marcadas,
  onMudar,
  buscaInicial = "",
}: {
  marcadas: ReadonlySet<string>;
  onMudar: (marcadas: Set<string>) => void;
  /** Para o catálogo abrir já buscando. */
  buscaInicial?: string;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const termo = normalizar(busca.trim());

  const visiveis = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return MATRIZ.map((item) => ({
      item,
      grupos: item.grupos
        .map((g) => ({ ...g, secoes: g.secoes.filter((s) => partes.every((p) => s.alvo.includes(p))) }))
        .filter((g) => g.secoes.length > 0),
    })).filter((m) => m.grupos.length > 0);
  }, [termo]);

  const achadas = useMemo(
    () => visiveis.flatMap((m) => m.grupos.flatMap((g) => g.secoes.map((s) => s.chave))),
    [visiveis]
  );
  const lote = estadoLote(achadas, marcadas);
  const total = estadoLote(CHAVES_CONCEDIVEIS, marcadas);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-linha px-4 py-2.5">
        <Caixa
          marcada={lote.todas}
          indeterminada={lote.algumas}
          desabilitada={achadas.length === 0}
          onMudar={(v) => onMudar(comLote(marcadas, achadas, v))}
          rotulo={termo ? `Todas as achadas (${num(achadas.length)})` : "Todas as seções"}
        />
        <span className="num text-pequeno text-apagado">
          {num(total.n)} de {num(CHAVES_CONCEDIVEIS.length)} liberadas
        </span>
        <Campo
          icone="buscar"
          placeholder="Buscar seção"
          aria-label="Buscar seção"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          classeCaixa="w-full sm:ml-auto sm:w-64"
          fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
        />
      </div>
      {visiveis.length === 0 ? (
        <Vazio
          compacto
          icone="buscar"
          titulo="Nenhuma seção com esse nome"
          descricao="A busca olha o módulo, o grupo, o nome e a descrição da seção."
          acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
        />
      ) : (
        <div className="gap-x-8 px-4 pt-3 pb-1 lg:columns-2 2xl:columns-3">
          {visiveis.map(({ item, grupos }) => (
            <BlocoModulo key={item.modulo.id} item={item} grupos={grupos} marcadas={marcadas} onMudar={onMudar} />
          ))}
        </div>
      )}
    </div>
  );
}
