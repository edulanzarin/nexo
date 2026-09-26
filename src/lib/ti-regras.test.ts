import { describe, expect, it } from "vitest";
import {
  conferirMovimentacao,
  hojeEscritorio,
  lerDadosEquipamento,
  lerDadosExterno,
  lerPedido,
  posseDoPedido,
  RecusaTi,
} from "./ti-regras";
import {
  chaveExterno,
  frasePosse,
  lerChaveRecebedor,
  nomeEquipamento,
  resumoSpecs,
  textoPosse,
  type PessoaExterna,
  type PessoaTi,
  type Posse,
} from "./ti-tipos";

const ANA: PessoaTi = { empresa: 1, contrato: 184, nome: "ANA PAULA RIBEIRO", setor: "Contábil", cargo: "Analista" };
const comAna: Posse = { destino: "pessoa", empresa: 1, contrato: 184, nome: "ANA PAULA RIBEIRO", setor: "Contábil" };
const joao: Posse = { destino: "externo", id: 3, nome: "JOAO DA SILVA", vinculo: "Limpa Tudo Terceirizada" };

const notebook = (posse: Posse, desde = "2026-09-01") => ({
  id: 12,
  tipo: "notebook",
  marca: "Dell",
  modelo: "Latitude 3420",
  patrimonio: "NVC-012",
  posse,
  desde,
});

const pedido = (extra: Record<string, unknown> = {}) =>
  lerPedido({ equipamentos: [12], destino: "pessoa", pessoa: { empresa: 1, contrato: 184 }, data: "2026-09-10", ...extra });

const recusa = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    if (e instanceof RecusaTi) return e.message;
    throw e;
  }
  return null;
};

describe("cadastro", () => {
  it("descarta a especificação que o tipo não pede", () => {
    const d = lerDadosEquipamento({
      tipo: "mouse",
      marca: " Logitech ",
      especificacoes: { conexao: "sem fio", processador: "i7" },
    });
    expect(d.especificacoes).toEqual({ conexao: "sem fio" });
    expect(d.marca).toBe("Logitech");
  });

  it("etiqueta de patrimônio sai em maiúscula, vazia vira null", () => {
    expect(lerDadosEquipamento({ tipo: "notebook", patrimonio: "nvc-012" }).patrimonio).toBe("NVC-012");
    expect(lerDadosEquipamento({ tipo: "notebook", patrimonio: "  " }).patrimonio).toBeNull();
  });

  it("recusa tipo fora do catálogo, data impossível e valor negativo", () => {
    expect(recusa(() => lerDadosEquipamento({ tipo: "torradeira" }))).toBe("Escolha o tipo do equipamento");
    expect(recusa(() => lerDadosEquipamento({ tipo: "notebook", dataCompra: "2026-02-30" }))).toBe("Data da compra inválida");
    expect(recusa(() => lerDadosEquipamento({ tipo: "notebook", valorCompra: -1 }))).toBe("Valor da compra inválido");
  });

  it("nome e resumo saem do catálogo", () => {
    const e = lerDadosEquipamento({
      tipo: "notebook",
      marca: "Dell",
      modelo: "Latitude 3420",
      especificacoes: { processador: "i5-1135G7", memoria: "16 GB", armazenamento: "SSD 256 GB", hostname: "NVC-NB-012" },
    });
    expect(nomeEquipamento(e)).toBe("Notebook Dell Latitude 3420");
    // O nome na rede identifica, mas não descreve a máquina: fica fora do resumo.
    expect(resumoSpecs(e)).toBe("i5-1135G7 · 16 GB · SSD 256 GB");
  });
});

describe("para onde vai", () => {
  it("pessoa sai do Diretório, com o setor do dia", () => {
    expect(posseDoPedido(pedido(), ANA)).toEqual(comAna);
  });

  it("quem saiu da empresa não recebe", () => {
    expect(recusa(() => posseDoPedido(pedido(), null))).toMatch(/não está no Diretório/);
  });

  it("local exige o lugar, baixa exige o motivo, manutenção não exige nada", () => {
    expect(recusa(() => posseDoPedido(pedido({ destino: "local" }), null))).toBe("Diga onde o equipamento fica");
    expect(recusa(() => posseDoPedido(pedido({ destino: "baixa" }), null))).toBe("Diga o motivo da baixa");
    expect(posseDoPedido(pedido({ destino: "manutencao" }), null)).toEqual({ destino: "manutencao", local: null });
    expect(recusa(() => lerPedido({ equipamentos: [12], destino: "baixa", motivo: "sumiu", data: "2026-09-10" }))).toBe(
      "Motivo da baixa inválido"
    );
  });

  it("o texto de cada posse", () => {
    expect(textoPosse({ destino: "estoque" })).toBe("Estoque da TI");
    expect(textoPosse({ destino: "manutencao", local: "Dell Suporte" })).toBe("Manutenção · Dell Suporte");
    expect(textoPosse({ destino: "baixa", motivo: "roubo" })).toBe("Baixa · Roubo ou furto");
  });
});

describe("conferir a movimentação", () => {
  const hoje = "2026-09-25";

  it("entrega do estoque para a pessoa passa", () => {
    expect(() => conferirMovimentacao(pedido(), comAna, [notebook({ destino: "estoque" })], hoje)).not.toThrow();
  });

  it("não vai para onde já está", () => {
    expect(recusa(() => conferirMovimentacao(pedido(), comAna, [notebook(comAna)], hoje))).toBe(
      "NVC-012 (Notebook Dell Latitude 3420) já está em ANA PAULA RIBEIRO"
    );
  });

  it("não entra no meio do histórico nem no futuro", () => {
    const antes = recusa(() =>
      conferirMovimentacao(pedido({ data: "2026-08-31" }), comAna, [notebook({ destino: "estoque" }, "2026-09-01")], hoje)
    );
    expect(antes).toMatch(/01\/09\/2026/);
    // No mesmo dia da última pode: entregou de manhã, devolveu à tarde.
    expect(() =>
      conferirMovimentacao(pedido({ data: "2026-09-01" }), comAna, [notebook({ destino: "estoque" }, "2026-09-01")], hoje)
    ).not.toThrow();
    expect(recusa(() => conferirMovimentacao(pedido({ data: "2026-09-26" }), comAna, [notebook({ destino: "estoque" })], hoje))).toBe(
      "A data não pode ser depois de hoje"
    );
  });

  it("baixado só volta pelo estoque", () => {
    const baixado = notebook({ destino: "baixa", motivo: "perda" });
    expect(recusa(() => conferirMovimentacao(pedido(), comAna, [baixado], hoje))).toMatch(/só volta pelo estoque/);
    expect(() =>
      conferirMovimentacao(pedido({ destino: "estoque" }), { destino: "estoque" }, [baixado], hoje)
    ).not.toThrow();
  });

  it("kit com problema é recusado inteiro, dizendo quais", () => {
    const mouse = { ...notebook(comAna), id: 13, tipo: "mouse", marca: null, modelo: null, patrimonio: null };
    const msg = recusa(() =>
      conferirMovimentacao(pedido({ equipamentos: [12, 13] }), comAna, [notebook(comAna), mouse], hoje)
    );
    expect(msg).toMatch(/^2 equipamentos não podem ir: NVC-012 .*; Mouse já está em ANA PAULA RIBEIRO$/);
  });
});

describe("frase do histórico", () => {
  const estoque: Posse = { destino: "estoque" };
  const bruno: Posse = { destino: "pessoa", empresa: 1, contrato: 97, nome: "BRUNO SCHULZ", setor: "Fiscal" };

  it("o verbo sai do par anterior e atual", () => {
    expect(frasePosse({ posse: estoque, anterior: null })).toEqual({ titulo: "Cadastrado no estoque", de: null });
    expect(frasePosse({ posse: comAna, anterior: estoque })).toEqual({
      titulo: "Entregue a ANA PAULA RIBEIRO",
      de: "no estoque",
    });
    expect(frasePosse({ posse: bruno, anterior: comAna }).titulo).toBe("Passou para BRUNO SCHULZ");
    expect(frasePosse({ posse: estoque, anterior: comAna })).toEqual({
      titulo: "Devolvido ao estoque",
      de: "com ANA PAULA RIBEIRO",
    });
    // Alguém de fora conta como alguém: de uma pessoa para ele é passagem.
    expect(frasePosse({ posse: joao, anterior: comAna })).toEqual({
      titulo: "Passou para JOAO DA SILVA",
      de: "com ANA PAULA RIBEIRO",
    });
    expect(frasePosse({ posse: estoque, anterior: { destino: "manutencao", local: null } }).titulo).toBe(
      "Voltou da manutenção"
    );
    expect(frasePosse({ posse: { destino: "baixa", motivo: "doacao" }, anterior: estoque }).titulo).toBe("Baixa por doação");
  });
});

describe("de fora do Diretório", () => {
  const externo = (ativo = true): PessoaExterna => ({
    id: 3,
    nome: "JOAO DA SILVA",
    vinculo: "Limpa Tudo Terceirizada",
    documento: null,
    contato: null,
    observacao: null,
    ativo,
  });
  const pedidoExterno = () =>
    lerPedido({ equipamentos: [12], destino: "externo", externo: { id: 3 }, data: "2026-09-10" });

  it("recebe pelo cadastro da TI, com o vínculo gravado", () => {
    expect(posseDoPedido(pedidoExterno(), null, externo())).toEqual(joao);
  });

  it("cadastro encerrado não recebe", () => {
    expect(recusa(() => posseDoPedido(pedidoExterno(), null, externo(false)))).toBe(
      "JOAO DA SILVA está com o cadastro encerrado e não recebe equipamento"
    );
  });

  it("não vai para quem já está com ele, e passa para alguém do Diretório", () => {
    expect(recusa(() => conferirMovimentacao(pedidoExterno(), joao, [notebook(joao)], "2026-09-25"))).toMatch(
      /já está em JOAO DA SILVA/
    );
    expect(() => conferirMovimentacao(pedido(), comAna, [notebook(joao)], "2026-09-25")).not.toThrow();
  });

  it("a chave escolhida na tela aponta o cadastro certo", () => {
    expect(lerChaveRecebedor(chaveExterno(3))).toEqual({ destino: "externo", id: 3 });
    expect(lerChaveRecebedor("1:184")).toEqual({ destino: "pessoa", empresa: 1, contrato: 184 });
    expect(lerChaveRecebedor("qualquer")).toBeNull();
  });

  it("o cadastro pede só o nome", () => {
    expect(recusa(() => lerDadosExterno({ vinculo: "Limpa Tudo" }))).toBe("Informe o nome");
    expect(lerDadosExterno({ nome: " Joao  da Silva ", vinculo: "" })).toEqual({
      nome: "Joao da Silva",
      vinculo: null,
      documento: null,
      contato: null,
      observacao: null,
    });
  });
});

describe("hoje", () => {
  it("é o dia de São Paulo, não o de Greenwich", () => {
    // 01h de 26/09 em UTC ainda é 22h de 25/09 no escritório.
    expect(hojeEscritorio(new Date("2026-09-26T01:00:00Z"))).toBe("2026-09-25");
  });
});
