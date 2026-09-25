"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import type { RescisaoDestinatario, RescisoesConfig } from "@/lib/rescisoes-tipos";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { invalidarRescisoes } from "./rescisao-pagamento";

/*
 * Prazo e avisos das rescisões: o prazo de pagamento em dias (CLT art. 477), a
 * antecedência que acende o "vence em breve" e quem recebe o e-mail. Vale para
 * a fila do escritório inteiro, e mora no banco do app.
 *
 * Cada gesto grava na hora (salvar o prazo, ligar um destinatário, adicionar,
 * remover): são três coisas independentes, e um botão Salvar único faria quem
 * só desligou um e-mail perder a mudança ao fechar a janela.
 */

/** O que a janela faz. Cada ação devolve se deu certo; o recado ao usuário é dela. */
export interface AcoesConfigRescisoes {
  salvarPrazo: (c: RescisoesConfig) => Promise<boolean>;
  adicionar: (nome: string, email: string) => Promise<boolean>;
  alternar: (d: RescisaoDestinatario, ativo: boolean) => Promise<boolean>;
  remover: (d: RescisaoDestinatario) => Promise<boolean>;
}

const TITULO = "Prazo e Avisos de Rescisão";
const DESCRICAO = "Vale para a fila de todas as empresas.";

export function ModalConfigRescisoes({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  // Monta a cada abertura: as consultas só rodam com a janela aberta.
  if (!aberto) return null;
  return <JanelaConfig onFechar={onFechar} />;
}

function JanelaConfig({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const cfg = useConsulta<RescisoesConfig>("folha-rescisoes-config", "/api/folha/rescisoes-config");
  const dest = useConsulta<RescisaoDestinatario[]>(
    "folha-rescisoes-destinatarios",
    "/api/folha/rescisoes-destinatarios"
  );
  const recarregarDest = () => qc.invalidateQueries({ queryKey: ["folha-rescisoes-destinatarios"] });

  const tentar = async (fazer: () => Promise<unknown>, ok: string | null, falha: string) => {
    try {
      await fazer();
      if (ok) avisar.ok(ok);
      return true;
    } catch (e) {
      avisar.erro(falha, (e as Error).message);
      return false;
    }
  };

  const acoes: AcoesConfigRescisoes = {
    salvarPrazo: (c) =>
      tentar(
        async () => {
          await mutar("/api/folha/rescisoes-config", "PUT", c);
          // O prazo muda a situação de toda a fila: a tela e os painéis contam de novo.
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["folha-rescisoes-config"] }),
            invalidarRescisoes(qc),
          ]);
        },
        "Prazo salvo",
        "Não deu para salvar o prazo"
      ),
    adicionar: (nome, email) =>
      tentar(
        async () => {
          await mutar("/api/folha/rescisoes-destinatarios", "POST", { nome, email });
          await recarregarDest();
        },
        `${nome} vai receber os avisos`,
        "Não deu para adicionar"
      ),
    alternar: (d, ativo) =>
      tentar(
        async () => {
          await mutar("/api/folha/rescisoes-destinatarios", "PATCH", { id: d.id, ativo });
          await recarregarDest();
        },
        ativo ? `Avisos ligados para ${d.nome}` : `Avisos desligados para ${d.nome}`,
        "Não deu para mudar o destinatário"
      ),
    remover: (d) =>
      tentar(
        async () => {
          await mutar(`/api/folha/rescisoes-destinatarios?id=${d.id}`, "DELETE");
          await recarregarDest();
        },
        `${d.nome} removido dos avisos`,
        "Não deu para remover"
      ),
  };

  return (
    <Modal
      aberto
      titulo={TITULO}
      descricao={DESCRICAO}
      onFechar={onFechar}
      largura="m"
      fecharNoVeu={false}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <CorpoConfig
        config={cfg.data}
        erroConfig={cfg.error ? (cfg.error as Error).message : null}
        onTentarConfig={() => cfg.refetch()}
        destinatarios={dest.data}
        erroDestinatarios={dest.error ? (dest.error as Error).message : null}
        onTentarDestinatarios={() => dest.refetch()}
        acoes={acoes}
      />
    </Modal>
  );
}

const SEM_ACAO: AcoesConfigRescisoes = {
  salvarPrazo: async () => true,
  adicionar: async () => true,
  alternar: async () => true,
  remover: async () => true,
};

/** A mesma janela parada, para o catálogo, com o dado de quem chama. */
export function ConfigRescisoesEstatica({
  config,
  destinatarios,
  erroDestinatarios,
}: {
  config: RescisoesConfig | undefined;
  destinatarios: RescisaoDestinatario[] | undefined;
  erroDestinatarios?: string;
}) {
  return (
    <PainelModal estatico titulo={TITULO} descricao={DESCRICAO} onFechar={() => {}} rodape={<Botao>Fechar</Botao>}>
      <CorpoConfig
        config={config}
        erroConfig={null}
        destinatarios={destinatarios}
        erroDestinatarios={erroDestinatarios ?? null}
        acoes={SEM_ACAO}
      />
    </PainelModal>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-medio font-[600] text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

function CorpoConfig({
  config,
  erroConfig,
  onTentarConfig,
  destinatarios,
  erroDestinatarios,
  onTentarDestinatarios,
  acoes,
}: {
  config: RescisoesConfig | undefined;
  erroConfig: string | null;
  onTentarConfig?: () => void;
  destinatarios: RescisaoDestinatario[] | undefined;
  erroDestinatarios: string | null;
  onTentarDestinatarios?: () => void;
  acoes: AcoesConfigRescisoes;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Secao titulo="Prazo de Pagamento">
        {erroConfig ? (
          <PainelErro titulo="Não deu para carregar o prazo" mensagem={erroConfig} onTentar={onTentarConfig} />
        ) : !config ? (
          <div aria-busy className="flex gap-3">
            <Esqueleto className="h-controle w-36" />
            <Esqueleto className="h-controle w-36" />
          </div>
        ) : (
          // A chave refaz o rascunho quando a configuração salva volta do servidor.
          <FormPrazo key={`${config.prazoDias}:${config.diasAntes}`} inicial={config} onSalvar={acoes.salvarPrazo} />
        )}
      </Secao>

      <Secao titulo="Quem Recebe os Avisos">
        {erroDestinatarios ? (
          <PainelErro
            titulo="Não deu para carregar os destinatários"
            mensagem={erroDestinatarios}
            onTentar={onTentarDestinatarios}
          />
        ) : !destinatarios ? (
          <div aria-busy className="flex flex-col gap-2">
            <Esqueleto className="h-9 w-full" />
            <Esqueleto className="h-9 w-full" />
          </div>
        ) : (
          <ListaDestinatarios destinatarios={destinatarios} acoes={acoes} />
        )}
        <FormNovoDestinatario onAdicionar={acoes.adicionar} />
        <Nota>Cada rescisão avisa uma vez ao entrar na antecedência e uma vez por dia depois de vencida.</Nota>
      </Secao>
    </div>
  );
}

/** Inteiro dentro da faixa, ou null. O campo guarda texto para aceitar o vazio enquanto se digita. */
function inteiroEntre(texto: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n >= min && n <= max ? n : null;
}

function FormPrazo({ inicial, onSalvar }: { inicial: RescisoesConfig; onSalvar: AcoesConfigRescisoes["salvarPrazo"] }) {
  const id = useId();
  const [prazo, setPrazo] = useState(String(inicial.prazoDias));
  const [antes, setAntes] = useState(String(inicial.diasAntes));
  const [salvando, setSalvando] = useState(false);
  const prazoOk = inteiroEntre(prazo, 1, 90);
  const antesOk = inteiroEntre(antes, 0, 30);
  const mudou = prazoOk !== inicial.prazoDias || antesOk !== inicial.diasAntes;

  const unidade = <span className="pr-2 text-pequeno text-apagado">dias</span>;

  return (
    <form
      className="flex flex-wrap items-start gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (prazoOk == null || antesOk == null) return;
        setSalvando(true);
        await onSalvar({ prazoDias: prazoOk, diasAntes: antesOk });
        setSalvando(false);
      }}
    >
      <Rotulado
        rotulo="Prazo após o desligamento"
        htmlFor={`${id}-prazo`}
        erro={prazoOk == null ? "De 1 a 90 dias." : undefined}
        ajuda="A CLT dá 10 dias do fim do contrato."
        className="w-56"
      >
        <Campo
          id={`${id}-prazo`}
          inputMode="numeric"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          aria-invalid={prazoOk == null}
          fim={unidade}
        />
      </Rotulado>
      <Rotulado
        rotulo="Antecedência do aviso"
        htmlFor={`${id}-antes`}
        erro={antesOk == null ? "De 0 a 30 dias." : undefined}
        ajuda="Dias antes do prazo em que a rescisão entra em aviso."
        className="w-56"
      >
        <Campo
          id={`${id}-antes`}
          inputMode="numeric"
          value={antes}
          onChange={(e) => setAntes(e.target.value)}
          aria-invalid={antesOk == null}
          fim={unidade}
        />
      </Rotulado>
      <Rotulado reservar>
        <Botao
          variante="primario"
          icone="salvar"
          type="submit"
          carregando={salvando}
          disabled={!mudou || prazoOk == null || antesOk == null}
        >
          Salvar prazo
        </Botao>
      </Rotulado>
    </form>
  );
}

function ListaDestinatarios({
  destinatarios,
  acoes,
}: {
  destinatarios: RescisaoDestinatario[];
  acoes: AcoesConfigRescisoes;
}) {
  // Uma linha por vez pede confirmação de remover; as outras seguem clicáveis.
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  if (!destinatarios.length)
    return (
      <div className="rounded-controle border border-linha">
        <Vazio
          compacto
          icone="email"
          titulo="Ninguém recebe os avisos"
          descricao="Adicione o time do DP abaixo. Sem destinatário ativo, nenhum aviso sai."
        />
      </div>
    );

  const fazer = async (d: RescisaoDestinatario, acao: () => Promise<boolean>) => {
    setOcupado(d.id);
    await acao();
    setOcupado(null);
  };

  return (
    <ul className="flex flex-col rounded-controle border border-linha">
      {destinatarios.map((d) => {
        const emConfirmacao = confirmando === d.id;
        return (
          <li key={d.id} className="flex min-h-12 items-center gap-3 border-b border-linha px-3 py-1.5 last:border-0">
            <Alternador
              ligado={d.ativo}
              desabilitado={ocupado === d.id}
              onMudar={(ativo) => fazer(d, () => acoes.alternar(d, ativo))}
              rotulo={<span className="sr-only">Avisos para {d.nome}</span>}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("flex items-center gap-2 truncate text-corpo", d.ativo ? "text-tinta" : "text-apagado")}>
                <span className="truncate">{d.nome}</span>
                {!d.ativo && <Selo>Sem avisos</Selo>}
              </p>
              <p className="truncate text-pequeno text-apagado">{d.email}</p>
            </div>
            {emConfirmacao ? (
              <div className="flex shrink-0 items-center gap-1">
                <Botao variante="fantasma" onClick={() => setConfirmando(null)} disabled={ocupado === d.id}>
                  Cancelar
                </Botao>
                <Botao
                  variante="perigo"
                  icone="apagar"
                  carregando={ocupado === d.id}
                  onClick={async () => {
                    await fazer(d, () => acoes.remover(d));
                    setConfirmando(null);
                  }}
                >
                  Remover
                </Botao>
              </div>
            ) : (
              <BotaoIcone
                icone="apagar"
                rotulo={`Remover ${d.nome}`}
                onClick={() => setConfirmando(d.id)}
                disabled={ocupado === d.id}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FormNovoDestinatario({ onAdicionar }: { onAdicionar: AcoesConfigRescisoes["adicionar"] }) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const pronto = nome.trim() !== "" && email.trim() !== "";

  return (
    <form
      className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pronto) return;
        setSalvando(true);
        const ok = await onAdicionar(nome.trim(), email.trim());
        setSalvando(false);
        if (ok) {
          setNome("");
          setEmail("");
        }
      }}
    >
      <Rotulado rotulo="Nome" htmlFor={`${id}-nome`}>
        <Campo id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa do DP" />
      </Rotulado>
      <Rotulado rotulo="E-mail" htmlFor={`${id}-email`}>
        <Campo
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@navecon.com.br"
        />
      </Rotulado>
      <Botao icone="mais" type="submit" carregando={salvando} disabled={!pronto}>
        Adicionar
      </Botao>
    </form>
  );
}
