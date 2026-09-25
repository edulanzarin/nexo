"use client";

import { useMemo, useState } from "react";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  alternarRecolhida,
  CelulaConta,
  recortarArvore,
  SeletorNivel,
  ValorConta,
  type LinhaPlano,
} from "@/componentes/produto/contabil/balancete/arvore-contas";
import { CabecalhoPapel } from "@/componentes/produto/contabil/balancete/cabecalho-papel";
import { Bloco, Variante } from "../bloco";

interface LinhaFalsa extends LinhaPlano {
  anterior: number;
  debito: number;
  credito: number;
  atual: number;
}

/** Um pedaço de plano plausível: devedor positivo, credor negativo. */
const PLANO_FALSO: LinhaFalsa[] = [
  { conta: 1, classif: "1", nivel: 1, descricao: "ATIVO", sintetica: true, anterior: 148240, debito: 384960.55, credito: 359955.4, atual: 173245.15 },
  { conta: 2, classif: "1.1", nivel: 2, descricao: "ATIVO CIRCULANTE", sintetica: true, anterior: 148240, debito: 384960.55, credito: 359955.4, atual: 173245.15 },
  { conta: 3, classif: "1.1.01", nivel: 3, descricao: "DISPONIVEL", sintetica: true, anterior: 49500, debito: 220880, credito: 206065.4, atual: 64314.6 },
  { conta: 5, classif: "1.1.01.001", nivel: 4, descricao: "CAIXA GERAL", sintetica: false, anterior: 1200, debito: 8400, credito: 7950, atual: 1650 },
  { conta: 16, classif: "1.1.01.002", nivel: 4, descricao: "BANCO VIACREDI C/C 12.345-6", sintetica: false, anterior: 48300, debito: 212480, credito: 198115.4, atual: 62664.6 },
  { conta: 30, classif: "1.1.02", nivel: 3, descricao: "CLIENTES", sintetica: true, anterior: 86400, debito: 154200, credito: 139870, atual: 100730 },
  { conta: 31, classif: "1.1.02.001", nivel: 4, descricao: "DUPLICATAS A RECEBER", sintetica: false, anterior: 86400, debito: 154200, credito: 139870, atual: 100730 },
  { conta: 380, classif: "1.1.04", nivel: 3, descricao: "TRIBUTOS A RECUPERAR", sintetica: true, anterior: 12340, debito: 9880.55, credito: 14020, atual: 8200.55 },
  { conta: 382, classif: "1.1.04.001", nivel: 4, descricao: "ICMS A RECUPERAR", sintetica: false, anterior: 12340, debito: 9880.55, credito: 14020, atual: 8200.55 },
  { conta: 200, classif: "2", nivel: 1, descricao: "PASSIVO", sintetica: true, anterior: -72620, debito: 126420, credito: 141350.3, atual: -87550.3 },
  { conta: 201, classif: "2.1", nivel: 2, descricao: "PASSIVO CIRCULANTE", sintetica: true, anterior: -72620, debito: 126420, credito: 141350.3, atual: -87550.3 },
  { conta: 210, classif: "2.1.01", nivel: 3, descricao: "FORNECEDORES", sintetica: true, anterior: -64500, debito: 118300, credito: 131900, atual: -78100 },
  { conta: 212, classif: "2.1.01.001", nivel: 4, descricao: "FORNECEDORES NACIONAIS", sintetica: false, anterior: -64500, debito: 118300, credito: 131900, atual: -78100 },
  { conta: 2830, classif: "2.1.03", nivel: 3, descricao: "OBRIGACOES TRIBUTARIAS", sintetica: true, anterior: -8120, debito: 8120, credito: 9450.3, atual: -9450.3 },
  { conta: 2835, classif: "2.1.03.001", nivel: 4, descricao: "ICMS A RECOLHER", sintetica: false, anterior: -8120, debito: 8120, credito: 9450.3, atual: -9450.3 },
];

/**
 * Peças de produto do Contábil que nasceram nas telas de Balancetes e Revisão
 * (balancete fiscal, balancete contábil, análise e auditoria). Cada uma entra
 * aqui como um <Bloco> com o porquê, no mesmo commit em que nasce.
 */
export function BlocosContabilBalancetes() {
  const [nivel, setNivel] = useState(4);
  const [recolhidas, setRecolhidas] = useState<string[]>(["2.1.03"]);
  const recolhidasSet = useMemo(() => new Set(recolhidas), [recolhidas]);
  const linhas = recortarArvore(PLANO_FALSO, nivel, recolhidasSet);

  const colunas: Coluna<LinhaFalsa>[] = [
    {
      id: "conta",
      cabecalho: "Conta",
      celula: (l) => (
        <CelulaConta
          linha={l}
          aberta={!recolhidasSet.has(l.classif)}
          onAlternar={
            l.sintetica && l.nivel < nivel ? () => setRecolhidas((r) => alternarRecolhida(r, l.classif)) : undefined
          }
        />
      ),
    },
    {
      id: "anterior",
      cabecalho: "Saldo anterior",
      alinhar: "dir",
      largura: "158px",
      celula: (l) => <ValorConta valor={l.anterior} natureza forte={l.sintetica} />,
    },
    {
      id: "debito",
      cabecalho: "Débito",
      alinhar: "dir",
      largura: "140px",
      celula: (l) => <ValorConta valor={l.debito} forte={l.sintetica} />,
    },
    {
      id: "credito",
      cabecalho: "Crédito",
      alinhar: "dir",
      largura: "140px",
      celula: (l) => <ValorConta valor={l.credito} forte={l.sintetica} />,
    },
    {
      id: "atual",
      cabecalho: "Saldo atual",
      alinhar: "dir",
      largura: "158px",
      celula: (l) => <ValorConta valor={l.atual} natureza forte={l.sintetica} />,
    },
  ];

  return (
    <>
      <Bloco
        titulo="Árvore do plano de contas"
        porque="O código reduzido vem primeiro e alinhado, como no balancete impresso do Questor, porque é ele que o analista digita lá. Depois a árvore, lida pelo recuo e pelo peso: sintética em negrito com a seta de recolher, analítica em tinta de apoio. O corte por nível abre no 3, como no Questor, e a busca da tela atravessa todos os níveis. Serve aos dois balancetes."
      >
        <Painel
          corpo="p-0"
          titulo="Balancete de Verificação"
          descricao="A seta de uma sintética recolhe e abre as filhas"
          acoes={<SeletorNivel nivelMax={4} valor={nivel} onMudar={setNivel} />}
        >
          <TabelaDados rotulo="Plano de contas de exemplo" colunas={colunas} linhas={linhas} chave={(l) => l.classif} />
        </Painel>
      </Bloco>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Saldo com natureza"
          porque="Saldo sai sem sinal, com D ou C ao lado, como o Questor imprime: sinal negativo num saldo credor lê-se como erro. Movimento de débito e crédito sai sem letra. Zero vira traço, para a coluna respirar."
          palco
        >
          <div className="flex flex-col items-end gap-3 text-corpo">
            <Variante nome="Saldo devedor">
              <ValorConta valor={62664.6} natureza />
            </Variante>
            <Variante nome="Saldo credor de sintética">
              <ValorConta valor={-87550.3} natureza forte />
            </Variante>
            <Variante nome="Movimento">
              <ValorConta valor={212480} />
            </Variante>
            <Variante nome="Zero">
              <ValorConta valor={0} natureza />
            </Variante>
          </div>
        </Bloco>

        <Bloco
          titulo="Cabeçalho do papel"
          porque="Na impressão a moldura some, e com ela a empresa, a filial e o período do topo. Relatório sem dizer de quem, de quando e com que recorte não se entrega a cliente, então a tela repõe tudo aqui: escondido na tela, visível no papel. No catálogo aparece na tela para ser visto."
        >
          <div className="nx-vidro rounded-painel p-5">
            <CabecalhoPapel
              naTela
              titulo="Análise de Balancete"
              empresa={{ codigo: 1318, nome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", cnpj: "12345678000195" }}
              itens={[
                { rotulo: "Período", valor: "junho de 2026 a agosto de 2026 (3 meses)" },
                { rotulo: "Filiais", valor: "Todas, consolidado" },
                { rotulo: "Dados de", valor: "02/09/2026 09:41" },
              ]}
            />
          </div>
        </Bloco>
      </div>
    </>
  );
}
