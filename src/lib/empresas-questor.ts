import "server-only";
import { query } from "./db";

/**
 * Códigos de TODAS as empresas do cadastro do Questor: o universo contra o qual
 * um grupo "todas, exceto" se resolve. É a mesma fonte da lista que o admin vê
 * ao montar o grupo (`listarTodasEmpresas`).
 *
 * Guardado em memória por alguns minutos: a sessão resolve o escopo a cada
 * requisição, e uma tela dispara várias ao mesmo tempo. Empresa cadastrada no
 * Questor aparece no grupo em até `VALIDADE_MS`.
 */

const VALIDADE_MS = 5 * 60_000;

let guardado: { em: number; codigos: Promise<number[]> } | null = null;

export function codigosEmpresasQuestor(): Promise<number[]> {
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) return guardado.codigos;
  const codigos = query<{ codigoempresa: number }>(
    `select codigoempresa from empresa order by codigoempresa`
  ).then((rows) => rows.map((r) => r.codigoempresa));
  const atual = { em: Date.now(), codigos };
  guardado = atual;
  // Falha não fica guardada: a próxima chamada tenta de novo.
  codigos.catch(() => {
    if (guardado === atual) guardado = null;
  });
  return codigos;
}
