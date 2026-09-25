"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoLink } from "@/componentes/primitivos/botao";
import { Campo, Rotulado } from "@/componentes/primitivos/campo";
import { Combo, type Opcao } from "@/componentes/primitivos/combo";
import { Esqueleto, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { Modal, PainelModal } from "@/componentes/primitivos/modal";
import { num } from "@/lib/format";
import type { FormularioResumo } from "@/lib/formularios-tipos";
import { MARCOS, rotuloMarco, type Marco } from "@/lib/rh-experiencia";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";

/*
 * Qual formulário sai em cada marco da experiência e com quantos dias de
 * antecedência. Marco sem formulário não sai para ninguém: nem o envio
 * automático nem o manual da tela.
 *
 * Os formulários vêm da própria rota da configuração, e não do cadastro
 * compartilhado de Formulários: quem cuida da Experiência pode não ter a seção
 * Formulários, e a rota de lá responderia 403. Esta já devolve só os ativos.
 */

/** Um marco ligado a um formulário. Mesmo formato de `ConfigMarcoLinha`, do lado servidor. */
export interface ConfigMarcoExperiencia {
  marco: Marco;
  formularioId: number;
  diasAntes: number;
}

/** O que `/api/rh/experiencia-config` devolve. */
export interface ConfigExperiencia {
  config: ConfigMarcoExperiencia[];
  formularios: FormularioResumo[];
}

export const CHAVE_CONFIG_EXPERIENCIA = "rh-experiencia-config";
export const URL_CONFIG_EXPERIENCIA = "/api/rh/experiencia-config";

/** A antecedência que a lib usa quando o marco é ligado sem dizer outra. */
const DIAS_PADRAO = 7;

const TITULO = "Configuração da Experiência";
const DESCRICAO = "Qual formulário sai em cada marco e com quantos dias de antecedência.";

/** Uma gravação por marco: cada um tem o seu Salvar, e mexer no de 90 não arrasta o de 45. */
export type SalvarMarco = (marco: Marco, formularioId: number | null, diasAntes: number) => Promise<boolean>;

export function ModalConfigExperiencia({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  // Monta a cada abertura: a lista de formulários chega fresca.
  if (!aberto) return null;
  return <JanelaConfig onFechar={onFechar} />;
}

function JanelaConfig({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const res = useConsulta<ConfigExperiencia>(CHAVE_CONFIG_EXPERIENCIA, URL_CONFIG_EXPERIENCIA);

  const salvar: SalvarMarco = async (marco, formularioId, diasAntes) => {
    try {
      await mutar(URL_CONFIG_EXPERIENCIA, "PUT", { marco, formularioId, diasAntes });
      await qc.invalidateQueries({ queryKey: [CHAVE_CONFIG_EXPERIENCIA] });
      const nome = res.data?.formularios.find((f) => f.id === formularioId)?.nome;
      avisar.ok(
        `Marco de ${rotuloMarco(marco)} salvo`,
        formularioId == null ? "Nenhum formulário sai neste marco." : nome
      );
      return true;
    } catch (e) {
      avisar.erro("Não deu para salvar o marco", (e as Error).message);
      return false;
    }
  };

  return (
    <Modal
      aberto
      titulo={TITULO}
      descricao={DESCRICAO}
      onFechar={onFechar}
      largura="m"
      fecharNoVeu={false}
      rodape={<Botao onClick={onFechar}>Fechar</Botao>}
    >
      <CorpoConfigExperiencia
        dados={res.data}
        erro={res.error ? (res.error as Error).message : null}
        onTentar={() => res.refetch()}
        onSalvar={salvar}
      />
    </Modal>
  );
}

/** A mesma janela parada, para o catálogo, com o dado de quem chama. */
export function ConfigExperienciaEstatica({ dados, erro }: { dados: ConfigExperiencia | undefined; erro?: string }) {
  return (
    <PainelModal estatico titulo={TITULO} descricao={DESCRICAO} onFechar={() => {}} rodape={<Botao>Fechar</Botao>}>
      <CorpoConfigExperiencia dados={dados} erro={erro ?? null} onSalvar={async () => true} />
    </PainelModal>
  );
}

function CorpoConfigExperiencia({
  dados,
  erro,
  onTentar,
  onSalvar,
}: {
  dados: ConfigExperiencia | undefined;
  erro: string | null;
  onTentar?: () => void;
  onSalvar: SalvarMarco;
}) {
  if (erro) return <PainelErro titulo="Não deu para carregar a configuração" mensagem={erro} onTentar={onTentar} />;
  if (!dados)
    return (
      <div aria-busy className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MARCOS.map((m) => (
          <div key={m} className="flex flex-col gap-3 rounded-controle border border-linha p-3">
            <Esqueleto className="h-4 w-32" />
            <Esqueleto className="h-controle w-full" />
            <Esqueleto className="h-controle w-32" />
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {dados.formularios.length === 0 && (
        <div className="rounded-controle border border-linha">
          <Vazio
            compacto
            icone="relatorio"
            titulo="Nenhum formulário ativo"
            descricao="Monte o formulário da experiência e ative, para ligar a um marco aqui."
            acao={
              <BotaoLink href="/rh/formularios" iconeFim="seta-direita">
                Ir para Formulários
              </BotaoLink>
            }
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MARCOS.map((m) => {
          const atual = dados.config.find((c) => c.marco === m) ?? null;
          return (
            <FormMarco
              // A chave refaz o rascunho quando a gravação volta do servidor.
              key={`${m}:${atual?.formularioId ?? "-"}:${atual?.diasAntes ?? "-"}`}
              marco={m}
              atual={atual}
              formularios={dados.formularios}
              onSalvar={onSalvar}
            />
          );
        })}
      </div>
      <Nota>Vencido sem resposta, o formulário volta para os gestores uma vez por dia até alguém responder.</Nota>
    </div>
  );
}

/** Inteiro dentro da faixa, ou null. O campo guarda texto para aceitar o vazio enquanto se digita. */
function inteiroEntre(texto: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n >= min && n <= max ? n : null;
}

function FormMarco({
  marco,
  atual,
  formularios,
  onSalvar,
}: {
  marco: Marco;
  atual: ConfigMarcoExperiencia | null;
  formularios: FormularioResumo[];
  onSalvar: SalvarMarco;
}) {
  const id = useId();
  const [formulario, setFormulario] = useState(atual ? String(atual.formularioId) : "");
  const [dias, setDias] = useState(String(atual?.diasAntes ?? DIAS_PADRAO));
  const [salvando, setSalvando] = useState(false);

  const ligado = formulario !== "";
  const diasOk = inteiroEntre(dias, 0, 60);
  const mudou = ligado
    ? Number(formulario) !== atual?.formularioId || diasOk !== atual?.diasAntes
    : atual != null;

  const opcoes: Opcao[] = [
    { valor: "", rotulo: "Não enviar" },
    ...formularios.map((f) => ({
      valor: String(f.id),
      rotulo: f.nome,
      detalhe: `${num(f.campos)} ${f.campos === 1 ? "pergunta" : "perguntas"}`,
      // O envio recusa formulário sem pergunta: nem deixa escolher.
      desabilitado: f.campos === 0,
    })),
  ];
  // O formulário ligado pode ter sido arquivado depois: ele segue saindo, então aparece.
  if (atual && !formularios.some((f) => f.id === atual.formularioId))
    opcoes.push({ valor: String(atual.formularioId), rotulo: "Formulário que não está mais ativo" });

  return (
    <form
      className="flex flex-col gap-3 rounded-controle border border-linha p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (ligado && diasOk == null) return;
        setSalvando(true);
        await onSalvar(marco, ligado ? Number(formulario) : null, diasOk ?? DIAS_PADRAO);
        setSalvando(false);
      }}
    >
      <h3 className="text-medio font-[600] text-tinta">Marco de {num(marco)} Dias</h3>
      <Rotulado rotulo="Formulário">
        <Combo
          opcoes={opcoes}
          valor={formulario}
          onMudar={setFormulario}
          rotuloAcessivel={`Formulário do marco de ${rotuloMarco(marco)}`}
          larguraMin={260}
        />
      </Rotulado>
      <Rotulado
        rotulo="Antecedência"
        htmlFor={`${id}-dias`}
        erro={ligado && diasOk == null ? "De 0 a 60 dias." : undefined}
        ajuda={ligado ? "Dias antes do vencimento em que o formulário sai." : undefined}
      >
        <Campo
          id={`${id}-dias`}
          inputMode="numeric"
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          disabled={!ligado}
          aria-invalid={ligado && diasOk == null}
          fim={<span className="pr-2 text-pequeno text-apagado">dias</span>}
          classeCaixa="w-36"
        />
      </Rotulado>
      <div>
        <Botao
          type="submit"
          icone="salvar"
          carregando={salvando}
          disabled={!mudou || (ligado && diasOk == null)}
        >
          Salvar marco
        </Botao>
      </div>
    </form>
  );
}
