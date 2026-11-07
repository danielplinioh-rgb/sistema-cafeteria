-- ============================================================================
--  cafeteria_db  |  Automatização de Cardápio de Cafeteria (Havanna – GRU)
--  Script de criação do banco de dados  |  PostgreSQL 13 ou superior
--
--  Versão alinhada à análise "documentação (PDF) x plano de banco (DOCX)".
--  Os itens [A1]..[A12] referem-se à tabela de ajustes da análise:
--    A1  código do pedido gerado pelo banco (sequência) e obtido pela aplicação
--    A2  alteração de pedido pendente em uma única transação (itens + total)
--    A3  coluna versao (concorrência entre alteração do cliente e pagamento)
--    A4  justificativa de cancelamento x observação interna (colunas separadas)
--    A5  FINALIZADO somente a partir de ENTREGUE
--    A6  token_acesso (UUID) para as operações do cliente
--    A8  campos que faltavam no modelo de classes (data_pagamento, ativo...)
--    A9  observações do item em tabela própria, com FK à lista fechada
--    A10 exclusão lógica de produto (coluna ativo)
--    A11 regras de transição, trilha de auditoria obrigatória e guardas
--    A12 sequência, view, CHECKs e triggers definidos neste DDL
--  (A7 e A5 também exigem correção nos diagramas/casos de uso: ver plano.)
--
--  Como executar:
--    createdb cafeteria_db
--    psql -d cafeteria_db -v ON_ERROR_STOP=1 -f schema.sql
--
--  Convenção para a aplicação (Java):
--    * Em toda transação de colaborador, executar antes das alterações:
--        SELECT set_config('app.id_colaborador', '<id do colaborador logado>', true);
--      O gatilho de auditoria usa esse valor para registrar quem mudou o status.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABELAS DE CADASTRO
-- ----------------------------------------------------------------------------

-- Usuários do terminal interno (RF17).
CREATE TABLE colaborador (
    id_colaborador  SERIAL        PRIMARY KEY,
    nome            VARCHAR(100)  NOT NULL,
    usuario         VARCHAR(50)   NOT NULL UNIQUE,
    senha_hash      VARCHAR(100)  NOT NULL,
    ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
    -- RNF07: a senha nunca é texto puro; só aceita hash bcrypt ($2a$/$2b$/$2y$).
    CONSTRAINT ck_colaborador_senha_bcrypt
        CHECK (senha_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$')
);

-- Categorias do cardápio (RF02).
CREATE TABLE categoria (
    id_categoria  SERIAL        PRIMARY KEY,
    nome          VARCHAR(60)   NOT NULL UNIQUE,
    descricao     VARCHAR(150)
);

-- Produtos do cardápio (RF02, RF18).
--   disponivel = FALSE -> aparece cinza e não é selecionável (RF18).
--   ativo      = FALSE -> exclusão lógica [A10]: some do cardápio, mas o
--                         histórico de pedidos continua íntegro.
CREATE TABLE produto (
    id_produto    SERIAL         PRIMARY KEY,
    id_categoria  INT            NOT NULL REFERENCES categoria (id_categoria),
    nome          VARCHAR(100)   NOT NULL,
    descricao     VARCHAR(255),
    preco         NUMERIC(10,2)  NOT NULL CHECK (preco >= 0),
    disponivel    BOOLEAN        NOT NULL DEFAULT TRUE,
    imagem        VARCHAR(255),
    ativo         BOOLEAN        NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_produto_categoria ON produto (id_categoria);

-- Lista fechada de observações (RF04). Sem personalização livre nem adicionais.
CREATE TABLE observacao_predefinida (
    id_observacao  SERIAL       PRIMARY KEY,
    descricao      VARCHAR(80)  NOT NULL UNIQUE
);

-- Quais observações cada produto aceita (N:N).
CREATE TABLE produto_observacao (
    id_produto     INT NOT NULL REFERENCES produto (id_produto),
    id_observacao  INT NOT NULL REFERENCES observacao_predefinida (id_observacao),
    PRIMARY KEY (id_produto, id_observacao)
);

-- ----------------------------------------------------------------------------
-- 2. CÓDIGO ÚNICO DO PEDIDO  [A1]  (RF06, RNF06)
--    Fonte única: sequência do banco. A aplicação obtém o código com
--    "SELECT proximo_codigo_pedido()" (RepositorioPedido.proximoCodigo(),
--    chamado por Pedido.gerarCodigo()), preservando a ordem da Fig. 4.
--    Se o código não for informado no INSERT, o DEFAULT gera o mesmo formato.
-- ----------------------------------------------------------------------------
CREATE SEQUENCE seq_codigo_pedido START 1;

CREATE FUNCTION proximo_codigo_pedido() RETURNS VARCHAR AS $$
DECLARE
    v_n BIGINT := nextval('seq_codigo_pedido');
BEGIN
    -- PED-0001 ... PED-9999, depois PED-10000 (sem truncar).
    RETURN 'PED-' || CASE WHEN v_n < 10000 THEN lpad(v_n::TEXT, 4, '0') ELSE v_n::TEXT END;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. PEDIDO  (RF05 a RF16, RNF05, RNF06)
-- ----------------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido                  SERIAL         PRIMARY KEY,
    codigo                     VARCHAR(12)    NOT NULL UNIQUE
                                              DEFAULT proximo_codigo_pedido(),
    -- [A6] identificador não adivinhável, guardado no dispositivo do cliente;
    --      exigido nas operações do cliente (consultar/alterar). O código
    --      continua sendo o identificador exibido e usado pelo colaborador.
    token_acesso               UUID           NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    data_hora                  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    status                     VARCHAR(25)    NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    local_entrega             VARCHAR(30)    NOT NULL,
    -- Mantido pelo banco a partir dos itens (RF08); a aplicação não o informa.
    valor_total                NUMERIC(10,2)  NOT NULL DEFAULT 0,
    data_pagamento             TIMESTAMPTZ,                       -- [A8] RF09
    id_colaborador_pagamento   INT            REFERENCES colaborador (id_colaborador),
    observacao_interna         VARCHAR(255),                      -- RF16
    justificativa_cancelamento VARCHAR(255),                      -- RF10 [A4]
    -- [A3] contador incrementado a cada alteração de itens/observações.
    versao                     INT            NOT NULL DEFAULT 1,

    CONSTRAINT ck_pedido_codigo   CHECK (codigo ~ '^PED-[0-9]{4,8}$'),
    CONSTRAINT ck_pedido_status   CHECK (status IN ('AGUARDANDO_PAGAMENTO','EM_PREPARO',
                                                    'PRONTO','ENTREGUE','FINALIZADO','CANCELADO')),
    CONSTRAINT ck_pedido_local    CHECK (local_entrega ~ '^(Mesa [1-9][0-9]{0,3}|Retirada no Balcão)$'),
    CONSTRAINT ck_pedido_valor    CHECK (valor_total >= 0),
    CONSTRAINT ck_pedido_versao   CHECK (versao >= 1),
    -- Nenhum pedido avança (Em preparo ou adiante) sem pagamento confirmado.
    CONSTRAINT ck_pedido_pagamento
        CHECK (status IN ('AGUARDANDO_PAGAMENTO','CANCELADO') OR data_pagamento IS NOT NULL),
    -- Enquanto aguarda pagamento, não pode haver data de pagamento.
    CONSTRAINT ck_pedido_aguardando
        CHECK (status <> 'AGUARDANDO_PAGAMENTO' OR data_pagamento IS NULL),
    -- RF09: sempre se sabe quem confirmou o pagamento.
    CONSTRAINT ck_pedido_pagador
        CHECK ((data_pagamento IS NULL) = (id_colaborador_pagamento IS NULL)),
    -- RF10/RF16: cancelamento de pedido já pago exige justificativa.
    CONSTRAINT ck_pedido_justificativa
        CHECK (status <> 'CANCELADO' OR data_pagamento IS NULL
               OR length(btrim(coalesce(justificativa_cancelamento, ''))) > 0),
    CONSTRAINT ck_pedido_justificativa_cancelado
        CHECK (justificativa_cancelamento IS NULL OR status = 'CANCELADO')
);
CREATE INDEX ix_pedido_fila ON pedido (data_hora)
    WHERE status NOT IN ('FINALIZADO','CANCELADO');                 -- RF07, RF15

-- ----------------------------------------------------------------------------
-- 4. ITENS DO PEDIDO  (RF03, RF04, RF08)
-- ----------------------------------------------------------------------------
CREATE TABLE item_pedido (
    id_item         SERIAL         PRIMARY KEY,
    id_pedido       INT            NOT NULL REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    id_produto      INT            NOT NULL REFERENCES produto (id_produto),
    quantidade      INT            NOT NULL CHECK (quantidade > 0),
    -- Preço no momento do pedido. Sempre copiado de produto.preco pelo banco
    -- (o valor enviado pela aplicação é ignorado): preserva o histórico e
    -- impede preço adulterado pelo cliente.
    preco_unitario  NUMERIC(10,2)  NOT NULL CHECK (preco_unitario >= 0),
    CONSTRAINT uq_item_pedido_produto UNIQUE (id_item, id_produto)  -- alvo da FK abaixo
);
CREATE INDEX ix_item_pedido_pedido  ON item_pedido (id_pedido);
CREATE INDEX ix_item_pedido_produto ON item_pedido (id_produto);

-- [A9] Observações escolhidas para cada item (0..N), sempre da lista fechada
--      e apenas as aceitas pelo produto do item (FK composta).
CREATE TABLE item_pedido_observacao (
    id_item        INT NOT NULL,
    id_produto     INT NOT NULL,
    id_observacao  INT NOT NULL,
    PRIMARY KEY (id_item, id_observacao),
    FOREIGN KEY (id_item, id_produto)
        REFERENCES item_pedido (id_item, id_produto) ON DELETE CASCADE,
    FOREIGN KEY (id_produto, id_observacao)
        REFERENCES produto_observacao (id_produto, id_observacao)
);

-- ----------------------------------------------------------------------------
-- 5. TRILHA DE AUDITORIA DE STATUS  [A11]  (RNF05, RNF08)
--    Obrigatória e alimentada por gatilho: quem finalizou/cancelou só existe aqui.
-- ----------------------------------------------------------------------------
CREATE TABLE historico_status (
    id_historico     SERIAL       PRIMARY KEY,
    id_pedido        INT          NOT NULL REFERENCES pedido (id_pedido),
    status_anterior  VARCHAR(25),
    status_novo      VARCHAR(25)  NOT NULL,
    data_hora        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    id_colaborador   INT          REFERENCES colaborador (id_colaborador),
    CONSTRAINT ck_historico_status_novo
        CHECK (status_novo IN ('AGUARDANDO_PAGAMENTO','EM_PREPARO','PRONTO','ENTREGUE','FINALIZADO','CANCELADO')),
    CONSTRAINT ck_historico_status_anterior
        CHECK (status_anterior IS NULL OR status_anterior IN
               ('AGUARDANDO_PAGAMENTO','EM_PREPARO','PRONTO','ENTREGUE','FINALIZADO','CANCELADO')),
    -- Toda mudança feita após a criação é de um colaborador.
    CONSTRAINT ck_historico_colaborador
        CHECK (status_novo = 'AGUARDANDO_PAGAMENTO' OR id_colaborador IS NOT NULL)
);
CREATE INDEX ix_historico_pedido ON historico_status (id_pedido, id_historico);

-- ----------------------------------------------------------------------------
-- 6. REGRAS NO BANCO (segunda barreira, além da validação feita pelo Java)
-- ----------------------------------------------------------------------------

-- 6.1 Criação: todo pedido nasce aguardando pagamento.
CREATE FUNCTION fn_pedido_antes_insert() RETURNS trigger AS $$
BEGIN
    IF NEW.status <> 'AGUARDANDO_PAGAMENTO'
       OR NEW.data_pagamento IS NOT NULL
       OR NEW.id_colaborador_pagamento IS NOT NULL
       OR NEW.justificativa_cancelamento IS NOT NULL THEN
        RAISE EXCEPTION 'Todo pedido deve ser criado com status AGUARDANDO_PAGAMENTO e sem pagamento'
            USING ERRCODE = 'check_violation';
    END IF;
    NEW.versao := 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_antes_insert
    BEFORE INSERT ON pedido FOR EACH ROW EXECUTE FUNCTION fn_pedido_antes_insert();

-- 6.2 Alteração: identidade imutável, ciclo de status, congelamento pós-pagamento.
CREATE FUNCTION fn_pedido_antes_update() RETURNS trigger AS $$
DECLARE
    v_copia  pedido%ROWTYPE;
BEGIN
    -- RNF06: código (e token/data) acompanham o pedido durante todo o ciclo.
    IF NEW.id_pedido <> OLD.id_pedido OR NEW.codigo <> OLD.codigo
       OR NEW.token_acesso <> OLD.token_acesso OR NEW.data_hora <> OLD.data_hora THEN
        RAISE EXCEPTION 'Código, token e data do pedido são imutáveis (RNF06)'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.versao < OLD.versao THEN
        RAISE EXCEPTION 'A versão do pedido não pode diminuir' USING ERRCODE = 'check_violation';
    END IF;

    -- Estados finais: só a observação interna pode ser registrada (RF16).
    IF OLD.status IN ('FINALIZADO','CANCELADO') THEN
        v_copia := NEW;
        v_copia.observacao_interna := OLD.observacao_interna;
        IF v_copia IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION 'Pedido % já está % e não pode mais ser alterado (apenas observação interna)',
                OLD.codigo, OLD.status USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;

    -- [A5][A11] Ciclo de status. Cancelamento: nunca a partir de ENTREGUE.
    IF NEW.status <> OLD.status THEN
        IF NOT ((OLD.status, NEW.status) IN (
                ('AGUARDANDO_PAGAMENTO','EM_PREPARO'),
                ('AGUARDANDO_PAGAMENTO','CANCELADO'),
                ('EM_PREPARO','PRONTO'),
                ('EM_PREPARO','CANCELADO'),
                ('PRONTO','ENTREGUE'),
                ('PRONTO','CANCELADO'),
                ('ENTREGUE','FINALIZADO'))) THEN
            RAISE EXCEPTION 'Transição de status não permitida: % -> % (pedido %)',
                OLD.status, NEW.status, OLD.codigo USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- RF08: após o pagamento (ou ao sair de "aguardando"), nada do pedido muda.
    IF NOT (OLD.status = 'AGUARDANDO_PAGAMENTO' AND NEW.status = 'AGUARDANDO_PAGAMENTO') THEN
        IF NEW.valor_total <> OLD.valor_total OR NEW.local_entrega <> OLD.local_entrega THEN
            RAISE EXCEPTION 'Após a confirmação do pagamento o pedido não pode ser alterado (RF08)'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF OLD.data_pagamento IS NOT NULL
       AND (NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento
            OR NEW.id_colaborador_pagamento IS DISTINCT FROM OLD.id_colaborador_pagamento) THEN
        RAISE EXCEPTION 'Dados do pagamento confirmado não podem ser alterados'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_antes_update
    BEFORE UPDATE ON pedido FOR EACH ROW EXECUTE FUNCTION fn_pedido_antes_update();

-- 6.3 Pedidos nunca são apagados: cancelados/finalizados ficam no histórico (RF10, RF15).
CREATE FUNCTION fn_pedido_sem_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Pedidos não podem ser excluídos; cancele ou finalize para preservar o histórico'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_sem_delete
    BEFORE DELETE ON pedido FOR EACH ROW EXECUTE FUNCTION fn_pedido_sem_delete();

-- 6.4 Auditoria obrigatória do status [A11]. Colaborador vem de app.id_colaborador
--     (ou de id_colaborador_pagamento na confirmação do pagamento).
CREATE FUNCTION fn_pedido_historico() RETURNS trigger AS $$
DECLARE
    v_colab INT := NULLIF(current_setting('app.id_colaborador', true), '')::INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO historico_status (id_pedido, status_anterior, status_novo, id_colaborador)
        VALUES (NEW.id_pedido, NULL, NEW.status, v_colab);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'EM_PREPARO' THEN
            v_colab := COALESCE(NEW.id_colaborador_pagamento, v_colab);
        END IF;
        INSERT INTO historico_status (id_pedido, status_anterior, status_novo, id_colaborador)
        VALUES (NEW.id_pedido, OLD.status, NEW.status, v_colab);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_historico
    AFTER INSERT OR UPDATE OF status ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_historico();

CREATE FUNCTION fn_historico_imutavel() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A trilha de auditoria de status é imutável' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historico_imutavel
    BEFORE UPDATE OR DELETE ON historico_status
    FOR EACH ROW EXECUTE FUNCTION fn_historico_imutavel();

-- 6.5 Itens: só mudam com o pedido aguardando pagamento (RF08).
CREATE FUNCTION fn_item_protecao() RETURNS trigger AS $$
DECLARE
    v_pedido  INT;
    v_status  VARCHAR(25);
BEGIN
    IF TG_TABLE_NAME = 'item_pedido' THEN
        v_pedido := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_pedido ELSE NEW.id_pedido END;
        IF TG_OP = 'UPDATE' AND (NEW.id_pedido <> OLD.id_pedido OR NEW.id_produto <> OLD.id_produto) THEN
            RAISE EXCEPTION 'Pedido e produto de um item não podem ser trocados; remova e inclua outro item'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        SELECT id_pedido INTO v_pedido FROM item_pedido
         WHERE id_item = CASE WHEN TG_OP = 'DELETE' THEN OLD.id_item ELSE NEW.id_item END;
    END IF;

    IF v_pedido IS NOT NULL THEN
        -- FOR SHARE: espera uma confirmação de pagamento concorrente terminar.
        SELECT status INTO v_status FROM pedido WHERE id_pedido = v_pedido FOR SHARE;
        IF v_status IS NOT NULL AND v_status <> 'AGUARDANDO_PAGAMENTO' THEN
            RAISE EXCEPTION 'Alterações não são permitidas após a confirmação do pagamento'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_a_protecao
    BEFORE INSERT OR UPDATE OR DELETE ON item_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_item_protecao();
CREATE TRIGGER trg_obs_a_protecao
    BEFORE INSERT OR UPDATE OR DELETE ON item_pedido_observacao
    FOR EACH ROW EXECUTE FUNCTION fn_item_protecao();

-- 6.6 Item novo: produto precisa estar ativo e disponível; preço vem do cadastro.
--     (Itens já existentes mantêm preço e permanecem mesmo que o produto fique
--      indisponível depois: a indisponibilidade afeta só novas seleções.)
CREATE FUNCTION fn_item_novo() RETURNS trigger AS $$
DECLARE
    r_prod  produto%ROWTYPE;
BEGIN
    SELECT * INTO r_prod FROM produto WHERE id_produto = NEW.id_produto;
    IF NOT FOUND THEN
        RETURN NEW;                     -- a FK acusa o produto inexistente
    END IF;
    IF NOT (r_prod.ativo AND r_prod.disponivel) THEN
        RAISE EXCEPTION 'Produto "%" indisponível: não pode ser adicionado ao pedido', r_prod.nome
            USING ERRCODE = 'check_violation';
    END IF;
    NEW.preco_unitario := r_prod.preco;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_b_novo
    BEFORE INSERT ON item_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_item_novo();

-- 6.7 Total e versão acompanham os itens [A2][A3]: recalculados pelo banco na
--     mesma transação da alteração. Mudou item ou observação => versao + 1.
CREATE FUNCTION fn_item_totais() RETURNS trigger AS $$
DECLARE
    v_pedido  INT;
BEGIN
    IF TG_TABLE_NAME = 'item_pedido' THEN
        v_pedido := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_pedido ELSE NEW.id_pedido END;
    ELSE
        SELECT id_pedido INTO v_pedido FROM item_pedido
         WHERE id_item = CASE WHEN TG_OP = 'DELETE' THEN OLD.id_item ELSE NEW.id_item END;
    END IF;

    IF v_pedido IS NOT NULL THEN
        UPDATE pedido p
           SET valor_total = (SELECT COALESCE(SUM(i.quantidade * i.preco_unitario), 0)
                                FROM item_pedido i WHERE i.id_pedido = p.id_pedido),
               versao      = p.versao + 1
         WHERE p.id_pedido = v_pedido;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_c_totais
    AFTER INSERT OR UPDATE OR DELETE ON item_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_item_totais();
CREATE TRIGGER trg_obs_c_versao
    AFTER INSERT OR UPDATE OR DELETE ON item_pedido_observacao
    FOR EACH ROW EXECUTE FUNCTION fn_item_totais();

-- 6.8 Integridade conferida no COMMIT (gatilho adiado): todo pedido tem ao menos
--     um item (1..*) e valor_total = soma dos subtotais (RNF05).
CREATE FUNCTION fn_pedido_integridade() RETURNS trigger AS $$
DECLARE
    v_pedido  INT;
    v_valor   NUMERIC(10,2);
    v_itens   INT;
    v_soma    NUMERIC(10,2);
BEGIN
    IF TG_TABLE_NAME = 'pedido' THEN
        v_pedido := NEW.id_pedido;
    ELSE
        v_pedido := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_pedido ELSE NEW.id_pedido END;
    END IF;

    SELECT valor_total INTO v_valor FROM pedido WHERE id_pedido = v_pedido;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(quantidade * preco_unitario), 0)
      INTO v_itens, v_soma FROM item_pedido WHERE id_pedido = v_pedido;

    IF v_itens = 0 THEN
        RAISE EXCEPTION 'O pedido deve ter ao menos um item (1..*)' USING ERRCODE = 'check_violation';
    END IF;
    IF v_soma <> v_valor THEN
        RAISE EXCEPTION 'valor_total (%) diverge da soma dos itens (%)', v_valor, v_soma
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ctg_pedido_integridade
    AFTER INSERT OR UPDATE ON pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_integridade();
CREATE CONSTRAINT TRIGGER ctg_item_integridade
    AFTER INSERT OR UPDATE OR DELETE ON item_pedido
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_integridade();

-- ----------------------------------------------------------------------------
-- 7. VIEWS
-- ----------------------------------------------------------------------------

-- Cardápio do cliente (RF02, RF04, RF18): indisponíveis vêm junto (ficam cinza);
-- produtos removidos logicamente (ativo = FALSE) não aparecem.
CREATE VIEW v_cardapio AS
SELECT c.id_categoria,
       c.nome       AS categoria,
       p.id_produto,
       p.nome,
       p.descricao,
       p.preco,
       p.disponivel,
       p.imagem,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id_observacao', o.id_observacao,
                                                     'descricao',     o.descricao)
                                  ORDER BY o.descricao)
                   FROM produto_observacao po
                   JOIN observacao_predefinida o ON o.id_observacao = po.id_observacao
                  WHERE po.id_produto = p.id_produto), '[]'::jsonb) AS observacoes
  FROM produto p
  JOIN categoria c ON c.id_categoria = p.id_categoria
 WHERE p.ativo;

-- Fila do terminal do colaborador (RF07, RF15): tudo que não foi finalizado/cancelado,
-- do mais antigo ao mais novo. "versao" deve ser devolvida em "confirmar pagamento".
CREATE VIEW v_pedidos_pendentes AS
SELECT pe.id_pedido,
       pe.codigo,
       pe.data_hora,
       pe.status,
       (pe.status = 'AGUARDANDO_PAGAMENTO') AS pagamento_pendente,
       pe.local_entrega,
       pe.valor_total,
       pe.versao,
       (SELECT jsonb_agg(jsonb_build_object(
                    'id_item',        i.id_item,
                    'produto',        pr.nome,
                    'quantidade',     i.quantidade,
                    'preco_unitario', i.preco_unitario,
                    'observacoes',    COALESCE((SELECT jsonb_agg(o.descricao ORDER BY o.descricao)
                                                  FROM item_pedido_observacao io
                                                  JOIN observacao_predefinida o ON o.id_observacao = io.id_observacao
                                                 WHERE io.id_item = i.id_item), '[]'::jsonb))
                ORDER BY i.id_item)
          FROM item_pedido i
          JOIN produto pr ON pr.id_produto = i.id_produto
         WHERE i.id_pedido = pe.id_pedido) AS itens
  FROM pedido pe
 WHERE pe.status NOT IN ('FINALIZADO','CANCELADO')
 ORDER BY pe.data_hora, pe.id_pedido;

-- Histórico (RF10, RF15, RF16): finalizados e cancelados, com o aviso exigido.
CREATE VIEW v_historico_pedidos AS
SELECT pe.id_pedido,
       pe.codigo,
       pe.data_hora,
       pe.status           AS aviso,          -- 'CANCELADO' ou 'FINALIZADO'
       pe.local_entrega,
       pe.valor_total,
       pe.data_pagamento,
       pe.justificativa_cancelamento,
       pe.observacao_interna,
       (SELECT h.data_hora FROM historico_status h
         WHERE h.id_pedido = pe.id_pedido AND h.status_novo = pe.status
         ORDER BY h.id_historico DESC LIMIT 1) AS data_encerramento,
       (SELECT co.nome FROM historico_status h
          JOIN colaborador co ON co.id_colaborador = h.id_colaborador
         WHERE h.id_pedido = pe.id_pedido AND h.status_novo = pe.status
         ORDER BY h.id_historico DESC LIMIT 1) AS encerrado_por
  FROM pedido pe
 WHERE pe.status IN ('FINALIZADO','CANCELADO');

-- ----------------------------------------------------------------------------
-- 8. DOCUMENTAÇÃO NO PRÓPRIO BANCO (rastreabilidade)
-- ----------------------------------------------------------------------------
COMMENT ON TABLE  colaborador            IS 'RF17, RNF07: usuários do terminal interno (senha em hash bcrypt).';
COMMENT ON TABLE  categoria              IS 'RF02: categorias do cardápio.';
COMMENT ON TABLE  produto                IS 'RF02, RF18: produtos; disponivel = FALSE fica cinza; ativo = FALSE é exclusão lógica.';
COMMENT ON TABLE  observacao_predefinida IS 'RF04: lista fechada de observações (ex.: Sem lactose).';
COMMENT ON TABLE  produto_observacao     IS 'RF04: observações aceitas por produto.';
COMMENT ON TABLE  pedido                 IS 'RF05-RF16, RNF05, RNF06: cabeçalho do pedido; total, versão e histórico mantidos pelo banco.';
COMMENT ON TABLE  item_pedido            IS 'RF03, RF08: itens; preço copiado de produto.preco no momento da inclusão.';
COMMENT ON TABLE  item_pedido_observacao IS 'RF04: observações do item, restritas às aceitas pelo produto.';
COMMENT ON TABLE  historico_status       IS 'RNF05, RNF08: trilha imutável de mudanças de status e de quem as fez.';
COMMENT ON COLUMN pedido.codigo                     IS 'RF06, RNF06: PED-0001; único e imutável.';
COMMENT ON COLUMN pedido.token_acesso               IS 'RNF07: segredo do cliente para consultar/alterar o próprio pedido.';
COMMENT ON COLUMN pedido.versao                     IS 'Muda a cada alteração de itens/observações; confirmar pagamento deve informar a versão exibida no terminal.';
COMMENT ON COLUMN pedido.justificativa_cancelamento IS 'RF10: obrigatória se cancelado após o pagamento.';
COMMENT ON COLUMN pedido.observacao_interna         IS 'RF16: nota livre do colaborador após finalizar/cancelar.';

COMMIT;
