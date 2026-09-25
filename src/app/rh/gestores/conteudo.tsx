"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AcoesPagina } from "@/componentes/casca/moldura-modulo";
import { Botao, BotaoIcone } from "@/componentes/primitivos/botao";
import { Alternador } from "@/componentes/primitivos/caixa";
import { Campo } from "@/componentes/primitivos/campo";
import { normalizar } from "@/componentes/primitivos/combo";
import { EsqueletoTabela, Girando, Nota, PainelErro, Vazio } from "@/componentes/primitivos/estados";
import { FaixaIndicadores, Indicador } from "@/componentes/primitivos/indicador";
import { Painel } from "@/componentes/primitivos/painel";
import {
  ModalNovoSetor,
  ModalSetor,
  montarSetores,
  precisaGestor,
  TabelaSetores,
  type SetorGestores,
} from "@/componentes/produto/rh/gestores-setor";
import { useEstadoTela } from "@/hooks/use-estado-modulo";
import { useRhFuncionarios, useRhGestores, useRhSetores } from "@/hooks/use-rh";
import { num, pct } from "@/lib/format";

/**
 * Gestores: quem recebe os formulários de cada setor, e os setores criados no
 * RH. A tela abre pelo que falta: setor com gente e sem gestor vem primeiro,
 * com o botão de adicionar na própria linha.
 */
export default function Conteudo() {
  const setores = useRhSetores();
  const gestores = useRhGestores();
  // A contagem de pessoas vem do Diretório, que já aplica as trocas de setor
  // feitas no RH; a da lista de setores lê o Questor cru. Se o Diretório
  // falhar, a tela segue com a da lista em vez de travar.
  const diretorio = useRhFuncionarios();
  const [busca, setBusca] = useEstadoTela("busca", "");
  const [soSemGestor, setSoSemGestor] = useEstadoTela("so-sem-gestor", false);
  const [aberto, setAberto] = useState<SetorGestores | null>(null);
  const [novoSetor, setNovoSetor] = useState(false);

  const pessoasPorSetor = useMemo(() => {
    if (!diretorio.data) return null;
    const m = new Map<string, number>();
    for (const f of diretorio.data) if (f.classiforgan) m.set(f.classiforgan, (m.get(f.classiforgan) ?? 0) + 1);
    return m;
  }, [diretorio.data]);

  const pronto = setores.data && gestores.data && (diretorio.data || diretorio.isError);
  const itens = useMemo(
    () => (pronto && setores.data && gestores.data ? montarSetores(setores.data, gestores.data, pessoasPorSetor) : null),
    [pronto, setores.data, gestores.data, pessoasPorSetor]
  );

  const resumo = useMemo(() => {
    if (!itens) return null;
    const sem = itens.filter(precisaGestor);
    const pessoas = itens.reduce((s, i) => s + i.pessoas, 0);
    const descobertas = sem.reduce((s, i) => s + i.pessoas, 0);
    return {
      setores: itens.filter((i) => !i.orfao).length,
      proprios: itens.filter((i) => i.setor.origem === "app").length,
      gestores: itens.reduce((s, i) => s + i.gestores.length, 0),
      comGestor: itens.filter((i) => i.gestores.length > 0).length,
      sem: sem.length,
      descobertas,
      pessoas,
      cobertas: pessoas - descobertas,
    };
  }, [itens]);

  const termo = normalizar(busca.trim());
  const linhas = useMemo(() => {
    const partes = termo ? termo.split(/\s+/) : [];
    return (itens ?? []).filter((i) => {
      if (soSemGestor && !precisaGestor(i)) return false;
      if (!partes.length) return true;
      const alvo = normalizar(`${i.setor.nome} ${i.gestores.map((g) => `${g.nome} ${g.email}`).join(" ")}`);
      return partes.every((p) => alvo.includes(p));
    });
  }, [itens, soSemGestor, termo]);

  // Lido da lista atual, para mostrar o gestor que acabou de entrar. O setor
  // recém-criado (ou o que perdeu o último gestor e saiu da lista) ainda não
  // está nela: fica o que foi aberto, com os gestores de agora.
  const itemAberto = aberto
    ? (itens?.find((i) => i.setor.classiforgan === aberto.setor.classiforgan) ?? {
        ...aberto,
        gestores: (gestores.data ?? []).filter((g) => g.classiforgan === aberto.setor.classiforgan),
      })
    : null;

  const erro = setores.error ?? gestores.error;
  const carregando = !itens;

  const botaoNovoSetor = (
    <Botao icone="mais" onClick={() => setNovoSetor(true)}>
      Novo setor
    </Botao>
  );

  let vazio: ReactNode;
  if (itens && !itens.length)
    vazio = (
      <Vazio
        icone="camadas"
        titulo="Nenhum setor ainda"
        descricao="O Questor não trouxe setor com gente ativa. Crie um setor próprio para cadastrar os gestores."
        acao={botaoNovoSetor}
      />
    );
  else if (termo)
    vazio = (
      <Vazio
        compacto
        icone="buscar"
        titulo="Nenhum setor ou gestor com esse termo"
        descricao="Busque pelo nome do setor, pelo nome do gestor ou pelo e-mail."
        acao={<Botao onClick={() => setBusca("")}>Limpar busca</Botao>}
      />
    );
  else if (soSemGestor)
    vazio = (
      <Vazio
        compacto
        icone="ok"
        titulo="Todo setor com gente tem gestor"
        acao={<Botao onClick={() => setSoSemGestor(false)}>Ver todos os setores</Botao>}
      />
    );

  return (
    <>
      <AcoesPagina>{botaoNovoSetor}</AcoesPagina>

      {erro ? (
        <PainelErro
          titulo="Não deu para carregar os setores e os gestores"
          mensagem={(erro as Error).message}
          onTentar={() => {
            setores.refetch();
            gestores.refetch();
          }}
        />
      ) : (
        <>
          <FaixaIndicadores colunas={4}>
            <Indicador
              rotulo="Setores"
              icone="camadas"
              carregando={carregando}
              valor={num(resumo?.setores ?? 0)}
              detalhe={
                resumo?.proprios
                  ? `${num(resumo.proprios)} ${resumo.proprios === 1 ? "criado" : "criados"} no RH`
                  : "Do organograma do Questor"
              }
            />
            <Indicador
              rotulo="Gestores"
              icone="usuario"
              carregando={carregando}
              valor={num(resumo?.gestores ?? 0)}
              detalhe={
                resumo?.gestores
                  ? `Em ${num(resumo.comGestor)} ${resumo.comGestor === 1 ? "setor" : "setores"}`
                  : "Nenhum cadastrado"
              }
            />
            <Indicador
              rotulo="Setores sem gestor"
              icone="alerta"
              carregando={carregando}
              valor={num(resumo?.sem ?? 0)}
              detalhe={
                resumo?.sem
                  ? `${num(resumo.descobertas)} ${resumo.descobertas === 1 ? "pessoa fica" : "pessoas ficam"} sem avaliação`
                  : "Todo setor com gente tem gestor"
              }
              tom={soSemGestor ? "rota" : resumo?.sem ? "atencao" : "ok"}
              valorNoTom={!!resumo?.sem && !soSemGestor}
              onClick={resumo?.sem ? () => setSoSemGestor(!soSemGestor) : undefined}
            />
            <Indicador
              rotulo="Pessoas com gestor"
              icone="pessoas"
              carregando={carregando}
              valor={resumo?.pessoas ? pct((resumo.cobertas / resumo.pessoas) * 100, 0) : "—"}
              detalhe={resumo ? `${num(resumo.cobertas)} de ${num(resumo.pessoas)} pessoas ativas` : ""}
            />
          </FaixaIndicadores>

          <div className="flex flex-col gap-1">
            {resumo && resumo.gestores === 0 && resumo.setores > 0 && (
              <Nota tom="atencao" icone="alerta">
                Nenhum gestor cadastrado ainda. A avaliação de experiência e a de desempenho só chegam a setor com
                gestor.
              </Nota>
            )}
            <Nota>O setor é o mesmo na NAVECON, na FOUR e na FINAVE, e o gestor responde por ele nas três.</Nota>
          </div>

          <Painel
            corpo="p-0"
            titulo="Setores"
            descricao={
              <span className="inline-flex items-center gap-1.5">
                Os sem gestor primeiro, depois os maiores
                {(setores.isFetching || gestores.isFetching) && itens && <Girando />}
              </span>
            }
            acoes={
              <>
                <Campo
                  icone="buscar"
                  placeholder="Setor, gestor ou e-mail"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  classeCaixa="w-full sm:w-56"
                  aria-label="Buscar setor ou gestor"
                  fim={
                    busca ? <BotaoIcone icone="fechar" rotulo="Limpar busca" linha onClick={() => setBusca("")} /> : undefined
                  }
                />
                <Alternador ligado={soSemGestor} onMudar={setSoSemGestor} rotulo="Só sem gestor" />
              </>
            }
          >
            {!itens ? (
              <EsqueletoTabela colunas={4} linhas={8} />
            ) : (
              <TabelaSetores
                itens={linhas}
                onAbrir={setAberto}
                selecionado={aberto?.setor.classiforgan}
                vazio={vazio}
              />
            )}
          </Painel>
        </>
      )}

      <ModalSetor item={itemAberto} onFechar={() => setAberto(null)} />
      <ModalNovoSetor
        aberto={novoSetor}
        onFechar={() => setNovoSetor(false)}
        onCriado={(s) => setAberto({ setor: s, pessoas: 0, gestores: [] })}
      />
    </>
  );
}
