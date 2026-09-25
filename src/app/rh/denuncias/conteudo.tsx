"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao } from "@/componentes/primitivos/botao";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Girando, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { JanelaLinkCanal } from "@/componentes/produto/rh/denuncia-canal";
import { CHAVES_DENUNCIA, ModalDenuncia } from "@/componentes/produto/rh/denuncia-detalhe";
import {
  FaixaDenuncias,
  TabelaDenuncias,
  filtrarFilaDenuncias,
  statusDaRota,
  type FiltroSituacaoDenuncia,
} from "@/componentes/produto/rh/denuncia-fila";
import {
  CATEGORIAS_DENUNCIA,
  CATEGORIA_DENUNCIA_ROTULO,
  STATUS_DENUNCIA,
  STATUS_DENUNCIA_ROTULO,
  type CategoriaDenuncia,
  type DenunciaDashboard,
  type DenunciaResumo,
} from "@/lib/denuncia-tipos";
import { num } from "@/lib/format";
import { useConsulta } from "@/hooks/use-consulta";
import { useEstadoTela } from "@/hooks/use-estado-modulo";

type FiltroAssunto = "todas" | CategoriaDenuncia;

interface RespostaFila {
  denuncias: DenunciaResumo[];
  dashboard: DenunciaDashboard;
}

/** Filtro de pendência que volta vazio é um estado bom, e diz isso em vez de "nada encontrado". */
const NADA_PENDENTE: Partial<Record<FiltroSituacaoDenuncia, { titulo: string; descricao: string }>> = {
  abertas: { titulo: "Nenhuma denúncia aberta", descricao: "Todas as que chegaram já foram encerradas." },
  recebida: { titulo: "Nenhuma denúncia nova", descricao: "Todas as que chegaram já foram abertas." },
  aguardando: { titulo: "Nenhuma denúncia esperando o RH", descricao: "Nas abertas, a última palavra foi do RH." },
};

/**
 * Canal de denúncia: os relatos que chegam pelo link aberto, a situação de cada
 * um e a conversa com quem denunciou (anônimo, só com protocolo e senha). A
 * fila vem da mais movimentada para a menos; os números do topo são do canal
 * inteiro, sem o filtro.
 *
 * Relato novo chega a qualquer hora e ninguém é avisado por e-mail: a consulta
 * fica velha em meio minuto, para a volta à tela já trazer o que entrou.
 */
export default function Conteudo() {
  const [situacao, setSituacao] = useEstadoTela<FiltroSituacaoDenuncia>("situacao", "todas");
  const [assunto, setAssunto] = useEstadoTela<FiltroAssunto>("assunto", "todas");
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [linkAberto, setLinkAberto] = useState(false);

  const params = new URLSearchParams();
  const status = statusDaRota(situacao);
  if (status) params.set("status", status);
  if (assunto !== "todas") params.set("categoria", assunto);
  const url = `/api/rh/denuncias${params.size ? `?${params}` : ""}`;

  const res = useConsulta<RespostaFila>(CHAVES_DENUNCIA.fila, url, { staleTime: 30_000 });
  const d = res.data;
  const painel = d?.dashboard;
  const itens = useMemo(() => (d ? filtrarFilaDenuncias(d.denuncias, situacao) : undefined), [d, situacao]);

  const conta = (n: number | undefined) => (painel && n != null ? num(n) : undefined);
  const opcoesSituacao: Opcao[] = [
    { valor: "todas", rotulo: "Todas as situações", detalhe: conta(painel?.total) },
    {
      valor: "abertas",
      rotulo: "Abertas",
      detalhe: conta(painel && painel.porStatus.recebida + painel.porStatus.em_analise),
    },
    { valor: "aguardando", rotulo: "Aguardando o RH", detalhe: conta(painel?.aguardandoRh) },
    ...STATUS_DENUNCIA.map((s) => ({
      valor: s,
      rotulo: STATUS_DENUNCIA_ROTULO[s],
      detalhe: conta(painel?.porStatus[s]),
    })),
  ];
  const opcoesAssunto: Opcao[] = [
    { valor: "todas", rotulo: "Todos os assuntos", detalhe: conta(painel?.total) },
    ...CATEGORIAS_DENUNCIA.map((c) => ({
      valor: c,
      rotulo: CATEGORIA_DENUNCIA_ROTULO[c],
      detalhe: conta(painel && (painel.porCategoria.find((p) => p.categoria === c)?.qtd ?? 0)),
    })),
  ];

  if (res.isError && !d)
    return (
      <PainelErro
        titulo="Não deu para carregar as denúncias"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  const filtrado = situacao !== "todas" || assunto !== "todas";
  const limpar = () => {
    setSituacao("todas");
    setAssunto("todas");
  };

  let vazio: ReactNode;
  if (painel && painel.total === 0)
    vazio = (
      <Vazio
        icone="escudo"
        titulo="Nenhuma denúncia recebida"
        descricao="Divulgue o link do canal para os colaboradores. Os relatos chegam aqui sem o nome de quem enviou."
        acao={
          <Botao icone="link" onClick={() => setLinkAberto(true)}>
            Ver o link do canal
          </Botao>
        }
      />
    );
  else if (NADA_PENDENTE[situacao] && assunto === "todas")
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo={NADA_PENDENTE[situacao]!.titulo}
        descricao={NADA_PENDENTE[situacao]!.descricao}
        acao={<Botao onClick={limpar}>Ver todas</Botao>}
      />
    );
  else if (filtrado)
    vazio = (
      <Vazio
        compacto
        icone="filtrar"
        titulo="Nenhuma denúncia com esse filtro"
        descricao="Troque a situação ou o assunto."
        acao={<Botao onClick={limpar}>Limpar filtros</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>
        <Botao
          variante="fantasma"
          icone="atualizar"
          carregando={res.isFetching && !!d}
          onClick={() => res.refetch()}
        >
          Atualizar
        </Botao>
        <Botao icone="link" onClick={() => setLinkAberto(true)}>
          Link do canal
        </Botao>
      </AcoesPagina>

      <FaixaDenuncias dados={painel} onFiltrar={setSituacao} />

      <Painel
        corpo="p-0"
        titulo="Fila"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Movimentação mais recente primeiro
            {res.isFetching && d && <Girando />}
          </span>
        }
      >
        {/* Os filtros numa faixa do corpo, e não nas ações do cabeçalho: lá eles
            não quebram linha e, no celular, empurrariam a página para o lado. */}
        <div className="flex flex-wrap gap-2 border-b border-linha px-4 py-2.5">
          <Combo
            className="w-full sm:w-56"
            icone="filtrar"
            rotuloAcessivel="Situação"
            opcoes={opcoesSituacao}
            valor={situacao}
            onMudar={(v) => setSituacao(v as FiltroSituacaoDenuncia)}
          />
          <Combo
            className="w-full sm:w-56"
            icone="etiquetas"
            rotuloAcessivel="Assunto"
            opcoes={opcoesAssunto}
            valor={assunto}
            onMudar={(v) => setAssunto(v as FiltroAssunto)}
          />
        </div>
        <TabelaDenuncias itens={itens} vazio={vazio} onAbrir={(x) => setAbertaId(x.id)} abertaId={abertaId} />
      </Painel>

      <ModalDenuncia id={abertaId} onFechar={() => setAbertaId(null)} />
      <JanelaLinkCanal aberto={linkAberto} onFechar={() => setLinkAberto(false)} />
    </>
  );
}
