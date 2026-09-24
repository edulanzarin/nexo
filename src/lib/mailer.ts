import "server-only";
import nodemailer from "nodemailer";

/**
 * Envio de e-mail do app, por SMTP (nodemailer). Config vem do ambiente:
 *   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ("true" p/ 465), SMTP_USER,
 *   SMTP_PASS, SMTP_FROM (remetente; cai no SMTP_USER).
 *
 * Sem SMTP_HOST configurado (dev, ou antes das credenciais da Navecon), cai num
 * DRIVER DE LOG: registra o e-mail no console em vez de mandar — assim o fluxo
 * funciona ponta a ponta sem engolir a mensagem silenciosamente. `enviado`
 * conta se foi de fato despachado (para o log de lembretes distinguir).
 */

declare global {
  var _mailer: nodemailer.Transporter | undefined;
}

function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): nodemailer.Transporter {
  if (global._mailer) return global._mailer;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  if (process.env.NODE_ENV !== "production") global._mailer = t;
  return t;
}

export interface Email {
  para: string | string[];
  assunto: string;
  html: string;
  texto?: string;
}

/** Remetente configurado, ou o próprio usuário SMTP. */
export function remetente(): string {
  return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@navecon.local";
}

function textoDoHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function enviarEmail(email: Email): Promise<{ enviado: boolean }> {
  const para = Array.isArray(email.para) ? email.para.join(", ") : email.para;
  const texto = email.texto ?? textoDoHtml(email.html);

  if (!smtpConfigurado()) {
    console.info(
      `[mailer:log] SMTP não configurado — e-mail não enviado.\n  para: ${para}\n  assunto: ${email.assunto}\n  ${texto}`
    );
    return { enviado: false };
  }

  await getTransport().sendMail({
    from: remetente(),
    to: para,
    subject: email.assunto,
    html: email.html,
    text: texto,
  });
  return { enviado: true };
}
