/**
 * Copia texto para a área de transferência. `navigator.clipboard` só existe em
 * contexto seguro (HTTPS ou localhost), e o NaveX do escritório abre por
 * http://<ip>:4083: lá ele é `undefined`, e todo "copiar" falhava. Fora do
 * contexto seguro, cai no caminho antigo, uma caixa de texto invisível
 * selecionada e o `execCommand("copy")`, que ainda funciona dentro do clique.
 *
 * Devolve se copiou; quem chama decide o recado.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Permissão negada: tenta o caminho antigo antes de desistir.
    }
  }
  if (typeof document === "undefined") return false;
  const foco = document.activeElement as HTMLElement | null;
  const caixa = document.createElement("textarea");
  caixa.value = texto;
  caixa.setAttribute("readonly", "");
  caixa.style.position = "fixed";
  caixa.style.top = "-1000px";
  caixa.style.opacity = "0";
  document.body.appendChild(caixa);
  caixa.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  caixa.remove();
  foco?.focus?.();
  return ok;
}
