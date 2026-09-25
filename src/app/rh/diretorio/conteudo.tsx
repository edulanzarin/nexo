"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo, normalizar, type Opcao } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { emAnos, tempoCasa } from "@/componentes/produto/pessoal/tempo-casa";
import { ModalNovoPj } from "@/componentes/produto/rh/diretorio-novo-pj";
import { chavePessoaRh, diasDeCasa, origemTexto, TabelaDiretorio } from "@/componentes/produto/rh/diretorio-tabela";
import { empresasDoFiltroRh, SeletorEmpresaRh, type FiltroEmpresaRh } from "@/componentes/produto/rh/empresa-rh";
import { ModalFichaRh } from "@/componentes/produto/rh/ficha-edicao-rh";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useRhFuncionarios } from "@/hooks/use-rh";
import { dataBR, hojeISO, num } from "@/lib/format";
import { nomeEmpresaRh } from "@/lib/rh";
import type { FuncionarioDiretorio } from "@/lib/rh-tipos";

type Situacao = "todas" | "pj" | "sem-email" | "corrigidas";

const SITUACOES: Opcao[] = [
  { valor: "todas", rotulo: "Todas as pessoas" },
  { valor: "pj", rotulo: "Só PJ" },
  { valor: "sem-email", rotulo: "Sem e-mail" },
  { valor: "corrigidas", rotulo: "Corrigidas no RH" },
];

const NA_SITUACAO: Record<Situacao, (f: FuncionarioDiretorio) => boolean> = {
  todas: () => true,
  pj: (f) => f.origem === "pj",
  "sem-email": (f) => !f.email,
  corrigidas: (f) => f.editado,
};

/** Valores do filtro de setor que não são um classiforgan. */
const TODOS = "*";
const SEM_SETOR = "-";
const setorDe = (f: FuncionarioDiretorio) => f.classiforgan ?? SEM_SETOR;

/**
 * Diretório: quem trabalha na Navecon hoje, das três empresas, com os PJ, e a
 * ficha de cada um com a edição do RH. A lista é pequena (umas oitenta
 * pessoas) e vem inteira; empresa, setor, situação e busca recortam aqui, na
 * hora, sem voltar ao servidor.
 */
export default function Conteudo() {
  const lista = useRhFuncionarios();
  const [empresa, setEmpresa] = useEstadoTela<FiltroEmpresaRh>("empresa", "todas");
  const [setor, setSetor] = useEstadoTela("setor", TODOS);
  const [situacao, setSituacao] = useEstadoTela<Situacao>("situacao", "todas");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [abertaChave, setAbertaChave] = useState<string | null>(null);
  const [novoPj, setNovoPj] = useState(false);

  const d = lista.data;
  const todos = useMemo(() => d ?? [], [d]);

  const contagens = useMemo(() => {
    const c: Record<number, number> = {};
    for (const f of todos) c[f.codigoempresa] = (c[f.codigoempresa] ?? 0) + 1;
    return c;
  }, [todos]);

  const daEmpresa = useMemo(() => {
    const cods = new Set(empresasDoFiltroRh(empresa));
    return todos.filter((f) => cods.has(f.codigoempresa));
  }, [todos, empresa]);

  // O nome sai da própria linha, que já vem com o nome dado no RH ao setor.
  const nomeSetor = useMemo(() => {
    if (setor === TODOS) return null;
    if (setor === SEM_SETOR) return "Sem setor";
    return todos.find((f) => f.classiforgan === setor)?.setor ?? setor;
  }, [todos, setor]);

  // Os setores com gente na empresa escolhida, maiores primeiro, com a contagem.
  const opcoesSetor = useMemo<Opcao[]>(() => {
    const m = new Map<string, { nome: string; n: number }>();
    for (const f of daEmpresa) {
      const k = setorDe(f);
      const s = m.get(k);
      if (s) s.n++;
      else m.set(k, { nome: k === SEM_SETOR ? "Sem setor" : (f.setor ?? k), n: 1 });
    }
    const itens = [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[1].nome.localeCompare(b[1].nome, "pt-BR"));
    const opcoes: Opcao[] = [
      { valor: TODOS, rotulo: "Todos os setores", detalhe: num(daEmpresa.length) },
      ...itens.map(([valor, s]) => ({ valor, rotulo: s.nome, detalhe: num(s.n) })),
    ];
    // O setor escolhido fica na lista mesmo sem ninguém nesta empresa: sumir
    // com ele deixaria o filtro ligado sem dizer qual.
    if (setor !== TODOS && !m.has(setor)) opcoes.push({ valor: setor, rotulo: nomeSetor ?? setor, detalhe: num(0) });
    return opcoes;
  }, [daEmpresa, setor, nomeSetor]);

  const recorte = useMemo(
    () => (setor === TODOS ? daEmpresa : daEmpresa.filter((f) => setorDe(f) === setor)),
    [daEmpresa, setor]
  );

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return recorte.filter((f) => {
      if (!NA_SITUACAO[situacao](f)) return false;
      if (!partes.length) return true;
      const alvo = normalizar(`${f.nome} ${f.cargo ?? ""} ${f.setor ?? ""} ${f.email ?? ""}`);
      return partes.every((p) => alvo.includes(p));
    });
  }, [recorte, situacao, termo]);

  // Os números são do recorte de empresa e setor, antes da situação e da busca:
  // é a situação que eles filtram quando clicados.
  const resumo = useMemo(() => {
    let pj = 0;
    let semEmail = 0;
    let corrigidas = 0;
    let somaDias = 0;
    let comDias = 0;
    for (const f of recorte) {
      if (f.origem === "pj") pj++;
      if (!f.email) semEmail++;
      if (f.editado) corrigidas++;
      const dias = diasDeCasa(f);
      if (dias != null) {
        somaDias += dias;
        comDias++;
      }
    }
    return { pessoas: recorte.length, pj, semEmail, corrigidas, mediaDias: comDias ? somaDias / comDias : null };
  }, [recorte]);

  // Lida da lista atual: depois de salvar a ficha, o sinal de corrigido já vem novo.
  const aberta = abertaChave ? (todos.find((f) => chavePessoaRh(f) === abertaChave) ?? null) : null;

  const filtrado = setor !== TODOS || situacao !== "todas" || busca !== "";
  const limpar = () => {
    setSetor(TODOS);
    setSituacao("todas");
    setBusca("");
  };
  const alternarSituacao = (s: Situacao) => setSituacao(situacao === s ? "todas" : s);
  const tomDe = (s: Situacao, alerta: "neutro" | "atencao" | "ok" = "neutro") => (situacao === s ? "rota" : alerta);

  const nomeEmpresa = empresa === "todas" ? null : nomeEmpresaRh(Number(empresa));
  const rotuloRecorte = [nomeEmpresa ?? (nomeSetor ? null : "Nas três empresas"), nomeSetor].filter(Boolean).join(" · ");

  const botaoPj = (
    <Botao icone="mais" onClick={() => setNovoPj(true)}>
      Adicionar PJ
    </Botao>
  );

  let vazio: ReactNode;
  if (!todos.length)
    vazio = (
      <Vazio
        icone="pessoas"
        titulo="Ninguém ativo nas empresas da Navecon"
        descricao="O Questor não trouxe funcionário ativo. Quem trabalha como PJ entra pelo cadastro do RH."
        acao={botaoPj}
      />
    );
  else if (!daEmpresa.length)
    vazio = (
      <Vazio
        compacto
        icone="pessoas"
        titulo={`Ninguém ativo na ${nomeEmpresa}`}
        descricao="Escolha outra empresa."
        acao={<Botao onClick={() => setEmpresa("todas")}>Ver as três empresas</Botao>}
      />
    );
  else if (termo)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Ninguém com esse termo"
        descricao="Busque pelo nome, pelo cargo, pelo setor ou pelo e-mail."
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );
  else if (!recorte.length)
    vazio = (
      <Vazio
        compacto
        icone="camadas"
        titulo={`${setor === SEM_SETOR ? "Ninguém sem setor" : `Ninguém de ${nomeSetor}`} ${nomeEmpresa ? `na ${nomeEmpresa}` : "nas três empresas"}`}
        descricao="Troque a empresa ou o setor."
        acao={<Botao onClick={() => setSetor(TODOS)}>Ver todos os setores</Botao>}
      />
    );
  else if (situacao === "sem-email")
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Todas as pessoas do recorte têm e-mail"
        acao={<Botao onClick={() => setSituacao("todas")}>Ver todas as pessoas</Botao>}
      />
    );
  else if (situacao === "pj")
    vazio = <Vazio compacto icone="usuario" titulo="Nenhum PJ neste recorte" acao={botaoPj} />;
  else
    vazio = (
      <Vazio
        compacto
        icone="editar"
        titulo="Nenhuma ficha corrigida neste recorte"
        descricao="As fichas estão como vieram do Questor."
        acao={<Botao onClick={() => setSituacao("todas")}>Ver todas as pessoas</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        {botaoPj}
        <MenuExportar
          modulo="rh"
          desabilitado={!d}
          cortes={[
            {
              id: "diretorio",
              rotulo: "Diretório",
              descricao: [
                rotuloRecorte,
                situacao !== "todas" ? SITUACOES.find((s) => s.valor === situacao)?.rotulo : null,
                busca.trim() ? `Busca "${busca.trim()}"` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              nome: `diretorio-${nomeEmpresa?.toLowerCase() ?? "navecon"}-${hojeISO()}`,
              montar: () => ({
                cabecalhos: ["Empresa", "Contrato", "Nome", "Cargo", "Setor", "Admissão", "Tempo de casa", "E-mail", "Origem"],
                linhas: linhas.map((f) => {
                  const dias = diasDeCasa(f);
                  return [
                    nomeEmpresaRh(f.codigoempresa),
                    // O contrato do PJ é um número interno do NaveX, sem sentido fora dele.
                    f.origem === "pj" ? "" : f.contrato,
                    f.nome,
                    f.cargo ?? "",
                    f.setor ?? "",
                    f.dataadm ? dataBR(f.dataadm) : "",
                    dias != null ? tempoCasa(dias) : "",
                    f.email ?? "",
                    origemTexto(f),
                  ];
                }),
              }),
            },
          ]}
        />
      </AcoesPagina>

      <div className="flex flex-wrap items-center gap-2">
        {/* O seletor não quebra linha: no celular ele rola dentro da própria faixa. */}
        <div className="max-w-full overflow-x-auto">
          <SeletorEmpresaRh valor={empresa} onMudar={setEmpresa} contagens={d ? contagens : undefined} />
        </div>
        <Combo
          opcoes={opcoesSetor}
          valor={setor}
          onMudar={setSetor}
          icone="camadas"
          className="w-full sm:w-60"
          larguraMin={280}
          desabilitado={!d}
          rotuloAcessivel="Filtrar por setor"
        />
        <Combo
          opcoes={SITUACOES}
          valor={situacao}
          onMudar={(v) => setSituacao(v as Situacao)}
          icone="filtrar"
          className="w-full sm:w-52"
          desabilitado={!d}
          rotuloAcessivel="Filtrar por situação"
        />
        {filtrado && (
          <Botao variante="fantasma" icone="fechar" onClick={limpar}>
            Limpar filtros
          </Botao>
        )}
      </div>

      {lista.isError ? (
        <PainelErro
          titulo="Não deu para carregar o diretório"
          mensagem={(lista.error as Error).message}
          onTentar={() => lista.refetch()}
        />
      ) : (
        <>
          <FaixaIndicadores colunas={5}>
            <Indicador
              rotulo="Pessoas"
              icone="pessoas"
              carregando={!d}
              valor={num(resumo.pessoas)}
              detalhe={rotuloRecorte}
            />
            <Indicador
              rotulo="PJ"
              icone="usuario"
              carregando={!d}
              valor={num(resumo.pj)}
              detalhe="Fora do Questor"
              tom={tomDe("pj")}
              onClick={d ? () => alternarSituacao("pj") : undefined}
            />
            <Indicador
              rotulo="Sem e-mail"
              icone="email"
              carregando={!d}
              valor={num(resumo.semEmail)}
              detalhe={resumo.semEmail ? "Não recebem formulário direto" : "Todos recebem formulário direto"}
              tom={tomDe("sem-email", resumo.semEmail ? "atencao" : "ok")}
              onClick={d ? () => alternarSituacao("sem-email") : undefined}
            />
            <Indicador
              rotulo="Corrigidas no RH"
              icone="editar"
              carregando={!d}
              valor={num(resumo.corrigidas)}
              detalhe="Ficha diferente do Questor"
              tom={tomDe("corrigidas")}
              onClick={d ? () => alternarSituacao("corrigidas") : undefined}
            />
            <Indicador
              rotulo="Tempo médio de casa"
              icone="relogio"
              carregando={!d}
              valor={emAnos(resumo.mediaDias)}
              detalhe="Da admissão ou do início até hoje"
            />
          </FaixaIndicadores>

          <Nota>
            Só quem está ativo hoje. As correções da ficha ficam no NaveX e não mudam o Questor, que também não
            guarda e-mail.
          </Nota>

          <Painel
            corpo="p-0"
            titulo="Colaboradores"
            descricao={
              d ? (
                <span className="inline-flex items-center gap-1.5">
                  {linhas.length === recorte.length
                    ? `${num(linhas.length)} ${linhas.length === 1 ? "pessoa" : "pessoas"}`
                    : `${num(linhas.length)} de ${num(recorte.length)} pessoas`}
                  {lista.isFetching && <Girando />}
                </span>
              ) : (
                "Lendo o Questor e o cadastro do RH"
              )
            }
            acoes={
              <Campo
                icone="buscar"
                placeholder="Nome, cargo, setor ou e-mail"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                classeCaixa="w-full sm:w-64"
                aria-label="Buscar no diretório"
                fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
              />
            }
          >
            {!d ? (
              <EsqueletoTabela colunas={6} linhas={10} />
            ) : (
              <TabelaDiretorio
                linhas={linhas}
                comEmpresa={empresa === "todas"}
                onAbrir={(f) => setAbertaChave(chavePessoaRh(f))}
                selecionada={(f) => chavePessoaRh(f) === abertaChave}
                vazio={vazio}
              />
            )}
          </Painel>
        </>
      )}

      <ModalFichaRh pessoa={aberta} onFechar={() => setAbertaChave(null)} />
      <ModalNovoPj aberto={novoPj} onFechar={() => setNovoPj(false)} />
    </>
  );
}
