package br.edu.fatec.cafeteria.api.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Formatos JSON da API (entrada e saída), reunidos em um só lugar.
 *
 * <p>Contrato estrito: campos desconhecidos na entrada são recusados
 * ({@code fail-on-unknown-properties}). Preço, total e status NUNCA são aceitos do
 * cliente: o servidor e o banco calculam (RNF07).
 */
public final class Dtos {

    private Dtos() {
    }

    // ============================== ENTRADA ======================================

    /** Item enviado pelo cliente. {@code idItem} só é usado na alteração (item já existente). */
    public record ItemEntrada(Integer idItem, int idProduto, int quantidade, List<Integer> observacoes) {
    }

    /** Criar ou alterar pedido. {@code tipo}: MESA ou BALCAO. */
    public record PedidoEntrada(String tipo, Integer mesa, List<ItemEntrada> itens) {
    }

    public record LoginEntrada(String usuario, String senha) {
    }

    public record PagamentoEntrada(int versao) {
    }

    public record StatusEntrada(String para) {
    }

    public record TextoEntrada(String texto) {
    }

    public record DisponibilidadeEntrada(boolean disponivel) {
    }

    public record ProdutoEntrada(int idCategoria, String nome, String descricao, BigDecimal preco,
                                 String imagem, List<Integer> observacoes) {
    }

    // ============================== SAÍDA ========================================

    public record ItemView(Integer idItem, Integer idProduto, String produto, String imagem, int quantidade,
                           BigDecimal precoUnitario, List<Integer> idObservacoes, List<String> observacoes) {
    }

    /** Visão completa (uso interno e do painel). */
    public record PedidoPainel(String codigo, String status, boolean pagamentoPendente, String local,
                               BigDecimal valorTotal, int versao, OffsetDateTime dataHora,
                               OffsetDateTime dataPagamento, String justificativaCancelamento,
                               String observacaoInterna, List<ItemView> itens) {
        public PedidoPainel comItens(List<ItemView> novos) {
            return new PedidoPainel(codigo, status, pagamentoPendente, local, valorTotal, versao, dataHora,
                    dataPagamento, justificativaCancelamento, observacaoInterna, novos);
        }

        /** Visão do cliente: sem dados internos (observação interna, quem pagou, justificativa). */
        public PedidoCliente paraCliente() {
            return new PedidoCliente(codigo, status, local, valorTotal, versao, dataHora, itens);
        }
    }

    public record PedidoCliente(String codigo, String status, String local, BigDecimal valorTotal, int versao,
                                OffsetDateTime dataHora, List<ItemView> itens) {
    }

    /** Resposta da criação: inclui o token secreto que o navegador guarda (RNF07). */
    public record PedidoCriado(String token, PedidoCliente pedido) {
    }

    public record HistoricoView(String codigo, OffsetDateTime dataHora, String aviso, String local,
                                BigDecimal valorTotal, OffsetDateTime dataPagamento,
                                String justificativaCancelamento, String observacaoInterna,
                                OffsetDateTime dataEncerramento, String encerradoPor) {
    }

    public record ObservacaoView(int id, String descricao) {
    }

    public record ProdutoCardapio(int idProduto, String nome, String descricao, BigDecimal preco,
                                  boolean disponivel, String imagem, List<ObservacaoView> observacoes) {
    }

    public record CategoriaCardapio(int idCategoria, String nome, List<ProdutoCardapio> produtos) {
    }

    public record CategoriaView(int idCategoria, String nome) {
    }

    /** Produto na visão de gestão do painel. */
    public record ProdutoPainel(int idProduto, int idCategoria, String categoria, String nome, String descricao,
                                BigDecimal preco, boolean disponivel, String imagem, List<Integer> idObservacoes) {
    }

    public record SessaoView(String nome, String usuario) {
    }

    public record ContagemView(int pedidosPendentes) {
    }
}
