"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados } from "@/componentes/primitivos/tabela";
import { mutar } from "@/hooks/mutar";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import { rotuloSetor, temCampo, type CampoPM } from "@/lib/postmortem-setores";
import {
  CRITICIDADE_DEF,
  CRITICIDADE_ROTULO,
  CRITICIDADES,
  GRAVIDADES,
  validarEnvio,
  type Criticidade,
  type DadosPM,
  type Fatores,
  type GrupoOpcao,
  type Impactos,
  type RelatorioPM,
} from "@/lib/postmortem-tipos";
import { CHAVE_PM } from "./consulta";
import { numeroPM, SeloCriticidade, SeloGravidade, SeloSituacaoPM } from "./selos";

/*
 * O formulário do Relatório Post Mortem, o mesmo para todo setor. O tronco
 * (identificação, descrição, impactos, causa raiz, ações, lições) não muda com
 * o setor; os poucos campos que mudam vêm do catálogo de setores
 * (`temCampo`), nunca de um `if (setor === ...)` no meio da tela.
 *
 * Em leitura (relatório enviado, ou de outra pessoa aberto pela gestão) o campo
 * vira texto: campo desabilitado a meia opacidade é ruim de ler justamente
 * para quem veio só ler.
 */

/** Textos das duas confirmações. Exportados para o catálogo mostrar o modal aberto. */
export const CONFIRMACAO_PM = {
  enviar: {
    titulo: "Enviar o relatório?",
    texto: "Enviado, ele recebe o número do setor e fica só para leitura, para você e para a gestão.",
    acao: "Enviar relatório",
  },
  excluir: {
    titulo: "Excluir o rascunho?",
    texto: "O rascunho sai da sua lista e não volta.",
    acao: "Excluir rascunho",
  },
} as const;

// O rótulo que `validarEnvio` devolve para cada campo cobrado no envio. É por
// ele que o campo sabe que está faltando: a lista de obrigatórios mora na lib,
// que o servidor também usa, e a tela só a espelha.
const COBRADO = {
  criticidade: "Criticidade",
  grupo: "Grupo",
  empresa: "Cliente / Empresa afetada",
  processo: "Processo / Rotina envolvida",
  ocorrido: "Data em que o erro ocorreu",
  descricao: "Descrição do Erro",
  causa: "Causa raiz identificada",
} as const;

// `campo` marca o impacto que só alguns setores enxergam.
const IMPACTOS: { chave: keyof Impactos; rotulo: string; ajuda?: string; campo?: CampoPM }[] = [
  { chave: "financeiro", rotulo: "Impacto financeiro", ajuda: "Valores, se houver" },
  {
    chave: "trabalhista",
    rotulo: "Impacto trabalhista ou legal",
    ajuda: "Multa, passivo, risco de ação",
    campo: "impactoTrabalhista",
  },
  { chave: "cliente", rotulo: "Impacto ao cliente", ajuda: "Relação, confiança, retrabalho" },
  { chave: "funcionarios", rotulo: "Impacto aos funcionários afetados", campo: "impactoFuncionarios" },
  { chave: "reputacional", rotulo: "Impacto reputacional ou interno", ajuda: "Dentro do escritório" },
  { chave: "outros", rotulo: "Outros impactos" },
];

const FATORES: { chave: keyof Fatores; rotulo: string; ajuda: string }[] = [
  { chave: "processo", rotulo: "Processo", ajuda: "Inexistente, incompleto ou não seguido" },
  { chave: "pessoas", rotulo: "Pessoas", ajuda: "Treinamento, sobrecarga, distração" },
  { chave: "sistema", rotulo: "Sistema ou ferramenta", ajuda: "Falha, limitação, configuração" },
  { chave: "comunicacao", rotulo: "Comunicação", ajuda: "Entre setores, com o cliente, entre turnos" },
  { chave: "prazo", rotulo: "Prazo", ajuda: "Urgência, acúmulo, prazo apertado" },
];

type ColunaRep<T> = { chave: keyof T & string; rotulo: string; data?: boolean };

const COL_LINHA_TEMPO: ColunaRep<RelatorioPM["linhaTempo"][number]>[] = [
  { chave: "data", rotulo: "Data e hora" },
  { chave: "evento", rotulo: "Evento" },
  { chave: "responsavel", rotulo: "Responsável" },
];
const COL_CORRETIVAS: ColunaRep<RelatorioPM["acoesCorretivas"][number]>[] = [
  { chave: "acao", rotulo: "Ação corretiva" },
  { chave: "responsavel", rotulo: "Responsável" },
  { chave: "prazo", rotulo: "Prazo", data: true },
  { chave: "status", rotulo: "Status" },
];
const COL_PREVENTIVAS: ColunaRep<RelatorioPM["acoesPreventivas"][number]>[] = [
  { chave: "acao", rotulo: "Ação preventiva ou novo processo" },
  { chave: "responsavel", rotulo: "Responsável" },
  { chave: "prazo", rotulo: "Prazo", data: true },
  { chave: "validacao", rotulo: "Como será validado" },
  { chave: "status", rotulo: "Status" },
];

/** Valor preenchido, ou o aviso apagado de que ninguém preencheu. */
function Leitura({ children }: { children: ReactNode }) {
  const vazio = children == null || children === "";
  return (
    <p className={vazio ? "text-corpo text-apagado italic" : "text-corpo break-words whitespace-pre-wrap text-tinta"}>
      {vazio ? "Não preenchido" : children}
    </p>
  );
}

/** Uma seção numerada do relatório (a numeração é a do documento do escritório). */
function Secao({ n, titulo, descricao, children }: { n: number; titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <Painel
      titulo={
        <>
          <span className="num mr-2 text-apagado">{n}</span>
          {titulo}
        </>
      }
      descricao={descricao}
      corpo="flex flex-col gap-4"
    >
      {children}
    </Painel>
  );
}

/** Campo de texto que vira leitura quando o relatório não é editável. */
function CampoTexto({
  rotulo,
  ajuda,
  erro,
  valor,
  onMudar,
  ro,
  linhas,
  tipo,
  className,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string;
  valor: string;
  onMudar: (v: string) => void;
  ro: boolean;
  /** Com linhas, vira área de texto. */
  linhas?: number;
  tipo?: "date" | "number";
  className?: string;
}) {
  const id = useId();
  if (ro)
    return (
      <Rotulado rotulo={rotulo} className={className}>
        <Leitura>{tipo === "date" ? (valor ? dataBR(valor) : "") : valor}</Leitura>
      </Rotulado>
    );
  return (
    <Rotulado rotulo={rotulo} ajuda={ajuda} erro={erro} htmlFor={id} className={className}>
      {linhas ? (
        <AreaTexto id={id} rows={linhas} value={valor} aria-invalid={!!erro} onChange={(e) => onMudar(e.target.value)} />
      ) : (
        <Campo
          id={id}
          type={tipo ?? "text"}
          min={tipo === "number" ? 0 : undefined}
          value={valor}
          aria-invalid={!!erro}
          onChange={(e) => onMudar(e.target.value)}
        />
      )}
    </Rotulado>
  );
}

/**
 * Lista repetível de linhas (linha do tempo, ações). Editando, é uma grade de
 * campos com o cabeçalho uma vez só no topo, e não rótulo repetido em cada
 * linha; lendo, é tabela.
 */
function Repetivel<T extends Record<keyof T, string>>({
  rotulo,
  linhas,
  colunas,
  grade,
  novo,
  onMudar,
  ro,
  rotuloAdicionar,
}: {
  rotulo: string;
  linhas: T[];
  colunas: ColunaRep<T>[];
  /** Colunas da grade no desktop (`"9rem 1fr 12rem"`). */
  grade: string;
  novo: () => T;
  onMudar: (l: T[]) => void;
  ro: boolean;
  rotuloAdicionar: string;
}) {
  const titulo = <p className="text-pequeno font-[560] text-tinta-2">{rotulo}</p>;

  if (ro)
    return (
      <div className="flex flex-col gap-1.5">
        {titulo}
        {linhas.length === 0 ? (
          <Leitura>{null}</Leitura>
        ) : (
          <div className="overflow-hidden rounded-controle border border-linha">
            <TabelaDados
              colunas={colunas.map((c) => ({
                id: c.chave,
                cabecalho: c.rotulo,
                celula: (l: T) =>
                  c.data ? (
                    <span className="num">{l[c.chave] ? dataBR(l[c.chave]) : "—"}</span>
                  ) : (
                    <span className="block py-1.5 break-words">{l[c.chave] || "—"}</span>
                  ),
              }))}
              linhas={linhas}
              chave={(_, i) => String(i)}
              rotulo={rotulo}
            />
          </div>
        )}
      </div>
    );

  const estilo = { "--grade": `${grade} 32px` } as CSSProperties;
  const mudar = (i: number, chave: keyof T & string, v: string) =>
    onMudar(linhas.map((l, j) => (j === i ? { ...l, [chave]: v } : l)));

  return (
    <div className="flex flex-col gap-2">
      {titulo}
      {linhas.length > 0 && (
        <div className="flex flex-col gap-2" style={estilo}>
          <div aria-hidden className="hidden gap-2 sm:grid sm:grid-cols-[var(--grade)]">
            {colunas.map((c) => (
              <span key={c.chave} className="truncate text-micro font-[600] text-apagado">
                {c.rotulo}
              </span>
            ))}
          </div>
          {linhas.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 border-b border-linha pb-2 last:border-0 last:pb-0 sm:grid-cols-[var(--grade)] sm:border-0 sm:pb-0"
            >
              {colunas.map((c) => (
                <Campo
                  key={c.chave}
                  type={c.data ? "date" : "text"}
                  value={l[c.chave]}
                  placeholder={c.rotulo}
                  aria-label={`${c.rotulo}, linha ${i + 1}`}
                  onChange={(e) => mudar(i, c.chave, e.target.value)}
                />
              ))}
              <BotaoIcone
                icone="apagar"
                rotulo={`Remover linha ${i + 1}`}
                onClick={() => onMudar(linhas.filter((_, j) => j !== i))}
              />
            </div>
          ))}
        </div>
      )}
      <div>
        <Botao variante="fantasma" icone="mais" onClick={() => onMudar([...linhas, novo()])}>
          {rotuloAdicionar}
        </Botao>
      </div>
    </div>
  );
}

export function FormularioPM({
  inicial,
  grupos,
  somenteLeitura,
  voltarPara,
  apiBase,
}: {
  inicial: RelatorioPM;
  grupos: GrupoOpcao[];
  somenteLeitura: boolean;
  /** Para onde o Voltar leva: a seção de onde se entrou (a do analista ou a da gestão). */
  voltarPara: string;
  /** Raiz da rota do módulo do setor: `/api/contabil/post-mortem`, por exemplo. */
  apiBase: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [d, setD] = useState<DadosPM>(inicial);
  const [salvo, setSalvo] = useState(() => JSON.stringify(dadosDe(inicial)));
  // O carimbo do servidor é o da carga; depois de salvar, vale o do salvamento.
  const [atualizado, setAtualizado] = useState(inicial.atualizadoEm);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmar, setConfirmar] = useState<keyof typeof CONFIRMACAO_PM | null>(null);
  // Os campos que faltam só acendem depois da primeira tentativa de enviar:
  // rascunho salva parcial, e cobrar tudo desde a primeira tecla seria ruído.
  const [tentou, setTentou] = useState(false);

  const ro = somenteLeitura;
  const ocupado = salvando || enviando || excluindo;
  const setor = inicial.setor;
  const mostra = (c: CampoPM) => temCampo(setor, c);
  const impactos = IMPACTOS.filter((i) => !i.campo || mostra(i.campo));
  const faltando = tentou ? validarEnvio(d) : [];
  const erro = (rotulo: string) => (faltando.includes(rotulo) ? "Obrigatório para enviar" : undefined);
  const sujo = !ro && JSON.stringify(dadosDe(d)) !== salvo;

  const up = <K extends keyof DadosPM>(k: K, v: DadosPM[K]) => setD((p) => ({ ...p, [k]: v }));
  const upImpacto = (k: keyof Impactos, v: string) => setD((p) => ({ ...p, impactos: { ...p.impactos, [k]: v } }));
  const upFator = (k: keyof Fatores, v: string) => setD((p) => ({ ...p, fatores: { ...p.fatores, [k]: v } }));
  const upPorque = (i: number, v: string) =>
    setD((p) => ({ ...p, cincoPorques: p.cincoPorques.map((x, j) => (j === i ? v : x)) }));

  async function salvar() {
    setSalvando(true);
    try {
      const corpo = dadosDe(d);
      await mutar(`${apiBase}/${inicial.id}`, "PATCH", corpo);
      setSalvo(JSON.stringify(corpo));
      setAtualizado(new Date().toISOString());
      qc.invalidateQueries({ queryKey: [CHAVE_PM] });
      avisar.ok("Rascunho salvo");
    } catch (e) {
      avisar.erro("Não deu para salvar", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function pedirEnvio() {
    setTentou(true);
    const falta = validarEnvio(d);
    if (falta.length) {
      avisar.erro("Faltam campos para enviar", falta.join(", "));
      return;
    }
    setConfirmar("enviar");
  }

  async function enviar() {
    setEnviando(true);
    try {
      const { numero } = await mutar<{ numero: number }>(`${apiBase}/${inicial.id}/enviar`, "POST", dadosDe(d));
      qc.invalidateQueries({ queryKey: [CHAVE_PM] });
      avisar.ok(`Relatório nº ${numeroPM(numero)} enviado`);
      router.push(voltarPara);
    } catch (e) {
      avisar.erro("Não deu para enviar", (e as Error).message);
      setEnviando(false);
      setConfirmar(null);
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await mutar(`${apiBase}/${inicial.id}`, "DELETE");
      qc.invalidateQueries({ queryKey: [CHAVE_PM] });
      avisar.ok("Rascunho excluído");
      router.push(voltarPara);
    } catch (e) {
      avisar.erro("Não deu para excluir", (e as Error).message);
      setExcluindo(false);
      setConfirmar(null);
    }
  }

  const botoes = (
    <>
      <Botao variante="secundario" icone="salvar" carregando={salvando} disabled={ocupado} onClick={salvar}>
        Salvar rascunho
      </Botao>
      <Botao variante="primario" icone="enviar" disabled={ocupado} onClick={pedirEnvio}>
        Enviar relatório
      </Botao>
    </>
  );

  const nomeGrupo = grupos.find((g) => g.id === d.grupoId)?.nome ?? inicial.grupoNome ?? "";
  const confirmacao = CONFIRMACAO_PM[confirmar ?? "enviar"];

  return (
    <>
      {!ro && <AcoesPagina>{botoes}</AcoesPagina>}

      {/* Quem, de que setor, em que estado: o que se precisa saber antes de ler. */}
      <div className="nx-vidro flex flex-wrap items-center gap-x-5 gap-y-3 rounded-painel px-4 py-3">
        <BotaoLink href={voltarPara} variante="fantasma" icone="seta-esquerda" className="-ml-1.5">
          Voltar
        </BotaoLink>
        <div className="flex min-w-0 items-center gap-2">
          {inicial.numero != null ? (
            <span className="nx-titulo num text-medio text-tinta">Nº {numeroPM(inicial.numero)}</span>
          ) : (
            <span className="nx-titulo text-medio text-apagado">Sem número</span>
          )}
          <SeloSituacaoPM status={inicial.status} />
          {ro && (
            <Selo tom="neutro" icone="ver">
              Só leitura
            </Selo>
          )}
          {sujo && <Nota tom="atencao">Alterações não salvas</Nota>}
        </div>
        <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-2">
          <Par rotulo="Setor">{rotuloSetor(setor)}</Par>
          <Par rotulo="Analista">{inicial.autorNome}</Par>
          <Par rotulo="Aberto em">
            <span className="num">{dataHoraBR(inicial.criadoEm)}</span>
          </Par>
          <Par rotulo="Atualizado em">
            <span className="num">{dataHoraBR(atualizado)}</span>
          </Par>
        </dl>
      </div>

      <Secao n={1} titulo="Identificação do Incidente">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <Rotulado
            rotulo="Criticidade"
            ajuda={ro ? undefined : d.criticidade ? CRITICIDADE_DEF[d.criticidade] : "Escala de impacto do erro"}
            erro={ro ? undefined : erro(COBRADO.criticidade)}
          >
            {ro ? (
              <span>
                <SeloCriticidade nivel={d.criticidade} />
              </span>
            ) : (
              // O div segura a largura natural: solto na coluna do rótulo, o
              // segmentado esticaria até a borda com os botões encostados à esquerda.
              <div>
                <Segmentado<string>
                  rotulo="Criticidade"
                  opcoes={CRITICIDADES.map((c) => ({ valor: c, rotulo: CRITICIDADE_ROTULO[c] }))}
                  valor={d.criticidade ?? ""}
                  onMudar={(v) => up("criticidade", v as Criticidade)}
                />
              </div>
            )}
          </Rotulado>

          {mostra("gravidade") && (
            <Rotulado rotulo="Nota de gravidade" ajuda={ro ? undefined : "1 baixo, 5 gravíssimo"}>
              {ro ? (
                <span>
                  <SeloGravidade nota={d.gravidade} />
                </span>
              ) : (
                <div>
                  <Segmentado<string>
                    rotulo="Nota de gravidade"
                    opcoes={GRAVIDADES.map((n) => ({ valor: String(n), rotulo: String(n) }))}
                    valor={d.gravidade != null ? String(d.gravidade) : ""}
                    onMudar={(v) => up("gravidade", Number(v))}
                  />
                </div>
              )}
            </Rotulado>
          )}

          <Rotulado rotulo="Grupo" erro={ro ? undefined : erro(COBRADO.grupo)}>
            {ro ? (
              <Leitura>{nomeGrupo}</Leitura>
            ) : (
              <Combo
                rotuloAcessivel="Grupo"
                placeholder="Escolher grupo"
                opcoes={grupos.map((g) => ({ valor: String(g.id), rotulo: g.nome }))}
                valor={d.grupoId != null ? String(d.grupoId) : null}
                onMudar={(v) => up("grupoId", Number(v))}
              />
            )}
          </Rotulado>

          <Rotulado rotulo="Analista responsável">
            <Leitura>{inicial.autorNome}</Leitura>
          </Rotulado>

          <CampoTexto
            rotulo="Cliente ou empresa afetada"
            valor={d.empresaAfetada}
            onMudar={(v) => up("empresaAfetada", v)}
            erro={erro(COBRADO.empresa)}
            ro={ro}
          />

          {mostra("funcionariosAfetados") && (
            <CampoTexto
              rotulo="Funcionários afetados"
              tipo="number"
              valor={
                ro
                  ? d.funcionariosAfetados != null
                    ? num(d.funcionariosAfetados)
                    : ""
                  : String(d.funcionariosAfetados ?? "")
              }
              onMudar={(v) => up("funcionariosAfetados", v === "" ? null : Number(v))}
              ro={ro}
            />
          )}

          <CampoTexto
            rotulo="Processo ou rotina envolvida"
            valor={d.processo}
            onMudar={(v) => up("processo", v)}
            erro={erro(COBRADO.processo)}
            ro={ro}
          />
          <CampoTexto
            rotulo="Data em que o erro ocorreu"
            tipo="date"
            valor={d.dataOcorrido ?? ""}
            onMudar={(v) => up("dataOcorrido", v || null)}
            erro={erro(COBRADO.ocorrido)}
            ro={ro}
          />
          <CampoTexto
            rotulo="Data em que foi identificado"
            tipo="date"
            valor={d.dataIdentificado ?? ""}
            onMudar={(v) => up("dataIdentificado", v || null)}
            ro={ro}
          />
          <CampoTexto
            rotulo="Quem identificou o erro"
            valor={d.quemIdentificou}
            onMudar={(v) => up("quemIdentificou", v)}
            ro={ro}
          />
          {mostra("responsavelInfo") && (
            <CampoTexto
              rotulo="Responsável por passar a informação"
              ajuda="Quem comunicou que o erro tinha acontecido"
              valor={d.responsavelInfo}
              onMudar={(v) => up("responsavelInfo", v)}
              ro={ro}
            />
          )}
          <CampoTexto
            rotulo="Como foi identificado"
            valor={d.comoIdentificou}
            onMudar={(v) => up("comoIdentificou", v)}
            ro={ro}
          />
        </div>
      </Secao>

      <Secao n={2} titulo="Descrição do Erro">
        <CampoTexto
          rotulo="O que aconteceu"
          ajuda="Objetivo, sem julgar pessoas"
          linhas={4}
          valor={d.descricao}
          onMudar={(v) => up("descricao", v)}
          erro={erro(COBRADO.descricao)}
          ro={ro}
        />
        <Repetivel
          rotulo="Linha do tempo dos eventos"
          linhas={d.linhaTempo}
          colunas={COL_LINHA_TEMPO}
          grade="10rem minmax(0,1fr) 14rem"
          novo={() => ({ data: "", evento: "", responsavel: "" })}
          onMudar={(l) => up("linhaTempo", l)}
          ro={ro}
          rotuloAdicionar="Adicionar evento"
        />
      </Secao>

      <Secao n={3} titulo="Impacto e Consequências">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {impactos.map((i) => (
            <CampoTexto
              key={i.chave}
              rotulo={i.rotulo}
              ajuda={i.ajuda}
              linhas={2}
              valor={d.impactos[i.chave]}
              onMudar={(v) => upImpacto(i.chave, v)}
              ro={ro}
            />
          ))}
        </div>
      </Secao>

      <Secao n={4} titulo="Análise de Causa Raiz">
        <div className="flex flex-col gap-2">
          <p className="text-pequeno font-[560] text-tinta-2">Cinco porquês</p>
          {ro ? (
            d.cincoPorques.some((p) => p.trim()) ? (
              <ol className="flex flex-col gap-1.5">
                {d.cincoPorques.map((p, i) =>
                  p.trim() ? (
                    <li key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-corpo">
                      <span className="text-apagado">Por quê {i + 1}</span>
                      <span className="break-words whitespace-pre-wrap text-tinta">{p}</span>
                    </li>
                  ) : null
                )}
              </ol>
            ) : (
              <Leitura>{null}</Leitura>
            )
          ) : (
            <>
              {d.cincoPorques.map((p, i) => (
                <div key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
                  <span className="text-pequeno text-apagado">Por quê {i + 1}</span>
                  <Campo value={p} aria-label={`Por quê ${i + 1}`} onChange={(e) => upPorque(i, e.target.value)} />
                </div>
              ))}
              <Nota>Cada resposta vira a pergunta seguinte, até chegar na causa que dá para corrigir.</Nota>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FATORES.map((f) => (
            <CampoTexto
              key={f.chave}
              rotulo={f.rotulo}
              ajuda={f.ajuda}
              linhas={2}
              valor={d.fatores[f.chave]}
              onMudar={(v) => upFator(f.chave, v)}
              ro={ro}
            />
          ))}
        </div>

        <CampoTexto
          rotulo="Causa raiz identificada"
          linhas={3}
          valor={d.causaRaiz}
          onMudar={(v) => up("causaRaiz", v)}
          erro={erro(COBRADO.causa)}
          ro={ro}
        />
      </Secao>

      <Secao n={5} titulo="Ações Imediatas de Correção">
        <Repetivel
          rotulo="Ações corretivas"
          linhas={d.acoesCorretivas}
          colunas={COL_CORRETIVAS}
          grade="minmax(0,1fr) 13rem 10rem 10rem"
          novo={() => ({ acao: "", responsavel: "", prazo: "", status: "" })}
          onMudar={(l) => up("acoesCorretivas", l)}
          ro={ro}
          rotuloAdicionar="Adicionar ação corretiva"
        />
      </Secao>

      <Secao n={6} titulo="Ações Preventivas e Melhoria de Processo">
        <Repetivel
          rotulo="Ações preventivas"
          linhas={d.acoesPreventivas}
          colunas={COL_PREVENTIVAS}
          grade="minmax(0,1.4fr) 12rem 10rem minmax(0,1fr) 9rem"
          novo={() => ({ acao: "", responsavel: "", prazo: "", validacao: "", status: "" })}
          onMudar={(l) => up("acoesPreventivas", l)}
          ro={ro}
          rotuloAdicionar="Adicionar ação preventiva"
        />
      </Secao>

      <Secao n={7} titulo="Lições Aprendidas">
        <CampoTexto
          rotulo="Principal aprendizado deste incidente para o time"
          linhas={3}
          valor={d.licoes}
          onMudar={(v) => up("licoes", v)}
          ro={ro}
        />
      </Secao>

      {!ro && (
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="perigo" icone="apagar" disabled={ocupado} onClick={() => setConfirmar("excluir")}>
            Excluir rascunho
          </Botao>
          <span className="flex-1" />
          {faltando.length > 0 && (
            <Nota tom="perigo" icone="alerta">
              {faltando.length === 1 ? "Falta 1 campo para enviar" : `Faltam ${num(faltando.length)} campos para enviar`}
            </Nota>
          )}
          {botoes}
        </div>
      )}

      <Modal
        aberto={confirmar != null}
        onFechar={() => {
          if (!ocupado) setConfirmar(null);
        }}
        titulo={confirmacao.titulo}
        largura="p"
        rodape={
          <>
            <Botao disabled={ocupado} onClick={() => setConfirmar(null)}>
              Cancelar
            </Botao>
            {confirmar === "excluir" ? (
              <Botao variante="perigo" icone="apagar" carregando={excluindo} onClick={excluir}>
                {confirmacao.acao}
              </Botao>
            ) : (
              <Botao variante="primario" icone="enviar" carregando={enviando} onClick={enviar}>
                {confirmacao.acao}
              </Botao>
            )}
          </>
        }
      >
        <p className="text-corpo text-tinta-2">{confirmacao.texto}</p>
      </Modal>
    </>
  );
}

/**
 * Só o corpo editável, sem os campos que o servidor carimba (id, autor,
 * datas). É o que vai no PATCH e no envio, e é a base do "alterações não
 * salvas": comparar o relatório inteiro acusaria diferença em campo que a tela
 * nem edita.
 */
function dadosDe(r: DadosPM): DadosPM {
  return {
    criticidade: r.criticidade,
    gravidade: r.gravidade,
    grupoId: r.grupoId,
    empresaAfetada: r.empresaAfetada,
    funcionariosAfetados: r.funcionariosAfetados,
    responsavelInfo: r.responsavelInfo,
    processo: r.processo,
    dataOcorrido: r.dataOcorrido,
    dataIdentificado: r.dataIdentificado,
    quemIdentificou: r.quemIdentificou,
    comoIdentificou: r.comoIdentificou,
    descricao: r.descricao,
    linhaTempo: r.linhaTempo,
    impactos: r.impactos,
    cincoPorques: r.cincoPorques,
    fatores: r.fatores,
    causaRaiz: r.causaRaiz,
    acoesCorretivas: r.acoesCorretivas,
    acoesPreventivas: r.acoesPreventivas,
    licoes: r.licoes,
  };
}
