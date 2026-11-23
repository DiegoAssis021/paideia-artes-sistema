import { useCallback, useEffect, useState } from 'react';

interface Estado<T> {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
}

/** Carrega dados assíncronos e refaz quando as dependências mudam ou `recarregar()` é chamado. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: unknown[]) {
  const [estado, setEstado] = useState<Estado<T>>({ dados: null, erro: null, carregando: true });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true }));
    buscar()
      .then((dados) => vivo && setEstado({ dados, erro: null, carregando: false }))
      .catch((e: unknown) =>
        vivo && setEstado({ dados: null, erro: e instanceof Error ? e.message : String(e), carregando: false }),
      );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa, ...deps]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  return { ...estado, recarregar };
}
