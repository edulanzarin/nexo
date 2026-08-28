"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { ContaDropdown } from "@/components/conta-dropdown";
import { DropzoneArquivo } from "@/components/dropzone-arquivo";
import { BotaoExecutar } from "@/components/filters/botao-executar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui";
import { useEstadoSecao } from "@/hooks/use-estado-secao";
import { useFiltros } from "@/hooks/use-filters";
import { resumir, type Ajustes, type Previa } from "@/lib/extrato-previa";
import { gerarLancamentos, type RegraExtrato } from "@/lib/regras-extrato";
import type { ContaBanco } from "@/lib/types";

/**
 * Controles da aba Importar, renderizados pelo shell NA LINHA da barra de
 * filtros, ao lado da empresa. Compartilham o estado da seção com a página
 * (conta, arquivo, prévia), então escolher aqui reflete lá na hora.
 *
 * Escolher o extrato NÃO processa — só guarda o arquivo. Quem processa é o
 * botão Executar ([[executar-com-botao]]): escolher é escolher, executar é
 * executar.
 */
export function ImportarControles() {
  const { filtros } = useFiltros();
  const empresa = filtros.empresas[0];
  const temEmpresa = filtros.empresas.length === 1;

  const [conta, setConta] = useEstadoSecao<number | null>("conta", null);
  const [arquivo, setArquivo] = useEstadoSecao<File | null>("arquivo", null);
  const [previa, setPrevia] = useEstadoSecao<Previa | null>("extrato", null);
  const [ajustes, setAjustes] = useEstadoSecao<Ajustes>("ajustes", {});
  const [enviando, setEnviando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [senha, setSenha] = useState("");
  const [arquivoProtegido, setArquivoProtegido] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Detecta senha no PDF pelo marcador /Encrypt do dicionário de criptografia.
  async function pdfProtegido(f: File): Promise<boolean> {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      return new TextDecoder("latin1").decode(buf).includes("/Encrypt");
    } catch {
      return false;
    }
  }

  // Escolher o arquivo não processa — só guarda. Se for PDF protegido, abre o
  // modal de senha na hora (melhor que um campo solto na barra o tempo todo).
  async function aoEscolherArquivo(f: File) {
    setArquivo(f);
    setSenha("");
    setArquivoProtegido(false);
    if (f.name.toLowerCase().endsWith(".pdf") && (await pdfProtegido(f))) {
      setArquivoProtegido(true);
      setMostrarSenha(true);
    }
  }

  async function executar() {
    if (conta == null || !arquivo) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      fd.set("empresa", String(empresa));
      fd.set("conta", String(conta));
      if (senha) fd.set("senha", senha);
      const res = await fetch("/api/contabil/extrato-importar", { method: "POST", body: fd });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao ler o extrato");
      setPrevia(corpo as Previa);
      setAjustes({});
      toast.success(`${corpo.resumo.total} transações lidas`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao ler o extrato";
      toast.error(msg);
      // Senha errada/faltando: reabre o modal pra corrigir.
      if (/senha|protegid|password|encrypt/i.test(msg)) {
        setArquivoProtegido(true);
        setMostrarSenha(true);
      }
    } finally {
      setEnviando(false);
    }
  }

  /**
   * Reaplica as regras nas transações já lidas, sem precisar do arquivo de
   * novo — é o caminho depois de cadastrar o que faltava na aba Regras.
   */
  async function reaplicar() {
    if (!previa) return;
    setAtualizando(true);
    try {
      const res = await fetch(
        `/api/contabil/extrato-regras?empresa=${empresa}&conta=${previa.contaBanco.conta}`
      );
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.error ?? "Falha ao buscar as regras");

      const regras: RegraExtrato[] = (corpo as ContaBanco).regras.map((r) => ({
        id: r.id,
        termo: r.termo,
        termoOriginal: r.termoOriginal,
        tipo: r.tipo,
        contaPagamento: r.contaPagamento,
        contaRecebimento: r.contaRecebimento,
        historico: r.historico,
        ativo: r.ativo,
      }));

      // O sinal foi perdido no `valor` absoluto; volta a partir do sentido.
      const transacoes = previa.lancamentos.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        valor: l.sentido === "recebimento" ? l.valor : -l.valor,
      }));

      // Reaplicar regras é trabalho de CONTA; quem é o favorecido na folha não
      // mudou. O casamento vive no servidor, então o selo se preserva por
      // índice — sem isso, cadastrar uma regra apagaria os selos da prévia.
      const lancamentos = gerarLancamentos(transacoes, previa.contaBanco.conta, regras).map(
        (l, i) => ({ ...l, pessoa: previa.lancamentos[i]?.pessoa ?? null })
      );
      setPrevia({ ...previa, lancamentos, resumo: resumir(lancamentos, ajustes) });
      toast.success(`Regras reaplicadas · ${resumir(lancamentos, ajustes).prontos} prontas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setAtualizando(false);
    }
  }

  if (!temEmpresa) return null;

  // Já processou este arquivo? Então o botão fica neutro (reexecutar é opção).
  const pendenteDeExecucao = arquivo != null && previa?.arquivo !== arquivo.name;

  return (
    <>
      <ContaDropdown
        empresa={empresa}
        valor={conta}
        onMudar={(c) => {
          // Trocar de conta invalida a prévia — ela era da conta anterior.
          setConta(c);
          setPrevia(null);
          setAjustes({});
        }}
        soBanco
        placeholder="Conta de banco no plano"
      />

      <DropzoneArquivo
        aceita={[".ofx", ".qfx", ".pdf"]}
        onArquivo={aoEscolherArquivo}
        carregando={enviando}
        nomeArquivo={arquivo?.name}
      />

      {/* Chip de senha: só aparece pra PDF protegido; reabre o modal. */}
      {arquivoProtegido && (
        <button
          onClick={() => setMostrarSenha(true)}
          title="Este PDF está protegido — informe a senha"
          className={clsx(
            "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors",
            senha
              ? "border-good/40 bg-good/8 text-good"
              : "border-warning/40 bg-warning/8 text-warning hover:bg-warning/12"
          )}
        >
          <Lock className="size-3.5" />
          {senha ? "senha ok" : "inserir senha"}
        </button>
      )}

      {/* Executar (e Reaplicar) fixos no fim da direita. */}
      <div className="ml-auto flex items-center gap-2">
        {previa && (
          <Button
            variant="secondary"
            onClick={reaplicar}
            disabled={atualizando}
            title="Reaplica as regras cadastradas nas transações já lidas"
            className="text-xs"
          >
            <RefreshCw className={clsx("size-3.5", atualizando && "animate-spin")} />
            Reaplicar regras
          </Button>
        )}
        <BotaoExecutar
          onClick={executar}
          dirty={pendenteDeExecucao}
          disabled={conta == null || !arquivo}
          executando={enviando}
          title={
            conta == null
              ? "Escolha a conta de banco"
              : !arquivo
                ? "Escolha o extrato"
                : undefined
          }
        />
      </div>

      {/* Modal de senha — abre ao escolher um PDF protegido (ou ao errar a senha). */}
      <Modal
        aberto={mostrarSenha}
        onFechar={() => setMostrarSenha(false)}
        titulo="PDF protegido"
        subtitulo="Extrato protegido por senha."
        largura="max-w-sm"
      >
        <div className="space-y-3 p-5">
          <input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && senha && setMostrarSenha(false)}
            placeholder="Senha do PDF"
            className="h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-muted"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMostrarSenha(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setMostrarSenha(false)} disabled={!senha}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
