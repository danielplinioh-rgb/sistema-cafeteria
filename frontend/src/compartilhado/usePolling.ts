import { useEffect, useRef } from 'react';

/**
 * Executa `acao` imediatamente e depois a cada `intervaloSeg` segundos, enquanto
 * `ativo` for verdadeiro. Pausa quando a aba está oculta (economiza bateria e dados)
 * e atualiza na hora em que ela volta a ficar visível.
 */
export function usePolling(acao: () => void | Promise<void>, intervaloSeg: number, ativo = true): void {
  const ref = useRef(acao);
  ref.current = acao;

  useEffect(() => {
    if (!ativo) return;
    let parado = false;
    const rodar = () => {
      if (!parado && document.visibilityState === 'visible') void ref.current();
    };
    rodar();
    const id = window.setInterval(rodar, Math.max(1, intervaloSeg) * 1000);
    document.addEventListener('visibilitychange', rodar);
    return () => {
      parado = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', rodar);
    };
  }, [intervaloSeg, ativo]);
}
