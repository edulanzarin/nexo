/**
 * Mutação: fetch com método e corpo JSON, e o erro amigável do servidor
 * (`{ error }`) virando `Error`. A tela chama, avisa e invalida a consulta.
 */
export async function mutar<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json().catch(() => ({}) as T);
}

/** Envio de arquivo (FormData): o navegador põe o boundary do multipart. */
export async function enviarArquivo<T = unknown>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(await mensagemDeErro(res));
  return res.json();
}

export async function mensagemDeErro(res: Response): Promise<string> {
  try {
    const b = await res.json();
    if (b?.error) return String(b.error);
  } catch {
    /* corpo não é JSON */
  }
  if (res.status === 401) return "Sua sessão expirou. Entre de novo.";
  if (res.status === 403) return "Você não tem acesso a esta função.";
  return `Erro ${res.status} no servidor`;
}
