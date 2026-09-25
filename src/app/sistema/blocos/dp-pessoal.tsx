"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { PainelErro } from "@/componentes/primitivos/estados";
import { PainelModal } from "@/componentes/primitivos/modal";
import { PainelCustoQuebra } from "@/componentes/produto/folha/custo-quebra";
import { PainelRubricas } from "@/componentes/produto/folha/custo-rubricas";
import { CorpoFicha, EsqueletoFicha } from "@/componentes/produto/pessoal/ficha-funcionario";
import { FaixaFiltrosPessoal } from "@/componentes/produto/pessoal/filtros-pessoal";
import { CorpoPessoas } from "@/componentes/produto/pessoal/modal-pessoas";
import { PainelMovimentacoes, type VistaPessoas } from "@/componentes/produto/pessoal/painel-movimentacoes";
import { PainelQuebraTurnover } from "@/componentes/produto/pessoal/quebra-turnover";
import { SerieTurnover } from "@/componentes/produto/pessoal/serie-turnover";
import { FOLHA_SELECAO_VAZIA, type FolhaSelecao } from "@/lib/folha-filtros";
import type {
  CustoGrupo,
  CustoRubrica,
  FolhaFicha,
  FolhaFiltros,
  FolhaMovimentacao,
  TurnoverGrupo,
  TurnoverPonto,
} from "@/lib/types";
import { Bloco, Variante } from "../bloco";

/*
 * Peças de pessoal que o DP estreia na Rotatividade e no Custo de Folha: a
 * faixa de filtros, a série de turnover, as movimentações, a ficha, o drill de
 * um grupo, a quebra de turnover, e do custo a quebra por grupo e as rubricas.
 * O RH, quando portado, monta as mesmas peças contra /api/rh. Tudo com dado de
 * mentira.
 */

const OPCOES: FolhaFiltros = {
  estabelecimentos: [
    { valor: "MATRIZ", rotulo: "MATRIZ", contratos: 96 },
    { valor: "FILIAL JOINVILLE", rotulo: "FILIAL JOINVILLE", contratos: 31 },
  ],
  setores: [
    { valor: "PRODUCAO", rotulo: "PRODUCAO", contratos: 64 },
    { valor: "EXPEDICAO", rotulo: "EXPEDICAO", contratos: 23 },
    { valor: "ADMINISTRATIVO", rotulo: "ADMINISTRATIVO", contratos: 17 },
    { valor: "MANUTENCAO", rotulo: "MANUTENCAO", contratos: 12 },
    { valor: "QUALIDADE", rotulo: "QUALIDADE", contratos: 8 },
    { valor: "(sem setor)", rotulo: "(sem setor)", contratos: 3 },
  ],
  cargos: [
    { valor: "OPERADOR DE MAQUINA", rotulo: "OPERADOR DE MAQUINA", contratos: 41 },
    { valor: "AUXILIAR DE PRODUCAO", rotulo: "AUXILIAR DE PRODUCAO", contratos: 29 },
    { valor: "CONFERENTE", rotulo: "CONFERENTE", contratos: 14 },
    { valor: "ASSISTENTE ADMINISTRATIVO", rotulo: "ASSISTENTE ADMINISTRATIVO", contratos: 9 },
    { valor: "MECANICO DE MANUTENCAO", rotulo: "MECANICO DE MANUTENCAO", contratos: 7 },
  ],
  vinculos: [
    { valor: "01|10", rotulo: "Empregado (CLT)", contratos: 118 },
    { valor: "01|80", rotulo: "Empregado · tipo 80", contratos: 4 },
    { valor: "07|10", rotulo: "Categoria 07 · tipo 10", contratos: 5 },
  ],
  horarios: [
    { valor: "1º turno", rotulo: "1º turno", contratos: 58 },
    { valor: "2º turno", rotulo: "2º turno", contratos: 44 },
    { valor: "07:30 às 12:00/13:00 às 17:18", rotulo: "07:30 às 12:00/13:00 às 17:18", contratos: 21 },
    { valor: "(sem horário)", rotulo: "(sem horário)", contratos: 4 },
  ],
};

const indice = (adm: number, dem: number, ativos: number) => (ativos > 0 ? ((adm + dem) / 2 / ativos) * 100 : 0);
const grupo = (nome: string, ativos: number, admissoes: number, desligamentos: number): TurnoverGrupo => ({
  grupo: nome,
  ativos,
  admissoes,
  desligamentos,
  turnover: indice(admissoes, desligamentos, ativos),
});

const SETORES: TurnoverGrupo[] = [
  grupo("PRODUCAO", 58, 7, 5),
  grupo("EXPEDICAO", 20, 2, 4),
  grupo("ADMINISTRATIVO", 16, 0, 1),
  grupo("MANUTENCAO", 11, 1, 0),
  grupo("QUALIDADE", 8, 0, 0),
  grupo("(sem setor)", 2, 0, 0),
];

const SEXO: TurnoverGrupo[] = [grupo("Masculino", 79, 7, 6), grupo("Feminino", 36, 3, 4)];

const somar = (l: TurnoverGrupo[]) => {
  const ativos = l.reduce((s, g) => s + g.ativos, 0);
  const admissoes = l.reduce((s, g) => s + g.admissoes, 0);
  const desligamentos = l.reduce((s, g) => s + g.desligamentos, 0);
  return { ativos, admissoes, desligamentos, turnover: indice(admissoes, desligamentos, ativos) };
};

const SERIE: TurnoverPonto[] = [
  ["2026-03-01", 3, 1, 108],
  ["2026-04-01", 1, 2, 107],
  ["2026-05-01", 4, 1, 110],
  ["2026-06-01", 0, 3, 107],
  ["2026-07-01", 2, 2, 107],
  ["2026-08-01", 5, 1, 111],
].map(([mes, admissoes, desligamentos, ativos]) => ({
  mes: mes as string,
  admissoes: admissoes as number,
  desligamentos: desligamentos as number,
  ativos: ativos as number,
  turnover: indice(admissoes as number, desligamentos as number, ativos as number),
}));

const pessoa = (
  contrato: number,
  nome: string,
  cargo: string,
  setor: string,
  dataadm: string,
  datadem: string | null,
  tempoCasaDias: number,
  motivo: string | null = null
): FolhaMovimentacao => ({
  codigoempresa: 1507,
  contrato,
  nome,
  dataadm,
  datadem,
  cargo,
  setor,
  motivo,
  tempoCasaDias,
  admitido: dataadm >= "2026-08-01",
  desligado: datadem != null,
});

const MOVIMENTACOES: FolhaMovimentacao[] = [
  pessoa(418, "JOAO PEDRO SCHMITT", "OPERADOR DE MAQUINA", "PRODUCAO", "2026-08-18", null, 38),
  pessoa(318, "MARIANA KRUEGER DOS SANTOS", "AUXILIAR DE PRODUCAO", "PRODUCAO", "2023-03-06", "2026-08-14", 1257, "Inic.Empregado S/Justa Causa"),
  pessoa(417, "LUCAS EDUARDO BORGES", "CONFERENTE", "EXPEDICAO", "2026-08-11", null, 45),
  pessoa(409, "ANA CAROLINA WEEGE", "AUXILIAR DE PRODUCAO", "PRODUCAO", "2026-08-04", "2026-08-29", 25, "Término de Contrato de Experiência"),
  pessoa(251, "RAFAEL DE SOUZA LIMA", "CONFERENTE", "EXPEDICAO", "2021-10-18", "2026-08-07", 1754, "Demissão Sem Justa Causa"),
  pessoa(416, "GABRIELA MARTINS PFEIFFER", "ASSISTENTE ADMINISTRATIVO", "ADMINISTRATIVO", "2026-08-03", null, 53),
];

const EFETIVO: FolhaMovimentacao[] = [
  pessoa(102, "ADRIANO JOSE KLITZKE", "MECANICO DE MANUTENCAO", "MANUTENCAO", "2014-05-12", null, 4519),
  pessoa(187, "BEATRIZ LOPES ARRUDA", "ASSISTENTE ADMINISTRATIVO", "ADMINISTRATIVO", "2019-02-04", null, 2789),
  pessoa(233, "CLAUDIO ROBERTO MEIER", "OPERADOR DE MAQUINA", "PRODUCAO", "2020-09-21", null, 2195),
  ...MOVIMENTACOES.filter((m) => !m.desligado),
];

const FICHA: FolhaFicha = {
  contrato: 318,
  nome: "MARIANA KRUEGER DOS SANTOS",
  cpf: "04512378910",
  dataadm: "2023-03-06",
  datadem: "2026-08-14",
  tempoCasaDias: 1257,
  cargo: "AUXILIAR DE PRODUCAO",
  funcao: null,
  setor: "PRODUCAO",
  classiforgan: "01.02",
  estabelecimento: "MATRIZ",
  categoria: "01",
  tipoVinculo: "10",
  sexo: "Feminino",
  nascimento: "1996-11-02",
  idade: 29,
  escolaridade: "Médio completo",
  salario: 2318.4,
  tipoSalario: "Mensal",
  motivoDesligamento: "Inic.Empregado S/Justa Causa",
  cidade: "JARAGUA DO SUL",
  uf: "SC",
};

const custo = (nome: string, proventos: number, funcionarios: number): CustoGrupo => ({
  grupo: nome,
  proventos,
  funcionarios,
  custoMedio: proventos / funcionarios,
});

const CUSTO_SETORES: CustoGrupo[] = [
  custo("PRODUCAO", 412380.55, 64),
  custo("EXPEDICAO", 131204.1, 23),
  custo("ADMINISTRATIVO", 118930.42, 17),
  custo("MANUTENCAO", 96412.8, 12),
  custo("QUALIDADE", 51220, 8),
];

const rubrica = (lado: CustoRubrica["lado"], codigo: number, descricao: string, total: number): CustoRubrica => ({
  codigo,
  descricao,
  lado,
  total,
});

const PROVENTOS: CustoRubrica[] = [
  rubrica("provento", 1, "SALARIO", 598120.4),
  rubrica("provento", 21, "HORAS EXTRAS 50%", 64210.77),
  rubrica("provento", 35, "ADICIONAL NOTURNO", 41880.2),
  rubrica("provento", 24, "DSR S/ HORAS EXTRAS", 12840.15),
  rubrica("provento", 92, "INSALUBRIDADE", 9920),
  rubrica("provento", 140, "FERIAS", 52300.18),
];
const DESCONTOS: CustoRubrica[] = [
  rubrica("desconto", 901, "INSS", 71230.9),
  rubrica("desconto", 902, "IRRF", 24110.35),
  rubrica("desconto", 910, "ADIANTAMENTO SALARIAL", 180400),
  rubrica("desconto", 915, "VALE TRANSPORTE", 18204.6),
  rubrica("desconto", 930, "PLANO DE SAUDE", 22150),
  rubrica("desconto", 950, "FALTAS", 3120.44),
];
const TOTAL_PROVENTOS = 810148.87;
const TOTAL_DESCONTOS = 322880.29;

export function BlocosDpPessoal() {
  const [sel, setSel] = useState<FolhaSelecao>({ ...FOLHA_SELECAO_VAZIA, setores: ["PRODUCAO", "EXPEDICAO"] });
  const [vista, setVista] = useState<VistaPessoas>("todos");

  return (
    <>
      <Bloco
        titulo="Filtros de pessoal"
        porque="Estabelecimento, setor, cargo, vínculo e horário são da empresa, então moram na tela e não no topo: trocar de empresa devolve a faixa vazia, e voltar reencontra o que estava. Cada opção traz quantos contratos tem, e a lista não encolhe conforme se marca. Dimensão com uma opção só fica travada, porque não recortaria nada."
      >
        <div className="flex flex-col gap-4">
          <FaixaFiltrosPessoal opcoes={OPCOES} sel={sel} onMudar={setSel} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Carregando">
              <FaixaFiltrosPessoal opcoes={undefined} sel={FOLHA_SELECAO_VAZIA} onMudar={() => {}} />
            </Variante>
            <Variante nome="Erro">
              <FaixaFiltrosPessoal
                opcoes={undefined}
                sel={FOLHA_SELECAO_VAZIA}
                onMudar={() => {}}
                erro="A consulta passou de 60 segundos no Questor."
                onTentar={() => {}}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Rotatividade mês a mês"
        porque="Entradas e saídas em barras na escala de pessoas, o índice na linha e no eixo da direita: na mesma régua, uma das duas achataria. Admissão é verde e desligamento é vermelho em toda peça de pessoal, e a dica traz o efetivo do fim do mês, que é o denominador."
      >
        <div className="flex flex-col gap-4">
          <SerieTurnover pontos={SERIE} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Carregando">
              <SerieTurnover pontos={undefined} carregando />
            </Variante>
            <Variante nome="Sem movimento">
              <SerieTurnover pontos={SERIE.map((p) => ({ ...p, admissoes: 0, desligamentos: 0, turnover: 0 }))} />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Movimentações e efetivo"
        porque="Quem entrou, quem saiu e quem ficou são vistas da mesma lista, trocadas no cabeçalho. A contagem de cada vista vem dos números do topo da tela, então aparece antes de a lista daquela vista ser buscada. A linha abre a ficha; admitido e desligado no mesmo período leva os dois selos."
      >
        <div className="flex flex-col gap-4">
          <PainelMovimentacoes
            vista={vista}
            onVista={setVista}
            linhas={vista === "efetivo" ? EFETIVO : MOVIMENTACOES}
            contagens={{ admitidos: 4, desligados: 3, efetivo: 111 }}
            onAbrir={() => {}}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Carregando">
              <PainelMovimentacoes vista="todos" onVista={() => {}} linhas={undefined} />
            </Variante>
            <Variante nome="Erro">
              <PainelMovimentacoes
                vista="efetivo"
                onVista={() => {}}
                linhas={undefined}
                erro="A consulta passou de 60 segundos no Questor."
                onTentar={() => {}}
              />
            </Variante>
            <Variante nome="Vazio">
              <PainelMovimentacoes
                vista="desligados"
                onVista={() => {}}
                linhas={MOVIMENTACOES.filter((m) => !m.desligado)}
                contagens={{ admitidos: 3, desligados: 0, efetivo: 6 }}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Ficha do funcionário"
        porque="Abre de qualquer lista de pessoas e busca pelo contrato, sem guardar a ficha anterior de reserva: trocar de pessoa com o salário da outra na tela, mesmo por um instante, não pode acontecer. A empresa vem da linha, porque no RH a mesma lista mistura empresas. Quem segue ativo tem o tempo de casa contado até hoje."
      >
        <div className="flex flex-col gap-4">
          <PainelModal
            estatico
            titulo={FICHA.nome}
            descricao={`${FICHA.cargo} · contrato ${FICHA.contrato}`}
            onFechar={() => {}}
            rodape={<Botao>Fechar</Botao>}
          >
            <CorpoFicha ficha={FICHA} />
          </PainelModal>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Carregando">
              <PainelModal estatico titulo="JOAO PEDRO SCHMITT" descricao="OPERADOR DE MAQUINA · contrato 418" onFechar={() => {}}>
                <EsqueletoFicha />
              </PainelModal>
            </Variante>
            <Variante nome="Erro">
              <PainelModal estatico titulo="JOAO PEDRO SCHMITT" descricao="OPERADOR DE MAQUINA · contrato 418" onFechar={() => {}}>
                <PainelErro titulo="Não deu para abrir a ficha" mensagem="Colaborador não encontrado" onTentar={() => {}} />
              </PainelModal>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Pessoas de um grupo"
        porque="Clicar numa barra ou numa linha de quebra traz quem entrou e saiu naquele grupo no período. A pessoa abre no mesmo modal, com o caminho de volta ao grupo: modal sobre modal disputava o Esc e o foco. Com o filtro da tela no mesmo setor, a lista traz só o grupo clicado."
      >
        <div className="flex flex-col gap-4">
          <PainelModal
            estatico
            largura="g"
            titulo="PRODUCAO"
            descricao="Setor · 3 pessoas entraram ou saíram no período"
            onFechar={() => {}}
            rodape={<Botao>Fechar</Botao>}
          >
            <CorpoPessoas linhas={MOVIMENTACOES.filter((m) => m.setor === "PRODUCAO")} onAbrir={() => {}} />
          </PainelModal>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Pessoa aberta dentro do grupo">
              <PainelModal
                estatico
                titulo={FICHA.nome}
                descricao={`${FICHA.cargo} · contrato ${FICHA.contrato}`}
                onFechar={() => {}}
                rodape={
                  <>
                    <Botao variante="fantasma" icone="seta-esquerda">
                      Voltar ao grupo
                    </Botao>
                    <Botao>Fechar</Botao>
                  </>
                }
              >
                <CorpoFicha ficha={FICHA} />
              </PainelModal>
            </Variante>
            <Variante nome="Grupo sem movimento">
              <PainelModal estatico titulo="QUALIDADE" descricao="Setor · 0 pessoas entraram ou saíram no período" onFechar={() => {}}>
                <CorpoPessoas linhas={[]} />
              </PainelModal>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Turnover por grupo"
        porque="Ativos, entradas, saídas e o índice de cada grupo, com o total embaixo. O total some quando a busca ou o “Só com movimento” escondem linhas, porque somado sobre o que sobrou diria outro número com o nome de total. O tom do índice só colore o número: as faixas valem igual para um mês e para um ano, então não viram alerta."
      >
        <div className="flex flex-col gap-4">
          <PainelQuebraTurnover
            titulo="Turnover por Setor"
            rotuloColuna="Setor"
            grupos={SETORES}
            total={somar(SETORES)}
            onGrupo={() => {}}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Variante nome="Compacto, com filtro na tela">
              <PainelQuebraTurnover
                titulo="Turnover por Sexo"
                rotuloColuna="Sexo"
                grupos={SEXO}
                total={somar(SEXO)}
                rotuloTotal="Total do recorte"
                compacto
                onGrupo={() => {}}
              />
            </Variante>
            <Variante nome="Carregando">
              <PainelQuebraTurnover titulo="Turnover por Cargo" rotuloColuna="Cargo" grupos={undefined} carregando compacto />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Custo por grupo"
        porque="A barra ao lado do valor diz onde está o dinheiro sem ler linha por linha, com o maior grupo como régua. Cada contrato cai num grupo só, pela lotação atual, então pessoas e custo fecham no total."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PainelCustoQuebra titulo="Custo por Setor" rotuloColuna="Setor" grupos={CUSTO_SETORES} />
          <div className="flex flex-col gap-4">
            <Variante nome="Carregando">
              <PainelCustoQuebra titulo="Custo por Cargo" rotuloColuna="Cargo" grupos={undefined} carregando />
            </Variante>
            <Variante nome="Vazio">
              <PainelCustoQuebra titulo="Custo por Estabelecimento" rotuloColuna="Estabelecimento" grupos={[]} />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Principais rubricas"
        porque="Proventos e descontos lado a lado, cada lado na cor dele em todo o Custo de Folha. O código vai ao lado do nome da rubrica, que é como o DP a acha no Questor, e a porcentagem é sobre o total do lado, não só sobre as da lista."
      >
        <div className="flex flex-col gap-4">
          <PainelRubricas
            proventos={PROVENTOS}
            descontos={DESCONTOS}
            totalProventos={TOTAL_PROVENTOS}
            totalDescontos={TOTAL_DESCONTOS}
          />
          <Variante nome="Carregando">
            <PainelRubricas proventos={undefined} descontos={undefined} totalProventos={0} totalDescontos={0} carregando />
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
