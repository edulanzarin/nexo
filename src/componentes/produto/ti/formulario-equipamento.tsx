"use client";

import { useId, useMemo, useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Nota } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { numeroDigitado } from "@/componentes/produto/contabil/campo-numero";
import { mutar } from "@/hooks/mutar";
import { hojeISO } from "@/lib/format";
import {
  CAMPOS_SPEC,
  chavePessoa,
  TIPOS_EQUIPAMENTO,
  tipoEquipamento,
  type DadosEquipamento,
  type EquipamentoLista,
  type PessoaTi,
} from "@/lib/ti-tipos";

/** Onde o equipamento novo está no dia do cadastro. Baixa e manutenção não fazem sentido aqui. */
type Onde = "estoque" | "pessoa" | "local";

export interface RascunhoEquipamento {
  tipo: string;
  patrimonio: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  especificacoes: Record<string, string>;
  dataCompra: string;
  valorCompra: string;
  fornecedor: string;
  notaFiscal: string;
  garantiaAte: string;
  observacoes: string;
  onde: Onde;
  pessoa: string | null;
  local: string;
}

const formatarValor = (v: number | null) =>
  v == null ? "" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function rascunhoDe(e?: EquipamentoLista | null): RascunhoEquipamento {
  return {
    tipo: e?.tipo ?? "notebook",
    patrimonio: e?.patrimonio ?? "",
    marca: e?.marca ?? "",
    modelo: e?.modelo ?? "",
    numeroSerie: e?.numeroSerie ?? "",
    especificacoes: { ...(e?.especificacoes ?? {}) } as Record<string, string>,
    dataCompra: e?.dataCompra ?? "",
    valorCompra: formatarValor(e?.valorCompra ?? null),
    fornecedor: e?.fornecedor ?? "",
    notaFiscal: e?.notaFiscal ?? "",
    garantiaAte: e?.garantiaAte ?? "",
    observacoes: e?.observacoes ?? "",
    onde: "estoque",
    pessoa: null,
    local: "",
  };
}

interface PropsEquipamento {
  /** Sem equipamento, é o cadastro de um novo. */
  equipamento?: EquipamentoLista | null;
  pessoas: PessoaTi[] | undefined;
  /** Rascunho de partida, para o catálogo mostrar a janela preenchida. */
  inicial?: Partial<RascunhoEquipamento>;
  onFechar: () => void;
  onSalvo?: (id: number) => void;
}

/**
 * O cadastro de um equipamento. O tipo escolhe as especificações que o
 * formulário pede (processador para notebook, entradas para monitor), a partir
 * do catálogo em `ti-tipos`.
 *
 * No cadastro novo, a janela pergunta onde ele está hoje: quem registra o
 * inventário que já existe cadastra o notebook com quem ele está, e o histórico
 * começa verdadeiro. Na edição essa parte some: com quem ele está só muda por
 * movimentação, que deixa rastro.
 */
export function ModalEquipamento({ aberto, ...props }: PropsEquipamento & { aberto: boolean }) {
  if (!aberto) return null;
  return <FormEquipamento {...props} />;
}

export function EquipamentoEstatico(props: PropsEquipamento) {
  return <FormEquipamento {...props} estatico />;
}

function FormEquipamento({
  equipamento,
  pessoas,
  inicial,
  onFechar,
  onSalvo,
  estatico,
}: PropsEquipamento & { estatico?: boolean }) {
  const id = useId();
  const [r, setR] = useState<RascunhoEquipamento>(() => ({ ...rascunhoDe(equipamento), ...inicial }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (p: Partial<RascunhoEquipamento>) => {
    setR((a) => ({ ...a, ...p }));
    setErro(null);
  };
  const novo = !equipamento;
  const tipo = tipoEquipamento(r.tipo);

  const opcoesTipo = useMemo<Opcao[]>(
    () => TIPOS_EQUIPAMENTO.map((t) => ({ valor: t.id, rotulo: t.rotulo, icone: t.icone as Opcao["icone"] })),
    []
  );
  const opcoesPessoas = useMemo<Opcao[]>(
    () =>
      (pessoas ?? []).map((p) => ({
        valor: chavePessoa(p.empresa, p.contrato),
        rotulo: p.nome,
        detalhe: p.setor ?? undefined,
      })),
    [pessoas]
  );

  async function salvar() {
    const valor = r.valorCompra.trim() ? numeroDigitado(r.valorCompra) : null;
    if (r.valorCompra.trim() && valor == null) return setErro("O valor da compra não se lê como número.");
    if (novo && r.onde === "pessoa" && !r.pessoa) return setErro("Escolha com quem o equipamento está.");
    if (novo && r.onde === "local" && !r.local.trim()) return setErro("Diga onde o equipamento fica.");
    const dados: DadosEquipamento = {
      tipo: r.tipo,
      patrimonio: r.patrimonio,
      marca: r.marca,
      modelo: r.modelo,
      numeroSerie: r.numeroSerie,
      // Só as do tipo: trocar de notebook para mouse não leva o processador junto.
      especificacoes: Object.fromEntries(tipo.specs.map((c) => [c, r.especificacoes[c] ?? ""])),
      dataCompra: r.dataCompra || null,
      valorCompra: valor,
      fornecedor: r.fornecedor,
      notaFiscal: r.notaFiscal,
      garantiaAte: r.garantiaAte || null,
      observacoes: r.observacoes,
    };
    setSalvando(true);
    try {
      let salvoId: number;
      if (novo) {
        const [empresa, contrato] = (r.pessoa ?? "").split(":").map(Number);
        const res = await mutar<{ id: number }>("/api/ti/equipamentos", "POST", {
          ...dados,
          inicio: {
            destino: r.onde,
            pessoa: r.onde === "pessoa" ? { empresa, contrato } : null,
            local: r.onde === "local" ? r.local : null,
            data: hojeISO(),
          },
        });
        salvoId = res.id;
      } else {
        await mutar(`/api/ti/equipamentos/${equipamento.id}`, "PATCH", dados);
        salvoId = equipamento.id;
      }
      avisar.ok(novo ? "Equipamento cadastrado" : "Cadastro salvo");
      onSalvo?.(salvoId);
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (chave: keyof RascunhoEquipamento, rotulo: string, extra: Record<string, unknown> = {}) => (
    <Rotulado rotulo={rotulo} htmlFor={`${id}-${chave}`}>
      <Campo
        id={`${id}-${chave}`}
        value={r[chave] as string}
        onChange={(e) => mudar({ [chave]: e.target.value } as Partial<RascunhoEquipamento>)}
        {...extra}
      />
    </Rotulado>
  );

  const corpo = (
    <form
      id={id}
      className="flex flex-col gap-5"
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
            rotuloAcessivel="Tipo do equipamento"
            busca={false}
          />
        </Rotulado>
        {campo("patrimonio", "Patrimônio", { placeholder: "Sem etiqueta", maxLength: 40, "data-autofoco": true })}
        {campo("marca", "Marca", { placeholder: "Dell", maxLength: 120 })}
        {campo("modelo", "Modelo", { placeholder: "Latitude 3420", maxLength: 120 })}
        {campo("numeroSerie", "Número de série", { maxLength: 120 })}
      </section>

      {tipo.specs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-pequeno font-[600] text-tinta-2">Especificações</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tipo.specs.map((c) => (
              <Rotulado key={c} rotulo={CAMPOS_SPEC[c].rotulo} htmlFor={`${id}-spec-${c}`}>
                <Campo
                  id={`${id}-spec-${c}`}
                  value={r.especificacoes[c] ?? ""}
                  onChange={(e) => mudar({ especificacoes: { ...r.especificacoes, [c]: e.target.value } })}
                  placeholder={CAMPOS_SPEC[c].exemplo}
                  maxLength={120}
                />
              </Rotulado>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-pequeno font-[600] text-tinta-2">Compra</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {campo("dataCompra", "Data", { type: "date" })}
          {campo("valorCompra", "Valor", { inputMode: "decimal", placeholder: "0,00" })}
          {campo("garantiaAte", "Garantia até", { type: "date" })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo("fornecedor", "Fornecedor", { maxLength: 120 })}
          {campo("notaFiscal", "Nota fiscal", { maxLength: 60 })}
        </div>
      </section>

      <Rotulado rotulo="Observações" htmlFor={`${id}-obs`}>
        <AreaTexto
          id={`${id}-obs`}
          value={r.observacoes}
          onChange={(e) => mudar({ observacoes: e.target.value })}
          placeholder="Carregador original, capa, o que mais acompanha"
          maxLength={1000}
        />
      </Rotulado>

      {novo && (
        <section className="flex flex-col gap-3 border-t border-linha pt-4">
          <h3 className="text-pequeno font-[600] text-tinta-2">Onde está hoje</h3>
          <Segmentado<Onde>
            rotulo="Onde está hoje"
            opcoes={[
              { valor: "estoque", rotulo: "Estoque", icone: "estoque" },
              { valor: "pessoa", rotulo: "Com uma pessoa", icone: "usuario" },
              { valor: "local", rotulo: "Num local", icone: "local" },
            ]}
            valor={r.onde}
            onMudar={(onde) => mudar({ onde })}
            className="self-start"
          />
          {r.onde === "pessoa" && (
            <Combo
              opcoes={opcoesPessoas}
              valor={r.pessoa}
              onMudar={(v) => mudar({ pessoa: v })}
              placeholder={pessoas ? "Escolher no Diretório" : "Carregando o Diretório"}
              busca
              icone="usuario"
              rotuloAcessivel="Com quem está"
              desabilitado={!pessoas}
            />
          )}
          {r.onde === "local" && (
            <Campo
              value={r.local}
              onChange={(e) => mudar({ local: e.target.value })}
              placeholder="Sala de reunião 2"
              aria-label="Onde fica"
              maxLength={80}
            />
          )}
        </section>
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
      <Botao variante="primario" icone="salvar" type="submit" form={id} carregando={salvando}>
        {novo ? "Cadastrar" : "Salvar"}
      </Botao>
    </>
  );

  const titulo = novo ? "Novo equipamento" : "Editar cadastro";
  const descricao = novo ? "O que é, o que tem e onde está" : equipamento.patrimonio ?? tipo.rotulo;

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
