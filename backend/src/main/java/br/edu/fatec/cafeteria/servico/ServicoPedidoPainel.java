package br.edu.fatec.cafeteria.servico;

import br.edu.fatec.cafeteria.api.dto.Dtos.HistoricoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoPainel;
import br.edu.fatec.cafeteria.nucleo.ErroNegocio;
import br.edu.fatec.cafeteria.nucleo.StatusPedido;
import br.edu.fatec.cafeteria.nucleo.Textos;
import br.edu.fatec.cafeteria.nucleo.ValidadorEntrada;
import br.edu.fatec.cafeteria.repositorio.RepositorioPedido;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Casos de uso do COLABORADOR sobre pedidos: fila (RF07), confirmar pagamento
 * (RF09, RF11), atualizar status (RF12), cancelar (RF10), finalizar (RF15) e
 * observação interna (RF16).
 *
 * <p>Toda operação roda em uma transação que começa informando ao banco QUEM está
 * operando; é isso que preenche a trilha de auditoria (RNF05, RNF08). O banco
 * repete as regras de transição como última linha de defesa.
 */
@Service
public class ServicoPedidoPainel {

    private final RepositorioPedido pedidos;
    private final TransactionTemplate tx;

    public ServicoPedidoPainel(RepositorioPedido pedidos, TransactionTemplate tx) {
        this.pedidos = pedidos;
        this.tx = tx;
    }

    // ------------------------------------------------------------------ leitura
    public List<PedidoPainel> fila() {
        return pedidos.fila();
    }

    public PedidoPainel detalhe(String codigo) {
        return pedidos.buscarPorCodigo(exigirCodigo(codigo)).orElseThrow(ServicoPedidoPainel::naoEncontrado);
    }

    public List<HistoricoView> historico() {
        return pedidos.historico();
    }

    // ------------------------------------------------- confirmar pagamento (RF09)
    /**
     * @param versaoExibida versão do pedido que o terminal mostrava. Se o cliente alterou o pedido
     *                      nesse meio-tempo, a versão mudou e o pagamento NÃO é confirmado (cenário A3):
     *                      o colaborador recebe o pedido atualizado para conferir o novo total.
     */
    public PedidoPainel confirmarPagamento(String codigo, int versaoExibida, int idColaborador) {
        exigirCodigo(codigo);
        return tx.execute(status -> {
            pedidos.definirColaborador(idColaborador);
            int linhas = pedidos.confirmarPagamento(codigo, idColaborador, versaoExibida);
            if (linhas == 0) {
                PedidoPainel atual = pedidos.buscarPorCodigo(codigo).orElseThrow(ServicoPedidoPainel::naoEncontrado);
                StatusPedido s = StatusPedido.deTexto(atual.status());
                if (s == StatusPedido.AGUARDANDO_PAGAMENTO) {
                    throw ErroNegocio.conflito("PEDIDO_ALTERADO", Textos.PEDIDO_ALTERADO_PELO_CLIENTE, atual);
                }
                if (s == StatusPedido.CANCELADO) {
                    throw ErroNegocio.conflito("PEDIDO_CANCELADO", Textos.PEDIDO_CANCELADO);
                }
                throw ErroNegocio.conflito("PAGAMENTO_JA_CONFIRMADO", Textos.PAGAMENTO_JA_CONFIRMADO, atual);
            }
            return pedidos.buscarPorCodigo(codigo).orElseThrow();
        });
    }

    // ------------------------------------------------ atualizar status (RF12)
    /** Avança PRONTO (a partir de EM_PREPARO) ou ENTREGUE (a partir de PRONTO). */
    public PedidoPainel atualizarStatus(String codigo, String destinoTexto, int idColaborador) {
        exigirCodigo(codigo);
        StatusPedido destino;
        try {
            destino = StatusPedido.deTexto(destinoTexto);
        } catch (RuntimeException e) {
            throw ErroNegocio.invalido("STATUS_INVALIDO", Textos.TRANSICAO_NAO_PERMITIDA);
        }
        if (destino != StatusPedido.PRONTO && destino != StatusPedido.ENTREGUE) {
            // EM_PREPARO só nasce do pagamento; FINALIZADO e CANCELADO têm ações próprias.
            throw ErroNegocio.invalido("STATUS_INVALIDO", Textos.TRANSICAO_NAO_PERMITIDA);
        }
        StatusPedido esperado = destino.anteriorNoCiclo();
        return tx.execute(status -> {
            pedidos.definirColaborador(idColaborador);
            int linhas = pedidos.mudarStatus(codigo, esperado.name(), destino.name());
            if (linhas == 0) {
                PedidoPainel atual = pedidos.buscarPorCodigo(codigo).orElseThrow(ServicoPedidoPainel::naoEncontrado);
                if (StatusPedido.deTexto(atual.status()) == StatusPedido.AGUARDANDO_PAGAMENTO) {
                    throw ErroNegocio.conflito("PAGAMENTO_PENDENTE", Textos.STATUS_COM_PAGAMENTO_PENDENTE);
                }
                throw ErroNegocio.conflito("TRANSICAO_NAO_PERMITIDA", Textos.TRANSICAO_NAO_PERMITIDA, atual);
            }
            return pedidos.buscarPorCodigo(codigo).orElseThrow();
        });
    }

    // ----------------------------------------------------------- cancelar (RF10)
    public PedidoPainel cancelar(String codigo, String justificativaTexto, int idColaborador) {
        exigirCodigo(codigo);
        String justificativa = ValidadorEntrada.texto(justificativaTexto, "justificativa", 255, false);
        return tx.execute(status -> {
            pedidos.definirColaborador(idColaborador);
            var travado = pedidos.travarDoPainel(codigo).orElseThrow(ServicoPedidoPainel::naoEncontrado);
            StatusPedido atual = StatusPedido.deTexto(travado.status());
            if (!atual.cancelavel()) {
                throw ErroNegocio.conflito("CANCELAMENTO_NAO_PERMITIDO", Textos.CANCELAMENTO_NAO_PERMITIDO);
            }
            if (atual.cancelamentoExigeJustificativa() && justificativa == null) {
                throw ErroNegocio.invalido("JUSTIFICATIVA_OBRIGATORIA", Textos.JUSTIFICATIVA_OBRIGATORIA);
            }
            pedidos.cancelar(codigo, atual.name(), justificativa);
            return pedidos.buscarPorCodigo(codigo).orElseThrow();
        });
    }

    // ---------------------------------------------------------- finalizar (RF15)
    public PedidoPainel finalizar(String codigo, String observacaoTexto, int idColaborador) {
        exigirCodigo(codigo);
        String observacao = ValidadorEntrada.texto(observacaoTexto, "observação", 255, false);
        return tx.execute(status -> {
            pedidos.definirColaborador(idColaborador);
            var travado = pedidos.travarDoPainel(codigo).orElseThrow(ServicoPedidoPainel::naoEncontrado);
            StatusPedido atual = StatusPedido.deTexto(travado.status());
            if (atual == StatusPedido.AGUARDANDO_PAGAMENTO) {
                throw ErroNegocio.conflito("FINALIZAR_PAGAMENTO_PENDENTE", Textos.FINALIZAR_COM_PAGAMENTO_PENDENTE);
            }
            if (atual != StatusPedido.ENTREGUE) {
                throw ErroNegocio.conflito("FINALIZAR_STATUS_INVALIDO", Textos.FINALIZAR_STATUS_INVALIDO);
            }
            pedidos.finalizar(codigo, observacao);
            return pedidos.buscarPorCodigo(codigo).orElseThrow();
        });
    }

    // --------------------------------------------- observação interna (RF16)
    public PedidoPainel observacaoInterna(String codigo, String textoBruto, int idColaborador) {
        exigirCodigo(codigo);
        String texto = ValidadorEntrada.texto(textoBruto, "observação", 255, true);
        return tx.execute(status -> {
            pedidos.definirColaborador(idColaborador);
            if (pedidos.registrarObservacaoInterna(codigo, texto) == 0) {
                pedidos.buscarPorCodigo(codigo).orElseThrow(ServicoPedidoPainel::naoEncontrado);
                throw ErroNegocio.conflito("OBSERVACAO_STATUS", Textos.OBSERVACAO_INTERNA_STATUS);
            }
            return pedidos.buscarPorCodigo(codigo).orElseThrow();
        });
    }

    // ------------------------------------------------------------- auxiliares
    private static String exigirCodigo(String codigo) {
        if (!ValidadorEntrada.codigoComFormatoValido(codigo)) {
            throw naoEncontrado();
        }
        return codigo;
    }

    private static ErroNegocio naoEncontrado() {
        return ErroNegocio.naoEncontrado("PEDIDO_NAO_ENCONTRADO", Textos.PEDIDO_NAO_ENCONTRADO);
    }
}
