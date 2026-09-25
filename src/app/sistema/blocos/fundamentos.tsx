"use client";

import { useMemo, useState } from "react";
import { MarcaNavex, AssinaturaNavex } from "@/componentes/casca/marca";
import { IconeModulo } from "@/componentes/casca/modulo";
import { Campo } from "@/componentes/primitivos/campo";
import { Icone, ICONES } from "@/componentes/primitivos/icone";
import { normalizar } from "@/componentes/primitivos/combo";
import { MODULOS } from "@/lib/modulos";
import { Bloco, Familia, Variante } from "../bloco";

const SUPERFICIES = ["fundo", "vidro", "vidro-forte", "poco", "poco-forte", "linha", "linha-forte"];
const TEXTO = ["tinta", "tinta-2", "apagado"];
const PAPEIS = ["acento-solido", "acento", "rota", "ok", "atencao", "perigo"];
const SERIES = ["serie-1", "serie-2", "serie-3", "serie-4", "serie-5", "serie-6", "serie-outras"];

function Amostra({ token }: { token: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="size-9 shrink-0 rounded-controle border border-linha-forte"
        style={{ background: `var(--${token})` }}
      />
      <code className="truncate text-pequeno text-tinta-2">--{token}</code>
    </div>
  );
}

function GaleriaIcones() {
  const [busca, setBusca] = useState("");
  const nomes = useMemo(() => {
    const t = normalizar(busca.trim());
    return Object.keys(ICONES).filter((n) => !t || normalizar(n).includes(t));
  }, [busca]);
  return (
    <div className="nx-vidro flex flex-col gap-3 rounded-painel p-4">
      <Campo icone="buscar" placeholder="Buscar ícone pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} classeCaixa="max-w-72" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1">
        {nomes.map((n) => (
          <div key={n} className="flex flex-col items-center gap-1.5 rounded-controle px-1 py-2.5 text-center hover:bg-poco">
            <Icone nome={n} tamanho={18} className="text-tinta-2" />
            <span className="w-full truncate text-micro text-apagado">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlocosFundamentos() {
  return (
    <Familia id="fundamentos" titulo="Fundamentos" descricao="Cor, tipo, raio, marca e ícones. Tudo sai de token.">
      <Bloco
        titulo="Marca"
        porque="O monograma NX que o Eduardo desenhou, redesenhado em vetor a partir da geometria do original: fica nítido da guia do navegador ao login e ganha um tom mais claro no tema noite, onde o azul original sumiria. No login as três peças entram uma depois da outra."
        palco
      >
        <div className="flex flex-wrap items-center gap-10">
          <MarcaNavex tamanho={72} entrada />
          <AssinaturaNavex />
          <MarcaNavex tamanho={10} />
        </div>
      </Bloco>

      <Bloco
        titulo="Superfícies e texto"
        porque="Hierarquia por superfície: o painel se separa do fundo pela opacidade do vidro e pela sombra; dentro dele, o que separa é fio, não outra caixa."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[...SUPERFICIES, ...TEXTO].map((t) => (
            <Amostra key={t} token={t} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Papéis de cor"
        porque="O laranja da marca é só da ação (Executar, primário, marcador de ativo). O azul é foco, seleção e informação. Estado tem três cores e nunca aparece sem palavra ou ícone."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PAPEIS.map((t) => (
            <Amostra key={t} token={t} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Cor de dado"
        porque="Séries de gráfico têm paleta própria, separada do acento: retematizar a interface não pode repintar os gráficos. A série recebe a cor do catálogo dela, não a posição."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SERIES.map((t) => (
            <Amostra key={t} token={t} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Identidade dos módulos"
        porque="Cada módulo é o cubo com a sigla e a cor dele, os mesmos do nexo2: é a identidade que o time já reconhece de relance, e os ícones desenhados para o NaveX ficaram genéricos ao lado dela. O cubo vai sem moldura nem fundo, porque já traz a cor, e a cor dele só aparece nele: nunca pinta cabeçalho nem estado. Os PNGs têm fundo transparente e servem os dois temas; na barra lateral ficam com 28 px e continuam legíveis."
      >
        <div className="flex flex-wrap gap-5">
          {MODULOS.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <IconeModulo modulo={m} tamanho={40} />
              <span className="text-corpo text-tinta-2">{m.titulo}</span>
            </div>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Tipo"
        porque="Instrument Sans com eixo de largura. O corpo da interface é 13px, porque a leitura acontece em coluna de tabela. O número de indicador estreita para 82%: cabe mais dígito na célula sem perder corpo."
      >
        <div className="nx-vidro flex flex-col gap-4 rounded-painel p-5">
          <Variante nome="Título de página · 20px">
            <p className="nx-titulo text-titulo text-tinta">Conferência fiscal</p>
          </Variante>
          <Variante nome="Leitura de indicador · 26px, largura 82%">
            <p className="nx-leitura text-leitura text-tinta">R$ 1.284.930,55 · 3.412</p>
          </Variante>
          <Variante nome="Médio · 14px">
            <p className="text-medio text-tinta">Notas não contabilizadas na competência</p>
          </Variante>
          <Variante nome="Corpo · 13px">
            <p className="text-corpo text-tinta-2">Lançamentos por pessoa, origem, empresa, dia e hora</p>
          </Variante>
          <Variante nome="Pequeno · 12px">
            <p className="text-pequeno text-apagado">Atualizado há 3 minutos</p>
          </Variante>
          <Variante nome="Números tabulares">
            <div className="num flex flex-col items-end text-corpo text-tinta">
              <span>1.111,11</span>
              <span>88.888,88</span>
              <span>4.070,00</span>
            </div>
          </Variante>
        </div>
      </Bloco>

      <Bloco
        titulo="Raio por hierarquia"
        porque="A peça maior curva mais: selo 6, controle 8, painel 14, sobreposição 16. Um raio só em tudo é o que faz a tela parecer kit."
      >
        <div className="flex flex-wrap items-end gap-6">
          {[
            ["chip", "rounded-chip", "h-6 w-16"],
            ["controle", "rounded-controle", "h-8 w-28"],
            ["painel", "rounded-painel", "h-20 w-40"],
            ["flutua", "rounded-flutua", "h-24 w-48"],
          ].map(([n, r, t]) => (
            <Variante key={n} nome={n}>
              <div className={`${r} ${t} nx-vidro`} />
            </Variante>
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Ícones por nome"
        porque="Seção, módulo e menu vêm de catálogo em dado, então o ícone se escolhe por texto: <Icone nome=&quot;conferencia&quot; />. O nome diz o que o ícone significa aqui; trocar o desenho é uma linha."
      >
        <GaleriaIcones />
      </Bloco>
    </Familia>
  );
}
