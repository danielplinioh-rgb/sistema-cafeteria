/**
 * Regras do carrinho (RF03/RF04/RF05) e sua persistência no aparelho.
 * Funções PURAS (sem React) para serem testáveis. O carrinho é `<<temporary>>`
 * (diagrama de classes): só existe no navegador até o pedido ser confirmado.
 */
import type { PedidoCliente, PedidoEntrada, ProdutoCardapio } from '../../src/compartilhado/tipos';

export const QUANTIDADE_MAXIMA = 20;
export const ITENS_MAXIMOS = 30;

export interface Linha {
  chave: string;
  idItem: number | null; // preenchido só ao alterar um pedido existente
  idProduto: number;
  nome: string;
  imagem: string | null;
  preco: number;
  quantidade: number;
  observacoes: number[];
  nomesObservacoes: string[];
}

export interface Local {
  tipo: 'MESA' | 'BALCAO';
  mesa: string;
}

/** Mesmo produto + mesmas observações = mesma linha (somam quantidade). */
export function chaveLinha(idProduto: number, observacoes: number[]): string {
  return `${idProduto}|${[...observacoes].sort((a, b) => a - b).join(',')}`;
}

export function linhaDeProduto(p: ProdutoCardapio, quantidade: number, observacoes: number[]): Linha {
  return {
    chave: chaveLinha(p.idProduto, observacoes),
    idItem: null,
    idProduto: p.idProduto,
    nome: p.nome,
    imagem: p.imagem,
    preco: p.preco,
    quantidade,
    observacoes: [...observacoes].sort((a, b) => a - b),
    nomesObservacoes: p.observacoes.filter((o) => observacoes.includes(o.id)).map((o) => o.descricao),
  };
}

export function adicionar(linhas: Linha[], nova: Linha): Linha[] {
  const existente = linhas.find((l) => l.chave === nova.chave);
  if (existente) {
    return linhas.map((l) =>
      l.chave === nova.chave ? { ...l, quantidade: Math.min(QUANTIDADE_MAXIMA, l.quantidade + nova.quantidade) } : l,
    );
  }
  return [...linhas, nova].slice(0, ITENS_MAXIMOS);
}

/** Soma `delta` à quantidade; chegando a zero a linha é removida. */
export function mudarQuantidade(linhas: Linha[], chave: string, delta: number): Linha[] {
  return linhas
    .map((l) => (l.chave === chave ? { ...l, quantidade: Math.min(QUANTIDADE_MAXIMA, l.quantidade + delta) } : l))
    .filter((l) => l.quantidade > 0);
}

export function remover(linhas: Linha[], chave: string): Linha[] {
  return linhas.filter((l) => l.chave !== chave);
}

export function totalItens(linhas: Linha[]): number {
  return linhas.reduce((s, l) => s + l.quantidade, 0);
}

export function totalValor(linhas: Linha[]): number {
  return Math.round(linhas.reduce((s, l) => s + l.quantidade * l.preco, 0) * 100) / 100;
}

/** Mesa válida: inteiro entre 1 e 9999 (mesma regra do servidor e do banco). */
export function mesaValida(texto: string): boolean {
  return /^[1-9][0-9]{0,3}$/.test(texto.trim());
}

export function paraEntrada(linhas: Linha[], local: Local): PedidoEntrada {
  return {
    tipo: local.tipo,
    mesa: local.tipo === 'MESA' ? Number(local.mesa.trim()) : null,
    itens: linhas.map((l) => ({
      idItem: l.idItem,
      idProduto: l.idProduto,
      quantidade: l.quantidade,
      observacoes: l.observacoes,
    })),
  };
}

/** Converte um pedido já registrado em linhas editáveis (modo "Alterar pedido"). */
export function dePedido(p: PedidoCliente): Linha[] {
  return p.itens.map((i) => {
    const obs = [...i.idObservacoes].sort((a, b) => a - b);
    return {
      chave: `item-${i.idItem}`,
      idItem: i.idItem,
      idProduto: i.idProduto ?? 0,
      nome: i.produto,
      imagem: i.imagem,
      preco: i.precoUnitario,
      quantidade: i.quantidade,
      observacoes: obs,
      nomesObservacoes: i.observacoes,
    };
  });
}

// ------------------------------------------------------------------ armazenamento
const K_CARRINHO = 'cafeteria.carrinho';
const K_PEDIDO = 'cafeteria.pedido';
const K_IDEM = 'cafeteria.idem';

export interface PedidoSalvo {
  codigo: string;
  token: string;
}

function ler<T>(chave: string): T | null {
  try {
    const t = localStorage.getItem(chave);
    return t ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown): void {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo privado/armazenamento cheio: o app continua funcionando sem persistir */
  }
}

export const guardar = {
  carrinho: (linhas: Linha[], local: Local) => gravar(K_CARRINHO, { linhas, local }),
  lerCarrinho: (): { linhas: Linha[]; local: Local } | null => {
    const v = ler<{ linhas: Linha[]; local: Local }>(K_CARRINHO);
    if (!v || !Array.isArray(v.linhas)) return null;
    return v;
  },
  pedido: (p: PedidoSalvo | null) => gravar(K_PEDIDO, p),
  lerPedido: (): PedidoSalvo | null => {
    const v = ler<PedidoSalvo>(K_PEDIDO);
    return v && typeof v.codigo === 'string' && typeof v.token === 'string' ? v : null;
  },
};

export function novaChave(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.padEnd(16, '0');
}

/**
 * Chave de idempotência estável para um mesmo conteúdo: se o envio falhar por rede e o
 * cliente tocar em "Confirmar" de novo, a MESMA chave vai ao servidor, que devolve o pedido
 * já criado em vez de duplicá-lo. Mudou o carrinho → nova chave.
 */
export function chaveIdempotencia(conteudo: string): string {
  const salvo = ler<{ conteudo: string; chave: string }>(K_IDEM);
  if (salvo && salvo.conteudo === conteudo) return salvo.chave;
  const chave = novaChave();
  gravar(K_IDEM, { conteudo, chave });
  return chave;
}
