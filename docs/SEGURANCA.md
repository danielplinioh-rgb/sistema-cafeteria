# Medidas de segurança (RNF07 e boas práticas OWASP)

| Risco | Defesa | Onde |
|---|---|---|
| Injeção de SQL | Somente consultas parametrizadas; papel de banco sem DDL | `repositorio/Sql.java`, `banco/papeis.sql` |
| Preço/total adulterado | O cliente nunca envia preço: o banco copia `produto.preco` e calcula o total | gatilhos em `banco/schema.sql` |
| Senhas expostas | BCrypt (custo 10); o banco recusa hash que não seja bcrypt; tempo de resposta equalizado | `ServicoAutenticacao`, `ck_colaborador_senha_bcrypt` |
| Enumeração de usuários | Mensagem única "Usuário ou senha inválidos." | `ServicoAutenticacao` |
| Força bruta | Bloqueio por usuário+IP (5 falhas/5 min) e limite de requisições por IP | `BloqueioTentativas`, `LimitadorTaxa` |
| Roubo/fixação de sessão | Token opaco de 256 bits (guardado só como SHA-256), cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` em HTTPS), novo token a cada login, expiração por inatividade e duração | `RegistroSessoes`, `PainelAutenticacaoController` |
| CSRF | SameSite=Strict + cabeçalho `X-Requested-With` obrigatório + verificação de `Origin` | `FiltroPainel` |
| Acesso a pedido de terceiros | Token secreto (UUID) por pedido, em cabeçalho; "não encontrado" idêntico para código ou token errados | `ServicoPedidoCliente` |
| Pedido duplicado por rede instável | Cabeçalho `Idempotency-Key` | `ServicoPedidoCliente.registrar` |
| Condição de corrida (alterar × pagar) | `SELECT … FOR UPDATE` + coluna `versao` no pagamento | `ServicoPedidoCliente.alterar`, `confirmarPagamento` |
| XSS / clickjacking / sniffing | React escapa saídas; CSP restritiva; `X-Frame-Options`, `nosniff`, `no-referrer` | `FiltroCabecalhosSeguranca`, `docker/nginx.conf` |
| Vazamento de erros | Respostas padronizadas sem stack trace/SQL; detalhes só no log | `TratadorErros` |
| Entrada maliciosa | Lista de permissão, limites de tamanho/quantidade, contrato JSON estrito, nome de imagem sem `../` | `ValidadorEntrada`, `application.yml` |
| Adulteração do histórico | Sem DELETE em pedidos; trilha de auditoria imutável por gatilho | `schema.sql`, `papeis.sql` |
| IP forjado | `X-Forwarded-For` só é considerado com `app.confiar-proxy=true` (nginx sobrescreve o cabeçalho) | `IpCliente` |

## Antes de ir a produção
1. Remover o usuário de demonstração (`CARREGAR_DADOS_DEMO=false`) e cadastrar colaboradores com senha própria (hash bcrypt).
2. Colocar HTTPS na frente (certificado) e ligar `COOKIE_SEGURO=true` e o HSTS no `nginx.conf`.
3. Trocar as senhas do `.env`. 4. Sessões e limites ficam em memória (um servidor); para vários, use Redis.
