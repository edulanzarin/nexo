import { Building2 } from "lucide-react";
import type { SecaoFiscal } from "./fiscal-secoes";

/**
 * Seções do módulo Configurações — configs de domínio do sistema (grupos de
 * empresa de negócio, etc.), fora da Administração e gateadas por cargo como
 * qualquer módulo. Seção nova entra por último.
 */
export const SECOES_CONFIG: SecaoFiscal[] = [
  {
    id: "grupos-empresa",
    icone: Building2,
    rotulo: "Grupos de empresa",
    path: "/config/grupos-empresa",
    metrica: false,
    descricao: "Agrupa empresas por grupo de negócio (ex.: U FIT), usado em formulários e relatórios",
  },
];

export function secaoConfigAtual(pathname: string): SecaoFiscal | undefined {
  return SECOES_CONFIG.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));
}
