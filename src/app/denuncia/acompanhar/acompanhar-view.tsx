"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { mutar } from "@/hooks/mutar";
import { dataHoraBR } from "@/lib/format";
import { StatusDenunciaBadge } from "@/components/denuncia-status";
import { CATEGORIA_DENUNCIA_ROTULO, type DenunciaPublica } from "@/lib/denuncia-tipos";

const CAMPO = "h-9 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

export function AcompanharView() {
  const p0 = useSearchParams().get("p") ?? "";
  const [protocolo, setProtocolo] = useState(p0);
  const [senha, setSenha] = useState("");
  const [dados, setDados] = useState<DenunciaPublica | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const consultar = async () => {
    setErro(null);
    if (!protocolo.trim() || !senha.trim()) return setErro("Informe o protocolo e a senha.");
    setCarregando(true);
    try {
      const d = await mutar<DenunciaPublica>("/api/denuncia/consultar", "POST", { protocolo, senha });
      setDados(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar.");
    } finally {
      setCarregando(false);
    }
  };

  const recarregar = async () => {
    try {
      const d = await mutar<DenunciaPublica>("/api/denuncia/consultar", "POST", { protocolo, senha });
      setDados(d);
    } catch {
      /* mantém o que já está na tela */
    }
  };

  if (dados) return <Detalhe dados={dados} protocolo={protocolo} senha={senha} onAtualizar={recarregar} />;

  return (
    <Card overflow padding="none" animate="none">
      <header className="border-b border-hairline px-6 py-5">
        <h1 className="text-lg font-semibold text-ink">Acompanhar denúncia</h1>
        <p className="mt-1 text-sm text-muted">
          Digite o protocolo e a senha que você recebeu ao enviar a denúncia.
        </p>
      </header>
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Protocolo</span>
          <input
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            className={CAMPO}
            placeholder="DEN-2026-XXXXXX"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Senha</span>
          <input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={CAMPO}
            placeholder="XXXX-XXXX-XXXX"
          />
        </label>

        {erro && <p className="text-sm text-critical">{erro}</p>}

        <Button variant="primary" size="lg" onClick={consultar} loading={carregando} className="w-full">
          {carregando ? "Consultando…" : "Ver denúncia"}
        </Button>

        <p className="text-center text-xs text-muted">
          Quer registrar uma nova?{" "}
          <Link href="/denuncia" className="font-medium text-ink-2 underline">
            Fazer denúncia
          </Link>
        </p>
      </div>
    </Card>
  );
}

function Detalhe({
  dados,
  protocolo,
  senha,
  onAtualizar,
}: {
  dados: DenunciaPublica;
  protocolo: string;
  senha: string;
  onAtualizar: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const encerrada = dados.status === "concluida" || dados.status === "arquivada";

  const enviar = async () => {
    setErro(null);
    if (!msg.trim()) return;
    setEnviando(true);
    try {
      await mutar("/api/denuncia/mensagem", "POST", { protocolo, senha, corpo: msg });
      setMsg("");
      onAtualizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar a mensagem.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card overflow padding="none" animate="none">
      <header className="border-b border-hairline px-6 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-mono text-sm font-semibold text-ink">{dados.protocolo}</h1>
          <StatusDenunciaBadge status={dados.status} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {CATEGORIA_DENUNCIA_ROTULO[dados.categoria]} · registrada em {dataHoraBR(dados.criadoEm)}
        </p>
      </header>

      <div className="space-y-5 px-6 py-5">
        <section>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Seu relato</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-2">{dados.relato}</p>
        </section>

        {dados.mensagens.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Conversa</h2>
            {dados.mensagens.map((m, i) => (
              <Balao key={i} mensagem={m} />
            ))}
          </section>
        )}

        {encerrada ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-muted">
            Esta denúncia foi encerrada. Obrigado por usar o canal.
          </p>
        ) : (
          <section className="space-y-2">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
              placeholder="Adicionar informação ou responder ao RH…"
            />
            {erro && <p className="text-sm text-critical">{erro}</p>}
            <Button variant="primary" onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar
            </Button>
          </section>
        )}
      </div>
    </Card>
  );
}

function Balao({ mensagem }: { mensagem: DenunciaPublica["mensagens"][number] }) {
  const doRh = mensagem.autor === "rh";
  return (
    <div className={doRh ? "flex justify-start" : "flex justify-end"}>
      <div
        className={
          doRh
            ? "max-w-[85%] rounded-lg rounded-tl-sm bg-surface-2 px-3 py-2"
            : "max-w-[85%] rounded-lg rounded-tr-sm bg-ink px-3 py-2 text-surface"
        }
      >
        <p className="mb-0.5 text-[11px] font-medium opacity-70">
          {doRh ? mensagem.autorNome || "RH" : "Você"} · {dataHoraBR(mensagem.criadoEm)}
        </p>
        <p className="whitespace-pre-wrap text-sm">{mensagem.corpo}</p>
      </div>
    </div>
  );
}
