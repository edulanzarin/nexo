"use client";

import { useState } from "react";
import { Botao } from "@/componentes/primitivos/botao";
import { Flutuante } from "@/componentes/primitivos/flutuante";
import { Icone } from "@/componentes/primitivos/icone";
import { CASCA_CONTROLE } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { cn } from "@/lib/cn";
import {
  ABREV_MESES,
  atalhosDia,
  atalhosMes,
  fimDoMes,
  mesesEntre,
  nomeMes,
  rotuloPeriodo,
  somarMeses,
  ultimoMesFechado,
} from "@/lib/contexto";

function GatilhoPeriodo({ texto, ...p }: { texto: string } & React.ComponentProps<"button">) {
  return (
    <button
      {...p}
      type="button"
      className="flex h-controle min-w-0 items-center gap-2 rounded-controle border border-linha bg-poco px-2.5 text-corpo text-tinta transition-colors hover:border-linha-forte hover:bg-poco-forte"
    >
      <Icone nome="intervalo" tamanho={15} className="text-apagado" />
      <span className="num truncate font-[560]">{texto}</span>
      <Icone nome="abre-fecha" tamanho={14} className="text-apagado" />
    </button>
  );
}

function Atalhos({
  lista,
  inicio,
  fim,
  onEscolher,
}: {
  lista: { nome: string; inicio: string; fim: string }[];
  inicio: string;
  fim: string;
  onEscolher: (i: string, f: string) => void;
}) {
  return (
    <div className="flex flex-col p-1">
      {lista.map((a) => {
        const sel = a.inicio === inicio && a.fim === fim;
        return (
          <button
            key={a.nome}
            type="button"
            onClick={() => onEscolher(a.inicio, a.fim)}
            className={cn(
              "flex h-8 items-center justify-between gap-3 rounded-controle px-2.5 text-left text-corpo",
              sel ? "bg-poco-forte text-tinta" : "text-tinta-2 hover:bg-poco"
            )}
          >
            {a.nome}
            {sel && <Icone nome="certo" tamanho={15} className="text-rota" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Período por dia: atalhos e um intervalo livre, com teto de um ano (a
 * varredura de um ano inteiro do escritório já passa de um minuto).
 */
export function SeletorPeriodoDia({
  inicio,
  fim,
  onMudar,
}: {
  inicio: string;
  fim: string;
  onMudar: (inicio: string, fim: string) => void;
}) {
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <Flutuante
      larguraMin={300}
      onAberto={(a) => {
        if (a) {
          setDe(inicio);
          setAte(fim);
          setAviso(null);
        }
      }}
      gatilho={(p) => <GatilhoPeriodo {...p} texto={rotuloPeriodo(inicio, fim, "dia")} />}
    >
      {(fechar) => (
        <div className="flex flex-col">
          <Atalhos
            lista={atalhosDia()}
            inicio={inicio}
            fim={fim}
            onEscolher={(i, f) => {
              onMudar(i, f);
              fechar();
            }}
          />
          <form
            className="flex flex-col gap-2 border-t border-linha p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!de || !ate) return;
              let a = de <= ate ? de : ate;
              const b = de <= ate ? ate : de;
              const umAnoAntes = new Date(b);
              umAnoAntes.setFullYear(umAnoAntes.getFullYear() - 1);
              const minimo = umAnoAntes.toISOString().slice(0, 10);
              if (a < minimo) {
                a = minimo;
                setAviso("O intervalo vai até um ano. O início foi recuado.");
              }
              onMudar(a, b);
              fechar();
            }}
          >
            <p className="text-pequeno text-apagado">Intervalo</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={CASCA_CONTROLE} aria-label="De" />
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={CASCA_CONTROLE} aria-label="Até" />
            </div>
            {aviso && <Nota tom="atencao">{aviso}</Nota>}
            <Botao type="submit" variante="secundario" className="w-full">
              Usar este intervalo
            </Botao>
          </form>
        </div>
      )}
    </Flutuante>
  );
}

/**
 * Período por mês (balancete). Um clique escolhe o mês; um segundo clique no
 * mesmo ano estende até ele. O mês corrente não é escolhível: está aberto, e
 * balancete de mês pela metade parece queda.
 */
export function SeletorPeriodoMes({
  inicio,
  fim,
  onMudar,
}: {
  inicio: string;
  fim: string;
  onMudar: (inicio: string, fim: string) => void;
}) {
  const teto = ultimoMesFechado();
  const mi = inicio.slice(0, 7);
  const mf = fim.slice(0, 7);
  const [ano, setAno] = useState(Number(mf.slice(0, 4)));
  const [ancora, setAncora] = useState<string | null>(null);

  const escolher = (ym: string, fechar: () => void) => {
    if (ancora && ancora !== ym) {
      let a = ancora < ym ? ancora : ym;
      const b = ancora < ym ? ym : ancora;
      if (mesesEntre(a, b) > 12) a = somarMeses(b, -11);
      onMudar(`${a}-01`, fimDoMes(b));
      setAncora(null);
      fechar();
    } else {
      onMudar(`${ym}-01`, fimDoMes(ym));
      setAncora(ym);
    }
  };

  return (
    <Flutuante
      larguraMin={320}
      onAberto={(a) => {
        if (a) {
          setAno(Number(mf.slice(0, 4)));
          setAncora(null);
        }
      }}
      gatilho={(p) => <GatilhoPeriodo {...p} texto={rotuloPeriodo(inicio, fim, "mes")} />}
    >
      {(fechar) => (
        <div className="flex flex-col">
          <Atalhos
            lista={atalhosMes()}
            inicio={inicio}
            fim={fim}
            onEscolher={(i, f) => {
              onMudar(i, f);
              fechar();
            }}
          />
          <div className="border-t border-linha p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Ano anterior"
                onClick={() => setAno((a) => a - 1)}
                className="grid size-7 place-items-center rounded-controle text-apagado hover:bg-poco hover:text-tinta"
              >
                <Icone nome="chevron-esquerda" tamanho={15} />
              </button>
              <span className="num text-corpo font-[600] text-tinta">{ano}</span>
              <button
                type="button"
                aria-label="Próximo ano"
                disabled={ano >= Number(teto.slice(0, 4))}
                onClick={() => setAno((a) => a + 1)}
                className="grid size-7 place-items-center rounded-controle text-apagado hover:bg-poco hover:text-tinta disabled:opacity-30"
              >
                <Icone nome="chevron-direita" tamanho={15} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {ABREV_MESES.map((nome, i) => {
                const ym = `${ano}-${String(i + 1).padStart(2, "0")}`;
                const fora = ym > teto;
                const dentro = ym >= mi && ym <= mf;
                const ponta = ym === mi || ym === mf;
                return (
                  <button
                    key={ym}
                    type="button"
                    disabled={fora}
                    onClick={() => escolher(ym, fechar)}
                    title={fora ? "Mês ainda aberto" : nomeMes(ym, true)}
                    className={cn(
                      "h-8 rounded-controle text-corpo capitalize transition-colors",
                      fora && "cursor-not-allowed text-apagado/50",
                      !fora && !dentro && "text-tinta-2 hover:bg-poco",
                      dentro && !ponta && "bg-rota-suave text-tinta",
                      ponta && "bg-rota font-[600] text-fundo"
                    )}
                  >
                    {nome}
                  </button>
                );
              })}
            </div>
            <Nota className="mt-2">
              {ancora ? "Clique em outro mês para fechar o intervalo." : "Até 12 meses. Clique no início e depois no fim."}
            </Nota>
          </div>
        </div>
      )}
    </Flutuante>
  );
}
