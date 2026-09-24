import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Botao } from "./botao";
import { Icone, type NomeIcone } from "./icone";

/**
 * Os estados que toda tela tem. Tela que devolve `null` enquanto carrega é
 * indistinguível de tela quebrada, então carregando, vazio e erro têm peça.
 */

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("nx-esqueleto h-4", className)} />;
}

/** Esqueleto com a forma de uma tabela: a tela não pula quando o dado chega. */
export function EsqueletoTabela({ linhas = 8, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div aria-busy className="flex flex-col">
      <div className="flex h-8 items-center gap-4 border-b border-linha-forte px-3.5">
        {Array.from({ length: colunas }).map((_, i) => (
          <Esqueleto key={i} className={cn("h-3", i === 0 ? "w-32" : "w-16", i === colunas - 1 && "ml-auto")} />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, l) => (
        <div key={l} className="flex h-[34px] items-center gap-4 border-b border-linha px-3.5 last:border-0">
          {Array.from({ length: colunas }).map((_, i) => (
            <Esqueleto
              key={i}
              className={cn("h-3", i === 0 ? "w-44" : "w-14", i === colunas - 1 && "ml-auto w-20")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Vazio. Há dois: o da tela que ainda não foi usada ENSINA o que fazer; o do
 * filtro que não achou nada diz o que afrouxar. O texto é de quem chama.
 */
export function Vazio({
  icone = "circulo",
  titulo,
  descricao,
  acao,
  className,
  compacto,
}: {
  icone?: NomeIcone;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        compacto ? "px-4 py-8" : "px-6 py-14",
        className
      )}
    >
      <span className="grid size-10 place-items-center rounded-full border border-linha bg-poco text-apagado">
        <Icone nome={icone} tamanho={18} />
      </span>
      <p className="text-medio font-[600] text-tinta">{titulo}</p>
      {descricao && <p className="max-w-md text-corpo text-apagado">{descricao}</p>}
      {acao && <div className="mt-2 flex flex-wrap justify-center gap-2">{acao}</div>}
    </div>
  );
}

/** Erro de carregamento, com o que fazer. A mensagem vem do servidor. */
export function PainelErro({
  titulo = "Não deu para carregar",
  mensagem,
  onTentar,
  className,
}: {
  titulo?: ReactNode;
  mensagem?: ReactNode;
  onTentar?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-painel border border-perigo/25 bg-perigo-suave px-4 py-3",
        className
      )}
    >
      <Icone nome="erro" tamanho={18} className="mt-px text-perigo" />
      <div className="min-w-0 flex-1">
        <p className="text-corpo font-[600] text-tinta">{titulo}</p>
        {mensagem && <p className="mt-0.5 text-corpo text-tinta-2">{mensagem}</p>}
      </div>
      {onTentar && (
        <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

/**
 * Voz da ferramenta ao lado do dado: sempre em itálico, e só com o que a
 * pessoa não sabe (de onde o número saiu, o que ele não conta).
 */
export function Nota({
  children,
  tom = "neutro",
  icone,
  className,
}: {
  children: ReactNode;
  tom?: "neutro" | "atencao" | "perigo" | "rota";
  icone?: NomeIcone;
  className?: string;
}) {
  const cor = {
    neutro: "text-apagado",
    atencao: "text-atencao",
    perigo: "text-perigo",
    rota: "text-rota",
  }[tom];
  return (
    <p className={cn("flex items-start gap-1.5 text-pequeno italic", cor, className)}>
      {icone && <Icone nome={icone} tamanho={14} className="mt-px not-italic" />}
      <span>{children}</span>
    </p>
  );
}

/** Giro pequeno para "rodando" dentro de linha ou botão. */
export function Girando({ className, rotulo = "Carregando" }: { className?: string; rotulo?: string }) {
  return <Icone nome="carregando" tamanho={15} titulo={rotulo} className={cn("text-apagado", className)} />;
}
