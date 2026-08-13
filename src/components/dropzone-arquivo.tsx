"use client";

import { useRef, useState } from "react";
import { FileCheck2, Loader2, Paperclip } from "lucide-react";
import clsx from "clsx";

interface Props {
  onArquivo: (arquivo: File) => void;
  /** Extensões aceitas, com ponto: [".ofx", ".pdf"]. */
  aceita: string[];
  desabilitado?: boolean;
  carregando?: boolean;
  /** Motivo de estar desabilitado, mostrado no lugar da instrução. */
  motivo?: string;
  /**
   * Nome do arquivo já escolhido. Quando presente, o controle vira "escolhido,
   * clique para trocar" — escolher não processa nada; quem executa é o botão
   * da barra ([[executar-com-botao]]).
   */
  nomeArquivo?: string | null;
  /** Placeholder quando nada foi escolhido (default: "Escolha o extrato"). */
  rotulo?: string;
  /** Texto durante a leitura (default: "Lendo o extrato…"). */
  rotuloCarregando?: string;
}

/**
 * Envio de arquivo em uma linha só, na mesma altura dos outros controles.
 * Ocupar meia tela com uma área de soltar tira espaço do resultado, que é o
 * que interessa depois do primeiro envio — mas continua aceitando arrastar.
 *
 * O `<input type="file">` segue existindo, escondido: é ele que abre o
 * seletor no clique e o que leitores de tela anunciam.
 */
export function DropzoneArquivo({
  onArquivo,
  aceita,
  desabilitado,
  carregando,
  motivo,
  nomeArquivo,
  rotulo = "Escolha o extrato",
  rotuloCarregando = "Lendo o extrato…",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const bloqueado = desabilitado || carregando;

  function entregar(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo || bloqueado) return;
    onArquivo(arquivo);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!bloqueado) setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        entregar(e.dataTransfer.files);
      }}
      onClick={() => !bloqueado && inputRef.current?.click()}
      role="button"
      tabIndex={bloqueado ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-disabled={bloqueado}
      title={
        motivo ??
        nomeArquivo ??
        `Aceita ${aceita.map((e) => e.replace(".", "").toUpperCase()).join(", ")} — dá pra arrastar o arquivo aqui`
      }
      className={clsx(
        "flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm transition-colors",
        bloqueado && "cursor-not-allowed opacity-60",
        sobre
          ? "border-accent bg-accent/10 text-ink"
          : "border-hairline bg-surface text-ink-2 hover:border-accent/40 hover:bg-surface-2 hover:text-ink"
      )}
    >
      {carregando ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
      ) : sobre || nomeArquivo ? (
        <FileCheck2 className="size-4 shrink-0 text-ent" />
      ) : (
        <Paperclip className="size-4 shrink-0 text-muted" />
      )}

      <span className="max-w-56 truncate">
        {carregando
          ? rotuloCarregando
          : motivo
            ? motivo
            : sobre
              ? "Solte para escolher"
              : (nomeArquivo ?? rotulo)}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={aceita.join(",")}
        disabled={bloqueado}
        onChange={(e) => entregar(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
