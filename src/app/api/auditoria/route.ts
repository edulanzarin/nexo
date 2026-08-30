import { NextRequest, NextResponse } from "next/server";
import { getSessaoOpcional } from "@/lib/sessao";
import { registrarAuditoria } from "@/lib/auditoria";
import type { ModuloId } from "@/lib/modulos";

/**
 * Beacon de auditoria para eventos que só o CLIENTE conhece: exportações
 * (CSV/PDF disparadas no navegador) e CONSULTAS executadas.
 *
 * Exige sessão. A ação é DERIVADA do módulo e de um tipo de lista fechada
 * (`<modulo>.export`, `<modulo>.consulta`), nunca vem crua do corpo: um usuário
 * logado não consegue forjar um evento arbitrário na trilha. `alvo` é livre,
 * mas truncado.
 *
 * Por que consulta entra numa trilha que a migration 015 definiu como "não é log
 * de navegação": uma consulta aqui não é uma tela aberta, é um clique no botão
 * Executar que varre a base inteira do escritório por dezenas de segundos. Numa
 * investigação, "quem puxou o fiscal de todas as empresas em março" é
 * exatamente a pergunta — e é UM registro por clique, não um por requisição
 * (uma tela de seis cartões dispara seis consultas e continua sendo um gesto).
 */
const MODULOS_VALIDOS: ModuloId[] = ["fiscal", "contabil", "folha", "rh"];
const TIPOS_VALIDOS = ["export", "consulta"] as const;
type TipoEvento = (typeof TIPOS_VALIDOS)[number];

export async function POST(req: NextRequest) {
  const sessao = await getSessaoOpcional();
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { modulo?: string; tipo?: string; alvo?: string; codigoempresa?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const modulo = body.modulo as ModuloId;
  if (!MODULOS_VALIDOS.includes(modulo)) {
    return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  }
  // Sem `tipo` é exportação: é o que o beacon fazia antes de a consulta existir,
  // e cliente de aba aberta durante o deploy continua mandando o corpo antigo.
  const tipo = (TIPOS_VALIDOS as readonly string[]).includes(body.tipo ?? "")
    ? (body.tipo as TipoEvento)
    : "export";
  const alvo = typeof body.alvo === "string" ? body.alvo.slice(0, 200) : undefined;
  const codigoempresa =
    Number.isInteger(body.codigoempresa) && (body.codigoempresa as number) > 0
      ? body.codigoempresa
      : null;

  await registrarAuditoria({ acao: `${modulo}.${tipo}`, modulo, alvo, codigoempresa });
  return NextResponse.json({ ok: true });
}
