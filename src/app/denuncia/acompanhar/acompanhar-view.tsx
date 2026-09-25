"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao } from "@/componentes/primitivos/botao";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Nota } from "@/componentes/primitivos/estados";
import { ConversaDenuncia } from "@/componentes/produto/rh/denuncia-conversa";
import { denunciaAberta } from "@/componentes/produto/rh/denuncia-fila";
import { SeloStatusDenuncia } from "@/componentes/produto/rh/status-denuncia";
import { CATEGORIA_DENUNCIA_ROTULO, type DenunciaPublica, type StatusDenuncia } from "@/lib/denuncia-tipos";
import { dataHoraBR } from "@/lib/format";
import { mutar } from "@/hooks/mutar";

/**
 * Protocolo e senha são gerados só com maiúsculas e números. Digitados no
 * celular costumam vir em minúscula; a senha é conferida letra a letra contra o
 * hash, então sobe tudo para maiúscula antes de mandar.
 */
const normalizar = (v: string) => v.trim().toUpperCase();

interface Credencial {
  protocolo: string;
  senha: string;
}

export function AcompanharView({ protocoloInicial }: { protocoloInicial: string }) {
  const id = useId();
  const [protocolo, setProtocolo] = useState(protocoloInicial);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [aberta, setAberta] = useState<{ cred: Credencial; dados: DenunciaPublica } | null>(null);

  async function consultar() {
    setErro(null);
    const cred = { protocolo: normalizar(protocolo), senha: normalizar(senha) };
    if (!cred.protocolo || !cred.senha) return setErro("Preencha o protocolo e a senha.");
    setConsultando(true);
    try {
      const dados = await mutar<DenunciaPublica>("/api/denuncia/consultar", "POST", cred);
      setAberta({ cred, dados });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setConsultando(false);
    }
  }

  if (aberta)
    return (
      <Acompanhamento
        cred={aberta.cred}
        dados={aberta.dados}
        onDados={(dados) => setAberta({ cred: aberta.cred, dados })}
        onSair={() => {
          // Sai sem deixar a senha na tela: o aparelho pode ser de outra pessoa.
          setSenha("");
          setAberta(null);
        }}
      />
    );

  return (
    <section className="nx-vidro flex flex-col rounded-painel">
      <header className="flex flex-col gap-1.5 border-b border-linha px-5 py-5 sm:px-6">
        <h1 className="nx-titulo text-titulo text-tinta">Acompanhar Denúncia</h1>
        <p className="text-corpo text-tinta-2">Use o protocolo e a senha que você recebeu ao enviar.</p>
      </header>

      <form
        noValidate
        className="flex flex-col gap-4 px-5 py-5 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          consultar();
        }}
      >
        <Rotulado rotulo="Protocolo" htmlFor={`${id}-protocolo`}>
          <Campo
            id={`${id}-protocolo`}
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            placeholder="DEN-2026-XXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Rotulado>
        <Rotulado rotulo="Senha" htmlFor={`${id}-senha`}>
          <Campo
            id={`${id}-senha`}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Rotulado>
        {erro && (
          <Nota tom="perigo" icone="erro">
            {erro}
          </Nota>
        )}
        <Botao type="submit" variante="primario" carregando={consultando} className="w-full sm:w-auto sm:self-end">
          Ver denúncia
        </Botao>
      </form>

      <footer className="border-t border-linha px-5 py-3.5 text-corpo text-apagado sm:px-6">
        Quer contar outra coisa?{" "}
        <Link href="/denuncia" className="font-[560] text-rota hover:underline">
          Fazer uma denúncia nova
        </Link>
      </footer>
    </section>
  );
}

const ENCERRADA: Partial<Record<StatusDenuncia, string>> = {
  concluida: "O RH concluiu esta denúncia. Não dá mais para mandar mensagem.",
  arquivada: "O RH arquivou esta denúncia. Não dá mais para mandar mensagem.",
};

function Acompanhamento({
  cred,
  dados,
  onDados,
  onSair,
}: {
  cred: Credencial;
  dados: DenunciaPublica;
  onDados: (d: DenunciaPublica) => void;
  onSair: () => void;
}) {
  const id = useId();
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aberta = denunciaAberta(dados.status);

  async function recarregar() {
    setAtualizando(true);
    try {
      onDados(await mutar<DenunciaPublica>("/api/denuncia/consultar", "POST", cred));
    } catch (e) {
      avisar.erro("Não deu para atualizar", (e as Error).message);
    } finally {
      setAtualizando(false);
    }
  }

  async function enviar() {
    setErro(null);
    if (!mensagem.trim()) return setErro("Escreva a mensagem.");
    setEnviando(true);
    try {
      await mutar("/api/denuncia/mensagem", "POST", { ...cred, corpo: mensagem });
      setMensagem("");
      avisar.ok("Mensagem enviada");
      await recarregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const botoes = (
    <div className="flex gap-1">
      <Botao variante="fantasma" icone="atualizar" carregando={atualizando} onClick={recarregar}>
        Atualizar
      </Botao>
      <Botao variante="fantasma" icone="sair" onClick={onSair}>
        Sair
      </Botao>
    </div>
  );

  return (
    <section className="nx-vidro flex flex-col rounded-painel">
      <header className="flex flex-col gap-1 border-b border-linha px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="num nx-titulo text-titulo text-tinta">{dados.protocolo}</h1>
          <SeloStatusDenuncia status={dados.status} />
        </div>
        <p className="text-corpo text-apagado">
          {CATEGORIA_DENUNCIA_ROTULO[dados.categoria]} · enviada em{" "}
          <span className="num">{dataHoraBR(dados.criadoEm)}</span>
        </p>
      </header>

      <div className="px-5 py-5 sm:px-6">
        <ConversaDenuncia lado="denunciante" relato={dados.relato} mensagens={dados.mensagens} />
      </div>

      <footer className="flex flex-col gap-3 border-t border-linha px-5 py-4 sm:px-6">
        {aberta ? (
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <Rotulado rotulo="Nova mensagem" htmlFor={`${id}-mensagem`}>
              <AreaTexto
                id={`${id}-mensagem`}
                rows={3}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Mande uma informação nova ou responda ao RH"
              />
            </Rotulado>
            {erro && (
              <Nota tom="perigo" icone="erro">
                {erro}
              </Nota>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {botoes}
              <Botao type="submit" variante="primario" icone="enviar" carregando={enviando}>
                Enviar mensagem
              </Botao>
            </div>
          </form>
        ) : (
          <>
            <Nota icone="ok">{ENCERRADA[dados.status]}</Nota>
            {botoes}
          </>
        )}
      </footer>
    </section>
  );
}
