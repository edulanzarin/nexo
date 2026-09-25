"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Dica, DicaEstatica } from "@/componentes/primitivos/dica";
import { Icone } from "@/componentes/primitivos/icone";
import { ListaMenu, Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { Par } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Bloco, Familia, Variante } from "../bloco";

const ITENS: ItemMenu[] = [
  { tipo: "titulo", rotulo: "Planilha (CSV)" },
  { rotulo: "Notas com problema", icone: "planilha", aoEscolher: () => {} },
  { rotulo: "Todas as notas", icone: "planilha", aoEscolher: () => {} },
  { tipo: "separador" },
  { rotulo: "Imprimir ou salvar em PDF", icone: "imprimir", atalho: "Ctrl P", aoEscolher: () => {} },
  { tipo: "separador" },
  { rotulo: "Apagar regra", icone: "apagar", perigo: true, aoEscolher: () => {} },
];

function CorpoNota() {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Par rotulo="Número">
          <span className="num">48.211 / 1</span>
        </Par>
        <Par rotulo="Emissão">
          <span className="num">14/08/2026</span>
        </Par>
        <Par rotulo="CFOP">
          <span className="num">1.102</span>
        </Par>
        <Par rotulo="Valor">
          <span className="num font-[600]">R$ 12.480,00</span>
        </Par>
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom="perigo" icone="alerta">
          Conta errada
        </Selo>
        <span className="text-corpo text-tinta-2">Lançada em 4.1.01.003 · o plano pede 1.1.04.001</span>
      </div>
    </div>
  );
}

export function BlocosSobreposicoes() {
  const [aberto, setAberto] = useState(false);
  return (
    <Familia
      id="sobreposicoes"
      titulo="Sobreposições"
      descricao="O que flutua. Vai por portal para o body: vidro cria contexto de empilhamento, e nenhum z-index atravessa isso."
    >
      <Bloco
        titulo="Modal"
        porque="Detalhe mora em modal, a linha da tabela fica enxuta. Teto de altura com o corpo rolando: modal que cresce empurra o botão de salvar para fora da janela. Aqui aparece aberto com a mesma peça que a tela usa, sem réplica."
      >
        <div className="flex flex-col gap-3">
          <PainelModal
            estatico
            titulo="Nota 48.211 · Magalhães Comércio Ltda"
            descricao="Entrada · empresa 1200"
            onFechar={() => {}}
            rodape={
              <>
                <Botao variante="fantasma">Fechar</Botao>
                <Botao variante="secundario" icone="copiar">
                  Copiar chave
                </Botao>
              </>
            }
          >
            <CorpoNota />
          </PainelModal>
          <div>
            <Botao onClick={() => setAberto(true)} icone="ver">
              Abrir de verdade
            </Botao>
          </div>
          <Modal
            aberto={aberto}
            onFechar={() => setAberto(false)}
            titulo="Nota 48.211 · Magalhães Comércio Ltda"
            descricao="Entrada · empresa 1200"
            rodape={<Botao onClick={() => setAberto(false)}>Fechar</Botao>}
          >
            <CorpoNota />
          </Modal>
        </div>
      </Bloco>

      <Bloco
        titulo="Menu"
        porque="Um botão com as ações que não cabem na linha. Navega por seta, fecha ao escolher, e a ação que apaga vem por último, em vermelho."
      >
        <div className="flex flex-wrap items-start gap-6">
          <Variante nome="Aberto">
            <div className="nx-flutua w-64 rounded-painel">
              <ListaMenu itens={ITENS} fechar={() => {}} autoFoco={false} />
            </div>
          </Variante>
          <Variante nome="No botão">
            <Menu
              itens={ITENS}
              gatilho={(p) => (
                <Botao {...p} icone="opcoes">
                  Ações
                </Botao>
              )}
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Dica"
        porque="Só para o que o rótulo não diz: o ícone sem texto, a regra por trás de um número. Nunca guarda o que a pessoa precisa, porque no toque ela não aparece."
      >
        <div className="flex flex-wrap items-center gap-8">
          <DicaEstatica>Média de dias entre a competência do fato e o registro no Questor.</DicaEstatica>
          <Dica texto="Média de dias entre a competência e o registro.">
            <span className="flex items-center gap-1 text-corpo text-tinta-2">
              Atraso médio <Icone nome="info" tamanho={14} className="text-apagado" />
            </span>
          </Dica>
        </div>
      </Bloco>

      <Bloco
        titulo="Aviso"
        porque="Recado curto no canto, com o mesmo verbo do botão que o disparou (Salvar vira Regra salva). Erro de carregamento não vai aqui: torrada some, e a tela vazia sem motivo fica. Esse vai no PainelErro, no lugar do conteúdo."
      >
        <div className="flex flex-wrap gap-2">
          <Botao onClick={() => avisar.ok("Regra salva", "PAGTO MAGALHAES cai em 2.1.01.004")}>Aviso de sucesso</Botao>
          <Botao onClick={() => avisar.erro("Não deu para salvar", "A conta não existe no plano desta empresa.")}>Aviso de erro</Botao>
        </div>
      </Bloco>
    </Familia>
  );
}
