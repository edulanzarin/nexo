import "server-only";

/**
 * Lê um inteiro POSITIVO do ambiente, caindo no padrão se a variável estiver
 * ausente, vazia ou inválida. Centraliza a leitura de tunables (sessão, pool do
 * banco) que têm um default sensato no código e só variam por ambiente.
 */
export function envInt(nome: string, padrao: number): number {
  const bruto = process.env[nome]?.trim();
  if (!bruto) return padrao;
  const n = Number(bruto);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}
