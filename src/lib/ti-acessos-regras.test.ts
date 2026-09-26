import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lerDadosAcesso, lerRevelar, lerSegredos } from "./ti-acessos-regras";
import {
  diasEntre,
  enderecoAcesso,
  fraseEvento,
  gerarSenha,
  linkAcesso,
  portaPadrao,
  segredoAntigo,
  textoQrWifi,
  tipoAcesso,
} from "./ti-acessos-tipos";
import { chaveDaCifra, cifrar, contextoSegredo, decifrar, ErroCofre, idDaChave, lerChave } from "./ti-cofre";
import { RecusaTi } from "./ti-regras";

const recusa = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    if (e instanceof RecusaTi || e instanceof ErroCofre) return e.message;
    throw e;
  }
  return null;
};

describe("cifra do cofre", () => {
  const chave = randomBytes(32);
  const ctx = contextoSegredo(7, "senha");

  it("volta o mesmo texto, e a mesma senha cifra diferente a cada vez", () => {
    const a = cifrar("S3nh@ do Wi-Fi ", chave, ctx);
    const b = cifrar("S3nh@ do Wi-Fi ", chave, ctx);
    expect(a).not.toBe(b);
    expect(decifrar(a, chave, ctx)).toBe("S3nh@ do Wi-Fi ");
    expect(chaveDaCifra(a)).toBe(idDaChave(chave));
  });

  it("outra chave diz que é outra chave, não um erro qualquer", () => {
    const c = cifrar("x", chave, ctx);
    expect(recusa(() => decifrar(c, randomBytes(32), ctx))).toMatch(/outra chave/);
  });

  it("a cifra copiada para outro acesso ou outro campo não abre", () => {
    const c = cifrar("x", chave, ctx);
    expect(recusa(() => decifrar(c, chave, contextoSegredo(8, "senha")))).toMatch(/não confere/);
    expect(recusa(() => decifrar(c, chave, contextoSegredo(7, "psk")))).toMatch(/não confere/);
  });

  it("cifra mexida no banco não abre", () => {
    const partes = cifrar("segredo", chave, ctx).split(".");
    partes[4] = partes[4].slice(0, -2) + (partes[4].endsWith("A") ? "BB" : "AA");
    expect(recusa(() => decifrar(partes.join("."), chave, ctx))).toMatch(/não confere/);
  });

  it("a chave do .env vem em base64 ou hexadecimal, com 32 bytes", () => {
    expect(lerChave(undefined)).toBeNull();
    expect(lerChave("  ")).toBeNull();
    expect(lerChave(chave.toString("base64"))?.equals(chave)).toBe(true);
    expect(lerChave(chave.toString("hex"))?.equals(chave)).toBe(true);
    expect(recusa(() => lerChave("curta"))).toMatch(/32 bytes/);
  });
});

describe("cadastro do acesso", () => {
  it("guarda só o que o tipo pede", () => {
    const d = lerDadosAcesso({
      tipo: "wifi",
      nome: " Wi-Fi  Visitantes ",
      campos: { ssid: "NAVECON-VISITA", seguranca: "WPA2", porta: "5432", host: "10.0.0.1" },
    });
    expect(d.nome).toBe("Wi-Fi Visitantes");
    expect(d.campos).toEqual({ ssid: "NAVECON-VISITA", seguranca: "WPA2" });
  });

  it("confere porta, opção, endereço e e-mail", () => {
    const banco = (campos: Record<string, unknown>) => lerDadosAcesso({ tipo: "banco", nome: "Banco", campos });
    expect(banco({ porta: " 5432 " }).campos.porta).toBe("5432");
    expect(banco({ porta: 5432 }).campos.porta).toBe("5432");
    expect(recusa(() => banco({ porta: "70000" }))).toBe("A porta vai de 1 a 65535");
    expect(recusa(() => banco({ porta: "54a" }))).toBe("A porta vai de 1 a 65535");
    expect(recusa(() => banco({ sgbd: "Access" }))).toMatch(/opção da lista/);
    expect(recusa(() => banco({ host: "192.168 .5.68" }))).toMatch(/não pode ter espaço/);
    expect(recusa(() => lerDadosAcesso({ tipo: "email", nome: "E-mail", campos: { email: "ti.navecon" } }))).toMatch(
      /não parece um e-mail/
    );
    expect(recusa(() => lerDadosAcesso({ tipo: "licenca", nome: "Office", campos: { validade: "2026-02-30" } }))).toMatch(
      /data inválida/
    );
  });

  it("recusa tipo fora do catálogo e acesso sem nome", () => {
    expect(recusa(() => lerDadosAcesso({ tipo: "cofre", nome: "x" }))).toBe("Escolha o tipo do acesso");
    expect(recusa(() => lerDadosAcesso({ tipo: "site", nome: "  " }))).toBe("Dê um nome ao acesso");
  });

  it("observação guarda as quebras de linha", () => {
    const d = lerDadosAcesso({ tipo: "site", nome: "x", observacoes: "Passo 1:  abrir\n\n\n\nPasso 2 " });
    expect(d.observacoes).toBe("Passo 1: abrir\n\nPasso 2");
  });
});

describe("segredos do pedido", () => {
  const vpn = tipoAcesso("vpn");

  it("texto guarda, vazio ou null remove, ausente mantém", () => {
    expect(lerSegredos({ segredos: { senha: "abc", psk: null } }, vpn)).toEqual({ senha: "abc", psk: null });
    expect(lerSegredos({ segredos: { senha: "" } }, vpn)).toEqual({ senha: null });
    expect(lerSegredos({}, vpn)).toEqual({});
  });

  it("não apara a senha, e ignora segredo que o tipo não tem", () => {
    expect(lerSegredos({ segredos: { senha: " com espaço ", chave: "XXXX" } }, vpn)).toEqual({ senha: " com espaço " });
  });

  it("recusa senha só de espaço e segredo longo demais", () => {
    expect(recusa(() => lerSegredos({ segredos: { senha: "   " } }, vpn))).toBe("Senha não pode ser só espaço");
    expect(recusa(() => lerSegredos({ segredos: { psk: "x".repeat(2001) } }, vpn))).toMatch(/passa de 2000/);
  });

  it("revelar pede um segredo do catálogo e separa ver de copiar", () => {
    expect(lerRevelar({ campo: "senha" })).toEqual({ campo: "senha", modo: "ver" });
    expect(lerRevelar({ campo: "psk", modo: "copiar" })).toEqual({ campo: "psk", modo: "copiar" });
    expect(recusa(() => lerRevelar({ campo: "usuario" }))).toBe("Segredo inválido");
  });
});

describe("leitura do acesso", () => {
  it("o endereço da lista é a rede, o link, o servidor com a porta ou o e-mail", () => {
    expect(enderecoAcesso({ campos: { ssid: "NAVECON" } })).toBe("NAVECON");
    expect(enderecoAcesso({ campos: { host: "192.168.5.68", porta: "5083" } })).toBe("192.168.5.68:5083");
    expect(enderecoAcesso({ campos: { email: "ti@navecon.com.br" } })).toBe("ti@navecon.com.br");
    expect(enderecoAcesso({ campos: {} })).toBeNull();
  });

  it("só http e https viram link", () => {
    expect(linkAcesso({ campos: { url: "https://portal.gov.br" } })).toBe("https://portal.gov.br");
    expect(linkAcesso({ campos: { url: "javascript:alert(1)" } })).toBeNull();
    expect(linkAcesso({ campos: { url: "192.168.0.1" } })).toBeNull();
  });

  it("a porta de costume sai do que foi escolhido", () => {
    expect(portaPadrao("banco", { sgbd: "PostgreSQL" })).toBe(5432);
    expect(portaPadrao("remoto", { ferramenta: "Área de Trabalho Remota (RDP)" })).toBe(3389);
    expect(portaPadrao("remoto", { ferramenta: "AnyDesk" })).toBeNull();
    expect(portaPadrao("servidor", {})).toBe(22);
  });

  it("o QR do Wi-Fi escapa o que o formato reserva", () => {
    expect(textoQrWifi("NAVECON", "WPA2", "a;b:c")).toBe("WIFI:T:WPA;S:NAVECON;P:a\\;b\\:c;;");
    expect(textoQrWifi("Visita", "Aberta", null)).toBe("WIFI:T:nopass;S:Visita;;");
  });

  it("senha antiga é a troca mais velha passando de um ano", () => {
    expect(diasEntre("2025-09-25T10:00:00", "2026-09-26")).toBe(366);
    expect(segredoAntigo({ segredos: { senha: "2025-09-25T10:00:00" } }, "2026-09-26")).toBe("2025-09-25T10:00:00");
    expect(segredoAntigo({ segredos: { senha: "2026-01-10T10:00:00" } }, "2026-09-26")).toBeNull();
    expect(segredoAntigo({ segredos: {} }, "2026-09-26")).toBeNull();
  });

  it("a frase do registro concorda com o segredo", () => {
    expect(fraseEvento({ acao: "revelado", campos: ["senha"] }, "wifi").titulo).toBe("Senha vista");
    expect(fraseEvento({ acao: "copiado", campos: ["psk"] }, "vpn").titulo).toBe("Chave compartilhada copiada");
    expect(fraseEvento({ acao: "segredo", campos: ["senha", "psk"] }, "vpn").titulo).toBe("Senha e chave compartilhada trocadas");
    expect(fraseEvento({ acao: "editado", campos: ["host", "porta"] }, "remoto").titulo).toBe("Editou computador e porta");
  });

  it("a senha gerada tem de tudo um pouco", () => {
    for (let i = 0; i < 50; i++) {
      const s = gerarSenha();
      expect(s).toHaveLength(20);
      expect(s).toMatch(/[a-z]/);
      expect(s).toMatch(/[A-Z]/);
      expect(s).toMatch(/[2-9]/);
      expect(s).toMatch(/[!@#$%&*\-_=+?]/);
      expect(s).not.toMatch(/[0O1lI]/);
    }
  });
});
