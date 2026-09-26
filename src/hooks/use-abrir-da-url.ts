"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Lê `?abrir=<id>` uma vez, na montagem: é como um painel ou a ficha de outra
 * tela abrem um item direto ("/ti/acessos?abrir=12"). O parâmetro sai da URL em
 * seguida, senão recarregar a página reabriria a ficha que a pessoa fechou.
 */
export function useAbrirDaUrl(): number | null {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [inicial] = useState(() => {
    const n = Number(sp.get("abrir"));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const limpo = useRef(false);
  useEffect(() => {
    if (limpo.current || !sp.has("abrir")) return;
    limpo.current = true;
    const qs = new URLSearchParams(sp.toString());
    qs.delete("abrir");
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [sp, router, pathname]);
  return inicial;
}
