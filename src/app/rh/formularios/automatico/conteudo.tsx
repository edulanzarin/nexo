"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { Selo } from "@/componentes/primitivos/selo";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import {
  CHAVE_REGRAS,
  ModalRegraEnvio,
  ROTULO_QUEM_RESPONDE,
  entradaDaRegra,
  textoFrequencia,
  textoPublico,
} from "@/componentes/produto/rh/regra-envio";
import { dataBR, num } from "@/lib/format";
import type { EnvioRegra } from "@/lib/envio-regras";
import { mutar } from "@/hooks/mutar";
import { useConsulta } from "@/hooks/use-consulta";
import { useFormulariosRh, useRhSetores } from "@/hooks/use-rh";

/**
 * Envios que se repetem sozinhos. Cada regra liga um formulário a um público
 * e a uma frequência; no dia, o servidor resolve o público e cria um envio
 * comum, que aparece na aba Envios.
 */
export default function Conteudo() {
  const qc = useQueryClient();
  const res = useConsulta<EnvioRegra[]>(CHAVE_REGRAS, "/api/rh/envio-regras");
  const forms = useFormulariosRh();
  const setores = useRhSetores();
  const d = res.data;
  const [editando, setEditando] = useState<EnvioRegra | "nova" | null>(null);
  const [removendo, setRemovendo] = useState<EnvioRegra | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const nomesSetor = useMemo(() => new Map((setores.data ?? []).map((s) => [s.classiforgan, s.nome])), [setores.data]);
  // Regra ativa com formulário fora de uso não envia nada: o servidor recusa e só registra no log.
  const formInativo = useMemo(() => {
    const situacao = new Map((forms.data ?? []).map((f) => [f.id, f.status]));
    return (r: EnvioRegra) => forms.data != null && situacao.get(r.formularioId) !== "ativo";
  }, [forms.data]);

  const resumo = useMemo(() => {
    const ativas = (d ?? []).filter((r) => r.ativo);
    const proxima = [...ativas].sort((a, b) => a.proximoDisparo.localeCompare(b.proximoDisparo))[0] ?? null;
    return {
      ativas: ativas.length,
      pausadas: (d ?? []).length - ativas.length,
      proxima,
      paradas: ativas.filter(formInativo).length,
    };
  }, [d, formInativo]);

  const invalidar = () => qc.invalidateQueries({ queryKey: [CHAVE_REGRAS] });

  async function alternar(r: EnvioRegra, ativo: boolean) {
    setOcupado(r.id);
    try {
      // O PUT pede a regra inteira; ligar e desligar mandam a mesma com `ativo` trocado.
      await mutar(`/api/rh/envio-regras?id=${r.id}`, "PUT", entradaDaRegra(r, { ativo }));
      await invalidar();
      avisar.ok(ativo ? "Regra ligada" : "Regra pausada", r.formularioNome);
    } catch (e) {
      avisar.erro("Não deu para mudar a regra", (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function remover(r: EnvioRegra) {
    setOcupado(r.id);
    try {
      await mutar(`/api/rh/envio-regras?id=${r.id}`, "DELETE");
      await invalidar();
      avisar.ok("Regra removida", r.formularioNome);
      setRemovendo(null);
    } catch (e) {
      avisar.erro("Não deu para remover", (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const colunas: Coluna<EnvioRegra>[] = [
    {
      id: "formulario",
      cabecalho: "Formulário",
      largura: "34%",
      ordenar: (r) => r.formularioNome,
      celula: (r) => (
        <span className="block min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-[560] text-tinta" title={r.formularioNome}>
              {r.formularioNome}
            </span>
            {r.ativo && formInativo(r) && (
              <Selo tom="atencao" icone="alerta" title="A regra não envia enquanto o formulário não estiver ativo">
                Formulário inativo
              </Selo>
            )}
          </span>
          {r.titulo && r.titulo !== r.formularioNome && (
            <span className="block truncate text-pequeno text-apagado" title={r.titulo}>
              {r.titulo}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "quem",
      cabecalho: "Quem responde",
      ordenar: (r) => r.destinatarioTipo,
      celula: (r) => ROTULO_QUEM_RESPONDE[r.destinatarioTipo],
    },
    {
      id: "publico",
      cabecalho: "Público",
      largura: "18%",
      celula: (r) => {
        const t = textoPublico(r, nomesSetor);
        return (
          <span className="block truncate" title={t}>
            {t}
          </span>
        );
      },
    },
    {
      id: "frequencia",
      cabecalho: "Frequência",
      ordenar: (r) => (r.freqTipo === "mensal" ? 30 : r.freqValor),
      celula: (r) => <span className="whitespace-nowrap">{textoFrequencia(r.freqTipo, r.freqValor)}</span>,
    },
    {
      id: "proximo",
      cabecalho: "Próximo envio",
      ordenar: (r) => (r.ativo ? r.proximoDisparo : null),
      celula: (r) => (r.ativo ? <span className="num">{dataBR(r.proximoDisparo)}</span> : <Selo>Pausada</Selo>),
    },
    {
      id: "ultimo",
      cabecalho: "Último envio",
      secundaria: true,
      ordenar: (r) => r.ultimoDisparo,
      celula: (r) =>
        r.ultimoDisparo ? <span className="num">{dataBR(r.ultimoDisparo)}</span> : <span className="text-apagado">Ainda não saiu</span>,
    },
    {
      id: "acoes",
      cabecalho: <span className="sr-only">Ações</span>,
      alinhar: "dir",
      celula: (r) => (
        // Ligar, editar e remover decidem ali mesmo: o clique não vaza para a linha, que abre a edição.
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Alternador
            ligado={r.ativo}
            desabilitado={ocupado === r.id}
            onMudar={(v) => void alternar(r, v)}
            rotulo={<span className="sr-only">{r.ativo ? "Pausar" : "Ligar"} a regra de {r.formularioNome}</span>}
          />
          <BotaoIcone icone="editar" rotulo="Editar regra" linha onClick={() => setEditando(r)} />
          <BotaoIcone icone="apagar" rotulo="Remover regra" linha onClick={() => setRemovendo(r)} className="hover:text-perigo" />
        </div>
      ),
    },
  ];

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar os envios automáticos"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="relogio"
        titulo="Nenhum envio automático"
        descricao="Uma regra manda um formulário sozinha, todo mês ou a cada tantos dias, para os gestores ou para os colaboradores."
        acao={
          <Botao variante="primario" icone="mais" onClick={() => setEditando("nova")}>
            Criar regra
          </Botao>
        }
      />
    );

  return (
    <>
      <AcoesPagina>
        <Botao variante="primario" icone="mais" onClick={() => setEditando("nova")}>
          Nova regra
        </Botao>
      </AcoesPagina>

      <FaixaIndicadores colunas={4}>
        <Indicador rotulo="Regras ativas" icone="atualizar" carregando={!d} valor={num(resumo.ativas)} detalhe="Enviam sozinhas" />
        <Indicador
          rotulo="Pausadas"
          icone="ignorado"
          carregando={!d}
          valor={num(resumo.pausadas)}
          detalhe="Guardadas sem enviar"
        />
        <Indicador
          rotulo="Próximo envio"
          icone="calendario"
          carregando={!d}
          valor={resumo.proxima ? dataBR(resumo.proxima.proximoDisparo) : "—"}
          detalhe={resumo.proxima ? resumo.proxima.formularioNome : "Nenhuma regra ativa"}
        />
        <Indicador
          rotulo="Não vão sair"
          icone="alerta"
          carregando={!d || !forms.data}
          valor={num(resumo.paradas)}
          detalhe={resumo.paradas ? "O formulário delas não está ativo" : "Todas com formulário ativo"}
          tom={resumo.paradas ? "atencao" : "neutro"}
          valorNoTom
        />
      </FaixaIndicadores>

      {d && d.length > 0 && (
        <Nota>O público é lido no dia de cada envio. Cada disparo vira um envio na aba Envios.</Nota>
      )}

      <Painel
        corpo="p-0"
        titulo="Regras de Envio"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Ativas primeiro, pela data do próximo envio
            {res.isFetching && d && <Girando />}
          </span>
        }
      >
        {!d ? (
          <EsqueletoTabela linhas={4} colunas={6} />
        ) : (
          <TabelaDados
            rotulo="Regras de envio automático"
            colunas={colunas}
            linhas={d}
            chave={(r) => String(r.id)}
            onLinha={setEditando}
            selecionada={(r) => editando !== "nova" && editando?.id === r.id}
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalRegraEnvio
        aberto={editando != null}
        regra={editando === "nova" ? null : editando}
        onFechar={() => setEditando(null)}
      />

      <Modal
        aberto={removendo != null}
        onFechar={() => {
          if (ocupado == null) setRemovendo(null);
        }}
        titulo="Remover a Regra?"
        largura="p"
        rodape={
          <>
            <Botao disabled={ocupado != null} onClick={() => setRemovendo(null)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              icone="apagar"
              carregando={removendo != null && ocupado === removendo.id}
              onClick={() => removendo && void remover(removendo)}
            >
              Remover
            </Botao>
          </>
        }
      >
        <p className="text-corpo text-tinta-2">
          O envio automático de <span className="font-[600] text-tinta">{removendo?.formularioNome}</span> para de sair.
          Os envios já feitos continuam na aba Envios.
        </p>
      </Modal>
    </>
  );
}
