package br.edu.fatec.cafeteria.nucleo;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ciclo de vida do pedido (enum {@code StatusPedido} do Diagrama de Classes).
 *
 * <p>Os seis valores e as transições abaixo são os mesmos que o banco de dados
 * impõe por gatilho (ver {@code banco/schema.sql}, função
 * {@code fn_pedido_antes_update}). A aplicação valida primeiro, para devolver
 * mensagens claras ao usuário; o banco é a segunda barreira.
 *
 * <pre>
 *  AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE → FINALIZADO
 *          └──────────────┴───────────┴──→ CANCELADO   (ENTREGUE nunca é cancelado)
 * </pre>
 */
public enum StatusPedido {

    AGUARDANDO_PAGAMENTO("Aguardando pagamento"),
    EM_PREPARO("Em preparo"),
    PRONTO("Pronto"),
    ENTREGUE("Entregue"),
    FINALIZADO("Finalizado"),
    CANCELADO("Cancelado");

    private final String rotulo;

    StatusPedido(String rotulo) {
        this.rotulo = rotulo;
    }

    /** Texto amigável para exibição. */
    public String rotulo() {
        return rotulo;
    }

    /** Status para os quais o pedido pode ir a partir deste (RF10, RF11, RF12, RF15). */
    public Set<StatusPedido> destinosPermitidos() {
        return switch (this) {
            case AGUARDANDO_PAGAMENTO -> EnumSet.of(EM_PREPARO, CANCELADO);
            case EM_PREPARO -> EnumSet.of(PRONTO, CANCELADO);
            case PRONTO -> EnumSet.of(ENTREGUE, CANCELADO);
            case ENTREGUE -> EnumSet.of(FINALIZADO);
            case FINALIZADO, CANCELADO -> EnumSet.noneOf(StatusPedido.class);
        };
    }

    public boolean podeIrPara(StatusPedido destino) {
        return destinosPermitidos().contains(destino);
    }

    /** Estados finais: saem da fila de pendentes e permanecem no histórico (RF10, RF15). */
    public boolean estadoFinal() {
        return this == FINALIZADO || this == CANCELADO;
    }

    /** O pagamento já foi confirmado? (RF08: depois disso o pedido não pode mais ser alterado). */
    public boolean pagamentoConfirmado() {
        return this != AGUARDANDO_PAGAMENTO && this != CANCELADO;
    }

    /** Pode ser cancelado? ENTREGUE, FINALIZADO e CANCELADO não podem (RF10). */
    public boolean cancelavel() {
        return this == AGUARDANDO_PAGAMENTO || this == EM_PREPARO || this == PRONTO;
    }

    /** Cancelar após o pagamento exige justificativa (RF10, RF16). */
    public boolean cancelamentoExigeJustificativa() {
        return this == EM_PREPARO || this == PRONTO;
    }

    /**
     * Status em que o pedido precisa estar para chegar a este por uma ação do
     * colaborador (usado como "guarda" nos UPDATEs, evitando atualização duplicada).
     * Só faz sentido para PRONTO, ENTREGUE e FINALIZADO.
     */
    public StatusPedido anteriorNoCiclo() {
        return switch (this) {
            case PRONTO -> EM_PREPARO;
            case ENTREGUE -> PRONTO;
            case FINALIZADO -> ENTREGUE;
            default -> throw new IllegalStateException("Status sem antecessor único: " + this);
        };
    }

    /** Converte o texto vindo do banco ou da API; falha com erro de negócio se for inválido. */
    public static StatusPedido deTexto(String texto) {
        if (texto == null) {
            throw ErroNegocio.invalido("STATUS_INVALIDO", "Status inválido");
        }
        try {
            return StatusPedido.valueOf(texto.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ErroNegocio.invalido("STATUS_INVALIDO", "Status inválido");
        }
    }
}
