import { BotaoLink } from "@/componentes/primitivos/botao";
import { Girando, Vazio } from "@/componentes/primitivos/estados";
import { Icone } from "@/componentes/primitivos/icone";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { dataHoraBR, num } from "@/lib/format";
import type { SincronizacaoInfo } from "@/lib/obrigacoes-tipos";

/*
 * O "de quando" da fila. Ela é um retrato materializado pela varredura diária
 * do Acessórias (uma chamada por empresa, cerca de 45 minutos), então todo
 * número da tela tem data, e a data vem antes dos números: quem lê "12
 * vencidas" precisa saber se é de hoje de manhã ou da semana passada.
 */

/** Caminho da seção que dispara a varredura. */
export const CAMINHO_CONFIG_OBRIGACOES = "/obrigacoes/configuracoes";

/**
 * A linha do retrato: quando terminou a última varredura, quantas empresas ela
 * leu, se há outra rodando agora e se alguma empresa falhou (fila incompleta).
 */
export function RetratoFila({ sync }: { sync: SincronizacaoInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-pequeno text-apagado">
      <span className="inline-flex items-center gap-1.5">
        <Icone nome="historico" tamanho={14} />
        Retrato de <span className="num font-[560] text-tinta-2">{dataHoraBR(sync.concluidoEm)}</span>
      </span>
      <span className="num">
        {num(sync.empresas)} {sync.empresas === 1 ? "empresa varrida" : "empresas varridas"}
      </span>
      {sync.rodando && (
        <Selo tom="rota" icone="carregando" title="A tela se atualiza a cada 30 segundos enquanto ela roda">
          Varredura rodando agora
        </Selo>
      )}
      {sync.falhas > 0 && (
        <Selo tom="atencao" icone="alerta" title="As entregas dessas empresas podem faltar na fila">
          Fila incompleta: {num(sync.falhas)} {sync.falhas === 1 ? "empresa falhou" : "empresas falharam"}
        </Selo>
      )}
    </div>
  );
}

/**
 * A fila que nunca foi carregada. Sem este estado a tela mostraria zeros, e
 * zero entregas lê como "o escritório está em dia" quando o certo é "ninguém
 * perguntou ainda". O link para a Configurações só aparece a quem alcança a
 * seção: botão que leva a um 403 é pior que nenhum.
 */
export function FilaNaoCarregada({ rodando, podeConfigurar }: { rodando: boolean; podeConfigurar: boolean }) {
  const disparo = podeConfigurar
    ? "A varredura roda todo dia às 5h. Para carregar agora, dispare-a na seção Configurações do Obrigações."
    : "A varredura roda todo dia às 5h. Quem alcança a seção Configurações do Obrigações pode dispará-la agora.";
  return (
    <Painel corpo="p-0">
      <Vazio
        icone={rodando ? "relogio" : "historico"}
        titulo={rodando ? "A primeira varredura está rodando" : "A fila ainda não foi carregada do Acessórias"}
        descricao={
          rodando
            ? "Ela leva cerca de 45 minutos e a tela se atualiza sozinha quando terminar. Enquanto isso, consulte uma empresa no painel abaixo."
            : `${disparo} Enquanto isso, consulte uma empresa no painel abaixo.`
        }
        acao={
          rodando || podeConfigurar ? (
            <>
              {rodando && (
                <span className="inline-flex h-controle items-center gap-1.5 text-pequeno text-apagado">
                  <Girando rotulo="Varredura rodando" />
                  Varrendo a carteira
                </span>
              )}
              {podeConfigurar && (
                <BotaoLink href={CAMINHO_CONFIG_OBRIGACOES} iconeFim="seta-direita">
                  {rodando ? "Ver o andamento" : "Ir para Configurações"}
                </BotaoLink>
              )}
            </>
          ) : undefined
        }
      />
    </Painel>
  );
}
