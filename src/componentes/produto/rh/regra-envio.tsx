"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { Alternador, Caixa } from "@/componentes/primitivos/caixa";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { ROTULO_SITUACAO_FORMULARIO } from "@/componentes/produto/rh/formulario-situacao";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";
import type {
  AlvoColaborador,
  AlvoTipo,
  DestinatarioTipo,
  EnvioRegra,
  EnvioRegraEntrada,
  FreqTipo,
} from "@/lib/envio-regras";
import type { FormularioResumo } from "@/lib/formularios-tipos";
import type { FuncionarioDiretorio, GestorRh, SetorRh } from "@/lib/rh-tipos";
import { mutar } from "@/hooks/mutar";
import { useFormulariosRh, useRhFuncionarios, useRhGestores, useRhSetores } from "@/hooks/use-rh";

/*
 * Envio automático: um formulário que sai sozinho de tempos em tempos para um
 * público. O público é lido no dia de cada envio (quem entrou no setor depois
 * também recebe), e cada disparo vira um envio comum na aba Envios.
 */

/** Chave da lista de regras. Quem escreve numa regra invalida por ela. */
export const CHAVE_REGRAS = "rh-envio-regras";

export const ROTULO_QUEM_RESPONDE: Record<DestinatarioTipo, string> = {
  gestores: "Gestores",
  colaboradores: "Colaboradores",
};

/** "Todo dia 5 do mês", "A cada 30 dias". */
export function textoFrequencia(freqTipo: FreqTipo, freqValor: number): string {
  if (freqTipo === "mensal") return `Todo dia ${num(freqValor)} do mês`;
  return freqValor === 1 ? "Todo dia" : `A cada ${num(freqValor)} dias`;
}

/** Para quem a regra olha. Com um setor só, o nome dele; com mais, a contagem. */
export function textoPublico(
  r: Pick<EnvioRegra, "destinatarioTipo" | "alvoTipo" | "alvo">,
  nomesSetor?: Map<string, string>
): string {
  const n = Array.isArray(r.alvo) ? r.alvo.length : 0;
  if (r.alvoTipo === "todos") return r.destinatarioTipo === "gestores" ? "Todos os setores" : "Todos os colaboradores";
  if (r.alvoTipo === "setores") {
    if (n === 1) return nomesSetor?.get((r.alvo as string[])[0]) ?? "1 setor";
    return `${num(n)} setores`;
  }
  const pessoas = n === 1 ? "1 colaborador" : `${num(n)} colaboradores`;
  return r.destinatarioTipo === "gestores" ? `Setores de ${pessoas}` : pessoas;
}

const DICA_PUBLICO: Record<DestinatarioTipo, Record<AlvoTipo, string>> = {
  gestores: {
    todos: "Todos os gestores ativos recebem.",
    setores: "Recebem os gestores ativos dos setores marcados.",
    colaboradores: "Recebem os gestores dos setores das pessoas marcadas.",
  },
  colaboradores: {
    todos: "Todos os colaboradores com e-mail recebem.",
    setores: "Recebem os colaboradores com e-mail dos setores marcados.",
    colaboradores: "Recebem as pessoas marcadas que têm e-mail.",
  },
};

const chaveColaborador = (empresa: number, contrato: number) => `${empresa}:${contrato}`;

const inteiro = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s) : null);

// ── Rascunho da regra ─────────────────────────────────────────────────────────

function useRascunhoRegra(regra: EnvioRegra | null) {
  const [formularioId, setFormularioId] = useState<number | null>(regra?.formularioId ?? null);
  const [destinatario, setDestinatario] = useState<DestinatarioTipo>(regra?.destinatarioTipo ?? "gestores");
  const [alvoTipo, setAlvoTipo] = useState<AlvoTipo>(regra?.alvoTipo ?? "todos");
  const [setores, setSetores] = useState<Set<string>>(
    () => new Set(regra?.alvoTipo === "setores" ? (regra.alvo as string[]) : [])
  );
  const [colaboradores, setColaboradores] = useState<Set<string>>(
    () =>
      new Set(
        regra?.alvoTipo === "colaboradores"
          ? (regra.alvo as AlvoColaborador[]).map((c) => chaveColaborador(c.empresa, c.contrato))
          : []
      )
  );
  const [busca, setBusca] = useState("");
  const [freqTipo, setFreqTipo] = useState<FreqTipo>(regra?.freqTipo ?? "mensal");
  const [freqValor, setFreqValor] = useState(String(regra?.freqValor ?? 1));
  const [titulo, setTitulo] = useState(regra?.titulo ?? "");
  const [mensagem, setMensagem] = useState(regra?.mensagem ?? "");
  const [ativo, setAtivo] = useState(regra?.ativo ?? true);

  const marcar = <T,>(s: Set<T>, itens: T[], ligado: boolean) => {
    const n = new Set(s);
    for (const i of itens) {
      if (ligado) n.add(i);
      else n.delete(i);
    }
    return n;
  };

  return {
    editando: regra != null,
    formularioId,
    setFormularioId,
    destinatario,
    setDestinatario,
    alvoTipo,
    setAlvoTipo,
    setores,
    marcarSetores: (cs: string[], ligado: boolean) => setSetores((s) => marcar(s, cs, ligado)),
    colaboradores,
    marcarColaboradores: (ks: string[], ligado: boolean) => setColaboradores((s) => marcar(s, ks, ligado)),
    busca,
    setBusca,
    freqTipo,
    setFreqTipo,
    freqValor,
    setFreqValor,
    titulo,
    setTitulo,
    mensagem,
    setMensagem,
    ativo,
    setAtivo,
  };
}

type RascunhoRegra = ReturnType<typeof useRascunhoRegra>;

function erroFrequencia(r: RascunhoRegra): string | null {
  const n = inteiro(r.freqValor);
  if (r.freqTipo === "mensal") return n == null || n < 1 || n > 28 ? "Escolha um dia de 1 a 28." : null;
  return n == null || n < 1 ? "Informe de quantos em quantos dias, a partir de 1." : null;
}

/** O motivo de não salvar ainda, ou null. As mesmas regras do servidor, ditas antes. */
function faltaParaSalvar(r: RascunhoRegra): string | null {
  if (r.formularioId == null) return "Escolha o formulário.";
  if (r.alvoTipo === "setores" && r.setores.size === 0) return "Marque ao menos um setor.";
  if (r.alvoTipo === "colaboradores" && r.colaboradores.size === 0) return "Marque ao menos uma pessoa.";
  return erroFrequencia(r);
}

function entradaDo(r: RascunhoRegra): EnvioRegraEntrada {
  return {
    formularioId: r.formularioId!,
    titulo: r.titulo.trim() || null,
    mensagem: r.mensagem.trim() || null,
    destinatarioTipo: r.destinatario,
    alvoTipo: r.alvoTipo,
    alvo:
      r.alvoTipo === "setores"
        ? [...r.setores]
        : r.alvoTipo === "colaboradores"
          ? [...r.colaboradores].map((k) => {
              const [empresa, contrato] = k.split(":").map(Number);
              return { empresa, contrato };
            })
          : [],
    freqTipo: r.freqTipo,
    freqValor: inteiro(r.freqValor) ?? 1,
    ativo: r.ativo,
  };
}

/** A regra inteira de volta ao formato de escrita, para ligar e desligar da lista (o PUT pede tudo). */
export function entradaDaRegra(regra: EnvioRegra, mudancas: Partial<EnvioRegraEntrada> = {}): EnvioRegraEntrada {
  return {
    formularioId: regra.formularioId,
    titulo: regra.titulo,
    mensagem: regra.mensagem,
    destinatarioTipo: regra.destinatarioTipo,
    alvoTipo: regra.alvoTipo,
    alvo: regra.alvo,
    freqTipo: regra.freqTipo,
    freqValor: regra.freqValor,
    ativo: regra.ativo,
    ...mudancas,
  };
}

interface DadosRegra {
  formularios: { dado: FormularioResumo[] | undefined; erro?: string | null; tentar?: () => void };
  setores: { dado: SetorRh[] | undefined; erro?: string | null; tentar?: () => void };
  gestores: GestorRh[] | undefined;
  funcionarios: { dado: FuncionarioDiretorio[] | undefined; erro?: string | null; tentar?: () => void };
}

// ── A janela ──────────────────────────────────────────────────────────────────

/** Criar (`regra` null) ou editar uma regra. Monta a cada abertura. */
export function ModalRegraEnvio({
  aberto,
  regra,
  onFechar,
}: {
  aberto: boolean;
  regra: EnvioRegra | null;
  onFechar: () => void;
}) {
  if (!aberto) return null;
  return <JanelaRegra regra={regra} onFechar={onFechar} />;
}

function JanelaRegra({ regra, onFechar }: { regra: EnvioRegra | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const r = useRascunhoRegra(regra);
  const forms = useFormulariosRh();
  const setores = useRhSetores();
  const gestores = useRhGestores();
  const funcionarios = useRhFuncionarios(r.alvoTipo === "colaboradores");
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);

  const msg = (e: unknown) => (e ? (e as Error).message : null);
  const dados: DadosRegra = {
    formularios: { dado: forms.data, erro: msg(forms.error), tentar: () => void forms.refetch() },
    setores: { dado: setores.data, erro: msg(setores.error), tentar: () => void setores.refetch() },
    gestores: gestores.data,
    funcionarios: { dado: funcionarios.data, erro: msg(funcionarios.error), tentar: () => void funcionarios.refetch() },
  };

  async function salvar() {
    setTentou(true);
    const falta = faltaParaSalvar(r);
    if (falta) {
      avisar.erro("Falta um passo para salvar", falta);
      return;
    }
    setSalvando(true);
    try {
      const corpo = entradaDo(r);
      if (regra) await mutar(`/api/rh/envio-regras?id=${regra.id}`, "PUT", corpo);
      else await mutar("/api/rh/envio-regras", "POST", corpo);
      await qc.invalidateQueries({ queryKey: [CHAVE_REGRAS] });
      avisar.ok(regra ? "Regra salva" : "Regra criada");
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para salvar a regra", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      fecharNoVeu={false}
      titulo={regra ? "Editar Envio Automático" : "Novo Envio Automático"}
      largura="m"
      rodape={
        <>
          <Botao onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="salvar" carregando={salvando} onClick={salvar}>
            {regra ? "Salvar regra" : "Criar regra"}
          </Botao>
        </>
      }
    >
      <CorpoRegra r={r} dados={dados} tentou={tentou} />
    </Modal>
  );
}

/** A mesma janela aberta e parada, para o catálogo. */
export function RegraEnvioEstatica({
  regra,
  formularios,
  setores,
  gestores,
  funcionarios,
}: {
  regra: EnvioRegra | null;
  formularios: FormularioResumo[];
  setores: SetorRh[];
  gestores: GestorRh[];
  funcionarios: FuncionarioDiretorio[];
}) {
  const r = useRascunhoRegra(regra);
  return (
    <PainelModal
      estatico
      titulo={regra ? "Editar Envio Automático" : "Novo Envio Automático"}
      onFechar={() => {}}
      rodape={
        <>
          <Botao>Cancelar</Botao>
          <Botao variante="primario" icone="salvar">
            {regra ? "Salvar regra" : "Criar regra"}
          </Botao>
        </>
      }
    >
      <CorpoRegra
        r={r}
        dados={{ formularios: { dado: formularios }, setores: { dado: setores }, gestores, funcionarios: { dado: funcionarios } }}
        tentou={false}
      />
    </PainelModal>
  );
}

// ── O corpo ───────────────────────────────────────────────────────────────────

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

function CorpoRegra({ r, dados, tentou }: { r: RascunhoRegra; dados: DadosRegra; tentou: boolean }) {
  const id = useId();
  const erroFreq = tentou ? erroFrequencia(r) : null;
  const formEscolhido = dados.formularios.dado?.find((f) => f.id === r.formularioId);

  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Formulário">
        <EscolhaFormulario
          leitura={dados.formularios}
          valor={r.formularioId}
          onMudar={r.setFormularioId}
          erro={tentou && r.formularioId == null}
        />
        {formEscolhido && formEscolhido.status !== "ativo" && (
          <Nota tom="atencao" icone="alerta">
            Este formulário está como {ROTULO_SITUACAO_FORMULARIO[formEscolhido.status].toLowerCase()}. A regra não
            envia nada enquanto ele não for ativado.
          </Nota>
        )}
      </Secao>

      <Secao titulo="Quem Responde">
        <Segmentado<DestinatarioTipo>
          rotulo="Quem responde"
          valor={r.destinatario}
          onMudar={r.setDestinatario}
          className="self-start"
          opcoes={[
            { valor: "gestores", rotulo: "Gestores", icone: "pessoas" },
            { valor: "colaboradores", rotulo: "Colaboradores", icone: "usuario" },
          ]}
        />
      </Secao>

      <Secao titulo="Público">
        <div className="flex flex-col gap-1.5">
          <Segmentado<AlvoTipo>
            rotulo="Público"
            valor={r.alvoTipo}
            onMudar={r.setAlvoTipo}
            className="self-start"
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              { valor: "setores", rotulo: "Por setor" },
              { valor: "colaboradores", rotulo: "Escolher pessoas" },
            ]}
          />
          <p className="text-pequeno text-apagado">{DICA_PUBLICO[r.destinatario][r.alvoTipo]}</p>
        </div>
        {r.alvoTipo === "setores" && (
          <ListaSetores
            leitura={dados.setores}
            gestores={r.destinatario === "gestores" ? dados.gestores : undefined}
            marcados={r.setores}
            onMarcar={r.marcarSetores}
            erro={tentou && r.setores.size === 0}
          />
        )}
        {r.alvoTipo === "colaboradores" && (
          <ListaPessoas
            leitura={dados.funcionarios}
            marcados={r.colaboradores}
            onMarcar={r.marcarColaboradores}
            busca={r.busca}
            onBusca={r.setBusca}
            avisaSemEmail={r.destinatario === "colaboradores"}
          />
        )}
      </Secao>

      <Secao titulo="Frequência">
        <div className="flex flex-wrap items-start gap-3">
          <Segmentado<FreqTipo>
            rotulo="Frequência"
            valor={r.freqTipo}
            onMudar={r.setFreqTipo}
            opcoes={[
              { valor: "mensal", rotulo: "Todo mês" },
              { valor: "dias", rotulo: "A cada N dias" },
            ]}
          />
          <Rotulado erro={erroFreq} className="w-44">
            <Campo
              id={`${id}-freq`}
              inputMode="numeric"
              value={r.freqValor}
              onChange={(e) => r.setFreqValor(e.target.value)}
              aria-label={r.freqTipo === "mensal" ? "Dia do mês" : "Intervalo em dias"}
              aria-invalid={!!erroFreq}
              fim={
                <span className="pr-2 text-pequeno whitespace-nowrap text-apagado">
                  {r.freqTipo === "mensal" ? "dia do mês" : "dias"}
                </span>
              }
              className="pr-24"
            />
          </Rotulado>
        </div>
        <p className="text-pequeno text-apagado">
          {r.freqTipo === "mensal" ? "Um dia de 1 a 28." : "Conta a partir do dia em que a regra é salva."}
        </p>
        {r.editando && r.freqTipo === "dias" && (
          <Nota>Salvar a regra recomeça a contagem dos dias a partir de hoje.</Nota>
        )}
      </Secao>

      <Secao titulo="E-mail">
        <Rotulado rotulo="Assunto" htmlFor={`${id}-assunto`} ajuda="Vazio usa o nome do formulário.">
          <Campo
            id={`${id}-assunto`}
            value={r.titulo}
            onChange={(e) => r.setTitulo(e.target.value)}
            placeholder={formEscolhido?.nome}
          />
        </Rotulado>
        <Rotulado rotulo="Mensagem" htmlFor={`${id}-mensagem`} ajuda="Opcional. Vai no e-mail, acima do link.">
          <AreaTexto id={`${id}-mensagem`} value={r.mensagem} onChange={(e) => r.setMensagem(e.target.value)} rows={3} />
        </Rotulado>
      </Secao>

      <Alternador ligado={r.ativo} onMudar={r.setAtivo} rotulo="Regra ativa" />
    </div>
  );
}

function EscolhaFormulario({
  leitura,
  valor,
  onMudar,
  erro,
}: {
  leitura: DadosRegra["formularios"];
  valor: number | null;
  onMudar: (id: number) => void;
  erro: boolean;
}) {
  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os formulários" mensagem={leitura.erro} onTentar={leitura.tentar} />;
  if (!leitura.dado) return <Esqueleto className="h-controle w-full" />;
  // Só os ativos entram na escolha; o da regra que se edita fica mesmo inativo,
  // senão abrir a regra apagaria o formulário dela da tela.
  const opcoes = leitura.dado.filter((f) => f.status === "ativo" || f.id === valor);
  if (!opcoes.length)
    return (
      <div className="rounded-controle border border-linha">
        <Vazio
          compacto
          icone="relatorio"
          titulo="Nenhum formulário ativo"
          descricao="A regra só envia formulário ativo. Ative um na aba Formulários."
          acao={
            <BotaoLink href="/rh/formularios" icone="seta-direita">
              Ver formulários
            </BotaoLink>
          }
        />
      </div>
    );
  return (
    <Combo
      rotuloAcessivel="Formulário"
      placeholder="Escolher formulário"
      valor={valor != null ? String(valor) : null}
      onMudar={(v) => onMudar(Number(v))}
      className={cn(erro && "border-perigo")}
      opcoes={opcoes.map((f) => ({
        valor: String(f.id),
        rotulo: f.nome,
        detalhe: f.status !== "ativo" ? ROTULO_SITUACAO_FORMULARIO[f.status] : f.campos === 1 ? "1 pergunta" : `${num(f.campos)} perguntas`,
      }))}
    />
  );
}

function CaixaLista({ children, erro }: { children: ReactNode; erro?: boolean }) {
  return (
    <div className={cn("max-h-64 overflow-y-auto rounded-controle border", erro ? "border-perigo" : "border-linha")}>
      {children}
    </div>
  );
}

function EsqueletoLista() {
  return (
    <div aria-busy className="flex flex-col gap-2 rounded-controle border border-linha p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Esqueleto key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

function ListaSetores({
  leitura,
  gestores,
  marcados,
  onMarcar,
  erro,
}: {
  leitura: DadosRegra["setores"];
  /** Com gestores respondendo: mostra quantos cada setor tem e avisa o setor sem nenhum. */
  gestores: GestorRh[] | undefined;
  marcados: Set<string>;
  onMarcar: (classifs: string[], ligado: boolean) => void;
  erro: boolean;
}) {
  const porSetor = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gestores ?? []) if (g.ativo) m.set(g.classiforgan, (m.get(g.classiforgan) ?? 0) + 1);
    return m;
  }, [gestores]);

  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os setores" mensagem={leitura.erro} onTentar={leitura.tentar} />;
  if (!leitura.dado) return <EsqueletoLista />;
  if (!leitura.dado.length) return <Vazio compacto icone="empresa" titulo="Nenhum setor encontrado" />;

  const setores = [...leitura.dado].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const todos = setores.map((s) => s.classiforgan);
  const todosMarcados = todos.every((c) => marcados.has(c));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-pequeno text-apagado">
          {marcados.size === 0 ? `${num(setores.length)} setores` : `${num(marcados.size)} marcados`}
        </span>
        <Botao variante="fantasma" onClick={() => onMarcar(todos, !todosMarcados)}>
          {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
        </Botao>
      </div>
      <CaixaLista erro={erro}>
        {setores.map((s) => {
          const nGestores = porSetor.get(s.classiforgan) ?? 0;
          return (
            <div key={s.classiforgan} className="flex min-h-10 items-center gap-2 border-b border-linha px-3 py-1 last:border-0">
              <Caixa
                marcada={marcados.has(s.classiforgan)}
                onMudar={(v) => onMarcar([s.classiforgan], v)}
                rotulo={s.nome}
                detalhe={
                  gestores
                    ? `${s.ativos === 1 ? "1 pessoa" : `${num(s.ativos)} pessoas`} · ${nGestores === 1 ? "1 gestor" : `${num(nGestores)} gestores`}`
                    : s.ativos === 1
                      ? "1 pessoa"
                      : `${num(s.ativos)} pessoas`
                }
                className="min-w-0 flex-1"
              />
              {gestores && nGestores === 0 && <Selo tom="atencao">Sem gestor</Selo>}
            </div>
          );
        })}
      </CaixaLista>
    </div>
  );
}

function ListaPessoas({
  leitura,
  marcados,
  onMarcar,
  busca,
  onBusca,
  avisaSemEmail,
}: {
  leitura: DadosRegra["funcionarios"];
  marcados: Set<string>;
  onMarcar: (chaves: string[], ligado: boolean) => void;
  busca: string;
  onBusca: (v: string) => void;
  avisaSemEmail: boolean;
}) {
  const filtrados = useMemo(() => {
    const t = normalizar(busca.trim());
    const todos = [...(leitura.dado ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!t) return todos;
    return todos.filter((f) => normalizar([f.nome, f.setor, f.cargo].filter(Boolean).join(" ")).includes(t));
  }, [leitura.dado, busca]);

  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os colaboradores" mensagem={leitura.erro} onTentar={leitura.tentar} />;

  const chaves = filtrados.map((f) => chaveColaborador(f.codigoempresa, f.contrato));
  const todosDaBusca = chaves.length > 0 && chaves.every((k) => marcados.has(k));

  return (
    <div className="flex flex-col gap-1.5">
      <Campo
        icone="buscar"
        placeholder="Nome, setor ou cargo"
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        aria-label="Buscar colaborador"
        fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => onBusca("")} /> : undefined}
      />
      {!leitura.dado ? (
        <EsqueletoLista />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-pequeno text-apagado">
              {marcados.size === 0 ? `${num(leitura.dado.length)} colaboradores` : `${num(marcados.size)} marcados`}
            </span>
            {chaves.length > 0 && (
              <Botao variante="fantasma" onClick={() => onMarcar(chaves, !todosDaBusca)}>
                {todosDaBusca
                  ? busca
                    ? "Desmarcar os da busca"
                    : "Desmarcar todos"
                  : busca
                    ? `Marcar os ${num(chaves.length)} da busca`
                    : "Marcar todos"}
              </Botao>
            )}
          </div>
          {!filtrados.length ? (
            <div className="rounded-controle border border-linha">
              <Vazio
                compacto
                icone="buscar"
                titulo={leitura.dado.length ? "Ninguém com esse termo" : "Nenhum colaborador ativo"}
                acao={leitura.dado.length ? <Botao onClick={() => onBusca("")}>Limpar busca</Botao> : undefined}
              />
            </div>
          ) : (
            <CaixaLista>
              {filtrados.map((f) => {
                const k = chaveColaborador(f.codigoempresa, f.contrato);
                return (
                  <div key={k} className="flex min-h-10 items-center gap-2 border-b border-linha px-3 py-1 last:border-0">
                    <Caixa
                      marcada={marcados.has(k)}
                      onMudar={(v) => onMarcar([k], v)}
                      rotulo={f.nome}
                      detalhe={[f.setor, f.cargo].filter(Boolean).join(" · ") || undefined}
                      className="min-w-0 flex-1"
                    />
                    {avisaSemEmail && !f.email && <Selo tom="atencao">Sem e-mail</Selo>}
                  </div>
                );
              })}
            </CaixaLista>
          )}
        </>
      )}
    </div>
  );
}
