"use client";

import { useState } from "react";
import { PainelPaleta, type ItemPaleta } from "@/componentes/casca/paleta";
import { CabecalhoPapel } from "@/componentes/produto/cabecalho-papel";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { AguardandoExecucao, BotaoExecutar, CabecalhoPagina, EscolhaEmpresa } from "@/componentes/produto/pagina";
import { SeletorConta } from "@/componentes/produto/seletor-conta";
import { SeletorEmpresa } from "@/componentes/produto/seletor-empresa";
import { SeletorFilial } from "@/componentes/produto/seletor-filial";
import { SeletorPeriodoDia, SeletorPeriodoMes } from "@/componentes/produto/seletor-periodo";
import { Bloco, Familia, Variante } from "../bloco";

const ITENS_PALETA: ItemPaleta[] = [
  { id: "1", grupo: "Seções", rotulo: "Conferência Fiscal", detalhe: "Contábil", icone: "conferencia", busca: "", agir: () => {} },
  { id: "2", grupo: "Seções", rotulo: "Conciliação Bancária", detalhe: "Contábil", icone: "banco", busca: "", agir: () => {} },
  { id: "3", grupo: "Seções", rotulo: "Balancete Contábil", detalhe: "Contábil", icone: "planilha", busca: "", agir: () => {} },
  { id: "4", grupo: "Empresas", rotulo: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", detalhe: "1318", icone: "historico", busca: "", agir: () => {} },
  { id: "5", grupo: "Empresas", rotulo: "NAVECON CONTABILIDADE LTDA", detalhe: "1200", icone: "historico", busca: "", agir: () => {} },
];

export function BlocosProduto() {
  const [termoPaleta, setTermoPaleta] = useState("");
  const [ativoPaleta, setAtivoPaleta] = useState(0);
  const [empresa, setEmpresa] = useState<number[]>([1200]);
  const [grupos, setGrupos] = useState<number[]>([]);
  const [escopo, setEscopo] = useState<number[]>([]);
  const [estabs, setEstabs] = useState<number[]>([]);
  const [dia, setDia] = useState({ inicio: "2026-08-01", fim: "2026-08-31" });
  const [mes, setMes] = useState({ inicio: "2026-06-01", fim: "2026-08-31" });
  const [conta, setConta] = useState<number | null>(null);

  return (
    <Familia
      id="produto"
      titulo="Produto"
      descricao="Peças que conhecem o domínio: o contexto de trabalho, a conta do plano, o cabeçalho e a execução."
    >
      <Bloco
        titulo="Contexto de trabalho"
        porque="Empresa, filial e período moram no topo e valem para todas as seções do módulo: escolher a empresa uma vez serve à conciliação, à conferência e ao balancete dela. As recentes sobem para o topo, porque o analista volta às mesmas cinco empresas o dia inteiro entre 1.500."
      >
        <div className="flex flex-col gap-4">
          <Variante nome="Bancada: uma empresa, filial e período por dia">
            <div className="flex flex-wrap items-center gap-2">
              <SeletorEmpresa escopo="uma" empresas={empresa} grupos={[]} onMudar={(m) => setEmpresa(m.empresas)} />
              <SeletorFilial empresa={1200} estabs={estabs} onMudar={setEstabs} />
              <SeletorPeriodoDia inicio={dia.inicio} fim={dia.fim} onMudar={(inicio, fim) => setDia({ inicio, fim })} />
            </div>
          </Variante>
          <Variante nome="Sem empresa: o convite fica no próprio botão">
            <div className="flex flex-wrap items-center gap-2">
              <SeletorEmpresa escopo="uma" empresas={[]} grupos={[]} onMudar={() => {}} />
            </div>
          </Variante>
          <Variante nome="Escritório: empresa vira filtro, com grupo; período por mês (balancete)">
            <div className="flex flex-wrap items-center gap-2">
              <SeletorEmpresa
                escopo="opcional"
                empresas={escopo}
                grupos={grupos}
                onMudar={(m) => {
                  setEscopo(m.empresas);
                  setGrupos(m.grupos);
                }}
              />
              <SeletorPeriodoMes inicio={mes.inicio} fim={mes.fim} onMudar={(inicio, fim) => setMes({ inicio, fim })} />
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Cabeçalho da seção e execução"
        porque="O topo da seção diz onde a pessoa está e o que dá para fazer ali, e para; o módulo já está na trilha. Consulta pesada executa por botão (Ctrl+Enter também), e quando o recorte muda depois da execução o botão diz isso, sem jogar fora o resultado que está na tela."
      >
        <div className="nx-vidro flex flex-col gap-6 rounded-painel p-5">
          <CabecalhoPagina
            titulo="Conferência Fiscal"
            descricao="Notas não contabilizadas, na conta errada, em bloco ou duplicadas"
            acoes={
              <>
                <MenuExportar modulo="contabil" cortes={[{ id: "a", rotulo: "Notas", nome: "notas", montar: () => ({ cabecalhos: [], linhas: [] }) }]} />
                <BotaoExecutar rotulo="Executar" onExecutar={() => {}} />
              </>
            }
          />
          <CabecalhoPagina
            titulo="Balancete Contábil"
            descricao="Saldo anterior, movimento do mês e saldo atual, conta a conta"
            acoes={<BotaoExecutar rotulo="Gerar" onExecutar={() => {}} desatualizado />}
          />
        </div>
      </Bloco>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Bloco
          titulo="Antes da primeira execução"
          porque="Não é Nenhum resultado, porque ainda não houve pergunta: é o convite para executar, com o atalho."
        >
          <AguardandoExecucao rotulo="Executar" onExecutar={() => {}} />
        </Bloco>
        <Bloco
          titulo="Bancada sem empresa"
          porque="A tela nem monta: diz o que falta e abre o seletor do topo. A escolha vale para as outras seções."
        >
          <EscolhaEmpresa />
        </Bloco>
      </div>

      <Bloco
        titulo="Paleta de comandos"
        porque="Ctrl+K de qualquer tela: ir para uma seção ou trocar de empresa sem sair de onde está. Numa carteira de 1.500 empresas, digitar o código é mais rápido que qualquer lista. Sem termo, mostra as seções e as empresas recentes."
      >
        <div className="flex justify-center rounded-painel border border-dashed border-linha-forte bg-poco p-6">
          <PainelPaleta
            estatico
            termo={termoPaleta}
            onTermo={setTermoPaleta}
            itens={ITENS_PALETA}
            ativo={ativoPaleta}
            onAtivo={setAtivoPaleta}
            onEscolher={() => {}}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Conta do plano"
        porque="Busca no plano da empresa por número, classificação ou descrição, e só deixa escolher conta analítica que existe: digitar o número direto aceitaria conta que a empresa não tem. Serve a Conciliação, o Plano de contabilização e a Implantação."
      >
        <div className="flex max-w-md flex-col gap-2">
          <SeletorConta empresa={1200} valor={conta} onMudar={setConta} limpavel placeholder="Contrapartida do pagamento" />
        </div>
      </Bloco>

      <Bloco
        titulo="Cabeçalho do papel"
        porque="Na impressão a moldura some, e com ela a empresa, a filial e o período do topo. Relatório sem dizer de quem, de quando e com que recorte não se entrega a cliente, então a tela repõe tudo aqui: escondido na tela, visível no papel. Serve o balancete e a rotatividade do DP; no catálogo aparece na tela para ser visto."
      >
        <div className="nx-vidro rounded-painel p-5">
          <CabecalhoPapel
            naTela
            titulo="Análise de Balancete"
            empresa={{ codigo: 1318, nome: "MAGALHAES COMERCIO DE ALIMENTOS LTDA", cnpj: "12345678000195" }}
            itens={[
              { rotulo: "Período", valor: "junho de 2026 a agosto de 2026 (3 meses)" },
              { rotulo: "Filiais", valor: "Todas, consolidado" },
              { rotulo: "Dados de", valor: "02/09/2026 09:41" },
            ]}
          />
        </div>
      </Bloco>
    </Familia>
  );
}
