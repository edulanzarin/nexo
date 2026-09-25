import "server-only";
import type { DadosCasca } from "@/componentes/casca/casca-cliente";
import { MODULOS } from "./modulos";
import { secoesVisiveis, type Sessao } from "./sessao";

/** O recorte da sessão que a moldura desenha: quem é e que seções alcança. */
export function dadosCasca(sessao: Sessao): DadosCasca {
  const acessos: DadosCasca["acessos"] = {};
  for (const m of MODULOS) {
    const vis = [...secoesVisiveis(sessao, m.id)];
    if (vis.length) acessos[m.id] = vis;
  }
  return {
    usuario: {
      id: sessao.usuario.id,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      admin: sessao.usuario.admin,
      fotoVersao: sessao.usuario.avatarVersao,
    },
    acessos,
  };
}
