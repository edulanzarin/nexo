"use client";

import { Painel } from "@/componentes/primitivos/painel";
import { CelulaEquipamento, CelulaPosse, HistoricoPosse, Patrimonio } from "@/componentes/produto/ti/equipamento";
import {
  FichaEquipamentoCarregando,
  FichaEquipamentoEstatica,
} from "@/componentes/produto/ti/ficha-equipamento";
import { EquipamentoEstatico } from "@/componentes/produto/ti/formulario-equipamento";
import { MovimentarEstatico } from "@/componentes/produto/ti/movimentar";
import { ChipsEquipamentos, PessoaTiEstatica } from "@/componentes/produto/ti/pessoa-equipamentos";
import { CampoRecebedor, ExternoEstatico } from "@/componentes/produto/ti/recebedor";
import { ListaUrgencias } from "@/componentes/produto/folha/pendencias-dp";
import { CelulaAcesso, HistoricoAcesso, Segredo, TextoCopiavel } from "@/componentes/produto/ti/acesso";
import { FichaAcessoCarregando, FichaAcessoEstatica } from "@/componentes/produto/ti/ficha-acesso";
import { AcessoEstatico } from "@/componentes/produto/ti/formulario-acesso";
import { AtividadeRecenteTi, InventarioPorTipo, itemPendenciaTi } from "@/componentes/produto/ti/painel-ti";
import {
  enderecoAcesso,
  textoQrWifi,
  usuarioAcesso,
  type AcessoDetalhe,
  type AcessoLista,
  type EventoAcesso,
} from "@/lib/ti-acessos-tipos";
import type { AtividadeTi, PendenciaTi } from "@/lib/ti-painel-tipos";
import type {
  EquipamentoDetalhe,
  EquipamentoLista,
  MovimentacaoLista,
  PessoaExterna,
  PessoaTi,
  Posse,
} from "@/lib/ti-tipos";
import { Bloco, Variante } from "../bloco";

/*
 * Peças do módulo TI, nascidas nos Equipamentos. Dado de mentira: nenhum nome
 * aqui é de gente da Navecon.
 */

const ANA: Posse = { destino: "pessoa", empresa: 1, contrato: 184, nome: "ANA PAULA RIBEIRO", setor: "Contábil" };
const JOAO: Posse = { destino: "pessoa", empresa: 1, contrato: 97, nome: "JOAO PEDRO ALVES", setor: "Fiscal" };
const BRUNO: Posse = { destino: "pessoa", empresa: 888, contrato: 42, nome: "BRUNO SCHULZ", setor: "DP" };
const ESTOQUE: Posse = { destino: "estoque" };
const CARLOS: Posse = { destino: "externo", id: 3, nome: "CARLOS MENDES", vinculo: "Limpa Tudo Terceirizada" };

const EXTERNOS: PessoaExterna[] = [
  { id: 3, nome: "CARLOS MENDES", vinculo: "Limpa Tudo Terceirizada", documento: null, contato: "(47) 99999-1234", observacao: null, ativo: true },
  { id: 4, nome: "LUCAS PEREIRA", vinculo: "Estagiário", documento: null, contato: null, observacao: null, ativo: true },
  { id: 5, nome: "PAULO SOUZA", vinculo: "Vigia Sul Segurança", documento: null, contato: null, observacao: "Contrato encerrado em agosto", ativo: false },
];

const PESSOAS: PessoaTi[] = [
  { empresa: 1, contrato: 184, nome: "ANA PAULA RIBEIRO", setor: "Contábil", cargo: "Analista contábil" },
  { empresa: 1, contrato: 97, nome: "JOAO PEDRO ALVES", setor: "Fiscal", cargo: "Assistente fiscal" },
  { empresa: 1, contrato: 211, nome: "MARIANA COSTA", setor: "RH", cargo: "Analista de RH" },
];

const base = {
  numeroSerie: null,
  dataCompra: null,
  valorCompra: null,
  fornecedor: null,
  notaFiscal: null,
  garantiaAte: null,
  observacoes: null,
  movimentacoes: 2,
};

const EQUIPAMENTOS: EquipamentoLista[] = [
  {
    ...base,
    id: 12,
    tipo: "notebook",
    patrimonio: "NVC-012",
    marca: "Dell",
    modelo: "Latitude 3420",
    numeroSerie: "7H2KQ53",
    especificacoes: { processador: "Core i5-1135G7", memoria: "16 GB", armazenamento: "SSD 256 GB", sistema: "Windows 11 Pro", hostname: "NVC-NB-012" },
    posse: ANA,
    desde: "2026-03-02",
    movimentacoes: 5,
  },
  { ...base, id: 31, tipo: "monitor", patrimonio: "NVC-031", marca: "LG", modelo: "24MK430H", especificacoes: { tela: '24" Full HD', conexoes: "HDMI, VGA" }, posse: ANA, desde: "2026-03-02" },
  { ...base, id: 40, tipo: "mouse", patrimonio: null, marca: "Logitech", modelo: "M280", especificacoes: { conexao: "Sem fio" }, posse: ANA, desde: "2026-03-02" },
  { ...base, id: 41, tipo: "headset", patrimonio: null, marca: "Logitech", modelo: "H390", especificacoes: { conexao: "USB" }, posse: ANA, desde: "2026-03-02" },
  { ...base, id: 15, tipo: "notebook", patrimonio: "NVC-015", marca: "Lenovo", modelo: "ThinkPad E14", especificacoes: { processador: "Ryzen 5 5500U", memoria: "8 GB", armazenamento: "SSD 512 GB" }, posse: ESTOQUE, desde: "2026-08-14", movimentacoes: 1 },
  { ...base, id: 9, tipo: "notebook", patrimonio: "NVC-009", marca: "Dell", modelo: "Vostro 3510", especificacoes: { processador: "Core i3-1115G4", memoria: "8 GB" }, posse: BRUNO, desde: "2025-06-10" },
  { ...base, id: 50, tipo: "impressora", patrimonio: "NVC-050", marca: "HP", modelo: "LaserJet M428", especificacoes: {}, posse: { destino: "local", local: "Recepção" }, desde: "2025-01-08" },
  { ...base, id: 18, tipo: "notebook", patrimonio: "NVC-018", marca: "Acer", modelo: "Aspire 5", especificacoes: { memoria: "8 GB" }, posse: { destino: "manutencao", local: "Dell Suporte" }, desde: "2026-09-18" },
  { ...base, id: 21, tipo: "celular", patrimonio: "NVC-021", marca: "Samsung", modelo: "Galaxy A34", especificacoes: { armazenamento: "128 GB" }, posse: { destino: "baixa", motivo: "roubo" }, desde: "2026-05-30" },
];

const mov = (id: number, posse: Posse, anterior: Posse | null, data: string, extra: Partial<MovimentacaoLista> = {}) => ({
  id,
  equipamentoId: 12,
  posse,
  anterior,
  data,
  observacao: null,
  registradoPor: "Diego Moretti",
  registradoEm: `${data}T10:14:00`,
  ...extra,
});

const HISTORICO = [
  mov(5, ANA, ESTOQUE, "2026-03-02", { observacao: "Kit completo: notebook, monitor, mouse e headset." }),
  mov(4, ESTOQUE, { destino: "manutencao", local: "Dell Suporte" }, "2026-02-05"),
  mov(3, { destino: "manutencao", local: "Dell Suporte" }, JOAO, "2026-01-20", { observacao: "Teclado falhando. Chamado 4812." }),
  mov(2, JOAO, ESTOQUE, "2024-02-12"),
  mov(1, ESTOQUE, null, "2024-02-10"),
];

const FICHA: EquipamentoDetalhe = {
  ...EQUIPAMENTOS[0],
  dataCompra: "2024-02-01",
  valorCompra: 4870,
  fornecedor: "Dell Computadores do Brasil",
  notaFiscal: "001.284.551",
  garantiaAte: "2027-02-01",
  observacoes: "Carregador original e capa.",
  historico: HISTORICO,
  criadoEm: "2024-02-10T10:14:00",
  atualizadoEm: "2026-03-02T10:14:00",
};

const NOTEBOOK_EQ = { ...EQUIPAMENTOS[0] };
const MOVS_ANA: MovimentacaoLista[] = HISTORICO.map((m) => ({ ...m, equipamento: NOTEBOOK_EQ }));

// ── Acessos (IPs e endereços de exemplo, nenhum é da Navecon) ─────────────────

const acesso = (a: Partial<AcessoLista> & Pick<AcessoLista, "id" | "tipo" | "nome">): AcessoLista => ({
  grupo: null,
  campos: {},
  segredos: {},
  outraChave: [],
  observacoes: null,
  equipamento: null,
  atualizadoEm: "2026-09-20T11:02:00",
  ...a,
});

const ACESSOS: AcessoLista[] = [
  acesso({
    id: 7,
    tipo: "wifi",
    nome: "Wi-Fi dos Visitantes",
    grupo: "Matriz",
    campos: { ssid: "ESCRITORIO-VISITA", seguranca: "WPA2" },
    segredos: { senha: "2026-08-12T09:30:00" },
    observacoes: "Trocar a senha a cada trimestre.",
    equipamento: { id: 60, tipo: "rede", nome: "Rede TP-Link Archer AX55", patrimonio: "NVC-060" },
  }),
  acesso({
    id: 8,
    tipo: "banco",
    nome: "Banco do sistema interno",
    grupo: "Servidor",
    campos: { sgbd: "PostgreSQL", host: "192.168.0.10", porta: "5432", base: "sistema", usuario: "sistema" },
    segredos: { senha: "2024-05-03T14:10:00" },
  }),
  acesso({
    id: 9,
    tipo: "remoto",
    nome: "Servidor do escritório",
    grupo: "Servidor",
    campos: { ferramenta: "Área de Trabalho Remota (RDP)", host: "192.168.0.10", porta: "3389", dominio: "ESCRITORIO", usuario: "administrador" },
    segredos: { senha: "2026-06-30T08:05:00" },
  }),
  acesso({
    id: 10,
    tipo: "site",
    nome: "Portal da operadora de internet",
    grupo: "Fornecedores",
    campos: { url: "https://minhaconta.operadora.com.br", usuario: "financeiro@exemplo.com.br" },
  }),
  acesso({
    id: 11,
    tipo: "vpn",
    nome: "VPN da filial",
    grupo: "Filial",
    campos: { protocolo: "WireGuard", host: "vpn.exemplo.com.br", porta: "51820", usuario: "filial" },
    segredos: { senha: "2026-02-14T10:00:00", psk: "2025-11-02T10:00:00" },
    outraChave: ["psk"],
  }),
];

const EVENTOS: EventoAcesso[] = [
  { id: 6, acao: "revelado", campos: ["senha"], usuario: "Diego Moretti", em: "2026-09-25T16:42:00" },
  { id: 5, acao: "copiado", campos: ["senha"], usuario: "Marina Alves", em: "2026-09-19T09:03:00" },
  { id: 4, acao: "segredo", campos: ["senha"], usuario: "Diego Moretti", em: "2026-08-12T09:30:00" },
  { id: 3, acao: "editado", campos: ["seguranca", "equipamento"], usuario: "Diego Moretti", em: "2026-08-12T09:29:00" },
  { id: 1, acao: "criado", campos: [], usuario: "Diego Moretti", em: "2026-02-03T15:20:00" },
];

const FICHA_WIFI: AcessoDetalhe = { ...ACESSOS[0], criadoEm: "2026-02-03T15:20:00", eventos: EVENTOS };
const FICHA_BANCO: AcessoDetalhe = {
  ...ACESSOS[1],
  observacoes: "Só leitura para relatório: pedir o usuário de leitura ao suporte.",
  criadoEm: "2024-05-03T14:10:00",
  eventos: [
    { id: 12, acao: "copiado", campos: ["senha"], usuario: "Diego Moretti", em: "2026-09-24T18:11:00" },
    { id: 11, acao: "editado", campos: ["porta"], usuario: "Diego Moretti", em: "2025-03-10T08:40:00" },
    { id: 10, acao: "criado", campos: [], usuario: "Diego Moretti", em: "2024-05-03T14:10:00" },
  ],
};

const PENDENCIAS: PendenciaTi[] = [
  { chave: "r", tipo: "recolher", alvo: { secao: "equipamentos", id: 9 }, titulo: "NVC-009 · Notebook Dell Vostro 3510", apoio: "Com BRUNO SCHULZ · saiu do Diretório", dias: 108 },
  { chave: "l", tipo: "licenca", alvo: { secao: "acessos", id: 12 }, titulo: "Antivírus (50 estações)", apoio: "Vence em 10/10/2026", dias: 14 },
  { chave: "m", tipo: "manutencao", alvo: { secao: "equipamentos", id: 18 }, titulo: "NVC-018 · Notebook Acer Aspire 5", apoio: "Em manutenção em Dell Suporte desde 18/08/2026", dias: 38 },
  { chave: "s", tipo: "senha", alvo: { secao: "acessos", id: 8 }, titulo: "Banco do sistema interno", apoio: "Banco de dados · trocada em 03/05/2024", dias: 876 },
  { chave: "g", tipo: "garantia", alvo: { secao: "equipamentos", id: 31 }, titulo: "NVC-031 · Monitor LG 24MK430H", apoio: "Garantia até 09/11/2026", dias: 44 },
];

const POR_TIPO = [
  { tipo: "notebook", uso: 38, estoque: 4, manutencao: 1 },
  { tipo: "monitor", uso: 41, estoque: 9, manutencao: 0 },
  { tipo: "headset", uso: 30, estoque: 2, manutencao: 0 },
  { tipo: "celular", uso: 6, estoque: 1, manutencao: 1 },
  { tipo: "impressora", uso: 3, estoque: 0, manutencao: 0 },
];

const ATIVIDADE: AtividadeTi[] = [
  { chave: "a1", origem: "acessos", alvoId: 7, icone: "ver", titulo: "Senha vista", alvo: "Wi-Fi dos Visitantes", por: "Diego Moretti", em: "2026-09-25T16:42:00" },
  { chave: "a2", origem: "equipamentos", alvoId: 15, icone: "transferir", titulo: "Entregue a MARIANA COSTA", alvo: "NVC-015 · Notebook Lenovo ThinkPad E14", por: "Diego Moretti", em: "2026-09-25T10:14:00" },
  { chave: "a3", origem: "acessos", alvoId: 9, icone: "chave", titulo: "Senha trocada", alvo: "Servidor do escritório", por: "Diego Moretti", em: "2026-09-24T17:55:00" },
  { chave: "a4", origem: "equipamentos", alvoId: 18, icone: "transferir", titulo: "Foi para manutenção em Dell Suporte", alvo: "NVC-018 · Notebook Acer Aspire 5", por: "Marina Alves", em: "2026-09-23T09:20:00" },
];

export function BlocosTi() {
  const nada = () => {};
  return (
    <>
      <Bloco
        titulo="Equipamento na linha"
        porque="O ícone do tipo vem antes do nome, para a lista se ler pelo formato. Embaixo, só as especificações que decidem (processador, memória, disco); o nome na rede identifica, mas não descreve. Sem etiqueta de patrimônio é informação, não defeito: mouse e cabo não têm."
      >
        <Painel corpo="flex flex-col divide-y divide-linha p-0" className="max-w-3xl">
          {EQUIPAMENTOS.slice(0, 5).map((e) => (
            <div key={e.id} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 px-4 py-1.5">
              <Patrimonio codigo={e.patrimonio} />
              <CelulaEquipamento e={e} />
            </div>
          ))}
        </Painel>
      </Bloco>

      <Bloco
        titulo="Com quem está"
        porque="Pessoa leva o setor embaixo; quem é de fora do Diretório leva a empresa ou o vínculo, e sempre o selo, para o terceirizado não se confundir com alguém da casa. Quem precisa devolver (saiu do Diretório, ou é de fora e teve o cadastro encerrado) ganha o selo de atenção, porque é o equipamento que a TI precisa recolher e nenhuma outra tela avisa. Manutenção fica no tom de atenção (está parado); estoque e baixa ficam apagados, porque não pedem nada de ninguém."
      >
        <Painel corpo="grid gap-x-8 gap-y-2 sm:grid-cols-2" className="max-w-3xl">
          <CelulaPosse posse={ANA} />
          <CelulaPosse posse={BRUNO} fora />
          <CelulaPosse posse={CARLOS} />
          <CelulaPosse posse={{ destino: "externo", id: 5, nome: "PAULO SOUZA", vinculo: "Vigia Sul Segurança" }} fora />
          <CelulaPosse posse={{ destino: "local", local: "Recepção" }} />
          <CelulaPosse posse={ESTOQUE} />
          <CelulaPosse posse={{ destino: "manutencao", local: "Dell Suporte" }} />
          <CelulaPosse posse={{ destino: "baixa", motivo: "roubo" }} />
        </Painel>
      </Bloco>

      <Bloco
        titulo="Histórico de posse"
        porque="Com quem o equipamento está não é um campo: é a última linha deste histórico, e nenhuma linha é reescrita. O verbo sai do par anterior e atual (estoque para pessoa é entrega, pessoa para pessoa é passagem), e cada linha diz de onde veio, quando e quem registrou."
      >
        <Painel className="max-w-xl">
          <HistoricoPosse historico={HISTORICO} />
        </Painel>
      </Bloco>

      <Bloco
        titulo="Ficha do equipamento"
        porque="No topo, com quem está e as ações que cabem ali: do estoque, entregar; com alguém, passar adiante ou devolver; da manutenção, voltar. Baixa e manutenção ficam no menu, para a ação comum não disputar espaço com a que tira do inventário. Apagar só existe enquanto há apenas o cadastro; depois, o fim é a baixa, que guarda o histórico."
      >
        <div className="flex flex-col gap-6">
          <Variante nome="Com uma pessoa">
            <FichaEquipamentoEstatica equipamento={FICHA} />
          </Variante>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Variante nome="Com quem saiu do Diretório">
              <FichaEquipamentoEstatica
                equipamento={{ ...FICHA, ...EQUIPAMENTOS[5], historico: [mov(9, BRUNO, ESTOQUE, "2025-06-10")] }}
                fora
              />
            </Variante>
            <Variante nome="Abrindo">
              <FichaEquipamentoCarregando />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Cadastro de equipamento"
        porque="O tipo escolhe as especificações que o formulário pede, a partir do catálogo em ti-tipos: tipo novo é uma linha lá, sem tela nova. No cadastro, a janela pergunta onde ele está hoje, para quem registra o inventário que já existe começar o histórico verdadeiro. Na edição essa parte some: com quem ele está só muda por movimentação, que deixa rastro."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Novo, já com a pessoa">
            <EquipamentoEstatico
              pessoas={PESSOAS}
              externos={EXTERNOS}
              inicial={{ tipo: "notebook", marca: "Dell", modelo: "Latitude 3420", onde: "pessoa", pessoa: "1:184" }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Editando um monitor: outras especificações">
            <EquipamentoEstatico equipamento={EQUIPAMENTOS[1]} pessoas={PESSOAS} externos={EXTERNOS} onFechar={nada} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Movimentar"
        porque="Um destino para um ou vários equipamentos: o kit do funcionário novo sai numa entrega só, e quem sai da empresa devolve tudo de uma vez. O servidor grava todos ou nenhum, e recusa dizendo quais. De onde cada um sai não se escolhe: é o que o histórico diz, e a janela mostra ao lado de cada item."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Entrega de kit, escolhendo os itens">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
              externos={EXTERNOS}
              inicial={{ ids: [15, 40], destino: "pessoa", pessoa: "1:211" }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Devolução de tudo, com os itens fixos">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
              externos={EXTERNOS}
              inicial={{ ids: [12, 31, 40, 41], destino: "estoque", travado: true }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Entrega a alguém de fora, cadastrando na hora">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
              externos={EXTERNOS}
              inicial={{ ids: [41], destino: "pessoa", travado: true }}
              novoExternoAberto
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Baixa">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
              externos={EXTERNOS}
              inicial={{ ids: [18], destino: "baixa", travado: true }}
              onFechar={nada}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Equipamentos de uma pessoa"
        porque="Na lista, o que a pessoa tem vira fichas curtas com o ícone e a etiqueta; passando de cinco, o resto vira contagem. Aberta, é a tela do desligamento: o que está em mãos, devolver tudo de uma vez, e o histórico do que já passou por ela, recebido ou devolvido."
      >
        <div className="flex flex-col gap-6">
          <Variante nome="Na linha">
            <div className="flex flex-col gap-2">
              <ChipsEquipamentos itens={EQUIPAMENTOS.slice(0, 4)} />
              <ChipsEquipamentos itens={EQUIPAMENTOS} />
              <ChipsEquipamentos itens={[]} />
            </div>
          </Variante>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Variante nome="Aberta">
              <PessoaTiEstatica
                pessoa={{
                  chave: "1:184",
                  nome: "ANA PAULA RIBEIRO",
                  setor: "Contábil",
                  cargo: "Analista contábil",
                  fora: false,
                  externo: null,
                  itens: EQUIPAMENTOS.slice(0, 4),
                }}
                movimentacoes={MOVS_ANA}
              />
            </Variante>
            <Variante nome="Fora do Diretório: devolver vira a ação principal">
              <PessoaTiEstatica
                pessoa={{ chave: "888:42", nome: "BRUNO SCHULZ", setor: "DP", cargo: null, fora: true, externo: null, itens: [EQUIPAMENTOS[5]] }}
                movimentacoes={[]}
              />
            </Variante>
            <Variante nome="De fora do Diretório: o cadastro é da TI">
              <PessoaTiEstatica
                pessoa={{
                  chave: "externo:3",
                  nome: "CARLOS MENDES",
                  setor: "Limpa Tudo Terceirizada",
                  cargo: null,
                  fora: false,
                  externo: EXTERNOS[0],
                  itens: [{ ...EQUIPAMENTOS[3], posse: CARLOS }],
                }}
                movimentacoes={[]}
              />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Quem recebe"
        porque="Uma busca só no Diretório do RH e em quem é de fora dele. O terceirizado que não está em lugar nenhum se cadastra ali mesmo, sem sair da entrega, e já sai escolhido. Cadastro e não texto livre: a mesma pessoa recebe mais de uma coisa, e o nome digitado de três jeitos viraria três pessoas no Por Pessoa. Também não entra no Diretório como PJ: o PJ é prestador da Navecon, com experiência e avaliação; o terceirizado é de outra empresa."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Escolhendo">
            <Painel className="max-w-md">
              <CampoRecebedor pessoas={PESSOAS} externos={EXTERNOS} valor="externo:3" onMudar={nada} />
            </Painel>
          </Variante>
          <Variante nome="Cadastrando alguém de fora">
            <Painel className="max-w-md">
              <CampoRecebedor pessoas={PESSOAS} externos={EXTERNOS} valor={null} onMudar={nada} novoAberto />
            </Painel>
          </Variante>
          <Variante nome="Cadastro de fora: encerrar é o fim do vínculo">
            <ExternoEstatico externo={EXTERNOS[0]} onFechar={nada} />
          </Variante>
          <Variante nome="Encerrado: não recebe até reativar">
            <ExternoEstatico externo={EXTERNOS[2]} onFechar={nada} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Acesso na linha"
        porque="O cofre se lê como a lista de equipamentos: o ícone do tipo antes do nome, o tipo e o grupo embaixo. Endereço e usuário não são segredo e se copiam com um clique, sem registro; a senha fica mascarada e só abre pelo servidor. A lista nunca carrega senha nenhuma, nem cifrada."
      >
        <Painel corpo="flex flex-col divide-y divide-linha p-0" className="max-w-4xl">
          {ACESSOS.map((a) => (
            <div key={a.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] items-center gap-3 px-4 py-1.5">
              <CelulaAcesso a={a} />
              <TextoCopiavel valor={enderecoAcesso(a)} rotulo="Endereço" />
              <TextoCopiavel valor={usuarioAcesso(a)} rotulo="Usuário" />
              <Segredo acessoId={a.id} campo="senha" guardado={!!a.segredos.senha} outraChave={a.outraChave.includes("senha")} />
            </div>
          ))}
        </Painel>
      </Bloco>

      <Bloco
        titulo="Segredo mascarado"
        porque="Ver e copiar passam pelo servidor, que grava no registro quem abriu ANTES de devolver a senha: sem registro, sem senha. Aberta, ela volta à máscara sozinha em trinta segundos, para não ficar na tela de quem levantou. Guardada com outra chave do cofre, o selo diz o porquê em vez de um erro no clique."
      >
        <Painel corpo="grid gap-x-8 gap-y-3 sm:grid-cols-2" className="max-w-3xl">
          <Variante nome="Guardada">
            <Segredo acessoId={7} campo="senha" guardado />
          </Variante>
          <Variante nome="Aberta, voltando à máscara">
            <Segredo acessoId={7} campo="senha" guardado revelado="Vis1t@-Trim3stre" />
          </Variante>
          <Variante nome="Não guardada">
            <Segredo acessoId={10} campo="senha" guardado={false} />
          </Variante>
          <Variante nome="Guardada com outra chave">
            <Segredo acessoId={11} campo="psk" guardado outraChave />
          </Variante>
          <Variante nome="Servidor sem a chave do cofre">
            <Segredo acessoId={7} campo="senha" guardado semChave />
          </Variante>
        </Painel>
      </Bloco>

      <Bloco
        titulo="Ficha do acesso"
        porque="Como entrar em cima, cada campo com o seu copiar; o segredo mascarado; o registro inteiro ao lado. Abrir a ficha não abre senha. No Wi-Fi, o QR leva a senha dentro, então mostrá-lo passa pelo mesmo revelar e entra no registro; ele é preto no branco em qualquer tema, porque é o contraste que a câmera lê."
      >
        <div className="flex flex-col gap-6">
          <Variante nome="Wi-Fi com o QR aberto">
            <FichaAcessoEstatica acesso={FICHA_WIFI} qr={textoQrWifi("ESCRITORIO-VISITA", "WPA2", "Vis1t@-Trim3stre")} />
          </Variante>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Variante nome="Banco de dados com senha antiga">
              <FichaAcessoEstatica acesso={FICHA_BANCO} />
            </Variante>
            <Variante nome="Abrindo">
              <FichaAcessoCarregando />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Cadastro de acesso"
        porque="O tipo escolhe os campos, a partir do catálogo em ti-acessos-tipos: servidor, porta e base para o banco de dados, rede e segurança para o Wi-Fi. A porta de costume aparece como sugestão e não é gravada. Na edição a senha guardada não volta para a tela: fica mascarada com Trocar e Remover, e redigitar a mesma não conta como troca. O campo é texto com máscara, e não de senha, para o navegador não preencher o login do sistema nem oferecer salvar o Wi-Fi."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Novo Wi-Fi">
            <AcessoEstatico
              grupos={["Matriz", "Servidor", "Fornecedores"]}
              equipamentos={[{ id: 60, tipo: "rede", nome: "Rede TP-Link Archer AX55", patrimonio: "NVC-060" }]}
              chave
              inicial={{ nome: "Wi-Fi dos Visitantes", grupo: "Matriz", campos: { ssid: "ESCRITORIO-VISITA", seguranca: "WPA2" } }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Editando um banco: a senha guardada fica mascarada">
            <AcessoEstatico acesso={ACESSOS[1]} grupos={["Servidor"]} equipamentos={[]} chave onFechar={nada} />
          </Variante>
          <Variante nome="VPN trocando a chave compartilhada">
            <AcessoEstatico
              acesso={ACESSOS[4]}
              grupos={["Filial"]}
              equipamentos={[]}
              chave
              inicial={{ segredos: { psk: "" } }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Servidor sem a chave do cofre">
            <AcessoEstatico grupos={[]} equipamentos={[]} chave={false} inicial={{ tipo: "remoto", nome: "Servidor do escritório" }} onFechar={nada} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Registro do acesso"
        porque="Só cresce, e apagar o acesso não apaga o que aconteceu com ele. Senha vista e copiada ficam no tom de atenção: é a linha que responde quem sabia a senha antes de o prestador sair."
      >
        <Painel className="max-w-md">
          <HistoricoAcesso eventos={EVENTOS} tipo="wifi" />
        </Painel>
      </Bloco>

      <Bloco
        titulo="Pendências da TI"
        porque="Inventário e cofre numa lista só, do que pesa mais para o que espera: equipamento com quem saiu, licença vencendo, manutenção parada, senha antiga, garantia. Garantia e licença falam em prazo; o resto fala em tempo parado, na escala que se lê (dias, meses, anos). Cada linha abre a ficha do item."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Com pendências">
            <ListaUrgencias titulo="Pendências" itens={PENDENCIAS.map(itemPendenciaTi)} vazio="Nada pendente na TI" />
          </Variante>
          <Variante nome="Nada pendente">
            <ListaUrgencias titulo="Pendências" itens={[]} vazio="Nada pendente na TI" />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Inventário por tipo e atividade"
        porque="A régua das barras é o maior tipo, então a barra também compara os tipos entre si: dá para ver que sobra monitor no estoque. A atividade junta movimentação e cofre, e senha aberta aparece no tom de atenção."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Inventário por tipo">
            <Painel corpo="p-0" titulo="Inventário por Tipo">
              <InventarioPorTipo porTipo={POR_TIPO} />
            </Painel>
          </Variante>
          <Variante nome="Atividade recente">
            <Painel corpo="p-0" titulo="Atividade Recente">
              <AtividadeRecenteTi itens={ATIVIDADE} />
            </Painel>
          </Variante>
          <Variante nome="Carregando">
            <Painel corpo="p-0" titulo="Inventário por Tipo">
              <InventarioPorTipo porTipo={undefined} carregando />
            </Painel>
          </Variante>
          <Variante nome="Sem atividade">
            <Painel corpo="p-0" titulo="Atividade Recente">
              <AtividadeRecenteTi itens={[]} />
            </Painel>
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
