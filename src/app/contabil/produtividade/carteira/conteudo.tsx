"use client";

import { useMemo, useState } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { MenuExportar, type CorteExportar } from "@/componentes/produto/menu-exportar";
import { CurvaConcentracao } from "@/componentes/produto/produtividade/curva-concentracao";
import { PainelEscada } from "@/componentes/produto/produtividade/painel-escada";
import { PainelQuebra, type ItemQuebra } from "@/componentes/produto/produtividade/painel-quebra";
import { TabelaCarteira } from "@/componentes/produto/produtividade/tabela-carteira";
import { decimalBR } from "@/lib/csv";
import { brl, brlCompact, dataBR, num, numCompact, pct } from "@/lib/format";
import { faixaDe } from "@/lib/prod-escala";
import {
  FAIXAS_PARADA,
  PARADA_NUNCA,
  type ContabilCarteiraResp,
  type CtbCarteiraEmpresa,
} from "@/lib/contabil-carteira-tipos";
import { useConsulta } from "@/hooks/use-consulta";
import { useExecucao } from "@/hooks/use-execucao";

/** Quantas empresas foram tocadas por 1, 2, 3, 4 e 5 ou mais pessoas. */
const ROTULOS_PESSOAS = ["1 pessoa", "2 pessoas", "3 pessoas", "4 pessoas", "5 ou mais"];

/** Fora do componente: a tabela recalcula colunas quando o acessor muda. */
const lancamentosDe = (e: CtbCarteiraEmpresa) => e.lancamentos;

/**
 * Carteira: a leitura pelo lado do CLIENTE. As outras abas respondem "quem
 * trabalhou"; esta responde "quem foi atendido" e, sobretudo, quem NÃO foi. Uma
 * empresa ativa que passou o mês sem um lançamento não aparece em ranking
 * nenhum: ela é a ausência, e ausência só se vê contra a carteira inteira.
 *
 * Aqui não há recorte por pessoa: a unidade é a empresa.
 */
export function Conteudo() {
  const { qs } = useExecucao();
  const consulta = useConsulta<ContabilCarteiraResp>(
    "contabil-produtividade-carteira",
    qs == null ? null : `/api/contabil/produtividade-carteira?${qs}`
  );
  const d = consulta.data;
  const carregando = !d;
  const [aberta, setAberta] = useState<CtbCarteiraEmpresa | null>(null);

  const topEmpresas = useMemo<ItemQuebra[] | undefined>(
    () =>
      d?.empresas
        .filter((e) => e.lancamentos > 0)
        .sort((a, b) => b.lancamentos - a.lancamentos)
        .map((e) => ({
          chave: String(e.codigo),
          nome: e.nome,
          qtd: e.lancamentos,
          detalhe: e.principal ? `${brlCompact(e.valor)} · principalmente ${e.principal}` : brlCompact(e.valor),
        })),
    [d]
  );

  const porPessoas = useMemo<ItemQuebra[] | undefined>(
    () => d?.porPessoas.map((qtd, i) => ({ chave: String(i + 1), nome: ROTULOS_PESSOAS[i] ?? `${i + 1} pessoas`, qtd })),
    [d]
  );

  const cortes = useMemo<CorteExportar[]>(() => {
    if (!d) return [];
    const periodo = `${d.periodo.inicio}_${d.periodo.fim}`;
    return [
      {
        id: "carteira",
        rotulo: "Carteira inteira",
        nome: `carteira-contabil-${periodo}`,
        montar: () => ({
          cabecalhos: [
            "Código", "Empresa", "Situação", "Lançamentos", "Pessoas", "Quem mais lançou", "Valor",
            "Último lançamento", "Parada há (dias)",
          ],
          linhas: d.empresas.map((e) => [
            e.codigo,
            e.nome,
            e.ativa ? "ativa" : "baixada",
            e.lancamentos,
            e.pessoas,
            e.principal ?? "",
            decimalBR(e.valor),
            e.ultimo ?? "",
            e.diasParada ?? "",
          ]),
        }),
      },
      {
        id: "paradas",
        rotulo: "Empresas sem movimento",
        nome: `carteira-contabil-sem-movimento-${periodo}`,
        montar: () => ({
          cabecalhos: ["Código", "Empresa", "Último lançamento", "Parada há (dias)"],
          linhas: d.empresas
            .filter((e) => e.ativa && e.lancamentos === 0)
            .sort((a, b) => (b.diasParada ?? PARADA_NUNCA) - (a.diasParada ?? PARADA_NUNCA))
            .map((e) => [e.codigo, e.nome, e.ultimo ?? "nunca teve", e.diasParada ?? ""]),
        }),
      },
    ];
  }, [d]);

  if (consulta.isError)
    return <PainelErro mensagem={(consulta.error as Error).message} onTentar={() => consulta.refetch()} />;

  const acoes = (
    <AcoesPagina>
      <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando} />
    </AcoesPagina>
  );

  if (d && d.empresas.length === 0)
    return (
      <>
        {acoes}
        <div className="nx-vidro rounded-painel">
          <Vazio
            icone="empresa"
            titulo="Nenhuma empresa na carteira do escopo"
            descricao="Tire o filtro de empresa ou de grupo no topo para ver a carteira inteira."
          />
        </div>
      </>
    );

  const t = d?.totais;
  const faixaAberta = aberta ? FAIXAS_PARADA[faixaDe(FAIXAS_PARADA, aberta.diasParada ?? PARADA_NUNCA)] : undefined;

  return (
    <>
      {acoes}

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Cobertura"
          icone="grafico"
          carregando={carregando}
          valor={pct(t?.cobertura ?? 0)}
          detalhe={`Da carteira contábil (${num(t?.contabil ?? 0)} empresas) recebeu lançamento`}
        />
        <Indicador
          rotulo="Empresas atendidas"
          icone="empresa"
          carregando={carregando}
          valor={num(t?.atendidas ?? 0)}
          detalhe={`${numCompact(t?.lancamentos ?? 0)} lançamentos · ${brlCompact(t?.valor ?? 0)}`}
        />
        <Indicador
          rotulo="Sem movimento"
          icone="ignorado"
          carregando={carregando}
          valor={num(t?.paradas ?? 0)}
          detalhe={`De ${num(t?.ativas ?? 0)} ativas · ${num(t?.semLancamento ?? 0)} nunca tiveram lançamento`}
        />
        <Indicador
          rotulo="Esquecidas"
          icone="alerta"
          carregando={carregando}
          valor={num(t?.esquecidas ?? 0)}
          detalhe="Da carteira contábil, paradas entre 3 e 12 meses"
          tom={(t?.esquecidas ?? 0) > 0 ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Metade do movimento"
          icone="camadas"
          carregando={carregando}
          valor={num(t?.metadeEm ?? 0)}
          detalhe="Empresas concentram metade dos lançamentos"
        />
      </FaixaIndicadores>

      <Nota>
        Carteira contábil é a empresa ativa com lançamento nos últimos 12 meses. Quem só faz folha ou fiscal aqui fica
        fora da cobertura.
      </Nota>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PainelEscada
          titulo="Há quanto tempo cada empresa está parada"
          descricao="Carteira ativa pelo último lançamento de todos os tempos, não só do período"
          faixas={FAIXAS_PARADA}
          valores={d?.porFaixa}
          rotuloItem="Empresas"
          carregando={carregando}
        />
        {/* Empresa atendida por uma pessoa só depende dela; atendida por muitas
            pode estar sem dono. As duas pontas são conversa com o gestor. */}
        <PainelQuebra
          titulo="Quantas pessoas por empresa"
          descricao="Empresas pelo tamanho da equipe que lançou nelas"
          itens={porPessoas}
          corPadrao="var(--serie-5)"
          limite={5}
          carregando={carregando}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PainelQuebra
          titulo="Empresas com mais movimento"
          descricao="Onde o trabalho do período se concentrou"
          itens={topEmpresas}
          carregando={carregando}
          rodape={
            topEmpresas && topEmpresas.length > 12 ? (
              <Nota>Mostrando 12 de {num(topEmpresas.length)} atendidas. A lista inteira está logo abaixo.</Nota>
            ) : undefined
          }
          aoClicar={(i) => setAberta(d?.empresas.find((e) => String(e.codigo) === i.chave) ?? null)}
        />
        <CurvaConcentracao
          pontos={d?.pareto}
          descricao={
            t && t.metadeEm > 0
              ? `Metade dos lançamentos saiu de ${num(t.metadeEm)} ${t.metadeEm === 1 ? "empresa" : "empresas"}`
              : "Quanto do movimento cabe nas empresas mais ativas"
          }
          carregando={carregando}
        />
      </div>

      <TabelaCarteira
        linhas={d?.empresas}
        itens={lancamentosDe}
        faixas={FAIXAS_PARADA}
        rotuloItem="Lançamentos"
        rotuloPrincipal="Quem mais lançou"
        carregando={carregando}
        onLinha={setAberta}
      />

      <Modal
        aberto={aberta != null}
        onFechar={() => setAberta(null)}
        titulo={aberta?.nome ?? ""}
        descricao={aberta ? <span className="num">Empresa {aberta.codigo}</span> : undefined}
        rodape={<Botao onClick={() => setAberta(null)}>Fechar</Botao>}
      >
        {aberta && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Par rotulo="Situação">
              {aberta.ativa ? <Selo tom="ok">Ativa</Selo> : <Selo>Baixada</Selo>}
            </Par>
            <Par rotulo="Lançamentos no período">
              <span className="num font-[600]">{num(aberta.lancamentos)}</span>
            </Par>
            <Par rotulo="Valor no período">
              <span className="num">{brl(aberta.valor)}</span>
            </Par>
            <Par rotulo="Pessoas no período">
              <span className="num">{num(aberta.pessoas)}</span>
            </Par>
            <Par rotulo="Quem mais lançou" className="col-span-2">
              {aberta.principal ?? "Ninguém no período"}
            </Par>
            <Par rotulo="Último lançamento">
              <span className="num">{aberta.ultimo ? dataBR(aberta.ultimo) : "Nunca teve"}</span>
            </Par>
            <Par rotulo="Parada há">
              <span className="flex items-center gap-1.5">
                {faixaAberta && <span aria-hidden className="size-2 rounded-full" style={{ background: faixaAberta.cor }} />}
                <span className="num">{aberta.diasParada == null ? "Nunca teve lançamento" : `${num(aberta.diasParada)} dias`}</span>
              </span>
            </Par>
          </dl>
        )}
      </Modal>
    </>
  );
}
