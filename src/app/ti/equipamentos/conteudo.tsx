"use client";

import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { CelulaEquipamento, CelulaPosse, Patrimonio } from "@/componentes/produto/ti/equipamento";
import { useJanelasTi } from "@/componentes/produto/ti/janelas";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { decimalBR } from "@/lib/csv";
import { dataBR, num } from "@/lib/format";
import {
  chaveDaPosse,
  comAlguem,
  setorOuVinculo,
  nomeEquipamento,
  resumoSpecs,
  situacaoDaPosse,
  textoPosse,
  TIPOS_EQUIPAMENTO,
  tipoEquipamento,
  type EquipamentoLista,
  type Situacao,
} from "@/lib/ti-tipos";

type Filtro = "ativos" | Situacao | "externos" | "fora";

const ROTULO_FILTRO: Record<Filtro, string> = {
  ativos: "Todos os ativos",
  uso: "Em uso",
  estoque: "No estoque",
  manutencao: "Em manutenção",
  baixado: "Baixados",
  externos: "Com gente de fora",
  fora: "A recolher",
};

const TODOS = "*";

/**
 * Inventário: todo equipamento da Navecon, com quem está e desde quando. A
 * lista vem inteira (algumas centenas de itens) e se recorta aqui por
 * situação, tipo e busca. Os números do topo são os filtros: clicar leva à
 * lista daquilo.
 *
 * O que pede ação sobe para o número: o que está em manutenção e o que ficou
 * com quem não está mais no Diretório, que é o equipamento a recolher.
 */
export default function Conteudo() {
  const j = useJanelasTi();
  const { fora } = j;
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "ativos");
  const [tipo, setTipo] = useEstadoTela("tipo", TODOS);
  const [busca, setBusca] = useEstadoTela("busca", "");

  const d = j.lista.data;
  const todos = useMemo(() => d ?? [], [d]);

  const resumo = useMemo(() => {
    const r = { ativos: 0, uso: 0, estoque: 0, manutencao: 0, baixado: 0, externos: 0, fora: 0, pessoas: new Set<string>() };
    for (const e of todos) {
      const s = situacaoDaPosse(e.posse);
      r[s]++;
      if (s !== "baixado") r.ativos++;
      if (comAlguem(e.posse)) r.pessoas.add(chaveDaPosse(e.posse));
      if (e.posse.destino === "externo") r.externos++;
      if (fora(e.posse)) r.fora++;
    }
    return r;
  }, [todos, fora]);

  const opcoesTipo = useMemo<Opcao[]>(() => {
    const n = new Map<string, number>();
    for (const e of todos) n.set(e.tipo, (n.get(e.tipo) ?? 0) + 1);
    return [
      { valor: TODOS, rotulo: "Todos os tipos", detalhe: num(todos.length) },
      ...TIPOS_EQUIPAMENTO.filter((t) => n.has(t.id) || t.id === tipo).map((t) => ({
        valor: t.id,
        rotulo: t.rotulo,
        icone: t.icone as Opcao["icone"],
        detalhe: num(n.get(t.id) ?? 0),
      })),
    ];
  }, [todos, tipo]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return todos.filter((e) => {
      const s = situacaoDaPosse(e.posse);
      if (filtro === "ativos" && s === "baixado") return false;
      if (filtro === "fora" && !fora(e.posse)) return false;
      if (filtro === "externos" && e.posse.destino !== "externo") return false;
      if (filtro !== "ativos" && filtro !== "fora" && filtro !== "externos" && s !== filtro) return false;
      if (tipo !== TODOS && e.tipo !== tipo) return false;
      if (!partes.length) return true;
      const setor = setorOuVinculo(e.posse);
      const alvo = normalizar(
        `${e.patrimonio ?? ""} ${nomeEquipamento(e)} ${e.numeroSerie ?? ""} ${textoPosse(e.posse)} ${setor} ${Object.values(
          e.especificacoes
        ).join(" ")}`
      );
      return partes.every((p) => alvo.includes(p));
    });
  }, [todos, filtro, tipo, termo, fora]);

  const colunas: Coluna<EquipamentoLista>[] = [
    {
      id: "patrimonio",
      cabecalho: "Patrimônio",
      largura: "120px",
      ordenar: (e) => e.patrimonio,
      celula: (e) => <Patrimonio codigo={e.patrimonio} />,
    },
    {
      id: "equipamento",
      cabecalho: "Equipamento",
      largura: "40%",
      ordenar: (e) => nomeEquipamento(e),
      celula: (e) => <CelulaEquipamento e={e} />,
    },
    {
      id: "posse",
      cabecalho: "Com quem está",
      largura: "34%",
      ordenar: (e) => textoPosse(e.posse),
      celula: (e) => <CelulaPosse posse={e.posse} fora={fora(e.posse)} />,
    },
    {
      id: "desde",
      cabecalho: "Desde",
      largura: "110px",
      secundaria: true,
      ordenar: (e) => e.desde,
      celula: (e) => <span className="num">{dataBR(e.desde)}</span>,
    },
  ];

  if (j.lista.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar o inventário"
        mensagem={(j.lista.error as Error).message}
        onTentar={() => j.lista.refetch()}
      />
    );

  const filtrado = filtro !== "ativos" || tipo !== TODOS || busca !== "";
  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="notebook"
        titulo="Nenhum equipamento cadastrado"
        descricao="Cadastre os notebooks, monitores e periféricos da Navecon, cada um com quem está hoje. Dali em diante, cada entrega e devolução fica no histórico."
        acao={
          <Botao variante="primario" icone="mais" onClick={j.novo}>
            Cadastrar equipamento
          </Botao>
        }
      />
    );
  else
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhum equipamento neste filtro"
        acao={
          filtrado ? (
            <Botao
              onClick={() => {
                setFiltro("ativos");
                setTipo(TODOS);
                setBusca("");
              }}
            >
              Limpar filtros
            </Botao>
          ) : undefined
        }
      />
    );

  const descricaoFiltro = [
    ROTULO_FILTRO[filtro],
    tipo !== TODOS && tipoEquipamento(tipo).rotulo,
    busca && `busca "${busca}"`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="ti"
          desabilitado={!d?.length}
          cortes={[
            {
              id: "inventario",
              rotulo: "Inventário",
              descricao: descricaoFiltro,
              nome: "inventario-ti",
              montar: () => ({
                cabecalhos: [
                  "Patrimônio",
                  "Tipo",
                  "Marca",
                  "Modelo",
                  "Número de série",
                  "Especificações",
                  "Com quem está",
                  "Setor ou vínculo",
                  "Desde",
                  "Data da compra",
                  "Valor",
                  "Garantia até",
                ],
                linhas: linhas.map((e) => [
                  e.patrimonio ?? "",
                  tipoEquipamento(e.tipo).rotulo,
                  e.marca ?? "",
                  e.modelo ?? "",
                  e.numeroSerie ?? "",
                  resumoSpecs(e, 6),
                  textoPosse(e.posse),
                  setorOuVinculo(e.posse),
                  dataBR(e.desde),
                  e.dataCompra ? dataBR(e.dataCompra) : "",
                  e.valorCompra != null ? decimalBR(e.valorCompra) : "",
                  e.garantiaAte ? dataBR(e.garantiaAte) : "",
                ]),
              }),
            },
          ]}
        />
        <Botao
          icone="transferir"
          disabled={!d?.length}
          onClick={() => j.movimentar({ ids: [], destino: "pessoa" })}
        >
          Movimentar
        </Botao>
        <Botao variante="primario" icone="mais" onClick={j.novo}>
          Novo equipamento
        </Botao>
      </AcoesPagina>

      <FaixaIndicadores>
        <Indicador
          rotulo="Equipamentos"
          icone="equipamento"
          carregando={!d}
          valor={num(resumo.ativos)}
          detalhe={
            resumo.baixado
              ? `${num(resumo.baixado)} ${resumo.baixado === 1 ? "baixado fica" : "baixados ficam"} fora da conta`
              : "no inventário"
          }
          onClick={() => setFiltro("ativos")}
        />
        <Indicador
          rotulo="Em uso"
          icone="usuario"
          carregando={!d}
          valor={num(resumo.uso)}
          detalhe={`com ${num(resumo.pessoas.size)} ${resumo.pessoas.size === 1 ? "pessoa" : "pessoas"}`}
          onClick={() => setFiltro("uso")}
        />
        <Indicador
          rotulo="No estoque"
          icone="estoque"
          carregando={!d}
          valor={num(resumo.estoque)}
          detalhe="prontos para entregar"
          onClick={() => setFiltro("estoque")}
        />
        <Indicador
          rotulo="Em manutenção"
          icone="manutencao"
          carregando={!d}
          valor={num(resumo.manutencao)}
          tom={resumo.manutencao ? "atencao" : "neutro"}
          detalhe={resumo.manutencao ? "fora de uso agora" : "nada parado"}
          onClick={() => setFiltro("manutencao")}
        />
        {resumo.fora > 0 && (
          <Indicador
            rotulo="A recolher"
            icone="alerta"
            valor={num(resumo.fora)}
            tom="atencao"
            valorNoTom
            detalhe="com quem saiu ou foi encerrado"
            onClick={() => setFiltro("fora")}
          />
        )}
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Equipamentos"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            {d ? `${num(linhas.length)} de ${num(todos.length)} · ${descricaoFiltro}` : "Carregando"}
            {j.lista.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <>
            <Combo
              opcoes={(Object.keys(ROTULO_FILTRO) as Filtro[]).map((f) => ({
                valor: f,
                rotulo: ROTULO_FILTRO[f],
                detalhe: num(f === "ativos" ? resumo.ativos : resumo[f]),
              }))}
              valor={filtro}
              onMudar={(v) => setFiltro(v as Filtro)}
              rotuloAcessivel="Situação"
              className="w-52"
              busca={false}
            />
            <Combo
              opcoes={opcoesTipo}
              valor={tipo}
              onMudar={setTipo}
              rotuloAcessivel="Tipo"
              className="w-44"
              busca={false}
            />
            <Campo
              icone="buscar"
              placeholder="Patrimônio, modelo ou pessoa"
              aria-label="Buscar equipamento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-60"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
          </>
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={4} linhas={8} />
        ) : (
          <TabelaDados
            rotulo="Equipamentos"
            colunas={colunas}
            linhas={linhas}
            chave={(e) => String(e.id)}
            onLinha={(e) => j.abrirFicha(e.id)}
            selecionada={(e) => e.id === j.fichaAberta}
            ordemInicial={{ coluna: "patrimonio", sentido: "asc" }}
            alturaMax="min(68dvh, 760px)"
            vazio={vazio}
          />
        )}
      </Painel>

      {j.elemento}
    </>
  );
}
