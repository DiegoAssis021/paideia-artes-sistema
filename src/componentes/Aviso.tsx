import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Contexto = createContext<(texto: string) => void>(() => {});

/** Aviso rápido no rodapé (o "toast" do protótipo). */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const [texto, setTexto] = useState('');
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const avisar = useCallback((t: string) => {
    setTexto(t);
    setVisivel(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisivel(false), 3200);
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className={`toast${visivel ? ' on' : ''}`} role="status" aria-live="polite">
        {texto}
      </div>
    </Contexto.Provider>
  );
}

export function useAviso() {
  return useContext(Contexto);
}
