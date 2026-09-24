"use client";

import { useEstadoModulo } from "@/hooks/use-estado-modulo";

/**
 * A conta do banco escolhida na Conciliação, uma só para as duas abas. O
 * caminho natural é ler o extrato, ver o que não casou, ir às Regras cadastrar
 * e voltar: pedir a conta de novo em cada aba é o atrito que faz a pessoa
 * desistir da regra e lançar à mão.
 *
 * Guardada por empresa: a conta é do plano de UMA empresa, e trocar a empresa no
 * topo não pode deixar selecionada a conta 16 de outra. Voltar à empresa
 * anterior reencontra a conta dela. Cai ao sair do módulo, como o resto do
 * estado de tela.
 */
export function useContaBanco(empresa: number) {
  return useEstadoModulo<number | null>(`/contabil/conciliacao\u0000conta-banco\u0000${empresa}`, null);
}
