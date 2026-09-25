import { describe, expect, it } from "vitest";
import { lerOfx } from "./extrato-ofx";
import { lerPdf, PdfNaoReconhecido } from "./extrato-pdf";
import type { ModoTextoPdf } from "./pdf-texto";

/**
 * Fixtures sintéticas no formato exato dos arquivos reais (o extrato real tem
 * nome de pessoa física nas descrições de PIX, então não entra no repositório).
 * A conferência contra os arquivos reais — OFX e PDF do mesmo mês — ficou
 * registrada no commit: 228 lançamentos, entradas e saídas iguais aos totais
 * impressos no PDF.
 */

/** OFX do Ailos: valor sempre positivo, direção só no TRNTYPE, lista por dia. */
const OFX_SEM_SINAL = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<ACCTID>1234567</ACCTID>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701</DTSTART>
<DTEND>20260701</DTEND>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260701000000</DTPOSTED>
<TRNAMT>92613,27</TRNAMT>
<FITID>0</FITID>
<NAME>SALDO ANTERIOR</NAME>
</STMTTRN>
</BANKTRANLIST>
<BANKTRANLIST>
<DTSTART>20260701</DTSTART>
<DTEND>20260701</DTEND>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260701093232</DTPOSTED>
<TRNAMT>61</TRNAMT>
<FITID></FITID>
<NAME>CARTAO DEBITO - PADARIA EXEMPLO</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260701161906</DTPOSTED>
<TRNAMT>1540,45</TRNAMT>
<FITID>3313716465</FITID>
<NAME>JUROS LIM.CRD</NAME>
</STMTTRN>
</BANKTRANLIST>
<BANKTRANLIST>
<DTSTART>20260729</DTSTART>
<DTEND>20260731</DTEND>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260729120000</DTPOSTED>
<TRNAMT>271904,78</TRNAMT>
<FITID>9</FITID>
<NAME>CREDITO TED - CLIENTE EXEMPLO SA</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe("OFX", () => {
  it("valor sem sinal: a saída vem do TRNTYPE", () => {
    const r = lerOfx(OFX_SEM_SINAL);
    expect(r.transacoes.map((t) => [t.descricao, t.valor])).toEqual([
      ["CARTAO DEBITO - PADARIA EXEMPLO", -61],
      ["JUROS LIM.CRD", -1540.45],
      ["CREDITO TED - CLIENTE EXEMPLO SA", 271904.78],
    ]);
  });

  it("saldo anterior mandado como transação não vira entrada", () => {
    expect(lerOfx(OFX_SEM_SINAL).transacoes.some((t) => /SALDO/.test(t.descricao))).toBe(false);
  });

  it("período vai da primeira lista à última, não só a do primeiro dia", () => {
    const r = lerOfx(OFX_SEM_SINAL);
    expect([r.inicio, r.fim]).toEqual(["2026-07-01", "2026-07-31"]);
  });

  it("banco que usa sinal: o TRNTYPE não inverte nada", () => {
    // Crédito classificado com tipo de saída (estorno de tarifa lançado como
    // FEE positivo) continua entrada, porque o arquivo já tem negativos.
    const ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250203<TRNAMT>-14.47<MEMO>Compra no débito</STMTTRN>
<STMTTRN><TRNTYPE>FEE<DTPOSTED>20250204<TRNAMT>9.90<MEMO>Estorno de tarifa</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250205<TRNAMT>116.80<MEMO>Transferência recebida</STMTTRN>
</BANKTRANLIST></OFX>`;
    expect(lerOfx(ofx).transacoes.map((t) => t.valor)).toEqual([-14.47, 9.9, 116.8]);
  });

  it("sem sinal e sem tipo, não há o que inverter", () => {
    const ofx = `<OFX><STMTTRN><DTPOSTED>20250203<TRNAMT>10,00<MEMO>X</STMTTRN></OFX>`;
    expect(lerOfx(ofx).transacoes.map((t) => t.valor)).toEqual([10]);
  });

  it("NAME e MEMO diferentes: o MEMO é a descrição e o NAME vira complemento", () => {
    const ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260801<TRNAMT>-500.00<NAME>JOSE AUGUSTO MOREIRA<MEMO>Pix - Enviado</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260802<TRNAMT>-9.90<NAME>TARIFA<MEMO>TARIFA PACOTE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260803<TRNAMT>-1.00<NAME>SO O NOME</STMTTRN>
</BANKTRANLIST></OFX>`;
    expect(lerOfx(ofx).transacoes).toEqual([
      { data: "2026-08-01", descricao: "Pix - Enviado", complemento: "JOSE AUGUSTO MOREIRA", valor: -500 },
      // O NAME já está dentro do MEMO: repetir seria ruído.
      { data: "2026-08-02", descricao: "TARIFA PACOTE", valor: -9.9 },
      { data: "2026-08-03", descricao: "SO O NOME", valor: -1 },
    ]);
  });
});

// ── PDF do Sicoob ───────────────────────────────────────────────────────────

/**
 * O `layout` do poppler (o do container) no extrato do internet banking do
 * Sicoob: o favorecido vem na linha de baixo, mais recuado, e uma linha em
 * branco fecha o lançamento. Nomes de mentira.
 */
const SICOOB_LAYOUT = `01/09/2026, 08:06                                                           Sicoob | Internet Banking

                              SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL
                              PLATAFORMA DE SERVIÇOS FINANCEIROS DO SICOOB - SISBR

          EXTRATO DE CONTA CORRENTE                                                                         01/09/2026 - 08:10:21
  Cooperativa:                                                                                3000-1 / SICOOB EXEMPLO
  Conta:                                                              12.345-6 / EMPRESA EXEMPLO LTDA
  Periodo:                                                                                            01/08/2026 - 31/08/2026

          HISTÓRICO DE MOVIMENTAÇÃO

   Data     Documento         Histórico                                                                                     Valor
   31/08    10704975              DÉB.TRANSF.CONTAS DIF.TITULARIDADE                                               R$ 28.000,00D
                              FAV.: JOSE AUGUSTO MOREIRA Distribuicao lucros socio Jose A.Moreira

   31/08    10656601              CRÉD.TRANSF.CONTAS                                                               R$ 62.000,00C
                              REM.: CLINICA SORRISO VIVO LTDA

   31/08                          SALDO DO DIA                                                                     R$ 44.303,99C
   24/08    10671823              DÉB.CONV.TRIBUTOS FEDERAIS - RFB                                                  R$ 2.063,77D
   17/08    CELESC DIS            DÉB.CONV.EN.ELÉTRICA E GÁS                                                          R$ 156,79D
   06/08    Pix                   PIX RECEBIDO - OUTRA IF                                                           R$ 3.347,32C
                              Recebimento Pix IMOBILIARIA EXEMPLO LTDA 10.000.000 0001-00

   03/08    127                   TRANSF.RECURSO (E/I)                                                                  R$ 1,50D


https://ib.sicoob.com.br/sicoobnet/ib/#/home-extrato                                                                                1/2
\f01/09/2026, 08:06                                        Sicoob | Internet Banking

   Data     Documento         Histórico                                                      Valor
   03/08                          SALDO DO DIA                                       R$ 35.484,75C
   31/07                          SALDO ANTERIOR                                     R$ 35.486,25C


          RESUMO
   Saldo em conta:                                                                       44.303,99C
  ENCARGOS VENCIDOS REMANESCENTES
   Juros vencidos remanescentes:                                                             0,00D`;

describe("PDF do Sicoob", () => {
  it("o favorecido da linha de baixo vira o complemento", async () => {
    const r = await lerPdf(async () => SICOOB_LAYOUT);
    expect(r.banco).toBe("Sicoob");
    expect(r.transacoes).toEqual([
      {
        data: "2026-08-31",
        descricao: "10704975 DÉB.TRANSF.CONTAS DIF.TITULARIDADE",
        complemento: "FAV.: JOSE AUGUSTO MOREIRA Distribuicao lucros socio Jose A.Moreira",
        valor: -28000,
      },
      {
        data: "2026-08-31",
        descricao: "10656601 CRÉD.TRANSF.CONTAS",
        complemento: "REM.: CLINICA SORRISO VIVO LTDA",
        valor: 62000,
      },
      // Sem linha de baixo, sem complemento: o lançamento seguinte não gruda.
      { data: "2026-08-24", descricao: "10671823 DÉB.CONV.TRIBUTOS FEDERAIS - RFB", valor: -2063.77 },
      { data: "2026-08-17", descricao: "CELESC DIS DÉB.CONV.EN.ELÉTRICA E GÁS", valor: -156.79 },
      {
        data: "2026-08-06",
        descricao: "Pix PIX RECEBIDO - OUTRA IF",
        complemento: "Recebimento Pix IMOBILIARIA EXEMPLO LTDA 10.000.000 0001-00",
        valor: 3347.32,
      },
      // O rodapé da página e o resumo do fim ficam de fora.
      { data: "2026-08-03", descricao: "127 TRANSF.RECURSO (E/I)", valor: -1.5 },
    ]);
  });
});

// ── PDF do Ailos ────────────────────────────────────────────────────────────

/** O que o `layout` devolve: cabeçalho legível, valores desencontrados. */
const AILOS_LAYOUT = `Extrato conta corrente

01 de julho 2026 a 31 de julho 2026
EMPRESA EXEMPLO LTDA Documento: **.***.000/0001-**

Cooperativa: Cooperativa Exemplo Banco: 85       Agência: 0001 Conta: 1234567          Emitido em: 03/09/2026 15:09:07
Saldo inicial do período: R$ 100,00

Data   Lançamentos                                     Valor em R$             Saldo em R$
                                                              -                   100,00
01/07/2026 SALDO ANTERIOR                                                          90,00
                                                            10,00
01/07/2026 DB. COTAS`;

/** O que o `raw` devolve: uma linha por lançamento, quebra de página no meio. */
const AILOS_RAW = `Extrato conta corrente
01 de julho 2026 a 31 de julho 2026
Página 1/ 2
Cooperativa Exemplo - CNPJ: 00.000.000/0001-00
EMPRESA EXEMPLO LTDA Documento: **.***.000/0001-**
Cooperativa: Cooperativa Exemplo Banco: 85 Agência: 0001 Conta: 1234567 Emitido em: 03/09/2026 15:09:07
Saldo Entradas e saídas
Saldo inicial do período: R$ 100,00
Saldo final do período: R$ 1.040,00
Total de entradas: R$ 1.200,00
Total de saídas: R$ 260,00
Data Lançamentos Valor em R$ Saldo em R$
01/07/2026 SALDO ANTERIOR - 100,00
01/07/2026 DB. COTAS 10,00 90,00
02/07/2026 DEBITO PIX - FORNECEDOR - 1 150,00 -60,00
Extrato conta corrente
01 de julho 2026 a 31 de julho 2026
Página 2/ 2
Cooperativa Exemplo - CNPJ: 00.000.000/0001-00
03/07/2026 JUROS LIM.CRD 100,00 -160,00
29/07/2026 CREDITO PIX - BANCO EXEMPLO VENDOR 1.200,00 1.040,00`;

describe("PDF do Ailos", () => {
  const extrair = () => {
    const pedidos: ModoTextoPdf[] = [];
    const textoDoPdf = async (modo: ModoTextoPdf) => {
      pedidos.push(modo);
      return modo === "raw" ? AILOS_RAW : AILOS_LAYOUT;
    };
    return { pedidos, textoDoPdf };
  };

  it("reconhece pelo layout e lê em raw, com o sinal saindo do saldo", async () => {
    const { pedidos, textoDoPdf } = extrair();
    const r = await lerPdf(textoDoPdf);
    expect(pedidos).toEqual(["layout", "raw"]);
    expect(r.banco).toBe("Ailos");
    expect(r.transacoes).toEqual([
      { data: "2026-07-01", descricao: "DB. COTAS", valor: -10 },
      { data: "2026-07-02", descricao: "DEBITO PIX - FORNECEDOR - 1", valor: -150 },
      { data: "2026-07-03", descricao: "JUROS LIM.CRD", valor: -100 },
      // Descrição que termina em R: o R não pode ir junto com o valor.
      { data: "2026-07-29", descricao: "CREDITO PIX - BANCO EXEMPLO VENDOR", valor: 1200 },
    ]);
  });

  it("a cadeia de saldos fecha, passando pelo saldo negativo", async () => {
    const r = await lerPdf(extrair().textoDoPdf);
    expect(r.saldoConfere).toBe(true);
    expect([r.inicio, r.fim]).toEqual(["2026-07-01", "2026-07-29"]);
  });

  it("layout que ninguém conhece continua recusado com o erro de sempre", async () => {
    await expect(lerPdf(async () => "Extrato qualquer\n01/07/2026 X 10,00")).rejects.toBeInstanceOf(
      PdfNaoReconhecido
    );
  });
});
