"use client";

import { useMemo, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { ROTULO_FERIAS, SeloFerias } from "@/componentes/produto/folha/ferias-situacao";
import { DataComPrazo } from "@/componentes/produto/folha/prazo-dp";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { cn } from "@/lib/cn";
import { dataBR, num } from "@/lib/format";
import type { ControleFeriasResp, FeriasFuncionario } from "@/lib/types";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useExecucao } from "@/hooks/use-execucao";

/** Teto de linhas desenhadas: sem o filtro, uma empresa grande passa de mil funcionários. */
const MAX_LINHAS = 500;

const pendente = (f: FeriasFuncionario) => f.situacao === "vencida" || f.situacao === "a_vencer";

const COLUNAS: Coluna<FeriasFuncionario>[] = [
  {
    id: "funcionario",
    cabecalho: "Funcionário",
    largura: "32%",
    ordenar: (f) => f.funcionario,
    celula: (f) => (
      <span className="block truncate font-[560] text-tinta" title={f.funcionario}>
        {f.funcionario}
      </span>
    ),
  },
  {
    id: "admissao",
    cabecalho: "Admissão",
    secundaria: true,
    ordenar: (f) => f.admissao,
    celula: (f) => <span className="num">{dataBR(f.admissao)}</span>,
  },
  {
    id: "situacao",
    cabecalho: "Situação",
    celula: (f) => (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <SeloFerias situacao={f.situacao} />
        {f.periodosAbertos > 1 && (
          <span className="num text-pequeno text-apagado">{num(f.periodosAbertos)} em aberto</span>
        )}
      </span>
    ),
  },
  {
    id: "aquisitivo",
    cabecalho: "Período aquisitivo",
    celula: (f) =>
      f.aquisitivoInicio && f.aquisitivoFim ? (
        <span className="num whitespace-nowrap">
          {dataBR(f.aquisitivoInicio)} a {dataBR(f.aquisitivoFim)}
        </span>
      ) : (
        <span className="text-apagado">—</span>
      ),
  },
  {
    id: "limite",
    cabecalho: "Limite para conceder",
    ordenar: (f) => f.diasParaLimite,
    celula: (f) => <DataComPrazo data={f.limiteConcessao} dias={f.diasParaLimite} />,
  },
  {
    id: "vencidos",
    cabecalho: "Vencidos",
    alinhar: "dir",
    ordenar: (f) => f.periodosVencidos,
    celula: (f) => (
      <span className={cn(f.periodosVencidos > 0 ? "font-[600] text-perigo" : "text-apagado")}>
        {num(f.periodosVencidos)}
      </span>
    ),
  },
  {
    id: "ultimas",
    cabecalho: "Últimas férias",
    secundaria: true,
    ordenar: (f) => f.ultimasFerias,
    celula: (f) =>
      f.ultimasFerias ? (
        <span className="num">{dataBR(f.ultimasFerias)}</span>
      ) : (
        <span className="text-apagado">Nunca gozou</span>
      ),
  },
];

/**
 * Férias: quem tem férias vencidas (risco de pagar em dobro) ou a vencer em
 * 120 dias numa empresa. A situação é a do ÚLTIMO dia do período executado, e
 * a tela diz que dia é esse: mudar o fim do período muda a foto.
 */
export default function Conteudo() {
  const { qs } = useExecucao();
  const [soPendentes, setSoPendentes] = useEstadoTela("so-pendentes", true);
  const res = useConsulta<ControleFeriasResp>("folha-ferias", qs ? `/api/folha/ferias?${qs}` : null);
  const d = res.data;

  const linhas = useMemo(
    () => (d ? (soPendentes ? d.funcionarios.filter(pendente) : d.funcionarios) : []),
    [d, soPendentes]
  );
  const visiveis = linhas.slice(0, MAX_LINHAS);

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para apurar as férias"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  const r = d?.resumo;
  const referencia = d ? dataBR(d.referencia) : "";

  let vazio: ReactNode;
  if (d && r && r.ativos === 0)
    vazio = (
      <Vazio
        icone="pessoas"
        titulo={`Nenhum empregado CLT ativo em ${referencia}`}
        descricao="Confira a empresa ou mude o fim do período no topo."
      />
    );
  else if (d && soPendentes)
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Ninguém com férias vencidas ou a vencer"
        descricao="Nenhum limite de concessão vence nos próximos 120 dias."
        acao={<Botao onClick={() => setSoPendentes(false)}>Ver todos os funcionários</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="folha"
          desabilitado={!d}
          cortes={
            d
              ? [
                  {
                    id: "ferias",
                    rotulo: "Férias por funcionário",
                    nome: `ferias-${d.empresa.codigo}-${soPendentes ? "pendentes" : "todos"}-${d.referencia}`,
                    montar: () => ({
                      cabecalhos: [
                        "Contrato",
                        "Funcionário",
                        "Admissão",
                        "Situação",
                        "Períodos em aberto",
                        "Períodos vencidos",
                        "Início do aquisitivo",
                        "Fim do aquisitivo",
                        "Limite para conceder",
                        "Dias para o limite",
                        "Últimas férias",
                      ],
                      linhas: linhas.map((f) => [
                        f.contrato,
                        f.funcionario,
                        dataBR(f.admissao),
                        ROTULO_FERIAS[f.situacao],
                        f.periodosAbertos,
                        f.periodosVencidos,
                        f.aquisitivoInicio ? dataBR(f.aquisitivoInicio) : "",
                        f.aquisitivoFim ? dataBR(f.aquisitivoFim) : "",
                        f.limiteConcessao ? dataBR(f.limiteConcessao) : "",
                        f.diasParaLimite,
                        f.ultimasFerias ? dataBR(f.ultimasFerias) : "",
                      ]),
                    }),
                  },
                ]
              : []
          }
        />
      </AcoesPagina>

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Empregados ativos"
          icone="pessoas"
          carregando={!r}
          valor={num(r?.ativos ?? 0)}
          detalhe={`CLT ativos em ${referencia}`}
        />
        <Indicador
          rotulo="Com férias vencidas"
          icone="alerta"
          carregando={!r}
          valor={num(r?.comVencidas ?? 0)}
          detalhe="Risco de pagar em dobro"
          tom={r && r.comVencidas > 0 ? "perigo" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="A vencer em 120 dias"
          icone="relogio"
          carregando={!r}
          valor={num(r?.aVencer ?? 0)}
          detalhe="Programar antes do limite"
          tom={r && r.aVencer > 0 ? "atencao" : "neutro"}
          valorNoTom
        />
        <Indicador
          rotulo="Períodos vencidos"
          icone="calendario"
          carregando={!r}
          valor={num(r?.periodosVencidos ?? 0)}
          detalhe="Somados na empresa"
          tom={r && r.periodosVencidos > 0 ? "perigo" : "neutro"}
        />
      </FaixaIndicadores>

      <Nota>
        Calculado pela admissão e pelos recibos de férias, a partir da primeira folha do contrato no Questor.
        Afastamentos, faltas e férias coletivas não entram na conta.
        {r && r.semFolha > 0 &&
          ` ${num(r.semFolha)} ${r.semFolha === 1 ? "contrato sem demissão ficou" : "contratos sem demissão ficaram"} de fora por não ter folha nos últimos 120 dias.`}
      </Nota>

      <Painel
        corpo="p-0"
        titulo="Férias por Funcionário"
        descricao={
          d ? (
            <span className="inline-flex items-center gap-1.5">
              Situação em {referencia}, o último dia do período
              {res.isFetching && <Girando />}
            </span>
          ) : (
            "Apurando os períodos aquisitivos"
          )
        }
        acoes={<Alternador ligado={soPendentes} onMudar={setSoPendentes} rotulo="Só vencidas e a vencer" />}
        rodape={
          linhas.length > MAX_LINHAS ? (
            <Nota>
              Mostrando {num(MAX_LINHAS)} de {num(linhas.length)}. Exporte para ver a lista inteira.
            </Nota>
          ) : undefined
        }
      >
        {!d ? (
          <EsqueletoTabela colunas={6} />
        ) : (
          <TabelaDados
            rotulo="Férias por funcionário"
            colunas={COLUNAS}
            linhas={visiveis}
            chave={(f) => String(f.contrato)}
            alturaMax="62vh"
            vazio={vazio}
          />
        )}
      </Painel>
    </>
  );
}
