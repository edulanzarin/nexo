"use client";

import { useState } from "react";
import { Abas, Segmentado } from "@/componentes/primitivos/abas";
import { ZonaArquivo } from "@/componentes/primitivos/arquivo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador, Caixa } from "@/componentes/primitivos/caixa";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, ComboMulti } from "@/componentes/primitivos/combo";
import { Tecla } from "@/componentes/primitivos/selo";
import { Bloco, Familia, Variante } from "../bloco";

const SITUACOES = [
  { valor: "problema", rotulo: "Com problema" },
  { valor: "pendente", rotulo: "Não contabilizadas" },
  { valor: "divergente", rotulo: "Conta errada" },
  { valor: "duplicada", rotulo: "Duplicadas" },
  { valor: "ok", rotulo: "Corretas" },
];

const FILIAIS = Array.from({ length: 12 }, (_, i) => ({
  valor: String(i + 1),
  rotulo: `Filial ${String(i + 1).padStart(2, "0")} · ${["Centro", "Porto", "Norte", "Sul", "Vila"][i % 5]}`,
  detalhe: String(i + 1),
}));

export function BlocosControles() {
  const [situacao, setSituacao] = useState<string | null>("problema");
  const [filiais, setFiliais] = useState<string[]>([]);
  const [tipo, setTipo] = useState<"ent" | "sai">("ent");
  const [aba, setAba] = useState("conferencia");
  const [marcada, setMarcada] = useState(true);
  const [ligado, setLigado] = useState(false);

  return (
    <Familia id="controles" titulo="Controles" descricao="O que a pessoa toca. Mesma altura, mesmo poço, mesmo foco.">
      <Bloco
        titulo="Botão"
        porque="O botão expõe a intenção, nunca o tamanho: a altura é o token de controle, e é isso que deixa botão, campo e seletor alinharem na mesma fila. Primário é um por tela, o laranja da marca."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Botao variante="primario" icone="executar">
            Executar
          </Botao>
          <Botao variante="secundario" icone="baixar">
            Exportar
          </Botao>
          <Botao variante="fantasma" icone="atualizar">
            Recarregar
          </Botao>
          <Botao variante="perigo" icone="apagar">
            Apagar regra
          </Botao>
          <Botao variante="primario" carregando>
            Executar
          </Botao>
          <Botao variante="secundario" disabled>
            Indisponível
          </Botao>
          <BotaoIcone icone="editar" rotulo="Editar" variante="secundario" />
          <BotaoIcone icone="opcoes" rotulo="Mais ações" />
          <span className="flex items-center gap-1 text-pequeno text-apagado">
            <Tecla>Ctrl</Tecla>
            <Tecla>Enter</Tecla>
          </span>
        </div>
      </Bloco>

      <Bloco
        titulo="Campo e rótulo"
        porque="A célula reserva a linha do rótulo mesmo sem rótulo: numa fila de campos, o controle sem rótulo desalinharia dos vizinhos. Ajuda só existe se disser algo que o rótulo não diz, e vem em itálico."
      >
        <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          <Rotulado rotulo="Termo do extrato" ajuda="Maiúsculas e acento não importam.">
            <Campo placeholder="PAGTO FORNECEDOR" />
          </Rotulado>
          <Rotulado rotulo="Valor" erro="Informe um valor maior que zero.">
            <Campo placeholder="0,00" aria-invalid defaultValue="0" />
          </Rotulado>
          <Rotulado reservar>
            <Campo icone="buscar" placeholder="Buscar nota, contraparte ou CFOP" />
          </Rotulado>
          <Rotulado rotulo="Observação" className="sm:col-span-3">
            <AreaTexto placeholder="O que foi decidido e por quê" />
          </Rotulado>
        </div>
      </Bloco>

      <Bloco
        titulo="Combo e combo múltiplo"
        porque="O select nativo aberto é desenhado pelo navegador e denuncia que veio de outro lugar. A busca liga sozinha com mais de oito opções; no múltiplo, lista vazia quer dizer todas, e o botão diz isso com a palavra do domínio."
      >
        <div className="flex flex-wrap items-start gap-3">
          <Variante nome="Escolha única">
            <Combo opcoes={SITUACOES} valor={situacao} onMudar={setSituacao} className="w-56" />
          </Variante>
          <Variante nome="Múltipla, com busca">
            <ComboMulti
              opcoes={FILIAIS}
              valor={filiais}
              onMudar={setFiliais}
              rotuloTodas="Todas as filiais"
              plural="filiais"
              icone="camadas"
              className="w-60"
            />
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Segmentado e abas"
        porque="Segmentado escolhe entre poucas opções exclusivas que mudam o dado da mesma tela. Aba divide a seção em ângulos do mesmo trabalho. As duas têm marca que desliza até a escolha: mostra de onde a pessoa saiu e para onde foi."
      >
        <div className="flex flex-col gap-4">
          <Segmentado
            opcoes={[
              { valor: "ent", rotulo: "Entradas", icone: "seta-baixo" },
              { valor: "sai", rotulo: "Saídas", icone: "seta-cima" },
            ]}
            valor={tipo}
            onMudar={setTipo}
          />
          <Abas
            ativa={aba}
            onMudar={setAba}
            itens={[
              { chave: "conferencia", rotulo: "Conferência", contagem: 32 },
              { chave: "plano", rotulo: "Plano de Contabilização" },
              { chave: "historico", rotulo: "Histórico" },
            ]}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Caixa e alternador"
        porque="A caixa nativa não segue o tema e o visto dela some no escuro; esta é desenhada, com o input real por baixo para teclado e leitor de tela. Alternador é para o que vale na hora, sem botão de salvar."
      >
        <div className="flex flex-wrap items-center gap-6">
          <Caixa marcada={marcada} onMudar={setMarcada} rotulo="Só diferenças" />
          <Caixa marcada={false} indeterminada onMudar={() => {}} rotulo="Parte das notas" detalhe="12 de 40 marcadas" />
          <Caixa marcada={false} onMudar={() => {}} rotulo="Desabilitada" desabilitada />
          <Alternador ligado={ligado} onMudar={setLigado} rotulo="Incluir desligados" />
        </div>
      </Bloco>

      <Bloco
        titulo="Área de arquivo"
        porque="É a porta das telas que executam pelo arquivo (extrato, balancete em PDF): grande quando vazia, uma linha quando já há arquivo lido."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ZonaArquivo aceita=".ofx,.pdf" onArquivos={() => {}} titulo="Solte o extrato aqui" descricao="OFX ou PDF do banco" />
          <ZonaArquivo
            aceita=".ofx,.pdf"
            onArquivos={() => {}}
            compacta
            icone="nota"
            titulo="extrato-viacredi-agosto.ofx"
            descricao="148 transações lidas"
          />
        </div>
      </Bloco>
    </Familia>
  );
}
