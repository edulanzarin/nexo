"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Painel } from "@/componentes/primitivos/painel";
import { Paginacao } from "@/componentes/primitivos/tabela";
import { SetorEstatico, TabelaSetores } from "@/componentes/produto/admin/setores";
import { EventoEstatico, TabelaTrilha } from "@/componentes/produto/admin/trilha";
import type { EventoTrilha, SetorResumo } from "@/lib/admin-tipos";
import { num } from "@/lib/format";
import { Bloco, Variante } from "../bloco";

/*
 * Peças da Administração que registram e organizam: a trilha de auditoria e o
 * cadastro de setores. Tudo com dado de mentira.
 */

const EVENTOS: EventoTrilha[] = [
  {
    id: 912,
    usuarioNome: "Eduardo Lanzarin",
    acao: "admin.setor.criar",
    modulo: "admin",
    alvo: "Contábil",
    codigoempresa: null,
    criadoEm: "2026-09-25T16:42:00",
  },
  {
    id: 911,
    usuarioNome: "Ana Paula Ribeiro",
    acao: "contabil.consulta",
    modulo: "contabil",
    alvo: "/contabil/conciliacao · empresas=1318&inicio=2026-08-01&fim=2026-08-31",
    codigoempresa: 1318,
    criadoEm: "2026-09-25T16:20:00",
  },
  {
    id: 910,
    usuarioNome: "Camila Schmitt",
    acao: "folha.ficha.ver",
    modulo: "folha",
    alvo: "JOAO CARLOS DA SILVA",
    codigoempresa: 1402,
    criadoEm: "2026-09-25T15:58:00",
  },
  {
    id: 909,
    usuarioNome: "Ana Paula Ribeiro",
    acao: "contabil.laudo.gerar",
    modulo: "contabil",
    alvo: "Empresa 1318 · 2026-01 a 2026-06",
    codigoempresa: 1318,
    criadoEm: "2026-09-25T15:31:00",
  },
  {
    id: 908,
    usuarioNome: "Bruno Henrique Costa",
    acao: "fiscal.export",
    modulo: "fiscal",
    alvo: "notas-saidas-2026-08-01_2026-08-31",
    codigoempresa: null,
    criadoEm: "2026-09-25T14:07:00",
  },
  {
    id: 907,
    usuarioNome: "Diego Moretti",
    acao: "perfil.senha",
    modulo: "perfil",
    alvo: null,
    codigoempresa: null,
    criadoEm: "2026-09-25T11:15:00",
  },
  {
    id: 906,
    usuarioNome: "Eduardo Lanzarin",
    acao: "admin.usuario.salvar",
    modulo: "admin",
    alvo: "Elaine Kowalski (elaine.kowalski@navecon.net.br)",
    codigoempresa: null,
    criadoEm: "2026-09-25T10:02:00",
  },
  {
    // Verbo sem rótulo: aparece cru, e é assim que se descobre o gesto sem batismo.
    // (Um verbo do RH de propósito: um do Contábil ou do Fiscal faria o teste do
    // catálogo de produtividade cobrar classe para um gesto que não existe.)
    id: 905,
    usuarioNome: "Felipe Zanella",
    acao: "rh.formulario.duplicar",
    modulo: "rh",
    alvo: "Avaliação de Experiência (90 dias)",
    codigoempresa: null,
    criadoEm: "2026-09-24T17:48:00",
  },
];

const SETORES: SetorResumo[] = [
  { id: 1, nome: "Contábil", cargos: 4 },
  { id: 5, nome: "Departamento Pessoal", cargos: 3 },
  { id: 2, nome: "Fiscal", cargos: 2 },
  { id: 7, nome: "Legalização e Societário", cargos: 1 },
  { id: 9, nome: "Recepção", cargos: 0 },
];

type Estado = "dado" | "carregando" | "vazio" | "filtro" | "erro";

const ESTADOS_TRILHA: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "filtro", rotulo: "Filtro vazio" },
  { valor: "erro", rotulo: "Erro" },
];

function TrilhaViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [aberto, setAberto] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  if (estado === "erro")
    return (
      <div className="flex flex-col gap-3">
        <div>
          <Segmentado opcoes={ESTADOS_TRILHA} valor={estado} onMudar={setEstado} rotulo="Estado da trilha" />
        </div>
        <PainelErro
          titulo="Não deu para carregar a trilha"
          mensagem="Banco do app fora do ar."
          onTentar={() => setEstado("dado")}
        />
      </div>
    );
  const linhas = estado === "dado" ? EVENTOS : [];
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <Segmentado opcoes={ESTADOS_TRILHA} valor={estado} onMudar={setEstado} rotulo="Estado da trilha" />
      </div>
      <Painel
        corpo="p-0"
        titulo="Eventos"
        descricao={
          estado === "carregando"
            ? "Carregando"
            : estado === "dado"
              ? `${num(2318)} eventos, do mais recente`
              : "Nenhum evento"
        }
        rodape={
          estado === "dado" ? (
            <Paginacao pagina={pagina} porPagina={100} total={2318} onPagina={setPagina} />
          ) : undefined
        }
      >
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={4} linhas={5} />
        ) : (
          <TabelaTrilha
            eventos={linhas}
            onAbrir={(e) => setAberto(e.id)}
            selecionado={aberto}
            alturaMax="24rem"
            vazio={
              estado === "filtro" ? (
                <Vazio
                  compacto
                  icone="filtrar"
                  titulo="Nenhum evento com esse filtro"
                  descricao="A busca olha a pessoa, o alvo e o nome gravado da ação (export, ficha, laudo)."
                  acao={<Botao>Limpar filtros</Botao>}
                />
              ) : (
                <Vazio
                  icone="historico"
                  titulo="Nenhum evento registrado"
                  descricao="Fichas vistas, laudos gerados, exportações e mudanças de acesso aparecem aqui."
                />
              )
            }
          />
        )}
      </Painel>
    </div>
  );
}

const ESTADOS_SETORES: { valor: Exclude<Estado, "filtro">; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Erro" },
];

function SetoresVivos() {
  const [estado, setEstado] = useState<Exclude<Estado, "filtro">>("dado");
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS_SETORES} valor={estado} onMudar={setEstado} rotulo="Estado da lista de setores" />
      </div>
      <Painel corpo="p-0" titulo="Setores" descricao="Em ordem alfabética">
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={2} linhas={4} />
        ) : estado === "erro" ? (
          <div className="p-4">
            <PainelErro
              titulo="Não deu para carregar os setores"
              mensagem="Banco do app fora do ar."
              onTentar={() => setEstado("dado")}
            />
          </div>
        ) : (
          <TabelaSetores
            setores={estado === "vazio" ? [] : SETORES}
            onAbrir={(s) => setAberto(s.id)}
            selecionado={aberto}
            alturaMax="20rem"
            vazio={
              <Vazio
                icone="camadas"
                titulo="Nenhum setor cadastrado"
                descricao="Crie os setores do escritório, como Contábil e Fiscal, para agrupar os cargos."
                acao={
                  <Botao variante="primario" icone="mais">
                    Criar setor
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

export function BlocosAdminRegistro() {
  return (
    <>
      <Bloco
        titulo="Trilha de Auditoria"
        porque="A trilha vem do servidor em páginas de cem, da mais recente, então a coluna não ordena: reordenar só a página mentiria sobre o resto. A ação gravada é um verbo estável que vira frase na tela; verbo sem frase aparece cru de propósito, porque denuncia gesto instrumentado sem batismo. A empresa vai ao lado do alvo, e o alvo longo trunca e abre inteiro no clique."
      >
        <TrilhaViva />
      </Bloco>

      <Bloco
        titulo="Evento Aberto"
        porque="O detalhe traz o que a linha corta: o alvo inteiro e o verbo como foi gravado, que é o que a busca procura. O Meu Perfil grava fora dos módulos, e o evento diz a origem pelo nome."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Variante nome="Consulta com empresa e alvo longo">
            <EventoEstatico evento={EVENTOS[1]} />
          </Variante>
          <Variante nome="Do Meu Perfil, sem alvo">
            <EventoEstatico evento={EVENTOS[5]} />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Setores"
        porque="O setor só agrupa cargos, então a linha diz quantos cargos tem, e o setor sem cargo leva o selo para aparecer na hora de limpar o cadastro."
      >
        <SetoresVivos />
      </Bloco>

      <Bloco
        titulo="Setor Aberto"
        porque="Só o nome, na mesma janela que exclui. Salvar só acende com mudança, e com mudança o clique fora não fecha. Excluir pede o segundo clique dizendo quantos cargos ficam sem setor, porque o banco não recusa: os cargos continuam e perdem o setor calados. Nome repetido, sem diferenciar maiúscula, volta como erro do servidor."
      >
        <div className="grid gap-5 xl:grid-cols-3">
          <Variante nome="Setor novo">
            <SetorEstatico nomeInicial="" />
          </Variante>
          <Variante nome="Setor com cargos">
            <SetorEstatico setor={SETORES[0]} />
          </Variante>
          <Variante nome="Exclusão esperando o segundo clique">
            <SetorEstatico setor={SETORES[1]} confirmandoInicial />
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
