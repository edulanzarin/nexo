/**
 * Canal de DENÚNCIA — parte PURA (sem servidor). Enums, rótulos e DTOs
 * compartilhados entre o formulário público (client), a tela de acompanhamento
 * (client), a gestão do RH (client) e o serviço (server). Não importa `pg` nem
 * `server-only` para poder entrar no bundle.
 */

export const CATEGORIAS_DENUNCIA = [
  "assedio_moral",
  "assedio_sexual",
  "discriminacao",
  "fraude",
  "seguranca",
  "conduta",
  "outro",
] as const;

export type CategoriaDenuncia = (typeof CATEGORIAS_DENUNCIA)[number];

export const CATEGORIA_DENUNCIA_ROTULO: Record<CategoriaDenuncia, string> = {
  assedio_moral: "Assédio moral",
  assedio_sexual: "Assédio sexual",
  discriminacao: "Discriminação",
  fraude: "Fraude ou corrupção",
  seguranca: "Segurança / risco",
  conduta: "Conduta inadequada",
  outro: "Outro",
};

export const STATUS_DENUNCIA = ["recebida", "em_analise", "concluida", "arquivada"] as const;
export type StatusDenuncia = (typeof STATUS_DENUNCIA)[number];

export const STATUS_DENUNCIA_ROTULO: Record<StatusDenuncia, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

export function ehCategoria(v: string): v is CategoriaDenuncia {
  return (CATEGORIAS_DENUNCIA as readonly string[]).includes(v);
}
export function ehStatusDenuncia(v: string): v is StatusDenuncia {
  return (STATUS_DENUNCIA as readonly string[]).includes(v);
}

export interface MensagemDenuncia {
  autor: "denunciante" | "rh";
  /** Nome do usuário do RH que respondeu; null quando o autor é o denunciante. */
  autorNome: string | null;
  corpo: string;
  criadoEm: string;
}

/** O que o denunciante vê ao acompanhar pelo protocolo+senha. Sem id interno. */
export interface DenunciaPublica {
  protocolo: string;
  categoria: CategoriaDenuncia;
  status: StatusDenuncia;
  relato: string;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: MensagemDenuncia[];
}

/** Linha da fila de gestão do RH. */
export interface DenunciaResumo {
  id: number;
  protocolo: string;
  categoria: CategoriaDenuncia;
  status: StatusDenuncia;
  setorEnvolvido: string | null;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: number;
  /** Última interação foi do denunciante (ou nunca respondida) e o caso está aberto. */
  aguardandoRh: boolean;
}

/** Detalhe aberto na gestão (relato + thread + status). */
export interface DenunciaDetalhe extends DenunciaPublica {
  id: number;
  setorEnvolvido: string | null;
}

export interface DenunciaDashboard {
  total: number;
  porStatus: Record<StatusDenuncia, number>;
  porCategoria: { categoria: CategoriaDenuncia; qtd: number }[];
  aguardandoRh: number;
  /** Horas médias até a 1ª resposta do RH (null se nenhuma respondida ainda). */
  horasPrimeiraResposta: number | null;
}
