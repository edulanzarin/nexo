"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { mutar } from "@/hooks/mutar";
import { CamposFormulario } from "@/components/formulario-campos";
import { validarRespostas, type RespostaValores, type ValorCampo } from "@/lib/formularios-tipos";
import type { RodadaPublica } from "@/lib/clima-tipos";

export function ClimaForm({ rodada }: { rodada: RodadaPublica }) {
  const chave = `clima:${rodada.slug}`;
  const [valores, setValores] = useState<RespostaValores>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [ignorar, setIgnorar] = useState(false);

  // Soft-guard: este dispositivo já respondeu esta rodada? (só client, sem quebrar
  // a hidratação). Link aberto não impede de verdade — é só um aviso amigável.
  const respondeuAntes = useSyncExternalStore(
    () => () => {},
    () => !!window.localStorage.getItem(chave),
    () => false
  );

  const mudar = (campoId: number, valor: ValorCampo) =>
    setValores((s) => ({ ...s, [String(campoId)]: valor }));

  const enviar = async () => {
    setErroGeral(null);
    const es = validarRespostas(rodada.campos, valores);
    setErros(es);
    if (Object.keys(es).length) return setErroGeral("Revise as respostas destacadas antes de enviar.");

    setEnviando(true);
    try {
      await mutar(`/api/clima/${rodada.slug}`, "POST", { valores });
      try {
        window.localStorage.setItem(chave, "1");
      } catch {
        /* localStorage indisponível — sem soft-guard, só o obrigado */
      }
      setPronto(true);
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Falha ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    return (
      <Card padding="none" animate="none" className="px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto size-10 text-good" />
        <h1 className="mt-3 text-lg font-semibold text-ink">Avaliação enviada</h1>
        <p className="mt-1 text-sm text-muted">Obrigado! Sua resposta é anônima e já foi registrada.</p>
      </Card>
    );
  }

  if (respondeuAntes && !ignorar) {
    return (
      <Card padding="none" animate="none" className="px-6 py-10 text-center">
        <h1 className="text-lg font-semibold text-ink">Você já respondeu</h1>
        <p className="mt-1 text-sm text-muted">
          Este dispositivo já enviou uma avaliação nesta rodada. Se quiser responder de novo, clique
          abaixo.
        </p>
        <Button variant="secondary" onClick={() => setIgnorar(true)} className="mt-4">
          Responder novamente
        </Button>
      </Card>
    );
  }

  return (
    <Card overflow padding="none" animate="none">
      <header className="border-b border-hairline px-6 py-5">
        <h1 className="text-lg font-semibold text-ink">{rodada.titulo}</h1>
        {rodada.descricao && <p className="mt-1 text-sm text-muted">{rodada.descricao}</p>}
      </header>

      <div className="space-y-6 px-6 py-6">
        {rodada.campos.length === 0 ? (
          <p className="text-sm text-muted">Este formulário ainda não tem perguntas.</p>
        ) : (
          <CamposFormulario campos={rodada.campos} valores={valores} onChange={mudar} erros={erros} />
        )}

        {erroGeral && <p className="text-sm text-critical">{erroGeral}</p>}

        <Button
          variant="primary"
          size="lg"
          onClick={enviar}
          loading={enviando}
          disabled={enviando || rodada.campos.length === 0}
          className="w-full"
        >
          {enviando ? "Enviando…" : "Enviar avaliação"}
        </Button>
      </div>
    </Card>
  );
}
