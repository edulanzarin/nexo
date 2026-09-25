"use client";

import { useState } from "react";
import { Segmentado } from "@/componentes/primitivos/abas";
import { Botao } from "@/componentes/primitivos/botao";
import { EsqueletoTabela, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { PainelModal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { EsqueletoFicha } from "@/componentes/produto/pessoal/ficha-funcionario";
import { NovoPjEstatico } from "@/componentes/produto/rh/diretorio-novo-pj";
import { TabelaDiretorio } from "@/componentes/produto/rh/diretorio-tabela";
import {
  CorpoFichaPj,
  CorpoFichaRh,
  descricaoFichaRh,
  errosPessoaRh,
  FORM_PESSOA_VAZIO,
  formDaFicha,
  FormPessoaRh,
  SeloOrigemRh,
  type ErrosPessoaRh,
  type DadosPessoaRh,
} from "@/componentes/produto/rh/ficha-edicao-rh";
import {
  montarSetores,
  NovoSetorEstatico,
  SetorEstatico,
  TabelaSetores,
  type SetorGestores,
} from "@/componentes/produto/rh/gestores-setor";
import { PJ_CONTRATO_OFFSET } from "@/lib/rh";
import type { FuncionarioDiretorio, GestorRh, SetorRh } from "@/lib/rh-tipos";
import type { FolhaFicha } from "@/lib/types";
import { Bloco, Variante } from "../bloco";

/*
 * Peças das telas de pessoas do RH (Diretório e Gestores): a tabela do
 * diretório, a ficha com a edição do RH, o cadastro de PJ, os setores com os
 * gestores, o setor aberto e o setor novo. Tudo com dado de mentira.
 */

type Estado = "dado" | "carregando" | "vazio" | "erro";

const ESTADOS: { valor: Estado; rotulo: string }[] = [
  { valor: "dado", rotulo: "Com dado" },
  { valor: "carregando", rotulo: "Carregando" },
  { valor: "vazio", rotulo: "Vazio" },
  { valor: "erro", rotulo: "Erro" },
];

const pessoa = (
  codigoempresa: number,
  contrato: number,
  nome: string,
  cargo: string | null,
  setor: string | null,
  classiforgan: string | null,
  dataadm: string,
  email: string | null,
  extra: Partial<FuncionarioDiretorio> = {}
): FuncionarioDiretorio => ({
  codigoempresa,
  contrato,
  nome,
  cargo,
  setor,
  classiforgan,
  dataadm,
  email,
  origem: "questor",
  editado: false,
  ...extra,
});

const DIRETORIO: FuncionarioDiretorio[] = [
  pessoa(1, 212, "ALINE CRISTINA WEBER", "ANALISTA CONTABIL", "Contábil", "002", "2019-04-01", "aline.weber@navecon.com.br", {
    editado: true,
  }),
  pessoa(1, 318, "BRUNO HENRIQUE ZIMMERMANN", "ASSISTENTE FISCAL", "Fiscal", "004", "2024-02-19", null),
  pessoa(888, 57, "CAMILA SCHMITT", "ANALISTA DE DEPARTAMENTO PESSOAL", "Pessoal", "003", "2021-08-09", "camila.schmitt@navecon.com.br"),
  pessoa(1, 402, "DIEGO MORETTI", "COORDENADOR CONTABIL", "Contábil", "002", "2015-01-12", "diego.moretti@navecon.com.br"),
  pessoa(746, 9, "ELAINE KOWALSKI", "AUXILIAR ADMINISTRATIVO", null, null, "2026-07-01", null),
  pessoa(1, PJ_CONTRATO_OFFSET + 3, "FERNANDO LUIZ BACK", "CONSULTOR TRIBUTARIO", "Prestadores PJ", "APP01", "2026-08-11", "fernando@backconsultoria.com.br", {
    origem: "pj",
  }),
  pessoa(888, 61, "GABRIELA NUNES DA ROSA", "ESTAGIARIA", "Societário", "005", "2026-03-02", null),
];

const FICHA: FolhaFicha = {
  contrato: 212,
  nome: "ALINE CRISTINA WEBER",
  cpf: "04512378910",
  dataadm: "2019-04-01",
  datadem: null,
  tempoCasaDias: null,
  cargo: "ANALISTA CONTABIL",
  funcao: null,
  setor: "Contábil",
  classiforgan: "002",
  estabelecimento: "MATRIZ",
  categoria: "01",
  tipoVinculo: "10",
  sexo: "Feminino",
  nascimento: "1993-06-14",
  idade: 33,
  escolaridade: "Superior completo",
  salario: 5480,
  tipoSalario: "Mensal",
  motivoDesligamento: null,
  cidade: "JARAGUA DO SUL",
  uf: "SC",
  email: "aline.weber@navecon.com.br",
};

const FICHA_PJ: FolhaFicha = {
  contrato: PJ_CONTRATO_OFFSET + 3,
  nome: "FERNANDO LUIZ BACK",
  cpf: "31245678000190",
  dataadm: "2026-08-11",
  datadem: null,
  tempoCasaDias: 45,
  cargo: "CONSULTOR TRIBUTARIO",
  funcao: null,
  setor: "Prestadores PJ",
  classiforgan: "APP01",
  estabelecimento: null,
  categoria: "PJ",
  tipoVinculo: "PJ",
  sexo: "—",
  nascimento: null,
  idade: null,
  escolaridade: null,
  salario: 7200,
  tipoSalario: null,
  motivoDesligamento: null,
  cidade: "BLUMENAU",
  uf: "SC",
  email: "fernando@backconsultoria.com.br",
  temExperiencia: true,
};

const SETORES: SetorRh[] = [
  { classiforgan: "002", nome: "Contábil", ativos: 24, origem: "questor" },
  { classiforgan: "004", nome: "Fiscal", ativos: 18, origem: "questor" },
  { classiforgan: "003", nome: "Pessoal", ativos: 11, origem: "questor" },
  { classiforgan: "005", nome: "Societário", ativos: 4, origem: "questor" },
  { classiforgan: "APP01", nome: "Prestadores PJ", ativos: 3, origem: "app" },
  { classiforgan: "APP02", nome: "Projetos Especiais", ativos: 0, origem: "app" },
];

const GESTORES: GestorRh[] = [
  { id: 1, classiforgan: "002", nome: "Diego Moretti", email: "diego.moretti@navecon.com.br", papel: "coordenador", ativo: true },
  { id: 2, classiforgan: "002", nome: "Aline Weber", email: "aline.weber@navecon.com.br", papel: "supervisor", ativo: true },
  { id: 3, classiforgan: "003", nome: "Camila Schmitt", email: "camila.schmitt@navecon.com.br", papel: "supervisor", ativo: true },
  { id: 4, classiforgan: "007", nome: "Rogério Tomelin", email: "rogerio.tomelin@navecon.com.br", papel: "outro", ativo: true },
];

const SETORES_GESTORES = montarSetores(SETORES, GESTORES, null);
const SETORES_SEM_NINGUEM = montarSetores(SETORES, [], null);
const setor = (classiforgan: string): SetorGestores =>
  SETORES_GESTORES.find((s) => s.setor.classiforgan === classiforgan)!;

const SEM_ACAO = () => {};

function TabelaDiretorioViva() {
  const [estado, setEstado] = useState<Estado>("dado");
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado opcoes={ESTADOS} valor={estado} onMudar={setEstado} rotulo="Estado da tabela" />
      </div>
      <Painel corpo="p-0" titulo="Colaboradores" descricao="7 pessoas">
        {estado === "carregando" ? (
          <EsqueletoTabela colunas={6} linhas={5} />
        ) : estado === "erro" ? (
          <div className="p-4">
            <PainelErro
              titulo="Não deu para carregar o diretório"
              mensagem="A consulta ao Questor passou de 60 segundos."
              onTentar={() => setEstado("dado")}
            />
          </div>
        ) : (
          <TabelaDiretorio
            linhas={estado === "vazio" ? [] : DIRETORIO}
            onAbrir={(f) => setAberta(`${f.codigoempresa}:${f.contrato}`)}
            selecionada={(f) => `${f.codigoempresa}:${f.contrato}` === aberta}
            alturaMax="24rem"
            vazio={
              <Vazio
                compacto
                icone="buscar"
                titulo="Ninguém com esse termo"
                descricao="Busque pelo nome, pelo cargo, pelo setor ou pelo e-mail."
                acao={<Botao onClick={() => setEstado("dado")}>Limpar busca</Botao>}
              />
            }
          />
        )}
      </Painel>
    </div>
  );
}

/** A correção viva: digite um e-mail torto e aperte Salvar para ver o erro. */
function EdicaoViva() {
  const base = formDaFicha(FICHA);
  const [form, setForm] = useState<DadosPessoaRh>(base);
  const [erros, setErros] = useState<ErrosPessoaRh>({});
  return (
    <PainelModal
      estatico
      titulo={FICHA.nome}
      descricao={descricaoFichaRh(1, FICHA.contrato, FICHA.cargo)}
      onFechar={SEM_ACAO}
      rodape={
        <>
          <Botao variante="fantasma" icone="desfazer" className="mr-auto">
            Desfazer correções
          </Botao>
          <Botao
            variante="fantasma"
            onClick={() => {
              setForm(base);
              setErros({});
            }}
          >
            Cancelar
          </Botao>
          <Botao variante="primario" icone="salvar" onClick={() => setErros(errosPessoaRh(form))}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormPessoaRh
          valores={form}
          onMudar={(p) => setForm((f) => ({ ...f, ...p }))}
          setores={SETORES}
          ehPj={false}
          erros={erros}
        />
        <Nota>A correção vale no NaveX e não muda o Questor. Campo apagado volta ao valor do Questor.</Nota>
      </div>
    </PainelModal>
  );
}

function TabelaSetoresViva() {
  const [estado, setEstado] = useState<"dado" | "nenhum" | "carregando" | "erro">("dado");
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Segmentado
          opcoes={[
            { valor: "dado", rotulo: "Com gestores" },
            { valor: "nenhum", rotulo: "Nenhum gestor ainda" },
            { valor: "carregando", rotulo: "Carregando" },
            { valor: "erro", rotulo: "Erro" },
          ]}
          valor={estado}
          onMudar={setEstado}
          rotulo="Estado dos setores"
        />
      </div>
      {estado === "erro" ? (
        <PainelErro
          titulo="Não deu para carregar os setores e os gestores"
          mensagem="Erro 500 no servidor"
          onTentar={() => setEstado("dado")}
        />
      ) : (
        <Painel corpo="p-0" titulo="Setores" descricao="Os sem gestor primeiro, depois os maiores">
          {estado === "carregando" ? (
            <EsqueletoTabela colunas={4} linhas={5} />
          ) : (
            <TabelaSetores
              itens={estado === "nenhum" ? SETORES_SEM_NINGUEM : SETORES_GESTORES}
              onAbrir={(s) => setAberto(s.setor.classiforgan)}
              selecionado={aberto}
              alturaMax="24rem"
            />
          )}
        </Painel>
      )}
    </div>
  );
}

export function BlocosRhPessoas() {
  return (
    <>
      <Bloco
        titulo="Tabela do diretório"
        porque="Uma linha por pessoa das três empresas, com o sinal de origem ao lado do nome: PJ é cadastro do RH, e corrigido é gente do Questor com correção do RH por cima. O e-mail em falta aparece escrito, porque sem ele a pessoa fica fora do envio direto. A coluna da empresa sai quando a tela já recortou uma."
      >
        <div className="flex flex-col gap-4">
          <TabelaDiretorioViva />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Variante nome="Uma empresa escolhida: sem a coluna da empresa">
              <Painel corpo="p-0">
                <TabelaDiretorio linhas={DIRETORIO.filter((f) => f.codigoempresa === 1)} comEmpresa={false} alturaMax="16rem" />
              </Painel>
            </Variante>
            <Variante nome="Sinal de origem">
              <div className="flex items-center gap-2">
                <SeloOrigemRh pj />
                <SeloOrigemRh pj={false} editado />
              </div>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Ficha do RH"
        porque="É a ficha do DP com o que só o RH tem em cima: o e-mail, que o Questor não guarda, e a origem. O PJ tem ficha própria, porque sexo, vínculo e desligamento são do Questor e no PJ viravam uma fila de traços. O cabeçalho sai da linha clicada e aparece antes do dado chegar."
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Variante nome="Do Questor, corrigida no RH">
            <PainelModal
              estatico
              titulo={FICHA.nome}
              descricao={descricaoFichaRh(1, FICHA.contrato, FICHA.cargo)}
              onFechar={SEM_ACAO}
              rodape={
                <>
                  <Botao variante="fantasma">Fechar</Botao>
                  <Botao icone="editar">Editar</Botao>
                </>
              }
            >
              <CorpoFichaRh ficha={FICHA} editado />
            </PainelModal>
          </Variante>
          <div className="flex flex-col gap-4">
            <Variante nome="PJ">
              <PainelModal
                estatico
                titulo={FICHA_PJ.nome}
                descricao={descricaoFichaRh(1, FICHA_PJ.contrato, FICHA_PJ.cargo)}
                onFechar={SEM_ACAO}
                rodape={
                  <>
                    <Botao variante="fantasma">Fechar</Botao>
                    <Botao icone="editar">Editar</Botao>
                  </>
                }
              >
                <CorpoFichaPj ficha={FICHA_PJ} />
              </PainelModal>
            </Variante>
            <Variante nome="Carregando">
              <PainelModal estatico titulo="BRUNO HENRIQUE ZIMMERMANN" descricao={descricaoFichaRh(1, 318, "ASSISTENTE FISCAL")} onFechar={SEM_ACAO}>
                <EsqueletoFicha />
              </PainelModal>
            </Variante>
            <Variante nome="Erro">
              <PainelModal estatico titulo="BRUNO HENRIQUE ZIMMERMANN" descricao={descricaoFichaRh(1, 318, "ASSISTENTE FISCAL")} onFechar={SEM_ACAO}>
                <PainelErro titulo="Não deu para abrir a ficha" mensagem="Colaborador não encontrado" onTentar={SEM_ACAO} />
              </PainelModal>
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Edição da ficha"
        porque="Editar troca o corpo da ficha pelo formulário, na mesma janela. Só o que mudou vai ao servidor, senão a pessoa ficaria marcada como corrigida sem ter mudado nada. O e-mail é conferido na tela porque a correção grava qualquer texto, e e-mail torto só aparece quando o formulário não chega. Desfazer e remover pedem um segundo clique."
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Variante nome="Correção de quem veio do Questor (Salvar confere os campos)">
            <EdicaoViva />
          </Variante>
          <Variante nome="PJ, com a remoção esperando o segundo clique">
            <PainelModal
              estatico
              titulo={FICHA_PJ.nome}
              descricao={descricaoFichaRh(1, FICHA_PJ.contrato, FICHA_PJ.cargo)}
              onFechar={SEM_ACAO}
              rodape={
                <>
                  <Botao variante="perigo" icone="apagar" className="mr-auto">
                    Confirmar remoção
                  </Botao>
                  <Botao variante="fantasma">Cancelar</Botao>
                  <Botao variante="primario" icone="salvar">
                    Salvar
                  </Botao>
                </>
              }
            >
              <FormPessoaRh valores={formDaFicha(FICHA_PJ)} onMudar={SEM_ACAO} setores={SETORES} ehPj />
            </PainelModal>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Adicionar pessoa PJ"
        porque="O cadastro pede o básico e a empresa; nascimento, remuneração e cidade se completam depois pela ficha, que é a mesma edição. Marcar experiência exige o início: sem data, o PJ some da tela de Experiência sem aviso. A janela não fecha no clique fora, porque o que foi digitado se perderia."
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Variante nome="Em branco">
            <NovoPjEstatico setores={SETORES} />
          </Variante>
          <Variante nome="Salvar com experiência e sem início">
            <NovoPjEstatico
              setores={SETORES}
              empresa={888}
              valores={{
                ...FORM_PESSOA_VAZIO,
                nome: "Helena Brandt",
                cargo: "Designer",
                classiforgan: "APP01",
                email: "helena@brandt",
                temExperiencia: true,
              }}
              erros={errosPessoaRh({
                ...FORM_PESSOA_VAZIO,
                nome: "Helena Brandt",
                email: "helena@brandt",
                temExperiencia: true,
              })}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Setores e gestores"
        porque="Setor com gente e sem gestor vem primeiro, com o selo e o botão de adicionar na própria linha: as avaliações das pessoas dele são geradas e não chegam a ninguém. A contagem de pessoas é a do Diretório, que já vê quem o RH trocou de setor. Gestor de setor que saiu do Questor continua na lista, marcado como inativo, para poder ser tirado."
      >
        <TabelaSetoresViva />
      </Bloco>

      <Bloco
        titulo="Setor aberto"
        porque="Cada gesto grava na hora (adicionar, editar, remover, renomear), sem Salvar geral para perder. Editar e remover acontecem na própria linha, e remover pede confirmação. Setor próprio só sai vazio, porque a rota apaga o setor e deixaria pessoa e gestor presos a um código sem nome."
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Variante nome="Com gestores, um em edição">
            <SetorEstatico item={setor("002")} editandoInicial={2} />
          </Variante>
          <div className="flex flex-col gap-4">
            <Variante nome="Sem gestor">
              <SetorEstatico item={setor("004")} />
            </Variante>
            <Variante nome="Remoção de gestor esperando confirmação">
              <SetorEstatico item={setor("003")} confirmandoInicial={3} />
            </Variante>
            <Variante nome="Setor próprio vazio, na remoção">
              <SetorEstatico item={setor("APP02")} removendoSetorInicial />
            </Variante>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Novo setor"
        porque="Setor próprio existe só no NaveX, para quem não tem setor no Questor, como os PJ. Criado, a tela abre o setor em seguida para cadastrar o gestor."
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Variante nome="Em branco">
            <NovoSetorEstatico />
          </Variante>
          <Variante nome="Com o nome">
            <NovoSetorEstatico nome="Projetos Especiais" />
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
