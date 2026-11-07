/** Funções de formatação (moeda, data, tempo decorrido). Puras e testáveis. */

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarPreco(valor: number): string {
  return moeda.format(valor);
}

export function formatarHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "agora", "há 5 min", "há 2 h". */
export function tempoDecorrido(iso: string, agora: number = Date.now()): string {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h} h`;
}

/** Soma de itens para exibição (o valor oficial vem sempre do servidor). */
export function somarItens(itens: { quantidade: number; preco: number }[]): number {
  return Math.round(itens.reduce((t, i) => t + i.quantidade * i.preco, 0) * 100) / 100;
}

export function resumoObservacoes(obs: string[]): string {
  return obs.join(' · ');
}
