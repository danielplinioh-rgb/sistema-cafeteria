package br.edu.fatec.cafeteria.repositorio;

/**
 * TODAS as instruções SQL do sistema, em um só arquivo, sempre com parâmetros "?"
 * (PreparedStatement): o valor do usuário nunca é concatenado ao texto SQL, o que
 * elimina a injeção de SQL (RNF07). Espelham banco/consultas_dao.sql.
 */
final class Sql {

    private Sql() {
    }

    // ---- sessão do banco -------------------------------------------------------
    /** Informa ao banco quem está operando (usado pela trilha de auditoria). Vale só na transação. */
    static final String QUEM_OPERA = "SELECT set_config('app.id_colaborador', ?, true)";
    static final String PING = "SELECT 1";

    // ---- login (RF17) ----------------------------------------------------------
    static final String COLABORADOR_POR_USUARIO =
            "SELECT id_colaborador, nome, usuario, senha_hash FROM colaborador WHERE usuario = ? AND ativo";

    // ---- cardápio (RF02, RF04, RF18) -------------------------------------------
    static final String CARDAPIO =
            "SELECT id_categoria, categoria, id_produto, nome, descricao, preco, disponivel, imagem, "
                    + "observacoes::text AS observacoes FROM v_cardapio ORDER BY categoria, nome";

    static final String PRODUTO_BASICO =
            "SELECT id_produto, nome, disponivel, ativo FROM produto WHERE id_produto = ?";

    static final String PRODUTO_ACEITA_OBSERVACAO =
            "SELECT COUNT(*) FROM produto_observacao WHERE id_produto = ? AND id_observacao = ?";

    // ---- gestão de produtos (ProdutoController) --------------------------------
    static final String PRODUTOS_PAINEL =
            "SELECT p.id_produto, p.id_categoria, c.nome AS categoria, p.nome, p.descricao, p.preco, "
                    + "p.disponivel, p.imagem, "
                    + "ARRAY(SELECT po.id_observacao FROM produto_observacao po WHERE po.id_produto = p.id_produto "
                    + "ORDER BY 1) AS obs_ids "
                    + "FROM produto p JOIN categoria c ON c.id_categoria = p.id_categoria "
                    + "WHERE p.ativo ORDER BY c.nome, p.nome";

    static final String CATEGORIAS = "SELECT id_categoria, nome FROM categoria ORDER BY nome";
    static final String OBSERVACOES = "SELECT id_observacao, descricao FROM observacao_predefinida ORDER BY descricao";

    static final String PRODUTO_INSERIR =
            "INSERT INTO produto (id_categoria, nome, descricao, preco, disponivel, imagem) "
                    + "VALUES (?, ?, ?, ?, TRUE, ?) RETURNING id_produto";
    static final String PRODUTO_ATUALIZAR =
            "UPDATE produto SET nome = ?, descricao = ?, preco = ?, imagem = ?, id_categoria = ? "
                    + "WHERE id_produto = ? AND ativo";
    static final String PRODUTO_DISPONIBILIDADE =
            "UPDATE produto SET disponivel = ? WHERE id_produto = ? AND ativo";
    /** Exclusão LÓGICA [A10]: nunca DELETE, pois há pedidos antigos que apontam para o produto. */
    static final String PRODUTO_REMOVER =
            "UPDATE produto SET ativo = FALSE, disponivel = FALSE WHERE id_produto = ? AND ativo";
    static final String PRODUTO_OBS_LIMPAR = "DELETE FROM produto_observacao WHERE id_produto = ?";
    static final String PRODUTO_OBS_INSERIR =
            "INSERT INTO produto_observacao (id_produto, id_observacao) VALUES (?, ?)";
    static final String PRODUTO_PEDIDOS_PENDENTES =
            "SELECT COUNT(DISTINCT pe.id_pedido) FROM item_pedido i JOIN pedido pe ON pe.id_pedido = i.id_pedido "
                    + "WHERE i.id_produto = ? AND pe.status NOT IN ('FINALIZADO','CANCELADO')";

    // ---- criação do pedido (RF05, RF06) ----------------------------------------
    static final String PROXIMO_CODIGO = "SELECT proximo_codigo_pedido()";
    static final String PEDIDO_INSERIR =
            "INSERT INTO pedido (codigo, local_entrega) VALUES (?, ?) RETURNING id_pedido";
    /** O 0 em preco_unitario é ignorado: o banco copia produto.preco (impede preço adulterado). */
    static final String ITEM_INSERIR =
            "INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) "
                    + "VALUES (?, ?, ?, 0) RETURNING id_item";
    static final String ITEM_OBS_INSERIR =
            "INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao) VALUES (?, ?, ?)";

    // ---- leitura de pedidos ----------------------------------------------------
    private static final String PEDIDO_COLUNAS =
            "id_pedido, codigo, status, (status = 'AGUARDANDO_PAGAMENTO') AS pagamento_pendente, local_entrega, "
                    + "valor_total, versao, data_hora, data_pagamento, justificativa_cancelamento, observacao_interna";

    /** Cliente: código + token (RNF07). Token errado e código inexistente são indistinguíveis. */
    static final String PEDIDO_POR_CODIGO_E_TOKEN =
            "SELECT " + PEDIDO_COLUNAS + " FROM pedido WHERE codigo = ? AND token_acesso = ?::uuid";
    static final String PEDIDO_POR_CODIGO =
            "SELECT " + PEDIDO_COLUNAS + " FROM pedido WHERE codigo = ?";

    private static final String ITENS_BASE =
            "SELECT i.id_pedido, i.id_item, i.id_produto, p.nome AS produto, p.imagem, i.quantidade, "
                    + "i.preco_unitario, "
                    + "ARRAY(SELECT io.id_observacao FROM item_pedido_observacao io WHERE io.id_item = i.id_item "
                    + "ORDER BY 1) AS obs_ids, "
                    + "ARRAY(SELECT o.descricao FROM item_pedido_observacao io "
                    + "JOIN observacao_predefinida o ON o.id_observacao = io.id_observacao "
                    + "WHERE io.id_item = i.id_item ORDER BY o.descricao) AS obs_txt "
                    + "FROM item_pedido i JOIN produto p ON p.id_produto = i.id_produto ";
    static final String ITENS_DO_PEDIDO = ITENS_BASE + "WHERE i.id_pedido = ? ORDER BY i.id_item";
    static final String ITENS_DA_FILA = ITENS_BASE
            + "JOIN pedido pe ON pe.id_pedido = i.id_pedido "
            + "WHERE pe.status NOT IN ('FINALIZADO','CANCELADO') ORDER BY i.id_pedido, i.id_item";

    /** Fila do terminal (RF07): usa a view; os itens vêm da consulta ITENS_DA_FILA. */
    static final String FILA =
            "SELECT id_pedido, codigo, status, pagamento_pendente, local_entrega, valor_total, versao, data_hora, "
                    + "NULL::timestamptz AS data_pagamento, NULL::varchar AS justificativa_cancelamento, "
                    + "NULL::varchar AS observacao_interna FROM v_pedidos_pendentes";
    static final String HISTORICO =
            "SELECT codigo, data_hora, aviso, local_entrega, valor_total, data_pagamento, "
                    + "justificativa_cancelamento, observacao_interna, data_encerramento, encerrado_por "
                    + "FROM v_historico_pedidos ORDER BY data_hora DESC LIMIT 200";

    // ---- alteração pelo cliente (RF08) -----------------------------------------
    /** Trava o pedido: serializa com "confirmar pagamento" (RF08 x RF09). */
    static final String PEDIDO_TRAVAR_CLIENTE =
            "SELECT id_pedido, status, versao FROM pedido WHERE codigo = ? AND token_acesso = ?::uuid FOR UPDATE";
    static final String ITEM_REMOVER = "DELETE FROM item_pedido WHERE id_pedido = ? AND id_item = ?";
    static final String ITEM_QUANTIDADE = "UPDATE item_pedido SET quantidade = ? WHERE id_pedido = ? AND id_item = ?";
    static final String ITEM_OBS_LIMPAR = "DELETE FROM item_pedido_observacao WHERE id_item = ?";

    // ---- ações do colaborador --------------------------------------------------
    static final String PEDIDO_TRAVAR_PAINEL =
            "SELECT id_pedido, status, versao FROM pedido WHERE codigo = ? FOR UPDATE";
    static final String PAGAMENTO_CONFIRMAR =
            "UPDATE pedido SET status = 'EM_PREPARO', data_pagamento = now(), id_colaborador_pagamento = ? "
                    + "WHERE codigo = ? AND status = 'AGUARDANDO_PAGAMENTO' AND versao = ?";
    static final String STATUS_AVANCAR =
            "UPDATE pedido SET status = ? WHERE codigo = ? AND status = ?";
    static final String PEDIDO_CANCELAR =
            "UPDATE pedido SET status = 'CANCELADO', justificativa_cancelamento = ? WHERE codigo = ? AND status = ?";
    static final String PEDIDO_FINALIZAR =
            "UPDATE pedido SET status = 'FINALIZADO', observacao_interna = ? WHERE codigo = ? AND status = 'ENTREGUE'";
    static final String OBSERVACAO_INTERNA =
            "UPDATE pedido SET observacao_interna = ? WHERE codigo = ? AND status IN ('FINALIZADO','CANCELADO')";
}
