"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { MenuExportar } from "@/componentes/produto/menu-exportar";
import { ModalDetalheEnvio } from "@/componentes/produto/rh/envio-detalhe";
import { CHAVE_ENVIOS, ModalEnviarFormulario } from "@/componentes/produto/rh/envio-enviar";
import { QuandoEnvio, RespostasEnvio } from "@/componentes/produto/rh/envio-situacao";
import { dataBR, num, pct } from "@/lib/format";
import type { EnvioResumo } from "@/lib/envios";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";

/** Data de referência do envio para ordenar e exportar: quando saiu ou, agendado, quando sai. */
const quandoDe = (e: EnvioResumo) => e.disparadoEm ?? e.agendadoPara ?? e.criadoEm;
const agendado = (e: EnvioResumo) => !e.disparadoEm && !!e.agendadoPara;

/**
 * Os formulários que o RH já mandou: para quem, quando e quantos responderam.
 * O detalhe (quem respondeu o quê) abre no modal. Os envios do automático
 * aparecem aqui também, porque cada disparo de uma regra vira um envio comum.
 */
export default function Conteudo() {
  const res = useConsulta<EnvioResumo[]>(CHAVE_ENVIOS, "/api/rh/envios");
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [aberto, setAberto] = useState<EnvioResumo | null>(null);

  const resumo = useMemo(() => {
    const saidos = (d ?? []).filter((e) => e.disparadoEm);
    const destinatarios = saidos.reduce((s, e) => s + e.total, 0);
    const respondidos = saidos.reduce((s, e) => s + e.respondidos, 0);
    return {
      envios: saidos.length,
      agendados: (d ?? []).filter(agendado).length,
      destinatarios,
      respondidos,
      faltam: destinatarios - respondidos,
    };
  }, [d]);

  const linhas = useMemo(() => {
    const t = normalizar(busca.trim());
    if (!t) return d ?? [];
    return (d ?? []).filter((e) => normalizar(`${e.titulo} ${e.formularioNome}`).includes(t));
  }, [d, busca]);

  const colunas: Coluna<EnvioResumo>[] = [
    {
      id: "envio",
      cabecalho: "Envio",
      largura: "48%",
      ordenar: (e) => e.titulo,
      celula: (e) => (
        <span className="block min-w-0">
          <span className="block truncate font-[560] text-tinta" title={e.titulo}>
            {e.titulo}
          </span>
          {e.formularioNome !== e.titulo && (
            <span className="block truncate text-pequeno text-apagado" title={e.formularioNome}>
              {e.formularioNome}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "quando",
      cabecalho: "Quando",
      ordenar: quandoDe,
      celula: (e) => <QuandoEnvio envio={e} />,
    },
    {
      id: "destinatarios",
      cabecalho: "Destinatários",
      alinhar: "dir",
      secundaria: true,
      ordenar: (e) => e.total,
      celula: (e) => num(e.total),
    },
    {
      id: "respostas",
      cabecalho: "Respostas",
      ordenar: (e) => (e.total ? e.respondidos / e.total : 0),
      celula: (e) => <RespostasEnvio respondidos={e.respondidos} total={e.total} />,
    },
  ];

  if (res.isError)
    return (
      <PainelErro titulo="Não deu para carregar os envios" mensagem={(res.error as Error).message} onTentar={() => res.refetch()} />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="email"
        titulo="Nenhum formulário enviado"
        descricao="Escolha um formulário ativo e mande para os gestores, para colaboradores ou para e-mails avulsos. Cada pessoa recebe um link próprio."
        acao={
          <Botao variante="primario" icone="enviar" onClick={() => setEnviarAberto(true)}>
            Enviar formulário
          </Botao>
        }
      />
    );
  else if (d)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Nenhum envio com esse termo"
        descricao="Busque pelo assunto do e-mail ou pelo nome do formulário."
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <MenuExportar
          modulo="rh"
          desabilitado={!d?.length}
          cortes={[
            {
              id: "envios",
              rotulo: "Envios",
              nome: "rh-envios",
              montar: () => ({
                cabecalhos: ["Envio", "Formulário", "Situação", "Data", "Destinatários", "Responderam", "Faltam"],
                linhas: linhas.map((e) => [
                  e.titulo,
                  e.formularioNome,
                  e.disparadoEm ? "Saiu" : agendado(e) ? "Agendado" : "Não saiu",
                  dataBR(quandoDe(e)),
                  e.total,
                  e.respondidos,
                  e.total - e.respondidos,
                ]),
              }),
            },
          ]}
        />
        <Botao variante="primario" icone="enviar" onClick={() => setEnviarAberto(true)}>
          Enviar formulário
        </Botao>
      </AcoesPagina>

      <FaixaIndicadores colunas={4}>
        <Indicador
          rotulo="Envios feitos"
          icone="email"
          carregando={!d}
          valor={num(resumo.envios)}
          detalhe={resumo.agendados ? `Mais ${num(resumo.agendados)} agendados` : "Nenhum agendado"}
        />
        <Indicador
          rotulo="Destinatários"
          icone="pessoas"
          carregando={!d}
          valor={num(resumo.destinatarios)}
          detalhe="Nos envios que já saíram"
        />
        <Indicador
          rotulo="Responderam"
          icone="ok"
          carregando={!d}
          valor={num(resumo.respondidos)}
          detalhe={resumo.destinatarios ? `${pct((resumo.respondidos / resumo.destinatarios) * 100)} dos destinatários` : "Sem destinatários ainda"}
        />
        <Indicador
          rotulo="Faltam responder"
          icone="relogio"
          carregando={!d}
          valor={num(resumo.faltam)}
          detalhe={resumo.faltam ? "Abra o envio para ver quem" : "Todos responderam"}
          tom={d && resumo.destinatarios > 0 && resumo.faltam === 0 ? "ok" : "neutro"}
        />
      </FaixaIndicadores>

      {d && d.length > 0 && (
        <Nota>Envio agendado sai sozinho no dia marcado. O que sai do automático também aparece nesta lista.</Nota>
      )}

      <Painel
        corpo="p-0"
        titulo="Envios"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Mais recentes primeiro. Clique num envio para ver as respostas
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <Campo
            icone="buscar"
            placeholder="Assunto ou formulário"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            classeCaixa="w-full sm:w-64"
            aria-label="Buscar envio"
            fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
          />
        }
      >
        {!d ? (
          <EsqueletoTabela linhas={6} colunas={4} />
        ) : (
          <TabelaDados
            rotulo="Envios de formulário"
            colunas={colunas}
            linhas={linhas}
            chave={(e) => String(e.id)}
            onLinha={setAberto}
            selecionada={(e) => e.id === aberto?.id}
            alturaMax="62vh"
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalEnviarFormulario aberto={enviarAberto} onFechar={() => setEnviarAberto(false)} />
      <ModalDetalheEnvio envio={aberto} onFechar={() => setAberto(null)} />
    </>
  );
}
