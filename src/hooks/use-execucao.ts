"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { faltaEmpresa, qsDaAba } from "@/lib/contexto";
import { registrarNaTrilha } from "@/lib/exportar";
import { execucaoDaAba } from "@/lib/secoes/tipos";
import { useContexto } from "./use-contexto";
import { useEstadoModulo } from "./use-estado-modulo";

/**
 * Consulta pesada executa por botão. O contexto do topo muda na hora (é onde a
 * pessoa está), mas a tela só pergunta ao Questor quando alguém aperta
 * Executar: ler o escritório custa segundos, e cada troca de empresa não pode
 * disparar uma varredura.
 *
 * A moldura (o botão) e a tela (a consulta) leem o mesmo registro: o recorte
 * que foi executado por último naquela aba. Ele vive pelo módulo inteiro, então
 * sair para outra seção e voltar reencontra o resultado sem rodar de novo.
 *
 * Quando o contexto muda depois da execução, a tela continua mostrando o
 * resultado anterior e a moldura avisa que o recorte mudou. Jogar fora o
 * resultado a cada clique no seletor seria punir quem só estava olhando.
 */
export function useExecucao() {
  const { contexto, local, pathname } = useContexto();
  const aba = local?.aba;
  const { imediata, rotulo } = execucaoDaAba(aba);
  const qsAtual = qsDaAba(contexto, aba);
  const falta = faltaEmpresa(contexto, aba);
  const [executado, setExecutado] = useEstadoModulo<string | null>(
    `${aba?.execucaoCompartilhada ?? aba?.path ?? pathname}\u0000executado`,
    null
  );
  const qc = useQueryClient();
  const sp = useSearchParams();
  const buscando = useIsFetching() > 0;

  const executar = useCallback(() => {
    if (falta) return;
    const modulo = local?.modulo.id;
    if (modulo) {
      const empresa = contexto.empresas.length === 1 ? contexto.empresas[0] : undefined;
      registrarNaTrilha(modulo, "consulta", `${pathname} · ${qsAtual}`, empresa);
    }
    // Mesmo recorte de novo é "atualizar": sem isto a chave não muda e o cache
    // responde sem perguntar nada ao Questor.
    if (executado === qsAtual) qc.refetchQueries({ type: "active" });
    else setExecutado(qsAtual);
  }, [falta, local, contexto.empresas, pathname, qsAtual, executado, qc, setExecutado]);

  // Link compartilhado com `ap=1` chega executando, uma vez.
  const autoExecutar = sp.get("ap") === "1";
  useEffect(() => {
    if (autoExecutar && !imediata && executado == null && !falta) setExecutado(qsAtual);
  }, [autoExecutar, imediata, executado, falta, qsAtual, setExecutado]);

  if (imediata) {
    return {
      aba,
      imediata,
      rotulo,
      qs: falta ? null : qsAtual,
      qsAtual,
      pronto: !falta,
      desatualizado: false,
      falta,
      executar,
      buscando,
    };
  }
  return {
    aba,
    imediata,
    rotulo,
    /** A query executada. Null antes da primeira execução. */
    qs: executado,
    qsAtual,
    pronto: executado != null,
    desatualizado: executado != null && executado !== qsAtual,
    falta,
    executar,
    buscando,
  };
}
