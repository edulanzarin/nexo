"use client";

import { useState } from "react";
import { BarraComposicao, BarraProporcao } from "@/componentes/primitivos/barra";
import { Avatar } from "@/componentes/primitivos/avatar";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { Ponto, Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { brl, brlCompact, dataBR, num } from "@/lib/format";
import { Bloco, Familia, Variante } from "../bloco";
import { NOTAS_FALSAS, type NotaFalsa } from "../dados-falsos";

const ROTULO_SITUACAO: Record<NotaFalsa["situacao"], { rotulo: string; tom: "ok" | "atencao" | "perigo" | "rota" | "neutro" }> = {
  ok: { rotulo: "Correta", tom: "ok" },
  pendente: { rotulo: "Não contabilizada", tom: "atencao" },
  divergente: { rotulo: "Conta errada", tom: "perigo" },
  duplicada: { rotulo: "Duplicada", tom: "perigo" },
  consolidada: { rotulo: "Em bloco", tom: "rota" },
};

const COLUNAS: Coluna<NotaFalsa>[] = [
  {
    id: "numero",
    cabecalho: "Nota",
    largura: "150px",
    ordenar: (n) => n.numero,
    celula: (n) => (
      <span className="num text-tinta">
        {num(n.numero)}
        <span className="text-apagado">/{n.serie}</span>
        <span className="ml-2 text-pequeno text-apagado">{dataBR(n.data)}</span>
      </span>
    ),
  },
  { id: "contraparte", cabecalho: "Contraparte", ordenar: (n) => n.contraparte, celula: (n) => <span className="block max-w-[320px] truncate">{n.contraparte}</span> },
  { id: "cfop", cabecalho: "CFOP", largura: "110px", secundaria: true, celula: (n) => <span className="num text-apagado">{n.cfops.join(", ")}</span> },
  {
    id: "situacao",
    cabecalho: "Situação",
    largura: "190px",
    ordenar: (n) => n.situacao,
    celula: (n) => (
      <span className="flex items-center gap-1.5">
        <Selo tom={ROTULO_SITUACAO[n.situacao].tom}>{ROTULO_SITUACAO[n.situacao].rotulo}</Selo>
        {n.divergencias > 0 && <span className="num text-micro text-perigo">{n.divergencias} div.</span>}
      </span>
    ),
  },
  {
    id: "valor",
    cabecalho: "Valor",
    alinhar: "dir",
    largura: "130px",
    ordenar: (n) => n.valor,
    classe: "font-[600] text-tinta",
    celula: (n) => brl(n.valor),
    rodape: brl(NOTAS_FALSAS.reduce((s, n) => s + n.valor, 0)),
  },
];

export function BlocosDados() {
  const [estado, setEstado] = useState<"dado" | "carregando" | "vazio" | "erro">("dado");
  const [pagina, setPagina] = useState(1);
  const [sel, setSel] = useState<number | null>(null);

  return (
    <Familia id="dados" titulo="Dados e estados" descricao="Números, listas e o que a tela mostra enquanto carrega, quando não há nada e quando dá errado.">
      <Bloco
        titulo="Faixa de indicadores"
        porque="Os números da tela num painel só, divididos por fio, como um painel de instrumentos. Cartão por número repetiria borda, sombra e respiro seis vezes. A lâmpada no topo acende quando o número pede atenção; o valor só ganha a cor quando é o próprio alerta."
      >
        <div className="flex flex-col gap-3">
          <FaixaIndicadores>
            <Indicador rotulo="Notas de entrada" icone="nota" valor={num(1284)} detalhe="212 não exigem lançamento" />
            <Indicador rotulo="Não contabilizadas" icone="pendente" valor={num(32)} detalhe={`${brlCompact(84210)} a lançar`} tom="atencao" valorNoTom />
            <Indicador rotulo="Em bloco" icone="camadas" valor={num(5)} detalhe="R$ 12,4 mil em consolidação" tom="rota" />
            <Indicador rotulo="Conta errada" icone="alerta" valor={num(7)} detalhe="11 divergências" tom="perigo" valorNoTom />
            <Indicador rotulo="Duplicadas" icone="copiar" valor={num(0)} detalhe="nenhuma no período" />
            <Indicador rotulo="Corretas" icone="ok" valor={num(1028)} detalhe="94,1% das que exigem" tom="ok" />
          </FaixaIndicadores>
          <FaixaIndicadores>
            <Indicador rotulo="Carregando" valor="" detalhe="" carregando />
            <Indicador rotulo="Carregando" valor="" detalhe="" carregando />
            <Indicador rotulo="Carregando" valor="" detalhe="" carregando />
          </FaixaIndicadores>
        </div>
      </Bloco>

      <Bloco
        titulo="Tabela"
        porque="Linha de 34px, uma linha só, com o que se bate o olho; o detalhe abre em modal no clique. Cabeçalho gruda no contêiner que rola, valor alinha à direita em número tabular, coluna de apoio some abaixo de 900px. Os quatro estados abaixo."
      >
        <div className="flex flex-col gap-3">
          <Segmentado
            opcoes={[
              { valor: "dado", rotulo: "Com dado" },
              { valor: "carregando", rotulo: "Carregando" },
              { valor: "vazio", rotulo: "Vazio" },
              { valor: "erro", rotulo: "Erro" },
            ]}
            valor={estado}
            onMudar={setEstado}
          />
          {estado === "erro" ? (
            <PainelErro mensagem="A consulta demorou demais. Restrinja o período ou as empresas." onTentar={() => setEstado("dado")} />
          ) : (
            <Painel titulo="Notas do período" descricao="Entradas de agosto de 2026" corpo="p-0">
              {estado === "carregando" ? (
                <EsqueletoTabela colunas={5} linhas={6} />
              ) : (
                <TabelaDados
                  colunas={COLUNAS}
                  linhas={estado === "vazio" ? [] : NOTAS_FALSAS.slice(0, 8)}
                  chave={(n) => String(n.numero)}
                  onLinha={(n) => setSel(n.numero)}
                  selecionada={(n) => n.numero === sel}
                  ordemInicial={{ coluna: "valor", sentido: "desc" }}
                  vazio={
                    <Vazio
                      compacto
                      icone="filtrar"
                      titulo="Nenhuma nota com esse filtro"
                      descricao="Troque a situação para Todas ou limpe a busca."
                      acao={<Botao onClick={() => setEstado("dado")}>Limpar filtros</Botao>}
                    />
                  }
                />
              )}
              {estado === "dado" && (
                <div className="border-t border-linha px-4 py-2">
                  <Paginacao pagina={pagina} porPagina={8} total={1284} onPagina={setPagina} />
                </div>
              )}
            </Painel>
          )}
        </div>
      </Bloco>

      <Bloco
        titulo="Vazio"
        porque="Há dois: o da tela que ainda não foi usada ENSINA o que fazer; o do filtro que não achou nada diz o que afrouxar. Confundir os dois produz um Nenhum resultado para quem abriu a tela pela primeira vez."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="nx-vidro rounded-painel">
            <Vazio
              icone="banco"
              titulo="Nenhuma regra nesta conta ainda"
              descricao="Cada regra diz em que conta cai uma descrição do extrato. Comece pela que mais se repete."
              acao={<Botao variante="primario" icone="mais">Nova regra</Botao>}
            />
          </div>
          <div className="nx-vidro rounded-painel">
            <Vazio icone="filtrar" titulo="Nada com Conta errada no período" descricao="Todas as notas que exigem lançamento estão na conta que o plano pede." />
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Selo, ponto e nota"
        porque="Selo é fato curto sobre a linha e sempre leva palavra: cor sozinha não chega para quem é daltônico. Nota é a voz da ferramenta ao lado do dado, em itálico, só com o que a pessoa não sabe."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom="ok" icone="ok">Correta</Selo>
            <Selo tom="atencao" icone="pendente">Não contabilizada</Selo>
            <Selo tom="perigo" icone="alerta">Conta errada</Selo>
            <Selo tom="rota">Em bloco</Selo>
            <Selo tom="acento">Novo</Selo>
            <Selo>CLT</Selo>
            <span className="flex items-center gap-1.5 text-corpo text-tinta-2">
              <Ponto tom="ok" /> Ativa
            </span>
            <span className="flex items-center gap-1.5 text-corpo text-tinta-2">
              <Ponto tom="neutro" /> Parada há 94 dias
            </span>
          </div>
          <Nota icone="info">O Questor não guarda quem excluiu antes de mar/2025; essas linhas saem sem autor.</Nota>
          <Nota tom="atencao" icone="alerta">3 notas sem CFOP no plano. Elas aparecem como não contabilizadas até ganharem regra.</Nota>
        </div>
      </Bloco>

      <Bloco
        titulo="Barras de proporção e avatar"
        porque="A régua de um medidor é percentil, não máximo: escalar pelo maior deixa quase todas as barras no primeiro terço. Quem satura ganha a marca de corte."
      >
        <div className="flex max-w-xl flex-col gap-3">
          <Variante nome="Proporção">
            <BarraProporcao valor={0.72} />
            <BarraProporcao valor={0.31} tom="atencao" />
            <BarraProporcao valor={1.3} tom="perigo" />
          </Variante>
          <Variante nome="Composição">
            <BarraComposicao
              partes={[
                { rotulo: "Manual", valor: 42, cor: "var(--serie-1)" },
                { rotulo: "Importado", valor: 38, cor: "var(--serie-3)" },
                { rotulo: "Integração", valor: 20, cor: "var(--serie-5)" },
              ]}
            />
          </Variante>
          <Variante nome="Avatar">
            <div className="flex items-center gap-2">
              <Avatar nome="Eduardo Lanzarin" />
              <Avatar nome="Ana Paula Ribeiro" tamanho={36} />
              <Avatar nome="Bruno" tamanho={22} />
            </div>
          </Variante>
        </div>
      </Bloco>
    </Familia>
  );
}
