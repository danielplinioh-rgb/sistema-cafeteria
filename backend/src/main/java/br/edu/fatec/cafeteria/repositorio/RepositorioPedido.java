package br.edu.fatec.cafeteria.repositorio;

import br.edu.fatec.cafeteria.api.dto.Dtos.HistoricoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ItemView;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoPainel;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * RepositorioPedido (camada de dados do diagrama de classes). Só executa SQL;
 * nenhuma regra de negócio mora aqui. As transações são abertas pelos serviços,
 * por isso todas as chamadas de uma operação usam a mesma conexão.
 */
@Repository
public class RepositorioPedido {

    /** Pedido travado por FOR UPDATE: estado lido de forma consistente com a alteração que virá. */
    public record Travado(int idPedido, String status, int versao) {
    }

    /** Pedido recém-criado. */
    public record Criado(int idPedido, String codigo, UUID token) {
    }

    private final JdbcTemplate jdbc;

    public RepositorioPedido(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ------------------------------------------------------------------ sessão
    public void definirColaborador(int idColaborador) {
        jdbc.queryForObject(Sql.QUEM_OPERA, String.class, String.valueOf(idColaborador));
    }

    // ---------------------------------------------------------------- criação
    public String proximoCodigo() {
        return jdbc.queryForObject(Sql.PROXIMO_CODIGO, String.class);
    }

    /** Insere o cabeçalho; o token secreto é gerado pelo banco e recuperado em seguida. */
    public Criado inserirPedido(String codigo, String local) {
        Integer id = jdbc.queryForObject(Sql.PEDIDO_INSERIR, Integer.class, codigo, local);
        UUID token = jdbc.queryForObject("SELECT token_acesso FROM pedido WHERE id_pedido = ?", UUID.class, id);
        return new Criado(id, codigo, token);
    }

    public int inserirItem(int idPedido, int idProduto, int quantidade) {
        Integer id = jdbc.queryForObject(Sql.ITEM_INSERIR, Integer.class, idPedido, idProduto, quantidade);
        return id;
    }

    public void inserirObservacaoDoItem(int idItem, int idProduto, int idObservacao) {
        jdbc.update(Sql.ITEM_OBS_INSERIR, idItem, idProduto, idObservacao);
    }

    // ------------------------------------------------------------- alteração
    public void removerItem(int idPedido, int idItem) {
        jdbc.update(Sql.ITEM_REMOVER, idPedido, idItem);
    }

    public void alterarQuantidade(int idPedido, int idItem, int quantidade) {
        jdbc.update(Sql.ITEM_QUANTIDADE, quantidade, idPedido, idItem);
    }

    public void limparObservacoesDoItem(int idItem) {
        jdbc.update(Sql.ITEM_OBS_LIMPAR, idItem);
    }

    public Optional<Travado> travarDoCliente(String codigo, UUID token) {
        List<Travado> r = jdbc.query(Sql.PEDIDO_TRAVAR_CLIENTE,
                (rs, n) -> new Travado(rs.getInt("id_pedido"), rs.getString("status"), rs.getInt("versao")),
                codigo, token);
        return r.stream().findFirst();
    }

    public Optional<Travado> travarDoPainel(String codigo) {
        List<Travado> r = jdbc.query(Sql.PEDIDO_TRAVAR_PAINEL,
                (rs, n) -> new Travado(rs.getInt("id_pedido"), rs.getString("status"), rs.getInt("versao")),
                codigo);
        return r.stream().findFirst();
    }

    // ------------------------------------------------------- ações do painel
    /** @return linhas alteradas (0 = estado/versão não conferem) */
    public int confirmarPagamento(String codigo, int idColaborador, int versao) {
        return jdbc.update(Sql.PAGAMENTO_CONFIRMAR, idColaborador, codigo, versao);
    }

    public int mudarStatus(String codigo, String de, String para) {
        return jdbc.update(Sql.STATUS_AVANCAR, para, codigo, de);
    }

    public int cancelar(String codigo, String statusAtual, String justificativa) {
        return jdbc.update(Sql.PEDIDO_CANCELAR, justificativa, codigo, statusAtual);
    }

    public int finalizar(String codigo, String observacao) {
        return jdbc.update(Sql.PEDIDO_FINALIZAR, observacao, codigo);
    }

    public int registrarObservacaoInterna(String codigo, String observacao) {
        return jdbc.update(Sql.OBSERVACAO_INTERNA, observacao, codigo);
    }

    // ---------------------------------------------------------------- leitura
    public Optional<PedidoPainel> buscarDoCliente(String codigo, UUID token) {
        return carregarUm(Sql.PEDIDO_POR_CODIGO_E_TOKEN, codigo, token);
    }

    public Optional<PedidoPainel> buscarPorCodigo(String codigo) {
        return carregarUm(Sql.PEDIDO_POR_CODIGO, codigo);
    }

    private Optional<PedidoPainel> carregarUm(String sql, Object... args) {
        List<PedidoLinha> linhas = jdbc.query(sql, (rs, n) -> lerPedido(rs), args);
        if (linhas.isEmpty()) {
            return Optional.empty();
        }
        PedidoLinha l = linhas.get(0);
        List<ItemView> itens = jdbc.query(Sql.ITENS_DO_PEDIDO, (rs, n) -> lerItem(rs), l.id());
        return Optional.of(l.pedido().comItens(itens));
    }

    /** Fila do terminal: pedidos em aberto, do mais antigo ao mais novo, já com os itens. */
    public List<PedidoPainel> fila() {
        List<PedidoLinha> linhas = jdbc.query(Sql.FILA, (rs, n) -> lerPedido(rs));
        Map<Integer, List<ItemView>> itensPorPedido = new LinkedHashMap<>();
        jdbc.query(Sql.ITENS_DA_FILA, (ResultSet rs) -> {
            itensPorPedido.computeIfAbsent(rs.getInt("id_pedido"), k -> new ArrayList<>()).add(lerItem(rs));
        });
        List<PedidoPainel> saida = new ArrayList<>();
        for (PedidoLinha l : linhas) {
            saida.add(l.pedido().comItens(itensPorPedido.getOrDefault(l.id(), List.of())));
        }
        return saida;
    }

    public List<HistoricoView> historico() {
        return jdbc.query(Sql.HISTORICO, (rs, n) -> new HistoricoView(
                rs.getString("codigo"),
                rs.getObject("data_hora", OffsetDateTime.class),
                rs.getString("aviso"),
                rs.getString("local_entrega"),
                rs.getBigDecimal("valor_total"),
                rs.getObject("data_pagamento", OffsetDateTime.class),
                rs.getString("justificativa_cancelamento"),
                rs.getString("observacao_interna"),
                rs.getObject("data_encerramento", OffsetDateTime.class),
                rs.getString("encerrado_por")));
    }

    // ------------------------------------------------------------ conversores
    private record PedidoLinha(int id, PedidoPainel pedido) {
    }

    private static PedidoLinha lerPedido(ResultSet rs) throws SQLException {
        PedidoPainel p = new PedidoPainel(
                rs.getString("codigo"),
                rs.getString("status"),
                rs.getBoolean("pagamento_pendente"),
                rs.getString("local_entrega"),
                rs.getBigDecimal("valor_total"),
                rs.getInt("versao"),
                rs.getObject("data_hora", OffsetDateTime.class),
                rs.getObject("data_pagamento", OffsetDateTime.class),
                rs.getString("justificativa_cancelamento"),
                rs.getString("observacao_interna"),
                List.of());
        return new PedidoLinha(rs.getInt("id_pedido"), p);
    }

    private static ItemView lerItem(ResultSet rs) throws SQLException {
        Integer[] ids = (Integer[]) rs.getArray("obs_ids").getArray();
        String[] txt = (String[]) rs.getArray("obs_txt").getArray();
        return new ItemView(rs.getInt("id_item"), rs.getInt("id_produto"), rs.getString("produto"),
                rs.getString("imagem"), rs.getInt("quantidade"), rs.getBigDecimal("preco_unitario"),
                Arrays.asList(ids), Arrays.asList(txt));
    }
}
