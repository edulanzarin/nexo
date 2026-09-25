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
import type {
  EquipamentoDetalhe,
  EquipamentoLista,
  MovimentacaoLista,
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
        porque="Pessoa leva o setor embaixo. Quem saiu do Diretório do RH ganha o selo, porque é o equipamento que a TI precisa recolher e nenhuma outra tela avisa. Manutenção fica no tom de atenção (está parado); estoque e baixa ficam apagados, porque não pedem nada de ninguém."
      >
        <Painel corpo="grid gap-x-8 gap-y-2 sm:grid-cols-2" className="max-w-3xl">
          <CelulaPosse posse={ANA} />
          <CelulaPosse posse={BRUNO} fora />
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
              inicial={{ tipo: "notebook", marca: "Dell", modelo: "Latitude 3420", onde: "pessoa", pessoa: "1:184" }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Editando um monitor: outras especificações">
            <EquipamentoEstatico equipamento={EQUIPAMENTOS[1]} pessoas={PESSOAS} onFechar={nada} />
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
              inicial={{ ids: [15, 40], destino: "pessoa", pessoa: "1:211" }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Devolução de tudo, com os itens fixos">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
              inicial={{ ids: [12, 31, 40, 41], destino: "estoque", travado: true }}
              onFechar={nada}
            />
          </Variante>
          <Variante nome="Baixa">
            <MovimentarEstatico
              equipamentos={EQUIPAMENTOS}
              pessoas={PESSOAS}
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
                  itens: EQUIPAMENTOS.slice(0, 4),
                }}
                movimentacoes={MOVS_ANA}
              />
            </Variante>
            <Variante nome="Fora do Diretório: devolver vira a ação principal">
              <PessoaTiEstatica
                pessoa={{ chave: "888:42", nome: "BRUNO SCHULZ", setor: "DP", cargo: null, fora: true, itens: [EQUIPAMENTOS[5]] }}
                movimentacoes={[]}
              />
            </Variante>
          </div>
        </div>
      </Bloco>
    </>
  );
}
