"use client";

import { useState } from "react";
import { ProvedorCasca, type DadosCasca } from "@/componentes/casca/casca-cliente";
import { TopoAvulso } from "@/componentes/casca/topo-avulso";
import { Segmentado } from "@/componentes/primitivos/abas";
import { EsqueletoTabela, PainelErro } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { CampoFoto, FOTO_INTACTA, type MudancaFoto } from "@/componentes/produto/admin/campo-foto";
import {
  BotaoVoltar,
  EsqueletoPerfil,
  PainelFotoPerfil,
  PainelSenha,
  PainelSessoes,
} from "@/componentes/produto/admin/perfil";
import {
  FILTRO_USUARIOS_VAZIO,
  filtrarUsuarios,
  FiltrosUsuarios,
  IndicadoresUsuarios,
  opcoesCargoUsuarios,
  TabelaUsuarios,
  UsuarioEstatico,
  VazioUsuarios,
  type FiltroUsuarios,
} from "@/componentes/produto/admin/usuarios";
import type { CargoResumo, UsuarioLista } from "@/lib/admin-tipos";
import { Bloco, Variante } from "../bloco";

/*
 * Peças da Administração › Usuários e do Meu Perfil: a lista de pessoas, a
 * janela da pessoa, o campo de foto, os painéis do perfil e o topo das páginas
 * fora dos módulos. Tudo com dado de mentira; a foto é a marca do NaveX, porque
 * a rota da foto de verdade exige sessão.
 */

const FOTO_FALSA = "/marca/navex-original.png";

/** Fora do componente: a tabela memoriza as colunas por esta função. */
const fotoFalsa = (u: UsuarioLista) => (u.avatarVersao != null ? FOTO_FALSA : null);

const cargo = (
  id: number,
  nome: string,
  setorNome: string | null,
  extra: Partial<CargoResumo> = {}
): CargoResumo => ({
  id,
  nome,
  setorId: setorNome ? id * 10 : null,
  setorNome,
  descricao: null,
  admin: false,
  todasEmpresas: false,
  secoes: 6,
  grupos: 1,
  usuarios: 1,
  ...extra,
});

const CARGOS: CargoResumo[] = [
  cargo(2, "Analista Contábil", "Contábil", { usuarios: 2 }),
  cargo(3, "Coordenador Contábil", "Contábil", { todasEmpresas: true }),
  cargo(5, "Analista de DP", "DP"),
  cargo(4, "Analista Fiscal", "Fiscal", { usuarios: 2 }),
  cargo(6, "Analista de RH", "RH"),
  cargo(1, "Administrador", null, { admin: true, todasEmpresas: true, secoes: 0, grupos: 0 }),
];

const doCargo = (id: number) => {
  const c = CARGOS.find((x) => x.id === id)!;
  return { id: c.id, nome: c.nome, admin: c.admin };
};

const USUARIOS: UsuarioLista[] = [
  {
    id: "u1",
    nome: "Eduardo Lanzarin",
    email: "eduardo.lanzarin@navecon.net.br",
    telefone: "(47) 99911-2233",
    ativo: true,
    cargos: [doCargo(1)],
    admin: true,
    todasEmpresas: true,
    ultimoAcesso: "2026-09-25T08:41:00",
    avatarVersao: 1,
    registros: 4,
  },
  {
    id: "u2",
    nome: "Ana Paula Ribeiro",
    email: "ana.ribeiro@navecon.net.br",
    telefone: null,
    ativo: true,
    cargos: [doCargo(2), doCargo(4)],
    admin: false,
    todasEmpresas: false,
    ultimoAcesso: "2026-09-24T17:12:00",
    avatarVersao: 3,
    registros: 0,
  },
  {
    id: "u3",
    nome: "Bruno Schulz",
    email: "bruno.schulz@navecon.net.br",
    telefone: "(47) 98800-1020",
    ativo: true,
    cargos: [doCargo(3)],
    admin: false,
    todasEmpresas: true,
    ultimoAcesso: "2026-09-22T09:03:00",
    avatarVersao: null,
    registros: 12,
  },
  {
    id: "u4",
    nome: "Carla Mendes",
    email: "carla.mendes@navecon.net.br",
    telefone: null,
    ativo: true,
    cargos: [doCargo(5)],
    admin: false,
    todasEmpresas: false,
    ultimoAcesso: null,
    avatarVersao: null,
    registros: 0,
  },
  {
    id: "u5",
    nome: "Diego Krueger",
    email: "diego.krueger@navecon.net.br",
    telefone: null,
    ativo: false,
    cargos: [doCargo(4)],
    admin: false,
    todasEmpresas: false,
    ultimoAcesso: "2026-05-14T11:30:00",
    avatarVersao: 2,
    registros: 3,
  },
  {
    id: "u6",
    nome: "Fernanda Lopes da Silva Pinheiro",
    email: "fernanda.lopes.pinheiro@navecon.net.br",
    telefone: null,
    ativo: true,
    cargos: [doCargo(6), doCargo(2)],
    admin: false,
    todasEmpresas: false,
    ultimoAcesso: "2026-09-25T07:55:00",
    avatarVersao: null,
    registros: 0,
  },
];

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Erro" },
];

function ListaViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [filtro, setFiltro] = useState<FiltroUsuarios>(FILTRO_USUARIOS_VAZIO);
  const [aberto, setAberto] = useState<string | null>(null);
  const base = estado === "vazio" ? [] : USUARIOS;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS} valor={estado} onMudar={setEstado} rotulo="Estado da lista" />
      </div>
      {estado === "erro" ? (
        <PainelErro
          titulo="Não deu para carregar os usuários"
          mensagem="Banco do app fora do ar."
          onTentar={() => setEstado("dado")}
        />
      ) : (
        <>
          <IndicadoresUsuarios usuarios={estado === "carregando" ? undefined : base} />
          <FiltrosUsuarios filtro={filtro} onMudar={setFiltro} opcoesCargo={opcoesCargoUsuarios(base)} />
          <Painel corpo="p-0" titulo="Pessoas" descricao="Em ordem alfabética">
            {estado === "carregando" ? (
              <EsqueletoTabela colunas={5} linhas={4} />
            ) : (
              <TabelaUsuarios
                usuarios={filtrarUsuarios(base, filtro)}
                onAbrir={(u) => setAberto(u.id)}
                selecionado={aberto}
                alturaMax="22rem"
                fotoDe={fotoFalsa}
                vazio={<VazioUsuarios total={base.length} filtro={filtro} onMudar={setFiltro} onNovo={() => {}} />}
              />
            )}
          </Painel>
        </>
      )}
    </div>
  );
}

function FotoViva({
  nome,
  atual,
  inicial = FOTO_INTACTA,
  erro,
  desabilitado,
}: {
  nome: string;
  atual: string | null;
  inicial?: MudancaFoto | (() => MudancaFoto);
  erro?: string;
  desabilitado?: boolean;
}) {
  const [mudanca, setMudanca] = useState<MudancaFoto>(inicial);
  return (
    <CampoFoto
      nome={nome}
      atual={atual}
      mudanca={mudanca}
      onMudar={setMudanca}
      erroInicial={erro}
      desabilitado={desabilitado}
    />
  );
}

/** Um arquivo de mentira para a prévia: o campo só lê o nome dele. */
const fotoEscolhida = (): MudancaFoto => ({
  arquivo: new File([""], "retrato-2026.jpg", { type: "image/jpeg" }),
  previa: FOTO_FALSA,
  remover: false,
});

const CASCA: DadosCasca = {
  usuario: {
    id: "catalogo",
    nome: "Eduardo Lanzarin",
    email: "eduardo.lanzarin@navecon.net.br",
    admin: true,
    fotoVersao: null,
  },
  acessos: {},
};

const semEscrita = async () => true;

export function BlocosAdminUsuarios() {
  return (
    <>
      <Bloco
        titulo="Usuários"
        porque="O e-mail tem coluna própria para a linha não dobrar, e o inativo fica na lista, esmaecido, porque quem tem registro no sistema só sai desativado."
      >
        <ListaViva />
      </Bloco>

      <Bloco
        titulo="Lista de Usuários Vazia"
        porque="Cadastro vazio ensina a criar, recorte vazio diz qual filtro mudar, e ninguém inativo é resposta boa, com o caminho de volta para todos."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <Variante nome="Cadastro vazio">
            <Painel corpo="p-0">
              <VazioUsuarios total={0} filtro={FILTRO_USUARIOS_VAZIO} onMudar={() => {}} onNovo={() => {}} />
            </Painel>
          </Variante>
          <Variante nome="Busca e cargo sem ninguém">
            <Painel corpo="p-0">
              <VazioUsuarios
                total={6}
                filtro={{ busca: "joão", cargos: ["4"], situacao: "todos" }}
                onMudar={() => {}}
                onNovo={() => {}}
              />
            </Painel>
          </Variante>
          <Variante nome="Nenhum inativo">
            <Painel corpo="p-0">
              <VazioUsuarios
                total={6}
                filtro={{ ...FILTRO_USUARIOS_VAZIO, situacao: "inativos" }}
                onMudar={() => {}}
                onNovo={() => {}}
              />
            </Painel>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Usuário Aberto"
        porque="Criar e editar são a mesma janela sobre a lista, e a saída muda com a pessoa: quem tem registro no sistema ganha Desativar no lugar de Excluir, e quem está logado não se exclui nem se desativa."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <Variante nome="Usuário novo">
            <UsuarioEstatico cargos={CARGOS} />
          </Variante>
          <Variante nome="Editando, com foto">
            <UsuarioEstatico usuario={USUARIOS[1]} cargos={CARGOS} fotoAtual={FOTO_FALSA} />
          </Variante>
          <Variante nome="Com registros no sistema: desativar em vez de excluir">
            <UsuarioEstatico usuario={USUARIOS[2]} cargos={CARGOS} />
          </Variante>
          <Variante nome="Exclusão esperando o segundo clique">
            <UsuarioEstatico usuario={USUARIOS[3]} cargos={CARGOS} confirmandoInicial />
          </Variante>
          <Variante nome="O próprio usuário">
            <UsuarioEstatico usuario={USUARIOS[0]} cargos={CARGOS} fotoAtual={FOTO_FALSA} proprio />
          </Variante>
          <Variante nome="Nenhum cargo cadastrado">
            <UsuarioEstatico cargos={[]} />
          </Variante>
          <Variante nome="Cargos chegando">
            <UsuarioEstatico usuario={USUARIOS[5]} />
          </Variante>
          <Variante nome="Cargos com erro">
            <UsuarioEstatico usuario={USUARIOS[5]} erroCargos="Banco do app fora do ar." />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Campo de Foto"
        porque="A peça só guarda o pedido (foto nova ou remoção) e quem grava é a tela, porque o usuário novo só tem id para receber a foto depois de criado; o arquivo errado já é recusado na escolha."
      >
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Variante nome="Sem foto">
            <FotoViva nome="Carla Mendes" atual={null} />
          </Variante>
          <Variante nome="Com foto">
            <FotoViva nome="Ana Paula Ribeiro" atual={FOTO_FALSA} />
          </Variante>
          <Variante nome="Foto nova escolhida, com prévia">
            <FotoViva nome="Carla Mendes" atual={null} inicial={fotoEscolhida} />
          </Variante>
          <Variante nome="Remoção pedida">
            <FotoViva nome="Ana Paula Ribeiro" atual={FOTO_FALSA} inicial={{ ...FOTO_INTACTA, remover: true }} />
          </Variante>
          <Variante nome="Arquivo recusado">
            <FotoViva nome="Ana Paula Ribeiro" atual={FOTO_FALSA} erro="A foto passa de 2 MB" />
          </Variante>
          <Variante nome="Salvando">
            <FotoViva nome="Carla Mendes" atual={null} inicial={fotoEscolhida} desabilitado />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Meu Perfil"
        porque="Cada painel é um formulário à parte, então trocar a foto não passa pela senha, e o salvar da foto só aparece com uma troca pedida."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <Variante nome="Voltar e foto com dados">
            <div className="flex flex-col gap-3">
              <BotaoVoltar />
              <PainelFotoPerfil
                nome="Eduardo Lanzarin"
                email="eduardo.lanzarin@navecon.net.br"
                foto={FOTO_FALSA}
                onSalvar={semEscrita}
              />
            </div>
          </Variante>
          <Variante nome="Foto nova esperando o salvar">
            <PainelFotoPerfil
              nome="Carla Mendes"
              email="carla.mendes@navecon.net.br"
              foto={null}
              onSalvar={semEscrita}
              mudancaInicial={fotoEscolhida()}
            />
          </Variante>
          <Variante nome="Senha vazia">
            <PainelSenha onTrocar={semEscrita} />
          </Variante>
          <Variante nome="Confirmação que não bate">
            <PainelSenha onTrocar={semEscrita} inicial={{ atual: "senha-antiga", nova: "nova-senha-1", confirma: "nova-senha-2" }} />
          </Variante>
          <Variante nome="Só este dispositivo">
            <PainelSessoes sessoes={1} onEncerrar={async () => {}} />
          </Variante>
          <Variante nome="Outros dispositivos conectados">
            <PainelSessoes sessoes={3} onEncerrar={async () => {}} />
          </Variante>
          <Variante nome="Carregando">
            <EsqueletoPerfil />
          </Variante>
          <Variante nome="Erro">
            <PainelErro
              titulo="Não deu para carregar o seu perfil"
              mensagem="Sua sessão expirou. Entre de novo."
              onTentar={() => {}}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Topo Avulso"
        porque="O início e o Meu Perfil ficam fora dos módulos e dividem o mesmo topo: a assinatura leva ao início, como a da barra lateral, e o menu da pessoa segue no canto, para a página sem barra lateral não ficar sem saída."
      >
        <ProvedorCasca dados={CASCA}>
          <div className="rounded-painel border border-dashed border-linha-forte px-4 sm:px-8">
            <TopoAvulso semPaleta />
          </div>
        </ProvedorCasca>
      </Bloco>
    </>
  );
}
