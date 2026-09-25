"use client";

import { useMemo } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { COR_CUSTO } from "@/componentes/produto/folha/custo-cores";
import { PainelCustoQuebra } from "@/componentes/produto/folha/custo-quebra";
import { PainelRubricas } from "@/componentes/produto/folha/custo-rubricas";
import { CaixaGrafico, GraficoSerie, Legenda, type Serie } from "@/componentes/produto/graficos";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";
import { nomeMes } from "@/lib/contexto";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataBR, mesBR, num, pct } from "@/lib/format";
import type { CustoFolhaResp, CustoGrupo } from "@/lib/types";

const SERIES: Serie[] = [
  { chave: "proventos", rotulo: "Proventos", cor: COR_CUSTO.proventos, tipo: "barra" },
  { chave: "descontos", rotulo: "Descontos", cor: COR_CUSTO.descontos, tipo: "barra" },
];

/** Valor cheio na dica, abreviado no número: a faixa lê de longe, a dica confere. */
const Valor = ({ v }: { v: number }) => <span title={brl(v)}>{brlCompact(v)}</span>;

const corteGrupos = (id: string, rotulo: string, coluna: string, sufixo: string, lista: CustoGrupo[]): CorteExportar => ({
  id,
  rotulo,
  nome: `custo-folha-${id}-${sufixo}`,
  montar: () => ({
    cabecalhos: [coluna, "Custo", "Pessoas", "Custo médio"],
    linhas: lista.map((g) => [g.grupo, decimalBR(g.proventos), g.funcionarios, decimalBR(g.custoMedio)]),
  }),
});

/**
 * Custo de Folha de uma empresa: quanto a folha calculou de remuneração no
 * período, de que tipo de folha veio, mês a mês, por rubrica e onde está (setor,
 * cargo, estabelecimento). "Custo" é provento; o encargo patronal não é evento
 * por funcionário no Questor e fica fora, e a nota diz isso na tela.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<CustoFolhaResp>("folha-custo", qs == null ? null : `/api/folha/custo?${qs}`);
  const d = consulta.data;
  const r = d?.resumo;
  const p = new URLSearchParams(qs ?? "");
  const inicio = p.get("inicio") ?? "";
  const fim = p.get("fim") ?? "";

  const proventos = useMemo(() => d?.rubricas.filter((x) => x.lado === "provento"), [d]);
  const descontos = useMemo(() => d?.rubricas.filter((x) => x.lado === "desconto"), [d]);

  const tipos = useMemo<ItemQuebra[] | undefined>(() => {
    if (!d) return undefined;
    const total = d.resumo.proventos;
    return d.porTipo.map((t) => ({
      chave: String(t.tipo),
      nome: t.descricao,
      qtd: t.proventos,
      detalhe: `${pct(total > 0 ? (t.proventos / total) * 100 : 0)} · ${brlCompact(t.descontos)} em descontos`,
    }));
  }, [d]);

  const serie = useMemo(() => d?.serie.map((s) => ({ ...s, rotulo: mesBR(s.compet) })), [d]);

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const k = d.resumo;
    const sufixo = `${d.empresa.codigo}-${d.periodo.inicio}_${d.periodo.fim}`;
    return [
      {
        id: "resumo",
        rotulo: "Números do período",
        nome: `custo-folha-resumo-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Indicador", "Valor"],
          linhas: [
            ["Proventos", decimalBR(k.proventos)],
            ["Descontos", decimalBR(k.descontos)],
            ["Líquido", decimalBR(k.liquido)],
            ["Funcionários", k.funcionarios],
            ["Custo médio por pessoa", decimalBR(k.custoMedio)],
          ],
        }),
      },
      {
        id: "tipos",
        rotulo: "Por tipo de folha",
        nome: `custo-folha-tipos-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Tipo de folha", "Proventos", "Descontos"],
          linhas: d.porTipo.map((t) => [t.descricao, decimalBR(t.proventos), decimalBR(t.descontos)]),
        }),
      },
      {
        id: "mensal",
        rotulo: "Mês a mês",
        nome: `custo-folha-mensal-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Competência", "Proventos", "Descontos", "Líquido"],
          linhas: d.serie.map((s) => [
            mesBR(s.compet),
            decimalBR(s.proventos),
            decimalBR(s.descontos),
            decimalBR(s.proventos - s.descontos),
          ]),
        }),
      },
      {
        id: "rubricas",
        rotulo: "Principais rubricas",
        descricao: "As de maior valor em proventos e em descontos",
        nome: `custo-folha-rubricas-${sufixo}`,
        montar: () => ({
          cabecalhos: ["Lado", "Código", "Rubrica", "Total"],
          linhas: d.rubricas.map((x) => [
            x.lado === "provento" ? "Provento" : "Desconto",
            x.codigo,
            x.descricao,
            decimalBR(x.total),
          ]),
        }),
      },
      corteGrupos("setores", "Por setor", "Setor", sufixo, d.porSetor),
      corteGrupos("cargos", "Por cargo", "Cargo", sufixo, d.porCargo),
      corteGrupos("estabelecimentos", "Por estabelecimento", "Estabelecimento", sufixo, d.porEstabelecimento),
    ];
  }, [d]);

  const semFolha = r != null && r.funcionarios === 0;
  const acoes = (
    <AcoesPagina>
      <MenuExportar modulo="folha" cortes={cortes} desabilitado={!d || semFolha} />
    </AcoesPagina>
  );

  if (consulta.error && !d)
    return (
      <>
        {acoes}
        <PainelErro
          titulo="Não deu para apurar o custo"
          mensagem={(consulta.error as Error).message}
          onTentar={() => consulta.refetch()}
        />
      </>
    );

  if (semFolha)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="moedas"
            titulo="Nenhuma folha calculada no período"
            descricao={`A empresa não tem folha calculada entre ${dataBR(inicio)} e ${dataBR(fim)}. Amplie o período no topo.`}
          />
        </div>
      </>
    );

  const carregando = !d;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Custo de remuneração"
          icone="moedas"
          carregando={carregando}
          valor={r ? <Valor v={r.proventos} /> : ""}
          detalhe={r ? `${brl(r.proventos)} em proventos` : ""}
        />
        <Indicador
          rotulo="Descontos"
          icone="recibo"
          carregando={carregando}
          valor={r ? <Valor v={r.descontos} /> : ""}
          detalhe={r ? `${pct(r.proventos > 0 ? (r.descontos / r.proventos) * 100 : 0)} dos proventos` : ""}
        />
        <Indicador
          rotulo="Líquido"
          icone="calculadora"
          carregando={carregando}
          valor={r ? <Valor v={r.liquido} /> : ""}
          detalhe={r ? "Proventos menos descontos" : ""}
        />
        <Indicador
          rotulo="Funcionários"
          icone="pessoas"
          carregando={carregando}
          valor={r ? num(r.funcionarios) : ""}
          detalhe={r ? `Custo médio de ${brl(r.custoMedio)} por pessoa no período` : ""}
        />
      </FaixaIndicadores>

      <Nota>
        Entram as folhas que terminam no período. Ficam fora os encargos patronais (FGTS e INSS da empresa) e as
        folhas de adiantamento, provisão e transferência.
      </Nota>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Composição por Tipo de Folha"
          descricao="Proventos de cada tipo de folha no período"
          itens={tipos}
          formatar={brl}
          corPadrao={COR_CUSTO.proventos}
          carregando={carregando}
          vazio="Nenhuma folha no período."
        />
        <CaixaGrafico
          titulo="Evolução Mensal"
          descricao="Proventos e descontos por competência"
          legenda={<Legenda itens={SERIES.map((s) => ({ rotulo: s.rotulo, cor: s.cor }))} />}
          carregando={carregando}
          vazio={serie && serie.length === 0 ? "Nenhuma competência no período." : false}
          altura={260}
        >
          <GraficoSerie
            dados={serie ?? []}
            x="rotulo"
            series={SERIES}
            formatar={(v) => brl(v)}
            tituloDica={(s) => (
              <>
                {nomeMes(s.compet, true)}
                <span className="block font-[400] text-apagado">{brl(s.proventos - s.descontos)} de líquido</span>
              </>
            )}
          />
        </CaixaGrafico>
      </div>

      <PainelRubricas
        proventos={proventos}
        descontos={descontos}
        totalProventos={r?.proventos ?? 0}
        totalDescontos={r?.descontos ?? 0}
        carregando={carregando}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelCustoQuebra titulo="Custo por Setor" rotuloColuna="Setor" grupos={d?.porSetor} carregando={carregando} />
        <PainelCustoQuebra titulo="Custo por Cargo" rotuloColuna="Cargo" grupos={d?.porCargo} carregando={carregando} />
      </div>
      <PainelCustoQuebra
        titulo="Custo por Estabelecimento"
        rotuloColuna="Estabelecimento"
        grupos={d?.porEstabelecimento}
        carregando={carregando}
      />
    </>
  );
}
