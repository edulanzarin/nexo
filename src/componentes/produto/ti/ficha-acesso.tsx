"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Esqueleto, Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { mutar } from "@/hooks/mutar";
import { useAcesso } from "@/hooks/use-ti";
import { dataBR, dataHoraBR, hojeISO } from "@/lib/format";
import {
  camposDoTipo,
  diasEntre,
  DIAS_LICENCA,
  linkAcesso,
  SEGREDOS_ACESSO,
  segredoAntigo,
  textoQrWifi,
  tipoAcesso,
  type AcessoDetalhe,
  type SegredoId,
} from "@/lib/ti-acessos-tipos";
import { HistoricoAcesso, IconeAcesso, QrWifi, Segredo, TextoCopiavel, useRevelarSegredo } from "./acesso";

function Secao({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}

/**
 * O QR do Wi-Fi na ficha. Mostrar o QR é mostrar a senha (ela vai dentro
 * dele), então passa pelo mesmo revelar e entra no registro como "vista". Fica
 * na tela até a ficha fechar: é para o visitante apontar o celular.
 */
function BlocoQrWifi({ a, semChave, qrInicial }: { a: AcessoDetalhe; semChave: boolean; qrInicial?: string }) {
  const revelar = useRevelarSegredo();
  const [texto, setTexto] = useState<string | null>(qrInicial ?? null);
  const [abrindo, setAbrindo] = useState(false);
  const ssid = a.campos.ssid;
  if (!ssid) return null;
  const aberta = a.campos.seguranca === "Aberta" || !a.segredos.senha;

  async function mostrar() {
    if (aberta) return setTexto(textoQrWifi(ssid!, a.campos.seguranca, null));
    setAbrindo(true);
    try {
      const senha = await revelar(a.id, "senha", "ver");
      setTexto(textoQrWifi(ssid!, a.campos.seguranca, senha));
    } catch (e) {
      avisar.erro("Não deu para montar o QR", (e as Error).message);
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <Secao titulo="Entrar pelo celular">
      {texto ? (
        <div className="flex flex-wrap items-center gap-4">
          <QrWifi texto={texto} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-corpo text-tinta-2">
              Aponte a câmera do celular para o código: ele entra em <span className="font-[600] text-tinta">{ssid}</span> sem
              digitar a senha.
            </p>
            <Botao variante="fantasma" icone="esconder" className="self-start" onClick={() => setTexto(null)}>
              Esconder o QR
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-controle border border-dashed border-linha px-4 py-3">
          <Icone nome="qrcode" tamanho={20} className="text-apagado" />
          <p className="min-w-0 flex-1 text-corpo text-apagado">
            {aberta ? "Rede aberta: o QR só leva o nome." : "Mostrar o QR fica no registro como senha vista."}
          </p>
          <Botao variante="secundario" icone="qrcode" carregando={abrindo} disabled={!aberta && semChave} onClick={mostrar}>
            Mostrar QR code
          </Botao>
        </div>
      )}
    </Secao>
  );
}

/** O miolo da ficha, com o acesso já carregado. */
function CorpoFicha({ a, semChave, qrInicial }: { a: AcessoDetalhe; semChave: boolean; qrInicial?: string }) {
  const tipo = tipoAcesso(a.tipo);
  const hoje = hojeISO();
  const link = linkAcesso(a);
  const campos = camposDoTipo(tipo).filter((c) => a.campos[c.id]);
  const antiga = segredoAntigo(a, hoje);
  const validade = a.campos.validade;
  const faltam = validade ? diasEntre(hoje, validade) : null;

  const linhaSegredo = (s: SegredoId) => (
    <span className="flex flex-col gap-1">
      <Segredo acessoId={a.id} campo={s} guardado={!!a.segredos[s]} outraChave={a.outraChave.includes(s)} semChave={semChave} />
      {a.segredos[s] && (
        <span className="text-pequeno text-apagado">
          Trocada em {dataBR(a.segredos[s])}
          {antiga && a.segredos[s] === antiga && (
            <>
              {" · "}
              <span className="text-atencao">há mais de um ano</span>
            </>
          )}
        </span>
      )}
    </span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        {a.outraChave.length > 0 && (
          <Nota tom="atencao" icone="alerta">
            {a.outraChave.map((s) => SEGREDOS_ACESSO[s].rotulo).join(" e ")} foi guardada com outra chave do cofre e não
            abre com a de agora. Se a chave mudou de propósito, guarde de novo em Editar.
          </Nota>
        )}

        <Secao
          titulo="Como entrar"
          acoes={
            link && (
              <BotaoLink variante="fantasma" href={link} target="_blank" rel="noreferrer noopener" icone="abrir-externo">
                Abrir
              </BotaoLink>
            )
          }
        >
          {campos.length ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {campos.map((c) => (
                <Par key={c.id} rotulo={c.rotulo}>
                  {c.tipo === "opcao" ? (
                    a.campos[c.id]
                  ) : c.tipo === "data" ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {dataBR(a.campos[c.id])}
                      {c.id === "validade" && faltam != null && faltam <= DIAS_LICENCA && (
                        <Selo tom={faltam < 0 ? "perigo" : "atencao"}>{faltam < 0 ? "Vencida" : "Vence logo"}</Selo>
                      )}
                    </span>
                  ) : (
                    <TextoCopiavel valor={a.campos[c.id]} rotulo={c.rotulo} mono={c.tipo !== "texto" || c.id === "usuario"} />
                  )}
                </Par>
              ))}
            </dl>
          ) : (
            <p className="text-corpo text-apagado">Nenhum dado de conexão cadastrado.</p>
          )}
        </Secao>

        <Secao titulo={tipo.segredos.length > 1 ? "Segredos" : SEGREDOS_ACESSO[tipo.segredos[0]].rotulo}>
          {tipo.segredos.length > 1 ? (
            <dl className="grid grid-cols-1 gap-3">
              {tipo.segredos.map((s) => (
                <Par key={s} rotulo={SEGREDOS_ACESSO[s].rotulo}>
                  {linhaSegredo(s)}
                </Par>
              ))}
            </dl>
          ) : (
            linhaSegredo(tipo.segredos[0])
          )}
          {semChave && (
            <p className="text-pequeno text-apagado">
              O servidor está sem a chave do cofre: nenhuma senha abre até a TI_COFRE_CHAVE voltar ao .env.
            </p>
          )}
        </Secao>

        {a.tipo === "wifi" && <BlocoQrWifi a={a} semChave={semChave} qrInicial={qrInicial} />}

        {a.equipamento && (
          <Secao titulo="Equipamento">
            <Link
              href={`/ti/equipamentos?abrir=${a.equipamento.id}`}
              className="flex items-center gap-2 self-start rounded-controle text-corpo text-tinta hover:text-acento"
            >
              <Icone nome="patrimonio" tamanho={15} className="text-apagado" />
              {a.equipamento.patrimonio ? `${a.equipamento.patrimonio} · ${a.equipamento.nome}` : a.equipamento.nome}
              <Icone nome="seta-direita" tamanho={14} className="text-apagado" />
            </Link>
          </Secao>
        )}

        {a.observacoes && (
          <Secao titulo="Observações">
            <p className="text-corpo whitespace-pre-line text-tinta-2">{a.observacoes}</p>
          </Secao>
        )}

        <p className="text-pequeno text-apagado">
          Cadastrado em {dataHoraBR(a.criadoEm)} · atualizado em {dataHoraBR(a.atualizadoEm)}
        </p>
      </div>

      <Secao titulo="Registro">
        <HistoricoAcesso eventos={a.eventos} tipo={a.tipo} />
      </Secao>
    </div>
  );
}

function EsqueletoFicha() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Esqueleto className="w-1/3" />
        <Esqueleto className="w-2/3" />
        <Esqueleto className="w-1/2" />
        <Esqueleto className="mt-3 w-1/4" />
        <Esqueleto className="w-1/2" />
      </div>
      <div className="flex flex-col gap-3">
        <Esqueleto className="w-1/2" />
        <Esqueleto className="w-3/4" />
        <Esqueleto className="w-2/3" />
      </div>
    </div>
  );
}

interface PropsFicha {
  /** O servidor está sem a chave do cofre. */
  semChave: boolean;
  onEditar: (a: AcessoDetalhe) => void;
  onFechar: () => void;
  onApagado?: () => void;
}

/**
 * A ficha de um acesso: como entrar (cada campo se copia com um clique), os
 * segredos mascarados, o QR do Wi-Fi e, ao lado, o registro de quem viu,
 * copiou e trocou. Abrir a ficha não abre nenhum segredo.
 */
export function ModalFichaAcesso({ id, ...props }: PropsFicha & { id: number | null }) {
  const q = useAcesso(id);
  if (id == null) return null;
  const a = q.data;
  return (
    <JanelaFicha a={a} {...props}>
      {q.isError ? (
        <PainelErro titulo="Não deu para abrir o acesso" mensagem={(q.error as Error).message} onTentar={() => q.refetch()} />
      ) : !a ? (
        <EsqueletoFicha />
      ) : (
        <CorpoFicha a={a} semChave={props.semChave} />
      )}
    </JanelaFicha>
  );
}

/** A ficha abrindo, para o catálogo. */
export function FichaAcessoCarregando() {
  const nada = () => {};
  return (
    <JanelaFicha a={undefined} estatico semChave={false} onEditar={nada} onFechar={nada}>
      <EsqueletoFicha />
    </JanelaFicha>
  );
}

/** A ficha parada, para o catálogo; `qr` mostra o QR do Wi-Fi já aberto. */
export function FichaAcessoEstatica({ acesso, qr }: { acesso: AcessoDetalhe; qr?: string }) {
  const nada = () => {};
  return (
    <JanelaFicha a={acesso} estatico semChave={false} onEditar={nada} onFechar={nada}>
      <CorpoFicha a={acesso} semChave={false} qrInicial={qr} />
    </JanelaFicha>
  );
}

function JanelaFicha({
  a,
  children,
  estatico,
  onEditar,
  onFechar,
  onApagado,
}: PropsFicha & { a: AcessoDetalhe | undefined; children: ReactNode; estatico?: boolean }) {
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    if (!a) return;
    setApagando(true);
    try {
      await mutar(`/api/ti/acessos/${a.id}`, "DELETE");
      avisar.ok("Acesso apagado do cofre");
      onApagado?.();
      onFechar();
    } catch (err) {
      avisar.erro((err as Error).message);
    } finally {
      setApagando(false);
    }
  }

  const titulo = a ? (
    <span className="flex min-w-0 items-center gap-2.5">
      <IconeAcesso tipo={a.tipo} className="size-7" />
      <span className="truncate">{a.nome}</span>
    </span>
  ) : (
    "Acesso"
  );
  const descricao = a ? [tipoAcesso(a.tipo).rotulo, a.grupo].filter(Boolean).join(" · ") : undefined;

  const rodape = (
    <>
      {a &&
        (confirmando ? (
          <Botao variante="perigo" icone="apagar" carregando={apagando} onClick={apagar} className="mr-auto">
            Confirmar exclusão
          </Botao>
        ) : (
          <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
            Apagar
          </Botao>
        ))}
      <Botao variante="fantasma" onClick={onFechar}>
        Fechar
      </Botao>
      <Botao variante="secundario" icone="editar" disabled={!a} onClick={() => a && onEditar(a)}>
        Editar
      </Botao>
    </>
  );

  if (estatico)
    return (
      <PainelModal estatico largura="g" titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
        {children}
      </PainelModal>
    );
  return (
    <Modal aberto largura="g" titulo={titulo} descricao={descricao} rodape={rodape} onFechar={onFechar}>
      {children}
    </Modal>
  );
}
