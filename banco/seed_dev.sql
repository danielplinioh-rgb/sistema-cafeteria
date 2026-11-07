-- ============================================================================
--  cafeteria_db | DADOS DE DESENVOLVIMENTO (NÃO USAR EM PRODUÇÃO)
--  Reproduz o exemplo do Diagrama de Objetos (Fig. 3): pedido PED-0001, Mesa 5,
--  2 x Cappuccino ("Sem açúcar") + 1 x Café Expresso = R$ 22,00.
--
--  Executar depois do schema.sql:
--    psql -d cafeteria_db -v ON_ERROR_STOP=1 -f seed_dev.sql
--
--  ATENÇÃO: a senha do colaborador de teste é fixa e pública ('trocar-senha-dev').
--  Troque ou remova este usuário antes de qualquer uso real (RNF07).
--  O hash é gerado com pgcrypto (bcrypt, $2a$) e é compatível com o
--  BCryptPasswordEncoder do Spring Security. Se a extensão não puder ser criada,
--  gere o hash na aplicação e use-o no INSERT.
--
--  As imagens (coluna produto.imagem) são arquivos da pasta frontend/publico/imagens.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO colaborador (nome, usuario, senha_hash)
VALUES ('Ana Souza', 'ana.souza', crypt('trocar-senha-dev', gen_salt('bf', 10)));

INSERT INTO categoria (nome, descricao) VALUES
    ('Bebidas Quentes', 'Cafés e chás'),
    ('Bebidas Geladas', 'Cafés gelados e sucos'),
    ('Doces',           'Alfajores e doces');

INSERT INTO produto (id_categoria, nome, descricao, preco, disponivel, imagem) VALUES
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Cappuccino',       'Café com leite vaporizado e espuma cremosa',  8.50, TRUE,  'cappuccino.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Café Expresso',    'Café curto, intenso e encorpado',              5.00, TRUE,  'expresso.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Chá Preto',        'Chá preto em infusão',                         6.00, FALSE, 'cha-preto.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Latte',            'Café suave com bastante leite vaporizado',     9.50, TRUE,  'latte.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Mocha',            'Café, chocolate e leite vaporizado',          10.50, TRUE,  'mocha.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Quentes'), 'Chocolate Quente', 'Chocolate cremoso servido bem quente',        11.00, TRUE,  'chocolate-quente.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Geladas'), 'Café Gelado',      'Café expresso com gelo',                       9.00, TRUE,  'cafe-gelado.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Bebidas Geladas'), 'Cold Brew',        'Café extraído a frio, refrescante',           12.00, TRUE,  'cold-brew.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Doces'),           'Alfajor',          'Alfajor recheado com doce de leite',          12.00, TRUE,  'alfajor.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Doces'),           'Alfajor de Chocolate', 'Alfajor coberto com chocolate meio amargo', 13.50, TRUE,  'alfajor-chocolate.svg'),
    ((SELECT id_categoria FROM categoria WHERE nome = 'Doces'),           'Brownie',          'Brownie macio de chocolate',                   9.00, TRUE,  'brownie.svg');

INSERT INTO observacao_predefinida (descricao) VALUES
    ('Sem lactose'), ('Sem açúcar'), ('Extra quente'), ('Com pouco gelo');

INSERT INTO produto_observacao (id_produto, id_observacao)
SELECT p.id_produto, o.id_observacao
  FROM produto p, observacao_predefinida o
 WHERE (p.nome IN ('Cappuccino','Café Expresso','Chá Preto','Latte','Mocha','Chocolate Quente')
        AND o.descricao IN ('Sem lactose','Sem açúcar','Extra quente'))
    OR (p.nome IN ('Café Gelado','Cold Brew')
        AND o.descricao IN ('Sem lactose','Sem açúcar','Com pouco gelo'));

-- Pedido do Diagrama de Objetos. valor_total, preço e versão são mantidos pelo banco.
INSERT INTO pedido (local_entrega) VALUES ('Mesa 5');

INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
SELECT (SELECT id_pedido FROM pedido WHERE codigo = 'PED-0001'), id_produto, 2, 0
  FROM produto WHERE nome = 'Cappuccino';
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario)
SELECT (SELECT id_pedido FROM pedido WHERE codigo = 'PED-0001'), id_produto, 1, 0
  FROM produto WHERE nome = 'Café Expresso';

INSERT INTO item_pedido_observacao (id_item, id_produto, id_observacao)
SELECT i.id_item, i.id_produto, o.id_observacao
  FROM item_pedido i
  JOIN produto p ON p.id_produto = i.id_produto AND p.nome = 'Cappuccino'
  JOIN observacao_predefinida o ON o.descricao = 'Sem açúcar'
 WHERE i.id_pedido = (SELECT id_pedido FROM pedido WHERE codigo = 'PED-0001');

COMMIT;
