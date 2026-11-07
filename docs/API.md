# Contrato da API (JSON). Erros: `{"codigo": "...", "mensagem": "...", "detalhes"?: {...}}`

## Módulo Cliente (sem login; token do pedido no cabeçalho `X-Token-Pedido`)
| Método e rota | Caso de uso |
|---|---|
| `GET /api/cardapio` | Visualizar cardápio (RF02, RF04, RF18) |
| `POST /api/pedidos` (+ `Idempotency-Key`) | Realizar pedido (RF05, RF06) → `{token, pedido}` |
| `GET /api/pedidos/{codigo}` | Acompanhar status (RF13, RF14) |
| `PUT /api/pedidos/{codigo}` | Alterar pedido pendente (RF08); `409 ALTERACAO_APOS_PAGAMENTO` |

## Módulo Colaborador (cookie de sessão + cabeçalho `X-Requested-With: cafeteria-painel` nas escritas)
| Método e rota | Caso de uso |
|---|---|
| `POST /api/painel/login` · `GET /sessao` · `POST /logout` | Login (RF17) |
| `GET /api/painel/pedidos` · `GET /pedidos/{codigo}` | Fila (RF07) |
| `POST /pedidos/{codigo}/pagamento` `{versao}` | Confirmar pagamento (RF09/RF11); `409 PEDIDO_ALTERADO` |
| `POST /pedidos/{codigo}/status` `{para: PRONTO\|ENTREGUE}` | Atualizar status (RF12) |
| `POST /pedidos/{codigo}/cancelamento` `{texto}` | Cancelar (RF10); justificativa obrigatória se já pago |
| `POST /pedidos/{codigo}/finalizacao` `{texto?}` | Finalizar (RF15) |
| `PUT /pedidos/{codigo}/observacao` `{texto}` | Observação interna (RF16) |
| `GET /historico` | Histórico de finalizados/cancelados |
| `GET/POST /produtos` · `PUT/DELETE /produtos/{id}` · `PUT /produtos/{id}/disponibilidade` · `GET /produtos/{id}/pendentes` | Gestão de produtos (RF18) |
| `GET /categorias` · `GET /observacoes` | Listas de apoio |
