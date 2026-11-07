package br.edu.fatec.cafeteria.repositorio;

import br.edu.fatec.cafeteria.api.dto.Dtos.CategoriaView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ObservacaoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoPainel;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Dados do cardápio: categorias, produtos e observações pré-definidas (ProdutoController / RF18). */
@Repository
public class RepositorioCardapio {

    /** Linha do cardápio público já lida (uma por produto). */
    public record LinhaCardapio(int idCategoria, String categoria, int idProduto, String nome, String descricao,
                                BigDecimal preco, boolean disponivel, String imagem,
                                List<ObservacaoView> observacoes) {
    }

    public record ProdutoBasico(int idProduto, String nome, boolean disponivel, boolean ativo) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public RepositorioCardapio(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void verificarBanco() {
        jdbc.queryForObject(Sql.PING, Integer.class);
    }

    public List<LinhaCardapio> cardapio() {
        return jdbc.query(Sql.CARDAPIO, (rs, n) -> new LinhaCardapio(
                rs.getInt("id_categoria"), rs.getString("categoria"), rs.getInt("id_produto"),
                rs.getString("nome"), rs.getString("descricao"), rs.getBigDecimal("preco"),
                rs.getBoolean("disponivel"), rs.getString("imagem"), lerObservacoes(rs.getString("observacoes"))));
    }

    private List<ObservacaoView> lerObservacoes(String texto) {
        List<ObservacaoView> lista = new ArrayList<>();
        try {
            JsonNode raiz = json.readTree(texto);
            for (JsonNode no : raiz) {
                lista.add(new ObservacaoView(no.get("id_observacao").asInt(), no.get("descricao").asText()));
            }
        } catch (Exception e) {
            throw new IllegalStateException("Observações do cardápio em formato inesperado", e);
        }
        return lista;
    }

    public Optional<ProdutoBasico> produtoBasico(int idProduto) {
        return jdbc.query(Sql.PRODUTO_BASICO, (rs, n) -> new ProdutoBasico(rs.getInt("id_produto"),
                rs.getString("nome"), rs.getBoolean("disponivel"), rs.getBoolean("ativo")), idProduto)
                .stream().findFirst();
    }

    public boolean produtoAceitaObservacao(int idProduto, int idObservacao) {
        Integer n = jdbc.queryForObject(Sql.PRODUTO_ACEITA_OBSERVACAO, Integer.class, idProduto, idObservacao);
        return n != null && n > 0;
    }

    // ---------------------------------------------------------- painel
    public List<ProdutoPainel> produtosDoPainel() {
        return jdbc.query(Sql.PRODUTOS_PAINEL, (rs, n) -> new ProdutoPainel(
                rs.getInt("id_produto"), rs.getInt("id_categoria"), rs.getString("categoria"), rs.getString("nome"),
                rs.getString("descricao"), rs.getBigDecimal("preco"), rs.getBoolean("disponivel"),
                rs.getString("imagem"), Arrays.asList((Integer[]) rs.getArray("obs_ids").getArray())));
    }

    public List<CategoriaView> categorias() {
        return jdbc.query(Sql.CATEGORIAS, (rs, n) -> new CategoriaView(rs.getInt("id_categoria"), rs.getString("nome")));
    }

    public List<ObservacaoView> observacoes() {
        return jdbc.query(Sql.OBSERVACOES, (rs, n) -> new ObservacaoView(rs.getInt("id_observacao"), rs.getString("descricao")));
    }

    public int inserirProduto(int idCategoria, String nome, String descricao, BigDecimal preco, String imagem) {
        Integer id = jdbc.queryForObject(Sql.PRODUTO_INSERIR, Integer.class, idCategoria, nome, descricao, preco, imagem);
        return id;
    }

    public int atualizarProduto(int id, int idCategoria, String nome, String descricao, BigDecimal preco, String imagem) {
        return jdbc.update(Sql.PRODUTO_ATUALIZAR, nome, descricao, preco, imagem, idCategoria, id);
    }

    public void substituirObservacoes(int idProduto, List<Integer> idsObservacao) {
        jdbc.update(Sql.PRODUTO_OBS_LIMPAR, idProduto);
        for (Integer obs : idsObservacao) {
            jdbc.update(Sql.PRODUTO_OBS_INSERIR, idProduto, obs);
        }
    }

    public int alterarDisponibilidade(int idProduto, boolean disponivel) {
        return jdbc.update(Sql.PRODUTO_DISPONIBILIDADE, disponivel, idProduto);
    }

    public int removerLogicamente(int idProduto) {
        return jdbc.update(Sql.PRODUTO_REMOVER, idProduto);
    }

    public int pedidosPendentesComProduto(int idProduto) {
        Integer n = jdbc.queryForObject(Sql.PRODUTO_PEDIDOS_PENDENTES, Integer.class, idProduto);
        return n == null ? 0 : n;
    }
}
