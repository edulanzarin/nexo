import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { FilterError } from "@/lib/fiscal-filters";
import { empresaQuestorPorCnpj, sincronizarEmpresa } from "@/lib/obrigacoes";
import { setoresDaSecao } from "@/lib/obrigacoes-secoes";
import { getSessaoOpcional, podeSecao, podeVerEmpresa } from "@/lib/sessao";

/**
 * Consulta AO VIVO a fila de uma empresa — a contrapartida rápida da varredura.
 * Uma empresa é uma chamada à API (~1s), porque o CNPJ é a única chave que
 * `deliveries` aceita; é justamente por isso que o retrato do escritório inteiro
 * é caro e este aqui é barato.
 *
 * Escreve o resultado no retrato local (ver `sincronizarEmpresa`), então também
 * serve de "atualizar esta empresa" — a tela não fica divergindo do painel.
 */
export const POST = apiRoute(async (req: NextRequest) => {
  const secao = req.nextUrl.searchParams.get("secao")?.trim() ?? "";
  const setores = setoresDaSecao(secao);
  if (setores === undefined) throw new FilterError("Seção inválida");

  const sessao = await getSessaoOpcional();
  if (!sessao || !podeSecao(sessao, "obrigacoes", secao)) {
    throw new FilterError("Seção fora do seu acesso");
  }

  const bruto = req.nextUrl.searchParams.get("cnpj")?.trim() ?? "";
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length !== 14 && digitos.length !== 11) {
    throw new FilterError("Informe um CNPJ (14 dígitos) ou CPF (11)");
  }

  // Escopo ANTES de consultar: sem isso, quem tem carteira restrita usaria esta
  // rota para ler qualquer empresa do escritório digitando o CNPJ.
  const codigoempresa = await empresaQuestorPorCnpj(digitos);
  if (codigoempresa == null) {
    // Sem par no Questor não há como recortar — só quem vê todas alcança, mesma
    // regra da fila materializada.
    if (!sessao.empresas.todas) {
      throw new FilterError("Empresa sem correspondência no Questor — fora do seu escopo");
    }
  } else if (!podeVerEmpresa(sessao, codigoempresa)) {
    throw new FilterError("Empresa fora do seu escopo de acesso");
  }

  // O CNPJ vai formatado na URL da API; ela devolve e aceita com pontuação.
  const formatado =
    digitos.length === 14
      ? digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

  const todas = await sincronizarEmpresa(formatado);
  // Recorte de setor da seção: a fila do DP não mostra pendência do Fiscal.
  const fila = setores.length ? todas.filter((e) => setores.includes(e.dptoId)) : todas;

  return { cnpj: formatado, empresa: fila[0]?.empresa ?? todas[0]?.empresa ?? null, fila };
});
