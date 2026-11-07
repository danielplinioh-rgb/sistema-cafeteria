/**
 * Cliente HTTP único dos dois módulos.
 *  - tempo limite (a rede de aeroporto/celular oscila);
 *  - erros padronizados (ErroApi) no formato {codigo, mensagem} do servidor;
 *  - módulo do colaborador: cookie de sessão (HttpOnly, enviado pelo navegador) e
 *    cabeçalho X-Requested-With, exigido pelo servidor contra CSRF;
 *  - módulo do cliente: token do pedido no cabeçalho X-Token-Pedido (nunca na URL).
 */
import { T } from './textos';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
  get semConexao(): boolean {
    return this.status === 0;
  }
}

export interface OpcoesChamada {
  /** Token secreto do pedido (módulo cliente). */
  token?: string;
  /** Marca a chamada como do painel (envia cabeçalho anti-CSRF). */
  painel?: boolean;
  /** Chave de idempotência (criação de pedido). */
  idempotencia?: string;
  /** Tempo limite em ms (padrão 10 s). */
  tempoLimiteMs?: number;
}

type Ouvinte = () => void;
const ouvintesSessaoExpirada = new Set<Ouvinte>();

/** O painel registra aqui o que fazer quando o servidor responde 401 (sessão expirou). */
export function aoExpirarSessao(fn: Ouvinte): () => void {
  ouvintesSessaoExpirada.add(fn);
  return () => ouvintesSessaoExpirada.delete(fn);
}

export async function chamar<T2>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  corpo?: unknown,
  op: OpcoesChamada = {},
): Promise<T2> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), op.tempoLimiteMs ?? 10_000);
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (op.token) cabecalhos['X-Token-Pedido'] = op.token;
  if (op.idempotencia) cabecalhos['Idempotency-Key'] = op.idempotencia;
  if (op.painel) cabecalhos['X-Requested-With'] = 'cafeteria-painel';

  let resposta: Response;
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controle.signal,
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', T.semConexao);
  } finally {
    clearTimeout(timer);
  }

  let dados: unknown = null;
  const texto = await resposta.text();
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }

  if (!resposta.ok) {
    const d = (dados ?? {}) as { codigo?: string; mensagem?: string; detalhes?: unknown };
    if (resposta.status === 401 && op.painel && caminho !== '/api/painel/login') {
      ouvintesSessaoExpirada.forEach((f) => f());
    }
    throw new ErroApi(resposta.status, d.codigo ?? 'ERRO', d.mensagem ?? T.instabilidade, d.detalhes);
  }
  return dados as T2;
}

export const api = {
  get: <R>(c: string, op?: OpcoesChamada) => chamar<R>('GET', c, undefined, op),
  post: <R>(c: string, corpo: unknown, op?: OpcoesChamada) => chamar<R>('POST', c, corpo, op),
  put: <R>(c: string, corpo: unknown, op?: OpcoesChamada) => chamar<R>('PUT', c, corpo, op),
  delete: <R>(c: string, op?: OpcoesChamada) => chamar<R>('DELETE', c, undefined, op),
};
