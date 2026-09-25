import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { ehEmpresaRh } from "@/lib/rh";
import { MARCOS, type Marco } from "@/lib/rh-experiencia";
import {
  buscarUmContrato,
  vencimentoMarco,
  enviarFormularioExperiencia,
} from "@/lib/rh-experiencia-dados";

/** Reenvio manual do formulário de experiência de um marco, pela tela. */
export const POST = apiRoute(async (req) => {
  const body = (await req.json()) as Record<string, unknown>;
  const codigoempresa = Number(body.codigoempresa);
  const contrato = Number(body.contrato);
  const marco = Number(body.marco) as Marco;

  if (!ehEmpresaRh(codigoempresa)) throw new FilterError("Empresa inválida");
  if (!Number.isInteger(contrato)) throw new FilterError("Contrato inválido");
  if (!(MARCOS as readonly number[]).includes(marco)) throw new FilterError("Marco inválido");

  const c = await buscarUmContrato(codigoempresa, contrato);
  if (!c) throw new FilterError("Contrato não encontrado");

  const r = await enviarFormularioExperiencia({
    contrato: c,
    marco,
    vencimento: vencimentoMarco(c.dataadm, marco),
    slot: -1,
    forcado: true,
  });
  if (r.semFormulario) {
    throw new FilterError(
      "Nenhum formulário ligado a este marco — escolha um na configuração da Experiência"
    );
  }
  if (r.semGestores) {
    throw new FilterError("Setor sem gestor cadastrado — cadastre um gestor antes de enviar");
  }
  return { ok: true, enviado: r.enviado, destinatarios: r.destinatarios };
});
