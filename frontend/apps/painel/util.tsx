import { useCallback, useState } from 'react';
import { ErroApi } from '../../src/compartilhado/http';
import { useAvisos } from '../../src/compartilhado/toast';

/** Executa uma ação da API mostrando o erro (mensagem do servidor) em um aviso. Evita cliques duplos. */
export function useAcao(): { ocupado: boolean; executar: <R>(fn: () => Promise<R>) => Promise<R | undefined> } {
  const [ocupado, setOcupado] = useState(false);
  const { avisar } = useAvisos();
  const executar = useCallback(
    async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
      setOcupado(true);
      try {
        return await fn();
      } catch (e) {
        avisar(e instanceof ErroApi ? e.message : 'Erro inesperado', 'erro');
        return undefined;
      } finally {
        setOcupado(false);
      }
    },
    [avisar],
  );
  return { ocupado, executar };
}

/** Bipe curto (Web Audio) para chamar atenção a novos pedidos; silencioso se o navegador bloquear. */
export function bipe(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    ganho.gain.value = 0.08;
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio */
  }
}
