"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao } from "@/componentes/primitivos/tabela";
import { CorpoNotaConferida } from "@/componentes/produto/contabil/detalhe-nota-conferida";
import { MarcaNatureza, Partida } from "@/componentes/produto/contabil/partida";
import { SITUACAO_NOTA, SeloSituacao } from "@/componentes/produto/contabil/situacao-nota";
import { legendaNota } from "@/componentes/produto/notas/bloco-detalhe";
import { ListaContrapartes } from "@/componentes/produto/notas/contrapartes";
import { CorpoNotaLista, TituloNota } from "@/componentes/produto/notas/detalhe-nota";
import { TabelaItensNota } from "@/componentes/produto/notas/itens-nota";
import { TabelaNotas } from "@/componentes/produto/notas/tabela-notas";
import type { ContraparteBusca, NotaConferida, NotaItem, NotaLista, SituacaoNota } from "@/lib/types";
import { Bloco } from "../bloco";

/*
 * Peças de produto do Contábil que nasceram nas telas da Rotina (Conferência,
 * Plano de contabilização, Notas e Central de pendências). Cada uma entra aqui
 * com o porquê, no mesmo commit em que nasce. Dado de mentira: nomes e números
 * plausíveis, nada do Questor.
 */

const ITENS: NotaItem[] = [
  { seq: 1, produto: 10442, descricao: "FARINHA DE TRIGO TIPO 1 50KG", cfop: 1102, cfopDescr: "Compra para comercialização", unidade: "SC", quantidade: 40, valorUnitario: 142.9, valorTotal: 5716, icms: 685.92, ipi: 0 },
  { seq: 2, produto: 10518, descricao: "ACUCAR CRISTAL 25KG", cfop: 1102, cfopDescr: "Compra para comercialização", unidade: "SC", quantidade: 18, valorUnitario: 98.4, valorTotal: 1771.2, icms: 212.54, ipi: 0 },
  { seq: 3, produto: 20031, descricao: "FERMENTO BIOLOGICO SECO 500G", cfop: 1102, cfopDescr: "Compra para comercialização", unidade: "UN", quantidade: 64, valorUnitario: 12.35, valorTotal: 790.4, icms: 94.85, ipi: 0 },
  { seq: 4, produto: 30870, descricao: "EMBALAGEM PLASTICA PAO FRANCES", cfop: 1556, cfopDescr: "Compra de material para uso ou consumo", unidade: "KG", quantidade: 12.5, valorUnitario: 21.8, valorTotal: 272.5, icms: 0, ipi: 13.63 },
];

const BASE_NOTA: Omit<NotaConferida, "situacao" | "divergencias" | "duplicidade" | "consolidacao" | "lancamentos"> = {
  chave: "918273",
  numero: 48211,
  serie: "1",
  especie: "NFE",
  data: "2026-08-14",
  valor: 8550.1,
  contraparte: "DISTRIBUIDORA SUL BRASIL LTDA",
  doc: "12345678000190",
  uf: "SC",
  cfops: [1102, 1556],
};

const NOTAS_CONFERIDAS: Record<"divergente" | "duplicada" | "consolidada", NotaConferida> = {
  divergente: {
    ...BASE_NOTA,
    situacao: "divergente",
    lancamentos: 3,
    duplicidade: null,
    consolidacao: null,
    divergencias: [
      {
        tipo: "conta",
        natureza: 1,
        componente: "valor",
        detalhe: "lançado em 318 ENERGIA ELETRICA, o plano pede 1204 ESTOQUE DE MERCADORIAS",
        contaEsperada: 1204,
        contaLancada: 318,
        valorEsperado: 8550.1,
        valorLancado: 8550.1,
      },
      {
        tipo: "faltando",
        natureza: -1,
        componente: "icms",
        detalhe: "ICMS a recuperar de R$ 993,31 sem lançamento em 1320",
        contaEsperada: 1320,
        contaLancada: null,
        valorEsperado: 993.31,
        valorLancado: null,
      },
    ],
  },
  duplicada: {
    ...BASE_NOTA,
    situacao: "duplicada",
    lancamentos: 6,
    divergencias: [],
    consolidacao: null,
    duplicidade: { vezes: 2, valor: 8550.1, datas: ["2026-08-15", "2026-08-29"] },
  },
  consolidada: {
    ...BASE_NOTA,
    especie: "NFCE",
    contraparte: "CONSUMIDOR FINAL",
    doc: null,
    cfops: [5102],
    situacao: "consolidada",
    lancamentos: 0,
    divergencias: [],
    duplicidade: null,
    consolidacao: {
      contas: [
        { conta: 5, descr: "CAIXA GERAL" },
        { conta: 402, descr: "RECEITA DE VENDAS" },
      ],
      lancamentos: [
        { data: "2026-08-31", origem: "MOVMS202608000001", contaDeb: 5, contaCred: 402, valor: 184320.55 },
        { data: "2026-08-31", origem: "MOVMS202608000002", contaDeb: 5, contaCred: 402, valor: 12004.1 },
      ],
      qtd: 5,
    },
  },
};

const NOTAS_LISTA: NotaLista[] = [
  { empresa: 1318, empresaNome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", chave: "71001", numero: 48232, serie: "1", especie: "NFE", modelo: "55", data: "2026-08-29", contraparte: "ATACADAO DISTRIBUICAO COM E IND", contraparteDoc: "75315333000109", uf: "SC", valor: 12480, cancelada: false, chaveNfe: "42260875315333000109550010000482321000710010" },
  { empresa: 1318, empresaNome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", chave: "71002", numero: 48225, serie: "1", especie: "NFE", modelo: "55", data: "2026-08-27", contraparte: "COOPERATIVA AGROINDUSTRIAL ALFA", contraparteDoc: "83305235000170", uf: "SC", valor: 3380.45, cancelada: true, chaveNfe: null },
  { empresa: 1318, empresaNome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", chave: "71003", numero: 9981, serie: "2", especie: "CTE", modelo: "57", data: "2026-08-26", contraparte: "TRANSPORTADORA TRES IRMAOS", contraparteDoc: "04852166000138", uf: "PR", valor: 640, cancelada: false, chaveNfe: null },
  { empresa: 1318, empresaNome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", chave: "71004", numero: 1204, serie: null, especie: "NFSE", modelo: null, data: "2026-08-20", contraparte: "TOTVS S/A", contraparteDoc: "53113791000122", uf: "SP", valor: 1890, cancelada: false, chaveNfe: null },
];

const CONTRAPARTES: ContraparteBusca[] = [
  { codigo: 881, nome: "ATACADAO DISTRIBUICAO COM E IND", doc: "75315333000109", uf: "SC", qtd: 42 },
  { codigo: 1203, nome: "COOPERATIVA AGROINDUSTRIAL ALFA", doc: "83305235000170", uf: "SC", qtd: 17 },
  { codigo: 1590, nome: "DISTRIBUIDORA SUL BRASIL LTDA", doc: "12345678000190", uf: "RS", qtd: 9 },
  { codigo: 2210, nome: "JOAO CARLOS PEREIRA", doc: "12345678909", uf: null, qtd: 1 },
];

export function BlocosContabilRotina() {
  const [caso, setCaso] = useState<"divergente" | "duplicada" | "consolidada">("divergente");
  const [notaSel, setNotaSel] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const nota = NOTAS_CONFERIDAS[caso];

  return (
    <>
      <Bloco
        titulo="Situação da nota"
        porque="Uma fonte só para rótulo e tom da situação na conferência: a linha, o filtro, o detalhe e a planilha exportada dizem a mesma palavra. Em bloco não é problema: a nota não tem lançamento próprio, mas a consolidação do varejo cobre as contas dela."
      >
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(SITUACAO_NOTA) as SituacaoNota[]).map((s) => (
            <SeloSituacao key={s} situacao={s} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Partida do plano"
        porque="D ou C antes de toda conta citada, com a palavra no título: é por onde o analista começa a procurar no Questor. Conta variável é a do fornecedor ou do cliente, que só existe na nota, então não tem número."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Partida natureza={1} conta={1204} descricao="ESTOQUE DE MERCADORIAS" />
          <Partida natureza={1} conta={1320} descricao="ICMS A RECUPERAR" />
          <Partida natureza={-1} conta={null} variavel />
          <Partida natureza={-1} conta={2104} />
          <span className="flex items-center gap-2 text-corpo text-tinta-2">
            <MarcaNatureza natureza={1} /> débito
            <MarcaNatureza natureza={-1} /> crédito
          </span>
        </div>
      </Bloco>

      <Bloco
        titulo="Itens da Nota"
        porque="A soma de total, ICMS e IPI respeita o filtro de produto: quem filtra quer saber quanto deu naquele item. Serve o detalhe do explorador (Fiscal e Contábil) e o da conferência; a consulta dos itens vai pela rota do módulo, que registra a abertura na trilha."
      >
        <div className="nx-vidro rounded-painel p-4">
          <TabelaItensNota itens={ITENS} />
        </div>
      </Bloco>

      <Bloco
        titulo="Detalhe da nota conferida"
        porque="O fato que explica a situação vem primeiro e é o único trecho com fundo: lançada duas vezes, entrou em bloco. Depois as divergências contra o plano, com o lado de cada uma, e os itens. Serve a Conferência e a Central de pendências, que põe a triagem antes dos itens."
      >
        <div className="flex flex-col gap-3">
          <Segmentado
            rotulo="Caso"
            opcoes={[
              { valor: "divergente", rotulo: "Conta errada" },
              { valor: "duplicada", rotulo: "Duplicada" },
              { valor: "consolidada", rotulo: "Em bloco" },
            ]}
            valor={caso}
            onMudar={setCaso}
          />
          <PainelModal
            estatico
            largura="xg"
            titulo={<TituloNota contraparte={nota.contraparte} />}
            descricao={legendaNota(nota)}
            onFechar={() => {}}
            rodape={<Botao variante="fantasma">Fechar</Botao>}
          >
            <CorpoNotaConferida nota={nota} itens={<TabelaItensNota itens={ITENS.slice(0, 2)} />} />
          </PainelModal>
        </div>
      </Bloco>

      <Bloco
        titulo="Explorador de notas"
        porque="A lista bruta do período, uma nota por linha e o detalhe no clique. Sem ordenar pelo cabeçalho: o servidor pagina de 50 em 50, e reordenar só a página à vista mentiria sobre o conjunto. Cancelada fica na lista, apagada e riscada, para o cancelamento não sumir de quem confere. O mesmo explorador serve o Fiscal, com a coluna de empresa."
      >
        <Painel corpo="p-0" titulo="Notas" descricao="1.284 notas, a mais recente primeiro">
          <TabelaNotas
            linhas={NOTAS_LISTA}
            tipo="ent"
            onLinha={(n) => setNotaSel(n.chave)}
            selecionada={(n) => n.chave === notaSel}
          />
          <div className="border-t border-linha px-4 py-2">
            <Paginacao pagina={pagina} porPagina={50} total={1284} onPagina={setPagina} />
          </div>
        </Painel>
      </Bloco>

      <Bloco
        titulo="Detalhe da nota do explorador"
        porque="O que não cabe na linha: documento, modelo, a chave de acesso de 44 dígitos (com cópia num clique) e os itens. Nota cancelada leva o selo no título e o valor riscado."
      >
        <PainelModal
          estatico
          largura="xg"
          titulo={<TituloNota contraparte={NOTAS_LISTA[0].contraparte} cancelada={NOTAS_LISTA[0].cancelada} />}
          descricao={legendaNota({ ...NOTAS_LISTA[0], doc: null })}
          onFechar={() => {}}
          rodape={<Botao variante="fantasma">Fechar</Botao>}
        >
          <CorpoNotaLista nota={NOTAS_LISTA[0]} itens={<TabelaItensNota itens={ITENS} />} />
        </PainelModal>
      </Bloco>

      <Bloco
        titulo="Filtro por contraparte"
        porque="Só aparece quem tem nota no recorte, com quantas notas tem. Um campo livre deixaria digitar um nome que não existe no período e descobrir depois, com a tabela vazia. A busca é no servidor, de 20 em 20: há empresa com milhares de fornecedores."
      >
        <PainelModal estatico titulo="Filtrar por Contraparte" descricao="Fornecedores com nota no recorte" onFechar={() => {}}>
          <ListaContrapartes linhas={CONTRAPARTES} selecionada={1203} onEscolher={() => {}} />
        </PainelModal>
      </Bloco>
    </>
  );
}
