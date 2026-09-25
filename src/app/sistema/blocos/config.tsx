"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import {
  GrupoEmpresaEstatico,
  TabelaGruposEmpresa,
  type RascunhoGrupo,
} from "@/componentes/produto/config/grupos-empresa";
import { ListaEmpresasMarcaveis } from "@/componentes/produto/empresas-marcaveis";
import { CampoEmpresasGrupo } from "@/componentes/produto/grupo-empresas-campo";
import type { ModoGrupo } from "@/lib/grupo-modo";
import type { EmpresaMarcavel, GrupoEmpresaCadastro } from "@/lib/grupos-empresa-tipos";
import { Bloco, Variante } from "../bloco";
import { EMPRESAS_FALSAS } from "../dados-falsos";

/*
 * Peças de Configurações: a lista de empresas para marcar, o campo de empresas
 * de um grupo (que a Administração vai usar nos grupos de permissão) e o
 * cadastro de grupos de negócio. Tudo com dado de mentira.
 */

const EMPRESAS: EmpresaMarcavel[] = [
  ...EMPRESAS_FALSAS,
  { codigo: 1789, nome: "U FIT ACADEMIA JOINVILLE LTDA" },
  { codigo: 1790, nome: "U FIT ACADEMIA BLUMENAU LTDA" },
  { codigo: 1791, nome: "U FIT FRANQUIAS E PARTICIPACOES LTDA" },
  { codigo: 1802, nome: "AUTO PECAS BR 280 LTDA" },
  { codigo: 1815, nome: "CONSTRUTORA MORRO DA BOA VISTA LTDA" },
  { codigo: 1827, nome: "ESCOLA DE IDIOMAS PONTE LTDA ME" },
  { codigo: 1840, nome: "FARMACIA SAO JOSE DE GUARAMIRIM LTDA" },
  { codigo: 1856, nome: "HOTEL POUSADA DAS AGUAS EIRELI" },
  { codigo: 1861, nome: "INDUSTRIA TEXTIL MALHAS NORTE LTDA" },
  { codigo: 1879, nome: "LABORATORIO DE ANALISES VIDA LTDA" },
  { codigo: 1884, nome: "MERCADO FAMILIA SCHULZ LTDA" },
  { codigo: 1893, nome: "OFICINA MECANICA IRMAOS KRUEGER ME" },
  { codigo: 1907, nome: "RESTAURANTE SABOR DA SERRA LTDA" },
  { codigo: 1912, nome: "SERRARIA E MADEIREIRA PINHEIRO LTDA" },
].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const U_FIT = [1788, 1789, 1790, 1791];

const GRUPOS: GrupoEmpresaCadastro[] = [
  { id: 3, nome: "Grupo Schulz", modo: "lista", empresas: 2, marcadas: 2, relatorios: 0, atualizadoEm: "2026-07-02T10:12:00" },
  { id: 2, nome: "Grupo U FIT", modo: "lista", empresas: 4, marcadas: 4, relatorios: 2, atualizadoEm: "2026-09-18T16:40:00" },
  { id: 5, nome: "Sem cliente ativo", modo: "lista", empresas: 0, marcadas: 1, relatorios: 0, atualizadoEm: "2026-03-11T09:05:00" },
  { id: 1, nome: "Todas menos NAVECON", modo: "exceto", empresas: 1491, marcadas: 3, relatorios: 0, atualizadoEm: "2026-09-02T08:30:00" },
];

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Erro" },
];

function ListaViva({ inicial, busca, visao }: { inicial: number[]; busca?: string; visao?: "marcadas" }) {
  const [marcadas, setMarcadas] = useState(() => new Set(inicial));
  return (
    <ListaEmpresasMarcaveis
      empresas={EMPRESAS}
      marcadas={marcadas}
      onMudar={setMarcadas}
      buscaInicial={busca}
      visaoInicial={visao}
      alturaMax="15rem"
    />
  );
}

function CampoVivo({ modo: modoInicial, marcadas: inicial, trocou }: { modo: ModoGrupo; marcadas: number[]; trocou?: boolean }) {
  const [v, setV] = useState(() => ({ modo: modoInicial, marcadas: new Set(inicial) }));
  return (
    <CampoEmpresasGrupo
      empresas={EMPRESAS}
      modo={v.modo}
      marcadas={v.marcadas}
      onMudar={setV}
      trocouInicial={trocou}
    />
  );
}

function TabelaViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS} valor={estado} onMudar={setEstado} rotulo="Estado da tabela" />
      </div>
      <Painel corpo="p-0" titulo="Grupos" descricao="Em ordem alfabética">
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={3} linhas={4} />
        ) : estado === "erro" ? (
          <div className="p-4">
            <PainelErro
              titulo="Não deu para carregar os grupos"
              mensagem="Banco do app fora do ar."
              onTentar={() => setEstado("dado")}
            />
          </div>
        ) : (
          <TabelaGruposEmpresa
            grupos={estado === "vazio" ? [] : GRUPOS}
            onAbrir={(g) => setAberto(g.id)}
            selecionado={aberto}
            alturaMax="20rem"
            vazio={
              <Vazio
                icone="camadas"
                titulo="Nenhum grupo cadastrado"
                descricao="Junte as empresas de um mesmo negócio, como a U FIT, para filtrar as telas pelo grupo inteiro."
                acao={
                  <Botao variante="primario" icone="mais">
                    Criar grupo
                  </Botao>
                }
              />
            }
          />
        )}
      </Painel>
    </div>
  );
}

const rascunho = (nome: string, modo: ModoGrupo, marcadas: number[]): RascunhoGrupo => ({
  nome,
  modo,
  marcadas: new Set(marcadas),
});

export function BlocosConfig() {
  return (
    <>
      <Bloco
        titulo="Lista de Empresas para Marcar"
        porque="Grupo de empresa tem centenas entre 1.500, então marcar e desmarcar valem para tudo que a busca e a visão acharam, não só para as linhas desenhadas (o teto é de 300 na tela). A visão Marcadas revisa a escolha sem rolar a lista, Shift+clique pega um intervalo e Enter na busca marca a única achada. O contador conta sobre a lista: empresa marcada que saiu do Questor não entra."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Variante nome="Com algumas marcadas (experimente o Shift+clique)">
            <ListaViva inicial={[1318, 1702, 1884]} />
          </Variante>
          <Variante nome="Buscando: o lote vale para as achadas">
            <ListaViva inicial={[1788]} busca="u fit" />
          </Variante>
          <Variante nome="Só as marcadas">
            <ListaViva inicial={U_FIT} visao="marcadas" />
          </Variante>
          <Variante nome="Carregando o cadastro">
            <ListaEmpresasMarcaveis empresas={[]} marcadas={new Set()} onMudar={() => {}} carregando alturaMax="15rem" />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Empresas do Grupo"
        porque="O grupo guarda as marcadas e um modo que diz o que elas são: o grupo, ou o que fica fora dele. Trocar de modo inverte as marcações em vez de reinterpretá-las, então o grupo sai da troca com as mesmas empresas. Em Todas, exceto, empresa nova no Questor entra sozinha, e a lista em que mais da metade está marcada avisa isso."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Variante nome="Só as marcadas">
            <CampoVivo modo="lista" marcadas={U_FIT} />
          </Variante>
          <Variante nome="Todas, exceto, logo depois da troca">
            <CampoVivo modo="exceto" marcadas={[1200, 1455]} trocou />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Grupos de Empresa"
        porque="A lista mostra quantas empresas cada grupo tem hoje, com o modo resolvido contra o Questor. Grupo sem empresa leva o selo porque some do seletor de empresa do topo, e quem procura por ele lá não entende por quê."
      >
        <TabelaViva />
      </Bloco>

      <Bloco
        titulo="Grupo Aberto"
        porque="Nome, empresas e remoção na mesma janela. O grupo que já existe abre na visão Marcadas, porque as empresas dele somem entre as 1.500 do Questor. Salvar só acende com mudança, e com mudança o clique fora não fecha. Grupo usado em relatório do Post Mortem não sai: o relatório aponta para ele por chave estrangeira, e a janela diz isso antes de a pessoa tentar."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <Variante nome="Grupo novo">
            <GrupoEmpresaEstatico inicial={rascunho("", "lista", [])} empresas={EMPRESAS} />
          </Variante>
          <Variante nome="Usado no Post Mortem: sem remoção">
            <GrupoEmpresaEstatico grupo={GRUPOS[1]} inicial={rascunho("Grupo U FIT", "lista", U_FIT)} empresas={EMPRESAS} />
          </Variante>
          <Variante nome="Remoção esperando o segundo clique">
            <GrupoEmpresaEstatico
              grupo={GRUPOS[0]}
              inicial={rascunho("Grupo Schulz", "lista", [1884, 1893])}
              empresas={EMPRESAS}
              confirmandoInicial
            />
          </Variante>
          <Variante nome="Empresas do Questor ainda chegando">
            <GrupoEmpresaEstatico
              grupo={GRUPOS[3]}
              inicial={rascunho("Todas menos NAVECON", "exceto", [1200, 1455, 1633])}
              empresas={[]}
              carregando
            />
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
