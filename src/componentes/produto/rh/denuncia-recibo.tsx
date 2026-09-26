"use client";

import { useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone, BotaoLink } from "@/componentes/primitivos/botao";
import { Icone } from "@/componentes/primitivos/icone";
import { copiarTexto } from "@/lib/copiar";

type Copiado = "protocolo" | "senha" | "ambos" | null;

/**
 * O recibo de quem acabou de denunciar. É a única vez que a senha aparece
 * legível (o banco guarda só o hash), e sem ela a denúncia não se acompanha
 * mais. Por isso protocolo e senha ficam grandes, inteiros (quebram, nunca
 * cortam) e com copiar. O botão de acompanhar leva só o protocolo na URL: a
 * senha no endereço ficaria no histórico do navegador, e digitá-la de novo
 * confirma que a pessoa anotou.
 */
export function ReciboDenuncia({
  protocolo,
  senha,
  hrefAcompanhar = `/denuncia/acompanhar?p=${encodeURIComponent(protocolo)}`,
}: {
  protocolo: string;
  senha: string;
  hrefAcompanhar?: string;
}) {
  const [copiado, setCopiado] = useState<Copiado>(null);

  const copiar = async (qual: Exclude<Copiado, null>, texto: string) => {
    if (await copiarTexto(texto)) {
      setCopiado(qual);
      setTimeout(() => setCopiado((c) => (c === qual ? null : c)), 1600);
    } else avisar.erro("Não deu para copiar", "Selecione o texto e copie à mão.");
  };

  return (
    <section className="nx-vidro flex flex-col gap-5 rounded-painel px-5 py-6 sm:px-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-ok-suave text-ok">
          <Icone nome="ok" tamanho={20} />
        </span>
        <h1 className="nx-titulo text-titulo text-tinta">Denúncia enviada</h1>
        <p className="max-w-md text-corpo text-tinta-2">
          Anote o protocolo e a senha agora. Sem eles não dá para acompanhar, e nem o RH consegue recuperar.
        </p>
      </header>

      <dl className="flex flex-col gap-3">
        <ValorCopiavel
          rotulo="Protocolo"
          valor={protocolo}
          copiado={copiado === "protocolo"}
          onCopiar={() => copiar("protocolo", protocolo)}
        />
        <ValorCopiavel
          rotulo="Senha"
          valor={senha}
          copiado={copiado === "senha"}
          onCopiar={() => copiar("senha", senha)}
        />
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Botao
          icone={copiado === "ambos" ? "certo" : "copiar"}
          onClick={() => copiar("ambos", `Protocolo: ${protocolo}\nSenha: ${senha}`)}
        >
          {copiado === "ambos" ? "Copiados" : "Copiar os dois"}
        </Botao>
        <BotaoLink variante="primario" href={hrefAcompanhar} iconeFim="seta-direita">
          Acompanhar a denúncia
        </BotaoLink>
      </div>
    </section>
  );
}

function ValorCopiavel({
  rotulo,
  valor,
  copiado,
  onCopiar,
}: {
  rotulo: string;
  valor: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-pequeno font-[560] text-tinta-2">{rotulo}</dt>
      <dd className="flex items-center gap-1.5">
        <span className="num min-w-0 flex-1 rounded-controle border border-linha-forte bg-poco px-3 py-2 text-titulo font-[620] tracking-[0.06em] break-all text-tinta select-all">
          {valor}
        </span>
        <BotaoIcone
          icone={copiado ? "certo" : "copiar"}
          rotulo={copiado ? "Copiado" : `Copiar ${rotulo.toLowerCase()}`}
          variante="secundario"
          onClick={onCopiar}
        />
      </dd>
    </div>
  );
}
