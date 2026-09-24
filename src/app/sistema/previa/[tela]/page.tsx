"use client";

import { use, useEffect, useState } from "react";
import { ProvedorCasca } from "@/componentes/casca/casca-cliente";
import { AcoesPagina, MolduraModulo } from "@/componentes/casca/moldura-modulo";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Campo } from "@/componentes/primitivos/campo";
import { Combo } from "@/componentes/primitivos/combo";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Painel, Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { Paginacao, TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { Botao } from "@/componentes/primitivos/botao";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { brl, brlCompact, dataBR, num } from "@/lib/format";
import { secoesDoModulo } from "@/lib/modulos";
import { CaminhoForcado } from "@/hooks/use-contexto";
import { useExecucao } from "@/hooks/use-execucao";
import { NOTAS_FALSAS, type NotaFalsa } from "../../dados-falsos";
import { Semeador } from "../../semeador";

const SITUACAO: Record<NotaFalsa["situacao"], { rotulo: string; tom: "ok" | "atencao" | "perigo" | "rota" }> = {
  ok: { rotulo: "Correta", tom: "ok" },
  pendente: { rotulo: "Não contabilizada", tom: "atencao" },
  divergente: { rotulo: "Conta errada", tom: "perigo" },
  duplicada: { rotulo: "Duplicada", tom: "perigo" },
  consolidada: { rotulo: "Em bloco", tom: "rota" },
};

const COLUNAS: Coluna<NotaFalsa>[] = [
  {
    id: "nota",
    cabecalho: "Nota",
    largura: "170px",
    ordenar: (n) => n.numero,
    celula: (n) => (
      <span className="num text-tinta">
        {num(n.numero)}
        <span className="text-apagado">/{n.serie}</span>
        <span className="ml-2 text-pequeno text-apagado">{dataBR(n.data)}</span>
      </span>
    ),
  },
  { id: "contraparte", cabecalho: "Contraparte", ordenar: (n) => n.contraparte, celula: (n) => <span className="block truncate">{n.contraparte}</span> },
  { id: "cfop", cabecalho: "CFOP", largura: "120px", secundaria: true, celula: (n) => <span className="num text-apagado">{n.cfops.join(", ")}</span> },
  {
    id: "situacao",
    cabecalho: "Situação",
    largura: "200px",
    ordenar: (n) => n.situacao,
    celula: (n) => (
      <span className="flex items-center gap-1.5">
        <Selo tom={SITUACAO[n.situacao].tom}>{SITUACAO[n.situacao].rotulo}</Selo>
        {n.divergencias > 0 && <span className="num text-micro text-perigo">{n.divergencias} div.</span>}
      </span>
    ),
  },
  { id: "valor", cabecalho: "Valor", alinhar: "dir", largura: "140px", ordenar: (n) => n.valor, classe: "font-[600] text-tinta", celula: (n) => brl(n.valor) },
];

/** Na prévia, a moldura executa sozinha: o que se julga é a tela com dado. */
function AutoExecutar() {
  const e = useExecucao();
  useEffect(() => {
    if (!e.pronto && !e.falta) e.executar();
  }, [e]);
  return null;
}

function ConteudoConferencia({ modalAberto }: { modalAberto: boolean }) {
  const [tipo, setTipo] = useState<"ent" | "sai">("ent");
  const [situacao, setSituacao] = useState<string | null>("problema");
  const [nota, setNota] = useState<NotaFalsa | null>(null);
  return (
    <>
      <AcoesPagina>
        <MenuExportar modulo="contabil" cortes={[{ id: "n", rotulo: "Notas", nome: "notas", montar: () => ({ cabecalhos: [], linhas: [] }) }]} />
      </AcoesPagina>
      <FaixaIndicadores>
        <Indicador rotulo="Notas de entrada" icone="nota" valor={num(1284)} detalhe="212 não exigem lançamento" />
        <Indicador rotulo="Não contabilizadas" icone="pendente" valor={num(32)} detalhe={`${brlCompact(84210)} a lançar`} tom="atencao" valorNoTom />
        <Indicador rotulo="Em bloco" icone="camadas" valor={num(5)} detalhe="R$ 12,4 mil em consolidação" tom="rota" />
        <Indicador rotulo="Conta errada" icone="alerta" valor={num(7)} detalhe="11 divergências" tom="perigo" valorNoTom />
        <Indicador rotulo="Duplicadas" icone="copiar" valor={num(0)} detalhe="nenhuma no período" />
        <Indicador rotulo="Corretas" icone="ok" valor={num(1028)} detalhe="94,1% das que exigem" tom="ok" />
      </FaixaIndicadores>
      <Painel
        corpo="p-0"
        titulo="Notas"
        descricao="Com problema, maior valor primeiro"
        acoes={
          <>
            <Campo icone="buscar" placeholder="Nota, contraparte ou CFOP" classeCaixa="w-64" />
            <Combo
              className="w-48"
              opcoes={[
                { valor: "problema", rotulo: "Com problema" },
                { valor: "todas", rotulo: "Todas" },
                { valor: "pendente", rotulo: "Não contabilizadas" },
                { valor: "divergente", rotulo: "Conta errada" },
              ]}
              valor={situacao}
              onMudar={setSituacao}
            />
            <Segmentado
              opcoes={[
                { valor: "ent", rotulo: "Entradas" },
                { valor: "sai", rotulo: "Saídas" },
              ]}
              valor={tipo}
              onMudar={setTipo}
            />
          </>
        }
      >
        <TabelaDados
          colunas={COLUNAS}
          linhas={NOTAS_FALSAS}
          chave={(n) => String(n.numero)}
          onLinha={setNota}
          ordemInicial={{ coluna: "valor", sentido: "desc" }}
        />
        <div className="border-t border-linha px-4 py-2">
          <Paginacao pagina={1} porPagina={50} total={1284} onPagina={() => {}} />
        </div>
      </Painel>
      {modalAberto && (
        <div className="flex justify-center">
          <PainelModal estatico titulo="Nota 48.211 · MAGALHAES COMERCIO" descricao="Entrada · 14/08/2026" onFechar={() => {}}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Par rotulo="CFOP">1.102</Par>
              <Par rotulo="Valor">
                <span className="num font-[600]">R$ 12.480,00</span>
              </Par>
            </dl>
          </PainelModal>
        </div>
      )}
      <Modal aberto={nota != null} onFechar={() => setNota(null)} titulo={`Nota ${nota ? num(nota.numero) : ""} · ${nota?.contraparte ?? ""}`} descricao="Entrada · empresa 1200" rodape={<Botao onClick={() => setNota(null)}>Fechar</Botao>}>
        {nota && (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Par rotulo="Emissão">{dataBR(nota.data)}</Par>
            <Par rotulo="CFOP">{nota.cfops.join(", ")}</Par>
            <Par rotulo="Situação">
              <Selo tom={SITUACAO[nota.situacao].tom}>{SITUACAO[nota.situacao].rotulo}</Selo>
            </Par>
            <Par rotulo="Valor">
              <span className="num font-[600]">{brl(nota.valor)}</span>
            </Par>
          </dl>
        )}
      </Modal>
    </>
  );
}

const TELAS: Record<string, string> = {
  conferencia: "/contabil/conferencia",
  vazia: "/contabil/balancete-contabil",
};

/**
 * Prévia de tela: a moldura REAL do módulo (barra lateral, topo com contexto,
 * cabeçalho, abas, portão de execução) montada fora da rota do módulo, com
 * dado de mentira. É onde se julga a estética no lugar real, sem Questor.
 */
export default function Previa({ params }: { params: Promise<{ tela: string }> }) {
  const { tela } = use(params);
  const caminho = TELAS[tela] ?? TELAS.conferencia;
  return (
    <Semeador>
      <ProvedorCasca
        dados={{
          usuario: { id: "previa", nome: "Eduardo Lanzarin", email: "eduardo.lanzarin@navecon.net.br", admin: true, temFoto: false },
          acessos: { contabil: secoesDoModulo("contabil").map((s) => s.id), fiscal: ["painel"], folha: ["painel"], rh: ["painel"] },
        }}
      >
        <CaminhoForcado.Provider value={caminho}>
          {tela === "conferencia" && <AutoExecutar />}
          <MolduraModulo moduloId="contabil">
            {tela === "conferencia" ? <ConteudoConferencia modalAberto={false} /> : null}
          </MolduraModulo>
        </CaminhoForcado.Provider>
      </ProvedorCasca>
    </Semeador>
  );
}
