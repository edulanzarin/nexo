"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { EMPRESAS_FALSAS } from "./dados-falsos";

/**
 * O catálogo e a prévia não têm sessão: as peças de produto perguntariam ao
 * servidor e receberiam 401. Aqui o cache da consulta nasce com dado de
 * mentira, e a peça real desenha como desenharia com o Questor.
 */
export function Semeador({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  useState(() => {
    qc.setQueryData(["empresas"], EMPRESAS_FALSAS);
    qc.setQueryData(["grupos-empresa"], [
      { id: 1, nome: "Todas menos NAVECON", empresas: 1491 },
      { id: 2, nome: "Grupo U FIT", empresas: 6 },
    ]);
    qc.setQueryData(["filiais", 1200], [
      { codigoestab: 1, nome: "Matriz · Jaraguá do Sul" },
      { codigoestab: 2, nome: "Filial · Joinville" },
      { codigoestab: 3, nome: "Filial · Blumenau" },
    ]);
    qc.setQueryData(["contas", 1200, "", false], [
      { conta: 5, descricao: "CAIXA GERAL", classificacao: "1.1.01.001.0001", natureza: "D" },
      { conta: 16, descricao: "BANCO VIACREDI C/C 12.345-6", classificacao: "1.1.01.002.0003", natureza: "D" },
      { conta: 212, descricao: "FORNECEDORES NACIONAIS", classificacao: "2.1.01.001.0001", natureza: "C" },
      { conta: 318, descricao: "ENERGIA ELETRICA", classificacao: "4.1.02.004.0007", natureza: "D" },
      { conta: 402, descricao: "RECEITA DE SERVICOS", classificacao: "3.1.01.001.0002", natureza: "C" },
    ]);
    return true;
  });
  return <>{children}</>;
}
