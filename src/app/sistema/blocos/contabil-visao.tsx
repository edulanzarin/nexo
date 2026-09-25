"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { FaixaAtividade, FaixaBase, FeedAtividade } from "@/componentes/produto/contabil/painel-atividade";
import { CONFIRMACAO_PM, FormularioPM } from "@/componentes/produto/postmortem/formulario";
import { FaixaResumoPM, TabelaPM } from "@/componentes/produto/postmortem/resumo";
import { SeloCriticidade, SeloGravidade, SeloSituacaoPM } from "@/componentes/produto/postmortem/selos";
import type { ContabilAtividade, ContabilBase, ContabilEvento } from "@/lib/painel-contabil-tipos";
import { pmVazio, type RelatorioPM, type ResumoPM } from "@/lib/postmortem-tipos";
import { Bloco, Variante } from "../bloco";

/**
 * Peças de produto do Contábil que nasceram nas telas do grupo Visão, Empresa e
 * Equipe (os painéis e o post mortem). Cada uma entra aqui como um <Bloco> com o
 * porquê, no mesmo commit em que nasce.
 */

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Indisponível" },
];

const PERIODO = { inicio: "2026-09-01", fim: "2026-09-24" };

const ATIVIDADE: ContabilAtividade = {
  conciliacoes: 148,
  conciliacaoLinhas: 21874,
  implantacoes: 6,
  laudos: 37,
  pendenciasTriadas: 412,
  pendenciasResolvidas: 356,
  pendenciasIgnoradas: 56,
  exportacoes: 91,
};

const BASE: ContabilBase = { plano: 3290, regras: 184, regrasExtrato: 2618, contasBanco: 427, depara: 5930 };

const EVENTOS: ContabilEvento[] = [
  { id: 9, usuario: "Ana Paula Ribeiro", acao: "contabil.conciliacao.gerar", alvo: "Empresa 1318 · 312 lançamentos", quando: "2026-09-24T15:42:10" },
  { id: 8, usuario: "Bruno Henrique Costa", acao: "contabil.pendencia.triar", alvo: "Nota 48.211 · MAGALHAES COMERCIO", quando: "2026-09-24T15:18:44" },
  { id: 7, usuario: "Camila Schmitt", acao: "contabil.laudo.gerar", alvo: "TRANSPORTES RIO DO PEIXE EIRELI · 2026-01-01 a 2026-08-31", quando: "2026-09-24T14:55:02" },
  { id: 6, usuario: "Ana Paula Ribeiro", acao: "contabil.regra.salvar", alvo: "\"PIX ENERGISA\" · conta 318 · empresa 1318", quando: "2026-09-24T14:31:27" },
  { id: 5, usuario: "Diego Moretti", acao: "contabil.implantacao.gerar", alvo: "Empresa 1788 · 2026-08-31 · 214 lançamentos", quando: "2026-09-24T11:07:39" },
  { id: 4, usuario: "Elaine Kowalski", acao: "contabil.export", alvo: "conferencia-1402", quando: "2026-09-24T10:12:51" },
  {
    id: 3,
    usuario: "Felipe Zanella",
    acao: "contabil.consulta",
    alvo: "/contabil/conferencia · empresas=1402&inicio=2026-09-01&fim=2026-09-24",
    quando: "2026-09-24T09:48:05",
  },
];

const RESUMOS: ResumoPM[] = [
  { id: 41, numero: 42, status: "enviado", setor: "contabil", criticidade: "critica", gravidade: null, empresaAfetada: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", grupoNome: "Grupo U FIT", autorNome: "Ana Paula Ribeiro", processo: "Conciliação bancária de agosto", dataOcorrido: "2026-09-02", atualizadoEm: "2026-09-10T13:02:00Z" },
  { id: 40, numero: 41, status: "enviado", setor: "contabil", criticidade: "media", gravidade: null, empresaAfetada: "TRANSPORTES RIO DO PEIXE EIRELI", grupoNome: null, autorNome: "Camila Schmitt", processo: "Fechamento do balancete", dataOcorrido: "2026-08-28", atualizadoEm: "2026-09-03T17:40:00Z" },
  { id: 39, numero: null, status: "rascunho", setor: "contabil", criticidade: "alta", gravidade: null, empresaAfetada: "U FIT ACADEMIA JARAGUA LTDA", grupoNome: "Grupo U FIT", autorNome: "Diego Moretti", processo: "Implantação de saldos", dataOcorrido: "2026-09-15", atualizadoEm: "2026-09-22T09:15:00Z" },
  { id: 38, numero: 40, status: "enviado", setor: "contabil", criticidade: "baixa", gravidade: null, empresaAfetada: "PANIFICADORA E CONFEITARIA TRIGO BOM LTDA ME", grupoNome: null, autorNome: "Bruno Henrique Costa", processo: "Lançamento de folha", dataOcorrido: "2026-08-11", atualizadoEm: "2026-08-19T11:20:00Z" },
];

const RELATORIO: RelatorioPM = {
  ...pmVazio(),
  id: 0,
  numero: null,
  status: "rascunho",
  setor: "contabil",
  autorId: "catalogo",
  autorNome: "Ana Paula Ribeiro",
  grupoNome: "Grupo U FIT",
  criadoEm: "2026-09-18T10:20:00",
  atualizadoEm: "2026-09-22T16:05:00",
  criticidade: "alta",
  grupoId: 2,
  empresaAfetada: "MAGALHAES COMERCIO DE ALIMENTOS LTDA",
  processo: "Conciliação bancária de agosto",
  dataOcorrido: "2026-09-02",
  dataIdentificado: "2026-09-09",
  quemIdentificou: "Cliente, por e-mail",
  comoIdentificou: "Saldo do banco não bateu no balancete",
  descricao: "O extrato de agosto foi conciliado duas vezes e os lançamentos entraram em dobro no razão.",
  linhaTempo: [
    { data: "02/09 14h", evento: "Primeira conciliação gerada e importada", responsavel: "Ana Paula" },
    { data: "03/09 09h", evento: "Mesmo extrato conciliado de novo", responsavel: "Ana Paula" },
  ],
  impactos: { ...pmVazio().impactos, cliente: "Balancete de agosto reenviado ao cliente." },
  cincoPorques: ["O extrato entrou duas vezes", "O arquivo antigo ficou na pasta de importação", "", "", ""],
  causaRaiz: "Não havia aviso de extrato já conciliado para o mesmo período.",
  acoesCorretivas: [{ acao: "Estornar a segunda importação", responsavel: "Ana Paula", prazo: "2026-09-10", status: "Feita" }],
};

const GRUPOS = [
  { id: 1, nome: "Todas menos NAVECON" },
  { id: 2, nome: "Grupo U FIT" },
];

export function BlocosContabilVisao() {
  const [estFaixa, setEstFaixa] = useState<Estado>("dado");
  const [estFeed, setEstFeed] = useState<Estado>("dado");
  const [estLista, setEstLista] = useState<Estado>("dado");
  const [leitura, setLeitura] = useState<"editar" | "ler">("editar");

  const atividade = estFaixa === "erro" ? null : estFaixa === "vazio" ? { ...ATIVIDADE, conciliacoes: 0, conciliacaoLinhas: 0, implantacoes: 0, laudos: 0, pendenciasTriadas: 0, pendenciasResolvidas: 0, pendenciasIgnoradas: 0, exportacoes: 0 } : ATIVIDADE;
  const eventos = estFeed === "erro" ? null : estFeed === "vazio" ? [] : EVENTOS;

  return (
    <>
      <Bloco
        titulo="Atividade do mês e base configurada"
        porque="Os dois painéis do Contábil leem os mesmos contadores da trilha, recortados por dono no servidor: a peça é a mesma e só o título muda de o time para você. Zero é afirmação e aparece como zero; bloco cuja consulta falhou aparece como indisponível, nunca como zero, e não derruba os outros."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado opcoes={ESTADOS} valor={estFaixa} onMudar={setEstFaixa} rotulo="Estado da faixa" />
          </div>
          <FaixaAtividade
            titulo="Atividade do Time"
            periodo={estFaixa === "carregando" ? undefined : PERIODO}
            atividade={atividade}
            carregando={estFaixa === "carregando"}
            onTentar={() => setEstFaixa("dado")}
          />
          <FaixaBase base={estFaixa === "erro" ? null : BASE} carregando={estFaixa === "carregando"} onTentar={() => setEstFaixa("dado")} />
        </div>
      </Bloco>

      <Bloco
        titulo="Feed da trilha"
        porque="Com autor é o do gestor, quem fez o quê; sem autor é o do analista, em que a coluna repetiria o próprio nome. A cor de cada gesto é a da classe dele no catálogo de trabalhos do app, a mesma da série e da Produtividade. A linha se arruma pela largura do painel: ao lado do gráfico quebra em duas, na largura toda vira linha de tabela. A consulta, o gesto mais frequente da trilha, chega como caminho e query crus e sai como seção, empresa e período."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado opcoes={ESTADOS} valor={estFeed} onMudar={setEstFeed} rotulo="Estado do feed" />
          </div>
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
            <Variante nome="Painel da equipe: com autor, ao lado do gráfico">
              <FeedAtividade
                comAutor
                eventos={eventos}
                carregando={estFeed === "carregando"}
                descricao="Os últimos gestos do time no NaveX"
                vazio={{ titulo: "Sem atividade registrada", descricao: "Conciliações, laudos, implantações e triagens do time aparecem aqui." }}
                onTentar={() => setEstFeed("dado")}
              />
            </Variante>
            <Variante nome="Meu painel: sem autor, na largura toda" className="xl:col-span-2">
              <FeedAtividade
                titulo="Sua Atividade Recente"
                eventos={eventos}
                carregando={estFeed === "carregando"}
                vazio={{
                  titulo: "Você ainda não rodou nada por aqui",
                  descricao: "Conciliações, laudos, implantações e triagens que você fizer aparecem nesta lista.",
                }}
                onTentar={() => setEstFeed("dado")}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Selos do post mortem"
        palco
        porque="Rampa verde, âmbar e vermelho com os tons de estado do tema; o rótulo é a autoridade e a cor só reforça. Crítica e nota 5 ganham o alerta para saltar da alta, que tem a mesma cor. A nota de gravidade só existe no setor que a usa (Societário)."
      >
        <div className="flex flex-wrap items-center gap-2">
          <SeloCriticidade nivel="baixa" />
          <SeloCriticidade nivel="media" />
          <SeloCriticidade nivel="alta" />
          <SeloCriticidade nivel="critica" />
          <span className="mx-2 h-5 w-px bg-linha" />
          {[1, 2, 3, 4, 5].map((n) => (
            <SeloGravidade key={n} nota={n} />
          ))}
          <span className="mx-2 h-5 w-px bg-linha" />
          <SeloSituacaoPM status="rascunho" />
          <SeloSituacaoPM status="enviado" />
        </div>
      </Bloco>

      <Bloco
        titulo="Lista de relatórios post mortem"
        porque="Serve a todo módulo de setor: o módulo diz a rota da API, o setor diz os campos. Com autor e grupo é a leitura do gestor, que exporta e filtra no cliente (a lista de um setor é curta); sem autor, a do analista. Clicar num número da faixa recorta a lista. O relatório abre na página dele, porque o formulário é longo demais para modal."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado opcoes={ESTADOS.map((e) => (e.valor === "erro" ? { ...e, rotulo: "Erro" } : e))} valor={estLista} onMudar={setEstLista} rotulo="Estado da lista" />
          </div>
          {estLista === "erro" ? (
            <PainelErro titulo="Não deu para carregar os relatórios" mensagem="Você não lê os relatórios deste setor" onTentar={() => setEstLista("dado")} />
          ) : (
            <>
              <FaixaResumoPM lista={estLista === "vazio" ? [] : RESUMOS} carregando={estLista === "carregando"} comAutor aoClicar={() => {}} />
              <Painel corpo="p-0" titulo="Relatórios do Contábil" descricao={estLista === "carregando" ? "Carregando" : `${RESUMOS.length} no setor`}>
                {estLista === "carregando" ? (
                  <EsqueletoTabela colunas={7} linhas={4} />
                ) : estLista === "vazio" ? (
                  <Vazio
                    icone="relatorio"
                    titulo="Nenhum relatório do Contábil ainda"
                    descricao="Quando alguém do setor abrir um relatório, ele aparece aqui, rascunho ou enviado."
                  />
                ) : (
                  <TabelaPM linhas={RESUMOS} comAutor onLinha={() => {}} />
                )}
              </Painel>
            </>
          )}
        </div>
      </Bloco>

      <Bloco
        titulo="Formulário do relatório"
        porque="O tronco é o mesmo para todo setor; os poucos campos que mudam (funcionários afetados, nota de gravidade, quem avisou) vêm do catálogo de setores, nunca de um if no meio da tela. Os obrigatórios só acendem depois da primeira tentativa de enviar, porque rascunho salva parcial. Em leitura o campo vira texto: campo desabilitado a meia opacidade é ruim de ler justamente para quem veio só ler."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado
              opcoes={[
                { valor: "editar", rotulo: "Rascunho do dono" },
                { valor: "ler", rotulo: "Leitura da gestão" },
              ]}
              valor={leitura}
              onMudar={setLeitura}
              rotulo="Modo do formulário"
            />
          </div>
          <div className="flex flex-col gap-4">
            <FormularioPM
              key={leitura}
              inicial={RELATORIO}
              grupos={GRUPOS}
              somenteLeitura={leitura === "ler"}
              voltarPara="/sistema#contabil"
              apiBase="/api/contabil/post-mortem"
            />
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Confirmações do relatório"
        porque="Enviar e excluir não voltam atrás: o enviado ganha número e fica só para leitura, o rascunho excluído some. Os dois passam por confirmação; salvar rascunho, não."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(["enviar", "excluir"] as const).map((k) => (
            <PainelModal
              key={k}
              estatico
              largura="p"
              titulo={CONFIRMACAO_PM[k].titulo}
              onFechar={() => {}}
              rodape={
                <>
                  <Botao>Cancelar</Botao>
                  <Botao variante={k === "excluir" ? "perigo" : "primario"} icone={k === "excluir" ? "apagar" : "enviar"}>
                    {CONFIRMACAO_PM[k].acao}
                  </Botao>
                </>
              }
            >
              <p className="text-corpo text-tinta-2">{CONFIRMACAO_PM[k].texto}</p>
            </PainelModal>
          ))}
        </div>
      </Bloco>
    </>
  );
}
