import { describe, expect, it } from "vitest";
import {
  casarPessoa,
  cpfCasa,
  indexarPessoas,
  normalizar,
  padroesCpf,
  tokensDeDescricao,
  type PessoaFolha,
} from "./folha-casamento";

const EMPRESA = 1015;

const pessoas: PessoaFolha[] = [
  {
    empresa: EMPRESA,
    contrato: 10,
    nome: "JOÃO CARLOS DE OLIVEIRA",
    cpf: "12345678901",
    dataadm: "2021-03-01",
    datadem: null,
  },
  {
    empresa: EMPRESA,
    contrato: 11,
    nome: "MARIA DA SILVA SANTOS",
    cpf: "98765432100",
    dataadm: "2019-05-10",
    datadem: "2025-03-31",
  },
  {
    // Homônimo de propósito: mesmo nome, outra pessoa, outra empresa.
    empresa: 2040,
    contrato: 7,
    nome: "JOAO CARLOS DE OLIVEIRA",
    cpf: "11122233396",
    dataadm: "2023-01-09",
    datadem: null,
  },
  {
    empresa: 2040,
    contrato: 8,
    nome: "PEDRO HENRIQUE ALVES",
    cpf: null,
    dataadm: "2022-07-01",
    datadem: null,
  },
];

const indice = indexarPessoas(pessoas);
const casar = (descricao: string, empresa = EMPRESA) =>
  casarPessoa(descricao, indice, empresa);

describe("normalização", () => {
  it("tira acento, cedilha e pontuação", () => {
    expect(normalizar("João Conceição-Filho")).toBe("JOAO CONCEICAO FILHO");
  });

  it("descarta o jargão do banco, não o nome", () => {
    expect(tokensDeDescricao("PIX ENVIADO PAGTO JOAO CARLOS OLIVEIRA 30/06")).toEqual([
      "JOAO",
      "CARLOS",
      "OLIVEIRA",
    ]);
  });
});

describe("CPF na descrição", () => {
  it("lê o mascarado do PIX e o cheio", () => {
    expect(padroesCpf("PIX ***.456.789-** JOAO")).toEqual(["***456789**"]);
    expect(padroesCpf("TED CPF 123.456.789-01")).toEqual(["12345678901"]);
  });

  it("ignora CNPJ e números soltos", () => {
    expect(padroesCpf("PAGTO 12.345.678/0001-99")).toEqual([]);
    expect(padroesCpf("DOC 123 456 789 00")).toEqual([]);
  });

  it("casa só nas posições conhecidas", () => {
    expect(cpfCasa("***456789**", "12345678901")).toBe(true);
    expect(cpfCasa("***456780**", "12345678901")).toBe(false);
  });
});

describe("casamento", () => {
  it("acha pelo CPF mascarado mesmo sem nome legível", () => {
    const s = casar("PIX ENVIADO ***.456.789-** 30/06");
    expect(s?.via).toBe("cpf");
    expect(s?.contrato).toBe(10);
  });

  it("acha pelo nome completo", () => {
    const s = casar("PIX PAGTO JOAO CARLOS DE OLIVEIRA");
    expect(s?.via).toBe("nome");
    expect(s?.mesmaEmpresa).toBe(true);
  });

  it("acha o nome truncado pelo banco, mas pedindo conferência", () => {
    const s = casar("TED JOAO CARLOS OLIVE");
    expect(s?.contrato).toBe(10);
    // Truncado nunca é certeza: entra como parcial para o contábil olhar.
    expect(s?.via).toBe("parcial");
  });

  it("avisa o homônimo em vez de escolher em silêncio", () => {
    const s = casar("PIX JOAO CARLOS DE OLIVEIRA");
    expect(s?.homonimos).toBe(1);
  });

  it("prefere o vínculo da empresa do extrato", () => {
    expect(casar("PIX JOAO CARLOS DE OLIVEIRA", EMPRESA)?.empresa).toBe(EMPRESA);
    expect(casar("PIX JOAO CARLOS DE OLIVEIRA", 2040)?.empresa).toBe(2040);
  });

  it("marca quem é de outra empresa da carteira", () => {
    const s = casar("PIX PEDRO HENRIQUE ALVES");
    expect(s?.mesmaEmpresa).toBe(false);
    expect(s?.empresa).toBe(2040);
  });

  it("entrega o desligado com a data, não como se estivesse na casa", () => {
    const s = casar("PIX MARIA DA SILVA SANTOS");
    expect(s?.datadem).toBe("2025-03-31");
  });

  it("não casa por primeiro nome sozinho", () => {
    expect(casar("PIX ENVIADO JOAO")).toBeNull();
  });

  it("não casa por sobrenome sozinho", () => {
    expect(casar("PIX ENVIADO OLIVEIRA")).toBeNull();
  });

  it("não casa fornecedor com nome parecido", () => {
    expect(casar("PAGTO OLIVEIRA COMERCIO DE ALIMENTOS LTDA")).toBeNull();
  });

  it("não inventa gente em transação sem nome", () => {
    expect(casar("TARIFA PACOTE DE SERVICOS")).toBeNull();
    expect(casar("APLICACAO AUTOMATICA 30/06")).toBeNull();
  });

  it("o CPF ganha do nome quando os dois apontam para pessoas diferentes", () => {
    // Nome do João, CPF do homônimo da outra empresa.
    const s = casar("PIX JOAO CARLOS DE OLIVEIRA ***.222.333-**");
    expect(s?.via).toBe("cpf");
    expect(s?.contrato).toBe(7);
  });
});
