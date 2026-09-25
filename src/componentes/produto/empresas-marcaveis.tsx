"use client";

import { useMemo, useRef, useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { Esqueleto } from "@/componentes/primitivos/estados";
import { num } from "@/lib/format";
import type { EmpresaMarcavel } from "@/lib/grupos-empresa-tipos";
import { codigosDoIntervalo } from "@/lib/selecao-intervalo";

/** Linhas desenhadas de cada vez; o lote vale para todas as filtradas. */
const LIMITE = 300;

export type VisaoMarcaveis = "todas" | "marcadas" | "desmarcadas";
type Visao = VisaoMarcaveis;

/**
 * Marcar empresas entre as 1.500 do Questor. Feito para mexer em muitas de uma
 * vez, porque grupo de empresa tem centenas: marcar e desmarcar em lote valem
 * para tudo que a busca e a visão acharam (não só as linhas desenhadas), a
 * visão "Marcadas" revisa a escolha sem rolar a lista inteira, Shift+clique
 * pega um intervalo e Enter na busca marca a única achada.
 *
 * Controlada: quem usa guarda as marcadas, porque o grupo inverte a escolha ao
 * trocar de modo (ver `CampoEmpresasGrupo`).
 */
export function ListaEmpresasMarcaveis({
  empresas,
  marcadas,
  onMudar,
  contagem,
  carregando,
  alturaMax = "min(340px, 42dvh)",
  buscaInicial = "",
  visaoInicial = "todas",
}: {
  empresas: EmpresaMarcavel[];
  marcadas: ReadonlySet<number>;
  onMudar: (marcadas: Set<number>) => void;
  /** O texto do contador (padrão "N marcadas"). */
  contagem?: string;
  carregando?: boolean;
  alturaMax?: string;
  /** Para o catálogo mostrar a lista já buscada ou numa visão. */
  buscaInicial?: string;
  visaoInicial?: Visao;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [visao, setVisao] = useState<Visao>(visaoInicial);
  // Última empresa clicada sem Shift: a ponta de onde o intervalo parte.
  const [ancora, setAncora] = useState<number | null>(null);
  const shift = useRef(false);

  const termo = normalizar(busca.trim());
  const filtradas = useMemo(
    () =>
      empresas.filter((e) => {
        if (visao === "marcadas" && !marcadas.has(e.codigo)) return false;
        if (visao === "desmarcadas" && marcadas.has(e.codigo)) return false;
        return !termo || normalizar(e.nome).includes(termo) || String(e.codigo).startsWith(termo);
      }),
    [empresas, visao, marcadas, termo]
  );
  const visiveis = filtradas.slice(0, LIMITE);
  const marcadasNoFiltro = filtradas.reduce((n, e) => n + Number(marcadas.has(e.codigo)), 0);
  const recortado = termo !== "" || visao !== "todas";

  // Contado sobre a lista, não sobre o Set: código marcado que saiu do cadastro
  // do Questor não aparece em visão nenhuma, então não entra na conta.
  const marcadasNaLista = useMemo(
    () => empresas.reduce((n, e) => n + Number(marcadas.has(e.codigo)), 0),
    [empresas, marcadas]
  );
  const total = { todas: empresas.length, marcadas: marcadasNaLista, desmarcadas: empresas.length - marcadasNaLista };

  function aplicar(codigos: number[], marcar: boolean) {
    const s = new Set(marcadas);
    for (const c of codigos) {
      if (marcar) s.add(c);
      else s.delete(c);
    }
    onMudar(s);
  }

  function clicar(codigo: number) {
    // O intervalo inteiro vai para o estado que o clicado passa a ter.
    const marcar = !marcadas.has(codigo);
    const intervalo = shift.current;
    shift.current = false;
    aplicar(intervalo ? codigosDoIntervalo(visiveis.map((e) => e.codigo), ancora, codigo) : [codigo], marcar);
    if (!intervalo) setAncora(codigo);
  }

  // A contagem sai no celular: com ela, as três opções passam da largura da janela.
  const rotuloVisao = (texto: string, v: Visao) => (
    <>
      {texto} <span className="num hidden font-[500] text-apagado sm:inline">{num(total[v])}</span>
    </>
  );

  let corpo;
  if (carregando)
    corpo = (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Esqueleto key={i} className="h-5" />
        ))}
      </div>
    );
  else if (!filtradas.length)
    corpo = (
      <p className="px-3 py-6 text-center text-corpo text-apagado italic">
        {termo
          ? "Nenhuma empresa com esse nome ou código."
          : visao === "marcadas"
            ? "Nenhuma empresa marcada."
            : "Todas as empresas estão marcadas."}
      </p>
    );
  else
    corpo = (
      <ul className="flex flex-col p-1">
        {visiveis.map((e) => (
          <li
            key={e.codigo}
            // Sem isto o Shift+clique seleciona o texto das linhas no caminho.
            onMouseDown={(ev) => ev.shiftKey && ev.preventDefault()}
          >
            <Caixa
              marcada={marcadas.has(e.codigo)}
              onMudar={() => clicar(e.codigo)}
              onClickCapture={(ev) => {
                shift.current = ev.shiftKey;
              }}
              className="w-full rounded-[6px] px-2 py-1.5 transition-colors hover:bg-poco"
              rotulo={
                <span className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate" title={e.nome}>
                    {e.nome}
                  </span>
                  <span className="num shrink-0 text-pequeno text-apagado">{e.codigo}</span>
                </span>
              }
            />
          </li>
        ))}
        {filtradas.length > LIMITE && (
          <li className="px-2 py-2 text-pequeno text-apagado italic">
            Mostrando {num(LIMITE)} de {num(filtradas.length)}. Marcar e desmarcar valem para as {num(filtradas.length)}.
          </li>
        )}
      </ul>
    );

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-controle border border-linha">
      <div className="flex flex-wrap items-center gap-2 border-b border-linha p-2">
        <Campo
          icone="buscar"
          placeholder="Nome ou código da empresa"
          aria-label="Buscar empresa"
          classeCaixa="min-w-48 flex-1"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          onKeyDown={(ev) => {
            // Enter dentro do formulário enviaria o grupo pela metade.
            if (ev.key !== "Enter") return;
            ev.preventDefault();
            if (filtradas.length === 1) aplicar([filtradas[0].codigo], !marcadas.has(filtradas[0].codigo));
          }}
          fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
        />
        <Segmentado<Visao>
          rotulo="Quais empresas mostrar"
          valor={visao}
          onMudar={setVisao}
          opcoes={[
            { valor: "todas", rotulo: rotuloVisao("Todas", "todas") },
            { valor: "marcadas", rotulo: rotuloVisao("Marcadas", "marcadas") },
            { valor: "desmarcadas", rotulo: rotuloVisao("Desmarcadas", "desmarcadas") },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-linha py-1 pr-1 pl-3">
        <span className="num text-pequeno text-apagado">{contagem ?? `${num(marcadasNaLista)} marcadas`}</span>
        <div className="flex items-center gap-0.5">
          <Botao
            variante="fantasma"
            icone="certo-duplo"
            className="h-controle-p px-2 text-pequeno"
            disabled={carregando || marcadasNoFiltro === filtradas.length}
            onClick={() => aplicar(filtradas.map((e) => e.codigo), true)}
          >
            {recortado ? `Marcar as ${num(filtradas.length)}` : "Marcar todas"}
          </Botao>
          <Botao
            variante="fantasma"
            icone="menos"
            className="h-controle-p px-2 text-pequeno"
            disabled={carregando || marcadasNoFiltro === 0}
            onClick={() => aplicar(filtradas.map((e) => e.codigo), false)}
          >
            {recortado ? `Desmarcar as ${num(filtradas.length)}` : "Desmarcar todas"}
          </Botao>
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: alturaMax }}>
        {corpo}
      </div>

      <p className="border-t border-linha px-3 py-1.5 text-micro text-apagado italic">
        Shift+clique marca o intervalo. Com uma empresa só na busca, Enter marca ela.
      </p>
    </div>
  );
}
