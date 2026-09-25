"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import {
  BarraSalvarCargo,
  CampoSetorCargo,
  ExcluirCargoEstatico,
  FormularioCargo,
  ListaGruposCargo,
  TabelaCargos,
  mesmoCargo,
  type RascunhoCargo,
} from "@/componentes/produto/admin/cargos";
import {
  GrupoPermissaoEstatico,
  TabelaGruposPermissao,
} from "@/componentes/produto/admin/grupos-permissao";
import { CHAVES_CONCEDIVEIS, MatrizPermissoes } from "@/componentes/produto/admin/matriz-permissoes";
import type { RascunhoGrupo } from "@/componentes/produto/config/grupos-empresa";
import type { CargoResumo, GrupoPermissaoResumo, SetorResumo } from "@/lib/admin-tipos";
import type { ModoGrupo } from "@/lib/grupo-modo";
import { Bloco, Variante } from "../bloco";
import { EMPRESAS_FALSAS } from "../dados-falsos";

/*
 * Peças da Administração que decidem o acesso: a lista de cargos, a matriz de
 * permissões (com o catálogo real de seções), o cargo aberto e os grupos de
 * permissão. Tudo com dado de mentira e sem gravar nada.
 */

const SETORES: SetorResumo[] = [
  { id: 1, nome: "Contábil", cargos: 2 },
  { id: 3, nome: "Departamento Pessoal", cargos: 1 },
  { id: 4, nome: "Diretoria", cargos: 1 },
  { id: 2, nome: "Fiscal", cargos: 1 },
];

const CARGOS: CargoResumo[] = [
  {
    id: 2,
    nome: "Analista Contábil",
    setorId: 1,
    setorNome: "Contábil",
    descricao: null,
    admin: false,
    todasEmpresas: false,
    secoes: 11,
    grupos: 2,
    usuarios: 9,
  },
  {
    id: 3,
    nome: "Coordenador Contábil",
    setorId: 1,
    setorNome: "Contábil",
    descricao: "Acompanha a equipe inteira",
    admin: false,
    todasEmpresas: true,
    secoes: 16,
    grupos: 0,
    usuarios: 2,
  },
  {
    id: 5,
    nome: "Analista de Departamento Pessoal e Folha de Pagamento",
    setorId: 3,
    setorNome: "Departamento Pessoal",
    descricao: null,
    admin: false,
    todasEmpresas: false,
    secoes: 10,
    grupos: 2,
    usuarios: 5,
  },
  {
    id: 1,
    nome: "Administrador",
    setorId: 4,
    setorNome: "Diretoria",
    descricao: "Sócios e TI",
    admin: true,
    todasEmpresas: true,
    secoes: 0,
    grupos: 0,
    usuarios: 3,
  },
  {
    id: 4,
    nome: "Analista Fiscal",
    setorId: 2,
    setorNome: "Fiscal",
    descricao: null,
    admin: false,
    todasEmpresas: false,
    secoes: 8,
    grupos: 1,
    usuarios: 7,
  },
  {
    id: 6,
    nome: "Estagiário",
    setorId: null,
    setorNome: null,
    descricao: null,
    admin: false,
    todasEmpresas: false,
    secoes: 3,
    grupos: 1,
    usuarios: 0,
  },
];

const GRUPOS: GrupoPermissaoResumo[] = [
  {
    id: 1,
    nome: "Carteira Norte",
    modo: "lista",
    empresas: 212,
    marcadas: 212,
    cargos: 3,
    usuarios: 11,
    atualizadoEm: "2026-09-10T14:20:00",
  },
  {
    id: 2,
    nome: "Carteira Sul",
    modo: "lista",
    empresas: 187,
    marcadas: 187,
    cargos: 2,
    usuarios: 9,
    atualizadoEm: "2026-08-28T09:45:00",
  },
  {
    id: 3,
    nome: "Clientes encerrados em 2025",
    modo: "lista",
    empresas: 0,
    marcadas: 2,
    cargos: 0,
    usuarios: 0,
    atualizadoEm: "2026-05-02T11:00:00",
  },
  {
    id: 4,
    nome: "Todas menos NAVECON",
    modo: "exceto",
    empresas: 1491,
    marcadas: 3,
    cargos: 1,
    usuarios: 2,
    atualizadoEm: "2026-09-02T08:30:00",
  },
];

// Lidas do catálogo real: seção nova ou renomeada não quebra o exemplo.
const SECOES_ANALISTA = [
  ...CHAVES_CONCEDIVEIS.filter((k) => k.startsWith("contabil/")).slice(0, 7),
  ...CHAVES_CONCEDIVEIS.filter((k) => k.startsWith("fiscal/")).slice(0, 2),
];

const RASCUNHO_ANALISTA: RascunhoCargo = {
  nome: "Analista Contábil",
  setorId: 1,
  setorNovo: null,
  descricao: "",
  admin: false,
  todasEmpresas: false,
  secoes: new Set(SECOES_ANALISTA),
  grupos: new Set([1, 2]),
};

const RASCUNHO_ADMIN: RascunhoCargo = {
  nome: "Administrador",
  setorId: 4,
  setorNovo: null,
  descricao: "Sócios e TI",
  admin: true,
  todasEmpresas: true,
  secoes: new Set(),
  grupos: new Set(),
};

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Erro" },
];

function TabelaCargosViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS} valor={estado} onMudar={setEstado} rotulo="Estado da tabela" />
      </div>
      <Painel corpo="p-0" titulo="Cargos" descricao="Por setor, em ordem alfabética">
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={5} linhas={5} />
        ) : estado === "erro" ? (
          <div className="p-4">
            <PainelErro
              titulo="Não deu para carregar os cargos"
              mensagem="Banco do app fora do ar."
              onTentar={() => setEstado("dado")}
            />
          </div>
        ) : (
          <TabelaCargos
            cargos={estado === "vazio" ? [] : CARGOS}
            onAbrir={() => {}}
            alturaMax="22rem"
            vazio={
              <Vazio
                icone="chave"
                titulo="Nenhum cargo cadastrado"
                descricao="O cargo diz que seções e que empresas a pessoa vê. Crie o primeiro e atribua em Usuários."
                acao={
                  <Botao variante="primario" icone="mais">
                    Criar cargo
                  </Botao>
                }
              />
            }
          />
        )}
      </Painel>
    </div>
  );
}

function MatrizViva({ inicial, busca }: { inicial: string[]; busca?: string }) {
  const [marcadas, setMarcadas] = useState(() => new Set(inicial));
  return (
    <Painel corpo="p-0" titulo="Permissões por Seção" descricao="As seções que o cargo abre em cada módulo">
      <MatrizPermissoes marcadas={marcadas} onMudar={setMarcadas} buscaInicial={busca} />
    </Painel>
  );
}

function SetorVivo({
  setorId = null,
  setorNovo = null,
  carregando,
  erro,
}: {
  setorId?: number | null;
  setorNovo?: string | null;
  carregando?: boolean;
  erro?: string;
}) {
  const [v, setV] = useState({ setorId, setorNovo });
  return (
    <CampoSetorCargo
      setorId={v.setorId}
      setorNovo={v.setorNovo}
      onMudar={setV}
      setores={carregando || erro ? undefined : SETORES}
      carregando={carregando}
      erro={erro}
    />
  );
}

function GruposCargoVivo({ estado }: { estado: Estado }) {
  const [marcados, setMarcados] = useState(() => new Set([1, 4]));
  return (
    <ListaGruposCargo
      grupos={estado === "vazio" ? [] : estado === "dado" ? GRUPOS : undefined}
      marcados={marcados}
      onMudar={setMarcados}
      carregando={estado === "carregando"}
      erro={estado === "erro" ? "Banco do app fora do ar." : undefined}
      onTentar={() => {}}
    />
  );
}

function CargoVivo({ inicial, titulo, descricao }: { inicial: RascunhoCargo; titulo: string; descricao: string }) {
  const [rascunho, setRascunho] = useState(inicial);
  return (
    <div className="flex flex-col gap-4">
      <FormularioCargo
        rascunho={rascunho}
        onMudar={setRascunho}
        titulo={titulo}
        descricao={descricao}
        setores={{ dados: SETORES }}
        grupos={{ dados: GRUPOS }}
      />
      <BarraSalvarCargo
        estatico
        novo={false}
        sujo={!mesmoCargo(rascunho, inicial)}
        onSalvar={() => setRascunho(inicial)}
        onExcluir={() => {}}
      />
    </div>
  );
}

function TabelaGruposViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS} valor={estado} onMudar={setEstado} rotulo="Estado da tabela" />
      </div>
      <Painel corpo="p-0" titulo="Grupos" descricao="Em ordem alfabética">
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={5} linhas={4} />
        ) : estado === "erro" ? (
          <div className="p-4">
            <PainelErro
              titulo="Não deu para carregar os grupos de permissão"
              mensagem="Banco do app fora do ar."
              onTentar={() => setEstado("dado")}
            />
          </div>
        ) : (
          <TabelaGruposPermissao
            grupos={estado === "vazio" ? [] : GRUPOS}
            onAbrir={(g) => setAberto(g.id)}
            selecionado={aberto}
            alturaMax="20rem"
            vazio={
              <Vazio
                icone="empresa"
                titulo="Nenhum grupo de permissão"
                descricao="Junte as empresas de uma carteira num grupo e marque o grupo nos cargos que devem enxergá-las."
                acao={
                  <Botao variante="primario" icone="mais">
                    Criar grupo
                  </Botao>
                }
              />
            }
          />
        )}
      </Painel>
    </div>
  );
}

const rascunhoGrupo = (nome: string, modo: ModoGrupo, marcadas: number[]): RascunhoGrupo => ({
  nome,
  modo,
  marcadas: new Set(marcadas),
});

export function BlocosAdminCargos() {
  const [estadoGrupos, setEstadoGrupos] = useState<Estado>("dado");
  return (
    <>
      <Bloco
        titulo="Cargos"
        porque="A linha diz o que o cargo libera sem abrir. Acesso total grava as listas de seções e de grupos vazias, então a linha mostra Todas e o selo em vez de um zero que mentiria; o cargo que vê todas as empresas leva o próprio selo, porque ali os grupos não mudam nada."
      >
        <TabelaCargosViva />
      </Bloco>

      <Bloco
        titulo="Matriz de Permissões"
        porque="Uma caixa por seção, lida do mesmo catálogo que desenha a barra lateral: seção nova aparece aqui sem mexer na tela, e a Administração fica de fora porque nenhum cargo a concede. Marcar em lote vale para o que está na tela: sem busca é o módulo inteiro; com busca, só as achadas, e é assim que se libera o Post Mortem de todos os módulos de uma vez. A contagem do módulo é sempre a dele inteiro."
      >
        <div className="flex flex-col gap-5">
          <Variante nome="O catálogo real, com algumas marcadas (experimente marcar um módulo)">
            <MatrizViva inicial={SECOES_ANALISTA} />
          </Variante>
          <div className="grid gap-5 xl:grid-cols-2">
            <Variante nome="Buscando: o lote vale para as achadas">
              <MatrizViva inicial={SECOES_ANALISTA} busca="post mortem" />
            </Variante>
            <Variante nome="Busca sem resultado">
              <MatrizViva inicial={[]} busca="imposto de renda" />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Setor do Cargo"
        porque="Não há combo que aceite texto livre, então Criar setor troca a lista por um campo, e o X volta para a lista com a escolha de antes. O setor digitado nasce quando o cargo é salvo; se o nome já existe (sem diferenciar maiúscula) o servidor reaproveita, e o campo avisa antes."
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Variante nome="Escolhendo da lista">
            <SetorVivo setorId={1} />
          </Variante>
          <Variante nome="Digitando um setor novo">
            <SetorVivo setorId={1} setorNovo="Societário" />
          </Variante>
          <Variante nome="Digitando um que já existe">
            <SetorVivo setorNovo="fiscal" />
          </Variante>
          <Variante nome="Setores carregando">
            <SetorVivo carregando />
          </Variante>
          <Variante nome="Setores com erro">
            <SetorVivo erro="Não deu para carregar os setores" />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Grupos do Cargo"
        porque="Cada grupo diz quantas empresas traz, e o de modo Todas, exceto diz quantas deixa de fora, que é o que decide marcar. Grupo sem empresa aparece em cor de atenção: marcado, não dá acesso a nada. Sem grupo cadastrado, o vazio leva ao cadastro."
      >
        <div className="flex flex-col gap-3">
          <div>
            <Segmentado opcoes={ESTADOS} valor={estadoGrupos} onMudar={setEstadoGrupos} rotulo="Estado da lista" />
          </div>
          <Painel titulo="Grupos de Permissão" descricao="2 grupos marcados" className="max-w-3xl">
            <GruposCargoVivo key={estadoGrupos} estado={estadoGrupos} />
          </Painel>
        </div>
      </Bloco>

      <Bloco
        titulo="Cargo Aberto"
        porque="Página e não janela: a matriz passa de cinquenta seções. Com acesso total, grupos e matriz somem (o servidor grava as listas vazias) e uma linha diz que o cargo entra em tudo. Vê todas as empresas fica marcado e parado quando há acesso total, que já o implica."
      >
        <div className="flex flex-col gap-8">
          <Variante nome="Cargo comum (mexa para ver a barra acusar a alteração)">
            <CargoVivo
              inicial={RASCUNHO_ANALISTA}
              titulo="Analista Contábil"
              descricao="9 pessoas têm este cargo"
            />
          </Variante>
          <Variante nome="Acesso total">
            <CargoVivo inicial={RASCUNHO_ADMIN} titulo="Administrador" descricao="3 pessoas têm este cargo" />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Barra do Cargo"
        porque="Presa ao pé da janela, porque o Salvar no alto ficaria longe de quem marcou a última seção da matriz. Ela diz se há alteração não salva e guarda a recusa do servidor (nome em uso, sem administrador ativo) até a próxima mudança, porque a torrada some."
      >
        <div className="flex flex-col gap-3">
          <Variante nome="Cargo novo">
            <BarraSalvarCargo estatico novo sujo onSalvar={() => {}} />
          </Variante>
          <Variante nome="Sem alteração">
            <BarraSalvarCargo estatico novo={false} sujo={false} onSalvar={() => {}} onExcluir={() => {}} />
          </Variante>
          <Variante nome="Com alteração">
            <BarraSalvarCargo estatico novo={false} sujo onSalvar={() => {}} onExcluir={() => {}} />
          </Variante>
          <Variante nome="Salvando">
            <BarraSalvarCargo estatico novo={false} sujo salvando onSalvar={() => {}} onExcluir={() => {}} />
          </Variante>
          <Variante nome="Recusado pelo servidor">
            <BarraSalvarCargo
              estatico
              novo={false}
              sujo
              erro="Ninguém mais ficaria com acesso total. Mantenha ao menos um administrador ativo."
              onSalvar={() => {}}
              onExcluir={() => {}}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Excluir Cargo"
        porque="A confirmação diz quantas pessoas perdem o cargo, e quem só tinha ele fica sem acesso a nada até receber outro. A recusa do servidor (o último administrador ativo) aparece na própria janela."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <Variante nome="Com pessoas">
            <ExcluirCargoEstatico cargo={{ nome: "Analista Fiscal", usuarios: 7 }} />
          </Variante>
          <Variante nome="Sem ninguém">
            <ExcluirCargoEstatico cargo={{ nome: "Estagiário", usuarios: 0 }} />
          </Variante>
          <Variante nome="Recusado">
            <ExcluirCargoEstatico
              cargo={{ nome: "Administrador", usuarios: 1 }}
              erro="Ninguém mais ficaria com acesso total. Mantenha ao menos um administrador ativo."
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Grupos de Permissão"
        porque="A mesma lista dos Grupos de Empresa das Configurações, com outro cadastro ligado e duas colunas de uso: quantos cargos marcam o grupo e quantas pessoas enxergam por ele. O selo Sem empresa marca o grupo que não dá acesso a nada."
      >
        <TabelaGruposViva />
      </Bloco>

      <Bloco
        titulo="Grupo de Permissão Aberto"
        porque="A janela dos Grupos de Empresa com as rotas, o cache e os textos da Administração. A remoção não tem trava (só os cargos apontam para o grupo, e o vínculo cai junto), e a confirmação diz quantos cargos deixam de enxergar as empresas dele."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <Variante nome="Grupo novo">
            <GrupoPermissaoEstatico inicial={rascunhoGrupo("", "lista", [])} empresas={EMPRESAS_FALSAS} />
          </Variante>
          <Variante nome="Remoção esperando o segundo clique">
            <GrupoPermissaoEstatico
              grupo={GRUPOS[1]}
              inicial={rascunhoGrupo("Carteira Sul", "lista", [1318, 1402, 1455, 1633])}
              empresas={EMPRESAS_FALSAS}
              confirmandoInicial
            />
          </Variante>
          <Variante nome="Empresas do Questor ainda chegando">
            <GrupoPermissaoEstatico
              grupo={GRUPOS[3]}
              inicial={rascunhoGrupo("Todas menos NAVECON", "exceto", [1200, 1455, 1633])}
              empresas={[]}
              carregando
            />
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
