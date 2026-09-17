import "server-only";
import { spawn } from "node:child_process";
import { FilterError } from "./fiscal-filters";

/**
 * Como o texto sai do PDF:
 * - `layout` preserva as colunas por espaços — o que extrato e balancete
 *   precisam, uma linha por lançamento/conta;
 * - `raw` segue a ORDEM EM QUE O PDF DESENHA. Relatório que empilha várias
 *   linhas por registro (o patrimonial do SCI) sai embaralhado no `layout`, que
 *   agrupa por altura e cola o valor de um bem no cabeçalho do vizinho; na ordem
 *   de desenho cada registro sai inteiro. E a ordem é do arquivo, não da
 *   ferramenta: xpdf e poppler devolvem a mesma sequência.
 */
export type ModoTextoPdf = "layout" | "raw";

/**
 * Extrai o texto de um PDF com `pdftotext`. Entra e sai por stdin/stdout, sem
 * arquivo temporário. Compartilhado pela Conciliação (extrato) e pela
 * Implantação (balancete e patrimonial).
 */
export function textoDoPdf(
  bytes: Buffer,
  senha?: string,
  modo: ModoTextoPdf = "layout"
): Promise<string> {
  return new Promise((resolve, reject) => {
    // spawn e não execFile: só o spawn deixa escrever no stdin do processo, e
    // sem isso o pdftotext fica esperando entrada para sempre.
    // `-enc UTF-8` explícito: o poppler do container já sai em UTF-8, mas o xpdf
    // (o do Git for Windows, na máquina de dev) sai em Latin-1 e quebra acento.
    const args = [`-${modo}`, "-enc", "UTF-8", ...(senha ? ["-upw", senha] : []), "-", "-"];
    const p = spawn("pdftotext", args);
    const saida: Buffer[] = [];
    let erro = "";

    // Rede de segurança: PDF corrompido não pode segurar a requisição.
    const limite = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new FilterError("A leitura do PDF demorou demais — o arquivo pode estar corrompido"));
    }, 30_000);

    p.stdout.on("data", (d: Buffer) => saida.push(d));
    p.stderr.on("data", (d: Buffer) => (erro += d.toString()));
    p.on("error", () => {
      clearTimeout(limite);
      reject(new FilterError("pdftotext não está disponível no servidor"));
    });
    p.on("close", (code) => {
      clearTimeout(limite);
      if (code !== 0) {
        // Protegido: a mensagem precisa dizer o que fazer, não só que falhou.
        if (/password/i.test(erro)) {
          return reject(
            new FilterError(
              senha
                ? "Senha incorreta para este PDF"
                : "Este PDF está protegido por senha — informe a senha para abrir"
            )
          );
        }
        return reject(
          new FilterError(
            `Não consegui ler o PDF${erro ? `: ${erro.trim().split("\n")[0]}` : ""}. Se ele for digitalizado (imagem), não há texto para extrair.`
          )
        );
      }
      resolve(Buffer.concat(saida).toString("utf8"));
    });

    p.stdin.on("error", () => {});
    p.stdin.end(bytes);
  });
}
