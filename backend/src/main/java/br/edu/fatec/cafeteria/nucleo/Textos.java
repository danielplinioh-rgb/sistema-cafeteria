package br.edu.fatec.cafeteria.nucleo;

/**
 * Mensagens de erro do back-end, exatamente como aparecem nos cenários
 * alternativos do Documento de Casos de Uso. Ficam todas aqui para que uma
 * mudança de redação seja feita em um único lugar.
 *
 * <p>As mensagens "positivas" (ex.: "Aguardando Pagamento no Balcão") são
 * exibidas pelo front-end e ficam em {@code frontend/src/compartilhado/textos.ts}.
 */
public final class Textos {

    private Textos() {
    }

    // ---- Realizar Pedido / Alterar Pedido Pendente ------------------------------
    public static final String INSTABILIDADE =
            "Estamos enfrentando uma pequena instabilidade no momento, tente novamente em alguns minutos";
    public static final String ALTERACAO_APOS_PAGAMENTO =
            "Alterações não são permitidas após a confirmação do pagamento";
    public static final String ALTERACAO_FALHOU = "A alteração não pôde ser concluída";
    public static final String PEDIDO_SEM_ITENS = "O pedido deve ter ao menos um item";
    public static final String PRODUTO_INDISPONIVEL = "O produto \"%s\" está indisponível no momento";

    // ---- Confirmar Pagamento ----------------------------------------------------
    public static final String PEDIDO_ALTERADO_PELO_CLIENTE =
            "O pedido foi alterado pelo cliente. Confira os itens e o novo valor total antes de confirmar o pagamento.";
    public static final String PAGAMENTO_JA_CONFIRMADO = "O pagamento deste pedido já foi confirmado";
    public static final String PEDIDO_CANCELADO = "Este pedido foi cancelado";

    // ---- Atualizar Status / Cancelar / Finalizar --------------------------------
    public static final String STATUS_COM_PAGAMENTO_PENDENTE =
            "Não é possível alterar o status de um pedido com pagamento pendente";
    public static final String TRANSICAO_NAO_PERMITIDA = "Operação não permitida: o status atual do pedido não permite esta ação";
    public static final String CANCELAMENTO_NAO_PERMITIDO =
            "Operação não permitida: o pedido não pode ser cancelado no status atual";
    public static final String JUSTIFICATIVA_OBRIGATORIA = "Informe uma justificativa para essa ação";
    public static final String FINALIZAR_COM_PAGAMENTO_PENDENTE =
            "Operação não permitida: O pagamento do pedido está pendente";
    public static final String FINALIZAR_STATUS_INVALIDO =
            "Operação não permitida: o pedido só pode ser finalizado depois de entregue";
    public static final String OBSERVACAO_INTERNA_STATUS =
            "A observação interna só pode ser registrada em pedidos finalizados ou cancelados";

    // ---- Login ------------------------------------------------------------------
    /** Mensagem única para usuário inexistente, senha errada ou usuário inativo (não revela qual). */
    public static final String CREDENCIAIS_INVALIDAS = "Usuário ou senha inválidos.";
    public static final String LOGIN_BLOQUEADO =
            "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.";
    public static final String NAO_AUTENTICADO = "Sessão expirada ou inexistente. Faça login novamente.";
    public static final String VERIFICACAO_REQUISICAO = "Requisição não autorizada";
    public static final String LIMITE_REQUISICOES = "Muitas requisições. Aguarde um instante e tente novamente.";

    // ---- Genéricas --------------------------------------------------------------
    public static final String PEDIDO_NAO_ENCONTRADO = "Pedido não encontrado";
    public static final String PRODUTO_NAO_ENCONTRADO = "Produto não encontrado";
    public static final String REQUISICAO_INVALIDA = "Requisição inválida";
    public static final String ERRO_INTERNO = "Não foi possível concluir a operação. Tente novamente.";
}
