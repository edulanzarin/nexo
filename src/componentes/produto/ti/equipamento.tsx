import { Icone } from "@/componentes/primitivos/icone";
import { Selo } from "@/componentes/primitivos/selo";
import { cn } from "@/lib/cn";
import { dataBR, dataHoraBR } from "@/lib/format";
import {
  frasePosse,
  nomeEquipamento,
  resumoSpecs,
  textoPosse,
  tipoEquipamento,
  type DadosEquipamento,
  type Movimentacao,
  type Posse,
} from "@/lib/ti-tipos";

/*
 * As peças que o inventário repete em toda tela da TI: o equipamento numa
 * linha, a etiqueta de patrimônio, com quem ele está e o histórico de posse.
 */

/** O ícone do tipo num quadrado: a coluna de ícones deixa a lista se ler pelo formato antes do nome. */
export function IconeTipo({ tipo, className }: { tipo: string; className?: string }) {
  return (
    <span
      className={cn("grid size-8 shrink-0 place-items-center rounded-controle bg-poco-forte text-tinta-2", className)}
      title={tipoEquipamento(tipo).rotulo}
    >
      <Icone nome={tipoEquipamento(tipo).icone} tamanho={16} />
    </span>
  );
}

/** O equipamento numa célula: tipo, marca e modelo em cima, as especificações que decidem embaixo. */
export function CelulaEquipamento({ e }: { e: Pick<DadosEquipamento, "tipo" | "marca" | "modelo" | "especificacoes"> }) {
  const resumo = resumoSpecs(e);
  return (
    <span className="flex min-w-0 items-center gap-2.5 py-1">
      <IconeTipo tipo={e.tipo} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-tinta">{nomeEquipamento(e)}</span>
        {resumo && <span className="truncate text-pequeno text-apagado">{resumo}</span>}
      </span>
    </span>
  );
}

/** A etiqueta de patrimônio. Sem etiqueta é informação (mouse e cabo não têm), não defeito. */
export function Patrimonio({ codigo }: { codigo: string | null }) {
  return codigo ? (
    <span className="num font-[600] whitespace-nowrap text-tinta">{codigo}</span>
  ) : (
    <span className="whitespace-nowrap text-apagado">Sem etiqueta</span>
  );
}

const ICONE_POSSE: Record<Posse["destino"], string> = {
  pessoa: "usuario",
  externo: "usuario",
  local: "local",
  estoque: "estoque",
  manutencao: "manutencao",
  baixa: "bloqueado",
};

/**
 * O selo de quem está com o equipamento. Quem é de fora do Diretório sempre
 * leva o seu, para ninguém confundir o terceirizado com alguém da casa; quem
 * precisa devolver (saiu do Diretório, ou teve o cadastro encerrado) leva o de
 * atenção.
 */
export function SeloRecebedor({ posse, fora }: { posse: Posse; fora?: boolean }) {
  if (posse.destino === "pessoa")
    return fora ? (
      <Selo tom="atencao" title="Não aparece mais no Diretório do RH: pode ter saído da empresa">
        Fora do Diretório
      </Selo>
    ) : null;
  if (posse.destino === "externo")
    return fora ? (
      <Selo tom="atencao" title="O cadastro de fora do Diretório foi encerrado: o equipamento precisa voltar">
        Encerrado
      </Selo>
    ) : (
      <Selo tom="rota" title="Não é do Diretório do RH: cadastro da TI">
        De fora
      </Selo>
    );
  return null;
}

/**
 * Com quem o equipamento está. Pessoa leva o setor embaixo, e quem é de fora do
 * Diretório leva a empresa ou o vínculo. Quem precisa devolver ganha o selo,
 * porque é o equipamento que a TI precisa recolher. Estoque e baixa ficam
 * apagados: não pedem ação de ninguém.
 */
export function CelulaPosse({ posse, fora }: { posse: Posse; fora?: boolean }) {
  if (posse.destino === "pessoa" || posse.destino === "externo") {
    const embaixo = posse.destino === "pessoa" ? posse.setor : posse.vinculo;
    return (
      <span className="flex min-w-0 flex-col py-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-tinta">{posse.nome}</span>
          <SeloRecebedor posse={posse} fora={fora} />
        </span>
        {embaixo && <span className="truncate text-pequeno text-apagado">{embaixo}</span>}
      </span>
    );
  }
  const tom =
    posse.destino === "manutencao" ? "text-atencao" : posse.destino === "local" ? "text-tinta" : "text-apagado";
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", tom)}>
      <Icone nome={ICONE_POSSE[posse.destino]} tamanho={15} className="shrink-0" />
      <span className="truncate">{textoPosse(posse)}</span>
    </span>
  );
}

const TOM_MARCA: Record<Posse["destino"], string> = {
  pessoa: "bg-rota-suave text-rota",
  externo: "bg-rota-suave text-rota",
  local: "bg-rota-suave text-rota",
  estoque: "bg-poco-forte text-tinta-2",
  manutencao: "bg-atencao-suave text-atencao",
  baixa: "bg-perigo-suave text-perigo",
};

/**
 * O histórico de posse, do mais recente para trás. Cada linha diz o que
 * aconteceu, de onde veio, quando e quem registrou: é a resposta para "pra quem
 * foi o notebook 12 em março", que é por que o histórico existe.
 */
export function HistoricoPosse({ historico }: { historico: Movimentacao[] }) {
  return (
    <ol className="flex flex-col">
      {historico.map((m, i) => {
        const f = frasePosse(m);
        const ultima = i === historico.length - 1;
        return (
          <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!ultima && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-linha" />}
            <span className={cn("z-[1] grid size-7 shrink-0 place-items-center rounded-full", TOM_MARCA[m.posse.destino])}>
              <Icone nome={ICONE_POSSE[m.posse.destino]} tamanho={14} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-corpo">
                <span className="font-[560] text-tinta">{f.titulo}</span>
                <span className="num text-pequeno text-apagado">{dataBR(m.data)}</span>
              </p>
              <p className="text-pequeno text-apagado">
                {f.de && <>Estava {f.de} · </>}
                {m.registradoPor ? `Registrado por ${m.registradoPor}` : "Registrado"} em {dataHoraBR(m.registradoEm)}
              </p>
              {m.observacao && <p className="mt-1 text-pequeno whitespace-pre-line text-tinta-2">{m.observacao}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
