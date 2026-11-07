/**
 * Todos os textos da interface em um só lugar (fáceis de revisar ou traduzir).
 * As mensagens marcadas com [UC] são as exigidas pela documentação dos casos de uso.
 */
import type { Status } from './tipos';

export const T = {
  // ---- mensagens da documentação [UC] ----------------------------------------
  cardapioIndisponivel: 'Não foi possível carregar o cardápio no momento',
  instabilidade: 'Não foi possível concluir a operação no momento. Tente novamente em instantes.',
  pagamentoNoBalcao: 'Aguardando Pagamento no Balcão',
  alteracaoAposPagamento: 'Alterações não são permitidas após a confirmação do pagamento',
  alteracaoFalhou: 'A alteração não pôde ser concluída',
  pedidoSemItens: 'O pedido deve ter ao menos um item',
  confirmarCancelar: 'Deseja CANCELAR este pedido?',
  confirmarFinalizar: 'Deseja FINALIZAR este pedido?',
  confirmarDisponibilidade: 'Deseja ALTERAR A DISPONIBILIDADE deste Produto?',
  statusComPagamentoPendente: 'Não é possível alterar o status de um pedido com pagamento pendente',
  justificativaObrigatoria: 'Informe uma justificativa para essa ação',
  credenciaisInvalidas: 'Usuário ou senha inválidos.',

  // ---- comuns ---------------------------------------------------------------
  carregando: 'Carregando…',
  tentarNovamente: 'Tentar novamente',
  fechar: 'Fechar',
  voltar: 'Voltar',
  confirmar: 'Confirmar',
  cancelar: 'Cancelar',
  salvar: 'Salvar',
  semConexao: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',

  // ---- cliente --------------------------------------------------------------
  indisponivel: 'Indisponível',
  adicionar: 'Adicionar',
  adicionarAoPedido: 'Adicionar ao pedido',
  verPedido: 'Ver pedido',
  seuPedido: 'Seu pedido',
  carrinhoVazio: 'Seu pedido está vazio. Escolha algo gostoso no cardápio!',
  observacoes: 'Observações',
  quantidade: 'Quantidade',
  total: 'Total',
  onde: 'Onde você está?',
  naMesa: 'Estou na mesa',
  retirarBalcao: 'Retirar no balcão',
  numeroMesa: 'Número da mesa',
  informeMesa: 'Informe o número da mesa',
  confirmarPedido: 'Confirmar pedido',
  enviando: 'Enviando…',
  pedidoRegistrado: 'Pedido registrado!',
  codigoDoPedido: 'Código do pedido',
  vaAoBalcao: 'Informe o código no balcão e realize o pagamento. O preparo começa assim que o pagamento for confirmado.',
  alterarPedido: 'Alterar pedido',
  salvarAlteracoes: 'Salvar alterações',
  cancelarEdicao: 'Descartar alterações',
  novoPedido: 'Fazer novo pedido',
  pedidoPronto: 'Seu pedido está pronto!',
  prontoRetirar: 'Retire no balcão.',
  prontoMesa: 'Em instantes ele chegará à sua mesa.',
  pedidoCancelado: 'Este pedido foi cancelado. Em caso de dúvida, procure o balcão.',
  pedidoEntregue: 'Pedido entregue. Bom apetite!',
  atualizadoAgora: 'Atualização automática ativa',

  // ---- painel ---------------------------------------------------------------
  entrar: 'Entrar',
  entrando: 'Entrando…',
  usuario: 'Usuário',
  senha: 'Senha',
  sair: 'Sair',
  sessaoExpirada: 'Sessão expirada. Faça login novamente.',
  inatividade: 'Sessão encerrada por inatividade.',
  filaDePedidos: 'Fila de pedidos',
  historico: 'Histórico',
  produtos: 'Produtos',
  qrCode: 'QR Code',
  confirmarPagamento: 'Confirmar pagamento',
  marcarPronto: 'Marcar como Pronto',
  marcarEntregue: 'Marcar como Entregue',
  finalizar: 'Finalizar',
  cancelarPedido: 'Cancelar pedido',
  justificativa: 'Justificativa',
  observacaoInterna: 'Observação interna',
  novoProduto: 'Novo produto',
  editar: 'Editar',
  remover: 'Remover',
} as const;

/** Nome mostrado ao cliente para cada status (FINALIZADO aparece como "Entregue" — RF13). */
export const ROTULO_STATUS_CLIENTE: Record<Status, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  EM_PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  FINALIZADO: 'Entregue',
  CANCELADO: 'Cancelado',
};

/** Nome mostrado ao colaborador. */
export const ROTULO_STATUS_PAINEL: Record<Status, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  EM_PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
