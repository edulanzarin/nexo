"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { PainelModal } from "@/componentes/primitivos/modal";
import { CobrarRodadaEstatica } from "@/componentes/produto/rh/desempenho-cobranca";
import { FormNovaAvaliacao, type DadosNovaAvaliacao } from "@/componentes/produto/rh/desempenho-nova";
import { CorpoDesempenho } from "@/componentes/produto/rh/desempenho-respostas";
import { SeloDesempenho, SeloEncerrada } from "@/componentes/produto/rh/desempenho-situacao";
import { ConfigExperienciaEstatica, type ConfigExperiencia } from "@/componentes/produto/rh/experiencia-config";
import { CorpoExperiencia, type RespostaExperiencia } from "@/componentes/produto/rh/experiencia-detalhe";
import { PreparoExperiencia, type PassoPreparo } from "@/componentes/produto/rh/experiencia-preparo";
import { DestaqueDecisao, LeituraResposta } from "@/componentes/produto/rh/experiencia-resposta";
import { GestoresSetor, SeloExperiencia, SeloMarco, SetorCargo } from "@/componentes/produto/rh/experiencia-situacao";
import type { FormularioCampo, FormularioResumo, RespostaValores } from "@/lib/formularios-tipos";
import { STATUS_DESEMPENHO } from "@/lib/rh-desempenho";
import { rotuloMarco, type StatusExperiencia } from "@/lib/rh-experiencia";
import type {
  DesempenhoDetalhe,
  DesempenhoItem,
  DesempenhoRodada,
  ExperienciaItem,
  FuncionarioDiretorio,
  GestorRh,
} from "@/lib/rh-tipos";
import { Bloco, Variante } from "../bloco";
import { CAMPOS_FALSOS } from "./rh-base";

/*
 * Peças das avaliações de pessoas do RH: a Experiência (marcos de 45 e 90 dias)
 * e o Desempenho (rodadas respondidas pelos gestores). Situação, quem recebe, a
 * decisão da resposta, o detalhe de cada uma, a configuração dos marcos, o
 * preparo dos envios, a nova avaliação e a cobrança da rodada. Dado de mentira,
 * contado a partir de 25/09/2026.
 */

// ── Experiência ──────────────────────────────────────────────────────────────

const STATUS_EXPERIENCIA: StatusExperiencia[] = ["pendente", "enviado", "atraso", "respondido"];

const RESPOSTA_EXPERIENCIA: RespostaValores = {
  "1": 3,
  "2": "Efetivar",
  "3": ["Organização", "Iniciativa"],
  "4": 8,
  "5": "Fechou a carteira de três empresas sozinha no segundo mês. Pode assumir o Simples da equipe.",
};

const FORMULARIO_EXPERIENCIA = {
  id: 7,
  nome: "Avaliação de experiência",
  descricao: null,
  status: "ativo" as const,
  campos: CAMPOS_FALSOS,
};

const RESPOSTA: RespostaExperiencia = {
  formulario: FORMULARIO_EXPERIENCIA,
  respondidoPorNome: "Camila Schmitt",
  respondidoEm: "2026-09-12T14:32:00",
  valores: RESPOSTA_EXPERIENCIA,
};

const EXPERIENCIA_RESPONDIDA: ExperienciaItem = {
  id: 41,
  codigoempresa: 1,
  contrato: 3120,
  nome: "LARISSA MENDES DA ROCHA",
  cargo: "Assistente contábil",
  setor: "Contábil",
  classiforgan: "0102",
  dataadm: "2026-08-03",
  marco: 45,
  vencimento: "2026-09-16",
  status: "respondido",
  diasParaVencer: -9,
  gestores: 2,
  ultimoLembrete: "2026-09-09T08:00:12",
  resposta: { recomendacao: "Efetivar", legada: false, respondidoPor: "Camila Schmitt", respondidoEm: "2026-09-12T14:32:00", comentarios: null },
};

const EXPERIENCIA_SEM_GESTOR: ExperienciaItem = {
  id: null,
  codigoempresa: 888,
  contrato: 412,
  nome: "OTAVIO LUIS BRANDT",
  cargo: "Auxiliar de departamento pessoal",
  setor: "Pessoal",
  classiforgan: "0104",
  dataadm: "2026-08-20",
  marco: 45,
  vencimento: "2026-10-03",
  status: "pendente",
  diasParaVencer: 8,
  gestores: 0,
  ultimoLembrete: null,
  resposta: null,
};

const EXPERIENCIA_ATRASADA: ExperienciaItem = {
  id: 44,
  codigoempresa: 1,
  contrato: 3087,
  nome: "MATHEUS FELIPE DAL PIVA",
  cargo: "Analista fiscal",
  setor: "Fiscal",
  classiforgan: "0103",
  dataadm: "2026-06-25",
  marco: 90,
  vencimento: "2026-09-22",
  status: "atraso",
  diasParaVencer: -3,
  gestores: 1,
  ultimoLembrete: "2026-09-24T08:00:05",
  resposta: null,
};

type EstadoExperiencia = "respondido" | "atraso" | "sem-gestor" | "carregando" | "erro" | "remover";

const ESTADOS_EXPERIENCIA: { valor: EstadoExperiencia; rotulo: string }[] = [
  { valor: "respondido", rotulo: "Respondido" },
  { valor: "atraso", rotulo: "Em atraso" },
  { valor: "sem-gestor", rotulo: "Sem gestor" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "erro", rotulo: "Indisponível" },
  { valor: "remover", rotulo: "Confirmando remoção" },
];

const CONFIG: ConfigExperiencia = {
  config: [{ marco: 45, formularioId: 7, diasAntes: 7 }],
  formularios: [
    { id: 7, nome: "Avaliação de experiência", descricao: null, status: "ativo", campos: 5, atualizadoEm: "2026-09-02T10:00:00" },
    { id: 11, nome: "Experiência 90 dias", descricao: null, status: "ativo", campos: 7, atualizadoEm: "2026-09-05T11:20:00" },
    { id: 12, nome: "Rascunho de efetivação", descricao: null, status: "ativo", campos: 0, atualizadoEm: "2026-09-20T09:10:00" },
  ],
};

type EstadoConfig = "dado" | "carregando" | "vazio" | "erro";

const PASSOS: PassoPreparo[] = [
  {
    chave: "45",
    feito: true,
    titulo: "Formulário do marco de 45 dias",
    detalhe: "Avaliação de experiência, sai 7 dias antes do vencimento",
  },
  {
    chave: "90",
    feito: false,
    titulo: "Formulário do marco de 90 dias",
    detalhe: "Nenhum ligado. O marco não sai para os gestores.",
    acao: <Botao icone="engrenagem">Configurar</Botao>,
  },
  {
    chave: "gestores",
    feito: false,
    titulo: "Gestores dos setores",
    detalhe: "3 pessoas em experiência estão em setor sem gestor.",
    acao: (
      <BotaoLink href="#" iconeFim="seta-direita">
        Cadastrar gestores
      </BotaoLink>
    ),
  },
];

// ── Desempenho ───────────────────────────────────────────────────────────────

const CAMPOS_DESEMPENHO: FormularioCampo[] = [
  {
    id: 21,
    ordem: 1,
    tipo: "nota",
    rotulo: "Entrega dentro do prazo",
    ajuda: null,
    obrigatorio: true,
    config: {},
  },
  {
    id: 22,
    ordem: 2,
    tipo: "nota",
    rotulo: "Qualidade do trabalho",
    ajuda: null,
    obrigatorio: true,
    config: { escala: ["Abaixo do esperado", "No esperado", "Acima do esperado"] },
  },
  {
    id: 23,
    ordem: 3,
    tipo: "selecao_unica",
    rotulo: "Indicação",
    ajuda: "O que o gestor recomenda para o próximo semestre.",
    obrigatorio: true,
    config: { opcoes: ["Promover", "Manter", "Acompanhar de perto"], papel: "decisao" },
  },
  {
    id: 24,
    ordem: 4,
    tipo: "texto_longo",
    rotulo: "Comentários",
    ajuda: null,
    obrigatorio: false,
    config: {},
  },
];

const AVALIACAO: DesempenhoItem = {
  id: 90,
  rodadaId: 12,
  rodadaTitulo: "Avaliação semestral 2026/2",
  escopo: "escritorio",
  formularioId: 8,
  formularioNome: "Desempenho semestral",
  codigoempresa: 1,
  contrato: 2988,
  nome: "RAFAEL AUGUSTO KOCH",
  cargo: "Analista fiscal",
  setor: "Fiscal",
  classiforgan: "0103",
  status: "respondido",
  gestores: 2,
  respostas: 2,
  respondentes: ["Diego Moretti", "Elaine Kowalski"],
  ultimaResposta: "2026-09-18T10:02:00",
  lembretes: 1,
  ultimoLembrete: "2026-09-15T09:00:00",
  criadoEm: "2026-09-08T16:20:00",
  enviadoEm: "2026-09-08T16:20:04",
  encerradoEm: null,
};

const DETALHE: DesempenhoDetalhe = {
  id: 90,
  titulo: AVALIACAO.rodadaTitulo,
  funcionarioNome: AVALIACAO.nome,
  codigoempresa: 1,
  cargo: AVALIACAO.cargo,
  setor: AVALIACAO.setor,
  criadoEm: AVALIACAO.criadoEm,
  encerradoEm: null,
  formulario: { id: 8, nome: "Desempenho semestral", descricao: null, status: "ativo", campos: CAMPOS_DESEMPENHO },
  respostas: [
    {
      id: 301,
      nome: "Diego Moretti",
      email: "diego.moretti@navecon.com.br",
      respondidoEm: "2026-09-10T11:45:00",
      valores: { "21": 4, "22": 2, "23": "Promover", "24": "Assumiu a apuração do Lucro Real sem acompanhamento." },
    },
    {
      id: 302,
      nome: "Elaine Kowalski",
      email: null,
      respondidoEm: "2026-09-18T10:02:00",
      valores: { "21": 3, "22": 1, "23": "Manter" },
    },
  ],
};

type EstadoDesempenho = "duas" | "uma" | "nenhuma" | "encerrada" | "carregando" | "erro" | "remover";

const ESTADOS_DESEMPENHO: { valor: EstadoDesempenho; rotulo: string }[] = [
  { valor: "duas", rotulo: "Duas respostas" },
  { valor: "uma", rotulo: "Uma resposta" },
  { valor: "nenhuma", rotulo: "Sem resposta" },
  { valor: "encerrada", rotulo: "Encerrada" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "erro", rotulo: "Indisponível" },
  { valor: "remover", rotulo: "Confirmando remoção" },
];

const RODADA: DesempenhoRodada = {
  id: 12,
  titulo: "Avaliação semestral 2026/2",
  escopo: "escritorio",
  formularioNome: "Desempenho semestral",
  criadoEm: "2026-09-08T16:20:00",
  avaliacoes: 64,
  respondidas: 41,
  aCobrar: 17,
};

const FORMULARIOS: FormularioResumo[] = [
  { id: 8, nome: "Desempenho semestral", descricao: null, status: "ativo", campos: 4, atualizadoEm: "2026-09-01T09:00:00" },
  { id: 7, nome: "Avaliação de experiência", descricao: null, status: "ativo", campos: 5, atualizadoEm: "2026-09-02T10:00:00" },
  { id: 13, nome: "Avaliação 360", descricao: null, status: "ativo", campos: 0, atualizadoEm: "2026-09-21T15:00:00" },
  { id: 5, nome: "Desempenho 2025", descricao: null, status: "arquivado", campos: 6, atualizadoEm: "2025-12-10T09:00:00" },
];

const pessoa = (
  codigoempresa: number,
  contrato: number,
  nome: string,
  setor: string,
  classiforgan: string,
  cargo: string
): FuncionarioDiretorio => ({
  codigoempresa,
  contrato,
  nome,
  cargo,
  setor,
  classiforgan,
  dataadm: "2024-03-01",
  email: null,
  origem: "questor",
  editado: false,
});

const FUNCIONARIOS: FuncionarioDiretorio[] = [
  pessoa(1, 3120, "LARISSA MENDES DA ROCHA", "Contábil", "0102", "Assistente contábil"),
  pessoa(1, 2988, "RAFAEL AUGUSTO KOCH", "Fiscal", "0103", "Analista fiscal"),
  pessoa(1, 3087, "MATHEUS FELIPE DAL PIVA", "Fiscal", "0103", "Analista fiscal"),
  pessoa(888, 412, "OTAVIO LUIS BRANDT", "Pessoal", "0104", "Auxiliar de departamento pessoal"),
  pessoa(888, 398, "PRISCILA ANDRADE VOSS", "Pessoal", "0104", "Analista de departamento pessoal"),
  pessoa(746, 77, "JULIANA BEATRIZ MULLER", "Contábil", "0102", "Analista contábil"),
  pessoa(1, 2850, "GUSTAVO HENRIQUE ALVES", "Contábil", "0102", "Coordenador contábil"),
];

const GESTORES: GestorRh[] = [
  { id: 1, classiforgan: "0102", nome: "Camila Schmitt", email: "camila.schmitt@navecon.com.br", papel: "coordenador", ativo: true },
  { id: 2, classiforgan: "0103", nome: "Diego Moretti", email: "diego.moretti@navecon.com.br", papel: "supervisor", ativo: true },
  { id: 3, classiforgan: "0103", nome: "Elaine Kowalski", email: "elaine.kowalski@navecon.com.br", papel: "coordenador", ativo: true },
];

type EstadoNova = "pessoas" | "setor" | "carregando" | "sem-formulario" | "erro";

const ESTADOS_NOVA: { valor: EstadoNova; rotulo: string }[] = [
  { valor: "pessoas", rotulo: "Pessoas marcadas" },
  { valor: "setor", rotulo: "Um setor sem gestor" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "sem-formulario", rotulo: "Sem formulário ativo" },
  { valor: "erro", rotulo: "Indisponível" },
];

const semAcao = async () => true;

function DetalheExperienciaVivo() {
  const [estado, setEstado] = useState<EstadoExperiencia>("respondido");
  const item =
    estado === "atraso" || estado === "remover"
      ? EXPERIENCIA_ATRASADA
      : estado === "sem-gestor"
        ? EXPERIENCIA_SEM_GESTOR
        : EXPERIENCIA_RESPONDIDA;
  const remover = estado === "remover";
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-full overflow-x-auto">
        <Segmentado opcoes={ESTADOS_EXPERIENCIA} valor={estado} onMudar={setEstado} rotulo="Estado do detalhe" />
      </div>
      <PainelModal
        estatico
        titulo={item.nome}
        descricao={`Experiência, marco de ${rotuloMarco(item.marco)}`}
        onFechar={() => {}}
        rodape={
          <>
            {item.id != null &&
              (remover ? (
                <Botao variante="perigo" icone="apagar" className="mr-auto">
                  Confirmar remoção
                </Botao>
              ) : (
                <Botao variante="fantasma" icone="apagar" className="mr-auto">
                  Remover
                </Botao>
              ))}
            <Botao variante="fantasma">{remover ? "Cancelar" : "Fechar"}</Botao>
            {item.status !== "respondido" && !remover && (
              <Botao variante="primario" icone="email" disabled={item.gestores === 0}>
                {item.ultimoLembrete ? "Reenviar aos gestores" : "Enviar aos gestores"}
              </Botao>
            )}
          </>
        }
      >
        <CorpoExperiencia
          item={item}
          resposta={estado === "respondido" ? RESPOSTA : undefined}
          erroResposta={estado === "erro" ? "Resposta não encontrada" : null}
          onTentarResposta={() => setEstado("respondido")}
          confirmandoRemocao={remover}
        />
      </PainelModal>
    </div>
  );
}

function ConfigVivo() {
  const [estado, setEstado] = useState<EstadoConfig>("dado");
  const dados =
    estado === "carregando" ? undefined : estado === "vazio" ? { config: [], formularios: [] } : CONFIG;
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-full overflow-x-auto">
        <Segmentado
          opcoes={[
            { valor: "dado", rotulo: "Um marco ligado" },
            { valor: "carregando", rotulo: "Carregando" },
            { valor: "vazio", rotulo: "Nenhum formulário ativo" },
            { valor: "erro", rotulo: "Indisponível" },
          ]}
          valor={estado}
          onMudar={setEstado}
          rotulo="Estado da configuração"
        />
      </div>
      <ConfigExperienciaEstatica
        key={estado}
        dados={dados}
        erro={estado === "erro" ? "Você não tem acesso a esta função." : undefined}
      />
    </div>
  );
}

function NovaVivo() {
  const [estado, setEstado] = useState<EstadoNova>("pessoas");
  const dados: DadosNovaAvaliacao = {
    formularios:
      estado === "carregando" ? undefined : estado === "sem-formulario" ? FORMULARIOS.filter((f) => f.status !== "ativo") : FORMULARIOS,
    funcionarios: estado === "carregando" ? undefined : FUNCIONARIOS,
    gestores: estado === "carregando" ? undefined : GESTORES,
    erro: estado === "erro" ? "Você não tem acesso a esta função." : null,
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-full overflow-x-auto">
        <Segmentado opcoes={ESTADOS_NOVA} valor={estado} onMudar={setEstado} rotulo="Estado da nova avaliação" />
      </div>
      <FormNovaAvaliacao
        // Cada estado começa do próprio rascunho.
        key={estado}
        estatico
        dados={dados}
        onEnviar={semAcao}
        onFechar={() => {}}
        inicial={
          estado === "setor"
            ? {
                formulario: "8",
                modo: "setor",
                selecionados: [],
                setor: "0104",
                empresa: "todas",
                titulo: "",
                mensagem: "",
              }
            : {
                formulario: "8",
                modo: "pessoas",
                selecionados: ["1:3120", "1:2988", "888:412"],
                setor: null,
                empresa: "todas",
                titulo: "Avaliação semestral 2026/2",
                mensagem: "Respondam até sexta, por favor. A conversa de retorno é na semana que vem.",
              }
        }
      />
    </div>
  );
}

function RespostasVivo() {
  const [estado, setEstado] = useState<EstadoDesempenho>("duas");
  const semResposta = estado === "nenhuma" || estado === "encerrada";
  const item: DesempenhoItem =
    estado === "uma"
      ? { ...AVALIACAO, respostas: 1, respondentes: ["Diego Moretti"] }
      : semResposta
        ? {
            ...AVALIACAO,
            status: "enviado",
            respostas: 0,
            respondentes: [],
            ultimaResposta: null,
            encerradoEm: estado === "encerrada" ? "2026-09-22T17:00:00" : null,
          }
        : AVALIACAO;
  const detalhe =
    estado === "duas" || estado === "remover"
      ? DETALHE
      : estado === "uma"
        ? { ...DETALHE, respostas: DETALHE.respostas.slice(0, 1) }
        : undefined;
  const remover = estado === "remover";
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-full overflow-x-auto">
        <Segmentado opcoes={ESTADOS_DESEMPENHO} valor={estado} onMudar={setEstado} rotulo="Estado das respostas" />
      </div>
      <PainelModal
        estatico
        titulo={item.nome}
        descricao={item.rodadaTitulo}
        onFechar={() => {}}
        rodape={
          remover ? (
            <>
              <Botao variante="perigo" icone="apagar" className="mr-auto">
                Confirmar remoção
              </Botao>
              <Botao variante="fantasma">Cancelar</Botao>
            </>
          ) : (
            <>
              <Botao variante="fantasma" icone="apagar" className="mr-auto">
                Remover
              </Botao>
              <Botao icone={item.encerradoEm ? "reabrir" : "bloqueado"}>{item.encerradoEm ? "Reabrir" : "Encerrar"}</Botao>
              {!item.encerradoEm && <Botao icone="email">Reenviar</Botao>}
              {estado === "nenhuma" && (
                <Botao variante="primario" icone="relogio">
                  Cobrar gestores
                </Botao>
              )}
            </>
          )
        }
      >
        <CorpoDesempenho
          key={estado}
          item={item}
          detalhe={detalhe}
          erro={estado === "erro" ? "Avaliação não encontrada" : null}
          onTentar={() => setEstado("duas")}
          confirmandoRemocao={remover}
        />
      </PainelModal>
    </div>
  );
}

export function BlocosRhAvaliacoes() {
  return (
    <>
      <Bloco
        titulo="Situação do marco e da avaliação"
        palco
        porque="Aguardando resposta leva o tom de rota porque o formulário está com os gestores e no prazo; atenção fica para o que pede mão, perigo para o vencido, e encerrada é um selo à parte porque a avaliação respondida ou não pode estar com o link fechado."
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {STATUS_EXPERIENCIA.map((s) => (
              <SeloExperiencia key={s} status={s} />
            ))}
            <SeloMarco marco={45} />
            <SeloMarco marco={90} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {STATUS_DESEMPENHO.map((s) => (
              <SeloDesempenho key={s} status={s} />
            ))}
            <SeloEncerrada em="2026-09-22" />
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Quem recebe o link"
        palco
        porque="Zero gestor quer dizer que o formulário não sai para ninguém, a causa mais comum de avaliação parada, e o aviso já leva ao cadastro de Gestores, onde se resolve."
      >
        <div className="flex flex-wrap items-center gap-6 text-corpo">
          <GestoresSetor n={1} />
          <GestoresSetor n={3} />
          <GestoresSetor n={0} />
        </div>
      </Bloco>

      <Bloco
        titulo="Setor e cargo na linha"
        porque="Uma célula só, com o setor primeiro porque é ele que decide quem recebe o formulário; sem espaço, a reticência come o cargo e o nome inteiro fica na dica."
      >
        <div className="flex max-w-xs flex-col gap-2 text-corpo text-tinta-2">
          <SetorCargo setor="Fiscal" cargo="Analista fiscal" />
          <SetorCargo setor="Pessoal" cargo="Auxiliar de departamento pessoal com uma descrição de cargo bem longa" />
          <SetorCargo setor={null} cargo="Estagiário" />
        </div>
      </Bloco>

      <Bloco
        titulo="Decisão da resposta"
        porque="A decisão é a pergunta que o RH marcou como decisão no editor, e sobe para o topo da leitura e para a coluna da lista porque é a resposta que o RH procura primeiro; a pergunta continua no lugar dela entre as outras."
      >
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Variante nome="Destaque sozinho">
            <DestaqueDecisao decisao={{ pergunta: "Recomendação", resposta: "Efetivar" }} />
          </Variante>
          <Variante nome="Leitura de uma resposta" className="nx-vidro rounded-painel p-4">
            <LeituraResposta
              campos={CAMPOS_FALSOS}
              valores={RESPOSTA_EXPERIENCIA}
              nome="Camila Schmitt"
              email="camila.schmitt@navecon.com.br"
              em="2026-09-12T14:32:00"
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Detalhe de um marco de experiência"
        porque="A linha é enxuta e o detalhe junta a pessoa, o prazo, quem recebe e a resposta do gestor; remover pede confirmação no próprio rodapé e diz antes o que se perde."
      >
        <DetalheExperienciaVivo />
      </Bloco>

      <Bloco
        titulo="Preparo dos envios"
        porque="Com o banco vazio é a primeira coisa que o RH vê: o que falta para o formulário sair, cada passo pendente com o botão que resolve, e o painel some sozinho quando tudo está pronto."
      >
        <PreparoExperiencia passos={PASSOS} />
      </Bloco>

      <Bloco
        titulo="Configuração da experiência"
        porque="Cada marco tem o seu Salvar porque são duas decisões independentes, e os formulários vêm da rota da própria configuração, que a seção Experiência alcança sem precisar da de Formulários."
      >
        <ConfigVivo />
      </Bloco>

      <Bloco
        titulo="Nova avaliação de desempenho"
        porque="Mostra antes do envio quantas avaliações saem e quem fica de fora por setor sem gestor, com a mesma regra do servidor, porque o e-mail que saiu não volta."
      >
        <NovaVivo />
      </Bloco>

      <Bloco
        titulo="Respostas de uma avaliação de desempenho"
        porque="Cada gestor responde a sua pelo mesmo link, então há uma aba por resposta com a decisão no topo; sem resposta, o vazio diz o motivo pelo estado da avaliação em vez de só dizer que não há nada."
      >
        <RespostasVivo />
      </Bloco>

      <Bloco
        titulo="Cobrar a rodada"
        porque="É o único gesto da tela que escreve para muita gente de uma vez, então confirma antes dizendo quantas avaliações recebem o lembrete e quais ficam de fora."
      >
        <div className="max-w-md">
          <CobrarRodadaEstatica rodada={RODADA} />
        </div>
      </Bloco>
    </>
  );
}
