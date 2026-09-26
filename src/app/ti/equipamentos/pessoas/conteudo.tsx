"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { useJanelasTi } from "@/componentes/produto/ti/janelas";
import {
  ChipsEquipamentos,
  ModalPessoaTi,
  SeloPessoa,
  type PessoaComEquipamentos,
} from "@/componentes/produto/ti/pessoa-equipamentos";
import { ModalExterno } from "@/componentes/produto/ti/recebedor";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useMovimentacoesTi } from "@/hooks/use-ti";
import { num } from "@/lib/format";
import {
  chaveDaPosse,
  chaveExterno,
  chavePessoa,
  comAlguem,
  nomeEquipamento,
  setorOuVinculo,
  type PessoaExterna,
} from "@/lib/ti-tipos";

type Filtro = "com" | "sem" | "externos" | "fora" | "todas";

const ROTULO: Record<Filtro, string> = {
  com: "Com equipamento",
  sem: "Sem equipamento",
  externos: "De fora do Diretório",
  fora: "A recolher",
  todas: "Todas as pessoas",
};

/**
 * Por Pessoa: o inventário lido pelo lado de quem tem. Junta o Diretório do RH,
 * quem é de fora dele (o cadastro da TI) e o que cada um tem em mãos. Mostra
 * também quem está SEM equipamento (a pessoa que chegou e ainda não recebeu) e
 * quem precisa devolver: saiu do Diretório, ou é de fora e teve o cadastro
 * encerrado.
 */
export default function Conteudo() {
  const j = useJanelasTi();
  const movs = useMovimentacoesTi();
  const [filtro, setFiltro] = useEstadoTela<Filtro>("filtro", "com");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [aberta, setAberta] = useState<string | null>(null);
  const [externo, setExterno] = useState<PessoaExterna | "novo" | null>(null);
  const { fora } = j;

  const equipamentos = j.lista.data;
  const diretorio = j.pessoas.data;
  const externos = j.externos.data;

  const pessoas = useMemo<PessoaComEquipamentos[] | null>(() => {
    if (!equipamentos) return null;
    const m = new Map<string, PessoaComEquipamentos>();
    for (const p of diretorio ?? []) {
      const chave = chavePessoa(p.empresa, p.contrato);
      m.set(chave, { chave, nome: p.nome, setor: p.setor, cargo: p.cargo, fora: false, externo: null, itens: [] });
    }
    for (const x of externos ?? []) {
      const chave = chaveExterno(x.id);
      m.set(chave, { chave, nome: x.nome, setor: x.vinculo, cargo: null, fora: !x.ativo, externo: x, itens: [] });
    }
    for (const e of equipamentos) {
      if (!comAlguem(e.posse)) continue;
      const chave = chaveDaPosse(e.posse);
      let p = m.get(chave);
      if (!p) {
        // Não está em nenhum dos cadastros de hoje: o nome e o setor são os da entrega.
        p = {
          chave,
          nome: e.posse.nome,
          setor: setorOuVinculo(e.posse) || null,
          cargo: null,
          fora: fora(e.posse),
          externo: null,
          itens: [],
        };
        m.set(chave, p);
      }
      p.itens.push(e);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [equipamentos, diretorio, externos, fora]);

  /** Precisa devolver e ainda tem o que devolver. */
  const aRecolher = (p: PessoaComEquipamentos) => p.fora && p.itens.length > 0;

  const contagem = useMemo(() => {
    const c = { com: 0, sem: 0, externos: 0, fora: 0, todas: 0, itens: 0 };
    for (const p of pessoas ?? []) {
      c.todas++;
      if (p.itens.length) c.com++;
      else if (!p.fora && !p.externo) c.sem++;
      if (p.externo) c.externos++;
      if (aRecolher(p)) c.fora++;
      c.itens += p.itens.length;
    }
    return c;
  }, [pessoas]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return (pessoas ?? []).filter((p) => {
      if (filtro === "com" && !p.itens.length) return false;
      // Sem equipamento é gente da casa que ainda não recebeu; quem é de fora
      // sem nada é só um cadastro.
      if (filtro === "sem" && (p.itens.length || p.fora || p.externo)) return false;
      if (filtro === "externos" && !p.externo) return false;
      if (filtro === "fora" && !aRecolher(p)) return false;
      if (!partes.length) return true;
      const alvo = normalizar(
        `${p.nome} ${p.setor ?? ""} ${p.cargo ?? ""} ${p.itens.map((e) => `${e.patrimonio ?? ""} ${nomeEquipamento(e)}`).join(" ")}`
      );
      return partes.every((t) => alvo.includes(t));
    });
  }, [pessoas, filtro, termo]);

  const aPessoa = aberta ? (pessoas?.find((p) => p.chave === aberta) ?? null) : null;

  const colunas: Coluna<PessoaComEquipamentos>[] = [
    {
      id: "pessoa",
      cabecalho: "Pessoa",
      largura: "38%",
      ordenar: (p) => p.nome,
      celula: (p) => (
        <span className="flex min-w-0 flex-col py-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-tinta">{p.nome}</span>
            <SeloPessoa pessoa={p} />
          </span>
          <span className="truncate text-pequeno text-apagado">
            {[p.setor, p.cargo].filter(Boolean).join(" · ") || (p.externo ? "De fora do Diretório" : "Sem setor")}
          </span>
        </span>
      ),
    },
    {
      id: "itens",
      cabecalho: "Equipamentos",
      largura: "50%",
      celula: (p) => <ChipsEquipamentos itens={p.itens} />,
    },
    {
      id: "qtd",
      cabecalho: "Qtd.",
      alinhar: "dir",
      largura: "70px",
      ordenar: (p) => p.itens.length,
      celula: (p) => <span className="num">{num(p.itens.length)}</span>,
    },
  ];

  const erro = j.lista.error ?? j.pessoas.error;
  if (erro && !pessoas)
    return (
      <PainelErro
        titulo="Não deu para carregar"
        mensagem={(erro as Error).message}
        onTentar={() => {
          j.lista.refetch();
          j.pessoas.refetch();
        }}
      />
    );

  let vazio: ReactNode;
  if (termo || filtro !== "com")
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo={filtro === "fora" && !termo ? "Nada a recolher" : "Ninguém neste filtro"}
        acao={
          <Botao
            onClick={() => {
              setFiltro("com");
              setBusca("");
            }}
          >
            Voltar para quem tem equipamento
          </Botao>
        }
      />
    );
  else
    vazio = (
      <Vazio
        icone="pessoas"
        titulo="Ninguém com equipamento ainda"
        descricao="Quando um equipamento for entregue a alguém, do Diretório ou de fora dele, a pessoa aparece aqui com o que tem em mãos."
      />
    );

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="ti"
          desabilitado={!linhas.length}
          cortes={[
            {
              id: "pessoas",
              rotulo: "Por pessoa",
              descricao: ROTULO[filtro],
              nome: "equipamentos-por-pessoa",
              montar: () => ({
                cabecalhos: ["Pessoa", "Setor ou vínculo", "Cargo", "Situação", "Equipamentos", "Qtd."],
                linhas: linhas.map((p) => [
                  p.nome,
                  p.setor ?? "",
                  p.cargo ?? "",
                  p.externo
                    ? p.fora
                      ? "De fora, cadastro encerrado"
                      : "De fora do Diretório"
                    : p.fora
                      ? "Fora do Diretório"
                      : "No Diretório",
                  p.itens.map((e) => (e.patrimonio ? `${e.patrimonio} ${nomeEquipamento(e)}` : nomeEquipamento(e))).join("; "),
                  p.itens.length,
                ]),
              }),
            },
          ]}
        />
        <Botao icone="mais" onClick={() => setExterno("novo")}>
          Pessoa de fora
        </Botao>
      </AcoesPagina>

      {j.pessoas.isError && (
        <Nota tom="atencao" icone="alerta">
          O Diretório do RH não respondeu: a lista mostra só quem tem equipamento, sem saber quem saiu.
        </Nota>
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Com equipamento"
          icone="usuario"
          carregando={!pessoas}
          valor={num(contagem.com)}
          detalhe={`${num(contagem.itens)} ${contagem.itens === 1 ? "equipamento" : "equipamentos"} em mãos`}
          onClick={() => setFiltro("com")}
        />
        <Indicador
          rotulo="Sem equipamento"
          icone="pessoas"
          carregando={!pessoas || !diretorio}
          valor={num(contagem.sem)}
          detalhe="no Diretório, sem nada da TI"
          onClick={() => setFiltro("sem")}
        />
        <Indicador
          rotulo="De fora do Diretório"
          icone="usuario"
          carregando={!pessoas || !externos}
          valor={num(contagem.externos)}
          detalhe="terceirizados e outros"
          onClick={() => setFiltro("externos")}
        />
        <Indicador
          rotulo="A recolher"
          icone="alerta"
          carregando={!pessoas || !diretorio}
          valor={num(contagem.fora)}
          tom={contagem.fora ? "atencao" : "neutro"}
          valorNoTom={contagem.fora > 0}
          detalhe={contagem.fora ? "com quem saiu ou foi encerrado" : "nada a recolher"}
          onClick={() => setFiltro("fora")}
        />
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Pessoas"
        descricao={pessoas ? `${num(linhas.length)} · ${ROTULO[filtro]}` : "Carregando"}
        acoes={
          <>
            <Combo
              opcoes={(Object.keys(ROTULO) as Filtro[]).map((f) => ({ valor: f, rotulo: ROTULO[f], detalhe: num(contagem[f]) }))}
              valor={filtro}
              onMudar={(v) => setFiltro(v as Filtro)}
              rotuloAcessivel="Quem mostrar"
              className="w-48"
              busca={false}
            />
            <Campo
              icone="buscar"
              placeholder="Nome, setor ou patrimônio"
              aria-label="Buscar pessoa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-60"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
          </>
        }
      >
        {!pessoas ? (
          <EsqueletoTabela colunas={3} linhas={8} />
        ) : (
          <TabelaDados
            rotulo="Pessoas e equipamentos"
            colunas={colunas}
            linhas={linhas}
            chave={(p) => p.chave}
            onLinha={(p) => setAberta(p.chave)}
            selecionada={(p) => p.chave === aberta}
            alturaMax="min(68dvh, 760px)"
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalPessoaTi
        pessoa={aPessoa}
        movimentacoes={movs.data}
        onAbrirEquipamento={(id) => {
          setAberta(null);
          j.abrirFicha(id);
        }}
        onEntregar={() => {
          const p = aPessoa;
          setAberta(null);
          if (p) j.movimentar({ ids: [], destino: "pessoa", pessoa: p.chave });
        }}
        onDevolverTudo={() => {
          const p = aPessoa;
          setAberta(null);
          if (p) j.movimentar({ ids: p.itens.map((e) => e.id), destino: "estoque", travado: true });
        }}
        onEditarExterno={() => {
          const x = aPessoa?.externo;
          setAberta(null);
          if (x) setExterno(x);
        }}
        onFechar={() => setAberta(null)}
      />

      <ModalExterno
        aberto={externo != null}
        externo={externo === "novo" ? null : externo}
        onSalvo={j.recarregar}
        onFechar={() => setExterno(null)}
      />

      {j.elemento}
    </>
  );
}
