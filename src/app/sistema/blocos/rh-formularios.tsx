"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { DetalheEnvioEstatico } from "@/componentes/produto/rh/envio-detalhe";
import { EnviarFormularioEstatico } from "@/componentes/produto/rh/envio-enviar";
import { QuandoEnvio, RespostasEnvio, SeloDestinatarioEnvio } from "@/componentes/produto/rh/envio-situacao";
import { AvisoSaidaEstatico } from "@/componentes/produto/rh/formulario-aviso-saida";
import { FolhaFormulario } from "@/componentes/produto/rh/formulario-folha";
import {
  EditorPergunta,
  MenuNovaPergunta,
  errosDoRascunho,
  itensNovaPergunta,
  rascunhoDoCampo,
  rascunhoDuplicado,
  rascunhoNovo,
  type RascunhoPergunta,
} from "@/componentes/produto/rh/formulario-pergunta";
import { SITUACOES_FORMULARIO, SeloSituacaoFormulario } from "@/componentes/produto/rh/formulario-situacao";
import { RegraEnvioEstatica, textoFrequencia, textoPublico } from "@/componentes/produto/rh/regra-envio";
import type { EnvioRegra } from "@/lib/envio-regras";
import type { EnvioDetalhe, EnvioResumo } from "@/lib/envios";
import type { FormularioCampo, FormularioResumo } from "@/lib/formularios-tipos";
import type { FuncionarioDiretorio, GestorRh, SetorRh } from "@/lib/rh-tipos";
import { Bloco, Variante } from "../bloco";
import { CAMPOS_FALSOS } from "./rh-base";

/*
 * Peças da seção Formulários do RH: a situação do formulário, a pergunta em
 * edição, a folha de quem responde (página por link e prévia do editor), o
 * aviso de saída sem salvar, a janela de envio, a situação de um envio e as
 * respostas dele, e a regra do envio automático. Tudo com dado de mentira.
 */

const SETORES: SetorRh[] = [
  { classiforgan: "01.01", nome: "Contábil", ativos: 18, origem: "questor" },
  { classiforgan: "01.02", nome: "Fiscal", ativos: 14, origem: "questor" },
  { classiforgan: "01.03", nome: "Departamento Pessoal", ativos: 11, origem: "questor" },
  { classiforgan: "01.04", nome: "Societário", ativos: 4, origem: "questor" },
  { classiforgan: "90.01", nome: "Qualidade", ativos: 2, origem: "app" },
];

const GESTORES: GestorRh[] = [
  { id: 1, classiforgan: "01.01", nome: "Camila Schmitt", email: "camila.schmitt@navecon.com.br", papel: "coordenador", ativo: true },
  { id: 2, classiforgan: "01.01", nome: "Diego Moretti", email: "diego.moretti@navecon.com.br", papel: "supervisor", ativo: true },
  { id: 3, classiforgan: "01.02", nome: "Elaine Kowalski", email: "elaine.kowalski@navecon.com.br", papel: "coordenador", ativo: true },
  { id: 4, classiforgan: "01.03", nome: "Fábio Richter", email: "fabio.richter@navecon.com.br", papel: "outro", ativo: true },
];

const pessoa = (
  i: number,
  nome: string,
  setor: SetorRh,
  cargo: string,
  email: string | null,
  origem: FuncionarioDiretorio["origem"] = "questor"
): FuncionarioDiretorio => ({
  codigoempresa: i % 3 === 0 ? 888 : 1,
  contrato: origem === "pj" ? 900_000_000 + i : 1200 + i,
  nome,
  cargo,
  setor: setor.nome,
  classiforgan: setor.classiforgan,
  dataadm: "2025-03-10",
  email,
  origem,
  editado: false,
});

const FUNCIONARIOS: FuncionarioDiretorio[] = [
  pessoa(1, "JOAO CARLOS DA SILVA", SETORES[0], "Analista contábil", "joao.silva@navecon.com.br"),
  pessoa(2, "MARIA APARECIDA DOS SANTOS", SETORES[1], "Analista fiscal", null),
  pessoa(3, "LUCAS GABRIEL PEREIRA", SETORES[2], "Assistente de DP", "lucas.pereira@navecon.com.br"),
  pessoa(4, "FERNANDA CRISTINA OLIVEIRA SCHMITZ", SETORES[0], "Analista contábil sênior", "fernanda.schmitz@navecon.com.br"),
  pessoa(5, "RAFAEL AUGUSTO KOCH", SETORES[3], "Consultor societário", "rafael@kochconsultoria.com.br", "pj"),
  pessoa(6, "PATRICIA HELENA MOREIRA", SETORES[1], "Assistente fiscal", null),
  pessoa(7, "ANDERSON LUIZ VIEIRA", SETORES[2], "Analista de DP", "anderson.vieira@navecon.com.br"),
];

const FORMULARIOS: FormularioResumo[] = [
  { id: 1, nome: "Pesquisa do fechamento", descricao: null, status: "ativo", campos: 3, atualizadoEm: "2026-09-02T10:14:00" },
  { id: 2, nome: "Avaliação de experiência", descricao: null, status: "ativo", campos: 5, atualizadoEm: "2026-08-20T16:40:00" },
  { id: 3, nome: "Clima 2026", descricao: null, status: "rascunho", campos: 8, atualizadoEm: "2026-09-18T09:02:00" },
];

const CAMPOS_ENVIO: FormularioCampo[] = [
  {
    id: 11,
    ordem: 1,
    tipo: "nota",
    rotulo: "Como foi o fechamento do mês no seu setor?",
    ajuda: null,
    obrigatorio: true,
    config: { escala: ["Muito ruim", "Ruim", "Normal", "Bom", "Muito bom"] },
  },
  {
    id: 12,
    ordem: 2,
    tipo: "selecao_multipla",
    rotulo: "O que atrasou o fechamento?",
    ajuda: "Marque o que pesou mais.",
    obrigatorio: false,
    config: { opcoes: ["Documento do cliente", "Questor lento", "Retrabalho", "Nada atrasou"] },
  },
  { id: 13, ordem: 3, tipo: "texto_longo", rotulo: "Comentários", ajuda: null, obrigatorio: false, config: {} },
];

const ENVIO: EnvioResumo = {
  id: 7,
  formularioNome: "Pesquisa do fechamento",
  titulo: "Fechamento de agosto",
  tipo: "manual",
  agendadoPara: null,
  disparadoEm: "2026-09-05T08:00:00",
  criadoEm: "2026-09-05T08:00:00",
  total: 5,
  respondidos: 3,
};

const DETALHE: EnvioDetalhe = {
  id: 7,
  titulo: "Fechamento de agosto",
  formulario: { id: 1, nome: "Pesquisa do fechamento", descricao: null, status: "ativo", campos: CAMPOS_ENVIO },
  destinatarios: [
    {
      id: 1,
      nome: "Camila Schmitt",
      email: "camila.schmitt@navecon.com.br",
      status: "respondido",
      respondidoPorNome: "Camila Schmitt",
      respondidoEm: "2026-09-05T11:20:00",
      valores: { "11": 3, "12": ["Documento do cliente"], "13": "Três clientes mandaram extrato depois do dia 3." },
    },
    {
      id: 2,
      nome: "Diego Moretti",
      email: "diego.moretti@navecon.com.br",
      status: "respondido",
      respondidoPorNome: "Juliana Muller",
      respondidoEm: "2026-09-06T09:02:00",
      valores: { "11": 4, "12": ["Nada atrasou"] },
    },
    {
      id: 3,
      nome: "Elaine Kowalski",
      email: "elaine.kowalski@navecon.com.br",
      status: "respondido",
      respondidoPorNome: "Elaine Kowalski",
      respondidoEm: "2026-09-08T17:45:00",
      valores: { "11": 1, "12": ["Questor lento", "Retrabalho"], "13": "O SPED travou duas vezes na mesma semana." },
    },
    { id: 4, nome: "Fábio Richter", email: "fabio.richter@navecon.com.br", status: "enviado", respondidoPorNome: null, respondidoEm: null, valores: null },
    { id: 5, nome: null, email: "consultoria@parceiro.com.br", status: "erro", respondidoPorNome: null, respondidoEm: null, valores: null },
  ],
};

const REGRA: EnvioRegra = {
  id: 1,
  formularioId: 1,
  formularioNome: "Pesquisa do fechamento",
  titulo: null,
  mensagem: "Leva dois minutos e ajuda a planejar o próximo fechamento.",
  destinatarioTipo: "gestores",
  alvoTipo: "setores",
  alvo: ["01.01", "01.02", "01.04"],
  freqTipo: "mensal",
  freqValor: 5,
  ativo: true,
  ultimoDisparo: "2026-09-05T08:00:00",
  proximoDisparo: "2026-10-05T08:00:00",
};

const NOMES_SETOR = new Map(SETORES.map((s) => [s.classiforgan, s.nome]));

function PerguntasVivas() {
  const [perguntas, setPerguntas] = useState<RascunhoPergunta[]>(() => [
    ...CAMPOS_FALSOS.slice(0, 2).map(rascunhoDoCampo),
    rascunhoDoCampo(CAMPOS_FALSOS[3]),
    { ...rascunhoNovo("selecao_multipla"), rotulo: "", opcoesTexto: "Pontualidade\nPontualidade" },
  ]);
  const [comErros, setComErros] = useState(true);

  const mudar = (chave: number, parcial: Partial<RascunhoPergunta>) =>
    setPerguntas((ps) =>
      ps.map((p) => (p.chave === chave ? { ...p, ...parcial } : parcial.decisao ? { ...p, decisao: false } : p))
    );
  const mover = (i: number, d: -1 | 1) =>
    setPerguntas((ps) => {
      const j = i + d;
      if (j < 0 || j >= ps.length) return ps;
      const n = [...ps];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado
          rotulo="Erros"
          valor={comErros ? "sim" : "nao"}
          onMudar={(v) => setComErros(v === "sim")}
          opcoes={[
            { valor: "nao", rotulo: "Antes de salvar" },
            { valor: "sim", rotulo: "Depois de tentar salvar" },
          ]}
        />
        <MenuNovaPergunta onEscolher={(t) => setPerguntas((ps) => [...ps, rascunhoNovo(t)])} />
      </div>
      <div className="flex max-w-3xl flex-col gap-3">
          {perguntas.map((p, i) => (
            <EditorPergunta
              key={p.chave}
              rascunho={p}
              indice={i}
              total={perguntas.length}
              erros={comErros ? errosDoRascunho(p) : undefined}
              onMudar={(parcial) => mudar(p.chave, parcial)}
              onMover={(d) => mover(i, d)}
              onDuplicar={() =>
                setPerguntas((ps) => [...ps.slice(0, i + 1), rascunhoDuplicado(p), ...ps.slice(i + 1)])
              }
              onRemover={() => setPerguntas((ps) => ps.filter((x) => x.chave !== p.chave))}
            />
          ))}
      </div>
      <Variante nome="Tipos do Adicionar pergunta">
        {/* O menu aberto é o primitivo (Sobreposições); aqui, só o que ele oferece.
            Um ListaMenu parado roubaria o foco e rolaria o catálogo até aqui. */}
        <ul className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {itensNovaPergunta(() => {}).map((it) =>
            "rotulo" in it && it.tipo !== "titulo" ? (
              <li key={it.rotulo} className="text-corpo text-tinta-2">
                <span className="font-[560] text-tinta">{it.rotulo}</span>
                {"descricao" in it && it.descricao ? <span className="text-apagado">: {it.descricao}</span> : null}
              </li>
            ) : null
          )}
        </ul>
      </Variante>
    </div>
  );
}

type Origem = "envio" | "experiencia" | "desempenho";

function FolhaViva() {
  const [origem, setOrigem] = useState<Origem>("experiencia");
  const comum = {
    onEnviar: async () => {
      avisar.info("No catálogo nada é enviado");
    },
  };
  return (
    <div className="flex flex-col gap-4">
      <Segmentado<Origem>
        rotulo="De onde vem o link"
        valor={origem}
        onMudar={setOrigem}
        opcoes={[
          { valor: "experiencia", rotulo: "Experiência" },
          { valor: "desempenho", rotulo: "Desempenho" },
          { valor: "envio", rotulo: "Envio comum" },
        ]}
      />
      <div className="max-w-2xl">
        {origem === "experiencia" && (
          <FolhaFormulario
            key="experiencia"
            {...comum}
            titulo="Avaliação de experiência de JOAO CARLOS DA SILVA"
            selo="45 dias"
            descricao="Responda até o fim do período de experiência. A recomendação vai para o RH decidir o contrato."
            contexto={[
              { rotulo: "Empresa", valor: "NAVECON" },
              { rotulo: "Cargo", valor: "Analista contábil" },
              { rotulo: "Setor", valor: "Contábil" },
              { rotulo: "Fim do período", valor: "24/10/2026" },
            ]}
            campos={CAMPOS_FALSOS}
          />
        )}
        {origem === "desempenho" && (
          <FolhaFormulario
            key="desempenho"
            {...comum}
            titulo="Avaliação de desempenho de FERNANDA CRISTINA OLIVEIRA SCHMITZ"
            apoio="Desempenho do 2º semestre"
            contexto={[
              { rotulo: "Empresa", valor: "NAVECON" },
              { rotulo: "Cargo", valor: "Analista contábil sênior" },
              { rotulo: "Setor", valor: "Contábil" },
            ]}
            varias
            campos={CAMPOS_FALSOS.slice(0, 2)}
          />
        )}
        {origem === "envio" && (
          <FolhaFormulario
            key="envio"
            titulo="Fechamento de agosto"
            mensagem="Leva dois minutos e ajuda a planejar o próximo fechamento."
            campos={CAMPOS_ENVIO}
            onEnviar={async () => {
              // A recusa do servidor aparece acima do botão, com a mensagem dele.
              throw new Error("Este formulário já foi respondido");
            }}
          />
        )}
      </div>
    </div>
  );
}

export function BlocosRhFormularios() {
  return (
    <>
      <Bloco
        titulo="Situação do formulário"
        porque="Só o formulário ativo pode ser enviado ou escolhido na experiência, no desempenho e nas avaliações, então só ele ganha cor. Rascunho e arquivado dão no mesmo para quem envia, e tom de alerta num rascunho faria a lista parecer cheia de problema."
        palco
      >
        <div className="flex flex-wrap gap-2">
          {SITUACOES_FORMULARIO.map((s) => (
            <SeloSituacaoFormulario key={s} status={s} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Pergunta em edição"
        porque="O tipo se escolhe uma vez, na criação: trocar marcação por pontuação perderia as opções sem aviso. Opções e níveis são texto, uma por linha, e a faixa da pontuação fica em texto até salvar, senão o campo numérico não deixa apagar para digitar de novo. Os erros só acendem depois da primeira tentativa de salvar, e a decisão é uma por formulário: marcar uma desmarca a outra."
      >
        <PerguntasVivas />
      </Bloco>

      <Bloco
        titulo="Folha de quem responde"
        porque="A mesma peça desenha a página aberta por link e a prévia do editor, senão a prévia mente sobre o que chega ao gestor. O título diz o que é e sobre quem; a pessoa avaliada sai da ficha para não aparecer duas vezes. O nome de quem responde é obrigatório porque no desempenho o mesmo link vai a todos os gestores do setor. A validação é a do servidor, e a recusa dele aparece acima do botão (no envio comum, aperte Enviar com tudo preenchido)."
      >
        <FolhaViva />
      </Bloco>

      <Bloco
        titulo="Saída sem salvar"
        porque="O App Router troca de página sem descarregar, então o aviso nativo do navegador não pega o clique na lateral nem no Voltar. O editor intercepta o link e pergunta aqui; fechar a aba continua com a pergunta do navegador."
      >
        <AvisoSaidaEstatico />
      </Bloco>

      <Bloco
        titulo="Enviar formulário"
        porque="Um público por envio, como no nexo2: misturar gestores, colaboradores e e-mails avulsos esconderia quem foi marcado na aba fora da vista. Gestores vêm agrupados por setor, com o setor inteiro marcável de uma vez. Colaborador sem e-mail aparece, mas fica de fora e a janela diz quantos. O assunto segue o nome do formulário até alguém escrever outro, e horário passado é recusado antes, porque o servidor mandaria na hora."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Da lista ou do editor, com o formulário escolhido">
            <EnviarFormularioEstatico
              formulario={{ id: 1, nome: "Pesquisa do fechamento" }}
              gestores={GESTORES}
              setores={SETORES}
              funcionarios={FUNCIONARIOS}
            />
          </Variante>
          <Variante nome="Da aba Envios, colaboradores respondendo">
            <EnviarFormularioEstatico
              formulario={null}
              formularios={FORMULARIOS}
              gestores={GESTORES}
              setores={SETORES}
              funcionarios={FUNCIONARIOS}
              modoInicial="colaboradores"
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Situação de um envio"
        porque="Quando saiu e quantos responderam, que é o que a lista precisa; quem respondeu o quê fica no detalhe. A data sai sem hora porque o banco devolve o horário sem fuso. A pessoa com e-mail pendente num envio que já saiu é falha de envio, e num agendado é o esperado, então o mesmo estado ganha palavras diferentes."
        palco
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Variante nome="Quando">
            <div className="flex flex-col gap-2">
              <QuandoEnvio envio={ENVIO} />
              <QuandoEnvio envio={{ disparadoEm: null, agendadoPara: "2026-10-01T09:00:00" }} />
              <QuandoEnvio envio={{ disparadoEm: null, agendadoPara: null }} />
            </div>
          </Variante>
          <Variante nome="Respostas">
            <div className="flex flex-col gap-2">
              <RespostasEnvio respondidos={3} total={5} />
              <RespostasEnvio respondidos={4} total={4} />
              <RespostasEnvio respondidos={0} total={12} />
            </div>
          </Variante>
          <Variante nome="Cada pessoa">
            <div className="flex flex-wrap gap-2">
              <SeloDestinatarioEnvio status="respondido" />
              <SeloDestinatarioEnvio status="enviado" />
              <SeloDestinatarioEnvio status="pendente" envioSaiu={false} />
              <SeloDestinatarioEnvio status="pendente" />
              <SeloDestinatarioEnvio status="erro" />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Respostas de um envio"
        porque="A resposta abre na própria linha, com as perguntas em leitura: no celular um segundo painel ao lado não caberia, e comparar duas respostas pede as duas abertas. Quando outra pessoa respondeu no lugar do destinatário, a linha diz quem."
      >
        <DetalheEnvioEstatico envio={ENVIO} detalhe={DETALHE} />
      </Bloco>

      <Bloco
        titulo="Envio automático"
        porque="Quem responde e o público são escolhas separadas, e a frase abaixo do público diz quem recebe em cada combinação. Com gestores respondendo, o setor sem gestor avisa na hora, porque ali ninguém receberia. O formulário que não está ativo fica na escolha só quando já é o da regra, com o aviso de que ela não envia."
      >
        <div className="flex flex-col gap-4">
          <p className="text-pequeno text-apagado">
            Na lista: <span className="text-tinta-2">{textoPublico(REGRA, NOMES_SETOR)}</span>,{" "}
            <span className="text-tinta-2">{textoFrequencia(REGRA.freqTipo, REGRA.freqValor)}</span>
          </p>
          <div className="max-w-2xl">
            <RegraEnvioEstatica
              regra={REGRA}
              formularios={FORMULARIOS}
              setores={SETORES}
              gestores={GESTORES}
              funcionarios={FUNCIONARIOS}
            />
          </div>
        </div>
      </Bloco>
    </>
  );
}
