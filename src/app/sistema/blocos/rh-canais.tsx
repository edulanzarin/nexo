"use client";

import { useState, type ReactNode } from "react";
import { CascaPublica } from "@/componentes/casca/casca-publica";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { ApuracaoFormulario } from "@/componentes/produto/rh/apuracao-formulario";
import { NovaRodadaEstatica } from "@/componentes/produto/rh/clima-nova-rodada";
import { RespostasClima } from "@/componentes/produto/rh/clima-respostas";
import { PainelRodada } from "@/componentes/produto/rh/clima-rodada";
import { LinkCanalEstatico } from "@/componentes/produto/rh/denuncia-canal";
import { ConversaDenuncia } from "@/componentes/produto/rh/denuncia-conversa";
import { DetalheDenunciaEstatico } from "@/componentes/produto/rh/denuncia-detalhe";
import { FaixaDenuncias, TabelaDenuncias } from "@/componentes/produto/rh/denuncia-fila";
import { ReciboDenuncia } from "@/componentes/produto/rh/denuncia-recibo";
import type { RespostaClima, RodadaResumo } from "@/lib/clima-tipos";
import type { DenunciaDashboard, DenunciaDetalhe, DenunciaResumo } from "@/lib/denuncia-tipos";
import type { Segmento } from "@/lib/formularios-apuracao";
import type { FormularioCampo, FormularioResumo, RespostaValores } from "@/lib/formularios-tipos";
import { Bloco, Variante } from "../bloco";

/*
 * Peças dos canais do RH: a fila e o detalhe da denúncia, a conversa com quem
 * denunciou (a mesma dos dois lados), o recibo de protocolo e senha, e a
 * avaliação de clima (a rodada, a nova rodada, o resumo montado das perguntas e
 * as respostas uma a uma). Tudo com dado de mentira.
 */

// ── Denúncia ─────────────────────────────────────────────────────────────────

const DENUNCIAS: DenunciaResumo[] = [
  {
    id: 1,
    protocolo: "DEN-2026-K7M4QX",
    categoria: "assedio_moral",
    status: "recebida",
    setorEnvolvido: "Fiscal",
    criadoEm: "2026-09-24T13:12:00Z",
    atualizadoEm: "2026-09-24T13:12:00Z",
    mensagens: 0,
    aguardandoRh: true,
  },
  {
    id: 2,
    protocolo: "DEN-2026-P3HT9W",
    categoria: "conduta",
    status: "em_analise",
    setorEnvolvido: null,
    criadoEm: "2026-09-18T19:40:00Z",
    atualizadoEm: "2026-09-23T11:05:00Z",
    mensagens: 4,
    aguardandoRh: true,
  },
  {
    id: 3,
    protocolo: "DEN-2026-ZN82RB",
    categoria: "seguranca",
    status: "em_analise",
    setorEnvolvido: "Recepção e arquivo do térreo",
    criadoEm: "2026-09-10T12:30:00Z",
    atualizadoEm: "2026-09-19T17:48:00Z",
    mensagens: 2,
    aguardandoRh: false,
  },
  {
    id: 4,
    protocolo: "DEN-2026-B5CJ6E",
    categoria: "discriminacao",
    status: "concluida",
    setorEnvolvido: "Contábil",
    criadoEm: "2026-08-02T14:00:00Z",
    atualizadoEm: "2026-08-29T20:15:00Z",
    mensagens: 5,
    aguardandoRh: false,
  },
  {
    id: 5,
    protocolo: "DEN-2026-F9VW2A",
    categoria: "outro",
    status: "arquivada",
    setorEnvolvido: null,
    criadoEm: "2026-07-15T10:20:00Z",
    atualizadoEm: "2026-07-21T12:00:00Z",
    mensagens: 1,
    aguardandoRh: false,
  },
];

const PAINEL_DENUNCIAS: DenunciaDashboard = {
  total: 14,
  porStatus: { recebida: 1, em_analise: 2, concluida: 8, arquivada: 3 },
  porCategoria: [
    { categoria: "conduta", qtd: 5 },
    { categoria: "assedio_moral", qtd: 4 },
    { categoria: "seguranca", qtd: 2 },
    { categoria: "discriminacao", qtd: 1 },
    { categoria: "outro", qtd: 2 },
  ],
  aguardandoRh: 2,
  horasPrimeiraResposta: 19.5,
};

const PAINEL_ZERADO: DenunciaDashboard = {
  total: 0,
  porStatus: { recebida: 0, em_analise: 0, concluida: 0, arquivada: 0 },
  porCategoria: [],
  aguardandoRh: 0,
  horasPrimeiraResposta: null,
};

const DETALHE: DenunciaDetalhe = {
  id: 2,
  protocolo: "DEN-2026-P3HT9W",
  categoria: "conduta",
  status: "em_analise",
  setorEnvolvido: null,
  criadoEm: "2026-09-18T19:40:00Z",
  atualizadoEm: "2026-09-23T11:05:00Z",
  relato:
    "Na reunião de fechamento de quinta-feira, um coordenador gritou com uma colega na frente da equipe e disse que ela seria a próxima a sair se atrasasse de novo.\n\nNão foi a primeira vez. Outras pessoas já choraram depois dessas reuniões.",
  mensagens: [
    {
      autor: "rh",
      autorNome: "Camila Schmitt",
      corpo: "Obrigada por contar. Já estamos apurando. Você lembra se mais alguém estava na sala?",
      criadoEm: "2026-09-19T12:10:00Z",
    },
    {
      autor: "denunciante",
      autorNome: null,
      corpo: "Umas cinco pessoas da equipe estavam lá.",
      criadoEm: "2026-09-19T22:31:00Z",
    },
    {
      autor: "rh",
      autorNome: "Camila Schmitt",
      corpo: "Certo. Vamos conversar com a equipe esta semana, sem citar o seu relato.",
      criadoEm: "2026-09-22T13:02:00Z",
    },
    {
      autor: "denunciante",
      autorNome: null,
      corpo: "Aconteceu de novo ontem, no corredor.",
      criadoEm: "2026-09-23T11:05:00Z",
    },
  ],
};

type EstadoFila = "dado" | "carregando" | "vazio" | "filtro";

const ESTADOS_FILA: { valor: EstadoFila; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Canal novo" },
  { valor: "filtro", rotulo: "Filtro sem nada" },
];

function FilaViva() {
  const [estado, setEstado] = useState<EstadoFila>("dado");
  const [aberta, setAberta] = useState<number | null>(null);
  const dados = estado === "carregando" ? undefined : estado === "dado" ? PAINEL_DENUNCIAS : PAINEL_ZERADO;
  const itens = estado === "carregando" ? undefined : estado === "dado" ? DENUNCIAS : [];
  let vazio: ReactNode;
  if (estado === "vazio")
    vazio = (
      <Vazio
        icone="escudo"
        titulo="Nenhuma denúncia recebida"
        descricao="Divulgue o link do canal para os colaboradores. Os relatos chegam aqui sem o nome de quem enviou."
        acao={<Botao icone="link">Ver o link do canal</Botao>}
      />
    );
  else if (estado === "filtro")
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhuma denúncia com esse filtro"
        descricao="Troque a situação ou o assunto."
        acao={<Botao>Limpar filtros</Botao>}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Segmentado opcoes={ESTADOS_FILA} valor={estado} onMudar={setEstado} rotulo="Estado da fila" />
      </div>
      <FaixaDenuncias dados={estado === "filtro" ? PAINEL_DENUNCIAS : dados} onFiltrar={() => {}} />
      <Painel corpo="p-0" titulo="Fila" descricao="Movimentação mais recente primeiro">
        <TabelaDenuncias itens={itens} vazio={vazio} onAbrir={(d) => setAberta(d.id)} abertaId={aberta} />
      </Painel>
    </div>
  );
}

// ── Clima ────────────────────────────────────────────────────────────────────

const RODADAS: RodadaResumo[] = [
  {
    id: 1,
    titulo: "Avaliação da empresa, 2º semestre de 2026",
    slug: "avaliacao-da-empresa-2-semestre-de-2026",
    status: "aberta",
    respostas: 24,
    abertoEm: "2026-09-01T12:00:00Z",
    fechadoEm: null,
  },
  {
    id: 2,
    titulo: "Avaliação da empresa, 1º semestre de 2026",
    slug: "avaliacao-da-empresa-1-semestre-de-2026",
    status: "fechada",
    respostas: 51,
    abertoEm: "2026-03-02T12:00:00Z",
    fechadoEm: "2026-03-31T21:00:00Z",
  },
];

const FORMULARIOS: FormularioResumo[] = [
  { id: 1, nome: "Clima organizacional", descricao: null, status: "ativo", campos: 7, atualizadoEm: "2026-08-28T12:00:00Z" },
  { id: 2, nome: "Pesquisa de benefícios", descricao: null, status: "ativo", campos: 4, atualizadoEm: "2026-06-10T12:00:00Z" },
  { id: 3, nome: "Integração de novos", descricao: null, status: "rascunho", campos: 3, atualizadoEm: "2026-09-20T12:00:00Z" },
];

const SETORES = ["Contábil", "Fiscal", "DP", "Administrativo"];
const TEMPOS = ["Menos de 1 ano", "1 a 3 anos", "Mais de 3 anos"];
const MOTIVOS = ["Equipe", "Salário", "Horário flexível", "Aprendizado", "Benefícios"];

const CAMPOS_CLIMA: FormularioCampo[] = [
  {
    id: 11,
    ordem: 1,
    tipo: "selecao_unica",
    rotulo: "Em qual setor você trabalha?",
    ajuda: null,
    obrigatorio: true,
    config: { opcoes: SETORES },
  },
  {
    id: 12,
    ordem: 2,
    tipo: "selecao_unica",
    rotulo: "Há quanto tempo você está na Navecon?",
    ajuda: null,
    obrigatorio: true,
    config: { opcoes: TEMPOS },
  },
  {
    id: 13,
    ordem: 3,
    tipo: "nota",
    rotulo: "Como você avalia a comunicação com a sua liderança?",
    ajuda: null,
    obrigatorio: true,
    config: { escala: ["Muito ruim", "Ruim", "Regular", "Boa", "Ótima"] },
  },
  {
    id: 14,
    ordem: 4,
    tipo: "nota",
    rotulo: "Você se sente reconhecido pelo seu trabalho?",
    ajuda: "1 é nada, 5 é muito.",
    obrigatorio: true,
    config: {},
  },
  {
    id: 15,
    ordem: 5,
    tipo: "selecao_multipla",
    rotulo: "O que mais pesa para você continuar na Navecon?",
    ajuda: null,
    obrigatorio: false,
    config: { opcoes: MOTIVOS },
  },
  {
    id: 16,
    ordem: 6,
    tipo: "pontuacao",
    rotulo: "De 0 a 10, quanto você indicaria a Navecon para um amigo trabalhar?",
    ajuda: null,
    obrigatorio: true,
    config: { min: 0, max: 10 },
  },
  {
    id: 17,
    ordem: 7,
    tipo: "texto_longo",
    rotulo: "O que a Navecon poderia fazer melhor?",
    ajuda: null,
    obrigatorio: false,
    config: {},
  },
];

const COMENTARIOS = [
  "Mais treinamento quando entra sistema novo.",
  "Uma reunião curta de alinhamento toda segunda ajudaria muito.",
  "",
  "O ar-condicionado da sala do Fiscal.",
  "Plano de carreira mais claro. Hoje ninguém sabe como sobe de nível.",
  "",
  "Feedback mais frequente, não só na avaliação do semestre.",
  "",
];

/**
 * Vinte e quatro respostas fixas (sorteio com semente, igual no servidor e no
 * navegador). Administrativo tem só duas, para a trava de recorte aparecer.
 */
function gerarRespostas(): RespostaClima[] {
  let s = 17;
  const sorteio = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const setores = [
    ...Array<string>(10).fill("Contábil"),
    ...Array<string>(7).fill("Fiscal"),
    ...Array<string>(5).fill("DP"),
    ...Array<string>(2).fill("Administrativo"),
  ];
  return setores.map((setor, i) => {
    const v: RespostaValores = {
      "11": setor,
      "12": TEMPOS[Math.floor(sorteio() * TEMPOS.length)],
      "13": Math.min(4, 1 + Math.floor(sorteio() * 4)),
      "14": Math.floor(sorteio() * 5),
      "15": MOTIVOS.filter(() => sorteio() > 0.55),
      "16": Math.round(4 + sorteio() * 6),
    };
    const comentario = COMENTARIOS[i % COMENTARIOS.length];
    if (comentario) v["17"] = comentario;
    return { valores: v, criadoEm: new Date(Date.UTC(2026, 8, 24 - Math.floor(i / 2), 14)).toISOString() };
  });
}

const RESPOSTAS = gerarRespostas();
const VALORES = RESPOSTAS.map((r) => r.valores);

function RodadaViva() {
  const [rodadas, setRodadas] = useState(RODADAS);
  const [id, setId] = useState(1);
  const rodada = rodadas.find((r) => r.id === id) ?? rodadas[0];
  const alternar = () =>
    setRodadas((rs) =>
      rs.map((r) =>
        r.id === rodada.id
          ? r.status === "aberta"
            ? { ...r, status: "fechada", fechadoEm: "2026-09-25T18:00:00Z" }
            : { ...r, status: "aberta", fechadoEm: null }
          : r
      )
    );
  return <PainelRodada rodadas={rodadas} rodada={rodada} onEscolher={setId} onAlternar={alternar} />;
}

function ApuracaoViva() {
  const [segmento, setSegmento] = useState<Segmento | null>(null);
  return (
    <ApuracaoFormulario campos={CAMPOS_CLIMA} respostas={VALORES} anonimo segmento={segmento} onSegmento={setSegmento} />
  );
}

export function BlocosRhCanais() {
  return (
    <>
      <Bloco
        titulo="Fila de denúncias"
        porque="A linha diz de que se trata e em que pé está, nunca o relato: denúncia é sensível e a fila fica à vista de quem passa pela tela. Novas e aguardando o RH são o que cobra ação e acendem em atenção; zero acende verde, porque fila vazia é um estado bom. Os números são do canal inteiro, sem o filtro, e os de situação filtram a fila no clique. Aguardando o RH não é situação gravada: é quem falou por último, e a lib só sabe dizer isso das abertas."
      >
        <FilaViva />
      </Bloco>

      <Bloco
        titulo="Conversa da denúncia"
        porque="Uma peça serve o RH e quem denunciou, trocando só quem é você: a própria mensagem vai à direita, como em todo aplicativo de conversa. Do lado do RH, a mensagem de quem denunciou leva esse nome e a do RH leva quem respondeu. O relato fica fora da conversa porque é o que o RH lê primeiro."
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Variante nome="Lado do RH" className="nx-vidro rounded-painel p-4">
            <ConversaDenuncia lado="rh" relato={DETALHE.relato} mensagens={DETALHE.mensagens} />
          </Variante>
          <Variante nome="Lado de quem denunciou" className="nx-vidro rounded-painel p-4">
            <ConversaDenuncia lado="denunciante" relato={DETALHE.relato} mensagens={DETALHE.mensagens} />
          </Variante>
        </div>
        <Variante nome="Ninguém respondeu ainda" className="nx-vidro rounded-painel p-4">
          <ConversaDenuncia lado="rh" relato={DETALHE.relato} mensagens={[]} />
        </Variante>
      </Bloco>

      <Bloco
        titulo="Detalhe de uma denúncia"
        porque="A situação muda num clique e grava na hora. A resposta fica no rodapé, fixa enquanto a conversa rola, e a janela não fecha no clique fora com resposta digitada. Encerrada não aceita resposta, e o botão de reabrir está ali mesmo, sem procurar a situação."
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Variante nome="Em análise (troque a situação para ver o rodapé mudar)">
            <DetalheDenunciaEstatico detalhe={DETALHE} />
          </Variante>
          <Variante nome="Concluída">
            <DetalheDenunciaEstatico
              detalhe={{ ...DETALHE, status: "concluida", setorEnvolvido: "Contábil", mensagens: DETALHE.mensagens.slice(0, 1) }}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Link do canal de denúncia"
        porque="O RH divulga o canal uma vez e trabalha a fila todo dia, então o link mora numa janela a um clique do cabeçalho e não ocupa a tela. Vão os dois endereços, o de denunciar e o de acompanhar, porque o cartaz do mural costuma levar os dois."
      >
        <LinkCanalEstatico />
      </Bloco>

      <Bloco
        titulo="Recibo da denúncia"
        porque="É a única vez que a senha aparece legível, e sem ela a denúncia não se acompanha mais. Protocolo e senha ficam grandes, inteiros e com copiar. O botão de acompanhar leva só o protocolo: senha no endereço ficaria no histórico do navegador, e digitá-la de novo confirma que a pessoa anotou."
      >
        <div className="overflow-hidden rounded-painel border border-dashed border-linha-forte">
          <CascaPublica embutida>
            <ReciboDenuncia protocolo="DEN-2026-K7M4QX" senha="HX4P-9QRM-T2WA" hrefAcompanhar="#" />
          </CascaPublica>
        </div>
      </Bloco>

      <Bloco
        titulo="Rodada de avaliação"
        porque="A rodada se escolhe no próprio painel, e a lista diz quantas respostas cada uma tem e quais pararam. Aberta mostra o link para divulgar; encerrada diz que o link parou. Encerrar não apaga nada, então as duas voltam com um clique e sem confirmação."
      >
        <RodadaViva />
      </Bloco>

      <Bloco
        titulo="Nova rodada de avaliação"
        porque="Só entram formulários ativos e com perguntas, que é o que o servidor aceita. Sem nenhum, a janela diz onde montar em vez de mostrar uma lista vazia. A rodada nasce aberta, e a janela avisa, porque o link já vale no instante em que ela é criada."
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Variante nome="Com formulários">
            <NovaRodadaEstatica formularios={FORMULARIOS} />
          </Variante>
          <Variante nome="Nenhum formulário usável">
            <NovaRodadaEstatica formularios={FORMULARIOS.filter((f) => f.status !== "ativo")} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Resumo de um formulário"
        porque="O resumo se monta da definição: marcação vira contagem por opção, nota vira média e distribuição do pior ao melhor, número vira média e faixas, texto se lista. A barra é o percentual de quem respondeu a pergunta, e não a proporção da maior opção, senão cinco opções empatadas desenhariam cinco barras cheias. Toda pergunta de marcação única com poucas opções vira recorte, e em pesquisa anônima o recorte com menos de três respostas fica escondido."
      >
        <Variante nome="Avaliação anônima (escolha Administrativo no recorte para ver a trava)">
          <ApuracaoViva />
        </Variante>
        <Variante nome="Sem respostas">
          <ApuracaoFormulario campos={CAMPOS_CLIMA} respostas={[]} anonimo segmento={null} onSegmento={() => {}} />
        </Variante>
      </Bloco>

      <Bloco
        titulo="Respostas uma a uma"
        porque="Cada resposta se lê inteira, com as perguntas do formulário e só a data: numa equipe pequena, a hora ajuda a adivinhar quem respondeu. A numeração conta da primeira para a última, então a resposta 1 é sempre a mesma, e dez por página ainda se lê sem cansar."
      >
        <RespostasClima campos={CAMPOS_CLIMA} respostas={RESPOSTAS} />
      </Bloco>
    </>
  );
}
