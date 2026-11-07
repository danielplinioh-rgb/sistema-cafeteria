-- ============================================================================
--  cafeteria_db | TESTES DAS REGRAS DO BANCO
--  Executar depois de schema.sql e seed_dev.sql, num banco de DESENVOLVIMENTO:
--    psql -d cafeteria_db -v ON_ERROR_STOP=1 -f teste_regras.sql
--  Tudo roda dentro de uma transação que termina em ROLLBACK (nada é gravado,
--  exceto o consumo de números da sequência). Cada linha "ok" é uma regra
--  verificada; qualquer falha interrompe o script com a mensagem "FALHOU".
-- ============================================================================
BEGIN;

-- ---- utilitários de teste (existem só durante esta sessão) -----------------
CREATE FUNCTION pg_temp.verificar(p_cond BOOLEAN, p_msg TEXT) RETURNS VOID AS $$
BEGIN
    IF p_cond IS NOT TRUE THEN
        RAISE EXCEPTION 'FALHOU: %', p_msg;
    END IF;
    RAISE NOTICE 'ok   - %', p_msg;
END;
$$ LANGUAGE plpgsql;

-- Executa o SQL e confere o COMMIT simulado; espera ser recusado com o trecho informado.
CREATE FUNCTION pg_temp.deve_falhar(p_sql TEXT, p_trecho TEXT, p_msg TEXT) RETURNS VOID AS $$
DECLARE
    v_erro TEXT;
BEGIN
    BEGIN
        EXECUTE p_sql;
        EXECUTE 'SET CONSTRAINTS ALL IMMEDIATE';
    EXCEPTION WHEN OTHERS THEN
        v_erro := SQLERRM;
    END;
    IF v_erro IS NULL THEN
        RAISE EXCEPTION 'FALHOU (deveria ser recusado): %', p_msg;
    END IF;
    IF position(p_trecho IN v_erro) = 0 THEN
        RAISE EXCEPTION 'FALHOU (erro inesperado "%"): %', v_erro, p_msg;
    END IF;
    RAISE NOTICE 'ok   - %  [%]', p_msg, left(v_erro, 60);
END;
$$ LANGUAGE plpgsql;

-- Simula o COMMIT: confere as regras adiadas e volta ao modo adiado.
CREATE FUNCTION pg_temp.commit_simulado() RETURNS VOID AS $$
BEGIN
    EXECUTE 'SET CONSTRAINTS ALL IMMEDIATE';
    EXECUTE 'SET CONSTRAINTS ALL DEFERRED';
END;
$$ LANGUAGE plpgsql;

-- Cria um pedido (Mesa/Balcão) com um item do produto informado.
CREATE FUNCTION pg_temp.novo_pedido(p_local TEXT, p_produto TEXT, p_qtd INT) RETURNS VARCHAR AS $$
DECLARE
    v_codigo VARCHAR;
    v_id     INT;
BEGIN
    INSERT INTO pedido (codigo, local_entrega)
    VALUES (proximo_codigo_pedido(), p_local) RETURNING codigo, id_pedido INTO v_codigo, v_id;
    INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
    SELECT v_id, id_produto, p_qtd, 0 FROM produto WHERE nome = p_produto;
    PERFORM pg_temp.commit_simulado();
    RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.id_pedido(p_codigo TEXT) RETURNS INT AS $$
    SELECT id_pedido FROM pedido WHERE codigo = p_codigo;
$$ LANGUAGE sql;

CREATE FUNCTION pg_temp.id_produto(p_nome TEXT) RETURNS INT AS $$
    SELECT id_produto FROM produto WHERE nome = p_nome;
$$ LANGUAGE sql;

CREATE TEMP TABLE ctx (chave TEXT PRIMARY KEY, valor TEXT);

-- colaborador "logado" nesta transação (convenção app.id_colaborador)
SELECT set_config('app.id_colaborador',
                  (SELECT id_colaborador::TEXT FROM colaborador WHERE usuario = 'ana.souza'), true);

-- ============================================================================
-- 1. Seed e criação do pedido (RF05, RF06, RF07, RNF06)
-- ============================================================================
SELECT pg_temp.verificar((SELECT valor_total FROM pedido WHERE codigo = 'PED-0001') = 22.00,
       'Seed = Fig. 3: PED-0001 = 2 x 8,50 + 1 x 5,00 = 22,00 (total calculado pelo banco)');

INSERT INTO ctx VALUES ('p1', pg_temp.novo_pedido('Mesa 7', 'Café Gelado', 2));
SELECT pg_temp.verificar((SELECT valor ~ '^PED-[0-9]{4,}$' FROM ctx WHERE chave = 'p1'),
       'Código gerado pela sequência no formato PED-0000');
SELECT pg_temp.verificar((SELECT status = 'AGUARDANDO_PAGAMENTO' AND valor_total = 18.00 AND token_acesso IS NOT NULL
                            FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Pedido nasce AGUARDANDO_PAGAMENTO, total 18,00 e token_acesso gerado');
SELECT pg_temp.verificar((SELECT COUNT(*) = 1 FROM historico_status
                           WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))),
       'Auditoria: criação registrada automaticamente em historico_status');

SELECT pg_temp.deve_falhar($$INSERT INTO pedido (local_entrega) VALUES ('Mesa 1')$$,
       'ao menos um item', 'Pedido sem itens é recusado no COMMIT (1..*)');
SELECT pg_temp.deve_falhar($$INSERT INTO pedido (codigo, local_entrega) VALUES ('PED-0001', 'Mesa 1')$$,
       'duplicate key', 'Código duplicado é recusado (UNIQUE, RNF06)');
SELECT pg_temp.deve_falhar($$INSERT INTO pedido (local_entrega, status) VALUES ('Mesa 1', 'EM_PREPARO')$$,
       'AGUARDANDO_PAGAMENTO', 'Pedido não pode ser criado já em preparo');
SELECT pg_temp.deve_falhar($$INSERT INTO pedido (local_entrega) VALUES ('Mesa 0')$$,
       'ck_pedido_local', 'Local de entrega inválido (Mesa 0) é recusado');
SELECT pg_temp.deve_falhar($$INSERT INTO pedido (local_entrega) VALUES ('Balcão')$$,
       'ck_pedido_local', 'Local de entrega fora do padrão é recusado');

-- ============================================================================
-- 2. Itens: preço, disponibilidade e observações (RF02, RF04, RF18)
-- ============================================================================
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
SELECT pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1')), pg_temp.id_produto('Alfajor'), 1, 0.01;
SELECT pg_temp.verificar((SELECT preco_unitario = 12.00 FROM item_pedido
                           WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))
                             AND id_produto = pg_temp.id_produto('Alfajor')),
       'Preço enviado pelo cliente (0,01) é ignorado: vale produto.preco (12,00)');
SELECT pg_temp.commit_simulado();

SELECT pg_temp.deve_falhar(
       format($$INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES (%s, %s, 1, 0)$$,
              pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1')), pg_temp.id_produto('Chá Preto')),
       'indisponível', 'Produto indisponível não pode ser adicionado (RF18)');

SELECT pg_temp.deve_falhar($$INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
        VALUES (1, 1, 0, 0)$$, 'quantidade_check', 'Quantidade zero é recusada');

-- Café Gelado aceita "Com pouco gelo", mas não "Extra quente"
INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao)
SELECT i.id_item, i.id_produto, o.id_observacao
  FROM item_pedido i, observacao_predefinida o
 WHERE i.id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))
   AND i.id_produto = pg_temp.id_produto('Café Gelado') AND o.descricao = 'Com pouco gelo';
SELECT pg_temp.verificar(TRUE, 'Observação da lista fechada aceita pelo produto é gravada');

SELECT pg_temp.deve_falhar($$
    INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao)
    SELECT i.id_item, i.id_produto, o.id_observacao
      FROM item_pedido i, observacao_predefinida o
     WHERE i.id_pedido = (SELECT id_pedido FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1'))
       AND i.id_produto = (SELECT id_produto FROM produto WHERE nome = 'Café Gelado')
       AND o.descricao = 'Extra quente'$$,
       'foreign key', 'Observação não aceita pelo produto é recusada (FK composta)');

-- ============================================================================
-- 3. Alteração de pedido pendente (RF08) e versão (cenário de "Confirmar Pagamento")
-- ============================================================================
INSERT INTO ctx
SELECT 'v_inicial', versao::TEXT FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1');

INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
SELECT pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1')), pg_temp.id_produto('Cappuccino'), 1, 0;
SELECT pg_temp.commit_simulado();
SELECT pg_temp.verificar((SELECT valor_total = 18.00 + 12.00 + 8.50 FROM pedido
                           WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Alteração: total recalculado pelo banco (18,00 + 12,00 + 8,50 = 38,50), mesmo código');
SELECT pg_temp.verificar((SELECT versao > (SELECT valor::INT FROM ctx WHERE chave = 'v_inicial') FROM pedido
                           WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Alteração incrementa a versão do pedido');

UPDATE item_pedido SET quantidade = 3
 WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))
   AND id_produto = pg_temp.id_produto('Alfajor');
SELECT pg_temp.commit_simulado();
SELECT pg_temp.verificar((SELECT valor_total = 18.00 + 36.00 + 8.50 FROM pedido
                           WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Alteração de quantidade atualiza o total (18,00 + 36,00 + 8,50 = 62,50)');

SELECT pg_temp.deve_falhar($$
    UPDATE pedido SET valor_total = 1 WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')$$,
       'diverge da soma', 'valor_total não pode divergir da soma dos itens');

-- Pedido de um único item: não pode ficar vazio
INSERT INTO ctx VALUES ('p_unico', pg_temp.novo_pedido('Retirada no Balcão', 'Café Expresso', 1));
SELECT pg_temp.deve_falhar(
       format($$DELETE FROM item_pedido WHERE id_pedido = %s$$, pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p_unico'))),
       'ao menos um item', 'Remover o último item é recusado (cancelar é outro caso de uso)');

-- ============================================================================
-- 4. Confirmar pagamento com controle de versão (RF09, RF11)
-- ============================================================================
DO $$
DECLARE
    v_codigo TEXT := (SELECT valor FROM ctx WHERE chave = 'p1');
    v_vista  INT;
    v_n      INT;
BEGIN
    SELECT versao INTO v_vista FROM pedido WHERE codigo = v_codigo;      -- o que o terminal exibiu

    -- o cliente altera o pedido ANTES da confirmação
    INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
    SELECT pg_temp.id_pedido(v_codigo), pg_temp.id_produto('Café Expresso'), 1, 0;
    PERFORM pg_temp.commit_simulado();

    UPDATE pedido SET status = 'EM_PREPARO', data_pagamento = now(),
           id_colaborador_pagamento = (SELECT id_colaborador FROM colaborador WHERE usuario = 'ana.souza')
     WHERE codigo = v_codigo AND status = 'AGUARDANDO_PAGAMENTO' AND versao = v_vista;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.verificar(v_n = 0,
        'Confirmar com a versão desatualizada atualiza 0 linhas (pedido alterado pelo cliente)');

    SELECT versao INTO v_vista FROM pedido WHERE codigo = v_codigo;      -- terminal recarregou
    UPDATE pedido SET status = 'EM_PREPARO', data_pagamento = now(),
           id_colaborador_pagamento = (SELECT id_colaborador FROM colaborador WHERE usuario = 'ana.souza')
     WHERE codigo = v_codigo AND status = 'AGUARDANDO_PAGAMENTO' AND versao = v_vista;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.verificar(v_n = 1, 'Confirmar com a versão atual atualiza o pedido para EM_PREPARO');
END;
$$;
SELECT pg_temp.commit_simulado();

SELECT pg_temp.verificar((SELECT status = 'EM_PREPARO' AND data_pagamento IS NOT NULL AND id_colaborador_pagamento IS NOT NULL
                            FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Pagamento registra data e colaborador (RF09)');
SELECT pg_temp.verificar((SELECT COUNT(*) = 2 AND bool_and(id_colaborador IS NOT NULL OR status_novo = 'AGUARDANDO_PAGAMENTO')
                            FROM historico_status
                           WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))),
       'Auditoria: AGUARDANDO -> EM_PREPARO registrada com o colaborador');

-- ============================================================================
-- 5. Congelamento após o pagamento (RF08) e identidade imutável (RNF06)
-- ============================================================================
SELECT pg_temp.deve_falhar(
       format($$INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES (%s, %s, 1, 0)$$,
              pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1')), pg_temp.id_produto('Cappuccino')),
       'após a confirmação do pagamento', 'Após o pagamento não é possível incluir itens');
SELECT pg_temp.deve_falhar(
       format($$DELETE FROM item_pedido WHERE id_pedido = %s$$, pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))),
       'após a confirmação do pagamento', 'Após o pagamento não é possível remover itens');
SELECT pg_temp.deve_falhar(
       format($$UPDATE item_pedido SET quantidade = 9 WHERE id_pedido = %s$$, pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))),
       'após a confirmação do pagamento', 'Após o pagamento não é possível alterar quantidades');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET local_entrega = 'Mesa 9' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'não pode ser alterado', 'Após o pagamento não é possível mudar o local de entrega');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET codigo = 'PED-9999' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'imutáveis', 'Código do pedido é imutável durante o ciclo (RNF06)');
SELECT pg_temp.deve_falhar(
       format($$DELETE FROM pedido WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'não podem ser excluídos', 'Pedidos não podem ser apagados (histórico preservado)');

-- ============================================================================
-- 6. Ciclo de status e atalhos proibidos (RF11, RF12, RF15)
-- ============================================================================
INSERT INTO ctx VALUES ('p2', pg_temp.novo_pedido('Mesa 3', 'Cappuccino', 1));

SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'EM_PREPARO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p2')),
       'ck_pedido_pagamento', 'Não é possível ir a EM_PREPARO sem confirmar o pagamento');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'PRONTO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p2')),
       'Transição de status não permitida', 'AGUARDANDO_PAGAMENTO -> PRONTO é recusado');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'FINALIZADO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p2')),
       'Transição de status não permitida', 'Finalizar com pagamento pendente é recusado');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'ENTREGUE' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Transição de status não permitida', 'EM_PREPARO -> ENTREGUE (pular PRONTO) é recusado');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'FINALIZADO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Transição de status não permitida', 'FINALIZADO só a partir de ENTREGUE: EM_PREPARO -> FINALIZADO é recusado');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'FINALIZADO', valor_total = valor_total WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p2')),
       'Transição de status não permitida', 'Atalho AGUARDANDO -> FINALIZADO é recusado');

-- sem colaborador identificado a auditoria recusa a mudança
SELECT set_config('app.id_colaborador', '', true);
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'PRONTO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'ck_historico_colaborador', 'Mudança de status sem app.id_colaborador é recusada (auditoria obrigatória)');
SELECT set_config('app.id_colaborador',
                  (SELECT id_colaborador::TEXT FROM colaborador WHERE usuario = 'ana.souza'), true);

-- ciclo completo de p1
UPDATE pedido SET status = 'PRONTO'   WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1') AND status = 'EM_PREPARO';
UPDATE pedido SET status = 'ENTREGUE' WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1') AND status = 'PRONTO';
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'CANCELADO', justificativa_cancelamento = 'teste' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'Transição de status não permitida', 'Pedido ENTREGUE não pode ser cancelado');
UPDATE pedido SET status = 'FINALIZADO', observacao_interna = 'Cliente satisfeito'
 WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1') AND status = 'ENTREGUE';
SELECT pg_temp.commit_simulado();

SELECT pg_temp.verificar((SELECT COUNT(*) = 5 FROM historico_status
                           WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p1'))),
       'Auditoria: 5 registros (AGUARDANDO, EM_PREPARO, PRONTO, ENTREGUE, FINALIZADO)');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET local_entrega = 'Mesa 2' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p1')),
       'não pode mais ser alterado', 'Pedido FINALIZADO é imutável');
UPDATE pedido SET observacao_interna = 'Observação registrada depois de finalizar'
 WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1');
SELECT pg_temp.verificar(TRUE, 'RF16: observação interna ainda pode ser registrada após finalizar');

-- ============================================================================
-- 7. Cancelamento (RF10, RF16)
-- ============================================================================
-- (a) pagamento pendente: sem justificativa
UPDATE pedido SET status = 'CANCELADO' WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p2') AND status = 'AGUARDANDO_PAGAMENTO';
SELECT pg_temp.verificar((SELECT status = 'CANCELADO' FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p2')),
       'Cancelar pedido com pagamento pendente não exige justificativa');

-- (b) já pago: justificativa obrigatória
INSERT INTO ctx VALUES ('p3', pg_temp.novo_pedido('Mesa 8', 'Café Expresso', 2));
UPDATE pedido SET status = 'EM_PREPARO', data_pagamento = now(),
       id_colaborador_pagamento = (SELECT id_colaborador FROM colaborador WHERE usuario = 'ana.souza')
 WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p3');
SELECT pg_temp.commit_simulado();
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'CANCELADO' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p3')),
       'ck_pedido_justificativa', 'Cancelar pedido já pago sem justificativa é recusado');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET status = 'CANCELADO', justificativa_cancelamento = '   ' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p3')),
       'ck_pedido_justificativa', 'Justificativa em branco é recusada');
UPDATE pedido SET status = 'CANCELADO', justificativa_cancelamento = 'Cliente desistiu após o preparo'
 WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p3');
SELECT pg_temp.verificar((SELECT status = 'CANCELADO' AND data_pagamento IS NOT NULL
                            FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p3')),
       'Cancelar pedido já pago com justificativa é aceito e mantém o registro do pagamento');
SELECT pg_temp.deve_falhar(
       format($$UPDATE pedido SET justificativa_cancelamento = 'x' WHERE codigo = %L$$, (SELECT valor FROM ctx WHERE chave = 'p_unico')),
       'ck_pedido_justificativa_cancelado', 'Justificativa só existe em pedido cancelado');

-- ============================================================================
-- 8. Auditoria imutável, senha e tokens (RNF05, RNF07)
-- ============================================================================
SELECT pg_temp.deve_falhar($$UPDATE historico_status SET status_novo = 'PRONTO'$$,
       'imutável', 'Trilha de auditoria não pode ser alterada');
SELECT pg_temp.deve_falhar($$DELETE FROM historico_status$$,
       'imutável', 'Trilha de auditoria não pode ser apagada');
SELECT pg_temp.deve_falhar($$INSERT INTO colaborador (nome, usuario, senha_hash) VALUES ('X', 'x.user', 'senha123')$$,
       'ck_colaborador_senha_bcrypt', 'Senha em texto puro é recusada (somente hash bcrypt)');
SELECT pg_temp.verificar((SELECT COUNT(DISTINCT token_acesso) = COUNT(*) FROM pedido),
       'token_acesso é único por pedido');
SELECT pg_temp.verificar((SELECT COUNT(*) = 0 FROM pedido
                           WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1') AND token_acesso = gen_random_uuid()),
       'Consulta com código correto e token errado não retorna o pedido');

-- ============================================================================
-- 9. Produto: preço histórico, indisponibilidade e exclusão lógica (RF18)
-- ============================================================================
INSERT INTO ctx VALUES ('p4', pg_temp.novo_pedido('Mesa 4', 'Café Gelado', 1));
UPDATE produto SET preco = 15.00, disponivel = FALSE WHERE nome = 'Café Gelado';
SELECT pg_temp.verificar((SELECT valor_total = 9.00 FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p4')),
       'Mudar preço/disponibilidade não afeta pedido já registrado (9,00 mantido)');
UPDATE item_pedido SET quantidade = 2
 WHERE id_pedido = pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p4'));
SELECT pg_temp.commit_simulado();
SELECT pg_temp.verificar((SELECT valor_total = 18.00 FROM pedido WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p4')),
       'Item mantido continua com o preço original ao alterar a quantidade (2 x 9,00)');
SELECT pg_temp.deve_falhar(
       format($$INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES (%s, %s, 1, 0)$$,
              pg_temp.id_pedido((SELECT valor FROM ctx WHERE chave = 'p4')), pg_temp.id_produto('Café Gelado')),
       'indisponível', 'Produto que ficou indisponível não aceita nova seleção');

UPDATE produto SET ativo = FALSE, disponivel = FALSE WHERE nome = 'Alfajor';
SELECT pg_temp.verificar((SELECT COUNT(*) = 0 FROM v_cardapio WHERE nome = 'Alfajor'),
       'Produto removido logicamente (ativo = FALSE) some do cardápio');
SELECT pg_temp.verificar((SELECT COUNT(*) > 0 FROM item_pedido WHERE id_produto = pg_temp.id_produto('Alfajor')),
       'Histórico de pedidos com o produto removido permanece íntegro');
SELECT pg_temp.deve_falhar($$DELETE FROM produto WHERE nome = 'Alfajor'$$,
       'foreign key', 'DELETE físico de produto com histórico é recusado (usar exclusão lógica)');

-- ============================================================================
-- 10. Views (RF02, RF07, RF10, RF15)
-- ============================================================================
SELECT pg_temp.verificar((SELECT COUNT(*) = 1 FROM v_cardapio WHERE nome = 'Cappuccino'
                             AND jsonb_array_length(observacoes) = 3),
       'v_cardapio: Cappuccino traz suas 3 observações aceitas');
SELECT pg_temp.verificar((SELECT COUNT(*) = 1 FROM v_cardapio WHERE nome = 'Café Gelado' AND disponivel = FALSE),
       'v_cardapio: produto indisponível vem junto (para ficar cinza)');
SELECT pg_temp.verificar(
       (SELECT bool_or(codigo = 'PED-0001') AND NOT bool_or(codigo IN
                 ((SELECT valor FROM ctx WHERE chave = 'p1'), (SELECT valor FROM ctx WHERE chave = 'p2'),
                  (SELECT valor FROM ctx WHERE chave = 'p3'))) FROM v_pedidos_pendentes),
       'v_pedidos_pendentes: mantém abertos e remove finalizados/cancelados da fila');
SELECT pg_temp.verificar(
       (SELECT COUNT(*) = 3 FROM v_historico_pedidos
         WHERE codigo IN ((SELECT valor FROM ctx WHERE chave = 'p1'), (SELECT valor FROM ctx WHERE chave = 'p2'),
                          (SELECT valor FROM ctx WHERE chave = 'p3'))
           AND aviso IN ('FINALIZADO','CANCELADO')),
       'v_historico_pedidos: finalizados e cancelados permanecem com o aviso');
SELECT pg_temp.verificar(
       (SELECT encerrado_por = 'Ana Souza' FROM v_historico_pedidos WHERE codigo = (SELECT valor FROM ctx WHERE chave = 'p1')),
       'v_historico_pedidos: informa quem finalizou/cancelou');

ROLLBACK;
