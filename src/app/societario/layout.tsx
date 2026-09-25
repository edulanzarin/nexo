import { Suspense } from "react";
import { ProvedorCasca } from "@/componentes/casca/casca-cliente";
import { MolduraModulo } from "@/componentes/casca/moldura-modulo";
import { dadosCasca } from "@/lib/casca-servidor";
import { assertAcesso } from "@/lib/sessao";

export default async function LayoutSocietario({ children }: { children: React.ReactNode }) {
  // Gate otimista do módulo: layout não re-roda em navegação no cliente, então
  // quem tranca de verdade é a página compartilhada do Post Mortem e o `apiRoute`.
  const sessao = await assertAcesso("societario");
  return (
    <ProvedorCasca dados={dadosCasca(sessao)}>
      <Suspense>
        <MolduraModulo moduloId="societario">{children}</MolduraModulo>
      </Suspense>
    </ProvedorCasca>
  );
}
