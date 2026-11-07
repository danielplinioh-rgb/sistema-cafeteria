import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Janela de diálogo acessível: fecha com Esc, foca o primeiro campo, mantém o foco
 * dentro dela (Tab) e devolve o foco ao elemento anterior ao fechar.
 */
export function Modal({
  titulo,
  children,
  aoFechar,
  classe = '',
}: {
  titulo: string;
  children: ReactNode;
  aoFechar: () => void;
  classe?: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const alvo = ref.current?.querySelector<HTMLElement>('input, textarea, select, button');
    alvo?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'Tab' && ref.current) {
        const foco = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href]');
        if (foco.length === 0) return;
        const primeiro = foco[0];
        const ultimo = foco[foco.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal ${classe}`} role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
