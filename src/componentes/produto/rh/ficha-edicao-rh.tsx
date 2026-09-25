"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Caixa } from "@/componentes/primitivos/caixa";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Nota, PainelErro } from "@/componentes/primitivos/estados";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { numeroDigitado } from "@/componentes/produto/contabil/campo-numero";
import { CorpoFicha, EsqueletoFicha, useFicha } from "@/componentes/produto/pessoal/ficha-funcionario";
import { diasDesde, tempoCasa } from "@/componentes/produto/pessoal/tempo-casa";
import { mutar } from "@/hooks/mutar";
import { CHAVES_RH, useRhSetores } from "@/hooks/use-rh";
import { brl, dataBR, decimal, documento, num } from "@/lib/format";
import { EMPRESAS_RH, ehContratoPj, nomeEmpresaRh, pjIdDoContrato, type EmpresaRh } from "@/lib/rh";
import type { SetorRh } from "@/lib/rh-tipos";
import type { FolhaFicha } from "@/lib/types";

/*
 * A ficha do RH: a mesma ficha do DP, com o que só o RH tem. O RH lê o e-mail
 * (o Questor não guarda e-mail de ninguém) e corrige o cadastro por cima do
 * Questor, que é produção e só se lê: a correção mora no banco do app, campo a
 * campo, e a ficha aplica por cima. PJ não existe no Questor e mora inteiro no
 * app, então a edição dele é o próprio cadastro.
 *
 * Não estende o `ModalFicha` do DP: a edição troca o corpo e o rodapé do modal
 * inteiro, e o DP continua sem nada disso.
 */

/** O que a ficha precisa da linha clicada. Serve a linha do Diretório e a da Rotatividade. */
export interface PessoaFichaRh {
  codigoempresa: number;
  contrato: number;
  nome: string;
  cargo?: string | null;
  /** Tem correção do RH por cima do Questor. Desconhecido, a ficha oferece desfazer assim mesmo. */
  editado?: boolean;
}

/** Os campos que o RH edita, como texto de formulário (o vazio é permitido enquanto se digita). */
export interface DadosPessoaRh {
  nome: string;
  cpf: string;
  cargo: string;
  classiforgan: string;
  dataadm: string;
  email: string;
  salario: string;
  nascimento: string;
  cidade: string;
  uf: string;
  escolaridade: string;
  temExperiencia: boolean;
}

export const FORM_PESSOA_VAZIO: DadosPessoaRh = {
  nome: "",
  cpf: "",
  cargo: "",
  classiforgan: "",
  dataadm: "",
  email: "",
  salario: "",
  nascimento: "",
  cidade: "",
  uf: "",
  escolaridade: "",
  temExperiencia: false,
};

export function formDaFicha(f: FolhaFicha): DadosPessoaRh {
  return {
    nome: f.nome ?? "",
    cpf: f.cpf ?? "",
    cargo: f.cargo ?? "",
    classiforgan: f.classiforgan ?? "",
    dataadm: f.dataadm ?? "",
    email: f.email ?? "",
    // O campo mostra o valor como se digita ("2.318,4"); `numeroDigitado` lê de volta.
    salario: f.salario != null ? decimal(f.salario, 2) : "",
    nascimento: f.nascimento ?? "",
    cidade: f.cidade ?? "",
    uf: f.uf ?? "",
    escolaridade: f.escolaridade ?? "",
    temExperiencia: !!f.temExperiencia,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ErrosPessoaRh = Partial<Record<keyof DadosPessoaRh, string>>;

/**
 * O que impede salvar. O servidor só confere o e-mail no cadastro de PJ novo; a
 * correção e a edição do PJ gravariam qualquer texto, e e-mail torto só aparece
 * quando o formulário não chega. Por isso a tela confere antes.
 */
export function errosPessoaRh(f: DadosPessoaRh): ErrosPessoaRh {
  const e: ErrosPessoaRh = {};
  if (!f.nome.trim()) e.nome = "Informe o nome.";
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = "E-mail inválido.";
  if (f.uf.trim() && !/^[A-Za-z]{2}$/.test(f.uf.trim())) e.uf = "Duas letras.";
  if (f.salario.trim() && (numeroDigitado(f.salario) ?? -1) < 0) e.salario = "Valor inválido.";
  // A trilha de experiência conta os 45 e 90 dias do início: PJ marcado sem
  // data some da tela de Experiência sem aviso nenhum.
  if (f.temExperiencia && !f.dataadm) e.dataadm = "Informe o início para contar a experiência.";
  return e;
}

/**
 * Só o que mudou vai para o servidor. Na correção do Questor, mandar o campo
 * igual gravaria uma "correção" que não corrige nada e marcaria a pessoa como
 * corrigida no Diretório.
 */
export function camposMudados(form: DadosPessoaRh, base: DadosPessoaRh, ehPj: boolean): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  const textos = ["nome", "cpf", "cargo", "classiforgan", "dataadm", "email", "nascimento", "cidade", "uf", "escolaridade"] as const;
  for (const k of textos) {
    const v = form[k].trim();
    if (v !== base[k].trim()) campos[k] = k === "uf" ? v.toUpperCase() : v;
  }
  const salario = form.salario.trim() ? numeroDigitado(form.salario) : null;
  const salarioBase = base.salario.trim() ? numeroDigitado(base.salario) : null;
  if (salario !== salarioBase) campos.salario = salario;
  if (ehPj && form.temExperiencia !== base.temExperiencia) campos.temExperiencia = form.temExperiencia;
  return campos;
}

/**
 * O formulário da pessoa, controlado. Serve à correção de quem veio do Questor,
 * à edição do PJ e ao cadastro de PJ novo (`novo`, com a empresa e sem os dados
 * pessoais, que se completam depois pela ficha).
 */
export function FormPessoaRh({
  id,
  valores,
  onMudar,
  setores,
  ehPj,
  novo,
  empresa,
  onEmpresa,
  erros = {},
  onEnviar,
}: {
  /** Id do `<form>`: o botão de salvar mora no rodapé do modal, fora dele. */
  id?: string;
  valores: DadosPessoaRh;
  onMudar: (parcial: Partial<DadosPessoaRh>) => void;
  /** Indefinido enquanto carrega: o seletor fica no lugar, travado. */
  setores: SetorRh[] | undefined;
  ehPj: boolean;
  novo?: boolean;
  empresa?: EmpresaRh;
  onEmpresa?: (e: EmpresaRh) => void;
  erros?: ErrosPessoaRh;
  onEnviar?: () => void;
}) {
  const base = useId();
  const idc = (c: string) => `${id ?? base}-${c}`;

  // Quem veio do Questor não fica "sem setor": o vazio da correção devolve o
  // setor do Questor, então a opção mentiria.
  const opcoesSetor: Opcao[] = [
    ...(ehPj ? [{ valor: "", rotulo: "Sem setor" }] : []),
    ...(setores ?? []).map((s) => ({ valor: s.classiforgan, rotulo: s.nome })),
  ];

  const texto = (
    campo: keyof DadosPessoaRh,
    rotulo: string,
    extra?: { tipo?: string; decimal?: boolean; placeholder?: string; autofoco?: boolean; classe?: string }
  ) => (
    <Rotulado rotulo={rotulo} htmlFor={idc(campo)} erro={erros[campo]} className={extra?.classe}>
      <Campo
        id={idc(campo)}
        type={extra?.tipo ?? "text"}
        inputMode={extra?.decimal ? "decimal" : undefined}
        data-autofoco={extra?.autofoco || undefined}
        value={valores[campo] as string}
        placeholder={extra?.placeholder}
        aria-invalid={!!erros[campo]}
        onChange={(e) => onMudar({ [campo]: campo === "uf" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value })}
      />
    </Rotulado>
  );

  return (
    <form
      id={id}
      noValidate
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar?.();
      }}
    >
      {texto("nome", "Nome", { autofoco: true, classe: "sm:col-span-2" })}
      {novo && empresa != null && onEmpresa && (
        <Rotulado rotulo="Empresa" className="sm:col-span-2">
          <Segmentado<string>
            rotulo="Empresa"
            valor={String(empresa)}
            onMudar={(v) => onEmpresa(Number(v) as EmpresaRh)}
            opcoes={EMPRESAS_RH.map((c) => ({ valor: String(c), rotulo: nomeEmpresaRh(c) }))}
            className="self-start"
          />
        </Rotulado>
      )}
      <Rotulado rotulo="Setor">
        <Combo
          opcoes={opcoesSetor}
          valor={valores.classiforgan}
          onMudar={(v) => onMudar({ classiforgan: v })}
          placeholder={setores ? "Escolher setor" : "Carregando setores"}
          desabilitado={!setores}
          icone="camadas"
          rotuloAcessivel="Setor"
        />
      </Rotulado>
      {texto("cargo", "Cargo")}
      {texto("cpf", ehPj ? "CPF ou CNPJ" : "CPF")}
      {texto("email", "E-mail", { tipo: "email", placeholder: "nome@navecon.com.br" })}
      {texto("dataadm", ehPj ? "Início" : "Admissão", { tipo: "date" })}
      {!novo && (
        <>
          {texto("salario", ehPj ? "Remuneração (R$)" : "Salário (R$)", { placeholder: "0,00", decimal: true })}
          {texto("nascimento", "Nascimento", { tipo: "date" })}
          {texto("escolaridade", "Escolaridade")}
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
            {texto("cidade", "Cidade")}
            {texto("uf", "UF")}
          </div>
        </>
      )}
      {ehPj && (
        <Rotulado
          className="sm:col-span-2"
          ajuda="Entra na tela de Experiência com os marcos de 45 e 90 dias contados do início."
        >
          <Caixa
            marcada={valores.temExperiencia}
            onMudar={(m) => onMudar({ temExperiencia: m })}
            rotulo="Tem contrato de experiência"
          />
        </Rotulado>
      )}
    </form>
  );
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/** A seção no desenho das seções da ficha do DP, para as duas lerem como uma só. */
function SecaoFicha({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-pequeno font-[600] text-tinta-2">{titulo}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

const ou = (v: string | null | undefined) => v || "—";

function Email({ email }: { email: string | null | undefined }) {
  return email ? (
    <span className="block truncate" title={email}>
      {email}
    </span>
  ) : (
    <span className="text-apagado">Sem e-mail</span>
  );
}

/** O sinal de onde a pessoa vem: PJ, ou do Questor com correção do RH por cima. */
export function SeloOrigemRh({ pj, editado }: { pj: boolean; editado?: boolean }) {
  if (pj) return <Selo title="Cadastrado no RH, fora do Questor">PJ</Selo>;
  if (editado)
    return (
      <Selo tom="rota" icone="editar" title="Ficha corrigida no RH">
        Corrigido
      </Selo>
    );
  return null;
}

/**
 * A ficha de quem veio do Questor, com o que é do RH em cima: o e-mail e a
 * origem. O resto é a ficha do DP, a mesma peça.
 */
export function CorpoFichaRh({ ficha, editado }: { ficha: FolhaFicha; editado?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <SecaoFicha titulo="Cadastro no RH">
        <Par rotulo="E-mail" className="col-span-2">
          <Email email={ficha.email} />
        </Par>
        <Par rotulo="Origem">
          {editado ? <SeloOrigemRh pj={false} editado /> : "Questor"}
        </Par>
      </SecaoFicha>
      <CorpoFicha ficha={ficha} />
    </div>
  );
}

/**
 * A ficha do PJ. Não usa a do DP: sexo, estabelecimento, vínculo e
 * desligamento são do Questor, e no PJ viravam uma fila de traços.
 */
export function CorpoFichaPj({ ficha: f }: { ficha: FolhaFicha }) {
  const dias = f.tempoCasaDias ?? diasDesde(f.dataadm);
  return (
    <div className="flex flex-col gap-5">
      <SecaoFicha titulo="Cadastro no RH">
        <Par rotulo="E-mail" className="col-span-2">
          <Email email={f.email} />
        </Par>
        <Par rotulo="Origem">
          <SeloOrigemRh pj />
        </Par>
      </SecaoFicha>
      <SecaoFicha titulo="Pessoa">
        <Par rotulo="CPF ou CNPJ">
          <span className="num">{f.cpf ? documento(f.cpf) : "—"}</span>
        </Par>
        <Par rotulo="Nascimento">
          <span className="num">{dataBR(f.nascimento)}</span>
        </Par>
        <Par rotulo="Idade">{f.idade != null ? `${num(f.idade)} anos` : "—"}</Par>
        <Par rotulo="Escolaridade">{ou(f.escolaridade)}</Par>
        <Par rotulo="Cidade">{f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ""}` : "—"}</Par>
      </SecaoFicha>
      <SecaoFicha titulo="Vínculo">
        <Par rotulo="Cargo">{ou(f.cargo)}</Par>
        <Par rotulo="Setor">{ou(f.setor)}</Par>
        <Par rotulo="Remuneração">
          {f.salario != null ? <span className="num">{brl(f.salario)}</span> : "—"}
        </Par>
      </SecaoFicha>
      <SecaoFicha titulo="Contrato">
        <Par rotulo="Início">
          <span className="num">{dataBR(f.dataadm)}</span>
        </Par>
        <Par rotulo="Tempo de casa">{tempoCasa(dias)}</Par>
        <Par rotulo="Experiência">{f.temExperiencia ? "45 e 90 dias" : "Sem experiência"}</Par>
      </SecaoFicha>
    </div>
  );
}

/** Cargo, contrato e empresa: o que diz de quem é a ficha, antes do dado chegar. */
export function descricaoFichaRh(empresa: number, contrato: number, cargo: string | null | undefined): string {
  return [cargo || "Sem cargo", ehContratoPj(contrato) ? "PJ" : `contrato ${contrato}`, nomeEmpresaRh(empresa)].join(" · ");
}

// ── O modal ──────────────────────────────────────────────────────────────────

type Ocupado = "salvar" | "desfazer" | "remover" | null;

/**
 * A ficha em modal, com a edição do RH. Abre do Diretório e de qualquer lista
 * de pessoas do RH (a Rotatividade troca o `ModalFicha` por este).
 *
 * A edição guarda a pessoa em que começou: trocar de linha com o formulário de
 * outra pessoa aberto, mesmo por um instante, salvaria o cadastro errado.
 */
export function ModalFichaRh({ pessoa, onFechar }: { pessoa: PessoaFichaRh | null; onFechar: () => void }) {
  const qc = useQueryClient();
  const idForm = useId();
  const empresa = pessoa?.codigoempresa ?? null;
  const contrato = pessoa?.contrato ?? null;
  const chave = pessoa ? `${pessoa.codigoempresa}:${pessoa.contrato}` : null;
  const ehPj = contrato != null && ehContratoPj(contrato);

  const q = useFicha("rh", empresa, contrato);
  const setores = useRhSetores(pessoa != null);
  const f = q.data;

  const [edicao, setEdicao] = useState<{
    chave: string;
    form: DadosPessoaRh;
    base: DadosPessoaRh;
    tentou: boolean;
  } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<Ocupado>(null);
  const emEdicao = edicao && edicao.chave === chave ? edicao : null;

  const fechar = () => {
    setEdicao(null);
    setConfirmando(false);
    onFechar();
  };
  const sairDaEdicao = () => {
    setEdicao(null);
    setConfirmando(false);
  };

  // O Diretório, os setores (o PJ conta no setor) e a própria ficha leem o que mudou.
  const invalidar = (comFicha: boolean) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [CHAVES_RH.funcionarios] }),
      qc.invalidateQueries({ queryKey: [CHAVES_RH.setores] }),
      comFicha ? qc.invalidateQueries({ queryKey: ["pessoal-ficha"] }) : null,
    ]);

  async function salvar() {
    if (!emEdicao || !f || empresa == null || contrato == null) return;
    if (Object.keys(errosPessoaRh(emEdicao.form)).length) {
      setEdicao({ ...emEdicao, tentou: true });
      return;
    }
    const campos = camposMudados(emEdicao.form, emEdicao.base, ehPj);
    if (!Object.keys(campos).length) {
      sairDaEdicao();
      return;
    }
    setOcupado("salvar");
    try {
      if (ehPj) await mutar("/api/rh/pessoa-pj", "PATCH", { id: pjIdDoContrato(contrato), campos });
      else await mutar("/api/rh/funcionario-override", "PUT", { empresa, contrato, campos });
      await invalidar(true);
      avisar.ok("Ficha salva", emEdicao.form.nome.trim());
      sairDaEdicao();
    } catch (e) {
      avisar.erro("Não deu para salvar a ficha", (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function desfazer() {
    if (empresa == null || contrato == null) return;
    setOcupado("desfazer");
    try {
      await mutar(`/api/rh/funcionario-override?empresa=${empresa}&contrato=${contrato}`, "DELETE");
      await invalidar(true);
      avisar.ok("Correções desfeitas", "A ficha voltou ao cadastro do Questor.");
      sairDaEdicao();
    } catch (e) {
      avisar.erro("Não deu para desfazer as correções", (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function removerPj() {
    if (contrato == null) return;
    const nome = f?.nome ?? pessoa?.nome ?? "";
    setOcupado("remover");
    try {
      await mutar(`/api/rh/pessoa-pj?id=${pjIdDoContrato(contrato)}`, "DELETE");
      // Fecha antes de recarregar: com o modal aberto, a ficha buscaria de novo
      // quem acabou de sair e piscaria o erro de "não encontrado".
      fechar();
      await invalidar(false);
      avisar.ok("PJ removido do diretório", nome);
    } catch (e) {
      avisar.erro("Não deu para remover", (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const titulo = f?.nome ?? pessoa?.nome ?? "";
  const descricao =
    empresa != null && contrato != null ? descricaoFichaRh(empresa, contrato, f?.cargo ?? pessoa?.cargo) : undefined;

  let corpo: ReactNode;
  if (emEdicao && f) {
    const erros = emEdicao.tentou ? errosPessoaRh(emEdicao.form) : {};
    corpo = (
      <div className="flex flex-col gap-4">
        <FormPessoaRh
          id={idForm}
          valores={emEdicao.form}
          onMudar={(p) => setEdicao((e) => e && { ...e, form: { ...e.form, ...p } })}
          setores={setores.data}
          ehPj={ehPj}
          erros={erros}
          onEnviar={salvar}
        />
        {!ehPj && <Nota>A correção vale no NaveX e não muda o Questor. Campo apagado volta ao valor do Questor.</Nota>}
      </div>
    );
  } else if (q.error) {
    corpo = (
      <PainelErro
        titulo="Não deu para abrir a ficha"
        mensagem={(q.error as Error).message}
        onTentar={() => q.refetch()}
      />
    );
  } else if (!f) {
    corpo = <EsqueletoFicha />;
  } else {
    corpo = ehPj ? <CorpoFichaPj ficha={f} /> : <CorpoFichaRh ficha={f} editado={pessoa?.editado} />;
  }

  const rodape = emEdicao ? (
    <>
      {ehPj ? (
        confirmando ? (
          <Botao variante="perigo" icone="apagar" carregando={ocupado === "remover"} onClick={removerPj} className="mr-auto">
            Confirmar remoção
          </Botao>
        ) : (
          <Botao variante="fantasma" icone="apagar" onClick={() => setConfirmando(true)} className="mr-auto">
            Remover do diretório
          </Botao>
        )
      ) : pessoa?.editado === false ? null : confirmando ? (
        <Botao variante="perigo" icone="desfazer" carregando={ocupado === "desfazer"} onClick={desfazer} className="mr-auto">
          Confirmar: voltar ao Questor
        </Botao>
      ) : (
        <Botao variante="fantasma" icone="desfazer" onClick={() => setConfirmando(true)} className="mr-auto">
          Desfazer correções
        </Botao>
      )}
      <Botao variante="fantasma" onClick={sairDaEdicao} disabled={ocupado != null}>
        Cancelar
      </Botao>
      <Botao variante="primario" icone="salvar" type="submit" form={idForm} carregando={ocupado === "salvar"}>
        Salvar
      </Botao>
    </>
  ) : (
    <>
      <Botao variante="fantasma" onClick={fechar}>
        Fechar
      </Botao>
      <Botao
        icone="editar"
        disabled={!f || !chave}
        onClick={() => {
          if (!f || !chave) return;
          const base = formDaFicha(f);
          setConfirmando(false);
          setEdicao({ chave, form: base, base, tentou: false });
        }}
      >
        Editar
      </Botao>
    </>
  );

  return (
    <Modal
      aberto={pessoa != null}
      onFechar={fechar}
      titulo={titulo}
      descricao={descricao}
      rodape={rodape}
      fecharNoVeu={!emEdicao}
    >
      {corpo}
    </Modal>
  );
}
