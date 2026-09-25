"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import {
  CLASSES_FAMILIA,
  PontoFamilia,
  somaFamilia,
} from "@/componentes/produto/folha/produtividade-familias";
import { QuemFezPorFamilia } from "@/componentes/produto/folha/produtividade-quem-fez";
import { CorpoRegistros } from "@/componentes/produto/folha/produtividade-registros";
import { Legenda } from "@/componentes/produto/graficos";
import { Variacao } from "@/componentes/produto/produtividade/variacao";
import { num } from "@/lib/format";
import { DP_FAMILIAS, DP_TIPOS, zeroPorTipo, type DpColaborador, type DpLinha, type DpPorTipo } from "@/lib/dp-tipos";
import { Bloco, Variante } from "../bloco";
import { EMPRESAS_FALSAS, PESSOAS_FALSAS } from "../dados-falsos";

/*
 * Peças da Produtividade do DP. O resto da tela (filtro por pessoa, ranking,
 * composição, quebras, detalhe de um trabalho) é montado com as peças da
 * Produtividade do Contábil; aqui só o que o DP criou. Tudo com dado de mentira.
 */

function colaborador(
  codigo: number,
  nome: string,
  contagens: Partial<DpPorTipo>,
  extra: { auto?: boolean; inativo?: boolean } = {}
): DpColaborador {
  const porTipo = { ...zeroPorTipo(), ...contagens };
  return {
    codigo,
    nome,
    auto: !!extra.auto,
    inativo: !!extra.inativo,
    porTipo,
    total: DP_TIPOS.reduce((a, t) => a + porTipo[t.id], 0),
  };
}

const RANKING: DpColaborador[] = [
  colaborador(101, PESSOAS_FALSAS[0].nome, {
    admissoes: 18, rescisoes: 9, avisos: 7, ferias: 22, folha: 41, encargos: 12, esocialcalc: 12, salarios: 6, esocial: 30,
  }),
  colaborador(102, PESSOAS_FALSAS[1].nome, { folha: 88, encargos: 31, esocialcalc: 29, provisoes: 4, esocial: 14 }),
  colaborador(103, PESSOAS_FALSAS[2].nome, {
    admissoes: 34, rescisoes: 21, avisos: 16, afastamentos: 9, cargos: 5, esocial: 12,
  }),
  colaborador(104, PESSOAS_FALSAS[3].nome, { ferias: 46, afastamentos: 14, salarios: 11, esocial: 8 }),
  colaborador(105, PESSOAS_FALSAS[4].nome, { folha: 22, encargos: 8, esocialcalc: 7, esocial: 26 }),
  colaborador(106, PESSOAS_FALSAS[5].nome, { rescisoes: 6, avisos: 4, ferias: 9 }, { inativo: true }),
  colaborador(0, "Sistema (automático)", { esocial: 61, esocialcalc: 3 }, { auto: true }),
];

const TOTAIS = RANKING.reduce<DpPorTipo>((soma, c) => {
  for (const t of DP_TIPOS) soma[t.id] += c.porTipo[t.id];
  return soma;
}, zeroPorTipo());
const ANTERIOR: Record<string, number> = { movimentacao: 98, ferias: 91, folha: 301, cadastro: 38, esocial: 0 };

const empresa = (i: number) => EMPRESAS_FALSAS[i % EMPRESAS_FALSAS.length];

const RESCISOES: DpLinha[] = [
  ["Pedido de demissão", "2026-08-03", "2026-09-02", "2026-09-02T09:14:00", 101],
  ["Dispensa sem justa causa", "2026-08-12", "2026-09-11", "2026-09-01T16:40:00", 103],
  ["Término de contrato de experiência", null, "2026-08-29", "2026-08-29T11:02:00", 103],
  ["Dispensa sem justa causa", "2026-07-30", "2026-08-28", "2026-08-28T08:55:00", 106],
  ["Acordo entre as partes", "2026-08-20", "2026-08-27", "2026-08-27T14:31:00", 101],
  ["Pedido de demissão", "2026-07-28", "2026-08-26", "2026-08-26T10:08:00", 103],
].map(([causa, dataAviso, dataResc, quando, codigo], i) => ({
  codigoempresa: empresa(i + 1).codigo,
  empresa: empresa(i + 1).nome,
  contrato: 300 + i,
  funcionario: ["JOSE CARLOS DA SILVA", "MARIA APARECIDA PEREIRA", "LUCAS HENRIQUE SOUZA", "PATRICIA FERNANDES", "RAFAEL MOREIRA LIMA", "JULIANA OLIVEIRA SANTOS"][i],
  usuario: RANKING.find((c) => c.codigo === codigo)!.nome,
  codigousuario: codigo as number,
  quando: quando as string,
  causa: causa as string,
  dataAviso: dataAviso as string | null,
  dataResc: dataResc as string,
}));

const ENVIOS: DpLinha[] = [
  ["S-1200", "2026-09-05T08:02:00", 0],
  ["S-1210", "2026-09-05T08:02:00", 0],
  ["S-2200", "2026-09-04T15:47:00", 103],
  ["S-1299", "2026-09-04T11:20:00", 101],
  ["S-2299", "2026-09-03T17:05:00", 103],
].map(([evento, quando, codigo], i) => ({
  codigoempresa: empresa(i + 2).codigo,
  empresa: empresa(i + 2).nome,
  contrato: 0,
  funcionario: "",
  usuario: codigo === 0 ? "ADMINISTRADOR" : RANKING.find((c) => c.codigo === codigo)!.nome,
  codigousuario: codigo as number,
  quando: quando as string,
  evento: evento as string,
}));

export function BlocosDpProdutividade() {
  const [pessoa, setPessoa] = useState<number | null>(null);

  return (
    <>
      <Bloco
        titulo="Cores das famílias do DP"
        porque="A cor é da família e o trabalho herda a dela, porque doze trabalhos numa paleta de seis repetiriam cor e duas barras iguais num empilhado parecem a mesma coisa; o eSocial saiu do azul do nexo2 porque no NaveX esse azul é o mesmo token da Movimentação."
      >
        <div className="flex flex-col gap-4">
          <Legenda itens={CLASSES_FAMILIA.map((c) => ({ rotulo: c.rotulo, cor: c.cor }))} />
          <FaixaIndicadores colunas={5}>
            {DP_FAMILIAS.map((f) => {
              const atual = somaFamilia(TOTAIS, f.id);
              const anterior = ANTERIOR[f.id];
              return (
                <Indicador
                  key={f.id}
                  rotulo={
                    <>
                      <PontoFamilia familia={f.id} className="mr-1.5" />
                      {f.rotulo}
                    </>
                  }
                  valor={num(atual)}
                  detalhe={
                    anterior > 0 ? (
                      <>
                        <Variacao atual={atual} anterior={anterior} /> · {num(anterior)} no anterior
                      </>
                    ) : (
                      "Nada no período anterior"
                    )
                  }
                />
              );
            })}
          </FaixaIndicadores>
        </div>
      </Bloco>

      <Bloco
        titulo="Quem fez por família"
        porque="Uma barra por pessoa empilhada pelas famílias, porque duas pessoas com o mesmo total podem ter meses opostos (uma fechando folha, outra admitindo e demitindo); quem está isolado e ficou fora do topo entra no fim da lista para não sumir justo daqui."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <QuemFezPorFamilia
            descricao={pessoa ? "Clique de novo para voltar ao time" : "Clique numa pessoa para isolar o resto da tela"}
            pessoas={RANKING}
            selecionada={pessoa}
            onSelecionar={setPessoa}
            limite={5}
          />
          <div className="flex flex-col gap-4">
            <Variante nome="Carregando">
              <QuemFezPorFamilia pessoas={undefined} carregando selecionada={null} onSelecionar={() => {}} />
            </Variante>
            <Variante nome="Vazio">
              <QuemFezPorFamilia pessoas={[]} selecionada={null} onSelecionar={() => {}} />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Registros de um trabalho"
        porque="Uma linha por registro com as colunas que a fonte tem (causa e datas na rescisão, eSocial na admissão, o evento no lugar do funcionário no eSocial transmitido, cuja fonte não tem contrato), consultada só ao abrir porque quase ninguém que olha a aba precisa dela."
      >
        <div className="flex flex-col gap-4">
          <PainelModal
            estatico
            largura="xg"
            titulo="Registros"
            descricao="Rescisões · Time todo"
            onFechar={() => {}}
            rodape={
              <>
                <Botao icone="baixar">Exportar</Botao>
                <Botao>Fechar</Botao>
              </>
            }
          >
            <CorpoRegistros tipo="rescisoes" linhas={RESCISOES} />
          </PainelModal>
          <Variante nome="eSocial transmitido, sem contrato">
            <Painel corpo="p-4">
              <CorpoRegistros tipo="esocial" linhas={ENVIOS} />
            </Painel>
          </Variante>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Variante nome="Carregando">
              <Painel>
                <CorpoRegistros tipo="admissoes" linhas={undefined} />
              </Painel>
            </Variante>
            <Variante nome="Vazio">
              <Painel>
                <CorpoRegistros tipo="ferias" linhas={[]} />
              </Painel>
            </Variante>
            <Variante nome="Erro">
              <Painel>
                <CorpoRegistros
                  tipo="folha"
                  linhas={undefined}
                  erro="Tempo esgotado ao consultar o Questor."
                  onTentar={() => {}}
                />
              </Painel>
            </Variante>
          </div>
        </div>
      </Bloco>
    </>
  );
}
