/** Tipos que espelham o JSON da API (backend/.../api/dto/Dtos.java). */

export type Status =
  | 'AGUARDANDO_PAGAMENTO'
  | 'EM_PREPARO'
  | 'PRONTO'
  | 'ENTREGUE'
  | 'FINALIZADO'
  | 'CANCELADO';

export interface ObservacaoView {
  id: number;
  descricao: string;
}

export interface ProdutoCardapio {
  idProduto: number;
  nome: string;
  descricao: string | null;
  preco: number;
  disponivel: boolean;
  imagem: string | null;
  observacoes: ObservacaoView[];
}

export interface CategoriaCardapio {
  idCategoria: number;
  nome: string;
  produtos: ProdutoCardapio[];
}

export interface ItemView {
  idItem: number | null;
  idProduto: number | null;
  produto: string;
  imagem: string | null;
  quantidade: number;
  precoUnitario: number;
  idObservacoes: number[];
  observacoes: string[];
}

/** Visão do cliente (sem dados internos). */
export interface PedidoCliente {
  codigo: string;
  status: Status;
  local: string;
  valorTotal: number;
  versao: number;
  dataHora: string;
  itens: ItemView[];
}

/** Visão do painel (inclui dados internos). */
export interface PedidoPainel extends PedidoCliente {
  pagamentoPendente: boolean;
  dataPagamento: string | null;
  justificativaCancelamento: string | null;
  observacaoInterna: string | null;
}

export interface PedidoCriado {
  token: string;
  pedido: PedidoCliente;
}

export interface HistoricoView {
  codigo: string;
  dataHora: string;
  aviso: 'FINALIZADO' | 'CANCELADO';
  local: string;
  valorTotal: number;
  dataPagamento: string | null;
  justificativaCancelamento: string | null;
  observacaoInterna: string | null;
  dataEncerramento: string | null;
  encerradoPor: string | null;
}

export interface CategoriaView {
  idCategoria: number;
  nome: string;
}

export interface ProdutoPainel {
  idProduto: number;
  idCategoria: number;
  categoria: string;
  nome: string;
  descricao: string | null;
  preco: number;
  disponivel: boolean;
  imagem: string | null;
  idObservacoes: number[];
}

export interface SessaoView {
  nome: string;
  usuario: string;
}

/** Corpo enviado ao criar/alterar pedido. */
export interface PedidoEntrada {
  tipo: 'MESA' | 'BALCAO';
  mesa: number | null;
  itens: { idItem: number | null; idProduto: number; quantidade: number; observacoes: number[] }[];
}

export interface ProdutoEntrada {
  idCategoria: number;
  nome: string;
  descricao: string;
  preco: number;
  imagem: string;
  observacoes: number[];
}
