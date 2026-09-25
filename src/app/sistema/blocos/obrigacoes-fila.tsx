"use client";

import { useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { SeloAtraso } from "@/componentes/produto/obrigacoes/fila-atraso";
import { PainelConsultaAcessorias, type ResultadoConsulta } from "@/componentes/produto/obrigacoes/fila-consulta";
import { CorpoEntregaFila } from "@/componentes/produto/obrigacoes/fila-detalhe";
import {
  BarraFiltrosFila,
  FILTROS_FILA_VAZIOS,
  type FiltrosTelaFila,
  type RecorteFila,
} from "@/componentes/produto/obrigacoes/fila-filtros";
import { FaixaFila } from "@/componentes/produto/obrigacoes/fila-indicadores";
import { FilaNaoCarregada, RetratoFila } from "@/componentes/produto/obrigacoes/fila-retrato";
import {
  TabelaEntregasFila,
  TabelaObrigacoesFila,
  TabelaResponsaveisFila,
  TabelaSetoresFila,
} from "@/componentes/produto/obrigacoes/fila-tabelas";
import type { EmpresaCarteira } from "@/lib/obrigacoes";
import type {
  EntregaFila,
  ObrigacaoFila,
  ResponsavelFila,
  SetorFila,
  SincronizacaoInfo,
} from "@/lib/obrigacoes-tipos";
import { Bloco, Variante } from "../bloco";

/*
 * Peças da fila do Obrigações: o retrato do Acessórias, os filtros, os
 * números, os recortes, a fila, a consulta de uma empresa e a entrega aberta.
 * Tudo com dado de mentira, no formato que `/api/obrigacoes/fila` devolve.
 */

const SYNC: SincronizacaoInfo = {
  concluidoEm: "2026-09-25T05:46:12",
  rodando: false,
  empresas: 1184,
  entregas: 3412,
  falhas: 0,
};

const FOLHA = "Pessoal - Empregados - Folha";
const FISCAL = "Fiscal - Faturamento - Notas";
const CONTABIL = "Contábil - Balanço Balancetes";

const ENTREGAS: EntregaFila[] = [
  {
    entId: 90112,
    cnpj: "12.345.678/0001-90",
    codigoempresa: 1318,
    empresa: "MAGALHAES COMERCIO DE ALIMENTOS LTDA",
    obrigacao: "DCTFWeb",
    competencia: "2026-06-01",
    prazo: "2026-07-15",
    status: "Atrasada!",
    multa: true,
    dptoId: 3,
    dptoNome: FOLHA,
    respNome: "Carla Mendes",
    diasAtraso: 72,
  },
  {
    entId: 90377,
    cnpj: "08.765.432/0001-10",
    codigoempresa: 1402,
    empresa: "TRANSPORTES RIO DO PEIXE EIRELI",
    obrigacao: "EFD-Reinf",
    competencia: "2026-07-01",
    prazo: "2026-08-15",
    status: "Atrasada!",
    multa: true,
    dptoId: 2,
    dptoNome: FISCAL,
    respNome: "Rafael Tomasi",
    diasAtraso: 41,
  },
  {
    entId: 91004,
    cnpj: "33.221.110/0002-45",
    codigoempresa: null,
    empresa: "PANIFICADORA TRIGO BOM FILIAL GUARAMIRIM",
    obrigacao: "DAS do Simples Nacional",
    competencia: "2026-08-01",
    prazo: "2026-09-20",
    status: "Atrasada!",
    multa: false,
    dptoId: 2,
    dptoNome: FISCAL,
    respNome: null,
    diasAtraso: 5,
  },
  {
    entId: 91210,
    cnpj: "45.678.901/0001-23",
    codigoempresa: 1507,
    empresa: "METALURGICA VALE DO ITAJAI LTDA",
    obrigacao: "Balancete mensal",
    competencia: "2026-08-01",
    prazo: "2026-09-24",
    status: "Atrasada!",
    multa: false,
    dptoId: 1,
    dptoNome: CONTABIL,
    respNome: "Juliana Kruger",
    diasAtraso: 1,
  },
  {
    entId: 91388,
    cnpj: "12.345.678/0001-90",
    codigoempresa: 1318,
    empresa: "MAGALHAES COMERCIO DE ALIMENTOS LTDA",
    obrigacao: "Guia do FGTS Digital",
    competencia: "2026-08-01",
    prazo: "2026-09-25",
    status: "Pendente",
    multa: true,
    dptoId: 3,
    dptoNome: FOLHA,
    respNome: "Carla Mendes",
    diasAtraso: 0,
  },
  {
    entId: 91455,
    cnpj: "56.789.012/0001-34",
    codigoempresa: 1702,
    empresa: "AGROPECUARIA CAMPOS GERAIS S/A",
    obrigacao: "EFD Contribuições",
    competencia: "2026-08-01",
    prazo: "2026-10-14",
    status: "Pendente",
    multa: true,
    dptoId: 2,
    dptoNome: FISCAL,
    respNome: "Rafael Tomasi",
    diasAtraso: -19,
  },
  {
    entId: 91502,
    cnpj: "67.890.123/0001-45",
    codigoempresa: 1788,
    empresa: "U FIT ACADEMIA JARAGUA LTDA",
    obrigacao: "ECF",
    competencia: "2025-12-01",
    prazo: null,
    status: "Pendente",
    multa: false,
    dptoId: 1,
    dptoNome: CONTABIL,
    respNome: "Anderson Pereira",
    diasAtraso: null,
  },
];

const RESPONSAVEIS: ResponsavelFila[] = [
  { respId: 41, respNome: "Carla Mendes", total: 38, atrasadas: 12, comMulta: 5, piorAtraso: 72 },
  { respId: 17, respNome: "Rafael Tomasi", total: 51, atrasadas: 9, comMulta: 2, piorAtraso: 41 },
  { respId: null, respNome: "(sem responsável)", total: 14, atrasadas: 2, comMulta: 1, piorAtraso: 5 },
  { respId: 23, respNome: "Juliana Kruger", total: 27, atrasadas: 3, comMulta: 0, piorAtraso: 1 },
  { respId: 8, respNome: "Anderson Pereira", total: 19, atrasadas: 0, comMulta: 0, piorAtraso: null },
];

const SETORES: SetorFila[] = [
  { dptoId: 3, dptoNome: FOLHA, total: 61, atrasadas: 14, comMulta: 6 },
  { dptoId: 2, dptoNome: FISCAL, total: 54, atrasadas: 8, comMulta: 2 },
  { dptoId: 1, dptoNome: CONTABIL, total: 34, atrasadas: 4, comMulta: 0 },
];

const OBRIGACOES: ObrigacaoFila[] = [
  { obrigacao: "DCTFWeb", total: 32, atrasadas: 9 },
  { obrigacao: "EFD-Reinf", total: 28, atrasadas: 6 },
  { obrigacao: "Guia do FGTS Digital", total: 24, atrasadas: 3 },
  { obrigacao: "DAS do Simples Nacional", total: 21, atrasadas: 5 },
  { obrigacao: "EFD Contribuições", total: 17, atrasadas: 0 },
  { obrigacao: "Balancete mensal", total: 15, atrasadas: 2 },
  { obrigacao: "ECF", total: 6, atrasadas: 1 },
];

const PAINEL = {
  total: 149,
  atrasadas: 26,
  comMulta: 8,
  semParNoQuestor: 3,
  setores: SETORES,
};

const CARTEIRA_FILIAIS: EmpresaCarteira[] = [
  { cnpj: "33.221.110/0001-64", razao: "PANIFICADORA E CONFEITARIA TRIGO BOM LTDA ME", status: "Ativa", codigoempresa: 1633, temFila: true },
  { cnpj: "33.221.110/0002-45", razao: "PANIFICADORA TRIGO BOM FILIAL GUARAMIRIM", status: "Ativa", codigoempresa: 1633, temFila: true },
];

const RESULTADO: ResultadoConsulta = {
  cnpj: "12.345.678/0001-90",
  empresa: "MAGALHAES COMERCIO DE ALIMENTOS LTDA",
  fila: ENTREGAS.filter((e) => e.cnpj === "12.345.678/0001-90"),
  em: "2026-09-25T14:32:08",
};

type Estado = "dado" | "carregando" | "vazio" | "erro";

function SeletorEstado({
  valor,
  onMudar,
  vazio = "Vazio",
}: {
  valor: Estado;
  onMudar: (e: Estado) => void;
  vazio?: string;
}) {
  return (
    <div>
      <Segmentado<Estado>
        rotulo="Estado"
        opcoes={[
          { valor: "dado", rotulo: "Com dado" },
          { valor: "carregando", rotulo: "Carregando" },
          { valor: "vazio", rotulo: vazio },
          { valor: "erro", rotulo: "Erro" },
        ]}
        valor={valor}
        onMudar={onMudar}
      />
    </div>
  );
}

const erroDoBloco = (
  <div className="p-4">
    <PainelErro titulo="Não deu para montar este painel" mensagem="A consulta dele falhou no servidor." onTentar={() => {}} />
  </div>
);

function FiltrosVivos({ inicial }: { inicial: FiltrosTelaFila }) {
  const [f, setF] = useState(inicial);
  // Com um responsável escolhido a contagem é de outro recorte: a tela a tira.
  const responsaveis = f.respId != null ? RESPONSAVEIS.map((r) => ({ ...r, total: undefined })) : RESPONSAVEIS;
  return <BarraFiltrosFila valor={f} onMudar={setF} responsaveis={responsaveis} obrigacoes={OBRIGACOES} />;
}

function FaixaViva() {
  const [recorte, setRecorte] = useState<RecorteFila>("todas");
  return <FaixaFila dados={PAINEL} recorte={recorte} onRecorte={setRecorte} />;
}

function RecortesVivos() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [respId, setRespId] = useState<number | null>(null);
  const [obrigacao, setObrigacao] = useState<string | null>(null);
  const corpo = (conteudo: ReactNode, colunas: number) =>
    estado === "carregando" ? (
      <EsqueletoTabela colunas={colunas} linhas={4} />
    ) : estado === "erro" ? (
      erroDoBloco
    ) : (
      conteudo
    );
  return (
    <div className="flex flex-col gap-3">
      <SeletorEstado valor={estado} onMudar={setEstado} />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Painel corpo="p-0" titulo="Por Responsável" descricao="Mais vencidas primeiro. Clique para filtrar a fila.">
          {corpo(
            <TabelaResponsaveisFila
              itens={estado === "vazio" ? [] : RESPONSAVEIS}
              respId={respId}
              onFiltrar={(r) => setRespId(respId === r.respId ? null : r.respId)}
            />,
            5
          )}
        </Painel>
        <div className="flex min-w-0 flex-col gap-4">
          <Painel corpo="p-0" titulo="Por Setor">
            {corpo(<TabelaSetoresFila itens={estado === "vazio" ? [] : SETORES} />, 3)}
          </Painel>
          <Painel corpo="p-0" titulo="Por Obrigação" descricao="As 20 com mais entregas. Clique para filtrar a fila.">
            {corpo(
              <TabelaObrigacoesFila
                itens={estado === "vazio" ? [] : OBRIGACOES}
                obrigacao={obrigacao}
                onFiltrar={(o) => setObrigacao(obrigacao === o.obrigacao ? null : o.obrigacao)}
                alturaMax="15rem"
              />,
              3
            )}
          </Painel>
        </div>
      </div>
    </div>
  );
}

function FilaViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [filtrada, setFiltrada] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const vazio = filtrada ? (
    <Vazio
      compacto
      icone="filtrar"
      titulo="Nenhuma entrega com esses filtros"
      descricao="Afrouxe o responsável ou o recorte de vencidas."
      acao={
        <Botao icone="fechar" onClick={() => setFiltrada(false)}>
          Limpar filtros
        </Botao>
      }
    />
  ) : (
    <Vazio icone="ok" titulo="Nada pendente" descricao="O retrato do Acessórias não tem entrega em aberto nesta seção." />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeletorEstado valor={estado} onMudar={setEstado} />
        {estado === "vazio" && (
          <Segmentado<"bom" | "filtro">
            rotulo="Qual vazio"
            opcoes={[
              { valor: "bom", rotulo: "Nada pendente" },
              { valor: "filtro", rotulo: "Filtro zerou" },
            ]}
            valor={filtrada ? "filtro" : "bom"}
            onMudar={(v) => setFiltrada(v === "filtro")}
          />
        )}
      </div>
      <Painel
        corpo="p-0"
        titulo="Entregas na Fila"
        descricao="Do prazo mais antigo para o mais novo"
        rodape={
          estado === "dado" ? (
            <Nota>São as 500 de prazo mais antigo, de 1.212 na fila. Os filtros reduzem a lista.</Nota>
          ) : undefined
        }
      >
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={7} linhas={5} />
        ) : estado === "erro" ? (
          erroDoBloco
        ) : (
          <TabelaEntregasFila
            itens={estado === "vazio" ? [] : ENTREGAS}
            onAbrir={(e) => setAberta(e.entId)}
            aberta={aberta}
            alturaMax="24rem"
            vazio={vazio}
          />
        )}
      </Painel>
    </div>
  );
}

function ConsultaViva({ opcoes }: { opcoes?: EmpresaCarteira[] }) {
  const [doc, setDoc] = useState("");
  return (
    <PainelConsultaAcessorias
      documento={doc}
      onDocumento={setDoc}
      opcoes={opcoes}
      nota={opcoes && !doc ? "A empresa do topo tem 2 CNPJs na carteira do Acessórias. Escolha qual consultar." : undefined}
      onConsultar={() => {}}
    />
  );
}

const rodapeEntrega = (
  <>
    <Botao variante="fantasma">Fechar</Botao>
    <Botao variante="primario" icone="atualizar">
      Consultar no Acessórias
    </Botao>
  </>
);

export function BlocosObrigacoesFila() {
  return (
    <>
      <Bloco
        titulo="Retrato da Fila"
        porque="A fila é o retrato da varredura das 5h, então a data e o número de empresas lidas vêm antes dos números. Empresa que falhou na varredura deixa a fila incompleta, e o selo diz isso para o total não parecer inteiro."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Retrato do dia">
            <RetratoFila sync={SYNC} />
          </Variante>
          <Variante nome="Outra varredura rodando (a tela recarrega a cada 30 s)">
            <RetratoFila sync={{ ...SYNC, rodando: true }} />
          </Variante>
          <Variante nome="Empresas que falharam">
            <RetratoFila sync={{ ...SYNC, falhas: 7 }} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Fila sem Varredura"
        porque="Sem varredura, a fila mostraria zeros que leem como escritório em dia. Este estado diz que ninguém perguntou ainda, aponta a Configurações só a quem alcança a seção e deixa a consulta de uma empresa à mão logo abaixo."
      >
        <div className="grid gap-5 xl:grid-cols-3">
          <Variante nome="Parada, para quem alcança a Configurações">
            <FilaNaoCarregada rodando={false} podeConfigurar />
          </Variante>
          <Variante nome="Parada, sem acesso à Configurações">
            <FilaNaoCarregada rodando={false} podeConfigurar={false} />
          </Variante>
          <Variante nome="Primeira varredura rodando">
            <FilaNaoCarregada rodando podeConfigurar />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Atraso da Entrega"
        porque="Mais de 30 dias é perigo e de 1 a 30 é atenção. Prazo de hoje ainda está no prazo, porque vencida é a de prazo anterior a hoje, a mesma régua do indicador de Vencidas."
        palco
      >
        <div className="flex flex-wrap items-center gap-6">
          {[
            { nome: "72 dias", dias: 72 },
            { nome: "12 dias", dias: 12 },
            { nome: "Prazo hoje", dias: 0 },
            { nome: "Prazo futuro", dias: -19 },
            { nome: "Sem prazo", dias: null },
          ].map((v) => (
            <Variante key={v.nome} nome={v.nome}>
              <SeloAtraso dias={v.dias} />
            </Variante>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Filtros da Fila"
        porque="Todo filtro vai ao servidor, para os números e a tabela saírem da mesma consulta. Com um responsável escolhido, o combo lembra os outros da última resposta e só mostra a contagem enquanto ela vale para o recorte da tela."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Nada marcado">
            <FiltrosVivos inicial={FILTROS_FILA_VAZIOS} />
          </Variante>
          <Variante nome="Responsável e recorte marcados">
            <FiltrosVivos
              inicial={{ ...FILTROS_FILA_VAZIOS, respId: 41, respNome: "Carla Mendes", recorte: "vencidas" }}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Números da Fila"
        porque="Saem da mesma consulta que a tabela, com os mesmos filtros. Vencidas e Com multa ligam e soltam o recorte da fila, e a lâmpada fica na cor da seleção enquanto ele vale."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Com dado (clique em Vencidas ou Com multa)">
            <FaixaViva />
          </Variante>
          <Variante nome="Carregando">
            <FaixaFila carregando />
          </Variante>
          <Variante nome="Sem nada vencido e toda empresa com par no Questor">
            <FaixaFila dados={{ total: 12, atrasadas: 0, comMulta: 0, semParNoQuestor: 0, setores: SETORES.slice(0, 1) }} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Recortes da Fila"
        porque="Clicar num responsável ou numa obrigação filtra a fila inteira, e o mesmo clique solta. O grupo sem responsável não filtra, porque o servidor não tem chave para ele. Cada painel mostra o próprio erro: o bloco que falhou no servidor não derruba os outros."
      >
        <RecortesVivos />
      </Bloco>

      <Bloco
        titulo="Entregas na Fila"
        porque="A mesma tabela serve a fila e a consulta de uma empresa, com o CNPJ embaixo do nome e o setor embaixo da obrigação só onde a seção junta mais de um setor. Nada pendente é um estado bom e próprio; o vazio de filtro diz o que afrouxar."
      >
        <div className="flex flex-col gap-5">
          <FilaViva />
          <Variante nome="Seção de um setor só (Fiscal, DP): sem o setor embaixo">
            <Painel corpo="p-0" titulo="Entregas na Fila">
              <TabelaEntregasFila itens={ENTREGAS.filter((e) => e.dptoId === 2)} comSetor={false} alturaMax="14rem" />
            </Painel>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Consulta no Acessórias"
        porque="Uma empresa custa uma chamada ao Acessórias, então ela se consulta na hora e a resposta regrava o retrato dela na fila. Com a empresa do topo, o CNPJ chega preenchido, ou vira escolha quando ela tem filial cadastrada como empresa no Acessórias."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <Variante nome="Parada">
            <ConsultaViva />
          </Variante>
          <Variante nome="Empresa do topo com dois CNPJs">
            <ConsultaViva opcoes={CARTEIRA_FILIAIS} />
          </Variante>
          <Variante nome="Consultando">
            <PainelConsultaAcessorias
              documento="12.345.678/0001-90"
              onDocumento={() => {}}
              onConsultar={() => {}}
              buscando
            />
          </Variante>
          <Variante nome="Erro do servidor">
            <PainelConsultaAcessorias
              documento="12.345.678/0001-90"
              onDocumento={() => {}}
              onConsultar={() => {}}
              erro="Empresa fora do seu escopo de acesso"
            />
          </Variante>
          <Variante nome="Com pendências">
            <PainelConsultaAcessorias
              documento="12.345.678/0001-90"
              onDocumento={() => {}}
              onConsultar={() => {}}
              resultado={RESULTADO}
            />
          </Variante>
          <Variante nome="Nada pendente nesta seção">
            <PainelConsultaAcessorias
              documento="45.678.901/0001-23"
              onDocumento={() => {}}
              onConsultar={() => {}}
              resultado={{ ...RESULTADO, cnpj: "45.678.901/0001-23", empresa: "METALURGICA VALE DO ITAJAI LTDA", fila: [] }}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Entrega Aberta"
        porque="Quem abre uma entrega quer saber se ela ainda está pendente. A consulta da empresa responde na hora e, se a entrega saiu da fila do Acessórias, a janela diz isso em vez de mostrar o retrato velho como atual."
      >
        <div className="grid gap-5 xl:grid-cols-3">
          <Variante nome="Como está no retrato">
            <PainelModal estatico titulo={ENTREGAS[0].obrigacao} descricao={ENTREGAS[0].empresa} rodape={rodapeEntrega}>
              <CorpoEntregaFila entrega={ENTREGAS[0]} />
            </PainelModal>
          </Variante>
          <Variante nome="Consultada: continua pendente">
            <PainelModal estatico titulo={ENTREGAS[0].obrigacao} descricao={ENTREGAS[0].empresa} rodape={rodapeEntrega}>
              <CorpoEntregaFila entrega={ENTREGAS[0]} resultado={RESULTADO} />
            </PainelModal>
          </Variante>
          <Variante nome="Consultada: saiu da fila">
            <PainelModal estatico titulo={ENTREGAS[1].obrigacao} descricao={ENTREGAS[1].empresa} rodape={rodapeEntrega}>
              <CorpoEntregaFila
                entrega={ENTREGAS[1]}
                resultado={{ ...RESULTADO, cnpj: ENTREGAS[1].cnpj, empresa: ENTREGAS[1].empresa, fila: [] }}
              />
            </PainelModal>
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
