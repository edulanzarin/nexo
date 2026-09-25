"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { FaixaAtividadeDp, RankingEquipeDp, SerieAtividadeDp } from "@/componentes/produto/folha/atividade-dp";
import { LegendaEsocial, TabelaEventosEsocial } from "@/componentes/produto/folha/esocial-eventos";
import { ListaPendenciasEsocial, SeloEsocial } from "@/componentes/produto/folha/esocial-pendencias";
import { SeloFerias } from "@/componentes/produto/folha/ferias-situacao";
import {
  FaixaPendenciasDp,
  ListaUrgencias,
  TituloBlocoDp,
  type ItemUrgencia,
  type PendenciasDp,
} from "@/componentes/produto/folha/pendencias-dp";
import { DataComPrazo, TextoPrazo } from "@/componentes/produto/folha/prazo-dp";
import { ConfigRescisoesEstatica } from "@/componentes/produto/folha/rescisao-config";
import { PagamentoRescisaoEstatico } from "@/componentes/produto/folha/rescisao-pagamento";
import { CorpoRescisao, SeloRescisao, SinalQuestor } from "@/componentes/produto/folha/rescisao-situacao";
import { dataBR, num } from "@/lib/format";
import type { PainelAtividade, PainelSeriePonto } from "@/lib/painel-dp-tipos";
import type { RescisaoDestinatario, RescisaoItem } from "@/lib/rescisoes-tipos";
import type { EventoEsocial, FeriasSituacao, PendenciaEsocial } from "@/lib/types";
import { Bloco, Variante } from "../bloco";
import { EMPRESAS_FALSAS, PESSOAS_FALSAS } from "../dados-falsos";

/*
 * Peças do DP que nasceram nas telas de Visão e Rotina (os dois painéis,
 * Rescisões a Pagar, Férias e eSocial): a faixa de pendências, a atividade do
 * mês, as listas de urgência, o prazo em texto, a situação da rescisão e as
 * duas janelas dela, a situação de férias e as peças do eSocial. Tudo com dado
 * de mentira.
 */

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Nada pendente" },
  { valor: "erro", rotulo: "Indisponível" },
];

const HOJE = "2026-09-25";
const PERIODO = { inicio: "2026-09-01", fim: HOJE };

const PENDENCIAS: PendenciasDp = {
  rescisoes: { pendentes: 14, vencidas: 3, venceBreve: 4 },
  ferias: { vencidas: 27, aVencer: 61 },
  esocial: { pendentes: 42, rejeitados: 5 },
};

const PENDENCIAS_ZERO: PendenciasDp = {
  rescisoes: { pendentes: 0, vencidas: 0, venceBreve: 0 },
  ferias: { vencidas: 0, aVencer: 0 },
  esocial: { pendentes: 0, rejeitados: 0 },
};

const ATIVIDADE: PainelAtividade = {
  mes: { admissoes: 57, rescisoes: 41, avisos: 38, ferias: 112, total: 248 },
  anterior: { admissoes: 49, rescisoes: 46, avisos: 38, ferias: 0, total: 133 },
  colaboradores: 9,
  topOperadores: PESSOAS_FALSAS.slice(0, 5).map((p, i) => ({ nome: p.nome, total: [1284, 1102, 876, 640, 212][i] })),
};

const SERIE: PainelSeriePonto[] = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((bucket, i) => ({
  bucket,
  admissoes: [44, 52, 61, 48, 49, 57][i],
  rescisoes: [39, 35, 42, 51, 46, 41][i],
  avisos: [30, 28, 35, 40, 38, 38][i],
  ferias: [96, 88, 104, 131, 142, 112][i],
}));

const FUNCIONARIOS = [
  "JOAO CARLOS DA SILVA",
  "MARIA APARECIDA DOS SANTOS",
  "LUCAS GABRIEL PEREIRA",
  "FERNANDA CRISTINA OLIVEIRA SCHMITZ",
  "RAFAEL AUGUSTO KOCH",
  "PATRICIA HELENA MOREIRA",
  "ANDERSON LUIZ VIEIRA",
  "JULIANA BEATRIZ MULLER",
];

const URGENTES: ItemUrgencia[] = [
  { dias: -6, prazo: "2026-09-19", situacao: "vencida" },
  { dias: -1, prazo: "2026-09-24", situacao: "vencida" },
  { dias: 0, prazo: "2026-09-25", situacao: "vence_breve" },
  { dias: 2, prazo: "2026-09-27", situacao: "vence_breve" },
  { dias: 8, prazo: "2026-10-03", situacao: "no_prazo" },
].map((u, i) => ({
  chave: String(i),
  href: "#",
  titulo: FUNCIONARIOS[i],
  apoio: `${EMPRESAS_FALSAS[i + 1].nome} · prazo ${dataBR(u.prazo)}`,
  direita: <TextoPrazo dias={u.dias} atencao={u.situacao === "vence_breve"} />,
}));

const CRITICAS: ItemUrgencia[] = [
  { periodos: 2, dias: -402 },
  { periodos: 1, dias: -88 },
  { periodos: 1, dias: -12 },
].map((c, i) => ({
  chave: String(i),
  href: "#",
  titulo: FUNCIONARIOS[i + 4],
  apoio: c.periodos > 1 ? `${EMPRESAS_FALSAS[i + 4].nome} · ${num(c.periodos)} períodos vencidos` : EMPRESAS_FALSAS[i + 4].nome,
  direita: <TextoPrazo dias={c.dias} />,
}));

const base = (i: number): Omit<RescisaoItem, "situacao" | "diasParaPrazo" | "resolvidaEm" | "resolvidaFonte" | "observacao"> => ({
  codigoempresa: EMPRESAS_FALSAS[i + 1].codigo,
  empresa: EMPRESAS_FALSAS[i + 1].nome,
  contrato: 3100 + i * 17,
  funcionario: FUNCIONARIOS[i],
  dataDesligamento: "2026-09-12",
  causa: "Dispensa sem justa causa pelo empregador",
  dataAviso: "2026-08-13",
  calculada: true,
  pgtoPrevisto: "2026-09-22",
  prazo: "2026-09-22",
});

const RESCISOES: RescisaoItem[] = [
  { ...base(0), situacao: "vencida", diasParaPrazo: -3, resolvidaEm: null, resolvidaFonte: null, observacao: null },
  {
    ...base(1),
    dataDesligamento: "2026-09-18",
    prazo: "2026-09-28",
    calculada: false,
    pgtoPrevisto: null,
    causa: null,
    dataAviso: null,
    situacao: "vence_breve",
    diasParaPrazo: 3,
    resolvidaEm: null,
    resolvidaFonte: null,
    observacao: null,
  },
  {
    ...base(2),
    dataDesligamento: "2026-09-24",
    prazo: "2026-10-04",
    pgtoPrevisto: null,
    situacao: "no_prazo",
    diasParaPrazo: 9,
    resolvidaEm: null,
    resolvidaFonte: null,
    observacao: null,
  },
  {
    ...base(3),
    situacao: "resolvida",
    diasParaPrazo: null,
    resolvidaEm: "2026-09-20",
    resolvidaFonte: "manual",
    observacao: "Pago na folha 60 e homologado no sindicato em 20/09.",
  },
];

const DESTINATARIOS: RescisaoDestinatario[] = [
  { id: 1, nome: "Camila Schmitt", email: "camila.schmitt@navecon.com.br", ativo: true },
  { id: 2, nome: "Diego Moretti", email: "diego.moretti@navecon.com.br", ativo: true },
  { id: 3, nome: "Elaine Kowalski", email: "elaine.kowalski@navecon.com.br", ativo: false },
];

const SITUACOES_FERIAS: FeriasSituacao[] = ["vencida", "a_vencer", "adquirida", "em_dia"];

const ADMISSOES_PENDENTES: PendenciaEsocial[] = [
  { contrato: 4410, funcionario: "BRUNA LETICIA RAMOS", data: "2026-09-15", situacao: "nao_enviado" },
  { contrato: 4402, funcionario: "GUSTAVO HENRIQUE ALVES", data: "2026-09-08", situacao: "pendente" },
  { contrato: 4398, funcionario: "TATIANE REGINA FRANCO", data: "2026-09-02", situacao: "pendente" },
];

const EVENTOS: EventoEsocial[] = [
  { evento: "S-1200", descricao: "Remuneração (folha)", aceitos: 412, pendentes: 6, rejeitados: 2, total: 420 },
  { evento: "S-1210", descricao: "Pagamentos de rendimentos", aceitos: 398, pendentes: 0, rejeitados: 0, total: 398 },
  { evento: "S-2230", descricao: "Afastamento temporário", aceitos: 18, pendentes: 1, rejeitados: 0, total: 19 },
  { evento: "S-2200", descricao: "Admissão", aceitos: 11, pendentes: 2, rejeitados: 1, total: 14 },
  { evento: "S-2299", descricao: "Desligamento", aceitos: 9, pendentes: 0, rejeitados: 0, total: 9 },
  { evento: "S-1299", descricao: "Fechamento de eventos periódicos", aceitos: 1, pendentes: 0, rejeitados: 0, total: 1 },
];

export function BlocosDpRotina() {
  const [estPendencias, setEstPendencias] = useState<Estado>("dado");
  const [estAtividade, setEstAtividade] = useState<Estado>("dado");
  const [estListas, setEstListas] = useState<Estado>("dado");

  const pendencias =
    estPendencias === "erro"
      ? { ...PENDENCIAS, ferias: null }
      : estPendencias === "vazio"
        ? PENDENCIAS_ZERO
        : PENDENCIAS;

  const atividade =
    estAtividade === "erro"
      ? null
      : estAtividade === "vazio"
        ? {
            ...ATIVIDADE,
            mes: { admissoes: 0, rescisoes: 0, avisos: 0, ferias: 0, total: 0 },
            colaboradores: 0,
            topOperadores: [],
          }
        : ATIVIDADE;
  const serie =
    estAtividade === "erro"
      ? null
      : estAtividade === "vazio"
        ? SERIE.map((p) => ({ ...p, admissoes: 0, rescisoes: 0, avisos: 0, ferias: 0 }))
        : SERIE;

  const urgentes = estListas === "erro" ? null : estListas === "vazio" ? [] : URGENTES;
  const criticas = estListas === "erro" ? null : estListas === "vazio" ? [] : CRITICAS;

  return (
    <>
      <Bloco
        titulo="Pendências do DP"
        porque="Rescisões a pagar, férias vencidas e eSocial rejeitado nascem uma vez e servem os dois painéis, recortados pelo escopo da sessão no servidor. O tom é o do pior caso, e zero acende a lâmpada verde porque nada pendente é um estado bom. Cada número leva à tela que resolve já executada no recorte que o painel contou, e o bloco que falhou no servidor fica indisponível sozinho, sem derrubar os outros dois."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado opcoes={ESTADOS} valor={estPendencias} onMudar={setEstPendencias} rotulo="Estado das pendências" />
          </div>
          <section className="flex flex-col gap-2">
            <TituloBlocoDp titulo="Pendências do DP" apoio={`Situação em ${dataBR(HOJE)}`} />
            <FaixaPendenciasDp dados={pendencias} hoje={HOJE} carregando={estPendencias === "carregando"} />
          </section>
        </div>
      </Bloco>

      <Bloco
        titulo="Atividade do DP no mês"
        porque="Os quatro trabalhos clássicos com a cor de cada um, a mesma na pilha da série e na legenda. Admissão e férias têm a cor da família delas na Produtividade; aviso e rescisão, que lá dividem o azul da movimentação, ganham cor própria para a pilha não fundir três barras iguais. A comparação é com o período anterior de mesmo tamanho, que é o que a lib mede, e o ranking soma todos os trabalhos do DP, então a descrição diz isso."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado
              opcoes={ESTADOS.map((e) => (e.valor === "vazio" ? { ...e, rotulo: "Mês parado" } : e))}
              valor={estAtividade}
              onMudar={setEstAtividade}
              rotulo="Estado da atividade"
            />
          </div>
          <FaixaAtividadeDp
            periodo={estAtividade === "carregando" ? undefined : PERIODO}
            atividade={atividade}
            carregando={estAtividade === "carregando"}
            onTentar={() => setEstAtividade("dado")}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SerieAtividadeDp
              className="xl:col-span-2"
              serie={serie}
              carregando={estAtividade === "carregando"}
              onTentar={() => setEstAtividade("dado")}
            />
            <RankingEquipeDp
              operadores={atividade?.topOperadores}
              carregando={estAtividade === "carregando"}
              onTentar={() => setEstAtividade("dado")}
            />
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Listas de urgência e prazo em texto"
        porque="O Meu Painel mostra os casos mais urgentes em lista curta, e cada linha abre a tela que resolve com a empresa dela já escolhida. O prazo é dito como se fala e com verbo neutro (venceu, vence), o mesmo para rescisão e férias. Na lista a cor vai no texto do prazo; na tabela ela fica com o selo, e a data leva o prazo apagado ao lado."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Segmentado opcoes={ESTADOS} valor={estListas} onMudar={setEstListas} rotulo="Estado das listas" />
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <ListaUrgencias
              titulo="Rescisões mais Urgentes"
              descricao="As pendentes mais perto do prazo de pagamento"
              acoes={
                <BotaoLink variante="fantasma" href="#" iconeFim="seta-direita">
                  Ver todas
                </BotaoLink>
              }
              itens={urgentes}
              carregando={estListas === "carregando"}
              vazio="Nenhuma rescisão pendente"
              onTentar={() => setEstListas("dado")}
            />
            <ListaUrgencias
              titulo="Férias mais Críticas"
              descricao="Mais períodos vencidos primeiro"
              itens={criticas}
              carregando={estListas === "carregando"}
              vazio="Ninguém com férias vencidas"
              onTentar={() => setEstListas("dado")}
            />
          </div>
          <div className="flex flex-wrap items-start gap-8">
            <Variante nome="Prazo com a cor da urgência">
              <div className="flex flex-col gap-1 text-pequeno">
                <TextoPrazo dias={-12} />
                <TextoPrazo dias={0} />
                <TextoPrazo dias={2} atencao />
                <TextoPrazo dias={40} />
              </div>
            </Variante>
            <Variante nome="Data com o prazo ao lado (tabela)">
              <div className="flex flex-col gap-1 text-corpo">
                <DataComPrazo data="2026-09-22" dias={-3} />
                <DataComPrazo data="2026-09-28" dias={3} />
                <DataComPrazo data={null} dias={null} />
              </div>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Situação da rescisão e o sinal do Questor"
        porque="A situação sai da distância do prazo até o fim do período, e paga é só a marcação manual do DP. O selo da paga leva a data, que é a primeira pergunta de quem o vê. O sinal do Questor (calculada, pagamento previsto) fica em coluna de apoio e não muda a situação, porque a data prevista é gravada no cálculo, antes do pagamento de fato."
      >
        <div className="flex flex-wrap items-start gap-8">
          <Variante nome="Situação">
            <div className="flex flex-wrap items-center gap-2">
              {RESCISOES.map((r) => (
                <SeloRescisao key={r.contrato} item={r} />
              ))}
            </div>
          </Variante>
          <Variante nome="No Questor">
            <div className="flex flex-col gap-1.5 text-corpo">
              <SinalQuestor item={{ calculada: true, pgtoPrevisto: "2026-09-22" }} />
              <SinalQuestor item={{ calculada: true, pgtoPrevisto: null }} />
              <SinalQuestor item={{ calculada: false, pgtoPrevisto: null }} />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Detalhe de uma rescisão"
        porque="A linha da fila é enxuta (funcionário, datas, situação e a ação); o motivo, o aviso prévio e a observação de quem marcou moram no detalhe, que a linha abre. A ação do rodapé é a mesma da linha, para quem abriu para conferir não ter de fechar e procurar o botão."
      >
        <PainelModal
          estatico
          titulo={RESCISOES[3].funcionario}
          descricao="Rescisão"
          onFechar={() => {}}
          rodape={
            <>
              <Botao variante="fantasma">Fechar</Botao>
              <Botao icone="reabrir">Reabrir</Botao>
            </>
          }
        >
          <CorpoRescisao item={RESCISOES[3]} />
        </PainelModal>
      </Bloco>

      <Bloco
        titulo="Marcar rescisão como paga"
        porque="É a marcação que tira o item da fila e para os avisos por e-mail, e mora no banco do app. A data nasce hoje e aceita a da homologação; a janela não fecha no clique fora, porque a observação digitada se perderia."
      >
        <PagamentoRescisaoEstatico item={RESCISOES[0]} />
      </Bloco>

      <Bloco
        titulo="Prazo e avisos de rescisão"
        porque="Cada gesto grava na hora (salvar o prazo, ligar ou desligar um destinatário, adicionar, remover), porque são três coisas independentes e um Salvar único perderia o destinatário desligado de quem fechou a janela. Remover pede confirmação na própria linha; desligar não, porque volta com um clique."
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Variante nome="Com destinatários">
            <ConfigRescisoesEstatica config={{ prazoDias: 10, diasAntes: 3 }} destinatarios={DESTINATARIOS} />
          </Variante>
          <Variante nome="Carregando, e sem ninguém cadastrado">
            <div className="flex flex-col gap-6">
              <ConfigRescisoesEstatica config={undefined} destinatarios={undefined} />
              <ConfigRescisoesEstatica config={{ prazoDias: 10, diasAntes: 3 }} destinatarios={[]} />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Situação de férias"
        palco
        porque="Pelo período aquisitivo em aberto mais crítico: vencida é o concessivo esgotado, com risco de pagar em dobro; a vencer é o limite a 120 dias ou menos. Direito adquirido e em dia são a maioria, e ficam fora da lista quando o filtro de pendentes está ligado."
      >
        <div className="flex flex-wrap items-center gap-2">
          {SITUACOES_FERIAS.map((s) => (
            <SeloFerias key={s} situacao={s} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Pendências do eSocial"
        porque="Admitido sem S-2200 aceito e desligado sem S-2299 aceito são o que o DP caça. A contagem vai no cabeçalho, para quem só quer saber se tem, e a lista vazia diz que está tudo aceito. A lib não separa o rejeitado do pendente nessas listas, então o selo diz sem recibo, que é verdade para os dois."
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <ListaPendenciasEsocial
              titulo="Admissões sem eSocial"
              descricao="Admitidos no período sem S-2200 aceito"
              icone="contrato"
              rotuloData="Admissão"
              itens={ADMISSOES_PENDENTES}
              vazio="Todas as admissões com S-2200 aceito"
            />
            <ListaPendenciasEsocial
              titulo="Rescisões sem eSocial"
              descricao="Desligados no período sem S-2299 aceito"
              icone="recibo"
              rotuloData="Desligamento"
              itens={[]}
              vazio="Todos os desligamentos com S-2299 aceito"
            />
          </div>
          <Variante nome="Selos de situação">
            <div className="flex flex-wrap items-center gap-2">
              <SeloEsocial situacao="aceito" />
              <SeloEsocial situacao="pendente" />
              <SeloEsocial situacao="rejeitado" />
              <SeloEsocial situacao="nao_enviado" />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Eventos do eSocial por tipo"
        porque="Cada tipo com o resultado numa barra de composição, na cor de juízo dos selos (aceito, pendente, rejeitado), e o número escrito ao lado. Zero fica apagado para o olho achar o que pede ação; a barra some abaixo de 900px, porque os números já dizem tudo."
      >
        <div className="flex flex-col gap-4">
          <Painel
            titulo="Eventos por Tipo"
            descricao="Volume transmitido no período e o resultado de cada tipo"
            acoes={<LegendaEsocial />}
            corpo="p-0"
          >
            <TabelaEventosEsocial eventos={EVENTOS} />
          </Painel>
          <Variante nome="Vazio">
            <Painel titulo="Eventos por Tipo" corpo="p-0">
              <TabelaEventosEsocial eventos={[]} />
            </Painel>
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
