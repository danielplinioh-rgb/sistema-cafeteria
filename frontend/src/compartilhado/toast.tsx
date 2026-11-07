/** Avisos rápidos (toasts) acessíveis: aparecem no rodapé e somem sozinhos. */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

type Tipo = 'info' | 'sucesso' | 'erro';
interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
}
interface Contexto {
  avisar: (texto: string, tipo?: Tipo) => void;
}

const Ctx = createContext<Contexto>({ avisar: () => undefined });
export const useAvisos = (): Contexto => useContext(Ctx);

let contador = 0;

export function ProvedorAvisos({ children }: { children: ReactNode }): ReactElement {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: Tipo = 'info') => {
    const id = ++contador;
    setAvisos((a) => [...a.slice(-2), { id, tipo, texto }]);
    window.setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);
  const valor = useMemo(() => ({ avisar }), [avisar]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso--${a.tipo}`}>
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
