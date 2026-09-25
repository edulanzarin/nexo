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
import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";
import type { DestinatarioEntrada } from "@/lib/envios";
import type { FormularioResumo } from "@/lib/formularios-tipos";
import type { FuncionarioDiretorio, GestorRh, SetorRh } from "@/lib/rh-tipos";
import { mutar } from "@/hooks/mutar";
import { useFormulariosRh, useRhFuncionarios, useRhGestores, useRhSetores } from "@/hooks/use-rh";

/*
 * Enviar um formulário: quem responde, o e-mail que leva o link e quando sai.
 * Um envio vai para UM público por vez (gestores, colaboradores ou e-mails
 * avulsos), como no nexo2: misturar os três num mesmo envio esconderia quem
 * foi marcado na aba que não está à vista. Cada pessoa recebe um link próprio
 * e responde uma vez; o servidor ainda tira e-mail repetido.
 */

/** Chave da lista de envios. Quem cria um envio invalida por ela. */
export const CHAVE_ENVIOS = "rh-envios";

export type ModoEnvio = "gestores" | "colaboradores" | "avulsos";

export interface FormularioEnvio {
  id: number;
  nome: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAPEL_GESTOR: Record<GestorRh["papel"], string | null> = {
  supervisor: "Supervisor",
  coordenador: "Coordenador",
  outro: null,
};

const DICA_MODO: Record<ModoEnvio, string> = {
  gestores: "Cada gestor recebe um link próprio e responde uma vez.",
  colaboradores: "Cada colaborador recebe o link no próprio e-mail e responde uma vez.",
  avulsos: "Cada e-mail recebe um link próprio e responde uma vez.",
};

const chaveColaborador = (f: Pick<FuncionarioDiretorio, "codigoempresa" | "contrato">) =>
  `${f.codigoempresa}:${f.contrato}`;

// ── Rascunho do envio ─────────────────────────────────────────────────────────

function useRascunhoEnvio(inicial: FormularioEnvio | null, modoInicial: ModoEnvio) {
  const [formulario, setFormulario] = useState<FormularioEnvio | null>(inicial);
  const [assunto, setAssunto] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [modo, setModo] = useState<ModoEnvio>(modoInicial);
  const [gestores, setGestores] = useState<Set<number>>(() => new Set());
  const [colaboradores, setColaboradores] = useState<Set<string>>(() => new Set());
  const [busca, setBusca] = useState("");
  const [avulsos, setAvulsos] = useState("");
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState("");

  const marcar = <T,>(s: Set<T>, itens: T[], ligado: boolean) => {
    const n = new Set(s);
    for (const i of itens) {
      if (ligado) n.add(i);
      else n.delete(i);
    }
    return n;
  };

  return {
    formulario,
    setFormulario,
    // O assunto segue o nome do formulário até a pessoa escrever um próprio.
    assunto: assunto ?? formulario?.nome ?? "",
    setAssunto,
    mensagem,
    setMensagem,
    modo,
    setModo,
    gestores,
    marcarGestores: (ids: number[], ligado: boolean) => setGestores((s) => marcar(s, ids, ligado)),
    colaboradores,
    marcarColaboradores: (ks: string[], ligado: boolean) => setColaboradores((s) => marcar(s, ks, ligado)),
    busca,
    setBusca,
    avulsos,
    setAvulsos,
    agendar,
    setAgendar,
    quando,
    setQuando,
  };
}

type RascunhoEnvio = ReturnType<typeof useRascunhoEnvio>;

/** Uma lista que a janela lê: o dado, ou o erro com o tentar de novo. */
interface Leitura<T> {
  dado: T | undefined;
  erro?: string | null;
  tentar?: () => void;
}

interface DadosEnvio {
  /** Só quando a janela abre sem formulário escolhido (aba Envios). */
  formularios?: Leitura<FormularioResumo[]>;
  gestores: Leitura<GestorRh[]>;
  setores: SetorRh[] | undefined;
  funcionarios: Leitura<FuncionarioDiretorio[]>;
}

function separarEmails(texto: string): { validos: string[]; invalidos: string[] } {
  const validos = new Set<string>();
  const invalidos: string[] = [];
  for (const parte of texto.split(/[\n,;]+/)) {
    const t = parte.trim().toLowerCase();
    if (!t) continue;
    if (EMAIL_RE.test(t)) validos.add(t);
    else invalidos.push(parte.trim());
  }
  return { validos: [...validos], invalidos };
}

/** Os destinatários que vão no POST, já sem e-mail repetido, e o que ficou de fora. */
function montarDestinatarios(r: RascunhoEnvio, dados: DadosEnvio) {
  const vistos = new Set<string>();
  const lista: DestinatarioEntrada[] = [];
  const incluir = (d: DestinatarioEntrada) => {
    const e = d.email.toLowerCase();
    if (vistos.has(e)) return;
    vistos.add(e);
    lista.push(d);
  };
  let semEmail = 0;
  let invalidos: string[] = [];
  if (r.modo === "gestores") {
    for (const g of dados.gestores.dado ?? []) if (r.gestores.has(g.id)) incluir({ email: g.email, nome: g.nome, gestorId: g.id });
  } else if (r.modo === "colaboradores") {
    for (const f of dados.funcionarios.dado ?? []) {
      if (!r.colaboradores.has(chaveColaborador(f))) continue;
      if (f.email) incluir({ email: f.email, nome: f.nome });
      else semEmail++;
    }
  } else {
    const s = separarEmails(r.avulsos);
    s.validos.forEach((email) => incluir({ email }));
    invalidos = s.invalidos;
  }
  return { lista, semEmail, invalidos };
}

// ── A janela ──────────────────────────────────────────────────────────────────

/**
 * Sem `formulario`, a janela pergunta qual (aba Envios); com ele, já abre
 * pronta (lista de formulários e editor). Monta a cada abertura, então as
 * listas de pessoas só são pedidas com a janela aberta.
 */
export function ModalEnviarFormulario({
  aberto,
  formulario,
  onFechar,
}: {
  aberto: boolean;
  formulario?: FormularioEnvio | null;
  onFechar: () => void;
}) {
  if (!aberto) return null;
  return <JanelaEnviar formulario={formulario ?? null} onFechar={onFechar} />;
}

function JanelaEnviar({ formulario, onFechar }: { formulario: FormularioEnvio | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const r = useRascunhoEnvio(formulario, "gestores");
  const forms = useFormulariosRh(formulario == null);
  const gestores = useRhGestores();
  const setores = useRhSetores();
  // A lista de colaboradores é a maior: só é pedida quando são eles que respondem.
  const funcionarios = useRhFuncionarios(r.modo === "colaboradores");
  const [enviando, setEnviando] = useState(false);
  const [tentou, setTentou] = useState(false);

  const leitura = <T,>(q: { data: T | undefined; error: unknown; refetch: () => unknown }): Leitura<T> => ({
    dado: q.data,
    erro: q.error ? (q.error as Error).message : null,
    tentar: () => void q.refetch(),
  });

  const dados: DadosEnvio = {
    formularios: formulario == null ? leitura(forms) : undefined,
    gestores: leitura(gestores),
    setores: setores.data,
    funcionarios: leitura(funcionarios),
  };

  async function enviar() {
    setTentou(true);
    const { lista, invalidos } = montarDestinatarios(r, dados);
    const falta = faltaParaEnviar(r, lista.length, invalidos);
    if (falta) {
      avisar.erro("Falta um passo para enviar", falta);
      return;
    }
    setEnviando(true);
    try {
      const res = await mutar<{ enviados: number; total: number; agendado: boolean }>("/api/rh/envios", "POST", {
        formularioId: r.formulario!.id,
        titulo: r.assunto.trim() || r.formulario!.nome,
        mensagem: r.mensagem.trim() || null,
        destinatarios: lista,
        agendarPara: r.agendar ? new Date(r.quando).toISOString() : null,
      });
      await qc.invalidateQueries({ queryKey: [CHAVE_ENVIOS] });
      const pessoas = res.total === 1 ? "1 destinatário" : `${num(res.total)} destinatários`;
      if (res.agendado) avisar.ok("Envio agendado", `${pessoas}, em ${dataBR(r.quando)}`);
      else
        // Sem servidor de e-mail o NaveX só registra no log e conta 0 saídos: o recado diz isso.
        avisar.ok(
          "Formulário enviado",
          res.enviados >= res.total ? pessoas : `${num(res.enviados)} de ${num(res.total)} e-mails saíram.`
        );
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para enviar", (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      fecharNoVeu={false}
      titulo="Enviar Formulário"
      descricao={formulario?.nome}
      largura="m"
      rodape={<RodapeEnvio r={r} dados={dados} enviando={enviando} onEnviar={enviar} onCancelar={onFechar} />}
    >
      <CorpoEnvio r={r} dados={dados} tentou={tentou} />
    </Modal>
  );
}

/** O motivo de não enviar ainda, ou null. */
function faltaParaEnviar(r: RascunhoEnvio, total: number, invalidos: string[]): string | null {
  if (!r.formulario) return "Escolha o formulário.";
  if (r.modo === "avulsos" && invalidos.length) return "Corrija os e-mails marcados.";
  if (!total)
    return r.modo === "gestores"
      ? "Marque ao menos um gestor."
      : r.modo === "colaboradores"
        ? "Marque ao menos um colaborador com e-mail."
        : "Informe ao menos um e-mail.";
  if (r.agendar) {
    if (!r.quando) return "Escolha o dia e a hora do envio.";
    // O servidor manda na hora o que chega com horário passado: melhor dizer antes.
    if (new Date(r.quando).getTime() <= Date.now()) return "Escolha um horário no futuro.";
  }
  return null;
}

function RodapeEnvio({
  r,
  dados,
  enviando,
  onEnviar,
  onCancelar,
}: {
  r: RascunhoEnvio;
  dados: DadosEnvio;
  enviando?: boolean;
  onEnviar?: () => void;
  onCancelar?: () => void;
}) {
  const { lista } = montarDestinatarios(r, dados);
  const n = lista.length;
  return (
    <>
      <span className="mr-auto text-corpo text-apagado">
        {n === 0 ? "Ninguém escolhido" : n === 1 ? "Vai para 1 pessoa" : `Vai para ${num(n)} pessoas`}
      </span>
      <Botao onClick={onCancelar} disabled={enviando}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone={r.agendar ? "relogio" : "enviar"} carregando={enviando} onClick={onEnviar}>
        {r.agendar ? "Agendar envio" : "Enviar agora"}
      </Botao>
    </>
  );
}

/** A mesma janela aberta e parada, para o catálogo, com o dado de quem chama. */
export function EnviarFormularioEstatico({
  formulario,
  formularios = [],
  gestores,
  setores,
  funcionarios,
  modoInicial = "gestores",
}: {
  formulario: FormularioEnvio | null;
  /** A escolha de formulário, quando a janela abre sem um (aba Envios). */
  formularios?: FormularioResumo[];
  gestores: GestorRh[] | undefined;
  setores: SetorRh[] | undefined;
  funcionarios: FuncionarioDiretorio[] | undefined;
  modoInicial?: ModoEnvio;
}) {
  const r = useRascunhoEnvio(formulario, modoInicial);
  const dados: DadosEnvio = {
    formularios: formulario == null ? { dado: formularios } : undefined,
    gestores: { dado: gestores },
    setores,
    funcionarios: { dado: funcionarios },
  };
  return (
    <PainelModal
      estatico
      titulo="Enviar Formulário"
      descricao={formulario?.nome}
      onFechar={() => {}}
      rodape={<RodapeEnvio r={r} dados={dados} />}
    >
      <CorpoEnvio r={r} dados={dados} tentou={false} />
    </PainelModal>
  );
}

// ── O corpo ───────────────────────────────────────────────────────────────────

function Secao({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

function CorpoEnvio({ r, dados, tentou }: { r: RascunhoEnvio; dados: DadosEnvio; tentou: boolean }) {
  const id = useId();
  const { semEmail, invalidos } = montarDestinatarios(r, dados);
  const nAvulsos = separarEmails(r.avulsos).validos.length;

  return (
    <div className="flex flex-col gap-6">
      {dados.formularios && (
        <Secao titulo="Formulário">
          <EscolhaFormulario leitura={dados.formularios} valor={r.formulario} onMudar={r.setFormulario} erro={tentou && !r.formulario} />
        </Secao>
      )}

      <Secao titulo="Quem Responde">
        <div className="flex flex-col gap-1.5">
          <Segmentado<ModoEnvio>
            rotulo="Quem responde"
            valor={r.modo}
            onMudar={r.setModo}
            className="self-start"
            opcoes={[
              { valor: "gestores", rotulo: "Gestores", icone: "pessoas" },
              { valor: "colaboradores", rotulo: "Colaboradores", icone: "usuario" },
              { valor: "avulsos", rotulo: "E-mails avulsos", icone: "email" },
            ]}
          />
          <p className="text-pequeno text-apagado">{DICA_MODO[r.modo]}</p>
        </div>

        {r.modo === "gestores" && (
          <ListaGestores
            leitura={dados.gestores}
            setores={dados.setores}
            marcados={r.gestores}
            onMarcar={r.marcarGestores}
          />
        )}
        {r.modo === "colaboradores" && (
          <ListaColaboradores
            leitura={dados.funcionarios}
            marcados={r.colaboradores}
            onMarcar={r.marcarColaboradores}
            busca={r.busca}
            onBusca={r.setBusca}
            semEmail={semEmail}
          />
        )}
        {r.modo === "avulsos" && (
          <Rotulado
            rotulo="E-mails"
            htmlFor={`${id}-avulsos`}
            erro={invalidos.length ? `Não parece e-mail: ${invalidos.slice(0, 3).join(", ")}${invalidos.length > 3 ? "…" : ""}` : undefined}
            ajuda={`Um por linha, ou separados por vírgula. ${nAvulsos === 1 ? "1 e-mail" : `${num(nAvulsos)} e-mails`}.`}
          >
            <AreaTexto
              id={`${id}-avulsos`}
              value={r.avulsos}
              onChange={(e) => r.setAvulsos(e.target.value)}
              rows={4}
              placeholder="nome@empresa.com.br"
              aria-invalid={invalidos.length > 0}
            />
          </Rotulado>
        )}
      </Secao>

      <Secao titulo="E-mail">
        <Rotulado rotulo="Assunto" htmlFor={`${id}-assunto`} ajuda="Também é o título do formulário para quem responde.">
          <Campo id={`${id}-assunto`} value={r.assunto} onChange={(e) => r.setAssunto(e.target.value)} />
        </Rotulado>
        <Rotulado rotulo="Mensagem" htmlFor={`${id}-mensagem`} ajuda="Opcional. Vai no e-mail, acima do link, e no alto do formulário.">
          <AreaTexto id={`${id}-mensagem`} value={r.mensagem} onChange={(e) => r.setMensagem(e.target.value)} rows={3} />
        </Rotulado>
      </Secao>

      <Secao titulo="Quando Sai">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Alternador ligado={r.agendar} onMudar={r.setAgendar} rotulo="Agendar para depois" />
          {r.agendar && (
            <Campo
              type="datetime-local"
              value={r.quando}
              onChange={(e) => r.setQuando(e.target.value)}
              aria-label="Dia e hora do envio"
              aria-invalid={tentou && !r.quando}
              className="w-56"
            />
          )}
        </div>
      </Secao>
    </div>
  );
}

function EscolhaFormulario({
  leitura,
  valor,
  onMudar,
  erro,
}: {
  leitura: Leitura<FormularioResumo[]>;
  valor: FormularioEnvio | null;
  onMudar: (f: FormularioEnvio) => void;
  erro: boolean;
}) {
  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os formulários" mensagem={leitura.erro} onTentar={leitura.tentar} />;
  if (!leitura.dado) return <Esqueleto className="h-controle w-full" />;
  const ativos = leitura.dado.filter((f) => f.status === "ativo");
  if (!ativos.length)
    return (
      <div className="rounded-controle border border-linha">
        <Vazio
          compacto
          icone="relatorio"
          titulo="Nenhum formulário ativo"
          descricao="Só formulário ativo pode ser enviado. Ative um na aba Formulários."
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
      valor={valor ? String(valor.id) : null}
      onMudar={(v) => {
        const f = ativos.find((x) => String(x.id) === v);
        if (f) onMudar({ id: f.id, nome: f.nome });
      }}
      className={cn(erro && "border-perigo")}
      opcoes={ativos.map((f) => ({
        valor: String(f.id),
        rotulo: f.nome,
        // O servidor recusa formulário sem pergunta: sai da escolha já aqui.
        detalhe: f.campos === 0 ? "sem perguntas" : f.campos === 1 ? "1 pergunta" : `${num(f.campos)} perguntas`,
        desabilitado: f.campos === 0,
      }))}
    />
  );
}

function CaixaLista({ children }: { children: ReactNode }) {
  return <div className="max-h-72 overflow-y-auto rounded-controle border border-linha">{children}</div>;
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

function ListaGestores({
  leitura,
  setores,
  marcados,
  onMarcar,
}: {
  leitura: Leitura<GestorRh[]>;
  setores: SetorRh[] | undefined;
  marcados: Set<number>;
  onMarcar: (ids: number[], ligado: boolean) => void;
}) {
  const grupos = useMemo(() => {
    const nomes = new Map((setores ?? []).map((s) => [s.classiforgan, s.nome]));
    const m = new Map<string, GestorRh[]>();
    for (const g of (leitura.dado ?? []).filter((x) => x.ativo)) {
      const lista = m.get(g.classiforgan) ?? [];
      lista.push(g);
      m.set(g.classiforgan, lista);
    }
    return [...m.entries()]
      .map(([classif, gestores]) => ({ classif, nome: nomes.get(classif) ?? `Setor ${classif}`, gestores }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [leitura.dado, setores]);

  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os gestores" mensagem={leitura.erro} onTentar={leitura.tentar} />;
  if (!leitura.dado) return <EsqueletoLista />;
  if (!grupos.length)
    return (
      <div className="rounded-controle border border-linha">
        <Vazio
          compacto
          icone="usuario"
          titulo="Nenhum gestor cadastrado"
          descricao="Cadastre os gestores de cada setor em Gestores, ou envie para e-mails avulsos."
          acao={
            <BotaoLink href="/rh/gestores" icone="seta-direita">
              Abrir Gestores
            </BotaoLink>
          }
        />
      </div>
    );

  const todos = grupos.flatMap((g) => g.gestores.map((x) => x.id));
  const nMarcados = todos.filter((i) => marcados.has(i)).length;
  const todosMarcados = nMarcados === todos.length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-pequeno text-apagado">
          {nMarcados === 0 ? `${num(todos.length)} gestores em ${num(grupos.length)} setores` : `${num(nMarcados)} de ${num(todos.length)} marcados`}
        </span>
        <Botao variante="fantasma" onClick={() => onMarcar(todos, !todosMarcados)}>
          {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
        </Botao>
      </div>
      <CaixaLista>
        {grupos.map((g) => {
          const ids = g.gestores.map((x) => x.id);
          const n = ids.filter((i) => marcados.has(i)).length;
          return (
            <div key={g.classif} className="border-b border-linha last:border-0">
              <div className="flex min-h-9 items-center bg-poco px-3">
                <Caixa
                  marcada={n === ids.length}
                  indeterminada={n > 0 && n < ids.length}
                  onMudar={() => onMarcar(ids, n < ids.length)}
                  rotulo={<span className="font-[600] text-tinta">{g.nome}</span>}
                  className="min-w-0 flex-1"
                />
                <span className="num text-pequeno text-apagado">{num(ids.length)}</span>
              </div>
              {g.gestores.map((x) => (
                <div key={x.id} className="flex min-h-10 items-center py-1 pr-3 pl-9">
                  <Caixa
                    marcada={marcados.has(x.id)}
                    onMudar={(v) => onMarcar([x.id], v)}
                    rotulo={x.nome}
                    detalhe={[PAPEL_GESTOR[x.papel], x.email].filter(Boolean).join(" · ")}
                    className="min-w-0 flex-1"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </CaixaLista>
    </div>
  );
}

function ListaColaboradores({
  leitura,
  marcados,
  onMarcar,
  busca,
  onBusca,
  semEmail,
}: {
  leitura: Leitura<FuncionarioDiretorio[]>;
  marcados: Set<string>;
  onMarcar: (chaves: string[], ligado: boolean) => void;
  busca: string;
  onBusca: (v: string) => void;
  semEmail: number;
}) {
  const filtrados = useMemo(() => {
    const t = normalizar(busca.trim());
    const todos = [...(leitura.dado ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (!t) return todos;
    return todos.filter((f) => normalizar([f.nome, f.setor, f.cargo, f.email].filter(Boolean).join(" ")).includes(t));
  }, [leitura.dado, busca]);

  if (leitura.erro)
    return <PainelErro titulo="Não deu para carregar os colaboradores" mensagem={leitura.erro} onTentar={leitura.tentar} />;

  const chaves = filtrados.map(chaveColaborador);
  const todosDaBusca = chaves.length > 0 && chaves.every((k) => marcados.has(k));

  return (
    <div className="flex flex-col gap-1.5">
      <Campo
        icone="buscar"
        placeholder="Nome, setor, cargo ou e-mail"
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
                descricao={leitura.dado.length ? "Busque por outra parte do nome, pelo setor ou pelo cargo." : undefined}
                acao={leitura.dado.length ? <Botao onClick={() => onBusca("")}>Limpar busca</Botao> : undefined}
              />
            </div>
          ) : (
            <CaixaLista>
              {filtrados.map((f) => {
                const k = chaveColaborador(f);
                return (
                  <div key={k} className="flex min-h-10 items-center gap-2 border-b border-linha px-3 py-1 last:border-0">
                    <Caixa
                      marcada={marcados.has(k)}
                      onMudar={(v) => onMarcar([k], v)}
                      rotulo={f.nome}
                      detalhe={[f.setor, f.email].filter(Boolean).join(" · ") || undefined}
                      className="min-w-0 flex-1"
                    />
                    {f.origem === "pj" && <Selo>PJ</Selo>}
                    {!f.email && <Selo tom="atencao">Sem e-mail</Selo>}
                  </div>
                );
              })}
            </CaixaLista>
          )}
          {semEmail > 0 && (
            <Nota tom="atencao" icone="alerta">
              {semEmail === 1
                ? "1 marcado não tem e-mail e fica de fora. O e-mail se cadastra no Diretório."
                : `${num(semEmail)} marcados não têm e-mail e ficam de fora. O e-mail se cadastra no Diretório.`}
            </Nota>
          )}
        </>
      )}
    </div>
  );
}
