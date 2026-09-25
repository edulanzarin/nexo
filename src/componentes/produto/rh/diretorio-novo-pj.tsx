"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { mutar } from "@/hooks/mutar";
import { CHAVES_RH, useRhSetores } from "@/hooks/use-rh";
import { EMPRESAS_RH, type EmpresaRh } from "@/lib/rh";
import type { SetorRh } from "@/lib/rh-tipos";
import {
  errosPessoaRh,
  FORM_PESSOA_VAZIO,
  FormPessoaRh,
  type DadosPessoaRh,
  type ErrosPessoaRh,
} from "./ficha-edicao-rh";

/*
 * Cadastro de PJ: quem presta serviço à Navecon sem contrato no Questor. Entra
 * no Diretório, pode receber formulário e, marcado com experiência, entra na
 * trilha de 45 e 90 dias. O cadastro pede o básico; o resto (nascimento,
 * remuneração, cidade) se completa depois pela ficha, que é a mesma edição.
 */

const TITULO = "Adicionar Pessoa PJ";
const DESCRICAO = "Para quem trabalha na Navecon sem contrato no Questor";

export function ModalNovoPj({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  // Monta a cada abertura: o formulário nasce limpo sem efeito que o zere.
  if (!aberto) return null;
  return <JanelaNovoPj onFechar={onFechar} />;
}

function JanelaNovoPj({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const id = useId();
  const setores = useRhSetores();
  const [form, setForm] = useState(FORM_PESSOA_VAZIO);
  const [empresa, setEmpresa] = useState<EmpresaRh>(EMPRESAS_RH[0]);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const erros = tentou ? errosPessoaRh(form) : {};

  async function criar() {
    if (Object.keys(errosPessoaRh(form)).length) {
      setTentou(true);
      return;
    }
    setSalvando(true);
    try {
      await mutar("/api/rh/pessoa-pj", "POST", {
        codigoempresa: empresa,
        nome: form.nome.trim(),
        cargo: form.cargo,
        classiforgan: form.classiforgan || null,
        cpfCnpj: form.cpf,
        email: form.email,
        dataInicio: form.dataadm || null,
        temExperiencia: form.temExperiencia,
      });
      // O PJ conta no setor dele: a lista de setores recontará.
      await Promise.all([
        qc.invalidateQueries({ queryKey: [CHAVES_RH.funcionarios] }),
        qc.invalidateQueries({ queryKey: [CHAVES_RH.setores] }),
      ]);
      avisar.ok("PJ adicionado ao diretório", form.nome.trim());
      onFechar();
    } catch (e) {
      avisar.erro("Não deu para adicionar", (e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={TITULO}
      descricao={DESCRICAO}
      fecharNoVeu={false}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="mais" type="submit" form={id} carregando={salvando}>
            Adicionar
          </Botao>
        </>
      }
    >
      <FormPessoaRh
        id={id}
        novo
        ehPj
        valores={form}
        onMudar={(p) => setForm((f) => ({ ...f, ...p }))}
        empresa={empresa}
        onEmpresa={setEmpresa}
        setores={setores.data}
        erros={erros}
        onEnviar={criar}
      />
    </Modal>
  );
}

/** A mesma janela parada, para o catálogo, com o dado de quem chama. */
export function NovoPjEstatico({
  valores = FORM_PESSOA_VAZIO,
  empresa = EMPRESAS_RH[0],
  setores,
  erros,
}: {
  valores?: DadosPessoaRh;
  empresa?: EmpresaRh;
  setores: SetorRh[] | undefined;
  erros?: ErrosPessoaRh;
}) {
  return (
    <PainelModal
      estatico
      titulo={TITULO}
      descricao={DESCRICAO}
      onFechar={() => {}}
      rodape={
        <>
          <Botao variante="fantasma">Cancelar</Botao>
          <Botao variante="primario" icone="mais">
            Adicionar
          </Botao>
        </>
      }
    >
      <FormPessoaRh
        novo
        ehPj
        valores={valores}
        onMudar={() => {}}
        empresa={empresa}
        onEmpresa={() => {}}
        setores={setores}
        erros={erros}
      />
    </PainelModal>
  );
}
