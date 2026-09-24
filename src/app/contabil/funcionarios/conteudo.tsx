"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";
import type { FuncionarioContabil, FuncionariosContabilResp } from "@/lib/contabil-funcionarios-tipos";
import { normalizar } from "@/lib/folha-casamento";
import { dataBR, num } from "@/lib/format";
import { tempoCasa } from "./tempo-casa";

/**
 * Quadro de funcionários da empresa, dentro do Contábil.
 *
 * Existe para uma pergunta só: o favorecido daquele pagamento é funcionário? A
 * Conciliação já responde sozinha na linha do extrato (o selo da folha); esta
 * tela é para quando a dúvida vem de fora dela: uma nota, um pedido do
 * cliente, um nome que alguém mandou por mensagem.
 *
 * Não mostra remuneração de propósito: para a decisão de conta basta o vínculo,
 * e quem precisa de salário tem o módulo DP e a permissão dele.
 */

type Modo = "ativos" | "todos";

function Situacao({ f }: { f: FuncionarioContabil }) {
  // Desligado leva a data e o tom de atenção: comissão paga a ex-funcionário é
  // justamente o caso que passa batido quando só se olha "está na folha hoje?".
  return f.datadem ? (
    <Selo tom="atencao">Desligado em {dataBR(f.datadem)}</Selo>
  ) : (
    <Selo tom="ok">Ativo</Selo>
  );
}

const COLUNAS: Coluna<FuncionarioContabil>[] = [
  {
    id: "nome",
    cabecalho: "Nome",
    largura: "26%",
    ordenar: (f) => f.nome,
    classe: "font-[560] text-tinta",
    celula: (f) => <span className="block truncate">{f.nome}</span>,
  },
  {
    id: "cpf",
    cabecalho: "CPF",
    largura: "140px",
    celula: (f) => <span className="num text-apagado">{f.cpf ?? "sem CPF"}</span>,
  },
  {
    id: "situacao",
    cabecalho: "Situação",
    largura: "170px",
    ordenar: (f) => f.datadem ?? "",
    celula: (f) => <Situacao f={f} />,
  },
  {
    id: "cargo",
    cabecalho: "Cargo",
    largura: "16%",
    ordenar: (f) => f.cargo,
    celula: (f) => <span className="block truncate text-tinta-2">{f.cargo ?? "—"}</span>,
  },
  {
    id: "setor",
    cabecalho: "Setor",
    largura: "16%",
    secundaria: true,
    ordenar: (f) => f.setor,
    celula: (f) => <span className="block truncate text-apagado">{f.setor ?? "—"}</span>,
  },
  {
    id: "estab",
    cabecalho: "Estabelecimento",
    secundaria: true,
    ordenar: (f) => f.estabelecimento,
    celula: (f) => <span className="block truncate text-apagado">{f.estabelecimento ?? "—"}</span>,
  },
  {
    id: "admissao",
    cabecalho: "Admissão",
    alinhar: "dir",
    largura: "110px",
    ordenar: (f) => f.dataadm,
    celula: (f) => dataBR(f.dataadm),
  },
  {
    id: "tempo",
    cabecalho: "Tempo de casa",
    alinhar: "dir",
    largura: "150px",
    ordenar: (f) => f.tempoCasaDias,
    celula: (f) => tempoCasa(f.tempoCasaDias),
  },
];

/** Um ano atrás, em ISO: a régua de "admitidos em 12 meses". */
function umAnoAtras(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Conteudo() {
  const { qs } = useExecucao();
  const empresa = qs ? new URLSearchParams(qs).get("empresas") : null;

  const [modo, setModo] = useEstadoTela<Modo>("modo", "ativos");
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [aberto, setAberto] = useState<FuncionarioContabil | null>(null);

  const desligados = modo === "todos";
  const url = empresa
    ? `/api/contabil/funcionarios?empresa=${empresa}&desligados=${desligados ? "1" : "0"}`
    : null;
  const { data, error, isLoading, refetch } = useConsulta<FuncionariosContabilResp>("contabil-funcionarios", url);

  const linhas = useMemo(() => data?.linhas ?? [], [data]);

  // Busca no cliente: a lista inteira já veio, e o contábil digita pedaço de
  // nome ("MARIA SANT") ou os dígitos do CPF que o extrato mostrou.
  const filtrados = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return linhas;
    const digitos = busca.replace(/\D/g, "");
    return linhas.filter((f) => {
      if (normalizar(f.nome).includes(q)) return true;
      if (digitos.length >= 3 && (f.cpf ?? "").replace(/\D/g, "").includes(digitos)) return true;
      return normalizar(`${f.cargo ?? ""} ${f.setor ?? ""}`).includes(q);
    });
  }, [linhas, busca]);

  const numeros = useMemo(() => {
    const ativos = linhas.filter((f) => !f.datadem);
    const setores = new Set(ativos.map((f) => f.setor).filter(Boolean)).size;
    const estabs = new Set(ativos.map((f) => f.estabelecimento).filter(Boolean)).size;
    const dias = ativos.map((f) => f.tempoCasaDias).filter((d): d is number => d != null);
    const media = dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null;
    const corte = umAnoAtras();
    const admitidos = linhas.filter((f) => f.dataadm && f.dataadm >= corte).length;
    const ultimoDesligamento = linhas.reduce<string | null>(
      (u, f) => (f.datadem && (!u || f.datadem > u) ? f.datadem : u),
      null
    );
    return { setores, estabs, media, admitidos, ultimoDesligamento };
  }, [linhas]);

  if (error && !data)
    return (
      <PainelErro
        titulo="Não deu para carregar o quadro"
        mensagem={(error as Error).message}
        onTentar={() => refetch()}
      />
    );

  const carregando = isLoading || !data;

  const cortes = [
    {
      id: "funcionarios",
      rotulo: "Funcionários",
      nome: `funcionarios-${empresa ?? ""}`,
      montar: () => ({
        cabecalhos: [
          "Contrato",
          "Nome",
          "CPF",
          "Situação",
          "Desligamento",
          "Cargo",
          "Setor",
          "Estabelecimento",
          "Admissão",
          "Tempo de casa (dias)",
        ],
        linhas: filtrados.map((f) => [
          f.contrato,
          f.nome,
          f.cpf,
          f.datadem ? "Desligado" : "Ativo",
          f.datadem ? dataBR(f.datadem) : "",
          f.cargo,
          f.setor,
          f.estabelecimento,
          f.dataadm ? dataBR(f.dataadm) : "",
          f.tempoCasaDias,
        ]),
      }),
    },
  ];

  let tabela: ReactNode;
  if (carregando) {
    tabela = <EsqueletoTabela colunas={6} linhas={10} />;
  } else if (!linhas.length) {
    tabela = desligados ? (
      <Vazio
        icone="pessoas"
        titulo="Empresa sem folha no Questor"
        descricao="Nenhum vínculo cadastrado para esta empresa, nem desligado."
      />
    ) : (
      <Vazio
        icone="pessoas"
        titulo="Nenhum funcionário ativo"
        descricao="A empresa não tem vínculo ativo na folha do Questor."
        acao={
          <Botao variante="secundario" onClick={() => setModo("todos")}>
            Incluir desligados
          </Botao>
        }
      />
    );
  } else {
    tabela = (
      <TabelaDados
        colunas={COLUNAS}
        linhas={filtrados}
        chave={(f) => String(f.contrato)}
        onLinha={setAberto}
        selecionada={(f) => f.contrato === aberto?.contrato}
        alturaMax="38rem"
        rotulo="Funcionários da empresa"
        vazio={
          <Vazio
            compacto
            icone="buscar"
            titulo="Ninguém com essa busca"
            descricao="Tente um pedaço do nome, o cargo ou três dígitos do CPF."
            acao={
              <Botao variante="fantasma" icone="fechar" onClick={() => setBusca("")}>
                Limpar busca
              </Botao>
            }
          />
        }
      />
    );
  }

  return (
    <>
      <AcoesPagina>
        <MenuExportar modulo="contabil" cortes={cortes} desabilitado={carregando || !filtrados.length} />
      </AcoesPagina>

      <FaixaIndicadores>
        <Indicador
          rotulo="Ativos"
          icone="pessoas"
          carregando={carregando}
          valor={data ? num(data.ativos) : ""}
          detalhe={
            numeros.estabs > 1
              ? `${num(numeros.setores)} setores · ${num(numeros.estabs)} estabelecimentos`
              : `${num(numeros.setores)} ${numeros.setores === 1 ? "setor" : "setores"}`
          }
        />
        <Indicador
          rotulo="Tempo médio de casa"
          icone="relogio"
          carregando={carregando}
          valor={tempoCasa(numeros.media)}
          detalhe="Dos vínculos ativos"
        />
        <Indicador
          rotulo="Admitidos em 12 meses"
          icone="calendario"
          carregando={carregando}
          valor={num(numeros.admitidos)}
          detalhe={desligados ? "Contando quem já saiu" : "Só quem segue ativo"}
        />
        {desligados && (
          <Indicador
            rotulo="Desligados"
            icone="sair"
            carregando={carregando}
            valor={data ? num(data.desligados) : ""}
            detalhe={numeros.ultimoDesligamento ? `Último em ${dataBR(numeros.ultimoDesligamento)}` : "Nenhum desligamento"}
          />
        )}
      </FaixaIndicadores>

      <Painel
        corpo="p-0"
        titulo="Vínculos"
        descricao={
          carregando
            ? "Carregando"
            : filtrados.length === linhas.length
              ? `${num(linhas.length)} ${linhas.length === 1 ? "vínculo" : "vínculos"}`
              : `${num(filtrados.length)} de ${num(linhas.length)}`
        }
        acoes={
          <>
            <Campo
              icone="buscar"
              placeholder="Nome, CPF, cargo ou setor"
              classeCaixa="w-64"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar funcionário"
            />
            <Segmentado<Modo>
              rotulo="Quais vínculos"
              opcoes={[
                {
                  valor: "ativos",
                  rotulo: (
                    <>
                      Ativos
                      {data && <span className="num text-micro text-apagado">{num(data.ativos)}</span>}
                    </>
                  ),
                },
                {
                  valor: "todos",
                  rotulo: (
                    <>
                      Com desligados
                      {data && desligados && (
                        <span className="num text-micro text-apagado">{num(data.ativos + data.desligados)}</span>
                      )}
                    </>
                  ),
                },
              ]}
              valor={modo}
              onMudar={setModo}
            />
          </>
        }
        rodape={<Nota>Conta-se por vínculo: a mesma pessoa com dois contratos aparece duas vezes.</Nota>}
      >
        {tabela}
      </Painel>

      <Modal
        aberto={aberto != null}
        onFechar={() => setAberto(null)}
        titulo={aberto?.nome ?? ""}
        descricao={aberto ? `Contrato ${aberto.contrato}` : undefined}
        rodape={<Botao onClick={() => setAberto(null)}>Fechar</Botao>}
      >
        {aberto && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Par rotulo="Situação">
                <Situacao f={aberto} />
              </Par>
              <Par rotulo="CPF">
                <span className="num">{aberto.cpf ?? "sem CPF"}</span>
              </Par>
              <Par rotulo="Tempo de casa">{tempoCasa(aberto.tempoCasaDias)}</Par>
              <Par rotulo="Cargo">{aberto.cargo ?? "—"}</Par>
              <Par rotulo="Setor">{aberto.setor ?? "—"}</Par>
              <Par rotulo="Estabelecimento">{aberto.estabelecimento ?? "—"}</Par>
              <Par rotulo="Admissão">
                <span className="num">{dataBR(aberto.dataadm)}</span>
              </Par>
              <Par rotulo="Desligamento">
                <span className="num">{aberto.datadem ? dataBR(aberto.datadem) : "—"}</span>
              </Par>
            </dl>
            <Nota>O CPF vem mascarado da origem: só o miolo, os mesmos dígitos que o PIX mostra no extrato.</Nota>
          </div>
        )}
      </Modal>
    </>
  );
}
