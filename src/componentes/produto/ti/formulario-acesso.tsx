"use client";

import { useId, useMemo, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { mutar } from "@/hooks/mutar";
import { cn } from "@/lib/cn";
import { dataBR } from "@/lib/format";
import {
  camposDoTipo,
  gerarSenha,
  portaPadrao,
  SEGREDOS_ACESSO,
  TIPOS_ACESSO,
  tipoAcesso,
  type AcessoLista,
  type CampoAcessoId,
  type DefCampoAcesso,
  type EquipamentoDoAcesso,
  type SegredoId,
} from "@/lib/ti-acessos-tipos";

export interface RascunhoAcesso {
  tipo: string;
  nome: string;
  grupo: string;
  campos: Partial<Record<CampoAcessoId, string>>;
  /**
   * Os segredos que o formulário mexe. Texto é o que foi digitado; `null` é
   * remover; ausente é manter o guardado. Na edição, "Trocar" põe texto vazio,
   * que ao salvar ainda conta como manter.
   */
  segredos: Partial<Record<SegredoId, string | null>>;
  observacoes: string;
  equipamento: string;
}

const NENHUM = "";

function rascunhoDe(a?: AcessoLista | null): RascunhoAcesso {
  return {
    tipo: a?.tipo ?? "wifi",
    nome: a?.nome ?? "",
    grupo: a?.grupo ?? "",
    campos: { ...(a?.campos ?? {}) },
    segredos: {},
    observacoes: a?.observacoes ?? "",
    equipamento: a?.equipamento ? String(a.equipamento.id) : NENHUM,
  };
}

/**
 * Máscara por CSS em vez de `type="password"`: campo de senha faz o navegador
 * preencher o login do NaveX e oferecer "salvar senha" para o Wi-Fi como se
 * fosse deste site.
 */
const SEM_GERENCIADOR = {
  autoComplete: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
} as const;

interface PropsAcesso {
  /** Sem acesso, é o cadastro de um novo. */
  acesso?: AcessoLista | null;
  /** Os grupos que já existem, para sugerir ao digitar. */
  grupos: string[];
  equipamentos: EquipamentoDoAcesso[] | undefined;
  /** O servidor tem a chave do cofre. Sem ela, salva o cadastro mas não o segredo. */
  chave: boolean;
  inicial?: Partial<RascunhoAcesso>;
  onFechar: () => void;
  onSalvo?: (id: number) => void;
}

/**
 * O cadastro de um acesso. O tipo escolhe o que o formulário pede (a rede e a
 * segurança para o Wi-Fi, servidor, porta e base para o banco de dados), a
 * partir do catálogo em `ti-acessos-tipos`.
 *
 * Na edição, o segredo guardado não volta para a tela: aparece mascarado, com
 * "Trocar" e "Remover". Editar a porta não obriga a redigitar a senha, e abrir
 * o formulário não conta como ver a senha.
 */
export function ModalAcesso({ aberto, ...props }: PropsAcesso & { aberto: boolean }) {
  if (!aberto) return null;
  return <FormAcesso {...props} />;
}

export function AcessoEstatico(props: PropsAcesso) {
  return <FormAcesso {...props} estatico />;
}

function FormAcesso({
  acesso,
  grupos,
  equipamentos,
  chave,
  inicial,
  onFechar,
  onSalvo,
  estatico,
}: PropsAcesso & { estatico?: boolean }) {
  const id = useId();
  const [r, setR] = useState<RascunhoAcesso>(() => ({ ...rascunhoDe(acesso), ...inicial }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aMostra, setAMostra] = useState<Partial<Record<SegredoId, boolean>>>({});
  const mudar = (p: Partial<RascunhoAcesso>) => {
    setR((a) => ({ ...a, ...p }));
    setErro(null);
  };
  const mudarCampo = (c: CampoAcessoId, v: string) => mudar({ campos: { ...r.campos, [c]: v } });
  const mudarSegredo = (s: SegredoId, v: string | null | undefined) => {
    const segredos = { ...r.segredos };
    if (v === undefined) delete segredos[s];
    else segredos[s] = v;
    mudar({ segredos });
  };

  const novo = !acesso;
  const tipo = tipoAcesso(r.tipo);
  const campos = camposDoTipo(tipo);
  const varios = tipo.segredos.length > 1;

  const opcoesTipo = useMemo<Opcao[]>(
    () => TIPOS_ACESSO.map((t) => ({ valor: t.id, rotulo: t.rotulo, icone: t.icone as Opcao["icone"] })),
    []
  );
  const opcoesEquipamento = useMemo<Opcao[]>(
    () => [
      { valor: NENHUM, rotulo: "Nenhum" },
      ...(equipamentos ?? []).map((e) => ({
        valor: String(e.id),
        rotulo: e.patrimonio ? `${e.patrimonio} · ${e.nome}` : e.nome,
      })),
    ],
    [equipamentos]
  );

  async function salvar() {
    if (!r.nome.trim()) return setErro("Dê um nome ao acesso: é como ele aparece na lista.");
    const segredos: Partial<Record<SegredoId, string | null>> = {};
    for (const s of tipo.segredos) {
      const v = r.segredos[s];
      if (v === null) segredos[s] = null;
      else if (v) segredos[s] = v;
    }
    if (!chave && Object.values(segredos).some((v) => v)) return setErro("O cofre está sem chave: dá para salvar o cadastro, mas não a senha.");
    const corpo = {
      tipo: r.tipo,
      nome: r.nome,
      grupo: r.grupo,
      campos: Object.fromEntries(campos.map((c) => [c.id, r.campos[c.id] ?? ""])),
      segredos,
      observacoes: r.observacoes,
      equipamentoId: r.equipamento ? Number(r.equipamento) : null,
    };
    setSalvando(true);
    try {
      let salvoId: number;
      if (novo) salvoId = (await mutar<{ id: number }>("/api/ti/acessos", "POST", corpo)).id;
      else {
        await mutar(`/api/ti/acessos/${acesso.id}`, "PATCH", corpo);
        salvoId = acesso.id;
      }
      avisar.ok(novo ? "Acesso guardado no cofre" : "Acesso salvo");
      onSalvo?.(salvoId);
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  function campoDoTipo(c: DefCampoAcesso & { id: CampoAcessoId }) {
    const htmlFor = `${id}-${c.id}`;
    const valor = r.campos[c.id] ?? "";
    if (c.tipo === "opcao")
      return (
        <Rotulado key={c.id} rotulo={c.rotulo}>
          <Combo
            opcoes={[{ valor: NENHUM, rotulo: "Não informado" }, ...(c.opcoes ?? []).map((o) => ({ valor: o, rotulo: o }))]}
            valor={valor}
            onMudar={(v) => mudarCampo(c.id, v)}
            rotuloAcessivel={c.rotulo}
            busca={false}
          />
        </Rotulado>
      );
    const porta = c.tipo === "porta" ? portaPadrao(r.tipo, r.campos) : null;
    return (
      <Rotulado key={c.id} rotulo={c.rotulo} htmlFor={htmlFor}>
        <Campo
          id={htmlFor}
          value={valor}
          onChange={(e) => mudarCampo(c.id, e.target.value)}
          type={c.tipo === "data" ? "date" : "text"}
          inputMode={c.tipo === "porta" ? "numeric" : c.tipo === "email" ? "email" : undefined}
          placeholder={porta ? String(porta) : c.exemplo}
          maxLength={c.tipo === "porta" ? 5 : 300}
          className={cn(c.tipo !== "texto" && c.tipo !== "data" && "num")}
          {...SEM_GERENCIADOR}
        />
      </Rotulado>
    );
  }

  function campoSegredo(s: SegredoId) {
    const rotulo = SEGREDOS_ACESSO[s].rotulo;
    const guardadoEm = acesso?.segredos[s];
    const pedido = r.segredos[s];
    const htmlFor = `${id}-segredo-${s}`;

    // Guardado e sem mexer: mascarado, com trocar e remover.
    if (guardadoEm && pedido === undefined)
      return (
        <Rotulado key={s} rotulo={varios ? rotulo : undefined}>
          <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-controle border border-linha bg-poco px-3 py-1.5">
            <span className="num tracking-[0.2em] text-apagado">••••••••</span>
            <span className="text-pequeno text-apagado">guardada em {dataBR(guardadoEm)}</span>
            <span className="ml-auto flex items-center gap-1">
              <Botao variante="fantasma" icone="editar" disabled={!chave} onClick={() => mudarSegredo(s, "")}>
                Trocar
              </Botao>
              <Botao variante="fantasma" icone="apagar" onClick={() => mudarSegredo(s, null)}>
                Remover
              </Botao>
            </span>
          </div>
        </Rotulado>
      );

    if (pedido === null)
      return (
        <Rotulado key={s} rotulo={varios ? rotulo : undefined}>
          <div className="flex min-h-9 items-center gap-3 rounded-controle border border-dashed border-linha px-3 py-1.5">
            <span className="text-corpo text-apagado">Será removida ao salvar</span>
            <Botao variante="fantasma" icone="desfazer" className="ml-auto" onClick={() => mudarSegredo(s, undefined)}>
              Desfazer
            </Botao>
          </div>
        </Rotulado>
      );

    const mostra = !!aMostra[s];
    return (
      <Rotulado
        key={s}
        // Com um segredo só, o título da seção já é o rótulo.
        rotulo={varios ? rotulo : undefined}
        htmlFor={htmlFor}
        ajuda={guardadoEm ? "Em branco, fica a que está guardada" : undefined}
      >
        <Campo
          id={htmlFor}
          aria-label={rotulo}
          value={pedido ?? ""}
          onChange={(e) => mudarSegredo(s, e.target.value)}
          disabled={!chave}
          placeholder={chave ? (guardadoEm ? "Nova" : undefined) : "Cofre sem chave"}
          maxLength={2000}
          className={cn("num", !mostra && "[-webkit-text-security:disc]")}
          {...SEM_GERENCIADOR}
          fim={
            <span className="flex items-center">
              <BotaoIcone
                icone={mostra ? "esconder" : "ver"}
                rotulo={mostra ? `Esconder a ${rotulo.toLowerCase()}` : `Mostrar a ${rotulo.toLowerCase()}`}
                linha
                disabled={!chave}
                onClick={() => setAMostra((m) => ({ ...m, [s]: !mostra }))}
              />
              {s === "senha" && (
                <BotaoIcone
                  icone="gerar"
                  rotulo="Gerar senha forte"
                  linha
                  disabled={!chave}
                  onClick={() => {
                    mudarSegredo(s, gerarSenha());
                    setAMostra((m) => ({ ...m, [s]: true }));
                  }}
                />
              )}
              {guardadoEm && (
                <BotaoIcone icone="fechar" rotulo="Cancelar a troca" linha onClick={() => mudarSegredo(s, undefined)} />
              )}
            </span>
          }
        />
      </Rotulado>
    );
  }

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-5"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <section className="grid gap-3 sm:grid-cols-2">
        <Rotulado rotulo="Tipo">
          <Combo
            opcoes={opcoesTipo}
            valor={r.tipo}
            onMudar={(v) => mudar({ tipo: v })}
            icone={tipo.icone as Opcao["icone"]}
            rotuloAcessivel="Tipo do acesso"
            busca={false}
          />
        </Rotulado>
        <Rotulado rotulo="Nome" htmlFor={`${id}-nome`}>
          <Campo
            id={`${id}-nome`}
            value={r.nome}
            onChange={(e) => mudar({ nome: e.target.value })}
            placeholder={r.tipo === "wifi" ? "Wi-Fi dos visitantes" : r.tipo === "banco" ? "Banco do NaveX" : "Como aparece na lista"}
            maxLength={120}
            data-autofoco
            {...SEM_GERENCIADOR}
          />
        </Rotulado>
        <Rotulado rotulo="Grupo" htmlFor={`${id}-grupo`} ajuda="Digite um novo para criar">
          <Campo
            id={`${id}-grupo`}
            value={r.grupo}
            onChange={(e) => mudar({ grupo: e.target.value })}
            placeholder="Matriz, Servidor, Fornecedores"
            maxLength={60}
            list={`${id}-grupos`}
            {...SEM_GERENCIADOR}
          />
        </Rotulado>
        <datalist id={`${id}-grupos`}>
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <Rotulado rotulo="Equipamento" ajuda="O roteador ou a impressora a que o acesso pertence">
          <Combo
            opcoes={opcoesEquipamento}
            valor={r.equipamento}
            onMudar={(v) => mudar({ equipamento: v })}
            rotuloAcessivel="Equipamento do inventário"
            placeholder="Nenhum"
          />
        </Rotulado>
      </section>

      {campos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-pequeno font-[600] text-tinta-2">Onde e como entrar</h3>
          <div className="grid gap-3 sm:grid-cols-2">{campos.map(campoDoTipo)}</div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 text-pequeno font-[600] text-tinta-2">
          <Icone nome="cadeado" tamanho={14} className="text-apagado" />
          {tipo.segredos.length > 1 ? "Segredos" : SEGREDOS_ACESSO[tipo.segredos[0]].rotulo}
        </h3>
        {!chave && (
          <Nota tom="atencao" icone="alerta">
            O servidor está sem a chave do cofre (TI_COFRE_CHAVE no .env). Dá para salvar o cadastro, mas nenhuma senha
            pode ser guardada até a chave entrar.
          </Nota>
        )}
        <div className="grid gap-3">{tipo.segredos.map(campoSegredo)}</div>
      </section>

      <Rotulado rotulo="Observações" htmlFor={`${id}-obs`}>
        <AreaTexto
          id={`${id}-obs`}
          value={r.observacoes}
          onChange={(e) => mudar({ observacoes: e.target.value })}
          placeholder="Como entrar, quem é o suporte, o que não mexer"
          maxLength={2000}
        />
      </Rotulado>

      {erro && (
        <Nota tom="perigo" icone="erro">
          {erro}
        </Nota>
      )}
    </form>
  );

  const rodape = (
    <>
      <Botao variante="fantasma" onClick={onFechar}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="salvar" type="submit" form={id} carregando={salvando}>
        {novo ? "Guardar" : "Salvar"}
      </Botao>
    </>
  );

  const titulo = novo ? "Novo acesso" : "Editar acesso";
  const descricao = novo ? "O que é, onde fica e como entrar" : acesso.nome;

  if (estatico)
    return (
      <PainelModal estatico titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {corpo}
      </PainelModal>
    );
  return (
    <Modal aberto titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar} fecharNoVeu={false}>
      {corpo}
    </Modal>
  );
}
