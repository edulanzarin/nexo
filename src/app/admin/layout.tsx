import { Suspense } from "react";
import { ProvedorCasca } from "@/componentes/casca/casca-cliente";
import { MolduraModulo } from "@/componentes/casca/moldura-modulo";
import { dadosCasca } from "@/lib/casca-servidor";
import { assertAdmin } from "@/lib/sessao";

/**
 * A Administração na moldura dos módulos. Só administrador entra: o gate aqui é
 * otimista (layout não re-roda em navegação no cliente), e quem tranca de
 * verdade é o `assertAdmin` de cada página e o `apiRoute` em `/api/admin/*`.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sessao = await assertAdmin();
  return (
    <ProvedorCasca dados={dadosCasca(sessao)}>
      <Suspense>
        <MolduraModulo moduloId="admin">{children}</MolduraModulo>
      </Suspense>
    </ProvedorCasca>
  );
}
