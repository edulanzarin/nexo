"use client";

import { useState } from "react";
import { AvisoPublico, CascaPublica } from "@/componentes/casca/casca-publica";
import { Botao } from "@/componentes/primitivos/botao";
import { CamposFormulario } from "@/componentes/produto/rh/campos-formulario";
import {
  SeletorEmpresaRh,
  SeloEmpresaRh,
  empresasDoFiltroRh,
  type FiltroEmpresaRh,
} from "@/componentes/produto/rh/empresa-rh";
import { LinkPublico } from "@/componentes/produto/rh/link-publico";
import { SeloStatusDenuncia } from "@/componentes/produto/rh/status-denuncia";
import { STATUS_DENUNCIA } from "@/lib/denuncia-tipos";
import {
  validarRespostas,
  type FormularioCampo,
  type RespostaValores,
  type ValorCampo,
} from "@/lib/formularios-tipos";
import { Bloco, Variante } from "../bloco";

/*
 * Peças que as telas do RH dividem: as perguntas de um formulário (editor,
 * página pública e leitura de resposta), a empresa do RH, o endereço de um
 * canal aberto, a situação da denúncia e a moldura das páginas sem conta.
 */

export const CAMPOS_FALSOS: FormularioCampo[] = [
  {
    id: 1,
    ordem: 1,
    tipo: "nota",
    rotulo: "Como você avalia a adaptação dele à equipe?",
    ajuda: null,
    obrigatorio: true,
    config: { escala: ["Ruim", "Regular", "Boa", "Muito boa", "Excelente"] },
  },
  {
    id: 2,
    ordem: 2,
    tipo: "selecao_unica",
    rotulo: "Recomendação",
    ajuda: "O que o RH faz com o contrato ao fim da experiência.",
    obrigatorio: true,
    config: { opcoes: ["Efetivar", "Prorrogar", "Desligar"], papel: "decisao" },
  },
  {
    id: 3,
    ordem: 3,
    tipo: "selecao_multipla",
    rotulo: "Pontos fortes",
    ajuda: null,
    obrigatorio: false,
    config: { opcoes: ["Pontualidade", "Organização", "Comunicação", "Iniciativa"] },
  },
  {
    id: 4,
    ordem: 4,
    tipo: "pontuacao",
    rotulo: "Nota geral",
    ajuda: null,
    obrigatorio: false,
    config: { min: 0, max: 10 },
  },
  {
    id: 5,
    ordem: 5,
    tipo: "texto_longo",
    rotulo: "Comentários",
    ajuda: null,
    obrigatorio: false,
    config: {},
  },
];

const RESPONDIDO: RespostaValores = {
  "1": 3,
  "2": "Efetivar",
  "3": ["Pontualidade", "Comunicação"],
  "4": 9,
  "5": "Pegou o fechamento de outubro sozinho na segunda semana. Pode assumir a carteira da Juliana.",
};

function FormularioVivo() {
  const [valores, setValores] = useState<RespostaValores>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const mudar = (id: number, v: ValorCampo) => {
    setValores((s) => ({ ...s, [String(id)]: v }));
    setErros((e) => {
      const resto = { ...e };
      delete resto[id];
      return resto;
    });
  };
  return (
    <div className="flex flex-col gap-5">
      <CamposFormulario campos={CAMPOS_FALSOS} valores={valores} onMudar={mudar} erros={erros} />
      <div className="flex gap-2">
        <Botao icone="enviar" onClick={() => setErros(validarRespostas(CAMPOS_FALSOS, valores))}>
          Enviar
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => {
            setValores({});
            setErros({});
          }}
        >
          Limpar
        </Botao>
      </div>
    </div>
  );
}

function SeletorVivo() {
  const [f, setF] = useState<FiltroEmpresaRh>("todas");
  return (
    <div className="flex flex-col gap-3">
      <Variante nome="Com as pessoas de cada empresa">
        <SeletorEmpresaRh valor={f} onMudar={setF} contagens={{ 1: 58, 888: 14, 746: 3 }} />
      </Variante>
      <Variante nome="Só os nomes">
        <SeletorEmpresaRh valor={f} onMudar={setF} />
      </Variante>
      <p className="text-pequeno text-apagado">
        Pede à API: <span className="num text-tinta-2">empresas={empresasDoFiltroRh(f).join(",")}</span>
      </p>
    </div>
  );
}

export function BlocosRhBase() {
  return (
    <>
      <Bloco
        titulo="Perguntas do formulário"
        porque="Uma peça só desenha a prévia do editor, a página de quem responde e a leitura de uma resposta. Se cada tela tivesse a sua, a prévia deixaria de mostrar o que a pessoa recebe. Na leitura, texto vira parágrafo e a escolha fica marcada sem esmaecer, porque ali o trabalho é ler."
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Variante nome="Para responder (aperte Enviar vazio para ver os erros)" className="nx-vidro rounded-painel p-4">
            <FormularioVivo />
          </Variante>
          <Variante nome="Resposta guardada" className="nx-vidro rounded-painel p-4">
            <CamposFormulario campos={CAMPOS_FALSOS} valores={RESPONDIDO} somenteLeitura />
          </Variante>
        </div>
        <Variante nome="Resposta sem nada preenchido" className="nx-vidro rounded-painel p-4">
          <CamposFormulario campos={CAMPOS_FALSOS.slice(2, 5)} valores={{}} somenteLeitura />
        </Variante>
      </Bloco>

      <Bloco
        titulo="Empresa do RH"
        porque="O RH só lê as três empresas da Navecon, e o seletor do topo lista a carteira da sessão, onde a Navecon costuma nem estar. Por isso a escolha mora na tela. O selo da empresa não tem cor: as três são a mesma casa, e cor de selo no NaveX quer dizer situação."
      >
        <SeletorVivo />
        <Variante nome="Selo na linha da pessoa">
          <div className="flex gap-2">
            <SeloEmpresaRh codigo={1} />
            <SeloEmpresaRh codigo={888} />
            <SeloEmpresaRh codigo={746} />
          </div>
        </Variante>
      </Bloco>

      <Bloco
        titulo="Endereço de um canal aberto"
        porque="O RH copia e divulga o link da denúncia e da avaliação de clima. O endereço aparece inteiro, e não só um botão de copiar, porque quem vai pôr num cartaz precisa ler o que está copiando."
      >
        <div className="max-w-xl">
          <LinkPublico caminho="/denuncia" />
        </div>
      </Bloco>

      <Bloco
        titulo="Situação da denúncia"
        porque="Recebida pede alguém abrir, em análise está com o RH, concluída e arquivada saíram da fila. A mesma cor vale na fila do RH e na página de quem denunciou."
        palco
      >
        <div className="flex flex-wrap gap-2">
          {STATUS_DENUNCIA.map((s) => (
            <SeloStatusDenuncia key={s} status={s} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Moldura das páginas abertas"
        porque="Quem abre o formulário por link, a denúncia ou a avaliação não tem conta e quase sempre está no celular. Uma coluna estreita, sem barra lateral nem contexto, e a marca só para dizer de onde é. O aviso diz o que houve e o que fazer quando não há nada para preencher."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Variante nome="Link que não abre" className="overflow-hidden rounded-painel border border-dashed border-linha-forte">
            <CascaPublica embutida>
              <AvisoPublico
                titulo="Link inválido"
                texto="Este link não existe, expirou ou o formulário foi removido. Fale com o RH da Navecon."
              />
            </CascaPublica>
          </Variante>
          <Variante nome="Envio concluído" className="overflow-hidden rounded-painel border border-dashed border-linha-forte">
            <CascaPublica embutida>
              <AvisoPublico tom="ok" titulo="Resposta enviada" texto="Obrigado. O RH já recebeu a sua avaliação." />
            </CascaPublica>
          </Variante>
        </div>
      </Bloco>
    </>
  );
}
