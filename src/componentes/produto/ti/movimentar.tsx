"use client";

import { useId, useMemo, useState } from "react";
import { Segmentado, type OpcaoSegmento } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, ComboMulti, type Opcao } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { mutar } from "@/hooks/mutar";
import { cn } from "@/lib/cn";
import { hojeISO, num } from "@/lib/format";
import {
  lerChaveRecebedor,
  MOTIVOS_BAIXA,
  nomeEquipamento,
  textoPosse,
  type Destino,
  type EquipamentoLista,
  type MotivoBaixa,
  type PedidoMovimentacao,
  type PessoaExterna,
  type PessoaTi,
} from "@/lib/ti-tipos";
import { CelulaPosse, IconeTipo, Patrimonio } from "./equipamento";
import { CampoRecebedor, nomeRecebedor } from "./recebedor";

/** Como a janela abre: de onde veio o clique decide os itens e o destino já marcados. */
export interface InicialMovimentar {
  ids: number[];
  destino: Destino;
  /** Chave de quem recebe (`empresa:contrato` ou `externo:id`), quando a janela abre de uma pessoa. */
  pessoa?: string | null;
  /** Os itens vêm fixos (abriu de um equipamento ou de uma pessoa): a janela mostra, não oferece escolha. */
  travado?: boolean;
}

/**
 * O destino como a tela oferece: "Pessoa" cobre o Diretório e quem é de fora,
 * e qual dos dois é sai da pessoa escolhida.
 */
type DestinoTela = Exclude<Destino, "externo">;

const DESTINOS: OpcaoSegmento<DestinoTela>[] = [
  { valor: "pessoa", rotulo: "Pessoa", icone: "usuario" },
  { valor: "local", rotulo: "Local", icone: "local" },
  { valor: "estoque", rotulo: "Estoque", icone: "estoque" },
  { valor: "manutencao", rotulo: "Manutenção", icone: "manutencao" },
  { valor: "baixa", rotulo: "Baixa", icone: "bloqueado" },
];

const VERBO: Record<DestinoTela, string> = {
  pessoa: "Entregar",
  local: "Registrar o local",
  estoque: "Devolver ao estoque",
  manutencao: "Enviar para manutenção",
  baixa: "Dar baixa",
};

interface PropsMovimentar {
  equipamentos: EquipamentoLista[] | undefined;
  pessoas: PessoaTi[] | undefined;
  /** Quem é de fora do Diretório, do cadastro da TI. */
  externos: PessoaExterna[] | undefined;
  inicial: InicialMovimentar;
  onFechar: () => void;
  /** Depois de gravar: a tela recarrega a lista e a ficha. */
  onFeito?: () => void;
  /** Cadastrou alguém de fora no meio da entrega: a tela recarrega o cadastro. */
  onExternoCriado?: () => void;
  /** O catálogo mostra o cadastro rápido de alguém de fora aberto. */
  novoExternoAberto?: boolean;
}

/**
 * Uma movimentação para um ou vários equipamentos: o kit do funcionário novo
 * (notebook, mouse, teclado, headset) sai numa entrega só, e quem sai da
 * empresa devolve tudo de uma vez. O servidor grava todos ou nenhum.
 *
 * Com quem o equipamento estava não se escolhe: é o que o histórico diz. A
 * janela mostra, ao lado de cada item, de onde ele sai.
 */
export function ModalMovimentar({ aberto, ...props }: PropsMovimentar & { aberto: boolean }) {
  if (!aberto) return null;
  return <FormMovimentar {...props} />;
}

/** A janela parada, para o catálogo. */
export function MovimentarEstatico(props: PropsMovimentar) {
  return <FormMovimentar {...props} estatico />;
}

function FormMovimentar({
  equipamentos,
  pessoas,
  externos,
  inicial,
  onFechar,
  onFeito,
  onExternoCriado,
  novoExternoAberto,
  estatico,
}: PropsMovimentar & { estatico?: boolean }) {
  const id = useId();
  const [ids, setIds] = useState<string[]>(inicial.ids.map(String));
  const [destino, setDestino] = useState<DestinoTela>(inicial.destino === "externo" ? "pessoa" : inicial.destino);
  const [pessoa, setPessoa] = useState<string | null>(inicial.pessoa ?? null);
  const [local, setLocal] = useState("");
  const [motivo, setMotivo] = useState<MotivoBaixa | null>(null);
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const mudou = () => setErro(null);

  const porId = useMemo(() => new Map((equipamentos ?? []).map((e) => [String(e.id), e])), [equipamentos]);
  const escolhidos = ids.map((i) => porId.get(i)).filter((e): e is EquipamentoLista => !!e);

  const opcoesItens = useMemo<Opcao[]>(
    () =>
      (equipamentos ?? []).map((e) => ({
        valor: String(e.id),
        rotulo: `${e.patrimonio ? `${e.patrimonio} · ` : ""}${nomeEquipamento(e)}`,
        detalhe: textoPosse(e.posse),
      })),
    [equipamentos]
  );
  async function registrar() {
    if (!escolhidos.length) return setErro("Escolha ao menos um equipamento.");
    const recebedor = destino === "pessoa" && pessoa ? lerChaveRecebedor(pessoa) : null;
    if (destino === "pessoa" && !recebedor) return setErro("Escolha quem recebe.");
    if (destino === "local" && !local.trim()) return setErro("Diga onde o equipamento fica.");
    if (destino === "baixa" && !motivo) return setErro("Diga o motivo da baixa.");
    if (!data) return setErro("Informe a data.");
    const corpo: PedidoMovimentacao = {
      equipamentos: escolhidos.map((e) => e.id),
      destino: recebedor?.destino ?? (destino as Destino),
      pessoa: recebedor?.destino === "pessoa" ? { empresa: recebedor.empresa, contrato: recebedor.contrato } : null,
      externo: recebedor?.destino === "externo" ? { id: recebedor.id } : null,
      local: destino === "local" || destino === "manutencao" ? local.trim() || null : null,
      motivo: destino === "baixa" ? motivo : null,
      data,
      observacao: observacao.trim() || null,
    };
    setEnviando(true);
    try {
      const r = await mutar<{ movidos: number }>("/api/ti/movimentacoes", "POST", corpo);
      const para =
        destino === "pessoa"
          ? nomeRecebedor(pessoa, pessoas, externos)
          : textoPosse(
              destino === "local"
                ? { destino, local: local.trim() }
                : destino === "manutencao"
                  ? { destino, local: local.trim() || null }
                  : destino === "baixa"
                    ? { destino, motivo: motivo! }
                    : { destino: "estoque" }
            );
      avisar.ok(r.movidos === 1 ? "Movimentação registrada" : `${num(r.movidos)} equipamentos movimentados`, para);
      onFeito?.();
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        registrar();
      }}
    >
      {inicial.travado ? (
        <ul className="flex flex-col divide-y divide-linha rounded-controle border border-linha">
          {escolhidos.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2">
              <IconeTipo tipo={e.tipo} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-corpo text-tinta">{nomeEquipamento(e)}</span>
                <span className="block text-pequeno">
                  <Patrimonio codigo={e.patrimonio} />
                </span>
              </span>
              <span className="w-56 min-w-0 text-corpo">
                <CelulaPosse posse={e.posse} />
              </span>
            </li>
          ))}
          {!escolhidos.length && <li className="px-3 py-2">{equipamentos ? "Nenhum equipamento" : <Esqueleto className="h-5 w-48" />}</li>}
        </ul>
      ) : (
        <Rotulado
          rotulo="Equipamentos"
          ajuda={escolhidos.length > 1 ? `${num(escolhidos.length)} equipamentos vão juntos para o mesmo destino.` : undefined}
        >
          <ComboMulti
            opcoes={opcoesItens}
            valor={ids}
            onMudar={(v) => {
              setIds(v);
              mudou();
            }}
            rotuloTodas="Escolher equipamentos"
            plural="equipamentos"
            busca
            rotuloAcessivel="Equipamentos"
            desabilitado={!equipamentos}
          />
        </Rotulado>
      )}

      <Rotulado rotulo="Para onde vai">
        <Segmentado<DestinoTela>
          rotulo="Para onde vai"
          opcoes={DESTINOS}
          valor={destino}
          onMudar={(d) => {
            setDestino(d);
            mudou();
          }}
          className="max-w-full self-start overflow-x-auto"
        />
      </Rotulado>

      <div
        className={cn(
          "grid items-start gap-3",
          destino === "estoque" ? "sm:grid-cols-[170px]" : "sm:grid-cols-[minmax(0,1fr)_170px]"
        )}
      >
        {destino === "pessoa" && (
          <Rotulado rotulo="Quem recebe">
            <CampoRecebedor
              pessoas={pessoas}
              externos={externos}
              valor={pessoa}
              onMudar={(v) => {
                setPessoa(v);
                mudou();
              }}
              onCadastrado={onExternoCriado}
              novoAberto={novoExternoAberto}
            />
          </Rotulado>
        )}
        {(destino === "local" || destino === "manutencao") && (
          <Rotulado rotulo={destino === "local" ? "Onde fica" : "Assistência"} htmlFor={`${id}-local`}>
            <Campo
              id={`${id}-local`}
              value={local}
              onChange={(e) => {
                setLocal(e.target.value);
                mudou();
              }}
              placeholder={destino === "local" ? "Sala de reunião 2" : "Opcional"}
              maxLength={80}
            />
          </Rotulado>
        )}
        {destino === "baixa" && (
          <Rotulado rotulo="Motivo">
            <Combo
              opcoes={MOTIVOS_BAIXA.map((m) => ({ valor: m.valor, rotulo: m.rotulo }))}
              valor={motivo}
              onMudar={(v) => {
                setMotivo(v as MotivoBaixa);
                mudou();
              }}
              placeholder="Escolher"
              rotuloAcessivel="Motivo da baixa"
            />
          </Rotulado>
        )}
        <Rotulado rotulo="Data" htmlFor={`${id}-data`}>
          <Campo
            id={`${id}-data`}
            type="date"
            value={data}
            max={hojeISO()}
            onChange={(e) => {
              setData(e.target.value);
              mudou();
            }}
          />
        </Rotulado>
      </div>

      <Rotulado rotulo="Observação" htmlFor={`${id}-obs`}>
        <AreaTexto
          id={`${id}-obs`}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder={destino === "manutencao" ? "Tela trincada, chamado 4812" : "Opcional"}
          maxLength={1000}
        />
      </Rotulado>

      {destino === "baixa" && (
        <Nota tom="atencao" icone="alerta">
          A baixa tira o equipamento do inventário em uso. O histórico continua guardado.
        </Nota>
      )}
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
      <Botao
        variante={destino === "baixa" ? "perigo" : "primario"}
        icone={DESTINOS.find((d) => d.valor === destino)?.icone}
        type="submit"
        form={id}
        carregando={enviando}
      >
        {VERBO[destino]}
      </Botao>
    </>
  );

  const titulo = "Movimentar";
  const descricao = escolhidos.length
    ? escolhidos.length === 1
      ? `${escolhidos[0].patrimonio ? `${escolhidos[0].patrimonio} · ` : ""}${nomeEquipamento(escolhidos[0])}`
      : `${num(escolhidos.length)} equipamentos`
    : "Entrega, devolução, manutenção ou baixa";

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
