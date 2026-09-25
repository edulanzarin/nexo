// O catálogo mostra rótulos relativos a hoje (Mês passado, Últimos 3 meses).
// Gerado estático no build, ele congelaria no dia do deploy e divergiria do
// navegador na hidratação.
export const dynamic = "force-dynamic";

import { BlocosContabilBalancetes } from "./blocos/contabil-balancetes";
import { BlocosContabilConciliacao } from "./blocos/contabil-conciliacao";
import { BlocosContabilProdutividade } from "./blocos/contabil-produtividade";
import { BlocosContabilRotina } from "./blocos/contabil-rotina";
import { BlocosContabilVisao } from "./blocos/contabil-visao";
import { BlocosConfig } from "./blocos/config";
import { BlocosControles } from "./blocos/controles";
import { BlocosDados } from "./blocos/dados";
import { BlocosDpPessoal } from "./blocos/dp-pessoal";
import { BlocosDpProdutividade } from "./blocos/dp-produtividade";
import { BlocosDpRotina } from "./blocos/dp-rotina";
import { BlocosFiscalVisao } from "./blocos/fiscal-visao";
import { BlocosFundamentos } from "./blocos/fundamentos";
import { BlocosObrigacoesFila } from "./blocos/obrigacoes-fila";
import { BlocosObrigacoesVarredura } from "./blocos/obrigacoes-varredura";
import { BlocosGraficos } from "./blocos/graficos";
import { BlocosProduto } from "./blocos/produto";
import { BlocosRhAvaliacoes } from "./blocos/rh-avaliacoes";
import { BlocosRhBase } from "./blocos/rh-base";
import { BlocosRhCanais } from "./blocos/rh-canais";
import { BlocosRhFormularios } from "./blocos/rh-formularios";
import { BlocosRhPessoas } from "./blocos/rh-pessoas";
import { BlocosSobreposicoes } from "./blocos/sobreposicoes";
import { Familia } from "./bloco";
import { Semeador } from "./semeador";

export default function PaginaSistema() {
  return (
    <Semeador>
      <div className="flex flex-col gap-16">
        <BlocosFundamentos />
        <BlocosControles />
        <BlocosSobreposicoes />
        <BlocosDados />
        <BlocosGraficos />
        <BlocosProduto />
        <Familia id="contabil" titulo="Contábil" descricao="Peças que só o Contábil usa, nascidas nas telas dele.">
          <BlocosContabilVisao />
          <BlocosContabilRotina />
          <BlocosContabilBalancetes />
          <BlocosContabilConciliacao />
          <BlocosContabilProdutividade />
        </Familia>
        {/* A Produtividade do Fiscal é montada com as peças do Contábil: as
            abas dela não criaram peça nova, só estenderam a composição. */}
        <Familia id="fiscal" titulo="Fiscal" descricao="Peças que só o Fiscal usa, nascidas nas telas dele.">
          <BlocosFiscalVisao />
        </Familia>
        {/* A ficha, as quebras e a tela inteira da Rotatividade moram em
            produto/pessoal porque o RH usa as mesmas peças; o catálogo as
            mostra aqui, onde nasceram. */}
        <Familia id="dp" titulo="DP" descricao="Peças que só o DP usa, nascidas nas telas dele.">
          <BlocosDpRotina />
          <BlocosDpPessoal />
          <BlocosDpProdutividade />
        </Familia>
        <Familia id="rh" titulo="RH" descricao="Peças que só o RH usa, nascidas nas telas dele e nas páginas abertas do canal.">
          <BlocosRhBase />
          <BlocosRhPessoas />
          <BlocosRhAvaliacoes />
          <BlocosRhFormularios />
          <BlocosRhCanais />
        </Familia>
        <Familia id="obrigacoes" titulo="Obrigações" descricao="A fila de entregas do Acessórias e a varredura que a alimenta.">
          <BlocosObrigacoesFila />
          <BlocosObrigacoesVarredura />
        </Familia>
        <Familia
          id="config"
          titulo="Configurações"
          descricao="Os cadastros que as telas dos outros módulos leem, como os grupos de empresa."
        >
          <BlocosConfig />
        </Familia>
      </div>
    </Semeador>
  );
}
