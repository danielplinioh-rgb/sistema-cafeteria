-- ============================================================================
--  cafeteria_db | PAPEL DE ACESSO DA APLICAÇÃO (princípio do menor privilégio)
--
--  A aplicação (back-end Java) NÃO deve conectar com o usuário dono do banco.
--  Este script cria o papel "cafeteria_app" com apenas o que o sistema usa:
--    * sem DELETE em pedido / historico_status / produto / categoria / colaborador;
--    * colaboradores só são lidos (cadastro de usuários é feito pelo administrador);
--    * sem DDL (não cria, altera nem apaga tabelas).
--
--  Executar como dono/administrador, DEPOIS do schema.sql:
--    psql -d cafeteria_db -v ON_ERROR_STOP=1 -v senha_app="'SENHA-FORTE-AQUI'" -f papeis.sql
-- ============================================================================
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cafeteria_app') THEN
        CREATE ROLE cafeteria_app LOGIN;
    END IF;
END
$$;

ALTER ROLE cafeteria_app WITH LOGIN PASSWORD :senha_app;

-- conexão ao banco atual
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO cafeteria_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO cafeteria_app;

-- Cadastros
GRANT SELECT                         ON colaborador            TO cafeteria_app;  -- login
GRANT SELECT                         ON categoria              TO cafeteria_app;
GRANT SELECT, INSERT, UPDATE         ON produto                TO cafeteria_app;  -- exclusão é lógica (ativo)
GRANT SELECT                         ON observacao_predefinida TO cafeteria_app;
GRANT SELECT, INSERT, DELETE         ON produto_observacao     TO cafeteria_app;

-- Pedidos (UPDATE é exigido também pelo SELECT ... FOR UPDATE/SHARE)
GRANT SELECT, INSERT, UPDATE         ON pedido                 TO cafeteria_app;  -- sem DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON item_pedido            TO cafeteria_app;
GRANT SELECT, INSERT, DELETE         ON item_pedido_observacao TO cafeteria_app;
GRANT SELECT, INSERT                 ON historico_status       TO cafeteria_app;  -- trilha imutável

-- Views e sequências
GRANT SELECT ON v_cardapio, v_pedidos_pendentes, v_historico_pedidos TO cafeteria_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cafeteria_app;

COMMIT;
