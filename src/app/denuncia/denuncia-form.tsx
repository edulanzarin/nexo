"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { Button, Card, IconButton } from "@/components/ui";
import { mutar } from "@/hooks/mutar";
import {
  CATEGORIAS_DENUNCIA,
  CATEGORIA_DENUNCIA_ROTULO,
  type CategoriaDenuncia,
} from "@/lib/denuncia-tipos";

const CAMPO = "h-9 w-full rounded-lg border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30";

export function DenunciaForm() {
  const [categoria, setCategoria] = useState<CategoriaDenuncia | "">("");
  const [relato, setRelato] = useState("");
  const [setor, setSetor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criada, setCriada] = useState<{ protocolo: string; senha: string } | null>(null);

  const enviar = async () => {
    setErro(null);
    if (!categoria) return setErro("Escolha o assunto da denúncia.");
    if (relato.trim().length < 20) return setErro("Descreva o ocorrido com mais detalhes.");
    setEnviando(true);
    try {
      const r = await mutar<{ protocolo: string; senha: string }>("/api/denuncia", "POST", {
        categoria,
        relato,
        setorEnvolvido: setor || null,
      });
      setCriada(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (criada) return <Recibo protocolo={criada.protocolo} senha={criada.senha} />;

  return (
    <Card overflow padding="none" animate="none">
      <header className="border-b border-hairline px-6 py-5">
        <h1 className="text-lg font-semibold text-ink">Canal de denúncia</h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good" />
          <span>
            Sua denúncia é <strong className="text-ink-2">anônima</strong>. Não pedimos seu nome e não
            registramos quem você é. Ao enviar, você recebe um protocolo e uma senha para acompanhar.
          </span>
        </p>
      </header>

      <div className="space-y-5 px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Assunto *</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaDenuncia)}
            className={CAMPO}
          >
            <option value="">Selecione…</option>
            {CATEGORIAS_DENUNCIA.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_DENUNCIA_ROTULO[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">O que aconteceu? *</span>
          <textarea
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-ink/30"
            placeholder="Descreva o ocorrido com o máximo de detalhes possível: o que houve, quando, onde e quem estava envolvido. Evite incluir dados que identifiquem você, se quiser manter o anonimato total."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Setor ou área envolvida</span>
          <input
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            className={CAMPO}
            placeholder="Opcional"
          />
        </label>

        {erro && <p className="text-sm text-critical">{erro}</p>}

        <Button variant="primary" size="lg" onClick={enviar} loading={enviando} className="w-full">
          {enviando ? "Enviando…" : "Enviar denúncia"}
        </Button>

        <p className="text-center text-xs text-muted">
          Já tem um protocolo?{" "}
          <Link href="/denuncia/acompanhar" className="font-medium text-ink-2 underline">
            Acompanhar denúncia
          </Link>
        </p>
      </div>
    </Card>
  );
}

function Recibo({ protocolo, senha }: { protocolo: string; senha: string }) {
  return (
    <Card overflow padding="none" animate="none">
      <div className="border-b border-hairline px-6 py-5 text-center">
        <Check className="mx-auto size-10 text-good" />
        <h1 className="mt-3 text-lg font-semibold text-ink">Denúncia registrada</h1>
        <p className="mt-1 text-sm text-muted">
          Guarde os dados abaixo. <strong className="text-ink-2">Eles não podem ser recuperados</strong> —
          sem eles, não é possível acompanhar a denúncia.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        <CampoCopia rotulo="Protocolo" valor={protocolo} />
        <CampoCopia rotulo="Senha" valor={senha} />
        <Button asChild variant="primary" size="lg" className="mt-2 w-full">
          <Link href={`/denuncia/acompanhar?p=${encodeURIComponent(protocolo)}`}>
            Acompanhar agora
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function CampoCopia({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível — o valor segue visível para copiar à mão */
    }
  };
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink-2">{rotulo}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm font-semibold tracking-wide text-ink">
          {valor}
        </code>
        <IconButton
          tone="bordered"
          onClick={copiar}
          aria-label={`Copiar ${rotulo.toLowerCase()}`}
        >
          {copiado ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}
        </IconButton>
      </div>
    </div>
  );
}
