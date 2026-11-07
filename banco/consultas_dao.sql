-- ============================================================================
--  cafeteria_db | CONSULTAS PRINCIPAIS PARA OS DAOs (Java / JDBC)
--  Referência de uso do banco por caso de uso. Os "?" são parâmetros de
--  PreparedStatement (protege contra SQL Injection, RNF07).
--  Este arquivo é documentação: não é para ser executado de uma vez.
--
--  Regras gerais
--    * Toda operação que muda dados roda em UMA transação (auto-commit desligado).
--    * Em transações de colaborador, a primeira instrução é:
--        SELECT set_config('app.id_colaborador', ?, true);     -- id do logado
--    * Operações do cliente identificam o pedido por (codigo + token_acesso).
--    * Violações de regra chegam como SQLState 23514 (check_violation) ou
--      23503/23505 (FK/unique); a mensagem em português pode ser mostrada ao usuário.
--    * valor_total, versao e preco_unitario são mantidos pelo banco: não envie.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- RF17 | Realizar Login (ColaboradorDAO)
-- A senha é conferida na aplicação (BCrypt / Spring Security), nunca no SQL.
-- ---------------------------------------------------------------------------
SELECT id_colaborador, nome, senha_hash
  FROM colaborador
 WHERE usuario = ? AND ativo;


-- ---------------------------------------------------------------------------
-- RF02, RF04, RF18 | Visualizar Cardápio (ProdutoDAO)
-- Indisponíveis vêm junto (disponivel = FALSE) para ficarem cinza.
-- ---------------------------------------------------------------------------
SELECT * FROM v_cardapio ORDER BY categoria, nome;


-- ---------------------------------------------------------------------------
-- RF06, RNF06 | Realizar Pedido — Pedido.gerarCodigo() / registrarPedido()
-- Uma transação. Preço, disponibilidade e total são tratados pelo banco.
-- ---------------------------------------------------------------------------
-- BEGIN;
SELECT proximo_codigo_pedido();                                      -- gerarCodigo()

INSERT INTO pedido (codigo, local_entrega)
VALUES (?, ?)                                  -- 'Mesa 5' ou 'Retirada no Balcão'
RETURNING id_pedido, codigo, token_acesso;     -- token_acesso: guardar no dispositivo

INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
VALUES (?, ?, ?, 0)                            -- 0 é ignorado: o banco copia produto.preco
RETURNING id_item;                             -- falha se produto indisponível/inativo

INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao)
VALUES (?, ?, ?);                              -- falha se o produto não aceita a observação
-- COMMIT;   -- aqui são conferidos: >= 1 item e valor_total = soma dos itens


-- ---------------------------------------------------------------------------
-- RF13, RF14 | Acompanhar Status (cliente) — polling a cada 3–5 s (ou SSE)
-- Na interface, FINALIZADO deve ser exibido como "Entregue" (RF13 não o lista).
-- ---------------------------------------------------------------------------
SELECT codigo, status, local_entrega, valor_total
  FROM pedido
 WHERE codigo = ? AND token_acesso = ?::uuid;


-- ---------------------------------------------------------------------------
-- RF08 | Alterar Pedido Pendente (cliente) [A2]
-- Uma transação; aplicar apenas as DIFERENÇAS (não apagar e reinserir tudo),
-- para que itens mantidos preservem o preço original mesmo se o cadastro mudou.
-- ---------------------------------------------------------------------------
-- BEGIN;
SELECT id_pedido, status, versao
  FROM pedido
 WHERE codigo = ? AND token_acesso = ?::uuid
   FOR UPDATE;                         -- trava o pedido; serializa com "confirmar pagamento"
-- Se status <> 'AGUARDANDO_PAGAMENTO': ROLLBACK e exibir
-- "Alterações não são permitidas após a confirmação do pagamento".

DELETE FROM item_pedido WHERE id_pedido = ? AND id_item = ?;                -- item removido
UPDATE item_pedido SET quantidade = ? WHERE id_pedido = ? AND id_item = ?;  -- quantidade alterada
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
VALUES (?, ?, ?, 0) RETURNING id_item;                                      -- item novo
DELETE FROM item_pedido_observacao WHERE id_item = ?;                       -- trocar observações
INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao) VALUES (?, ?, ?);
-- COMMIT;   -- valor_total e versao já foram atualizados pelo banco; o código não muda

-- Falha de comunicação: ROLLBACK -> dados anteriores preservados ("A alteração não pôde ser concluída").


-- ---------------------------------------------------------------------------
-- RF07 | Fila do terminal do colaborador (PedidoDAO)
-- ---------------------------------------------------------------------------
SELECT * FROM v_pedidos_pendentes;


-- ---------------------------------------------------------------------------
-- RF09, RF11 | Confirmar Pagamento [A3]
-- Informar a "versao" que o terminal exibiu. Se o cliente alterou o pedido
-- no meio tempo, 0 linhas são atualizadas.
-- ---------------------------------------------------------------------------
-- BEGIN;
SELECT set_config('app.id_colaborador', ?, true);

UPDATE pedido
   SET status = 'EM_PREPARO',
       data_pagamento = now(),
       id_colaborador_pagamento = ?
 WHERE codigo = ?
   AND status = 'AGUARDANDO_PAGAMENTO'
   AND versao = ?
RETURNING codigo, status, valor_total;
-- COMMIT;

-- Se retornou 0 linhas, descobrir o motivo e responder ao colaborador:
SELECT status, versao, valor_total FROM pedido WHERE codigo = ?;
--   status = AGUARDANDO_PAGAMENTO e versao diferente
--       -> cenário "Pedido alterado pelo cliente antes da confirmação":
--          recarregar o pedido e exibir "O pedido foi alterado pelo cliente. Confira os itens
--          e o novo valor total antes de confirmar o pagamento."
--   status <> AGUARDANDO_PAGAMENTO -> pagamento já confirmado ou pedido cancelado.


-- ---------------------------------------------------------------------------
-- RF12 | Atualizar Status do Pedido (Em preparo -> Pronto -> Entregue)
-- A guarda "AND status = <esperado>" evita atualização concorrente/duplicada.
-- ---------------------------------------------------------------------------
-- BEGIN;
SELECT set_config('app.id_colaborador', ?, true);
UPDATE pedido SET status = 'PRONTO'   WHERE codigo = ? AND status = 'EM_PREPARO';
UPDATE pedido SET status = 'ENTREGUE' WHERE codigo = ? AND status = 'PRONTO';
-- COMMIT;
-- Tentar mudar um pedido AGUARDANDO_PAGAMENTO para EM_PREPARO sem confirmar o pagamento
-- é recusado (ck_pedido_pagamento): exibir "Não é possível alterar o status de um pedido
-- com pagamento pendente".


-- ---------------------------------------------------------------------------
-- RF10, RF16 | Cancelar Pedido
-- ---------------------------------------------------------------------------
-- (a) Pagamento pendente: justificativa opcional.
-- BEGIN;
SELECT set_config('app.id_colaborador', ?, true);
UPDATE pedido SET status = 'CANCELADO'
 WHERE codigo = ? AND status = 'AGUARDANDO_PAGAMENTO';
-- COMMIT;

-- (b) Em preparo ou Pronto (já pago): justificativa OBRIGATÓRIA (ck_pedido_justificativa).
-- BEGIN;
SELECT set_config('app.id_colaborador', ?, true);
UPDATE pedido SET status = 'CANCELADO', justificativa_cancelamento = ?
 WHERE codigo = ? AND status IN ('EM_PREPARO','PRONTO');
-- COMMIT;
-- Pedido ENTREGUE/FINALIZADO não pode ser cancelado (transição recusada pelo banco):
-- exibir "Operação não permitida: o pedido não pode ser cancelado no status atual".


-- ---------------------------------------------------------------------------
-- RF15, RF16 | Finalizar Pedido — somente a partir de ENTREGUE [A5]
-- ---------------------------------------------------------------------------
-- BEGIN;
SELECT set_config('app.id_colaborador', ?, true);
UPDATE pedido SET status = 'FINALIZADO', observacao_interna = ?     -- observação opcional
 WHERE codigo = ? AND status = 'ENTREGUE';
-- COMMIT;

-- RF16 | Registrar observação interna depois de finalizar/cancelar
UPDATE pedido SET observacao_interna = ?
 WHERE codigo = ? AND status IN ('FINALIZADO','CANCELADO');

-- Histórico (pedidos finalizados e cancelados, com aviso)
SELECT * FROM v_historico_pedidos ORDER BY data_hora DESC;

-- Trilha de auditoria de um pedido
SELECT h.status_anterior, h.status_novo, h.data_hora, c.nome AS colaborador
  FROM historico_status h
  LEFT JOIN colaborador c ON c.id_colaborador = h.id_colaborador
 WHERE h.id_pedido = (SELECT id_pedido FROM pedido WHERE codigo = ?)
 ORDER BY h.id_historico;


-- ---------------------------------------------------------------------------
-- RF18 | Alterar Disponibilidade de Produto (ProdutoController)
-- ---------------------------------------------------------------------------
-- Aviso do cenário "Produto constando em pedidos pendentes":
SELECT COUNT(DISTINCT pe.id_pedido) AS pedidos_pendentes_com_o_produto
  FROM item_pedido i
  JOIN pedido pe ON pe.id_pedido = i.id_pedido
 WHERE i.id_produto = ?
   AND pe.status NOT IN ('FINALIZADO','CANCELADO');

UPDATE produto SET disponivel = ? WHERE id_produto = ? AND ativo;
-- Pedidos já registrados não são afetados; só novas seleções ficam bloqueadas.


-- ---------------------------------------------------------------------------
-- ProdutoController | adicionar / atualizar / "remover" produto [A10]
-- ---------------------------------------------------------------------------
INSERT INTO produto (id_categoria, nome, descricao, preco, disponivel, imagem)
VALUES (?, ?, ?, ?, TRUE, ?);

UPDATE produto SET nome = ?, descricao = ?, preco = ?, imagem = ?, id_categoria = ?
 WHERE id_produto = ?;               -- itens de pedidos antigos mantêm o preço original

-- removerProduto(): exclusão LÓGICA (não use DELETE: há histórico de pedidos).
UPDATE produto SET ativo = FALSE, disponivel = FALSE WHERE id_produto = ?;
