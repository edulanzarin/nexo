import type { Metadata } from "next";
import { AvisoPublico, CascaPublica } from "@/componentes/casca/casca-publica";
import { resolverTokenPublico, type FormularioPublico } from "@/lib/formulario-publico";
import { FormularioPorLink } from "./formulario-por-link";

export const metadata: Metadata = { title: "Formulário do RH" };

/**
 * O formulário aberto por link, sem conta: o token do e-mail é a credencial.
 * Um token é de uma experiência, de uma avaliação de desempenho ou de um envio
 * (`resolverTokenPublico` unifica os três). Fora do proxy de login e da casca
 * do app; quem chega aqui quase sempre está no celular.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let dados: FormularioPublico | null = null;
  let falhou = false;
  try {
    dados = await resolverTokenPublico(token);
  } catch (e) {
    // Banco fora do ar: quem responde não tem o que fazer com o erro técnico.
    console.error("[formulario:abrir]", e);
    falhou = true;
  }

  let corpo;
  if (falhou)
    corpo = (
      <AvisoPublico
        titulo="Não deu para abrir o formulário"
        texto="Tente de novo em alguns minutos. Se continuar assim, fale com o RH da Navecon."
      />
    );
  else if (!dados)
    corpo = (
      <AvisoPublico
        titulo="Link inválido"
        texto="Este link não existe, expirou ou o formulário foi removido. Fale com o RH da Navecon."
      />
    );
  else if (dados.jaRespondido)
    corpo = dados.avisoFechado ? (
      <AvisoPublico titulo={dados.avisoFechado.titulo} texto={dados.avisoFechado.texto} />
    ) : (
      <AvisoPublico tom="ok" titulo="Formulário já respondido" texto="A resposta deste link já chegou ao RH. Obrigado." />
    );
  else {
    const c = cabecalho(dados);
    corpo = (
      <FormularioPorLink
        token={token}
        titulo={c.titulo}
        apoio={c.apoio}
        selo={c.selo}
        descricao={dados.formulario.descricao}
        mensagem={dados.mensagem}
        contexto={c.contexto}
        varias={dados.varias}
        campos={dados.formulario.campos}
      />
    );
  }

  return <CascaPublica>{corpo}</CascaPublica>;
}

/**
 * O título diz o que é e sobre quem. A lib entrega a pessoa avaliada como uma
 * linha do contexto ("Funcionário" na experiência, "Colaborador" no
 * desempenho); ela sobe para o título e sai da ficha, para não aparecer duas
 * vezes. No envio comum não há pessoa: vale o assunto do e-mail.
 */
function cabecalho(d: FormularioPublico) {
  const pessoa = d.contexto.find((c) => c.rotulo === "Funcionário" || c.rotulo === "Colaborador");
  const contexto = pessoa ? d.contexto.filter((c) => c !== pessoa) : d.contexto;
  if (d.origem === "experiencia" && pessoa)
    return { titulo: `${d.titulo} de ${pessoa.valor}`, apoio: null, selo: d.subtitulo, contexto };
  if (d.origem === "desempenho" && pessoa)
    return { titulo: `${d.subtitulo ?? "Avaliação"} de ${pessoa.valor}`, apoio: d.titulo, selo: null, contexto };
  return { titulo: d.titulo, apoio: null, selo: d.subtitulo, contexto: d.contexto };
}
