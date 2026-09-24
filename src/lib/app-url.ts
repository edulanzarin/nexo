import "server-only";
import { headers } from "next/headers";

function urlFromEnv(): string {
  return (process.env.APP_URL ?? "http://localhost:4022").replace(/\/+$/, "");
}

/**
 * URL base do app para montar links públicos (formulários por token).
 * Prefere o host da requisição atual (quando a RH dispara pela tela ou o cron
 * bate com o IP certo); senão cai em APP_URL; por último localhost (dev).
 */
export async function appUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? "http";
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    // Fora de contexto de requisição — usa APP_URL.
  }
  return urlFromEnv();
}
