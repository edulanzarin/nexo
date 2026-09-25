"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { avisar } from "@/componentes/primitivos/aviso";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { AreaTexto, Campo, Rotulado } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Menu, type ItemMenu } from "@/componentes/primitivos/menu";
import { Modal } from "@/componentes/primitivos/modal";
import { Painel } from "@/componentes/primitivos/painel";
import { TabelaDados, type Coluna } from "@/componentes/primitivos/tabela";
import { ModalEnviarFormulario, type FormularioEnvio } from "@/componentes/produto/rh/envio-enviar";
import { SeloSituacaoFormulario } from "@/componentes/produto/rh/formulario-situacao";
import { dataBR, num } from "@/lib/format";
import type { Formulario, FormularioResumo } from "@/lib/formularios-tipos";
import { mutar } from "@/hooks/mutar";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { CHAVES_RH, useFormulariosRh } from "@/hooks/use-rh";

/** O formulário remove em cascata só as perguntas; o que já foi usado segura a linha pela chave estrangeira. */
function mensagemRemocao(e: unknown): string {
  const msg = (e as Error).message ?? "";
  // O banco devolve a violação crua ("violates foreign key constraint"): a tela
  // traduz no que a pessoa pode fazer. O certo seria a lib responder isso.
  if (/foreign key|chave estrangeira/i.test(msg))
    return "Este formulário já foi usado num envio, na experiência ou numa avaliação. Arquive em vez de remover.";
  return msg;
}

/**
 * Os formulários do RH: o conjunto de perguntas que vai nos envios, na
 * experiência, no desempenho e nas avaliações. Aqui se cria, abre, duplica,
 * arquiva e remove; montar as perguntas é no editor (`/rh/formularios/<id>`),
 * que tem rota própria para o link voltar ao mesmo formulário.
 */
export default function Conteudo() {
  const router = useRouter();
  const qc = useQueryClient();
  const res = useFormulariosRh();
  const d = res.data;
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [verArquivados, setVerArquivados] = useEstadoTela("arquivados", false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [enviar, setEnviar] = useState<FormularioEnvio | null>(null);
  const [removendo, setRemovendo] = useState<FormularioResumo | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const invalidar = () => qc.invalidateQueries({ queryKey: [CHAVES_RH.formularios] });
  const abrir = (f: Pick<FormularioResumo, "id">) => router.push(`/rh/formularios/${f.id}`);

  const contagem = useMemo(() => {
    const c = { ativo: 0, rascunho: 0, arquivado: 0 };
    for (const f of d ?? []) c[f.status]++;
    return c;
  }, [d]);

  const linhas = useMemo(() => {
    const t = normalizar(busca.trim());
    return (d ?? []).filter(
      (f) =>
        (verArquivados || f.status !== "arquivado") &&
        (!t || normalizar(`${f.nome} ${f.descricao ?? ""}`).includes(t))
    );
  }, [d, busca, verArquivados]);

  async function fazer(f: FormularioResumo, acao: () => Promise<unknown>, ok: string, falha: string) {
    setOcupado(f.id);
    try {
      await acao();
      await invalidar();
      avisar.ok(ok, f.nome);
    } catch (e) {
      avisar.erro(falha, (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const duplicar = (f: FormularioResumo) =>
    fazer(f, () => mutar<Formulario>("/api/rh/formularios", "POST", { duplicarDe: f.id }), "Formulário duplicado", "Não deu para duplicar");

  const mudarSituacao = (f: FormularioResumo, status: "ativo" | "arquivado") =>
    fazer(
      f,
      () => mutar("/api/rh/formularios", "PATCH", { id: f.id, status }),
      status === "arquivado" ? "Formulário arquivado" : "Formulário reativado",
      status === "arquivado" ? "Não deu para arquivar" : "Não deu para reativar"
    );

  const itensMenu = (f: FormularioResumo): ItemMenu[] => [
    { rotulo: "Abrir", icone: "editar", aoEscolher: () => abrir(f) },
    { rotulo: "Duplicar", icone: "copiar", descricao: "Cópia em rascunho, com as mesmas perguntas", aoEscolher: () => void duplicar(f) },
    f.status === "arquivado"
      ? { rotulo: "Reativar", icone: "reabrir", aoEscolher: () => void mudarSituacao(f, "ativo") }
      : { rotulo: "Arquivar", icone: "ignorado", descricao: "Some da escolha no envio e no automático", aoEscolher: () => void mudarSituacao(f, "arquivado") },
    { tipo: "separador" },
    { rotulo: "Remover", icone: "apagar", perigo: true, aoEscolher: () => setRemovendo(f) },
  ];

  const colunas: Coluna<FormularioResumo>[] = [
    {
      id: "nome",
      cabecalho: "Formulário",
      largura: "52%",
      ordenar: (f) => f.nome,
      celula: (f) => (
        <span className="block min-w-0">
          <span className="block truncate font-[560] text-tinta" title={f.nome}>
            {f.nome}
          </span>
          {f.descricao && (
            <span className="block truncate text-pequeno text-apagado" title={f.descricao}>
              {f.descricao}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "situacao",
      cabecalho: "Situação",
      ordenar: (f) => ["ativo", "rascunho", "arquivado"].indexOf(f.status),
      celula: (f) => <SeloSituacaoFormulario status={f.status} />,
    },
    {
      id: "perguntas",
      cabecalho: "Perguntas",
      alinhar: "dir",
      ordenar: (f) => f.campos,
      celula: (f) => num(f.campos),
    },
    {
      id: "atualizado",
      cabecalho: "Atualizado em",
      secundaria: true,
      ordenar: (f) => f.atualizadoEm,
      celula: (f) => <span className="num">{dataBR(f.atualizadoEm)}</span>,
    },
    {
      id: "acoes",
      cabecalho: <span className="sr-only">Ações</span>,
      alinhar: "dir",
      celula: (f) => (
        // As ações decidem ali mesmo: o clique (e o Enter) não vaza para a linha, que abre o editor.
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {f.status === "ativo" && f.campos > 0 && (
            <Botao
              icone="enviar"
              onClick={() => setEnviar({ id: f.id, nome: f.nome })}
              className="h-controle-p rounded-chip px-2 text-pequeno"
            >
              Enviar
            </Botao>
          )}
          <Menu
            itens={itensMenu(f)}
            larguraMin={240}
            gatilho={(p) => <BotaoIcone {...p} icone="opcoes" rotulo={`Ações de ${f.nome}`} linha carregando={ocupado === f.id} />}
          />
        </div>
      ),
    },
  ];

  if (res.isError)
    return (
      <PainelErro
        titulo="Não deu para carregar os formulários"
        mensagem={(res.error as Error).message}
        onTentar={() => res.refetch()}
      />
    );

  const botaoNovo = (
    <Botao variante="primario" icone="mais" onClick={() => setNovoAberto(true)}>
      Novo formulário
    </Botao>
  );

  let vazio: ReactNode;
  if (d && d.length === 0)
    vazio = (
      <Vazio
        icone="relatorio"
        titulo="Nenhum formulário criado"
        descricao="Monte as perguntas uma vez e use o formulário nos envios, na experiência e no desempenho."
        acao={
          <Botao variante="primario" icone="mais" onClick={() => setNovoAberto(true)}>
            Criar formulário
          </Botao>
        }
      />
    );
  else if (d && busca.trim())
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Nenhum formulário com esse nome"
        descricao={verArquivados ? "Busque por outra parte do nome." : "Busque por outra parte do nome ou mostre os arquivados."}
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );
  else if (d)
    vazio = (
      <Vazio
        compacto
        icone="ignorado"
        titulo="Todos os formulários estão arquivados"
        acao={<Botao onClick={() => setVerArquivados(true)}>Mostrar arquivados</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>{botaoNovo}</AcoesPagina>

      <FaixaIndicadores colunas={3}>
        <Indicador
          rotulo="Ativos"
          icone="ok"
          carregando={!d}
          valor={num(contagem.ativo)}
          detalhe="Podem ser enviados"
        />
        <Indicador
          rotulo="Rascunhos"
          icone="pendente"
          carregando={!d}
          valor={num(contagem.rascunho)}
          detalhe="Em montagem"
        />
        <Indicador
          rotulo="Arquivados"
          icone="ignorado"
          carregando={!d}
          valor={num(contagem.arquivado)}
          detalhe="Fora das escolhas de envio"
        />
      </FaixaIndicadores>

      {d && d.length > 0 && <Nota>Só formulário ativo e com perguntas pode ser enviado.</Nota>}

      <Painel
        corpo="p-0"
        titulo="Formulários do RH"
        descricao={
          <span className="inline-flex items-center gap-1.5">
            Clique num formulário para editar as perguntas
            {res.isFetching && d && <Girando />}
          </span>
        }
        acoes={
          <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
            <Campo
              icone="buscar"
              placeholder="Nome ou descrição"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              classeCaixa="w-full sm:w-56"
              aria-label="Buscar formulário"
              fim={busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined}
            />
            <Alternador ligado={verArquivados} onMudar={setVerArquivados} rotulo="Mostrar arquivados" />
          </span>
        }
      >
        {!d ? (
          <EsqueletoTabela linhas={5} colunas={5} />
        ) : (
          <TabelaDados
            rotulo="Formulários do RH"
            colunas={colunas}
            linhas={linhas}
            chave={(f) => String(f.id)}
            onLinha={abrir}
            vazio={vazio}
          />
        )}
      </Painel>

      <ModalNovoFormulario
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        onCriado={async (f) => {
          await invalidar();
          router.push(`/rh/formularios/${f.id}`);
        }}
      />

      <ModalEnviarFormulario aberto={enviar != null} formulario={enviar} onFechar={() => setEnviar(null)} />

      <Modal
        aberto={removendo != null}
        onFechar={() => {
          if (ocupado == null) setRemovendo(null);
        }}
        titulo="Remover o Formulário?"
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
              onClick={async () => {
                if (!removendo) return;
                const f = removendo;
                setOcupado(f.id);
                try {
                  await mutar(`/api/rh/formularios?id=${f.id}`, "DELETE");
                  await invalidar();
                  avisar.ok("Formulário removido", f.nome);
                  setRemovendo(null);
                } catch (e) {
                  avisar.erro("Não deu para remover", mensagemRemocao(e));
                } finally {
                  setOcupado(null);
                }
              }}
            >
              Remover
            </Botao>
          </>
        }
      >
        <p className="text-corpo text-tinta-2">
          <span className="font-[600] text-tinta">{removendo?.nome}</span> e as perguntas dele saem do NaveX. Não dá
          para desfazer.
        </p>
      </Modal>
    </>
  );
}

/** Nome e descrição bastam para nascer: as perguntas se montam no editor, para onde a tela leva em seguida. */
function ModalNovoFormulario({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (f: Formulario) => Promise<void>;
}) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tentou, setTentou] = useState(false);

  const fechar = () => {
    if (salvando) return;
    setNome("");
    setDescricao("");
    setTentou(false);
    onFechar();
  };

  async function criar() {
    setTentou(true);
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const f = await mutar<Formulario>("/api/rh/formularios", "POST", {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
      });
      avisar.ok("Formulário criado", nome.trim());
      await onCriado(f);
    } catch (e) {
      avisar.erro("Não deu para criar", (e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={fechar}
      fecharNoVeu={false}
      titulo="Novo Formulário"
      descricao="Começa como rascunho. Ative quando as perguntas estiverem prontas."
      largura="p"
      rodape={
        <>
          <Botao onClick={fechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" icone="mais" carregando={salvando} onClick={criar}>
            Criar e montar perguntas
          </Botao>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void criar();
        }}
      >
        <Rotulado rotulo="Nome" htmlFor={`${id}-nome`} erro={tentou && !nome.trim() ? "Dê um nome ao formulário" : undefined}>
          <Campo
            id={`${id}-nome`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Avaliação de experiência, pesquisa de clima…"
            aria-invalid={tentou && !nome.trim()}
            data-autofoco
          />
        </Rotulado>
        <Rotulado rotulo="Descrição" htmlFor={`${id}-descricao`} ajuda="Opcional. Aparece no alto do formulário, para quem responde.">
          <AreaTexto id={`${id}-descricao`} value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </Rotulado>
        {/* Enter no nome cria: o botão de envio escondido é o que faz o form aceitar o Enter. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
