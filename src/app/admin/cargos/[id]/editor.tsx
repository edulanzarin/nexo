"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { BotaoLink } from "@/componentes/primitivos/botao";
import { Esqueleto, PainelErro } from "@/componentes/primitivos/estados";
import {
  BarraSalvarCargo,
  FormularioCargo,
  ModalExcluirCargo,
  dadosDoRascunho,
  invalidarAposCargo,
  mesmoCargo,
  rascunhoCargoVazio,
  rascunhoDoCargo,
  type RascunhoCargo,
} from "@/componentes/produto/admin/cargos";
import { ModalAvisoSaida, useAvisoSaida } from "@/componentes/produto/rh/formulario-aviso-saida";
import { mutar } from "@/hooks/mutar";
import { CHAVES_ADMIN, useGruposPermissao, useSetoresAdmin } from "@/hooks/use-admin";
import { buscarJson } from "@/hooks/use-consulta";
import type { CargoDetalhe } from "@/lib/admin-tipos";
import { num } from "@/lib/format";

/**
 * O cargo aberto (`/admin/cargos/12`) ou um novo (`/admin/cargos/novo`). É uma
 * página e não uma janela: a matriz de permissões tem dezenas de seções.
 */
export default function EditorCargo({ id }: { id: number | null }) {
  // Sem cache entre aberturas: o rascunho nasce do cargo como está gravado
  // agora, e a volta à janela do navegador não relê por cima do que se edita.
  const detalhe = useQuery<CargoDetalhe>({
    queryKey: [CHAVES_ADMIN.cargo, id],
    queryFn: () => buscarJson<CargoDetalhe>(`/api/admin/cargos/${id}`),
    enabled: id != null,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (id != null && detalhe.isError && !detalhe.data)
    return (
      <>
        <Voltar />
        <PainelErro
          titulo="Não deu para abrir o cargo"
          mensagem={(detalhe.error as Error).message}
          onTentar={() => detalhe.refetch()}
        />
      </>
    );

  if (id != null && !detalhe.data)
    return (
      <div aria-busy className="flex flex-col gap-4">
        <Esqueleto className="h-controle w-24" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Esqueleto className="h-72 w-full rounded-painel" />
          <Esqueleto className="h-72 w-full rounded-painel" />
        </div>
        <Esqueleto className="h-[28rem] w-full rounded-painel" />
      </div>
    );

  return <Editor key={id ?? "novo"} cargo={detalhe.data ?? null} />;
}

function Voltar() {
  return (
    <BotaoLink href="/admin/cargos" variante="fantasma" icone="seta-esquerda" className="-ml-1.5 self-start">
      Cargos
    </BotaoLink>
  );
}

function Editor({ cargo }: { cargo: CargoDetalhe | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const idNome = useId();
  const setores = useSetoresAdmin();
  const grupos = useGruposPermissao();

  const novo = cargo == null;
  // O gravado: base do "alterações não salvas".
  const [inicial] = useState<RascunhoCargo>(() => (cargo ? rascunhoDoCargo(cargo) : rascunhoCargoVazio()));
  const [rascunho, setRascunho] = useState(inicial);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluir, setExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const sujo = !mesmoCargo(rascunho, inicial);
  const saida = useAvisoSaida(sujo);
  const erroNome = tentou && !rascunho.nome.trim() ? "Dê um nome ao cargo" : undefined;

  function mudar(r: RascunhoCargo) {
    setRascunho(r);
    setErro(null);
  }

  async function salvar() {
    const dados = dadosDoRascunho(rascunho);
    if (!dados.nome) {
      setTentou(true);
      document.getElementById(idNome)?.focus();
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (cargo) await mutar(`/api/admin/cargos/${cargo.id}`, "PATCH", dados);
      else await mutar<{ id: number }>("/api/admin/cargos", "POST", dados);
      await invalidarAposCargo(qc);
      avisar.ok(novo ? "Cargo criado" : "Cargo salvo", dados.nome);
      // Segue "salvando" até a lista montar: um segundo clique criaria outro cargo.
      router.push("/admin/cargos");
    } catch (e) {
      const mensagem = (e as Error).message;
      setErro(mensagem);
      avisar.erro(novo ? "Não deu para criar o cargo" : "Não deu para salvar o cargo", mensagem);
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!cargo) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await mutar(`/api/admin/cargos/${cargo.id}`, "DELETE");
      await invalidarAposCargo(qc);
      avisar.ok("Cargo excluído", cargo.nome);
      router.push("/admin/cargos");
    } catch (e) {
      const mensagem = (e as Error).message;
      setErroExclusao(mensagem);
      avisar.erro("Não deu para excluir o cargo", mensagem);
      setExcluindo(false);
    }
  }

  return (
    <>
      <Voltar />

      <FormularioCargo
        rascunho={rascunho}
        onMudar={mudar}
        titulo={cargo ? cargo.nome : rascunho.nome.trim() || "Novo Cargo"}
        descricao={
          cargo
            ? cargo.usuarios
              ? `${num(cargo.usuarios)} ${cargo.usuarios === 1 ? "pessoa tem" : "pessoas têm"} este cargo`
              : "Ninguém tem este cargo ainda"
            : "Depois de criar, atribua o cargo em Usuários"
        }
        idNome={idNome}
        erroNome={erroNome}
        setores={{
          dados: setores.data,
          carregando: setores.isPending,
          erro: setores.isError && !setores.data ? "Não deu para carregar os setores" : undefined,
        }}
        grupos={{
          dados: grupos.data,
          carregando: grupos.isPending,
          erro: grupos.isError && !grupos.data ? (grupos.error as Error).message : undefined,
          onTentar: () => grupos.refetch(),
        }}
      />

      <BarraSalvarCargo
        novo={novo}
        sujo={sujo}
        salvando={salvando}
        erro={erro}
        onSalvar={salvar}
        onExcluir={
          cargo
            ? () => {
                setErroExclusao(null);
                setExcluir(true);
              }
            : undefined
        }
      />

      {cargo && (
        <ModalExcluirCargo
          cargo={cargo}
          aberto={excluir}
          excluindo={excluindo}
          erro={erroExclusao}
          onFechar={() => !excluindo && setExcluir(false)}
          onConfirmar={confirmarExclusao}
        />
      )}
      <ModalAvisoSaida
        aberto={saida.destino != null}
        onFicar={saida.ficar}
        onSair={saida.sair}
        texto="As alterações deste cargo ainda não foram salvas e vão se perder."
      />
    </>
  );
}
