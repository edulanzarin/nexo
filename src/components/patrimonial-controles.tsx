"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DropzoneArquivo } from "@/components/dropzone-arquivo";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import type { LeituraPatrimonialCasada } from "@/lib/patrimonial-tipos";

/**
 * Controles da aba Patrimonial da Implantação, na linha da barra de filtros
 * (mesmo padrão da aba Saldos). Compartilham o estado da página: ler o PDF aqui
 * preenche a conferência lá.
 *
 * Escolher o PDF NÃO processa — só guarda; quem lê é o botão
 * ([[executar-com-botao]]).
 */
export function PatrimonialControles() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [arquivo, setArquivo] = useEstadoSecao<File | null>("arquivo", null);
  const [, setLeitura] = useEstadoSecao<LeituraPatrimonialCasada | null>("leitura", null);
  const [nomeLido, setNomeLido] = useEstadoSecao<string | null>("nomeLido", null);
  const [lendo, setLendo] = useState(false);

  async function ler() {
    if (!arquivo) return;
    setLendo(true);
    try {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      fd.set("empresa", String(empresa));
      const res = await fetch("/api/contabil/implantacao/patrimonial/ler", { method: "POST", body: fd });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao ler o relatório de bens");
      const leitura = corpo as LeituraPatrimonialCasada;
      setLeitura(leitura);
      setNomeLido(arquivo.name);
      toast.success(`${leitura.bens.length} bens lidos do relatório ${leitura.sistema}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ler o relatório de bens");
    } finally {
      setLendo(false);
    }
  }

  if (!temEmpresa) return null;

  // Já leu este arquivo? Então o botão fica neutro (reler é opção).
  const pendente = arquivo != null && nomeLido !== arquivo.name;

  return (
    <>
      <DropzoneArquivo
        aceita={[".pdf"]}
        onArquivo={(f) => setArquivo(f)}
        carregando={lendo}
        nomeArquivo={arquivo?.name}
        rotulo="Escolha o relatório de bens"
        rotuloCarregando="Lendo os bens…"
      />
      <div className="ml-auto">
        <BotaoExecutar
          onClick={ler}
          rotulo="Ler bens"
          dirty={pendente}
          disabled={!arquivo}
          executando={lendo}
          title={!arquivo ? "Escolha o PDF do relatório de bens" : undefined}
        />
      </div>
    </>
  );
}
