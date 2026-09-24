"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Abas, Segmentado } from "@/componentes/primitivos/abas";
import { BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { Dica } from "@/componentes/primitivos/dica";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import type { Tom } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { useConsulta } from "@/hooks/use-consulta";
import { cn } from "@/lib/cn";
import { brl, dataBR, num } from "@/lib/format";
import type {
  BalanceteCulpado,
  BalanceteCulpadosResp,
  BalanceteLancamento,
  BalanceteLancamentosResp,
  BalanceteLinha,
} from "@/lib/types";

/** De onde o detalhe da conta abre: as notas da diferença, o esperado ou o lançado. */
export type VistaConta = "diferenca" | "fiscal" | "real";

export interface AlvoConta {
  linha: BalanceteLinha;
  vista: VistaConta;
  /** 1 débito, -1 crédito. */
  natureza: 1 | -1;
}

/** Diferença líquida da conta: (débito − crédito) esperado, menos o mesmo no lançado. */
export const difLiquida = (l: BalanceteLinha) => l.fiscalDeb - l.fiscalCred - (l.realDeb - l.realCred);

/** Centavos de rateio e arredondamento não são diferença de verdade. */
export const TOLERANCIA = 0.5;

/** A lista pode ter centenas de notas: pagina em vez de rolar tudo. */
const POR_PAGINA = 50;

const ORIGEM: Record<string, string> = {
  ME: "Nota de entrada",
  MS: "Nota de saída",
  IM: "Apuração",
  RE: "Retenção",
  MOV: "Consolidação",
};

const ORIGEM_CURTA: Record<string, string> = { ME: "entrada", MS: "saída", IM: "apuração" };

const TIPO_CULPADO: Record<BalanceteCulpado["tipo"], { rotulo: string; tom: Tom; explica: string }> = {
  valor: {
    rotulo: "Valor diferente",
    tom: "perigo",
    explica: "Lançada, mas com valor diferente do que a regra pede.",
  },
  faltando: {
    rotulo: "Não lançada aqui",
    tom: "atencao",
    explica: "A regra espera a nota nesta conta, e ela foi lançada em outra.",
  },
  conta_errada: {
    rotulo: "Conta errada",
    tom: "perigo",
    explica: "Lançada em conta diferente da que o plano manda. A coluna Conta mostra a certa e a lançada.",
  },
  interno: {
    rotulo: "Conta errada no grupo",
    tom: "atencao",
    explica:
      "Lançada em outra conta dentro deste mesmo grupo. O total da sintética não muda, por isso a diferença fica zero, mas as duas analíticas ficam erradas.",
  },
  apuracao: {
    rotulo: "Apuração do período",
    tom: "rota",
    explica:
      "Componente que a natureza fecha uma vez por mês, como o ICMS da devolução de venda. O esperado é a soma do período; o real é o que a apuração lançou.",
  },
  extra: {
    rotulo: "Sem regra reproduzível",
    tom: "neutro",
    explica: "Lançada sem o motor esperar e sem plano que ele reproduza, como NFS-e ou CFOP sem tabela. Confira à mão.",
  },
};

/** NFS-e não tem CFOP: o motor não a reproduz, e a conferência dela é manual. */
function SeloEspecie({ especie }: { especie: string | null }) {
  if (!especie) return <span className="text-apagado/60">—</span>;
  if (especie !== "NFSE") return <Selo>{especie}</Selo>;
  return (
    <Dica texto="O motor não reproduz NFS-e. Confira a contabilização à mão.">
      <Selo tom="atencao">NFSE</Selo>
    </Dica>
  );
}

function filtrar<T>(lista: T[], termo: string, campos: (l: T) => (string | number | null | undefined)[]): T[] {
  const partes = normalizar(termo.trim()).split(/\s+/).filter(Boolean);
  if (!partes.length) return lista;
  return lista.filter((l) => {
    const alvo = normalizar(campos(l).filter((c) => c != null).join(" "));
    return partes.every((p) => alvo.includes(p));
  });
}

/** Barra de baixo da lista: contagem, página e soma, grudada no fim do modal. */
function Rodape({ esquerda, paginacao, direita }: { esquerda: ReactNode; paginacao?: ReactNode; direita: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-[2] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-linha bg-vidro-forte px-5 py-2.5">
      <div className="min-w-0 text-pequeno text-apagado">{esquerda}</div>
      {paginacao}
      <div className="num text-corpo font-[600] text-tinta">{direita}</div>
    </div>
  );
}

function CampoBusca({ valor, onMudar, placeholder }: { valor: string; onMudar: (v: string) => void; placeholder: string }) {
  return (
    <Campo
      icone="buscar"
      placeholder={placeholder}
      value={valor}
      onChange={(e) => onMudar(e.target.value)}
      classeCaixa="w-full sm:w-72"
      aria-label="Buscar na lista"
      fim={valor ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => onMudar("")} /> : undefined}
    />
  );
}

/**
 * O detalhe de uma conta do balancete fiscal, em três vistas: as notas por
 * trás da diferença, o que as regras esperavam e o que o contábil lançou. O
 * clique num valor da tabela abre direto na vista e na natureza daquele valor.
 * Quem monta é o pai, com `key` do alvo: trocar de conta recomeça o estado.
 */
export function ModalConta({ qs, alvo, onFechar }: { qs: string; alvo: AlvoConta; onFechar: () => void }) {
  const { linha } = alvo;
  const [vista, setVista] = useState<VistaConta>(alvo.vista);
  const [natureza, setNatureza] = useState<1 | -1>(alvo.natureza);
  const dif = difLiquida(linha);
  const temDif = Math.abs(dif) > TOLERANCIA;
  const base = `${qs}&classif=${encodeURIComponent(linha.classif)}&conta=${linha.conta}&sintetica=${linha.sintetica ? 1 : 0}`;

  const ir = (v: VistaConta, n?: 1 | -1) => {
    setVista(v);
    if (n) setNatureza(n);
  };

  const resumo: { rotulo: string; valor: number; vista: VistaConta; natureza?: 1 | -1 }[] = [
    { rotulo: "Débito esperado", valor: linha.fiscalDeb, vista: "fiscal", natureza: 1 },
    { rotulo: "Crédito esperado", valor: linha.fiscalCred, vista: "fiscal", natureza: -1 },
    { rotulo: "Débito lançado", valor: linha.realDeb, vista: "real", natureza: 1 },
    { rotulo: "Crédito lançado", valor: linha.realCred, vista: "real", natureza: -1 },
  ];

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="xg"
      corpo="p-0"
      titulo={`${linha.conta} · ${linha.descricao}`}
      descricao={
        <span className="num">
          {linha.classif} · {linha.sintetica ? "sintética, soma as filhas" : "analítica"}
        </span>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-linha px-5 py-4 sm:grid-cols-5">
        {resumo.map((r) => (
          <Par key={r.rotulo} rotulo={r.rotulo}>
            <button
              type="button"
              onClick={() => ir(r.vista, r.natureza)}
              className={cn(
                "num text-medio hover:text-rota hover:underline",
                vista === r.vista && natureza === r.natureza ? "font-[600] text-tinta" : "text-tinta-2"
              )}
            >
              {brl(r.valor)}
            </button>
          </Par>
        ))}
        <Par rotulo="Diferença">
          <button
            type="button"
            onClick={() => ir("diferenca")}
            className={cn(
              "num text-medio font-[600] hover:underline",
              !temDif ? "text-ok" : Math.abs(dif) > 100 ? "text-perigo" : "text-atencao"
            )}
          >
            {temDif ? brl(dif) : "Bate"}
          </button>
        </Par>
      </dl>
      <div className="px-3 pt-1">
        <Abas
          rotulo="Detalhe da conta"
          ativa={vista}
          onMudar={(v) => setVista(v as VistaConta)}
          itens={[
            { chave: "diferenca", rotulo: "Notas da diferença", icone: "alerta" },
            { chave: "fiscal", rotulo: "Esperado pelas regras", icone: "calculadora" },
            { chave: "real", rotulo: "Lançado no contábil", icone: "planilha" },
          ]}
        />
      </div>
      {vista === "diferenca" ? (
        <VistaDiferenca url={`/api/contabil/balancete-culpados?${base}`} linha={linha} />
      ) : (
        <VistaLancamentos
          key={`${vista}:${natureza}`}
          url={`/api/contabil/balancete${vista === "fiscal" ? "-fiscal" : ""}-lancamentos?${base}&natureza=${natureza}`}
          lado={vista}
          natureza={natureza}
          onNatureza={setNatureza}
        />
      )}
    </Modal>
  );
}

function VistaLancamentos({
  url,
  lado,
  natureza,
  onNatureza,
}: {
  url: string;
  lado: "fiscal" | "real";
  natureza: 1 | -1;
  onNatureza: (n: 1 | -1) => void;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  // Outra lista (outro lado ou natureza) não pode aparecer no lugar desta
  // enquanto carrega: seria somar a coluna errada.
  const { data, isLoading, isError, error, refetch } = useConsulta<BalanceteLancamentosResp>(
    "balancete-lancamentos",
    url,
    { manterAnterior: false }
  );

  const todos = useMemo(() => data?.lancamentos ?? [], [data]);
  const filtrados = useMemo(
    () => filtrar(todos, busca, (l) => [l.numero, l.contraparte, l.historico, l.especie]),
    [todos, busca]
  );
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const soma = filtrados.reduce((s, l) => s + l.valor, 0);
  // Resposta cortada no servidor: a lista e a soma são parciais, e a tela diz.
  const truncado = (data?.total ?? 0) > todos.length;

  const colunas: Coluna<BalanceteLancamento>[] = [
    { id: "data", cabecalho: "Data", largura: "96px", ordenar: (l) => l.data, celula: (l) => <span className="num">{dataBR(l.data)}</span> },
    ...(lado === "fiscal"
      ? [
          {
            id: "tipo",
            cabecalho: "Tipo",
            largura: "96px",
            ordenar: (l: BalanceteLancamento) => l.tipo ?? "",
            celula: (l: BalanceteLancamento) =>
              l.tipo === "espelho" ? <Selo>Espelho</Selo> : <Selo tom="rota">Regra</Selo>,
          },
        ]
      : []),
    {
      id: "origem",
      cabecalho: "Origem",
      largura: "130px",
      secundaria: true,
      ordenar: (l) => l.origem,
      celula: (l) => <span className="text-apagado">{ORIGEM[l.origem] ?? l.origem}</span>,
    },
    {
      id: "numero",
      cabecalho: "Nº",
      largura: "96px",
      ordenar: (l) => l.numero,
      celula: (l) => (l.numero != null ? <span className="num text-tinta">{num(l.numero)}</span> : <span className="text-apagado/60">—</span>),
    },
    { id: "especie", cabecalho: "Espécie", largura: "92px", ordenar: (l) => l.especie, celula: (l) => <SeloEspecie especie={l.especie} /> },
    {
      id: "contraparte",
      cabecalho: "Contraparte ou histórico",
      ordenar: (l) => l.contraparte ?? l.historico,
      celula: (l) => (
        <span className="block truncate" title={l.contraparte ?? l.historico}>
          {l.contraparte ?? (l.historico || "—")}
        </span>
      ),
    },
    {
      id: "valor",
      cabecalho: "Valor",
      alinhar: "dir",
      largura: "136px",
      ordenar: (l) => l.valor,
      classe: "font-[600] text-tinta",
      celula: (l) => brl(l.valor),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Segmentado
          rotulo="Natureza"
          opcoes={[
            { valor: "1", rotulo: "Débito" },
            { valor: "-1", rotulo: "Crédito" },
          ]}
          valor={String(natureza)}
          onMudar={(v) => onNatureza(v === "-1" ? -1 : 1)}
        />
        <CampoBusca
          valor={busca}
          onMudar={(v) => {
            setBusca(v);
            setPagina(1);
          }}
          placeholder="Nº, contraparte, histórico ou espécie"
        />
        {lado === "fiscal" && (
          <Nota className="basis-full">
            Regra é o valor que o motor calculou para a nota. Espelho é o lançado copiado onde o motor não reproduz:
            consolidação, apuração, retenção ou conta sem regra.
          </Nota>
        )}
      </div>
      {isError ? (
        <div className="px-5 pb-4">
          <PainelErro mensagem={(error as Error).message} onTentar={() => refetch()} />
        </div>
      ) : isLoading || !data ? (
        <EsqueletoTabela linhas={6} colunas={lado === "fiscal" ? 7 : 6} />
      ) : (
        <TabelaDados
          rotulo="Lançamentos da conta"
          colunas={colunas}
          linhas={visiveis}
          chave={(l, i) => `${l.origem}:${l.chave ?? ""}:${l.data}:${i}`}
          vazio={
            todos.length === 0 ? (
              <Vazio
                compacto
                icone="planilha"
                titulo={natureza === 1 ? "Nenhum lançamento a débito" : "Nenhum lançamento a crédito"}
                descricao={lado === "fiscal" ? "As regras não esperam movimento nesta natureza." : "O contábil não lançou nada nesta natureza."}
              />
            ) : (
              <Vazio compacto icone="buscar" titulo="Nenhum lançamento com esse termo" descricao="Busque pelo número, pela contraparte ou pela espécie." />
            )
          }
        />
      )}
      {data && (
        <Rodape
          esquerda={
            <>
              {num(filtrados.length)} {filtrados.length === 1 ? "lançamento" : "lançamentos"}
              {truncado && !busca && <span> · os maiores de {num(data.total)}, soma parcial</span>}
            </>
          }
          paginacao={
            filtrados.length > POR_PAGINA ? (
              <Paginacao pagina={pag} porPagina={POR_PAGINA} total={filtrados.length} onPagina={setPagina} className="justify-center" />
            ) : undefined
          }
          direita={brl(soma)}
        />
      )}
    </>
  );
}

function VistaDiferenca({ url, linha }: { url: string; linha: BalanceteLinha }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, isError, error, refetch } = useConsulta<BalanceteCulpadosResp>(
    "balancete-culpados",
    url,
    { manterAnterior: false }
  );

  const todos = useMemo(() => data?.culpados ?? [], [data]);
  const filtrados = useMemo(
    () => filtrar(todos, busca, (c) => [c.numero, c.contraparte, c.especie]),
    [todos, busca]
  );
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const visiveis = filtrados.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  const internos = filtrados.filter((c) => c.tipo === "interno").length;
  const notas = filtrados.length - internos;
  const buscando = busca.trim() !== "";
  const somaFiltrada = filtrados.reduce((s, c) => s + c.diferenca, 0);
  const somaTodas = todos.reduce((s, c) => s + c.diferenca, 0);
  // Sem busca, o total do rodapé é a própria célula da tabela, a verdade que a
  // pessoa clicou. Numa sintética grande, as milhares de notas conferidas
  // (dentro da tolerância, fora da lista) carregam resíduo de arredondamento, e
  // a soma das listadas pode divergir da célula em centavos por mil; a dica
  // decompõe. Com busca, o total é o das notas que sobraram.
  const celula = difLiquida(linha);
  const residuo = celula - somaTodas;

  // Na sintética a coluna diz em que filha a nota bate; na analítica só entra
  // quando alguma nota tem par certa e errada, e aí diz para onde ela deveria ir.
  const temPar = todos.some((c) => c.contaEsperada != null && c.conta != null && c.contaEsperada !== c.conta);
  const mostrarConta = linha.sintetica || temPar;

  const colunas: Coluna<BalanceteCulpado>[] = [
    {
      id: "numero",
      cabecalho: "Nº",
      largura: "128px",
      ordenar: (c) => c.numero,
      celula: (c) => (
        <span className="num whitespace-nowrap text-tinta">
          {c.numero != null ? num(c.numero) : "—"}
          <span className="ml-1.5 text-micro text-apagado">{ORIGEM_CURTA[c.origem] ?? c.origem}</span>
        </span>
      ),
    },
    { id: "especie", cabecalho: "Espécie", largura: "88px", ordenar: (c) => c.especie, celula: (c) => <SeloEspecie especie={c.especie} /> },
    {
      id: "contraparte",
      cabecalho: "Contraparte",
      ordenar: (c) => c.contraparte,
      celula: (c) => (
        <span className="block truncate" title={c.contraparte ?? undefined}>
          {c.contraparte ?? "—"}
        </span>
      ),
    },
    ...(mostrarConta
      ? [
          {
            id: "conta",
            cabecalho: "Conta",
            largura: "150px",
            ordenar: (c: BalanceteCulpado) => c.conta,
            celula: (c: BalanceteCulpado) =>
              c.contaEsperada != null && c.conta != null && c.contaEsperada !== c.conta ? (
                <Dica texto={`Certa pelo plano: ${c.contaEsperada}. Lançada em: ${c.conta}.`}>
                  <span className="num inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="font-[600] text-ok">{c.contaEsperada}</span>
                    <Icone nome="seta-direita" tamanho={14} className="text-apagado" />
                    <span className="font-[600] text-perigo">{c.conta}</span>
                  </span>
                </Dica>
              ) : (
                <span className="num text-apagado">{c.conta ?? "—"}</span>
              ),
          },
        ]
      : []),
    {
      id: "situacao",
      cabecalho: "Situação",
      largura: "196px",
      ordenar: (c) => c.tipo,
      celula: (c) => {
        if (c.incompleta)
          return (
            <Dica texto="O motor reproduziu esta nota pela metade: a fórmula usa um valor que ele ainda não calcula. O esperado é parcial, confira à mão.">
              <Selo>Reprodução incompleta</Selo>
            </Dica>
          );
        if (c.especie === "NFSE" && c.tipo === "extra")
          return (
            <Dica texto="Serviço sem CFOP: o motor não reproduz. Confira a contabilização à mão.">
              <Selo tom="atencao">Verificar à mão</Selo>
            </Dica>
          );
        const t = TIPO_CULPADO[c.tipo];
        return (
          <Dica texto={t.explica}>
            <Selo tom={t.tom}>{t.rotulo}</Selo>
          </Dica>
        );
      },
    },
    {
      id: "esperado",
      cabecalho: "Esperado",
      alinhar: "dir",
      largura: "128px",
      secundaria: true,
      ordenar: (c) => c.esperado,
      classe: "text-apagado",
      celula: (c) => brl(c.esperado),
    },
    {
      id: "real",
      cabecalho: "Real",
      alinhar: "dir",
      largura: "128px",
      secundaria: true,
      ordenar: (c) => c.real,
      classe: "text-apagado",
      celula: (c) => brl(c.real),
    },
    {
      id: "diferenca",
      cabecalho: "Diferença",
      alinhar: "dir",
      largura: "136px",
      ordenar: (c) => (c.tipo === "interno" ? 0 : Math.abs(c.diferenca)),
      classe: "font-[600] text-tinta",
      celula: (c) =>
        c.tipo === "interno" ? (
          <Dica texto="Remanejo dentro do grupo: não muda o total da sintética.">
            <span className="font-normal text-apagado/60">—</span>
          </Dica>
        ) : (
          brl(c.diferenca)
        ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <CampoBusca
          valor={busca}
          onMudar={(v) => {
            setBusca(v);
            setPagina(1);
          }}
          placeholder="Nº, contraparte ou espécie"
        />
        <Nota className="min-w-0 flex-1">Por nota, o líquido que a regra esperava nesta conta menos o que foi lançado.</Nota>
      </div>
      {isError ? (
        <div className="px-5 pb-4">
          <PainelErro mensagem={(error as Error).message} onTentar={() => refetch()} />
        </div>
      ) : isLoading || !data ? (
        <EsqueletoTabela linhas={6} colunas={7} />
      ) : (
        <TabelaDados
          rotulo="Notas por trás da diferença"
          colunas={colunas}
          linhas={visiveis}
          chave={(c, i) => `${c.origem}:${c.chave ?? c.conta ?? ""}:${i}`}
          vazio={
            todos.length === 0 ? (
              <Vazio
                compacto
                icone="ok"
                titulo="Nenhuma nota isolada explica a diferença"
                descricao="O que sobra costuma ser imposto de apuração ou movimento sem nota. Veja as abas de esperado e lançado."
              />
            ) : (
              <Vazio compacto icone="buscar" titulo="Nenhuma nota com esse termo" descricao="Busque pelo número, pela contraparte ou pela espécie." />
            )
          }
        />
      )}
      {data && (
        <Rodape
          esquerda={
            <>
              {num(notas)} {notas === 1 ? "nota" : "notas"}
              {internos > 0 && (
                <span>
                  {" "}
                  · {num(internos)} {internos === 1 ? "remanejo interno" : "remanejos internos"}
                </span>
              )}
              {data.total > todos.length && <span> · as maiores de {num(data.total)}</span>}
            </>
          }
          paginacao={
            filtrados.length > POR_PAGINA ? (
              <Paginacao pagina={pag} porPagina={POR_PAGINA} total={filtrados.length} onPagina={setPagina} className="justify-center" />
            ) : undefined
          }
          direita={
            buscando ? (
              brl(somaFiltrada)
            ) : Math.abs(residuo) > TOLERANCIA ? (
              <Dica
                texto={`Notas listadas: ${brl(somaTodas)}. Resíduo de arredondamento das notas conferidas, fora da lista: ${brl(residuo)}.`}
              >
                <span className="underline decoration-dotted underline-offset-4">{brl(celula)}</span>
              </Dica>
            ) : (
              brl(celula)
            )
          }
        />
      )}
    </>
  );
}
