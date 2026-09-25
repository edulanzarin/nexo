"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Rotulado } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { CampoNumero } from "@/componentes/produto/contabil/campo-numero";
import { ContaTexto } from "@/componentes/produto/contabil/conta-texto";
import { EnvioArquivo, JanelaSenha } from "@/componentes/produto/contabil/envio-arquivo";
import { Selo } from "@/componentes/primitivos/selo";
import { DescricaoExtrato } from "@/componentes/produto/contabil/descricao-extrato";
import {
  RegraExtratoEstatica,
  termoDaDescricao,
  type LinhaExtrato,
} from "@/componentes/produto/contabil/regra-extrato";
import { RodapeGeracao } from "@/componentes/produto/contabil/rodape-geracao";
import { FichaFolha, SeloFolha } from "@/componentes/produto/contabil/selo-folha";
import { SeletorHistorico } from "@/componentes/produto/contabil/seletor-historico";
import { brl, num } from "@/lib/format";
import type { SeloFolha as DadosFolha } from "@/lib/folha-casamento";
import type { RegraExtratoDTO } from "@/lib/types";
import { Bloco, Variante } from "../bloco";

/*
 * Peças de produto do Contábil que nasceram na Conciliação bancária e na
 * Implantação: as telas que executam pelo arquivo. Cada uma entra aqui com o
 * porquê, no mesmo commit em que nasce. Dado de mentira, nada do Questor.
 */

const FOLHA: Record<"funcionario" | "ex" | "outra" | "talvez", DadosFolha> = {
  funcionario: {
    nome: "MARIANA COSTA RIBEIRO",
    empresa: 1200,
    contrato: 184,
    via: "cpf",
    mesmaEmpresa: true,
    dataadm: "2021-03-02",
    datadem: null,
    homonimos: 0,
  },
  ex: {
    nome: "JOAO PEDRO ALVES",
    empresa: 1200,
    contrato: 97,
    via: "nome",
    mesmaEmpresa: true,
    dataadm: "2019-05-13",
    datadem: "2026-06-30",
    homonimos: 0,
  },
  outra: {
    nome: "CARLA SOUZA MENDES",
    empresa: 1318,
    empresaNome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA",
    contrato: 42,
    via: "cpf",
    mesmaEmpresa: false,
    dataadm: "2023-01-09",
    datadem: null,
    homonimos: 0,
  },
  talvez: {
    nome: "ANA PAULA SILVA",
    empresa: 1200,
    contrato: 211,
    via: "parcial",
    mesmaEmpresa: true,
    dataadm: "2024-08-01",
    datadem: null,
    homonimos: 2,
  },
};

const REGRA: RegraExtratoDTO = {
  id: 1,
  termo: "ENERGISA",
  termoOriginal: "ENERGISA",
  tipo: "parcial",
  contaPagamento: 318,
  contaRecebimento: null,
  descrPagamento: "ENERGIA ELETRICA",
  descrRecebimento: null,
  historico: "PAGTO ENERGIA ELETRICA",
  ativo: true,
};

const AMOSTRA: LinhaExtrato[] = [
  { descricao: "PIX ENVIADO MAGALHAES COM 12/08" },
  { descricao: "PIX ENVIADO MAGALHAES COM 19/08" },
  { descricao: "TED RECEBIDA MAGALHAES COMERCIO" },
  { descricao: "PAGTO ENERGISA SC" },
  { descricao: "TARIFA PACOTE SERVICOS" },
  { descricao: "PIX RECEBIDO CLINICA SORRISO VIVO" },
  { descricao: "PIX ENVIADO MAGALHAES COM 26/08" },
];

/** Extrato que imprime o complemento embaixo do histórico, como o Sicoob. */
const COM_COMPLEMENTO: LinhaExtrato[] = [
  {
    descricao: "DÉB.TRANSF.CONTAS DIF.TITULARIDADE",
    complemento: "FAV.: JOSE AUGUSTO MOREIRA Distribuicao lucros socio Jose A.Moreira",
  },
  { descricao: "DÉB.TRANSF.CONTAS DIF.TITULARIDADE", complemento: "FAV.: JOSE AUGUSTO MOREIRA" },
  {
    descricao: "DÉB.TRANSF.CONTAS DIF.TITULARIDADE",
    complemento: "FAV.: MARTA ROSA MOREIRA Distribuicao lucros socia Marta R.Moreira",
  },
  { descricao: "CRÉD.TRANSF.CONTAS", complemento: "REM.: CLINICA SORRISO VIVO LTDA" },
  { descricao: "DÉB.CONV.TRIBUTOS FEDERAIS - RFB" },
];

const HISTORICOS = [
  { codigo: 1, descricao: "VALOR REF. PAGAMENTO", pedeComplemento: true },
  { codigo: 12, descricao: "RECEBIMENTO DE CLIENTES", pedeComplemento: false },
  { codigo: 350, descricao: "VALOR REFERENTE", pedeComplemento: true },
  { codigo: 351, descricao: "SALDO DE IMPLANTACAO", pedeComplemento: false },
];

/** Arquivo de mentira com tamanho plausível: a linha mostra o tamanho. */
function arquivoFalso(nome: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nome);
}

export function BlocosContabilConciliacao() {
  const qc = useQueryClient();
  // O catálogo não tem sessão: as peças que perguntam ao servidor encontram o
  // cache já preenchido, e desenham como desenhariam com o Questor.
  useState(() => {
    qc.setQueryData(["conta", 1200, 318], [
      { conta: 318, descricao: "ENERGIA ELETRICA", classificacao: "4.1.02.004.0007", natureza: "D" },
    ]);
    qc.setQueryData(["conta", 1200, 212], [
      { conta: 212, descricao: "FORNECEDORES NACIONAIS", classificacao: "2.1.01.001.0001", natureza: "C" },
    ]);
    qc.setQueryData(["historicos", ""], HISTORICOS);
    qc.setQueryData(["historico", 350], HISTORICOS);
    return true;
  });

  const [extrato] = useState(() => arquivoFalso("extrato-viacredi-agosto.ofx", 48_210));
  const [balancete] = useState(() => arquivoFalso("balancete-dez-2025-contabilidade-anterior.pdf", 1_240_000));
  const [vivo, setVivo] = useState<File | null>(null);
  const [vivoLido, setVivoLido] = useState<File | null>(null);
  const [historico, setHistorico] = useState<number | null>(350);
  const [valor, setValor] = useState(12480.5);
  const [senhaAberta, setSenhaAberta] = useState(true);
  const [filial, setFilial] = useState<string | null>("1");

  return (
    <>
      <Bloco
        titulo="Envio de arquivo"
        porque="A porta das telas que executam pelo arquivo (extrato, balancete, relatório de bens). Escolher não processa: só guarda, e quem lê é o botão, que diz se o que está na tela é deste arquivo. Soltar o arquivo errado não pode custar uma leitura nem apagar a prévia já conferida. Vazia, é a zona grande que ensina; com arquivo, vira uma linha e o resultado ocupa a tela."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Viva: solte um arquivo e leia">
            <EnvioArquivo
              aceita=".ofx,.qfx,.pdf"
              arquivo={vivo}
              lido={vivo != null && vivoLido === vivo}
              onArquivo={(f) => setVivo(f)}
              onLer={() => setVivoLido(vivo)}
              rotuloLer="Ler extrato"
              titulo="Solte o extrato do banco"
              descricao="OFX ou PDF da conta escolhida acima"
              icone="banco"
            />
          </Variante>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Escolhido, ainda não lido: o botão é o primário da tela">
              <EnvioArquivo
                aceita=".ofx"
                arquivo={extrato}
                lido={false}
                onArquivo={() => {}}
                onLer={() => {}}
                rotuloLer="Ler extrato"
                titulo=""
              />
            </Variante>
            <Variante nome="Lido: reler vira ação de apoio">
              <EnvioArquivo
                aceita=".ofx"
                arquivo={extrato}
                lido
                onArquivo={() => {}}
                onLer={() => {}}
                rotuloLer="Ler extrato"
                titulo=""
              />
            </Variante>
            <Variante nome="Falta o que a leitura pede">
              <EnvioArquivo
                aceita=".ofx"
                arquivo={extrato}
                lido={false}
                bloqueio="Escolha a conta do banco para ler"
                onArquivo={() => {}}
                onLer={() => {}}
                rotuloLer="Ler extrato"
                titulo=""
              />
            </Variante>
            <Variante nome="Lendo">
              <EnvioArquivo
                aceita=".pdf"
                arquivo={balancete}
                lido={false}
                lendo
                onArquivo={() => {}}
                onLer={() => {}}
                rotuloLer="Ler balancete"
                titulo=""
              />
            </Variante>
            <Variante nome="PDF trancado: a senha se pede numa janela" className="xl:col-span-2">
              <EnvioArquivo
                aceita=".pdf"
                arquivo={balancete}
                lido={false}
                onArquivo={() => {}}
                onLer={() => {}}
                rotuloLer="Ler balancete"
                titulo=""
                senha={{ protegido: true, valor: "", onMudar: () => {} }}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Senha do PDF"
        porque="Janela e não campo fixo na linha: a maioria dos extratos não tem senha, e um campo sempre à vista seria ruído para todos eles. Abre sozinha quando o PDF escolhido está trancado ou quando o servidor recusa a senha."
      >
        <div className="flex flex-wrap items-start gap-4">
          {senhaAberta ? (
            <JanelaSenha estatico onConfirmar={() => setSenhaAberta(false)} onFechar={() => setSenhaAberta(false)} />
          ) : (
            <Botao icone="chave" onClick={() => setSenhaAberta(true)}>
              Mostrar a janela
            </Botao>
          )}
        </div>
      </Bloco>

      <Bloco
        titulo="Selo da folha"
        porque="Carimba a linha do extrato quando o favorecido é gente da casa. Três leituras, porque levam a decisões diferentes: funcionário (comissão dele não é serviço de terceiro), ex-funcionário (acerto depois do desligamento passa batido) e de outra empresa da carteira (o que mais confunde em grupo econômico). Nome parecido e homônimo viram dúvida explícita: o selo nunca afirma mais do que sabe, e nunca decide conta."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Na linha: curto, a pessoa e o motivo na dica">
            <div className="flex flex-wrap items-center gap-2">
              <SeloFolha selo={FOLHA.funcionario} />
              <SeloFolha selo={FOLHA.ex} />
              <SeloFolha selo={FOLHA.outra} />
              <SeloFolha selo={FOLHA.talvez} />
            </div>
          </Variante>
          <Variante nome="No detalhe do lançamento: nada escondido em dica">
            <div className="nx-vidro flex max-w-3xl flex-col gap-5 rounded-painel p-4">
              <FichaFolha selo={FOLHA.outra} />
              <FichaFolha selo={FOLHA.talvez} />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Descrição do extrato"
        porque="O histórico em cima e o complemento embaixo, como o banco imprime. O histórico se repete no extrato inteiro (toda transferência a sócio é DÉB.TRANSF.CONTAS); quem separa a conta é o favorecido da linha de baixo, então ele fica à vista e não escondido numa dica. Os selos da linha vão ao lado do histórico."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Variante nome="Com complemento">
            <div className="nx-vidro flex flex-col rounded-painel px-3 py-1">
              {COM_COMPLEMENTO.slice(0, 4).map((l, i) => (
                <DescricaoExtrato key={i} descricao={l.descricao} complemento={l.complemento}>
                  {i === 2 && <Selo tom="atencao">Sem regra</Selo>}
                </DescricaoExtrato>
              ))}
            </div>
          </Variante>
          <Variante nome="Banco que não imprime complemento: a linha não cresce">
            <div className="nx-vidro flex flex-col rounded-painel px-3 py-1">
              {AMOSTRA.slice(2, 6).map((l, i) => (
                <DescricaoExtrato key={i} descricao={l.descricao} />
              ))}
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Regra do extrato"
        porque="Janela e não linha editável: a regra tem seis campos, e uma linha com dois seletores de conta e um texto livre deixa de ser leitura. Serve a aba Regras e a Importação, onde nasce da linha que não casou: o termo já vem sem a data do fim (que muda todo mês) e a janela conta quantas linhas do extrato ele casaria, antes de salvar. Quando a linha tem complemento, o termo nasce dele, sem o FAV.: do banco: pelo histórico, a regra levaria toda transferência do extrato para a mesma conta, calada. Os dois ficam oferecidos embaixo do campo."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Nova, a partir da linha do extrato">
            <RegraExtratoEstatica
              empresa={1200}
              conta={16}
              descricaoConta="BANCO VIACREDI C/C 12.345-6"
              inicial={{ termo: termoDaDescricao(AMOSTRA[0].descricao), contaPagamento: 212 }}
              amostra={AMOSTRA}
              onFechar={() => {}}
            />
          </Variante>
          <Variante nome="Nova, de linha com complemento: o termo é o favorecido">
            <RegraExtratoEstatica
              empresa={1200}
              conta={16}
              descricaoConta="BANCO SICOOB C/C 37.123-4"
              inicial={{ termo: "JOSE AUGUSTO MOREIRA", contaPagamento: 212 }}
              linha={COM_COMPLEMENTO[0]}
              amostra={COM_COMPLEMENTO}
              onFechar={() => {}}
            />
          </Variante>
          <Variante nome="Editando: apagar pede confirmação">
            <RegraExtratoEstatica
              empresa={1200}
              conta={16}
              descricaoConta="BANCO VIACREDI C/C 12.345-6"
              regra={REGRA}
              onFechar={() => {}}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Histórico padrão"
        porque="Escolhe o histórico do Questor buscando por número ou descrição: são perto de dez mil, do escritório e não da empresa, e o código digitado à mão pode não existir. Diz quando o histórico pede complemento, que é o que decide se a tela mostra o campo de texto."
      >
        <div className="flex max-w-md flex-col gap-2">
          <Rotulado rotulo="Histórico">
            <SeletorHistorico valor={historico} onMudar={(h) => setHistorico(h?.codigo ?? null)} limpavel />
          </Rotulado>
        </div>
      </Bloco>

      <Bloco
        titulo="Rodapé de geração"
        porque="O fim das telas que geram arquivo para o Questor: o que vai, ou o que falta, colado no botão que gera. É ali que a pessoa decide; um aviso lá no topo seria lido depois do clique."
      >
        <div className="flex flex-col gap-3">
          <RodapeGeracao estado="ok" mensagem={`${num(142)} lançamentos vão para o arquivo`}>
            <span className="text-pequeno text-apagado">Filial</span>
            <Combo
              className="w-56"
              rotuloAcessivel="Filial do arquivo"
              opcoes={[
                { valor: "1", rotulo: "Matriz · Jaraguá do Sul", detalhe: "1" },
                { valor: "2", rotulo: "Filial · Joinville", detalhe: "2" },
              ]}
              valor={filial}
              onMudar={setFilial}
            />
            <Botao variante="primario" icone="baixar">
              Gerar CSV do Questor
            </Botao>
          </RodapeGeracao>
          <RodapeGeracao estado="atencao" mensagem="Falta a data dos lançamentos e a conta transitória.">
            <Botao variante="primario" icone="baixar" disabled>
              Gerar arquivo do Questor
            </Botao>
          </RodapeGeracao>
          <RodapeGeracao
            estado="perigo"
            mensagem={`O balancete não fecha: débitos ${brl(1_284_210.4)}, créditos ${brl(1_283_990.4)}, diferença de ${brl(220)}.`}
            nota="A leitura do PDF pode ter vindo incompleta. Confira as contas."
          >
            <Botao variante="primario" icone="baixar">
              Gerar arquivo do Questor
            </Botao>
          </RodapeGeracao>
        </div>
      </Bloco>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Campo de número"
          porque="Número editável como se digita no Brasil. Com foco o texto é livre; ao sair vira número. Texto que não se lê volta ao valor anterior em vez de virar zero: zerar um bem por erro de digitação só aparece depois de importar."
        >
          <div className="flex max-w-xs flex-col gap-2">
            <Rotulado rotulo="Valor do bem" ajuda={`Guardado: ${brl(valor)}`}>
              <CampoNumero valor={valor} onMudar={setValor} rotulo="Valor do bem" />
            </Rotulado>
          </div>
        </Bloco>
        <Bloco
          titulo="Conta do plano na linha"
          porque="O número reduzido primeiro, apagado, porque é o que se digita no Questor; a descrição depois, para conferir. Sem descrição fica o número, que ainda é informação; sem conta, a palavra diz o que falta."
        >
          <div className="nx-vidro flex max-w-md flex-col gap-3 rounded-painel p-4 text-corpo">
            <ContaTexto conta={318} descricao="ENERGIA ELETRICA" />
            <ContaTexto conta={1204} />
            <ContaTexto conta={null} vazio="Sem conta" />
          </div>
        </Bloco>
      </div>
    </>
  );
}
