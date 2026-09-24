import { BlocosContabilBalancetes } from "./blocos/contabil-balancetes";
import { BlocosContabilConciliacao } from "./blocos/contabil-conciliacao";
import { BlocosContabilProdutividade } from "./blocos/contabil-produtividade";
import { BlocosContabilRotina } from "./blocos/contabil-rotina";
import { BlocosContabilVisao } from "./blocos/contabil-visao";
import { BlocosControles } from "./blocos/controles";
import { BlocosDados } from "./blocos/dados";
import { BlocosFundamentos } from "./blocos/fundamentos";
import { BlocosGraficos } from "./blocos/graficos";
import { BlocosProduto } from "./blocos/produto";
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
      </div>
    </Semeador>
  );
}
