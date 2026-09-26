"use client";

import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { IconeTipo, Patrimonio } from "@/componentes/produto/ti/equipamento";
import { useJanelasTi } from "@/componentes/produto/ti/janelas";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useMovimentacoesTi } from "@/hooks/use-ti";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import { frasePosse, nomeEquipamento, type Destino, type MovimentacaoLista } from "@/lib/ti-tipos";

/** Entrega a quem é do Diretório e a quem é de fora é o mesmo filtro: as duas são entregas. */
type Filtro = "todas" | Exclude<Destino, "externo">;

const filtroDe = (d: Destino): Filtro => (d === "externo" ? "pessoa" : d);

const ROTULO: Record<Filtro, string> = {
  todas: "Todas",
  pessoa: "Entregas",
  estoque: "Devoluções ao estoque",
  local: "Locais",
  manutencao: "Manutenções",
  baixa: "Baixas",
};

const POR_PAGINA = 50;

/**
 * Movimentações: o registro de tudo que mudou de mãos, do mais recente para
 * trás. Cada linha diz o que aconteceu, de onde o equipamento saiu e quem
 * registrou. É onde se responde "quem estava com o notebook 12 em março" sem
 * abrir equipamento por equipamento.
 */
export default function Conteudo() {
  const j = useJanelasTi();
  const res = useMovimentacoesTi();
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "todas");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [pagina, setPagina] = useEstadoTela("pagina", 1);

  const d = res.data;
  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return (d ?? []).filter((m) => {
      if (filtro !== "todas" && filtroDe(m.posse.destino) !== filtro) return false;
      if (!partes.length) return true;
      const f = frasePosse(m);
      const alvo = normalizar(
        `${m.equipamento.patrimonio ?? ""} ${nomeEquipamento(m.equipamento)} ${m.equipamento.numeroSerie ?? ""} ${f.titulo} ${
          f.de ?? ""
        } ${m.observacao ?? ""} ${m.registradoPor ?? ""}`
      );
      return partes.every((p) => alvo.includes(p));
    });
  }, [d, filtro, termo]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todas: 0, pessoa: 0, estoque: 0, local: 0, manutencao: 0, baixa: 0 };
    for (const m of d ?? []) {
      c.todas++;
      c[filtroDe(m.posse.destino)]++;
    }
    return c;
  }, [d]);

  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const visiveis = linhas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  const colunas: Coluna<MovimentacaoLista>[] = [
    {
      id: "data",
      cabecalho: "Data",
      largura: "100px",
      celula: (m) => <span className="num">{dataBR(m.data)}</span>,
    },
    {
      id: "equipamento",
      cabecalho: "Equipamento",
      largura: "30%",
      celula: (m) => (
        <span className="flex min-w-0 items-center gap-2.5 py-1">
          <IconeTipo tipo={m.equipamento.tipo} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-tinta">{nomeEquipamento(m.equipamento)}</span>
            <span className="text-pequeno">
              <Patrimonio codigo={m.equipamento.patrimonio} />
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "movimento",
      cabecalho: "O que aconteceu",
      largura: "36%",
      celula: (m) => {
        const f = frasePosse(m);
        return (
          <span className="flex min-w-0 flex-col py-1">
            <span className="truncate text-tinta">{f.titulo}</span>
            {f.de && <span className="truncate text-pequeno text-apagado">Estava {f.de}</span>}
          </span>
        );
      },
    },
    {
      id: "registro",
      cabecalho: "Registrado",
      largura: "24%",
      secundaria: true,
      celula: (m) => (
        <span className="flex min-w-0 flex-col py-1">
          <span className="truncate text-tinta-2">{m.registradoPor ?? "Sem autor"}</span>
          <span className="num text-pequeno text-apagado">{dataHoraBR(m.registradoEm)}</span>
        </span>
      ),
    },
  ];

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar as movimentações"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && !d.length)
    vazio = (
      <Vazio
        icone="historico"
        titulo="Nenhuma movimentação ainda"
        descricao="Cada cadastro, entrega, devolução, manutenção e baixa de equipamento aparece aqui."
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhuma movimentação neste filtro"
        acao={
          <Botao
            onClick={() => {
              setFiltro("todas");
              setBusca("");
            }}
          >
            Limpar filtros
          </Botao>
        }
      />
    );

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="ti"
          desabilitado={!linhas.length}
          cortes={[
            {
              id: "movimentacoes",
              rotulo: "Movimentações",
              descricao: [ROTULO[filtro], busca && `busca "${busca}"`].filter(Boolean).join(" · "),
              nome: "movimentacoes-ti",
              montar: () => ({
                cabecalhos: ["Data", "Patrimônio", "Equipamento", "O que aconteceu", "Antes", "Observação", "Registrado por", "Registrado em"],
                linhas: linhas.map((m) => {
                  const f = frasePosse(m);
                  return [
                    dataBR(m.data),
                    m.equipamento.patrimonio ?? "",
                    nomeEquipamento(m.equipamento),
                    f.titulo,
                    f.de ?? "",
                    m.observacao ?? "",
                    m.registradoPor ?? "",
                    dataHoraBR(m.registradoEm),
                  ];
                }),
              }),
            },
          ]}
        />
      </AcoesPagina>

      <Painel
        corpo="p-0"
        titulo="Movimentações"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            {d ? `${num(linhas.length)} · da mais recente para trás` : "Carregando"}
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <>
            <Combo
              opcoes={(Object.keys(ROTULO) as Filtro[]).map((f) => ({ valor: f, rotulo: ROTULO[f], detalhe: num(contagem[f]) }))}
              valor={filtro}
              onMudar={(v) => {
                setFiltro(v as Filtro);
                setPagina(1);
              }}
              rotuloAcessivel="Tipo de movimentação"
              className="w-52"
              busca={false}
            />
            <Campo
              icone="buscar"
              placeholder="Patrimônio, pessoa ou observação"
              aria-label="Buscar movimentação"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              classeCaixa="w-full sm:w-64"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
          </>
        }
        rodape={
          linhas.length > POR_PAGINA ? (
            <Paginacao pagina={atual} porPagina={POR_PAGINA} total={linhas.length} onPagina={setPagina} />
          ) : undefined
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={4} linhas={10} />
        ) : (
          <TabelaDados
            rotulo="Movimentações de equipamento"
            colunas={colunas}
            linhas={visiveis}
            chave={(m) => String(m.id)}
            onLinha={(m) => j.abrirFicha(m.equipamentoId)}
            vazio={vazio}
          />
        )}
      </Painel>

      {j.elemento}
    </>
  );
}
