/**
 * Entrega ao navegador um arquivo que o servidor montou como texto (o CSV da
 * conciliação, o arquivo de saldos, o do patrimonial). O servidor devolve o
 * conteúdo no JSON, e não um download direto, porque junto vêm os números que
 * a tela precisa para avisar (linhas geradas, se a transitória zerou).
 *
 * O encoding é de quem chama: o patrimonial vai em Windows-1252 (bytes prontos),
 * que é o que o importador do Questor lê sem estragar acento.
 */
export function baixarArquivo(nome: string, conteudo: BlobPart, tipo: string): void {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
