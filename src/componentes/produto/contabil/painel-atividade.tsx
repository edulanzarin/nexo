"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/componentes/primitivos/avatar";
import { Botao } from "@/componentes/primitivos/botao";
import { Esqueleto, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { cn } from "@/lib/cn";
import { nomeMes } from "@/lib/contexto";
import { dataBR, dataHoraBR, num } from "@/lib/format";
import { localDoCaminho } from "@/lib/modulos";
import type { ContabilAtividade, ContabilBase, ContabilEvento } from "@/lib/painel-contabil-tipos";
import { classeDaAcao, trabalhosDe } from "@/lib/prod-app-tipos";

/*
 * As peças dos dois painéis do Contábil (o da equipe e o meu). O retrato é de
 * ATIVIDADE: o que já se rodou no app e a base configurada. Os dois painéis
 * leem os mesmos contadores da trilha, recortados por dono no servidor, então
 * as peças são as mesmas e só o texto muda de "o time" para "você".
 */

/** Verbo da trilha para a frase do feed. O que não está aqui aparece cru, para denunciar a falta. */
const ROTULO_ACAO: Record<string, string> = {
  "contabil.conciliacao.gerar": "Conciliação gerada",
  "contabil.implantacao.gerar": "Implantação gerada",
  "contabil.implantacao.patrimonial": "Patrimonial gerado",
  "contabil.laudo.gerar": "Laudo gerado",
  "contabil.pendencia.triar": "Pendência triada",
  "contabil.export": "Exportação",
  "contabil.consulta": "Consulta executada",
  "contabil.nota.ver": "Nota aberta",
  "contabil.plano.salvar": "Plano de contabilização salvo",
  "contabil.plano.reverter": "Plano de contabilização revertido",
  "contabil.plano.replicar": "Plano de contabilização replicado",
  "contabil.plano.aprender": "Plano de contabilização aprendido",
  "contabil.regra.salvar": "Regra de extrato salva",
  "contabil.regra.remover": "Regra de extrato removida",
  "contabil.regra.replicar": "Regra de extrato replicada",
};

// A cor do gesto é a da classe dele no catálogo da aba "No NaveX" da
// Produtividade: a conciliação tem a mesma cor aqui, no gráfico da série e lá.
const TRABALHOS = trabalhosDe("contabil");

/** Rótulo e cor de um verbo da trilha. */
/** Título leva maiúscula nas palavras principais, e o mês entra nele como nome. */
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function acaoDaTrilha(acao: string): { rotulo: string; cor: string } {
  const classe = classeDaAcao("contabil", acao);
  const trabalho = TRABALHOS.find((t) => t.id === classe);
  return { rotulo: ROTULO_ACAO[acao] ?? acao, cor: trabalho?.cor ?? "var(--serie-outras)" };
}

/**
 * O alvo como a pessoa lê. A consulta registra o caminho e a query crus
 * (`/contabil/conferencia · empresas=1200&inicio=...`), e ela é o gesto mais
 * frequente da trilha: sem tradução, o feed do time vira uma parede de URL.
 * Qualquer outro alvo já nasce legível e passa como veio.
 */
export function alvoLegivel(alvo: string | null): string | null {
  if (!alvo || !alvo.startsWith("/")) return alvo;
  const [caminho, qs = ""] = alvo.split(" · ");
  const local = localDoCaminho(caminho);
  if (!local) return alvo;
  const partes = [
    local.aba && local.secao.abas.length > 1 ? `${local.secao.rotulo} · ${local.aba.rotulo}` : local.secao.rotulo,
  ];
  const p = new URLSearchParams(qs);
  const empresas = p.get("empresas")?.split(",").filter(Boolean) ?? [];
  if (empresas.length === 1) partes.push(`empresa ${empresas[0]}`);
  else if (empresas.length > 1) partes.push(`${num(empresas.length)} empresas`);
  const inicio = p.get("inicio");
  const fim = p.get("fim");
  if (inicio && fim) partes.push(`${dataBR(inicio)} a ${dataBR(fim)}`);
  return partes.join(" · ");
}

/** Cor e rótulo de uma classe de trabalho do catálogo (série do gráfico, legenda). */
export function trabalhoContabil(id: string): { rotulo: string; cor: string } {
  const t = TRABALHOS.find((x) => x.id === id);
  return { rotulo: t?.rotulo ?? id, cor: t?.cor ?? "var(--serie-outras)" };
}

/** Título de um bloco do painel, com a informação de apoio à direita. */
function TituloBloco({ titulo, apoio }: { titulo: ReactNode; apoio?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
      <h2 className="text-medio font-[600] text-tinta">{titulo}</h2>
      {apoio && <span className="num text-pequeno text-apagado">{apoio}</span>}
    </div>
  );
}

/**
 * Bloco que não veio. Cada bloco do painel é uma consulta independente no
 * servidor: se uma falha, as outras chegam, e o buraco diz o que faltou em vez
 * de derrubar a tela inteira.
 */
function BlocoIndisponivel({ titulo, onTentar }: { titulo: string; onTentar?: () => void }) {
  return (
    <div className="nx-vidro rounded-painel">
      <Vazio
        compacto
        icone="alerta"
        titulo={titulo}
        descricao="A consulta deste bloco falhou no servidor."
        acao={
          onTentar && (
            <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
              Tentar de novo
            </Botao>
          )
        }
      />
    </div>
  );
}

/**
 * O que se rodou no mês, em cinco números. Zero é afirmação e aparece como
 * zero; bloco que não veio aparece como indisponível, nunca como zero.
 */
export function FaixaAtividade({
  titulo,
  periodo,
  atividade,
  carregando,
  onTentar,
}: {
  /** "Atividade do Time" ou "O Que Você Rodou"; o mês entra depois. */
  titulo: string;
  periodo?: { inicio: string; fim: string };
  atividade: ContabilAtividade | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
}) {
  const cabeca = (
    <TituloBloco
      titulo={periodo ? `${titulo} em ${maiuscula(nomeMes(periodo.inicio.slice(0, 7), true))}` : `${titulo} no Mês`}
      apoio={periodo ? `${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}` : undefined}
    />
  );
  if (!carregando && !atividade)
    return (
      <section className="flex flex-col gap-2">
        {cabeca}
        <BlocoIndisponivel titulo="Atividade indisponível" onTentar={onTentar} />
      </section>
    );
  const a = atividade;
  return (
    <section className="flex flex-col gap-2">
      {cabeca}
      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Conciliações geradas"
          icone="banco"
          carregando={carregando}
          valor={a ? num(a.conciliacoes) : ""}
          detalhe={a ? `${num(a.conciliacaoLinhas)} lançamentos gerados` : ""}
        />
        <Indicador
          rotulo="Implantações geradas"
          icone="importar"
          carregando={carregando}
          valor={a ? num(a.implantacoes) : ""}
          detalhe="Saldos e bens de abertura"
        />
        <Indicador
          rotulo="Laudos gerados"
          icone="planilha"
          carregando={carregando}
          valor={a ? num(a.laudos) : ""}
          detalhe="Análises de balancete"
        />
        <Indicador
          rotulo="Pendências triadas"
          icone="fila"
          carregando={carregando}
          valor={a ? num(a.pendenciasTriadas) : ""}
          detalhe={a ? `${num(a.pendenciasResolvidas)} resolvidas · ${num(a.pendenciasIgnoradas)} ignoradas` : ""}
        />
        <Indicador
          rotulo="Exportações"
          icone="baixar"
          carregando={carregando}
          valor={a ? num(a.exportacoes) : ""}
          detalhe="Planilhas e impressões"
        />
      </FaixaIndicadores>
    </section>
  );
}

/**
 * A base configurada: o conhecimento acumulado no app (plano aprendido, ajustes
 * manuais, regras de extrato, contas de banco, de-para). É contagem do
 * escritório inteiro, a mesma para o gestor e para o analista.
 */
export function FaixaBase({
  base,
  carregando,
  onTentar,
}: {
  base: ContabilBase | null | undefined;
  carregando?: boolean;
  onTentar?: () => void;
}) {
  const cabeca = <TituloBloco titulo="Base Configurada" apoio="Escritório inteiro" />;
  if (!carregando && !base)
    return (
      <section className="flex flex-col gap-2">
        {cabeca}
        <BlocoIndisponivel titulo="Base indisponível" onTentar={onTentar} />
      </section>
    );
  const b = base;
  return (
    <section className="flex flex-col gap-2">
      {cabeca}
      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Plano de Contabilização"
          icone="tabela"
          carregando={carregando}
          valor={b ? num(b.plano) : ""}
          detalhe="CFOPs com regra"
        />
        <Indicador
          rotulo="Ajustes do plano"
          icone="editar"
          carregando={carregando}
          valor={b ? num(b.regras) : ""}
          detalhe="Valem no lugar do Questor"
        />
        <Indicador
          rotulo="Regras de extrato"
          icone="lupa"
          carregando={carregando}
          valor={b ? num(b.regrasExtrato) : ""}
          detalhe="Contrapartidas ativas"
        />
        <Indicador
          rotulo="Contas de banco"
          icone="moedas"
          carregando={carregando}
          valor={b ? num(b.contasBanco) : ""}
          detalhe="Contas mapeadas"
        />
        <Indicador
          rotulo="De-para de implantação"
          icone="cruzar"
          carregando={carregando}
          valor={b ? num(b.depara) : ""}
          detalhe="Contas casadas"
        />
      </FaixaIndicadores>
    </section>
  );
}

/**
 * O feed da trilha. Com autor é o do gestor (quem fez o quê); sem autor é o
 * do analista, em que a coluna repetiria o próprio nome em toda linha.
 *
 * A linha se arruma pela largura do painel, não da janela: ao lado do gráfico
 * ela quebra em duas (gesto e hora em cima, alvo embaixo); na largura toda,
 * vira uma linha só, como tabela.
 */
export function FeedAtividade({
  eventos,
  comAutor,
  carregando,
  titulo = "Atividade recente",
  descricao,
  vazio,
  onTentar,
  className,
}: {
  eventos: ContabilEvento[] | null | undefined;
  comAutor?: boolean;
  carregando?: boolean;
  titulo?: string;
  descricao?: ReactNode;
  /** Frase do vazio: o do analista ensina, o do time só constata. */
  vazio: { titulo: string; descricao?: string };
  onTentar?: () => void;
  className?: string;
}) {
  let corpo: ReactNode;
  if (carregando) {
    corpo = (
      <ul aria-busy className="flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-start gap-2.5 border-b border-linha px-4 py-2.5 last:border-0">
            <Esqueleto className={cn("mt-0.5 shrink-0 rounded-full", comAutor ? "size-6" : "size-2")} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Esqueleto className="h-3 w-40" />
              <Esqueleto className="h-3 w-56" />
            </div>
          </li>
        ))}
      </ul>
    );
  } else if (!eventos) {
    corpo = (
      <Vazio
        compacto
        icone="alerta"
        titulo="Feed indisponível"
        descricao="A consulta da trilha falhou no servidor."
        acao={
          onTentar && (
            <Botao variante="secundario" icone="atualizar" onClick={onTentar}>
              Tentar de novo
            </Botao>
          )
        }
      />
    );
  } else if (!eventos.length) {
    corpo = <Vazio compacto icone="atividade" titulo={vazio.titulo} descricao={vazio.descricao} />;
  } else {
    corpo = (
      <ul className="@container flex flex-col">
        {eventos.map((e) => {
          const { rotulo, cor } = acaoDaTrilha(e.acao);
          const apoio = [comAutor ? e.usuario : null, alvoLegivel(e.alvo)].filter(Boolean).join(" · ");
          return (
            <li key={e.id} className="flex items-start gap-2.5 border-b border-linha px-4 py-2 last:border-0">
              {comAutor ? (
                <Avatar nome={e.usuario} tamanho={24} className="mt-0.5" />
              ) : (
                <span aria-hidden className="mt-[5px] size-2 shrink-0 rounded-[3px]" style={{ background: cor }} />
              )}
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 @2xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] @2xl:items-baseline">
                <span className="order-1 flex min-w-0 items-center gap-1.5 text-corpo text-tinta">
                  {comAutor && <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: cor }} />}
                  <span className="truncate">{rotulo}</span>
                </span>
                <time dateTime={e.quando} className="num order-2 text-micro text-apagado @2xl:order-3">
                  {dataHoraBR(e.quando)}
                </time>
                <span
                  title={apoio || undefined}
                  className="order-3 col-span-2 min-w-0 truncate text-pequeno text-apagado @2xl:order-2 @2xl:col-span-1"
                >
                  {apoio}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <Painel titulo={titulo} descricao={descricao} icone="historico" corpo="p-0 min-h-0 overflow-y-auto" className={className}>
      {corpo}
    </Painel>
  );
}
